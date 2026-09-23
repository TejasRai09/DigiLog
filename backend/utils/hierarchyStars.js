const { pool } = require('../config/mysql');

const HOUSES = new Set(['sugar', 'power']);

const CREATE_SQL = `CREATE TABLE IF NOT EXISTS user_hierarchy_star (
  user_id INT NOT NULL,
  house ENUM('sugar', 'power') NOT NULL,
  node_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, house, node_id),
  INDEX idx_user_hierarchy_star_house (house, node_id),
  CONSTRAINT fk_user_hierarchy_star_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`;

let ensured = null;

async function ensureStarTable() {
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

async function listStarNodeIds(userId, house) {
  await ensureStarTable();
  const key = assertHouse(house);
  const hierarchyTable = key === 'sugar' ? 'shn_hierarchy_node' : 'ppn_hierarchy_node';
  const [rows] = await pool.execute(
    `SELECT s.node_id
     FROM user_hierarchy_star s
     INNER JOIN \`${hierarchyTable}\` n ON n.id = s.node_id AND n.is_active = 1
     WHERE s.user_id = ? AND s.house = ?
     ORDER BY s.created_at DESC, s.node_id DESC`,
    [userId, key],
  );
  return rows.map((row) => Number(row.node_id));
}

async function addStar(userId, house, nodeId) {
  await ensureStarTable();
  const key = assertHouse(house);
  await pool.execute(
    `INSERT IGNORE INTO user_hierarchy_star (user_id, house, node_id) VALUES (?, ?, ?)`,
    [userId, key, nodeId],
  );
}

async function removeStar(userId, house, nodeId) {
  await ensureStarTable();
  const key = assertHouse(house);
  await pool.execute(
    `DELETE FROM user_hierarchy_star WHERE user_id = ? AND house = ? AND node_id = ?`,
    [userId, key, nodeId],
  );
}

module.exports = {
  listStarNodeIds,
  addStar,
  removeStar,
};
