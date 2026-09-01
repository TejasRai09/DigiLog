/**
 * Import Power Plant equipment forms from legacy Excel workbooks into pp_* tables.
 *
 * Place files in:
 *   backend/backlog-data/power data/
 *     - File for Electrical.xlsx   (dept: electrical)
 *     - File for Instrument.xlsx   (dept: instrument)
 *     - File for Instrument_2.xlsx (dept: instrument2)
 *
 * Each sheet (except Index/Summary) = one equipment with:
 *   Section 1 life history (top rows)
 *   Section 2 specifications
 *   Section 3 OEM maintenance schedule
 *   Section 4 maintenance history (if present in sheet)
 *
 * Usage (from backend/):
 *   npm run db:import-power-xlsx
 *   npm run db:import-power-xlsx -- --dry-run
 *   npm run db:import-power-xlsx -- --replace
 *   npm run db:import-power-xlsx -- --file "../path/to/File for Electrical.xlsx" --dept electrical
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../config/mysql');
const {
  DEFAULT_FILES,
  parseWorkbookFile,
} = require('../utils/powerEquipmentExcelImport');
const { enrichEquipment } = require('../utils/powerEquipmentClassification');

const DATA_DIR = path.join(__dirname, '..', 'backlog-data', 'power data');

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    replace: false,
    file: null,
    dept: null,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--replace') opts.replace = true;
    else if (a === '--file') opts.file = argv[++i];
    else if (a === '--dept') opts.dept = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/import-power-equipment-xlsx.js [options]

Options:
  --dry-run          Parse only; no database writes
  --replace          If equipment exists (dept + equip_no or dept + name), delete and re-import
  --file <path>      Import a single workbook
  --dept <name>      Required with --file (electrical | instrument | instrument2)
`);
      process.exit(0);
    }
  }

  return opts;
}

async function findExistingId(conn, equipment) {
  if (equipment.equip_no) {
    const [rows] = await conn.execute(
      'SELECT id FROM pp_equipment WHERE dept = ? AND equip_no = ? LIMIT 1',
      [equipment.dept, equipment.equip_no],
    );
    if (rows[0]) return rows[0].id;
  }

  if (equipment.tag_name) {
    const [rows] = await conn.execute(
      'SELECT id FROM pp_equipment WHERE dept = ? AND tag_name = ? LIMIT 1',
      [equipment.dept, equipment.tag_name],
    );
    if (rows[0]) return rows[0].id;
  }

  const [rows] = await conn.execute(
    'SELECT id FROM pp_equipment WHERE dept = ? AND name = ? LIMIT 1',
    [equipment.dept, equipment.name],
  );
  return rows[0]?.id ?? null;
}

async function deleteEquipmentTree(conn, equipId) {
  await conn.execute('DELETE FROM pp_history WHERE equip_id = ?', [equipId]);
  await conn.execute('DELETE FROM pp_oem_schedule WHERE equip_id = ?', [equipId]);
  await conn.execute('DELETE FROM pp_specs WHERE equip_id = ?', [equipId]);
  await conn.execute('DELETE FROM pp_equipment WHERE id = ?', [equipId]);
}

async function insertEquipment(conn, equipment) {
  const enriched = enrichEquipment(equipment);
  const [result] = await conn.execute(
    `INSERT INTO pp_equipment (dept, category, subcategory, equip_no, tag_name, name, location, commissioned)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      enriched.dept,
      enriched.category,
      enriched.subcategory,
      enriched.equip_no,
      enriched.tag_name,
      enriched.name,
      enriched.location,
      enriched.commissioned,
    ],
  );
  return result.insertId;
}

async function insertSpecs(conn, equipId, specs) {
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    if (!s.lbl) continue;
    await conn.execute(
      `INSERT INTO pp_specs (equip_id, section, sub_section, lbl, val, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [equipId, s.section, s.sub_section, s.lbl, s.val ?? '', i],
    );
  }
}

async function insertSchedule(conn, equipId, scheduleRows) {
  for (const row of scheduleRows) {
    await conn.execute(
      `INSERT INTO pp_oem_schedule
         (equip_id, no, comp, act, iv_W, iv_M, iv_Q, iv_H, iv_Y, iv_T, iv_3Y)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipId, row.no, row.comp ?? '', row.act ?? '',
        row.iv_W, row.iv_M, row.iv_Q, row.iv_H, row.iv_Y, row.iv_T, row.iv_3Y,
      ],
    );
  }
}

async function insertHistory(conn, equipId, historyRows) {
  for (const row of historyRows) {
    await conn.execute(
      `INSERT INTO pp_history
         (equip_id, season, year, date_start, date_finish, obs, act, cost, svc, provider, resp, rem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipId,
        row.season, row.year, row.date_start, row.date_finish,
        row.obs, row.act, row.cost, row.svc, row.provider, row.resp, row.rem,
      ],
    );
  }
}

async function importSheet(conn, parsed, opts) {
  const { equipment, specs, scheduleRows, historyRows, sheetName } = parsed;

  if (opts.dryRun) {
    console.log(
      `  [dry-run] ${sheetName}: specs=${specs.length}, schedule=${scheduleRows.length}, history=${historyRows.length}`,
    );
    return { status: 'dry-run', sheetName };
  }

  const connTx = await conn.getConnection();
  try {
    await connTx.beginTransaction();

    const existingId = await findExistingId(connTx, equipment);
    if (existingId) {
      if (!opts.replace) {
        await connTx.rollback();
        return { status: 'skipped', sheetName, reason: 'exists' };
      }
      await deleteEquipmentTree(connTx, existingId);
    }

    const equipId = await insertEquipment(connTx, equipment);
    await insertSpecs(connTx, equipId, specs);
    await insertSchedule(connTx, equipId, scheduleRows);
    await insertHistory(connTx, equipId, historyRows);

    await connTx.commit();
    return {
      status: 'imported',
      sheetName,
      equipId,
      specs: specs.length,
      schedule: scheduleRows.length,
      history: historyRows.length,
    };
  } catch (err) {
    await connTx.rollback();
    throw err;
  } finally {
    connTx.release();
  }
}

async function importFile(filePath, dept, opts) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[skip] File not found: ${filePath}`);
    return { imported: 0, skipped: 0, errors: 0 };
  }

  console.log(`\nProcessing: ${filePath} (dept=${dept})`);
  const sheets = parseWorkbookFile(filePath, dept);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const parsed of sheets) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await importSheet(pool, parsed, opts);
      if (result.status === 'imported' || result.status === 'dry-run') {
        if (result.status === 'imported') {
          console.log(
            `  [ok] ${result.sheetName} (id=${result.equipId}) specs=${result.specs} schedule=${result.schedule} history=${result.history}`,
          );
          imported += 1;
        }
      } else if (result.status === 'skipped') {
        console.log(`  [skip] ${result.sheetName} — already exists (use --replace to overwrite)`);
        skipped += 1;
      }
    } catch (err) {
      console.error(`  [error] ${parsed.sheetName}: ${err.message}`);
      errors += 1;
    }
  }

  return { imported, skipped, errors, total: sheets.length };
}

async function main() {
  const opts = parseArgs(process.argv);
  const totals = { imported: 0, skipped: 0, errors: 0, files: 0 };

  try {
    if (opts.file) {
      if (!opts.dept) {
        console.error('--dept is required when using --file');
        process.exitCode = 1;
        return;
      }
      const abs = path.isAbsolute(opts.file) ? opts.file : path.resolve(process.cwd(), opts.file);
      const r = await importFile(abs, opts.dept, opts);
      totals.imported += r.imported;
      totals.skipped += r.skipped;
      totals.errors += r.errors;
      totals.files = 1;
    } else {
      for (const entry of DEFAULT_FILES) {
        const filePath = path.join(DATA_DIR, entry.file);
        // eslint-disable-next-line no-await-in-loop
        const r = await importFile(filePath, entry.dept, opts);
        totals.imported += r.imported;
        totals.skipped += r.skipped;
        totals.errors += r.errors;
        totals.files += 1;
      }
    }

    console.log('\n--- Summary ---');
    console.log(`Files processed: ${totals.files}`);
    console.log(`Sheets imported: ${totals.imported}`);
    console.log(`Sheets skipped:  ${totals.skipped}`);
    console.log(`Errors:          ${totals.errors}`);
    if (opts.dryRun) console.log('(dry-run — no data written)');
  } catch (err) {
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
