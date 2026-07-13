/**
 * Import Sugar House equipment hierarchy from Excel into shn_hierarchy_node.
 *
 * Hierarchy: Sugar Plant → Section → Location → Main Equipment → Sub Equipment (leaf)
 * One leaf per Excel row.
 * Unique key (import): Sub + Tag + Inst. History Location (518 rows).
 * Unique no. (UI):    same composite — Sub · Tag · Hist Location.
 *
 * Usage (from backend/):
 *   npm run db:import-sugar-house-hierarchy
 *   npm run db:import-sugar-house-hierarchy -- --force
 *   node scripts/import-sugar-house-hierarchy.js --file "backlog-data/mill data/sugar house hierarchy.xlsx"
 *
 * Re-create tree (production):
 *   cd backend
 *   npm run db:import-sugar-house-hierarchy -- --force
 */
require('../config/env');
const path = require('path');
const XLSX = require('xlsx');
const { pool } = require('../config/mysql');

const DEFAULT_XLSX = path.join(
  __dirname,
  '../backlog-data/mill data/sugar house hierarchy.xlsx',
);

const ROOT_NAME = 'Sugar Plant';

function trim(value) {
  return String(value ?? '').trim();
}

function subEquipmentColumn(row) {
  return trim(row[' Sub Equipment'] || row['Sub Equipment'] || row.sub_equipment);
}

function tagNoColumn(row) {
  return trim(row['Inst. History card Tag nas.'] || row['Inst. History card Tag no.']);
}

function histLocationColumn(row) {
  return trim(row['Inst. History card Location']);
}

/** Unique per Excel row — Sub + Tag + Inst. History Location. */
function rowUniqueKey(row) {
  return [
    subEquipmentColumn(row),
    tagNoColumn(row),
    histLocationColumn(row),
  ].join('\0');
}

function parseArgs(argv) {
  const args = { force: false, file: DEFAULT_XLSX };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--force') args.force = true;
    else if (argv[i] === '--file' && argv[i + 1]) {
      args.file = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

function loadRows(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Workbook has no sheets.');
  const sheetRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  if (!sheetRows.length) throw new Error('Sheet is empty.');

  const unique = new Map();
  let skipped = 0;

  for (const row of sheetRows) {
    const section = trim(row.Section);
    const location = trim(row.Location);
    const mainEquipment = trim(row['Main Equipment']);
    const subEquipment = subEquipmentColumn(row);
    const equipNo = tagNoColumn(row);
    const histLocation = histLocationColumn(row);

    if (!section || !location || !mainEquipment || !subEquipment || !equipNo || !histLocation) {
      skipped += 1;
      continue;
    }

    const key = rowUniqueKey(row);
    if (!unique.has(key)) {
      unique.set(key, {
        section,
        location,
        mainEquipment,
        subEquipment,
        equipNo,
        histLocation,
      });
    }
  }

  if (skipped) {
    console.log(`Skipped ${skipped} row(s) missing Section/Location/Main/Sub/Tag/HistLocation.`);
  }

  return [...unique.values()];
}

function leafLabelKey(subEquipment, histLocation) {
  return `${subEquipment}\0${histLocation}`;
}

function leafDisplayName(subEquipment, histLocation, equipNo, duplicateLabel) {
  const base = `${subEquipment} · ${histLocation}`;
  if (duplicateLabel) return `${base} · ${equipNo}`;
  return base;
}

function buildTree(rows) {
  const root = { name: ROOT_NAME, children: [] };
  const sectionMap = new Map();
  const locationMap = new Map();
  const mainEquipMap = new Map();
  const mainLeavesMap = new Map();

  for (const row of rows) {
    const mainKey = [row.section, row.location, row.mainEquipment].join('\0');
    if (!mainLeavesMap.has(mainKey)) mainLeavesMap.set(mainKey, []);
    mainLeavesMap.get(mainKey).push(row);
  }

  const labelCountsByMain = new Map();
  for (const [mainKey, leaves] of mainLeavesMap) {
    const counts = new Map();
    for (const row of leaves) {
      const labelKey = leafLabelKey(row.subEquipment, row.histLocation);
      counts.set(labelKey, (counts.get(labelKey) || 0) + 1);
    }
    labelCountsByMain.set(mainKey, counts);
  }

  const sorted = [...rows].sort((a, b) => {
    const ka = [a.section, a.location, a.mainEquipment, a.subEquipment, a.equipNo].join('\0');
    const kb = [b.section, b.location, b.mainEquipment, b.subEquipment, b.equipNo].join('\0');
    return ka.localeCompare(kb);
  });

  for (const row of sorted) {
    let sectionNode = sectionMap.get(row.section);
    if (!sectionNode) {
      sectionNode = { name: row.section, children: [] };
      sectionMap.set(row.section, sectionNode);
      root.children.push(sectionNode);
    }

    const locKey = `${row.section}\0${row.location}`;
    let locationNode = locationMap.get(locKey);
    if (!locationNode) {
      locationNode = { name: row.location, children: [] };
      locationMap.set(locKey, locationNode);
      sectionNode.children.push(locationNode);
    }

    const mainKey = `${locKey}\0${row.mainEquipment}`;
    let mainNode = mainEquipMap.get(mainKey);
    if (!mainNode) {
      mainNode = { name: row.mainEquipment, children: [] };
      mainEquipMap.set(mainKey, mainNode);
      locationNode.children.push(mainNode);
    }

    const mainIdentityKey = [row.section, row.location, row.mainEquipment].join('\0');
    const labelKey = leafLabelKey(row.subEquipment, row.histLocation);
    const duplicateLabel = (labelCountsByMain.get(mainIdentityKey)?.get(labelKey) || 0) > 1;

    mainNode.children.push({
      name: leafDisplayName(row.subEquipment, row.histLocation, row.equipNo, duplicateLabel),
      lookupName: row.subEquipment,
      equipNo: row.equipNo,
      histLocation: row.histLocation,
      children: [],
    });
  }

  return root;
}

async function resolveShnEquipId(conn, node) {
  const equipNo = trim(node.equipNo);
  const lookupName = trim(node.lookupName || node.name);
  if (equipNo) {
    const [rows] = await conn.execute(
      'SELECT id FROM shn_equipment WHERE equip_no = ? OR tag_name = ? LIMIT 1',
      [equipNo, equipNo],
    );
    if (rows[0]) return rows[0].id;
  }
  if (lookupName) {
    const [rows] = await conn.execute(
      'SELECT id FROM shn_equipment WHERE name = ? LIMIT 1',
      [lookupName],
    );
    if (rows[0]) return rows[0].id;
  }
  return null;
}

async function insertNode(conn, parentId, node, sortOrder) {
  const children = node.children || [];
  const nodeType = children.length ? 'group' : 'equipment';
  let shnEquipId = null;
  if (nodeType === 'equipment') {
    shnEquipId = await resolveShnEquipId(conn, node);
  }

  const [result] = await conn.execute(
    `INSERT INTO shn_hierarchy_node
       (parent_id, node_type, name, equip_no, lookup_name, hist_location, shn_equip_id, sort_order, is_imported)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      parentId,
      nodeType,
      node.name,
      nodeType === 'equipment' ? (node.equipNo || null) : null,
      nodeType === 'equipment' ? (node.lookupName || node.name) : null,
      nodeType === 'equipment' ? (node.histLocation || null) : null,
      shnEquipId,
      sortOrder,
      1,
    ],
  );

  const newId = result.insertId;
  for (let i = 0; i < children.length; i += 1) {
    await insertNode(conn, newId, children[i], i);
  }
  return newId;
}

async function countNodes(conn) {
  const [[{ count }]] = await conn.execute(
    'SELECT COUNT(*) AS count FROM shn_hierarchy_node WHERE is_active = 1',
  );
  return count;
}

async function countLeaves(conn) {
  const [[{ count }]] = await conn.execute(
    "SELECT COUNT(*) AS count FROM shn_hierarchy_node WHERE node_type = 'equipment' AND is_active = 1",
  );
  return count;
}

async function main() {
  const { force, file } = parseArgs(process.argv);
  const conn = await pool.getConnection();

  try {
    const [[tableRow]] = await conn.execute(
      "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'shn_hierarchy_node'",
    );
    if (!tableRow?.c) {
      throw new Error('shn_hierarchy_node table not found. Run migrate_shn_hierarchy.sql first.');
    }

    const existing = await countNodes(conn);
    if (existing > 0 && !force) {
      console.log(`shn_hierarchy_node already has ${existing} row(s). Use --force to re-import.`);
      return;
    }

    const rows = loadRows(file);
    if (!rows.length) {
      throw new Error(`No valid hierarchy rows found in ${file}`);
    }

    const tree = buildTree(rows);
    console.log(`Loaded ${rows.length} sub-equipment row(s) from ${path.basename(file)}`);
    console.log(`Sections: ${tree.children.length}`);

    await conn.beginTransaction();
    if (force) {
      await conn.execute('SET FOREIGN_KEY_CHECKS = 0');
      await conn.execute('DELETE FROM shn_hierarchy_node');
      await conn.execute('SET FOREIGN_KEY_CHECKS = 1');
      console.log('Cleared shn_hierarchy_node.');
    }

    await insertNode(conn, null, tree, 0);
    await conn.commit();

    const finalCount = await countNodes(conn);
    const leafCount = await countLeaves(conn);
    console.log(`Imported ${finalCount} hierarchy node(s) (${leafCount} sub-equipment leaves).`);
  } catch (err) {
    await conn.rollback();
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
