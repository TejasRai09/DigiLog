/**
 * Import Sugar House Equipment History (mechanical) from the normalized
 * life-history workbook into shn_* tables and link hierarchy leaves.
 *
 * Rules:
 *   - Match hierarchy leaves by tag (equip_no)
 *   - If several leaves share the same tag, also match Sub Equipment name
 *     (do not copy one card onto every sibling)
 *   - Do NOT overwrite equipment name — use hierarchy lookup_name
 *   - All form data is mechanical discipline
 *   - Specs / schedule / history: section=mechanical;
 *     sub_section = Excel "NAME OF EQUIPMENT" (fallback: Others)
 *   - --replace only affects cards whose tags appear in this workbook
 *     and clears sibling leaves of those tags that no longer match a card
 *
 * Usage (from backend/):
 *   npm run db:import-shn-mechanical-life-history -- --dry-run
 *   npm run db:import-shn-mechanical-life-history -- --replace
 *   npm run db:import-shn-mechanical-life-history -- --replace --file "backlog-data/boiling-house-mechanical-equipment-history.xlsx"
 *   npm run db:import-shn-mechanical-life-history -- --replace --file "backlog-data/mill data/mill-house-mechanical-equipment-history-11082026.xlsx"
 */

require('../config/env');

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { pool } = require('../config/mysql');

const BACKLOG_DIR = path.join(__dirname, '../backlog-data');
const DEFAULT_FILE = path.join(
  BACKLOG_DIR,
  'boiling-house-mechanical-equipment-history.xlsx',
);

function resolveWorkbookPath(input) {
  if (!input) return DEFAULT_FILE;
  const raw = String(input).trim();
  if (!raw) return DEFAULT_FILE;
  if (path.isAbsolute(raw) && fs.existsSync(raw)) return raw;

  const candidates = [
    path.resolve(process.cwd(), raw),
    path.resolve(__dirname, '..', raw),
    path.join(BACKLOG_DIR, path.basename(raw)),
    path.join(BACKLOG_DIR, raw),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.resolve(process.cwd(), raw);
}

const DEPT = 'sugar_house';
const SECTION = 'mechanical';
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
  return trim(t).toLowerCase().replace(/\s+/g, '');
}

function tagsMatch(a, b) {
  const na = normTag(a);
  const nb = normTag(b);
  return Boolean(na && nb && na === nb);
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
    else if (a === '--file') opts.file = resolveWorkbookPath(argv[++i]);
    else if (a === '--help' || a === '-h') {
      console.log(`Usage: node scripts/import-shn-mechanical-life-history.js [options]

Options:
  --dry-run          Parse and match only; no DB writes
  --replace          Replace matching cards; clear unmatched siblings of those tags
  --file <path>      Source workbook (default: boiling-house-mechanical-equipment-history.xlsx)

Examples (from backend/):
  npm run db:import-shn-mechanical-life-history -- --dry-run
  npm run db:import-shn-mechanical-life-history -- --replace
  npm run db:import-shn-mechanical-life-history -- --replace --file "backlog-data/boiling-house-mechanical-equipment-history.xlsx"
  npm run db:import-shn-mechanical-life-history -- --replace --file "backlog-data/mill data/mill-house-mechanical-equipment-history-11082026.xlsx"

Examples (from backend/):
  npm run db:import-shn-mechanical-life-history -- --dry-run
  npm run db:import-shn-mechanical-life-history -- --replace
  npm run db:import-shn-mechanical-life-history -- --replace --file "backlog-data/mill data/mill-house-mechanical-equipment-history-11082026.xlsx"
`);
      process.exit(0);
    }
  }
  opts.file = resolveWorkbookPath(opts.file);
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

const SCHEDULE_IV_KEYS = ['iv_W', 'iv_M', 'iv_Q', 'iv_H', 'iv_Y', 'iv_T', 'iv_3Y'];

function mergeScheduleRows(rows) {
  const merged = [];
  const indexByKey = new Map();

  for (const row of rows) {
    const compKey = trim(row.comp).toLowerCase();
    const key = `${row.no}::${compKey}`;

    if (indexByKey.has(key)) {
      const existing = merged[indexByKey.get(key)];
      const act = trim(row.act);
      if (act) {
        existing.act = existing.act ? `${existing.act} || ${act}` : act;
      }
      for (const ivKey of SCHEDULE_IV_KEYS) {
        if (row[ivKey] && !existing[ivKey]) existing[ivKey] = row[ivKey];
      }
      continue;
    }

    indexByKey.set(key, merged.length);
    merged.push({ ...row });
  }

  return merged;
}

function parseScheduleSheetRows(rawRows, subSection = SUB_SECTION) {
  const parsed = rawRows
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
        sub_section: subSection,
        equipment_refs: [{ section: SECTION, sub_section: subSection }],
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

  return mergeScheduleRows(parsed);
}

function toMysqlDate(value) {
  const s = trim(value);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
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

function buildSubsectionsMeta(equipmentNames = []) {
  const names = [...new Set(
    equipmentNames
      .map((n) => trim(n))
      .filter(Boolean),
  )];
  return JSON.stringify({
    mechanical: names.length ? names : [SUB_SECTION],
    civil: [],
    instrument: [],
    electrical: [],
  });
}

function resolveSpecSubSection(specRow, lifeCardName) {
  return (
    emptyToNull(specRow.sub_section)
    || emptyToNull(specRow['sub_section'])
    || emptyToNull(specRow['NAME OF EQUIPMENT'])
    || emptyToNull(lifeCardName)
    || SUB_SECTION
  );
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
    const tag = trim(row['EQUIPMENT TAG NO']);
    if (!sheetId || !tag) continue;

    const lifeCardName = trim(row['NAME OF EQUIPMENT']);
    const rawSpecs = specById.get(sheetId) || [];
    const specs = rawSpecs
      .map((s) => ({
        section: SECTION,
        sub_section: resolveSpecSubSection(s, lifeCardName),
        lbl: emptyToNull(s['Parameter label']),
        val: String(s['Parameter value'] ?? ''),
      }))
      .filter((s) => s.lbl);

    const equipmentNames = specs.map((s) => s.sub_section);
    if (!equipmentNames.length && lifeCardName) equipmentNames.push(lifeCardName);

    const primarySubSection = equipmentNames[0] || lifeCardName || SUB_SECTION;

    specs.push({
      section: null,
      sub_section: null,
      lbl: META_SUBSECTIONS_LBL,
      val: buildSubsectionsMeta(equipmentNames),
    });

    const schedule = parseScheduleSheetRows(scheduleById.get(sheetId) || [], primarySubSection);

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
          sub_section: primarySubSection,
          equipment_refs: [{ section: SECTION, sub_section: primarySubSection }],
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
      excelName: lifeCardName,
      excelLocation: trim(row.LOCATION),
      subEquipment: trim(row['Sub Equipment']),
      histLocation: trim(row['History card Location']),
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

function namesMatch(a, b) {
  const na = trim(a).toLowerCase().replace(/\s+/g, ' ');
  const nb = trim(b).toLowerCase().replace(/\s+/g, ' ');
  return Boolean(na && nb && na === nb);
}

function equipmentNameKey(value) {
  return trim(value)
    .toLowerCase()
    .replace(/[.\-_]/g, ' ')
    .replace(/\bno\s+/g, '')
    .replace(/cardian/g, 'carding')
    .replace(/\s+/g, ' ')
    .trim();
}

function equipmentNameKeyVariants(value) {
  const key = equipmentNameKey(value);
  if (!key) return [];
  const variants = [key];
  if (key.startsWith('cane ')) variants.push(key.slice(5));
  return variants;
}

function equipmentNamesMatch(a, b) {
  const left = new Set(equipmentNameKeyVariants(a));
  return equipmentNameKeyVariants(b).some((key) => left.has(key));
}

function leafSubEquipmentName(leaf) {
  return trim(leaf.lookup_name || leaf.name);
}

/**
 * Unique tag → that one leaf.
 * Shared tag → also require Sub Equipment name. Never fan out to every sibling.
 */
function findHierarchyLeaves(leaves, card) {
  const byTag = leaves.filter((leaf) => tagsMatch(leaf.equip_no, card.tag));
  if (!byTag.length) return [];
  if (byTag.length === 1) return byTag;

  const name = trim(card.subEquipment || card.excelName);
  if (!name) return [];

  const byName = byTag.filter((leaf) => equipmentNamesMatch(leafSubEquipmentName(leaf), name));
  if (byName.length === 1) return byName;

  const loc = trim(card.histLocation || card.excelLocation);
  if (byName.length > 1 && loc) {
    const byLoc = byName.filter((leaf) => namesMatch(trim(leaf.hist_location), loc));
    if (byLoc.length) return byLoc;
  }
  return byName;
}

async function findExistingEquipId(conn, tag, name, location) {
  if (tag && name && location) {
    const [rows] = await conn.execute(
      `SELECT id, name FROM shn_equipment
       WHERE (equip_no = ? OR tag_name = ?) AND name = ? AND location = ?
       LIMIT 1`,
      [tag, tag, name, location],
    );
    if (rows[0]) return rows[0];
  }
  if (tag && name) {
    const [rows] = await conn.execute(
      `SELECT id, name FROM shn_equipment
       WHERE (equip_no = ? OR tag_name = ?) AND name = ?
       LIMIT 1`,
      [tag, tag, name],
    );
    if (rows[0]) return rows[0];
  }
  return null;
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
  console.log(`Discipline: ${SECTION} (department: ${DEPT})`);

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
      clearedSiblings: 0,
    };
    const unmatched = [];
    const filledLeafIds = new Set();
    const tagsInWorkbook = new Set(cards.map((c) => normTag(c.tag)).filter(Boolean));

    for (let i = 0; i < cards.length; i += 1) {
      const card = cards[i];
      const matchedLeaves = findHierarchyLeaves(leaves, card);
      let targets = matchedLeaves;
      if (!opts.replace) {
        targets = matchedLeaves.filter((leaf) => !leaf.shn_equip_id);
      }

      if (!matchedLeaves.length) {
        unmatched.push(`${card.tag} / ${trim(card.subEquipment || card.excelName)}`);
        stats.orphan += 1;
        if (opts.dryRun && stats.orphan <= 8) {
          console.log(`[dry-run] ${card.tag} / ${card.subEquipment || card.excelName} -> no hierarchy leaf`);
        }
        continue;
      }
      if (!targets.length) {
        stats.skipped += 1;
        continue;
      }

      for (const leaf of targets) {
        const equipmentName = trim(leaf.lookup_name || leaf.name) || card.excelName || card.tag;
        const location = emptyToNull(leaf.hist_location) || emptyToNull(card.histLocation)
          || emptyToNull(card.excelLocation);

        if (opts.dryRun) {
          stats.imported += 1;
          stats.specs += Math.max(0, card.specs.length - 1);
          stats.schedule += card.schedule.length;
          stats.history += card.history.length;
          if (stats.imported <= 5) {
            console.log(
              `[dry-run] ${card.tag} -> name="${equipmentName}" loc="${location || ''}" leaf=${leaf.id} `
              + `specs=${card.specs.length - 1} sched=${card.schedule.length} hist=${card.history.length}`,
            );
          }
          leaf.shn_equip_id = -1;
          filledLeafIds.add(leaf.id);
          continue;
        }

        await conn.beginTransaction();
        try {
          const existing = await findExistingEquipId(conn, card.tag, equipmentName, location);
          if (existing) {
            if (!opts.replace) {
              await conn.rollback();
              stats.skipped += 1;
              leaf.shn_equip_id = existing.id;
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
          await linkHierarchy(conn, leaf.id, equipId);
          leaf.shn_equip_id = equipId;
          filledLeafIds.add(leaf.id);

          await conn.commit();
          stats.imported += 1;
          stats.specs += Math.max(0, card.specs.length - 1);
          stats.schedule += card.schedule.length;
          stats.history += card.history.length;
        } catch (err) {
          await conn.rollback();
          stats.failed += 1;
          console.error(`[fail] ${card.tag} / ${equipmentName}: ${err.message}`);
        }
      }

      if ((i + 1) % 10 === 0 || i === cards.length - 1) {
        console.log(`Progress ${i + 1}/${cards.length} cards → imported ${stats.imported}…`);
      }
    }

    if (opts.replace) {
      for (const leaf of leaves) {
        if (!tagsInWorkbook.has(normTag(leaf.equip_no))) continue;
        if (filledLeafIds.has(leaf.id)) continue;
        if (!leaf.shn_equip_id || leaf.shn_equip_id < 1) continue;
        if (opts.dryRun) {
          stats.clearedSiblings += 1;
          continue;
        }
        await conn.beginTransaction();
        try {
          await deleteEquipmentTree(conn, leaf.shn_equip_id);
          await conn.commit();
          stats.clearedSiblings += 1;
          leaf.shn_equip_id = null;
        } catch (err) {
          await conn.rollback();
          stats.failed += 1;
          console.error(`[fail-clear] leaf ${leaf.id} ${leaf.equip_no}: ${err.message}`);
        }
      }
    }

    console.log('\nDone.');
    console.log(stats);
    if (unmatched.length) {
      console.log(`Unmatched cards (no tag + sub-equipment leaf): ${unmatched.length}`);
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
