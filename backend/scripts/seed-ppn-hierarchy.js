/**
 * Seed ppn_hierarchy_node from frontend static tree (one-time / re-run safe if empty).
 * Usage: cd backend && node scripts/seed-ppn-hierarchy.js
 *        node scripts/seed-ppn-hierarchy.js --force   (clear and re-seed)
 */
const path = require('path');
const { pathToFileURL } = require('url');
const { pool } = require('../config/mysql');

async function loadStaticRoot() {
  const modPath = pathToFileURL(
    path.join(__dirname, '../../frontend/src/config/powerPlantEquipmentHierarchy.js'),
  ).href;
  const mod = await import(modPath);
  return mod.POWER_PLANT_EQUIPMENT_ROOT;
}

async function resolvePpnEquipId(conn, node) {
  const equipNo = String(node.equipNo || '').trim();
  const lookupName = String(node.lookupName || node.name || '').trim();
  if (equipNo) {
    const [rows] = await conn.execute(
      'SELECT id FROM ppn_equipment WHERE equip_no = ? OR tag_name = ? LIMIT 1',
      [equipNo, equipNo],
    );
    if (rows[0]) return rows[0].id;
  }
  if (lookupName) {
    const [rows] = await conn.execute(
      'SELECT id FROM ppn_equipment WHERE name = ? LIMIT 1',
      [lookupName],
    );
    if (rows[0]) return rows[0].id;
  }
  return null;
}

async function insertNode(conn, parentId, node, sortOrder) {
  const children = node.children || [];
  const nodeType = children.length ? 'group' : 'equipment';
  let ppnEquipId = null;
  if (nodeType === 'equipment') {
    ppnEquipId = await resolvePpnEquipId(conn, node);
  }

  const [result] = await conn.execute(
    `INSERT INTO ppn_hierarchy_node
       (parent_id, node_type, name, equip_no, lookup_name, ppn_equip_id, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      parentId,
      nodeType,
      node.name,
      node.equipNo || null,
      node.lookupName || null,
      ppnEquipId,
      sortOrder,
    ],
  );

  const newId = result.insertId;
  for (let i = 0; i < children.length; i += 1) {
    await insertNode(conn, newId, children[i], i);
  }
  return newId;
}

async function main() {
  const force = process.argv.includes('--force');
  const conn = await pool.getConnection();
  try {
    const [[{ count }]] = await conn.execute(
      'SELECT COUNT(*) AS count FROM ppn_hierarchy_node WHERE is_active = 1',
    );
    if (count > 0 && !force) {
      console.log(`ppn_hierarchy_node already has ${count} row(s). Use --force to re-seed.`);
      return;
    }

    if (force) {
      await conn.execute('DELETE FROM ppn_hierarchy_node');
      console.log('Cleared ppn_hierarchy_node.');
    }

    const root = await loadStaticRoot();
    await conn.beginTransaction();
    await insertNode(conn, null, root, 0);
    await conn.commit();
    const [[{ finalCount }]] = await conn.execute(
      'SELECT COUNT(*) AS finalCount FROM ppn_hierarchy_node WHERE is_active = 1',
    );
    console.log(`Seeded ${finalCount} hierarchy node(s).`);
  } catch (err) {
    await conn.rollback();
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
