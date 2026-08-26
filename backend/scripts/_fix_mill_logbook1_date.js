require('dotenv').config();
const { pool } = require('../config/mysql');

(async () => {
  const [before] = await pool.query(
    `SELECT \`Date\`, \`Shift\`, \`Time\`, \`timestamp\`
     FROM mill_logbook1
     WHERE \`Date\` = '0025-02-25'`,
  );
  console.log('before:', before);

  const [res] = await pool.query(
    `UPDATE mill_logbook1
     SET \`Date\` = '2025-02-25'
     WHERE \`Date\` = '0025-02-25'
       AND \`Shift\` = 'B'
       AND \`Time\` = '2025-02-25 11:32:00'`,
  );
  console.log('updated rows:', res.affectedRows);

  const [after] = await pool.query(
    `SELECT MIN(\`Date\`) AS min_d, MAX(\`Date\`) AS max_d
     FROM mill_logbook1
     WHERE \`Date\` IS NOT NULL`,
  );
  console.log('new bounds:', after[0]);

  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
