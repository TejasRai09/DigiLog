const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../config/mysql');

async function main() {
  try {
    const [[bounds]] = await pool.query(
      'SELECT MIN(`Date`) AS minDate, MAX(`Date`) AS maxDate, COUNT(*) AS totalRows FROM dmr_daily WHERE `Date` IS NOT NULL'
    );
    console.log('=== DMR DAILY BOUNDS ===');
    console.log(`Min Date: ${bounds.minDate}`);
    console.log(`Max Date: ${bounds.maxDate}`);
    console.log(`Total Rows: ${bounds.totalRows}`);

    const [topDates] = await pool.query(
      'SELECT `Date`, file_upload_id, COUNT(*) AS cnt FROM dmr_daily WHERE `Date` IS NOT NULL GROUP BY `Date`, file_upload_id ORDER BY `Date` DESC LIMIT 15'
    );
    console.log('\n=== LATEST 15 DATES IN DMR_DAILY ===');
    console.table(topDates);

    const [files] = await pool.query(
      'SELECT id, original_filename, dataset, date_min, date_max, rows_imported, created_at FROM data_upload_files WHERE dataset = "dmr_workbook" ORDER BY id DESC LIMIT 10'
    );
    console.log('\n=== DMR UPLOAD FILES RECORDED IN DB ===');
    console.table(files);

    process.exit(0);
  } catch (err) {
    console.error('Error querying dmr_daily:', err);
    process.exit(1);
  }
}

main();

