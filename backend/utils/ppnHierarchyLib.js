const { pool } = require('../config/mysql');

const NODE_SELECT = `id, parent_id, node_type, name, equip_no, lookup_name, ppn_equip_id, sort_order, is_active`;

function rowToPayload(row) {
  return {
    id: String(row.id),
    dbId: row.id,
    parentId: row.parent_id != null ? String(row.parent_id) : null,
    nodeType: row.node_type,
    name: row.name,
    equipNo: row.equip_no || null,
    lookupName: row.lookup_name || null,
    ppnEquipId: row.ppn_equip_id || null,
    sortOrder: row.sort_order ?? 0,
    isActive: Boolean(row.is_active),
  };
}

async function fetchAllActiveNodes(conn = pool) {
  const [rows] = await conn.execute(
    `SELECT ${NODE_SELECT} FROM ppn_hierarchy_node WHERE is_active = 1 ORDER BY sort_order ASC, id ASC`,
  );
  return rows.map(rowToPayload);
}

function buildTreeFromFlat(flatNodes) {
  const byId = new Map();
  for (const node of flatNodes) {
    byId.set(node.id, {
      ...node,
      children: [],
      isLeaf: node.nodeType === 'equipment',
    });
  }

  let root = null;
  for (const node of byId.values()) {
    if (!node.parentId) {
      root = node;
      continue;
    }
    const parent = byId.get(node.parentId);
    if (parent) parent.children.push(node);
  }

  if (!root && byId.size) {
    root = [...byId.values()].find((n) => !n.parentId) || [...byId.values()][0];
  }

  const sortChildren = (node) => {
    if (!node?.children) return;
    node.children.sort((a, b) => (a.sortOrder - b.sortOrder) || (Number(a.dbId) - Number(b.dbId)));
    node.children.forEach(sortChildren);
  };
  if (root) sortChildren(root);

  return root;
}

function findNodeById(root, nodeId) {
  if (!root || nodeId == null) return null;
  if (String(root.id) === String(nodeId)) return root;
  for (const child of root.children || []) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

function findNodeByPath(root, pathIds = []) {
  if (!root || !pathIds?.length) return root;
  let node = root;
  for (let i = 1; i < pathIds.length; i += 1) {
    const next = node.children?.find((c) => String(c.id) === String(pathIds[i]));
    if (!next) return node;
    node = next;
  }
  return node;
}

function pathIdsForNodeId(root, nodeId) {
  if (!root || nodeId == null) return root ? [root.id] : [];
  const walk = (node, trail) => {
    const nextTrail = [...trail, node.id];
    if (String(node.id) === String(nodeId)) return nextTrail;
    for (const child of node.children || []) {
      const found = walk(child, nextTrail);
      if (found) return found;
    }
    return null;
  };
  return walk(root, []) || (root ? [root.id] : []);
}

function pathLabels(root, pathIds = []) {
  const node = findNodeByPath(root, pathIds);
  if (!node) return [];
  return pathIdsForNodeId(root, node.id).map((id) => findNodeById(root, id)?.name).filter(Boolean);
}

function ancestorGroupLabels(root, nodeId) {
  const ids = pathIdsForNodeId(root, nodeId);
  return ids
    .slice(1)
    .map((id) => findNodeById(root, id))
    .filter((n) => n && n.nodeType === 'group')
    .map((n) => n.name);
}

function categorySubcategoryFromPath(root, nodeId) {
  const ids = pathIdsForNodeId(root, nodeId);
  const labels = ids.map((id) => findNodeById(root, id)?.name).filter(Boolean);
  return {
    category: labels[1] || '',
    subcategory: labels[2] || '',
  };
}

async function getHierarchyTree() {
  const flat = await fetchAllActiveNodes();
  if (!flat.length) return null;
  return buildTreeFromFlat(flat);
}

async function getNodeById(dbId) {
  const [[row]] = await pool.execute(
    `SELECT ${NODE_SELECT} FROM ppn_hierarchy_node WHERE id = ? AND is_active = 1`,
    [dbId],
  );
  return row ? rowToPayload(row) : null;
}

async function resolvePpnEquipIdForNode(node) {
  if (node.ppnEquipId) return node.ppnEquipId;
  const equipNo = String(node.equipNo || '').trim();
  const lookupName = String(node.lookupName || node.name || '').trim();
  if (equipNo) {
    const [[row]] = await pool.execute(
      'SELECT id FROM ppn_equipment WHERE equip_no = ? OR tag_name = ? LIMIT 1',
      [equipNo, equipNo],
    );
    if (row) return row.id;
  }
  if (lookupName) {
    const [[row]] = await pool.execute(
      'SELECT id FROM ppn_equipment WHERE name = ? LIMIT 1',
      [lookupName],
    );
    if (row) return row.id;
  }
  return null;
}

async function findSiblingNameConflict(parentId, name, excludeId = null) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return null;

  const parentClause = parentId != null ? 'parent_id = ?' : 'parent_id IS NULL';
  const params = parentId != null ? [parentId, trimmed] : [trimmed];
  let sql = `SELECT id, name FROM ppn_hierarchy_node
    WHERE ${parentClause} AND is_active = 1 AND LOWER(TRIM(name)) = LOWER(?)`;
  if (excludeId != null) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  sql += ' LIMIT 1';

  const [[row]] = await pool.execute(sql, params);
  return row || null;
}

async function linkEquipmentToNode(nodeDbId, ppnEquipId) {
  await pool.execute(
    'UPDATE ppn_hierarchy_node SET ppn_equip_id = ? WHERE id = ?',
    [ppnEquipId, nodeDbId],
  );
}

module.exports = {
  NODE_SELECT,
  rowToPayload,
  fetchAllActiveNodes,
  buildTreeFromFlat,
  findNodeById,
  findNodeByPath,
  pathIdsForNodeId,
  pathLabels,
  ancestorGroupLabels,
  categorySubcategoryFromPath,
  getHierarchyTree,
  getNodeById,
  findSiblingNameConflict,
  linkEquipmentToNode,
  resolvePpnEquipIdForNode,
};
