const { pool } = require('../config/mysql');

const VALID_CARD_KEYS = new Set(['forms_hub', 'bi_control_tower']);

/** GET /api/homepage-cards — cards visible to the signed-in user */
const getMyHomepageCards = async (req, res) => {
  const { user } = req;

  if (user.role === 'admin') {
    return res.json({ cardKeys: ['forms_hub', 'bi_control_tower'] });
  }

  const [rows] = await pool.query(
    'SELECT card_key FROM user_homepage_cards WHERE user_id = ? ORDER BY card_key',
    [user.id],
  );
  res.json({ cardKeys: rows.map((r) => r.card_key) });
};

/** GET /api/admin/homepage-cards — all employee assignments */
const getAdminHomepageCards = async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT uhc.user_id, uhc.card_key, u.name AS u_name, u.email AS u_email
     FROM user_homepage_cards uhc
     JOIN users u ON u.id = uhc.user_id
     ORDER BY uhc.user_id, uhc.card_key`,
  );

  const byUser = new Map();
  for (const r of rows) {
    const uid = r.user_id;
    if (!byUser.has(uid)) {
      byUser.set(uid, {
        user: { _id: uid, id: uid, name: r.u_name, email: r.u_email },
        cardKeys: [],
      });
    }
    byUser.get(uid).cardKeys.push(r.card_key);
  }

  res.json(Array.from(byUser.values()));
};

/** PUT /api/admin/homepage-cards — replace cards for one user */
const upsertUserHomepageCards = async (req, res) => {
  const { userId, cardKeys } = req.body;

  if (!userId) return res.status(400).json({ message: 'userId is required.' });
  if (!Array.isArray(cardKeys)) return res.status(400).json({ message: 'cardKeys must be an array.' });

  const normalized = [...new Set(cardKeys.map(String))];
  for (const key of normalized) {
    if (!VALID_CARD_KEYS.has(key)) {
      return res.status(400).json({ message: `Invalid homepage card: ${key}` });
    }
  }

  const [[target]] = await pool.query('SELECT id, role FROM users WHERE id = ?', [userId]);
  if (!target) return res.status(404).json({ message: 'User not found.' });
  if (target.role === 'admin') {
    return res.status(400).json({ message: 'Homepage card mapping applies to employees only.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM user_homepage_cards WHERE user_id = ?', [userId]);
    if (normalized.length > 0) {
      const vals = normalized.map((cardKey) => [userId, cardKey]);
      await conn.query('INSERT INTO user_homepage_cards (user_id, card_key) VALUES ?', [vals]);
    }
    await conn.commit();
    res.json({ message: 'Homepage cards saved.', cardKeys: normalized });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  getMyHomepageCards,
  getAdminHomepageCards,
  upsertUserHomepageCards,
};
