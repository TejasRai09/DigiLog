const xlsx = require('xlsx');
const db = require('../config/mysql');

const yardFile = 'c:\\vivek\\PLANT\\DigiLog\\backend\\backlog-data\\Brix sampling\\GSMA Yard Brix Sampling Form 23-24(1-5000).xlsx';
const fieldFile = 'c:\\vivek\\PLANT\\DigiLog\\backend\\backlog-data\\Brix sampling\\GSMA Field Brix Sampling Form 23-24.xlsx';

/** Calendar date in IST (Asia/Kolkata) — never UTC day from toISOString(). */
function parseDate(val) {
  if (val == null || val === '') return null;

  let d;
  if (val instanceof Date) {
    d = val;
  } else if (typeof val === 'number' && Number.isFinite(val)) {
    // Excel serial (days since 1899-12-30), interpret as UTC midnight then take IST calendar day
    d = new Date(Date.UTC(1899, 11, 30) + Math.round(val) * 86400000);
  } else {
    d = new Date(val);
  }
  if (isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function truncateStr(val, length) {
  if (!val) return null;
  return String(val).substring(0, length);
}

async function importYard() {
  console.log('Reading Yard file...');
  const wb = xlsx.readFile(yardFile, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  let count = 0;
  
  for (const row of data) {
    const DateVal = parseDate(row['Sampling Date']);
    const Name = truncateStr(row['Name:'], 100);
    const DeliveryPoint = truncateStr(row['Select Delivery Point (Gate Cane or Center Cane)'], 50);
    const VillageOrCenterCode = truncateStr(row['Enter Village Code (for Gate Cane) or Center Code (for Center Cane)'], 50);
    const GrowerCode = truncateStr(row['If it is Gate Cane, please enter the Grower Code:'], 50);
    const TruckNumber = truncateStr(row['If it is Center Cane, please enter truck number (example: UP31AT9184)'], 50);
    const VehicleType = truncateStr(row['Please select the vehicle type:'], 50);
    const VarietyOfCane = truncateStr(row['Variety of Cane:'], 100);
    const CropType = truncateStr(row['Crop Type:'], 50);
    const MiddleBrix = parseFloat(row['Middle Brix %']) || null;
    const DiseasedCane = truncateStr(row['Diseased Cane:'], 10);
    const StaleCane = truncateStr(row['Stale Cane'], 10);
    const ConsignmentConditions = truncateStr(row['Consignment Condition:'], 50);
    
    // timestamp
    let ts = row['Completion time'] ? new Date(row['Completion time']) : new Date();
    
    await db.pool.query(`INSERT INTO brix_yard_sampling 
      (Date, Name, DeliveryPoint, VillageOrCenterCode, GrowerCode, TruckNumber, VehicleType, VarietyOfCane, CropType, MiddleBrix, DiseasedCane, StaleCane, ConsignmentConditions, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [DateVal, Name, DeliveryPoint, VillageOrCenterCode, GrowerCode, TruckNumber, VehicleType, VarietyOfCane, CropType, MiddleBrix, DiseasedCane, StaleCane, ConsignmentConditions, ts]
    );
    count++;
    if (count % 1000 === 0) console.log(`Inserted ${count} yard samples...`);
  }
  console.log(`Successfully imported ${count} yard samples.`);
}

async function importField() {
  console.log('Reading Field file...');
  const wb = xlsx.readFile(fieldFile, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet);
  let count = 0;

  for (const row of data) {
    const DateVal = parseDate(row['Date of Sampling']);
    const Name = truncateStr(row['Name:'], 100);
    const TestType = truncateStr(row['Test Type'], 50);
    const GrowerName = truncateStr(row['Enter Name of the Grower'], 150);
    const VillageName = truncateStr(row['Village Name'], 100);
    const Variety = truncateStr(row['Variety of Cane'], 100);
    const LandType = truncateStr(row['Land Type'], 50);
    const SoilType = truncateStr(row['Soil Type'], 50);
    const CropType = truncateStr(row['Crop Type'], 50);
    const FieldCondition = truncateStr(row['Field Condition'], 50);
    const CropCondition = truncateStr(row['Crop Condition'], 50);
    const SamplingPoint = truncateStr(row['Choose Sampling Point:'], 50);
    const BottomBrix = parseFloat(row['Bottom Brix %']) || null;
    const MiddleBrix = parseFloat(row['Middle Brix %']) || null;
    const TopBrix = parseFloat(row['Top Brix %']) || null;

    let ts = row['Completion time'] ? new Date(row['Completion time']) : new Date();

    await db.pool.query(`INSERT INTO brix_field_sampling
      (Date, Name, TestType, GrowerName, VillageName, Variety, LandType, SoilType, CropType, FieldCondition, CropCondition, SamplingPoint, BottomBrix, MiddleBrix, TopBrix, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [DateVal, Name, TestType, GrowerName, VillageName, Variety, LandType, SoilType, CropType, FieldCondition, CropCondition, SamplingPoint, BottomBrix, MiddleBrix, TopBrix, ts]
    );
    count++;
    if (count % 1000 === 0) console.log(`Inserted ${count} field samples...`);
  }
  console.log(`Successfully imported ${count} field samples.`);
}

async function run() {
  try {
    await db.pool.query('TRUNCATE TABLE brix_yard_sampling');
    await db.pool.query('TRUNCATE TABLE brix_field_sampling');
    console.log('Truncated existing tables');
    
    await importYard();
    await importField();
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}

run();
