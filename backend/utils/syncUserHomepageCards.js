const BI_CONTROL_TOWER_APP_NAME = 'BI Control Tower';

/**
 * Keep homepage big-cards in sync with employee form/dashboard mappings.
 * - forms_hub: at least one non-BI form mapped
 * - bi_control_tower: at least one BI Control Tower dashboard mapped
 */
async function syncUserHomepageCards(db, userId) {
  const [[formsRow]] = await db.query(
    `SELECT COUNT(*) AS n
     FROM mapping_forms mf
     JOIN mappings m ON m.id = mf.mapping_id
     JOIN apps a ON a.id = m.app_id
     WHERE m.user_id = ? AND a.name <> ?`,
    [userId, BI_CONTROL_TOWER_APP_NAME],
  );

  const [[dashRow]] = await db.query(
    `SELECT COUNT(*) AS n
     FROM mapping_forms mf
     JOIN mappings m ON m.id = mf.mapping_id
     JOIN apps a ON a.id = m.app_id
     WHERE m.user_id = ? AND a.name = ?`,
    [userId, BI_CONTROL_TOWER_APP_NAME],
  );

  const wantsFormsHub = Number(formsRow?.n || 0) > 0;
  const wantsBiTower = Number(dashRow?.n || 0) > 0;

  if (wantsFormsHub) {
    await db.query(
      `INSERT IGNORE INTO user_homepage_cards (user_id, card_key) VALUES (?, 'forms_hub')`,
      [userId],
    );
  } else {
    await db.query(
      `DELETE FROM user_homepage_cards WHERE user_id = ? AND card_key = 'forms_hub'`,
      [userId],
    );
  }

  if (wantsBiTower) {
    await db.query(
      `INSERT IGNORE INTO user_homepage_cards (user_id, card_key) VALUES (?, 'bi_control_tower')`,
      [userId],
    );
  } else {
    await db.query(
      `DELETE FROM user_homepage_cards WHERE user_id = ? AND card_key = 'bi_control_tower'`,
      [userId],
    );
  }
}

module.exports = { syncUserHomepageCards, BI_CONTROL_TOWER_APP_NAME };
