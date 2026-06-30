/**
 * Import maintenance history only for an existing ppn_equipment record.
 * Does not replace specs/schedule unless --replace-all is passed via full feed import.
 *
 * Usage (from backend/):
 *   node scripts/data_feed_power_history/import-equipment-maintenance-history.js \
 *     --file scripts/data_feed_power_history/feed-data/air-pre-heater-mechanical-history.json
 *
 *   node scripts/data_feed_power_history/import-equipment-maintenance-history.js \
 *     --file feed.json --replace-history
 *
 * Options:
 *   --file <path>          Feed JSON ({ equipment: [...] } or array)
 *   --replace-history      Delete existing history for matched equip before insert
 *   --dry-run              Parse only, no DB writes
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { pool } = require('../../config/mysql');
const {
  flattenFeedPayload,
  findExistingPpnIdFromRecord,
  normalizeHistoryRow,
  resolveDbName,
  buildFeedMeta,
  scopeHistoryFromSpecs,
  inferPrimarySectionFromSpecs,
  ensureHistoryEquipmentStub,
} = require('./ppnFeedLib');

function parseArgs(argv) {
  const opts = {
    file: null,
    replaceHistory: false,
    dryRun: false,
    createEquipment: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file') opts.file = argv[++i];
    else if (a === '--replace-history') opts.replaceHistory = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--create-equipment') opts.createEquipment = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/data_feed_power_history/import-equipment-maintenance-history.js --file <json> [options]

Options:
  --replace-history     Clear ppn_history for equipment before insert
  --create-equipment    Create ppn_equipment stub if missing (auto for history_only feeds)
  --dry-run             Count rows only
`);
      process.exit(0);
    }
  }
  if (!opts.file) {
    throw new Error('--file is required');
  }
  return opts;
}

async function readEquipmentSpecs(conn, equipId) {
  const [rows] = await conn.execute(
    `SELECT section, sub_section, lbl, val FROM ppn_specs WHERE equip_id = ? ORDER BY sort_order, id`,
    [equipId],
  );
  return rows;
}

async function insertHistoryRows(conn, equipId, rows) {
  for (const row of rows) {
    const refs = row.equipment_refs?.length
      ? row.equipment_refs
      : (row.section && row.sub_section
        ? [{ section: row.section, sub_section: row.sub_section }]
        : []);
    const equipmentRefsJson = refs.length ? JSON.stringify(refs) : null;
    const primary = refs[0] || {};

    await conn.execute(
      `INSERT INTO ppn_history
         (equip_id, section, sub_section, equipment_refs, season, year, date_start, date_finish,
          obs, act, cost, svc, maintenance_type, provider, resp, rem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipId,
        primary.section || row.section || null,
        primary.sub_section || row.sub_section || null,
        equipmentRefsJson,
        row.season, row.year, row.date_start, row.date_finish,
        row.obs, row.act, row.cost, row.svc, row.maintenance_type, row.provider, row.resp, row.rem,
      ],
    );
  }
}

async function importRecord(conn, record, opts) {
  const dbName = resolveDbName(record);
  const history = (record.history || [])
    .map(normalizeHistoryRow)
    .filter((h) => h.obs || h.act || h.year || h.date_start);

  if (!dbName) {
    return { status: 'skipped', reason: 'missing hierarchy_name / name' };
  }
  if (!history.length) {
    return { status: 'skipped', reason: 'no history rows', name: dbName };
  }

  const allowCreate = opts.createEquipment || record.history_only === true;
  let equipId = await findExistingPpnIdFromRecord(conn, record);
  let createdEquipment = false;

  const firstScoped = history.find((h) => h.section && h.sub_section) || history[0] || {};
  const scopeHint = {
    section: firstScoped.section || record.history_section || record.section || 'mechanical',
    subSection: firstScoped.sub_section || record.sub_section || record.subSection || 'General',
  };

  if (!equipId && allowCreate) {
    if (opts.dryRun) {
      return {
        status: 'dry-run',
        name: dbName,
        equipId: '(new)',
        history: history.length,
        subSection: scopeHint.subSection,
        section: scopeHint.section,
        wouldCreateEquipment: true,
        ...buildFeedMeta(record),
      };
    }
    equipId = await ensureHistoryEquipmentStub(conn, record, scopeHint);
    createdEquipment = true;
  }

  if (!equipId) {
    return {
      status: 'skipped',
      reason: 'equipment not found in ppn_equipment — open the card in the app or use --create-equipment',
      name: dbName,
      ...buildFeedMeta(record),
    };
  }

  const specRows = await readEquipmentSpecs(conn, equipId);
  const defaultSection = inferPrimarySectionFromSpecs(specRows);
  const scopedHistory = scopeHistoryFromSpecs(history, specRows, {
    defaultSection: record.history_section ?? record.historySection ?? record.section ?? defaultSection,
    defaultSubSection: record.sub_section ?? record.subSection,
  });

  if (opts.dryRun) {
    return {
      status: 'dry-run',
      name: dbName,
      equipId,
      history: scopedHistory.length,
      subSection: scopedHistory[0]?.sub_section,
      section: scopedHistory[0]?.section,
      ...buildFeedMeta(record, equipId),
    };
  }

  const connTx = await conn.getConnection();
  try {
    await connTx.beginTransaction();
    if (opts.replaceHistory) {
      await connTx.execute('DELETE FROM ppn_history WHERE equip_id = ?', [equipId]);
    }
    await insertHistoryRows(connTx, equipId, scopedHistory);
    await connTx.commit();
    return {
      status: 'imported',
      name: dbName,
      equipId,
      history: scopedHistory.length,
      subSection: scopedHistory[0]?.sub_section,
      section: scopedHistory[0]?.section,
      createdEquipment,
      ...buildFeedMeta(record, equipId),
    };
  } catch (err) {
    await connTx.rollback();
    throw err;
  } finally {
    connTx.release();
  }
}

async function main() {
  const opts = parseArgs(process.argv);
  const filePath = path.isAbsolute(opts.file)
    ? opts.file
    : path.resolve(process.cwd(), opts.file);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Feed file not found: ${filePath}`);
  }

  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const records = flattenFeedPayload(payload);

  console.log(`Maintenance history import — ${opts.dryRun ? 'DRY RUN' : 'LIVE'}${opts.replaceHistory ? ' (replace)' : ''}`);
  console.log(`File: ${path.basename(filePath)} (${records.length} record(s))\n`);

  let imported = 0;
  let skipped = 0;
  let totalRows = 0;

  for (const record of records) {
    try {
      const result = await importRecord(pool, record, opts);
      if (result.status === 'imported' || result.status === 'dry-run') {
        imported += 1;
        totalRows += result.history;
        console.log(`  + ${result.name} (id=${result.equipId}) history=${result.history} → ${result.section || 'mechanical'} / ${result.subSection}${result.createdEquipment ? ' [equipment created]' : ''}${result.wouldCreateEquipment ? ' [would create equipment]' : ''}`);
        if (result.uiPath) console.log(`    Open: ${result.uiPath}`);
      } else {
        skipped += 1;
        console.log(`  - ${result.name || 'record'}: ${result.reason}`);
      }
    } catch (err) {
      skipped += 1;
      console.error(`  ! ${record.name || resolveDbName(record)}: ${err.message}`);
    }
  }

  console.log(`\nSummary: imported=${imported} skipped=${skipped} history_rows=${totalRows}`);
  if (skipped > 0 && !opts.dryRun) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
