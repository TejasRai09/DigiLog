const xlsx = require('xlsx');
const { pool } = require('../config/mysql');

function excelDateToISO(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') {
    // If already in DD-MM-YYYY or YYYY-MM-DD string
    if (excelDate.includes('-')) {
      const parts = excelDate.split('-');
      if (parts[0].length === 4) return excelDate; // YYYY-MM-DD
      if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`; // DD-MM-YYYY -> YYYY-MM-DD
    }
    return excelDate;
  }
  // Serial date number
  const dateObj = xlsx.SSF.parse_date_code(excelDate);
  if (!dateObj) return null;
  const y = dateObj.y;
  const m = String(dateObj.m).padStart(2, '0');
  const d = String(dateObj.d).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function runImport() {
  console.log('🚀 Starting Centre Maturity & Purchase Data Import...');
  const conn = await pool.getConnection();

  try {
    // 1. Create tables
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`centre_indent_data\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`code\` VARCHAR(50),
        \`center_name\` VARCHAR(150),
        \`indent_date\` DATE,
        \`no_of_purchy\` INT,
        \`indent_qty\` DECIMAL(12,2),
        \`category\` VARCHAR(50),
        \`unique_id\` VARCHAR(100),
        \`bonding_id\` VARCHAR(100),
        \`season_label\` VARCHAR(50),
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_center_name (\`center_name\`),
        INDEX idx_indent_date (\`indent_date\`),
        INDEX idx_season_label (\`season_label\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`centre_purchase_data\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`code\` VARCHAR(50),
        \`center_name\` VARCHAR(150),
        \`purchase_date\` DATE,
        \`indent_date\` DATE,
        \`no_of_purchy\` INT,
        \`purchase_qty\` DECIMAL(12,2),
        \`category\` VARCHAR(50),
        \`unique_id\` VARCHAR(100),
        \`season_label\` VARCHAR(50),
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_center_name (\`center_name\`),
        INDEX idx_purchase_date (\`purchase_date\`),
        INDEX idx_season_label (\`season_label\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Truncate tables for fresh import
    await conn.query('TRUNCATE TABLE `centre_indent_data`');
    await conn.query('TRUNCATE TABLE `centre_purchase_data`');
    console.log('✅ MySQL tables created & cleared.');

    // 2. Import indent1.xlsx
    console.log('📄 Reading indent1.xlsx...');
    const indWb = xlsx.readFile('c:/vivek/PLANT/DigiLog/backend/backlog-data/Center maturity/indent1.xlsx');
    const indRows = xlsx.utils.sheet_to_json(indWb.Sheets[indWb.SheetNames[0]]);
    console.log(`Processing ${indRows.length} indent rows...`);

    const indBatchSize = 1000;
    let indValues = [];

    for (let i = 0; i < indRows.length; i++) {
      const r = indRows[i];
      indValues.push([
        r['Code'] ? String(r['Code']).trim() : null,
        r['Center Name'] ? String(r['Center Name']).trim() : null,
        excelDateToISO(r['Indent Date']),
        r['No of Purchy'] ? parseInt(r['No of Purchy'], 10) : 0,
        r['Indent Qty'] ? parseFloat(r['Indent Qty']) : 0,
        r['Category'] ? String(r['Category']).trim() : null,
        r['Unique ID'] ? String(r['Unique ID']).trim() : null,
        r['Bonding Id'] ? String(r['Bonding Id']).trim() : null,
        r['SeasonLabelIndent'] ? String(r['SeasonLabelIndent']).trim() : null,
      ]);

      if (indValues.length >= indBatchSize || i === indRows.length - 1) {
        await conn.query(
          `INSERT INTO \`centre_indent_data\` 
          (code, center_name, indent_date, no_of_purchy, indent_qty, category, unique_id, bonding_id, season_label) 
          VALUES ?`,
          [indValues]
        );
        indValues = [];
      }
    }
    console.log(`✅ Successfully imported ${indRows.length} rows into centre_indent_data.`);

    // 3. Import purchase2.xlsx
    console.log('📄 Reading purchase2.xlsx...');
    const purWb = xlsx.readFile('c:/vivek/PLANT/DigiLog/backend/backlog-data/Center maturity/purchase2.xlsx');
    const purRows = xlsx.utils.sheet_to_json(purWb.Sheets[purWb.SheetNames[0]]);
    console.log(`Processing ${purRows.length} purchase rows...`);

    let purValues = [];
    const purBatchSize = 1000;

    for (let i = 0; i < purRows.length; i++) {
      const r = purRows[i];
      purValues.push([
        r['c_Code'] ? String(r['c_Code']).trim() : null,
        r['Center'] ? String(r['Center']).trim() : null,
        excelDateToISO(r['Purchase Date']),
        excelDateToISO(r['Indent Date']),
        r['No of Purchy'] ? parseInt(r['No of Purchy'], 10) : 0,
        r['Purchase Qty'] ? parseFloat(r['Purchase Qty']) : 0,
        r['Category'] ? String(r['Category']).trim() : null,
        r['Unique ID'] ? String(r['Unique ID']).trim() : null,
        r['SeasonLabelPurchase'] ? String(r['SeasonLabelPurchase']).trim() : null,
      ]);

      if (purValues.length >= purBatchSize || i === purRows.length - 1) {
        await conn.query(
          `INSERT INTO \`centre_purchase_data\` 
          (code, center_name, purchase_date, indent_date, no_of_purchy, purchase_qty, category, unique_id, season_label) 
          VALUES ?`,
          [purValues]
        );
        purValues = [];
      }
    }
    console.log(`✅ Successfully imported ${purRows.length} rows into centre_purchase_data.`);

    console.log('🎉  ALL IMPORTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌  Import Error:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

runImport();
