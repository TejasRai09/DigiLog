/**
 * Add 3 UPS servo-control leaves under Sugar Plant.
 *
 *   Sugar Plant → MILL HOUSE → MILL DCS CONTROL ROOM → MILL UPS
 *     → MILL UPS SERVO CONTROL · UPS FOR SUGAR PLANT MILL HOUSE
 *       (ZIL/GSM/SCVS-MILL)
 *
 *   Sugar Plant → REFINERY HOUSE → RAW HOUSE DCS CONTROL MAIN ROOM → RAW HOUSE UPS
 *     → RAW HOUSE UPS SERVO CONTROL · UPS FOR SUGAR PLANT  RAW HOUSE
 *       (ZIL/GSM/SCVS-RAW)
 *
 *   Sugar Plant → REFINERY HOUSE → REFINERY HOUSE DCS CONTROL ROOM → REFINERY HOUSE UPS
 *     → REFINERY HOUSE UPS SERVO CONTROL · UPS FOR SUGAR PLANT  REFINERY
 *       (ZIL/GSM/SCVS-REFINRY)
 *
 * Reuses existing folders. Skips a tag if that leaf is already present.
 * Creates an empty shn_equipment row when the tag is missing (no specs/history).
 *
 * Usage (from backend/):
 *   node scripts/add-scvs-ups-hierarchy.js --dry-run
 *   node scripts/add-scvs-ups-hierarchy.js
 */
require('../config/env');
const { pool } = require('../config/mysql');

const ROOT_NAME = 'Sugar Plant';

const ROWS = [
  {
    section: 'MILL HOUSE',
    location: 'MILL DCS CONTROL ROOM',
    main: 'MILL UPS',
    sub: 'MILL UPS SERVO CONTROL',
    equipNo: 'ZIL/GSM/SCVS-MILL',
    histLocation: 'UPS FOR SUGAR PLANT MILL HOUSE',
  },
  {
    section: 'REFINERY HOUSE',
    location: 'RAW HOUSE DCS CONTROL MAIN ROOM',
    main: 'RAW HOUSE UPS',
    sub: 'RAW HOUSE UPS SERVO CONTROL',
    equipNo: 'ZIL/GSM/SCVS-RAW',
    histLocation: 'UPS FOR SUGAR PLANT  RAW HOUSE',
  },
  {
    section: 'REFINERY HOUSE',
    location: 'REFINERY HOUSE DCS CONTROL ROOM',
    main: 'REFINERY HOUSE UPS',
    sub: 'REFINERY HOUSE UPS SERVO CONTROL',
    equipNo: 'ZIL/GSM/SCVS-REFINRY',
    histLocation: 'UPS FOR SUGAR PLANT  REFINERY',
  },
];

function trim(v) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

async function findChild(conn, parentId, name) {
  const want = trim(name).toUpperCase();
  const [rows] = await conn.execute(
    'SELECT id, name FROM shn_hierarchy_node WHERE parent_id = ? AND is_active = 1',
    [parentId],
  );
  return (
    rows.find((r) => trim(r.name).toUpperCase() === want)
    || rows.find((r) => trim(r.name).toUpperCase().startsWith(`${want} -`))
    || null
  );
}

async function ensureGroup(conn, parentId, name, dryRun) {
  const existing = await findChild(conn, parentId, name);
  if (existing) return existing.id;
  if (dryRun) {
    console.log(`  [dry-run] would create group "${name}" under parent ${parentId}`);
    return -1;
  }
  const [sortRows] = await conn.execute(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM shn_hierarchy_node WHERE parent_id = ?',
    [parentId],
  );
  const [res] = await conn.execute(
    `INSERT INTO shn_hierarchy_node
       (parent_id, node_type, name, sort_order, is_imported)
     VALUES (?, 'group', ?, ?, 1)`,
    [parentId, name, sortRows[0].next_sort],
  );
  console.log(`  created group "${name}" id=${res.insertId}`);
  return res.insertId;
}

async function resolveEquipId(conn, row, dryRun) {
  const [found] = await conn.execute(
    `SELECT id FROM shn_equipment
     WHERE equip_no = ? OR tag_name = ?
     LIMIT 1`,
    [row.equipNo, row.equipNo],
  );
  if (found[0]) return found[0].id;
  if (dryRun) {
    console.log(`  [dry-run] would create shn_equipment ${row.equipNo}`);
    return null;
  }
  const [res] = await conn.execute(
    `INSERT INTO shn_equipment (dept, equip_no, tag_name, name, location)
     VALUES ('sugar_house', ?, ?, ?, ?)`,
    [row.equipNo, row.equipNo, row.sub, row.histLocation],
  );
  console.log(`  created shn_equipment ${row.equipNo} id=${res.insertId}`);
  return res.insertId;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const conn = await pool.getConnection();
  try {
    const [roots] = await conn.execute(
      `SELECT id FROM shn_hierarchy_node
       WHERE name = ? AND parent_id IS NULL AND is_active = 1
       LIMIT 1`,
      [ROOT_NAME],
    );
    if (!roots[0]) throw new Error('Sugar Plant root not found');
    const rootId = roots[0].id;

    if (!dryRun) await conn.beginTransaction();

    for (const row of ROWS) {
      console.log(`\n${row.equipNo}`);
      const sectionId = await ensureGroup(conn, rootId, row.section, dryRun);
      const locId = await ensureGroup(conn, sectionId, row.location, dryRun);
      const mainId = await ensureGroup(conn, locId, row.main, dryRun);

      if (mainId > 0) {
        const [existing] = await conn.execute(
          `SELECT id FROM shn_hierarchy_node
           WHERE parent_id = ? AND equip_no = ? AND is_active = 1
           LIMIT 1`,
          [mainId, row.equipNo],
        );
        if (existing[0]) {
          console.log(`  already present as leaf id=${existing[0].id}`);
          continue;
        }
      }

      const leafName = `${row.sub} · ${row.histLocation}`;
      const equipId = await resolveEquipId(conn, row, dryRun);
      if (dryRun) {
        console.log(`  [dry-run] would add leaf "${leafName}"`);
        continue;
      }

      const [sortRows] = await conn.execute(
        'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM shn_hierarchy_node WHERE parent_id = ?',
        [mainId],
      );
      const [leaf] = await conn.execute(
        `INSERT INTO shn_hierarchy_node
           (parent_id, node_type, name, equip_no, lookup_name, hist_location, shn_equip_id, sort_order, is_imported)
         VALUES (?, 'equipment', ?, ?, ?, ?, ?, ?, 1)`,
        [mainId, leafName, row.equipNo, row.sub, row.histLocation, equipId, sortRows[0].next_sort],
      );
      console.log(`  added leaf id=${leaf.insertId}`);
    }

    if (!dryRun) await conn.commit();
    console.log(dryRun ? '\nNo DB changes made.' : '\nDone.');
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
