/**
 * Remove Management Dashboard indent/purchase DB rows and uploaded files.
 *
 * From backend/:
 *   node scripts/clear-md-indent-purchase.js
 */
require('../config/env');

const { pool } = require('../config/mysql');
const { unlinkStoredFile } = require('../utils/dataUploadFile');

const DATASETS = ['centre_indent_purchase', 'centre_indent', 'centre_purchase'];
const CATEGORIES = [
  'Management Dashboard — Centre Indent & Purchase',
  'Management Dashboard — Centre Indent',
  'Management Dashboard — Centre Purchase',
];

async function main() {
  const conn = await pool.getConnection();
  try {
    const [files] = await conn.query(
      `SELECT id, stored_filename, original_filename, dataset, category
       FROM data_upload_files
       WHERE dataset IN (?, ?, ?)
          OR category IN (?, ?, ?)`,
      [...DATASETS, ...CATEGORIES],
    );

    console.log(`Upload records: ${files.length}`);
    for (const row of files) {
      unlinkStoredFile(row.stored_filename);
      await conn.query('DELETE FROM data_upload_files WHERE id = ?', [row.id]);
      console.log(`  deleted file record ${row.id}: ${row.original_filename}`);
    }

    await conn.query('TRUNCATE TABLE centre_indent_data');
    await conn.query('TRUNCATE TABLE centre_purchase_data');
    console.log('Truncated centre_indent_data and centre_purchase_data.');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
