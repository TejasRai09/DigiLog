const { pool } = require('./backend/config/mysql');
(async () => {
  try {
    await pool.query(
      `INSERT INTO portal_settings (setting_key, setting_value)
       VALUES ('distillery_theoretical_yield', '64.4'), ('power_tariff_rate', '4.85')
       ON DUPLICATE KEY UPDATE setting_key = setting_key`
    );
    console.log('portal_settings rows seeded OK');
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
})();
