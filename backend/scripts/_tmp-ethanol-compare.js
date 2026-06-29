require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { pool } = require('../config/mysql');

async function main() {
  const ranges = [
    ['May MTD (KPI current)', '2026-05-01', '2026-05-10'],
    ['Apr 1-10 (KPI prior)', '2026-04-01', '2026-04-10'],
  ];
  for (const [label, from, to] of ranges) {
    const [rows] = await pool.query(
      'SELECT `Date`, actual_ethanol_bl FROM distillery_operations WHERE `Date` >= ? AND `Date` <= ? ORDER BY `Date`',
      [from, to],
    );
    const sum = rows.reduce((s, r) => s + Number(r.actual_ethanol_bl || 0), 0);
    console.log(`\n${label}: ${rows.length} days, SUM = ${sum.toLocaleString()}`);
    rows.forEach((r) => {
      const d = r.Date instanceof Date ? r.Date.toISOString().slice(0, 10) : String(r.Date).slice(0, 10);
      console.log(`  ${d}: ${Number(r.actual_ethanol_bl).toLocaleString()}`);
    });
  }
  const [may] = await pool.query(
    'SELECT SUM(actual_ethanol_bl) AS s FROM distillery_operations WHERE `Date` >= ? AND `Date` <= ?',
    ['2026-05-01', '2026-05-10'],
  );
  const [apr] = await pool.query(
    'SELECT SUM(actual_ethanol_bl) AS s FROM distillery_operations WHERE `Date` >= ? AND `Date` <= ?',
    ['2026-04-01', '2026-04-10'],
  );
  const cur = Number(may[0].s);
  const prev = Number(apr[0].s);
  const delta = prev !== 0 ? ((cur - prev) / prev) * 100 : 0;
  console.log(`\nKPI card math:`);
  console.log(`  Current SUM: ${cur.toLocaleString()}`);
  console.log(`  Prior SUM:   ${prev.toLocaleString()}`);
  console.log(`  Delta %:     ${delta.toFixed(1)}%`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
