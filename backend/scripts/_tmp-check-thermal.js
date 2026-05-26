const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [r] = await conn.query(
    "SELECT DATE_FORMAT(`Date`, '%Y-%m') AS ym, COUNT(*) AS rows_in_month, COUNT(BeltConvy_MtrTemp) AS bc_mtr FROM mill_logbook1 WHERE `Date` IS NOT NULL GROUP BY ym ORDER BY ym",
  );
  console.log('mill_logbook1 by month:');
  for (const row of r) console.log('  ', row.ym, '\t', row.rows_in_month, '\t', row.bc_mtr);

  const [s] = await conn.query('SELECT MIN(`Date`) mn, MAX(`Date`) mx FROM mill_stoppages');
  console.log('mill_stoppages range:', s[0].mn, '→', s[0].mx);

  const [t] = await conn.query('SELECT MIN(`Date`) mn, MAX(`Date`) mx FROM mill_logbook1 WHERE `Date` > "2000-01-01"');
  console.log('mill_logbook1 range (clean):', t[0].mn, '→', t[0].mx);

  const [bad] = await conn.query('SELECT `Date`, COUNT(*) c FROM mill_logbook1 WHERE `Date` < "2000-01-01" GROUP BY `Date`');
  console.log('mill_logbook1 suspicious dates:', JSON.stringify(bad));

  await conn.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
