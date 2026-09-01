/**
 * Import Brix yard + field Excel into MySQL.
 *
 * Creates tables if missing, then truncates and reloads.
 *
 *   node scripts/import-brix-forms.js
 *   node scripts/import-brix-forms.js --yard=/path/yard.xlsx --field=/path/field.xlsx
 *
 * Default files (under backend/backlog-data/Brix sampling/):
 *   GSMA Yard*Brix Sampling Form 23-24(1-5000).xlsx
 *   GSMA Field*Brix Sampling Form 23-24.xlsx
 * (filenames may contain a non-breaking space before "Brix")
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const db = require('../config/mysql');

const BRIX_DIR = path.join(__dirname, '..', 'backlog-data', 'Brix sampling');

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

function resolveDataFile(relOrAbs) {
  if (!relOrAbs) return null;
  if (path.isAbsolute(relOrAbs)) return relOrAbs;
  return path.resolve(__dirname, '..', relOrAbs);
}

/** Match Yard/Field workbooks even when filename uses NBSP (\u00A0). */
function findDefaultBrixFile(kind) {
  if (!fs.existsSync(BRIX_DIR)) {
    throw new Error(`Brix folder not found: ${BRIX_DIR}`);
  }
  const files = fs.readdirSync(BRIX_DIR);
  const norm = (s) => String(s).toLowerCase().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  const needle =
    kind === 'yard'
      ? 'gsma yard brix sampling form 23-24(1-5000).xlsx'
      : 'gsma field brix sampling form 23-24.xlsx';
  const hit = files.find((f) => norm(f) === needle) || files.find((f) => norm(f).includes(kind === 'yard' ? 'yard brix' : 'field brix'));
  if (!hit) {
    throw new Error(
      `No ${kind} Brix Excel in ${BRIX_DIR}. Found: ${files.join(', ') || '(empty)'}`
    );
  }
  return path.join(BRIX_DIR, hit);
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} not found: ${filePath}`);
  }
  return filePath;
}

/** Calendar date in IST (Asia/Kolkata) — never UTC day from toISOString(). */
function parseDate(val) {
  if (val == null || val === '') return null;

  let d;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === 'number' && Number.isFinite(val)) {
    d = new Date(Date.UTC(1899, 11, 30) + Math.round(val) * 86400000);
  } else {
    d = new Date(val);
  }
  if (Number.isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function truncateStr(val, length) {
  if (val == null || val === '') return null;
  return String(val).substring(0, length);
}

async function ensureTables() {
  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS \`brix_yard_sampling\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`Date\` DATE,
      \`Name\` VARCHAR(100),
      \`DeliveryPoint\` VARCHAR(50),
      \`VillageOrCenterCode\` VARCHAR(50),
      \`GrowerCode\` VARCHAR(50),
      \`TruckNumber\` VARCHAR(50),
      \`VehicleType\` VARCHAR(50),
      \`VarietyOfCane\` VARCHAR(100),
      \`CropType\` VARCHAR(50),
      \`MiddleBrix\` DECIMAL(5,2),
      \`DiseasedCane\` VARCHAR(10),
      \`StaleCane\` VARCHAR(10),
      \`ConsignmentConditions\` VARCHAR(50),
      \`timestamp\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await db.pool.query(`
    CREATE TABLE IF NOT EXISTS \`brix_field_sampling\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`Date\` DATE,
      \`Name\` VARCHAR(100),
      \`TestType\` VARCHAR(50),
      \`GrowerName\` VARCHAR(150),
      \`VillageName\` VARCHAR(100),
      \`Variety\` VARCHAR(100),
      \`LandType\` VARCHAR(50),
      \`SoilType\` VARCHAR(50),
      \`CropType\` VARCHAR(50),
      \`FieldCondition\` VARCHAR(50),
      \`CropCondition\` VARCHAR(50),
      \`SamplingPoint\` VARCHAR(50),
      \`BottomBrix\` DECIMAL(5,2),
      \`MiddleBrix\` DECIMAL(5,2),
      \`TopBrix\` DECIMAL(5,2),
      \`timestamp\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function importYard(yardFile) {
  console.log(`Reading Yard file: ${yardFile}`);
  const wb = xlsx.readFile(yardFile, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  const batchSize = 500;
  let batch = [];
  let count = 0;

  const sql = `INSERT INTO brix_yard_sampling
    (Date, Name, DeliveryPoint, VillageOrCenterCode, GrowerCode, TruckNumber, VehicleType, VarietyOfCane, CropType, MiddleBrix, DiseasedCane, StaleCane, ConsignmentConditions, timestamp)
    VALUES ?`;

  for (const row of data) {
    const ts = row['Completion time'] ? new Date(row['Completion time']) : new Date();
    batch.push([
      parseDate(row['Sampling Date']),
      truncateStr(row['Name:'], 100),
      truncateStr(row['Select Delivery Point (Gate Cane or Center Cane)'], 50),
      truncateStr(row['Enter Village Code (for Gate Cane) or Center Code (for Center Cane)'], 50),
      truncateStr(row['If it is Gate Cane, please enter the Grower Code:'], 50),
      truncateStr(row['If it is Center Cane, please enter truck number (example: UP31AT9184)'], 50),
      truncateStr(row['Please select the vehicle type:'], 50),
      truncateStr(row['Variety of Cane:'], 100),
      truncateStr(row['Crop Type:'], 50),
      parseFloat(row['Middle Brix %']) || null,
      truncateStr(row['Diseased Cane:'], 10),
      truncateStr(row['Stale Cane'], 10),
      truncateStr(row['Consignment Condition:'], 50),
      ts,
    ]);
    if (batch.length >= batchSize) {
      await db.pool.query(sql, [batch]);
      count += batch.length;
      batch = [];
      console.log(`Inserted ${count} yard samples...`);
    }
  }
  if (batch.length) {
    await db.pool.query(sql, [batch]);
    count += batch.length;
  }
  console.log(`Successfully imported ${count} yard samples.`);
}

async function importField(fieldFile) {
  console.log(`Reading Field file: ${fieldFile}`);
  const wb = xlsx.readFile(fieldFile, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  const batchSize = 500;
  let batch = [];
  let count = 0;

  const sql = `INSERT INTO brix_field_sampling
    (Date, Name, TestType, GrowerName, VillageName, Variety, LandType, SoilType, CropType, FieldCondition, CropCondition, SamplingPoint, BottomBrix, MiddleBrix, TopBrix, timestamp)
    VALUES ?`;

  for (const row of data) {
    const ts = row['Completion time'] ? new Date(row['Completion time']) : new Date();
    batch.push([
      parseDate(row['Date of Sampling']),
      truncateStr(row['Name:'], 100),
      truncateStr(row['Test Type'], 50),
      truncateStr(row['Enter Name of the Grower'], 150),
      truncateStr(row['Village Name'], 100),
      truncateStr(row['Variety of Cane'], 100),
      truncateStr(row['Land Type'], 50),
      truncateStr(row['Soil Type'], 50),
      truncateStr(row['Crop Type'], 50),
      truncateStr(row['Field Condition'], 50),
      truncateStr(row['Crop Condition'], 50),
      truncateStr(row['Choose Sampling Point:'], 50),
      parseFloat(row['Bottom Brix %']) || null,
      parseFloat(row['Middle Brix %']) || null,
      parseFloat(row['Top Brix %']) || null,
      ts,
    ]);
    if (batch.length >= batchSize) {
      await db.pool.query(sql, [batch]);
      count += batch.length;
      batch = [];
      console.log(`Inserted ${count} field samples...`);
    }
  }
  if (batch.length) {
    await db.pool.query(sql, [batch]);
    count += batch.length;
  }
  console.log(`Successfully imported ${count} field samples.`);
}

async function run() {
  try {
    const yardFile = requireFile(
      resolveDataFile(argValue('--yard=')) || findDefaultBrixFile('yard'),
      'Yard Brix Excel'
    );
    const fieldFile = requireFile(
      resolveDataFile(argValue('--field=')) || findDefaultBrixFile('field'),
      'Field Brix Excel'
    );

    console.log('Ensuring brix tables exist...');
    await ensureTables();

    await db.pool.query('TRUNCATE TABLE brix_yard_sampling');
    await db.pool.query('TRUNCATE TABLE brix_field_sampling');
    console.log('Truncated existing tables');

    await importYard(yardFile);
    await importField(fieldFile);
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}

run();
