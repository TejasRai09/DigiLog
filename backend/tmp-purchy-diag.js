const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { absolutePathForStored } = require('./utils/dataUploadFile');
const { SHEET_NAMES } = require('./utils/purchyExcelImport');

(async () => {
  const p = await mysql.createPool('mysql://root:root1234@localhost:3306/gsmadb');
  const [files] = await p.query(`
    SELECT id, dataset, original_filename, stored_filename, import_status, rows_imported, created_at
    FROM data_upload_files
    WHERE id IN (79, 80)
  `);
  console.log('FILES', files);
  console.log('EXPECTED_SUMMARY_SHEET', JSON.stringify(SHEET_NAMES.summary));

  for (const f of files) {
    const abs = absolutePathForStored(f.stored_filename);
    console.log('\n===', f.original_filename, 'exists', fs.existsSync(abs), abs);
    if (!fs.existsSync(abs) || path.extname(abs).toLowerCase() !== '.xlsx') continue;

    const wb = new ExcelJS.stream.xlsx.WorkbookReader(abs, {
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      worksheets: 'emit',
      styles: 'ignore',
    });
    for await (const ws of wb) {
      let header = null;
      let sample = null;
      let n = 0;
      for await (const row of ws) {
        n += 1;
        if (n === 1) {
          header = (row.values || []).slice(1, 16).map((v) => (v == null ? '' : String(v)));
        } else if (n === 2) {
          sample = (row.values || []).slice(1, 8).map((v) => (v == null ? '' : String(v)));
          break;
        }
      }
      console.log('SHEET', JSON.stringify(ws.name), 'headerSample', header, 'row2', sample);
    }
  }
  await p.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
