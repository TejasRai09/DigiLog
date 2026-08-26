/**
 * Generate dmrDailySchema.js + migrate SQL from reference DMR Excel.
 * Usage: node scripts/generate-dmr-daily-schema.js [path-to-xlsx]
 */
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const xlsxPath = process.argv[2] || path.resolve(__dirname, '../../../DMR_season 23-24.xlsx');
const wb = xlsx.readFile(xlsxPath);
const matrix = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });

/** Header row index (0-based) — row 3 in Excel for DMR_season 23-24.xlsx */
const HEADER_ROW_INDEX = 2;
const DATA_START_ROW = 3;

const fileHeaders = (matrix[HEADER_ROW_INDEX] || []).map((h) => String(h).trim());

const seen = {};
const dbColumns = fileHeaders.map((h, i) => {
  if (!h) return null;
  if (!seen[h]) {
    seen[h] = 1;
    return { fileHeader: h, dbColumn: h, index: i };
  }
  seen[h] += 1;
  return { fileHeader: h, dbColumn: `${h}__dup${seen[h]}`, index: i };
}).filter(Boolean);

function sqlType(dbCol, fileHeader) {
  if (fileHeader === 'Date') return 'DATE NULL DEFAULT NULL';
  if (fileHeader === 'Crop Day') return 'INT NULL DEFAULT NULL';
  return 'DOUBLE NULL DEFAULT NULL';
}

const schemaPath = path.join(__dirname, '../services/managementDashboard/dmrDailySchema.js');
const schemaJs = `/** Auto-generated from DMR reference workbook — do not edit by hand. */
module.exports = {
  HEADER_ROW_INDEX: ${HEADER_ROW_INDEX},
  DATA_START_ROW: ${DATA_START_ROW},
  EXPECTED_FILE_HEADERS: ${JSON.stringify(fileHeaders, null, 2)},
  COLUMNS: ${JSON.stringify(dbColumns, null, 2)},
};
`;
fs.writeFileSync(schemaPath, schemaJs);

const colDefs = dbColumns.map(({ dbColumn, fileHeader }) => {
  const q = `\`${dbColumn.replace(/`/g, '')}\``;
  return `  ${q} ${sqlType(dbColumn, fileHeader)}`;
});

const sqlPath = path.join(__dirname, '../../mysql/migrate_dmr_daily_table.sql');
const sql = `-- DMR daily flat table (Sheet1 import — matches DMR_season reference columns)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_dmr_daily_table.sql

CREATE TABLE IF NOT EXISTS \`dmr_daily\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
${colDefs.join(',\n')},
  \`created_at\` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY \`uq_dmr_daily_date\` (\`Date\`),
  INDEX \`idx_dmr_daily_crop_day\` (\`Crop Day\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
`;
fs.writeFileSync(sqlPath, sql);

console.log('Wrote', schemaPath);
console.log('Wrote', sqlPath);
console.log('Columns:', dbColumns.length);
