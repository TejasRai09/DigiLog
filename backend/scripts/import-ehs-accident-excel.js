/**
 * Import EHS Accident Data into the `ehs_accident` table.
 *
 * Usage:
 *   cd backend
 *   node scripts/import-ehs-accident-excel.js --file "backlog-data/ehs data/accident 21-25.xlsx"
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const xlsx = require('xlsx');

const { pool } = require('../config/mysql');

function parseArgs(argv) {
  const opts = { file: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--file') opts.file = argv[++i];
  }
  return opts;
}

function safeStr(val, maxLen) {
  if (val === null || val === undefined) return null;
  let s = String(val).trim();
  if (s === '' || s.toLowerCase() === 'nil' || s.toLowerCase() === 'none') {
    return null;
  }
  return maxLen ? s.substring(0, maxLen) : s;
}

async function main() {
  const opts = parseArgs(process.argv);
  
  if (!opts.file) {
    console.error('Usage: node scripts/import-ehs-accident-excel.js --file <excel_file.xlsx>');
    process.exit(1);
  }

  const filePath = path.resolve(opts.file);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Loading EHS Accident data from: ${filePath}`);
  
  // cellDates converts numeric Excel dates into JavaScript Date objects automatically
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // header: 1 returns 2D array of rows
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

  let insertedCount = 0;

  console.log('Importing records...');
  
  for (let i = 2; i < rows.length; i++) { // Skip header rows (index 0 and 1)
    const row = rows[i];
    if (!row || row.length === 0) continue;
    
    // Columns: SR, Date, Time, Injured Person, Dept, Location, Type, Description
    const sr = row[0];
    const dateVal = row[1];
    const timeVal = row[2];
    const person = row[3];
    const dept = row[4];
    const loc = row[5];
    const typ = row[6];
    const desc = row[7];

    if (!sr || !person) continue;

    let parsedDate = null;
    
    if (dateVal instanceof Date) {
      const p = new Date(dateVal.getTime() - dateVal.getTimezoneOffset() * 60000);
      parsedDate = p.toISOString().split('T')[0];
    } else if (typeof dateVal === 'string') {
      const dstr = dateVal.trim();
      const format1 = dstr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (format1) {
        parsedDate = `${format1[3]}-${format1[2]}-${format1[1]}`;
      } else {
        const format2 = dstr.match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
        if (format2) {
          parsedDate = `20${format2[3]}-${format2[2]}-${format2[1]}`;
        } else {
          parsedDate = dstr;
        }
      }
    }

    try {
      await pool.query(
        `INSERT INTO ehs_near_miss 
         (Date, Time, name, department, location, severity, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          parsedDate,
          safeStr(timeVal, 20),
          safeStr(person, 255),
          safeStr(dept, 255),
          safeStr(loc, 255),
          'Minor Harm', // Fallback for required severity column
          (typ ? `Type: ${typ}\n` : '') + (desc ? safeStr(desc, 1000) : '')
        ]
      );
      insertedCount++;
    } catch (err) {
      console.error(`Failed to insert row ${i + 1}: ${err.message}`);
    }
  }

  console.log(`✅ Inserted ${insertedCount} accident records successfully.`);
  await pool.end();
}

main().catch((err) => {
  console.error(`Failed to complete import:`, err.message);
  process.exit(1);
});
