/**
 * Import Sugar House Equipment History (instrument) from the normalized
 * life-history workbook into shn_* tables and link hierarchy leaves.
 *
 * Rules:
 *   - Match hierarchy leaves by Inst. History card tag (equip_no)
 *   - Do NOT overwrite equipment name — use hierarchy lookup_name
 *   - All form data is instrument discipline
 *   - Specs / schedule / history: section=instrument, sub_section=Others
 *
 * Usage (from backend/):
 *   npm run db:import-shn-life-history -- --dry-run
 *   npm run db:import-shn-life-history -- --replace
 *   npm run db:import-shn-life-history -- --file "../../sugar-house-equipment-life-history-filtered.xlsx"
 */

require('../config/env');

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { pool } = require('../config/mysql');

const DEFAULT_FILE = path.join(
  __dirname,
  '../../../sugar-house-equipment-life-history-filtered.xlsx',
);

const DEPT = 'sugar_house';
const SECTION = 'instrument';
const SUB_SECTION = 'Others';
const META_SUBSECTIONS_LBL = '__subsections__';

function trim(v) {
  return String(v ?? '').trim();
}

function emptyToNull(v) {
  const s = trim(v);
  return s === '' ? null : s;
}

function clip(v, maxLen) {
  const s = emptyToNull(v);
  if (s == null) return null;
  return s.length <= maxLen ? s : s.slice(0, maxLen);
}

function normTag(t) {
  return trim(t).toUpperCase().replace(/\s+/g, ' ');
}

function compactTag(t) {
  return normTag(t).replace(/\s+/g, '');
}

function tagsMatch(a, b) {
  const na = normTag(a);
  const nb = normTag(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (compactTag(a) === compactTag(b)) return true;
  return false;
}

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    replace: false,
    file: DEFAULT_FILE,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--replace') opts.replace = true;
    else if (a === '--file') opts.file = path.resolve(argv[++i]);
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/import-shn-life-history-xlsx.js [options]

Options:
  --dry-run          Parse and match only; no DB writes
  --replace          Replace existing shn_equipment (by tag/equip_no) then re-import
  --file <path>      Source workbook (default: sugar-house-equipment-life-history-filtered.xlsx)
`);
      process.exit(0);
    }
  }
  return opts;
}

function sheetRows(wb, name) {
  if (!wb.Sheets[name]) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
}

function groupBySheetId(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = trim(row['sheet id'] || row.sheet_id);
    if (!id) continue;
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return map;
}

function normalizeIvMark(value) {
  const s = trim(value);
  if (!s) return null;
  const u = s.toUpperCase();
  if (['X', '-', 'NO', 'N', 'NA', 'N/A'].includes(u)) return null;
  if (['YES', 'Y', '√', '✓', '✔', '1', 'TRUE', 'OK'].includes(u) || s === '√' || s === '✓') {
    return 'X';
  }
  return s.length <= 1 ? s : 'X';
}

function toMysqlDate(value) {
  const s = trim(value);
  if (!s) return null;
  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD.MM.YYYY / DD-MM-YYYY / DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    return `${m[3]}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function buildSubsectionsMeta() {
  return JSON.stringify({
    mechanical: [],
    civil: [],
    instrument: [SUB_SECTION],
    electrical: [],
  });
}

function loadWorkbook(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Workbook not found: ${filePath}`);
  }
  const wb = XLSX.readFile(filePath);
  const lifeRows = sheetRows(wb, 'EQUIPMENT LIFE HISTORY CARD');
  const specById = groupBySheetId(sheetRows(wb, 'EQUIPMENT SPECIFICATION'));
  const scheduleById = groupBySheetId(sheetRows(wb, 'MAINTENANCE SCHEDULE'));
  const historyById = groupBySheetId(sheetRows(wb, 'EQUIPMENT MAINTENANCE HISTORY'));

  const cards = [];
  for (const row of lifeRows) {
    const sheetId = trim(row['sheet id']);
    const tag = trim(row['EQUIPMENT TAG NAME/APPLICATION']);
    if (!sheetId || !tag) continue;

    const specs = (specById.get(sheetId) || [])
      .map((s) => ({
        section: SECTION,
        sub_section: SUB_SECTION,
        lbl: emptyToNull(s['Parameter label']),
        val: String(s['Parameter value'] ?? ''),
      }))
      .filter((s) => s.lbl);

    specs.push({
      section: null,
      sub_section: null,
      lbl: META_SUBSECTIONS_LBL,
      val: buildSubsectionsMeta(),
    });

    const schedule = (scheduleById.get(sheetId) || [])
      .map((s, index) => {
        const act = trim(s['Maintenance / Inspection Activities']);
        const comp = trim(s['Name of Equipment']);
        const no = Number(s['Sr.No.']) || index + 1;
        const iv_W = normalizeIvMark(s.Weekly) || normalizeIvMark(s.Daily);
        const iv_M = normalizeIvMark(s.Monthly);
        const iv_Q = normalizeIvMark(s.Quarterly);
        const iv_H = normalizeIvMark(s['Half - Yearly']);
        const iv_Y = normalizeIvMark(s.Yearly);
        const iv_T = normalizeIvMark(s['2 - Years']);
        const iv_3Y = normalizeIvMark(s['3 - Years']) || normalizeIvMark(s['4 - Years']);
        if (!act && !comp && !iv_W && !iv_M && !iv_Q && !iv_H && !iv_Y && !iv_T && !iv_3Y) {
          return null;
        }
        return {
          section: SECTION,
          sub_section: SUB_SECTION,
          equipment_refs: [{ section: SECTION, sub_section: SUB_SECTION }],
          no,
          comp,
          act,
          iv_W,
          iv_M,
          iv_Q,
          iv_H,
          iv_Y,
          iv_T,
          iv_3Y,
        };
      })
      .filter(Boolean);

    const history = (historyById.get(sheetId) || [])
      .map((h) => {
        const seasonRaw = trim(h['Season / OFF Season']);
        const year = emptyToNull(h.Year);
        const date_start = toMysqlDate(h['Date of Start']);
        const date_finish = toMysqlDate(h['Date of Finish']);
        const obs = emptyToNull(h['Outage/ Observation']);
        const act = emptyToNull(h['Action Taken']);
        const resp = emptyToNull(h['Responsibility ( Engineer/ Supervision)']);
        const rem = emptyToNull(h.Remarks);
        // Skip leaked next-card header rows from extraction bleed.
        const seasonNorm = seasonRaw.toUpperCase();
        if (
          seasonNorm.includes('NAME OF EQUIPMENT')
          || seasonNorm.includes('DATE OF COMMISSIONING')
          || seasonNorm.includes('EQUIPMENT NO')
          || seasonNorm.includes('LOCATION')
          || seasonNorm.includes('EQUIPMENT LIFE HISTORY')
          || seasonNorm.includes('EQUIPMENT SPECIFICATION')
        ) {
          return null;
        }
        if (!seasonRaw && !year && !date_start && !date_finish && !obs && !act) return null;
        return {
          section: SECTION,
          sub_section: SUB_SECTION,
          equipment_refs: [{ section: SECTION, sub_section: SUB_SECTION }],
          season: clip(seasonRaw, 20),
          year: clip(year, 50),
          date_start,
          date_finish,
          obs,
          act,
          cost: clip(h['Repair Cost (Rs.)'], 50),
          svc: clip(h['Services (Internal / External)'], 20),
          provider: null,
          resp,
          rem,
        };
      })
      .filter(Boolean);

    cards.push({
      sheetId,
      sheetName: trim(row['sheet name']),
      tag,
      excelName: trim(row['NAME OF EQUIPMENT']),
      excelLocation: trim(row.LOCATION),
      commissioned: emptyToNull(row['DATE OF COMMISSIONING']),
      specs,
      schedule,
      history,
    });
  }

  return cards;
}

async function loadHierarchyLeaves(conn) {
  const [rows] = await conn.execute(
    `SELECT id, name, equip_no, lookup_name, hist_location, shn_equip_id
     FROM shn_hierarchy_node
     WHERE node_type = 'equipment' AND is_active = 1`,
  );
  return rows;
}

function findHierarchyLeaf(leaves, tag) {
  const exact = leaves.filter((leaf) => normTag(leaf.equip_no) === normTag(tag));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return exact[0];

  const compact = leaves.filter((leaf) => tagsMatch(leaf.equip_no, tag));
  if (compact.length >= 1) return compact[0];
  return null;
}

async function findExistingEquipId(conn, tag) {
  const [byEquip] = await conn.execute(
    'SELECT id, name FROM shn_equipment WHERE equip_no = ? OR tag_name = ? LIMIT 1',
    [tag, tag],
  );
  if (byEquip[0]) return byEquip[0];

  // Compact compare fallback (few rows)
  const [all] = await conn.execute(
    'SELECT id, name, equip_no, tag_name FROM shn_equipment WHERE equip_no IS NOT NULL OR tag_name IS NOT NULL',
  );
  return all.find((row) => tagsMatch(row.equip_no, tag) || tagsMatch(row.tag_name, tag)) || null;
}

async function deleteEquipmentTree(conn, equipId) {
  await conn.execute('DELETE FROM shn_history WHERE equip_id = ?', [equipId]);
  await conn.execute('DELETE FROM shn_oem_schedule WHERE equip_id = ?', [equipId]);
  await conn.execute('DELETE FROM shn_specs WHERE equip_id = ?', [equipId]);
  await conn.execute('DELETE FROM shn_equipment WHERE id = ?', [equipId]);
  await conn.execute(
    'UPDATE shn_hierarchy_node SET shn_equip_id = NULL WHERE shn_equip_id = ?',
    [equipId],
  );
}

async function insertEquipment(conn, payload) {
  const [result] = await conn.execute(
    `INSERT INTO shn_equipment
       (dept, category, subcategory, equip_no, tag_name, name, location, commissioned, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      DEPT,
      payload.category,
      payload.subcategory,
      payload.equip_no,
      payload.tag_name,
      payload.name,
      payload.location,
      payload.commissioned,
      payload.sort_order,
    ],
  );
  return result.insertId;
}

async function insertSpecs(conn, equipId, specs) {
  for (let i = 0; i < specs.length; i += 1) {
    const s = specs[i];
    if (!s.lbl) continue;
    await conn.execute(
      `INSERT INTO shn_specs (equip_id, section, sub_section, lbl, val, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [equipId, s.section, s.sub_section, s.lbl, s.val ?? '', i],
    );
  }
}

async function insertSchedule(conn, equipId, rows) {
  for (const row of rows) {
    await conn.execute(
      `INSERT INTO shn_oem_schedule
         (equip_id, section, sub_section, equipment_refs, no, comp, act, iv_W, iv_M, iv_Q, iv_H, iv_Y, iv_T, iv_3Y)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipId,
        row.section,
        row.sub_section,
        JSON.stringify(row.equipment_refs),
        row.no,
        row.comp,
        row.act,
        row.iv_W,
        row.iv_M,
        row.iv_Q,
        row.iv_H,
        row.iv_Y,
        row.iv_T,
        row.iv_3Y,
      ],
    );
  }
}

async function insertHistory(conn, equipId, rows) {
  for (const row of rows) {
    await conn.execute(
      `INSERT INTO shn_history
         (equip_id, section, sub_section, equipment_refs, season, year, date_start, date_finish,
          obs, act, cost, svc, provider, resp, rem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipId,
        row.section,
        row.sub_section,
        JSON.stringify(row.equipment_refs),
        row.season,
        row.year,
        row.date_start,
        row.date_finish,
        row.obs,
        row.act,
        row.cost,
        row.svc,
        row.provider,
        row.resp,
        row.rem,
      ],
    );
  }
}

async function linkHierarchy(conn, leafId, equipId) {
  await conn.execute(
    'UPDATE shn_hierarchy_node SET shn_equip_id = ? WHERE id = ?',
    [equipId, leafId],
  );
}

async function main() {
  const opts = parseArgs(process.argv);
  const cards = loadWorkbook(opts.file);
  console.log(`Source: ${opts.file}`);
  console.log(`Cards: ${cards.length}`);
  console.log(`Discipline: ${SECTION} / ${SUB_SECTION}`);

  const conn = await pool.getConnection();
  try {
    const leaves = await loadHierarchyLeaves(conn);
    console.log(`Hierarchy leaves: ${leaves.length}`);

    const stats = {
      imported: 0,
      replaced: 0,
      skipped: 0,
      orphan: 0,
      failed: 0,
      specs: 0,
      schedule: 0,
      history: 0,
    };
    const unmatched = [];

    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      const leaf = findHierarchyLeaf(leaves, card.tag);

      // Preserve hierarchy equipment name; never overwrite with Excel life-card name.
      const equipmentName = leaf
        ? trim(leaf.lookup_name || leaf.name)
        : card.excelName || card.tag;

      const location = leaf
        ? (emptyToNull(leaf.hist_location) || emptyToNull(card.excelLocation))
        : emptyToNull(card.excelLocation);

      if (!leaf) {
        unmatched.push(card.tag);
        stats.orphan += 1;
      }

      if (opts.dryRun) {
        stats.imported += 1;
        stats.specs += Math.max(0, card.specs.length - 1);
        stats.schedule += card.schedule.length;
        stats.history += card.history.length;
        if (i < 3 || !leaf) {
          console.log(
            `[dry-run] ${card.tag} -> name="${equipmentName}" leaf=${leaf ? leaf.id : 'NONE'} `
            + `specs=${card.specs.length - 1} sched=${card.schedule.length} hist=${card.history.length}`,
          );
        }
        continue;
      }

      await conn.beginTransaction();
      try {
        const existing = await findExistingEquipId(conn, card.tag);
        if (existing) {
          if (!opts.replace) {
            await conn.rollback();
            stats.skipped += 1;
            console.log(`[skip] ${card.tag} already exists as shn_equipment#${existing.id} (${existing.name})`);
            continue;
          }
          await deleteEquipmentTree(conn, existing.id);
          stats.replaced += 1;
        }

        const equipId = await insertEquipment(conn, {
          category: null,
          subcategory: null,
          equip_no: card.tag,
          tag_name: card.tag,
          name: equipmentName,
          location,
          commissioned: card.commissioned,
          sort_order: i,
        });

        await insertSpecs(conn, equipId, card.specs);
        await insertSchedule(conn, equipId, card.schedule);
        await insertHistory(conn, equipId, card.history);

        if (leaf) {
          await linkHierarchy(conn, leaf.id, equipId);
          leaf.shn_equip_id = equipId;
        }

        await conn.commit();
        stats.imported += 1;
        stats.specs += Math.max(0, card.specs.length - 1);
        stats.schedule += card.schedule.length;
        stats.history += card.history.length;

        if ((i + 1) % 50 === 0 || i === cards.length - 1) {
          console.log(`Progress ${i + 1}/${cards.length}…`);
        }
      } catch (err) {
        await conn.rollback();
        stats.failed += 1;
        console.error(`[fail] ${card.tag}: ${err.message}`);
      }
    }

    console.log('\nDone.');
    console.log(stats);
    if (unmatched.length) {
      console.log(`Unmatched tags (imported without hierarchy link): ${unmatched.length}`);
      unmatched.slice(0, 20).forEach((t) => console.log(`  - ${t}`));
    }
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
