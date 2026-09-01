require('dotenv').config();
const { poolPromise } = require('./utils/sqlServer');
async function run() {
  try {
    const pool = await poolPromise;
    if (!pool) { console.log('No pool'); process.exit(1); }
    const r = await pool.request().query(`SELECT TOP 1 * FROM CntPerformance`);
    console.log(Object.keys(r.recordset[0]));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
