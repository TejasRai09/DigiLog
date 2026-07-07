const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');

/** GET /api/homepage-cards — cards visible to the signed-in user */
const getMyHomepageCards = async (req, res) => {
  const { user } = req;

  if (user.role === 'admin') {
    return res.json({ cardKeys: ['forms_hub', 'bi_control_tower'] });
  }

  try {
    const [rows] = await pool.query(
      'SELECT card_key FROM user_homepage_cards WHERE user_id = ? ORDER BY card_key',
      [user.id],
    );
    res.json({ cardKeys: rows.map((r) => r.card_key) });
  } catch (err) {
    sendServerError(res, 'getMyHomepageCards', err, MSG.LOAD);
  }
};

module.exports = {
  getMyHomepageCards,
};
