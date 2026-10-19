const { pool } = require('../config/mysql');

const HOUSES = new Set(['sugar', 'power']);
const LIST_LIMIT = 300;

const CREATE_SQL = `CREATE TABLE IF NOT EXISTS hierarchy_move_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  house ENUM('sugar', 'power') NOT NULL,
  node_id INT NOT NULL,
  node_name VARCHAR(255) NOT NULL,
  node_type VARCHAR(20) NULL DEFAULT NULL,
  from_parent_id INT NULL DEFAULT NULL,
  from_parent_name VARCHAR(255) NULL DEFAULT NULL,
  from_path VARCHAR(500) NULL DEFAULT NULL,
  to_parent_id INT NOT NULL,
  to_parent_name VARCHAR(255) NOT NULL,
  to_path VARCHAR(500) NULL DEFAULT NULL,
  user_id INT NULL DEFAULT NULL,
  user_name VARCHAR(200) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_hierarchy_move_history_house_created (house, created_at DESC),
  INDEX idx_hierarchy_move_history_node (house, node_id),
  CONSTRAINT fk_hierarchy_move_history_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`;

let ensured = null;

async function ensureMoveHistoryTable() {
  if (!ensured) {
    ensured = pool.query(CREATE_SQL).then(() => true).catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}

function assertHouse(house) {
  const key = String(house || '').trim().toLowerCase();
  if (!HOUSES.has(key)) {
    const error = new Error('Unknown house.');
    error.status = 400;
    throw error;
  }
  return key;
}

function clip(value, max) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? text.slice(0, max) : text;
}

function folderPathLabel(tree, nodeId, pathIdsForNodeId, findNodeById) {
  if (nodeId == null || !tree) return '';
  const ids = pathIdsForNodeId(tree, String(nodeId));
  return ids
    .map((id) => findNodeById(tree, String(id))?.name)
    .filter(Boolean)
    .join(' › ');
}

function toIsoUtc(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.includes('T')) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
  }
  const parsed = new Date(`${raw.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString();
}

async function recordHierarchyMoves(conn, {
  house,
  tree,
  movedNodes,
  targetParent,
  user,
  pathIdsForNodeId,
  findNodeById,
}) {
  if (!movedNodes?.length || !targetParent) return;
  const key = assertHouse(house);
  const userId = user?.id ? Number(user.id) : null;
  const userName = clip(user?.name || user?.email || 'Unknown user', 200) || 'Unknown user';
  const toParentId = Number(targetParent.dbId || targetParent.id);
  const toParentName = clip(targetParent.name || 'Folder', 255) || 'Folder';
  const toParentPath = folderPathLabel(tree, targetParent.id, pathIdsForNodeId, findNodeById);

  for (const node of movedNodes) {
    const fromParent = node.parentId != null
      ? findNodeById(tree, String(node.parentId))
      : null;
    const fromPath = folderPathLabel(tree, node.id, pathIdsForNodeId, findNodeById);
    const toPath = toParentPath
      ? `${toParentPath} › ${node.name}`
      : String(node.name || '');
    await conn.execute(
      `INSERT INTO hierarchy_move_history
        (house, node_id, node_name, node_type,
         from_parent_id, from_parent_name, from_path,
         to_parent_id, to_parent_name, to_path,
         user_id, user_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        key,
        Number(node.dbId || node.id),
        clip(node.name, 255) || 'Untitled',
        clip(node.nodeType, 20) || null,
        fromParent ? Number(fromParent.dbId || fromParent.id) : null,
        fromParent ? clip(fromParent.name, 255) || null : null,
        clip(fromPath, 500) || null,
        toParentId,
        toParentName,
        clip(toPath, 500) || null,
        userId,
        userName,
      ],
    );
  }
}

async function listMoveHistory(house, { limit = LIST_LIMIT } = {}) {
  await ensureMoveHistoryTable();
  const key = assertHouse(house);
  const take = Math.min(Math.max(parseInt(limit, 10) || LIST_LIMIT, 1), LIST_LIMIT);
  const [rows] = await pool.execute(
    `SELECT
       h.id, h.node_id, h.node_name, h.node_type,
       h.from_parent_id, h.from_parent_name, h.from_path,
       h.to_parent_id, h.to_parent_name, h.to_path,
       h.user_id, COALESCE(u.name, h.user_name) AS user_name,
       h.created_at
     FROM hierarchy_move_history h
     LEFT JOIN users u ON u.id = h.user_id
     WHERE h.house = ?
     ORDER BY h.created_at DESC, h.id DESC
     LIMIT ${take}`,
    [key],
  );
  return rows.map((row) => ({
    id: Number(row.id),
    nodeId: Number(row.node_id),
    nodeName: row.node_name,
    nodeType: row.node_type || null,
    fromParentId: row.from_parent_id != null ? Number(row.from_parent_id) : null,
    fromParentName: row.from_parent_name || null,
    fromPath: row.from_path || null,
    toParentId: Number(row.to_parent_id),
    toParentName: row.to_parent_name,
    toPath: row.to_path || null,
    userId: row.user_id != null ? Number(row.user_id) : null,
    userName: row.user_name || 'Unknown user',
    createdAt: toIsoUtc(row.created_at),
  }));
}

module.exports = {
  ensureMoveHistoryTable,
  recordHierarchyMoves,
  listMoveHistory,
};
