const { pool } = require('../config/mysql');

const NODE_SELECT = `id, parent_id, node_type, name, equip_no, lookup_name, ppn_equip_id, sort_order, is_active`;

/** Prefer hierarchy tag; fall back to linked equipment tag / equip no (markmap display). */
function resolveEquipNo(row) {
  const fromNode = String(row.equip_no || '').trim();
  if (fromNode) return fromNode;
  const fromEquip = String(row.equip_equip_no || '').trim();
  if (fromEquip) return fromEquip;
  const fromTag = String(row.equip_tag_name || '').trim();
  return fromTag || null;
}

function rowToPayload(row) {
  return {
    id: String(row.id),
    dbId: row.id,
    parentId: row.parent_id != null ? String(row.parent_id) : null,
    nodeType: row.node_type,
    name: row.name,
    equipNo: resolveEquipNo(row),
    lookupName: row.lookup_name || null,
    location: String(row.equip_location || '').trim() || null,
    ppnEquipId: row.ppn_equip_id || null,
    sortOrder: row.sort_order ?? 0,
    isActive: Boolean(row.is_active),
  };
}

async function fetchAllActiveNodes(conn = pool) {
  const [rows] = await conn.execute(
    `SELECT n.id, n.parent_id, n.node_type, n.name, n.equip_no, n.lookup_name,
            n.ppn_equip_id, n.sort_order, n.is_active,
            e.equip_no AS equip_equip_no, e.tag_name AS equip_tag_name,
            e.location AS equip_location
     FROM ppn_hierarchy_node n
     LEFT JOIN ppn_equipment e ON e.id = n.ppn_equip_id
     WHERE n.is_active = 1
     ORDER BY n.sort_order ASC, n.id ASC`,
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
    `SELECT n.id, n.parent_id, n.node_type, n.name, n.equip_no, n.lookup_name,
            n.ppn_equip_id, n.sort_order, n.is_active,
            e.equip_no AS equip_equip_no, e.tag_name AS equip_tag_name,
            e.location AS equip_location
     FROM ppn_hierarchy_node n
     LEFT JOIN ppn_equipment e ON e.id = n.ppn_equip_id
     WHERE n.id = ? AND n.is_active = 1`,
    [dbId],
  );
  return row ? rowToPayload(row) : null;
}

async function resolvePpnEquipIdForNode(node) {
  if (node.ppnEquipId) return node.ppnEquipId;
  const equipNo = String(node.equipNo || '').trim();
  // Only auto-link via equip_no / tag_name — never by name alone.
  // Name-only lookup is ambiguous across boilers (same leaf name, different path).
  // Path-aware linking is handled by the write-back after first equipment creation.
  if (equipNo) {
    const [[row]] = await pool.execute(
      'SELECT id FROM ppn_equipment WHERE equip_no = ? OR tag_name = ? LIMIT 1',
      [equipNo, equipNo],
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
