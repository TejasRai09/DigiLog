const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { pool } = require('../config/mysql');

/** Resolve Excel under backend/backlog-data (works on Windows + Linux staging/prod). */
function resolveDataFile(relOrAbs) {
  if (path.isAbsolute(relOrAbs)) return relOrAbs;
  return path.resolve(__dirname, '..', relOrAbs);
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${label} not found: ${filePath}\n` +
        `Place files under backlog-data/Cane Performance/ or pass --cnt= / --gctc= paths.`
    );
  }
  return filePath;
}

function excelDateToISO(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') {
    const cleanStr = excelDate.trim();
    if (cleanStr.includes('-')) {
      const parts = cleanStr.split('-');
      if (parts[0].length === 4) return parts.slice(0, 3).join('-');
      if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (cleanStr.includes('/')) {
      const parts = cleanStr.split('/');
      // MM/DD/YYYY HH:MM:SS
      const firstPart = parts[0];
      const secondPart = parts[1];
      const thirdPartWithTime = parts[2].split(' ');
      const year = thirdPartWithTime[0];
      if (year.length === 4) {
        return `${year}-${firstPart.padStart(2, '0')}-${secondPart.padStart(2, '0')}`;
      }
    }
    return cleanStr;
  }
  try {
    const dateObj = xlsx.SSF.parse_date_code(excelDate);
    if (!dateObj) return null;
    const y = dateObj.y;
    const m = String(dateObj.m).padStart(2, '0');
    const d = String(dateObj.d).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch (e) {
    return null;
  }
}

function excelDateTimeToISO(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') {
    const cleanStr = excelDate.trim();
    if (cleanStr.includes('/')) {
      const parts = cleanStr.split('/');
      const firstPart = parts[0];
      const secondPart = parts[1];
      const thirdPartWithTime = parts[2].split(' ');
      const year = thirdPartWithTime[0];
      const timeStr = thirdPartWithTime[1] || '00:00:00';
      if (year.length === 4) {
        // MM/DD/YYYY to YYYY-MM-DD
        return `${year}-${firstPart.padStart(2, '0')}-${secondPart.padStart(2, '0')} ${timeStr}`;
      }
    }
    return cleanStr;
  }
  try {
    const dateObj = xlsx.SSF.parse_date_code(excelDate);
    if (!dateObj) return null;
    const y = dateObj.y;
    const m = String(dateObj.m).padStart(2, '0');
    const d = String(dateObj.d).padStart(2, '0');
    const hh = String(dateObj.hh || 0).padStart(2, '0');
    const mm = String(dateObj.mm || 0).padStart(2, '0');
    const ss = String(dateObj.ss || 0).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  } catch (e) {
    return null;
  }
}

function parseVal(val, type) {
  if (val === undefined || val === null || val === '') return null;
  if (type === 'int') {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? null : parsed;
  }
  if (type === 'float') {
    const parsed = parseFloat(val);
    return isNaN(parsed) ? null : parsed;
  }
  if (type === 'str') {
    return String(val).trim();
  }
  return val;
}

function isTransportMode(val) {
  return typeof val === 'string' && /QCART|QTROLLY|QTRUCK/i.test(val);
}

/**
 * G_CTC.xlsx has two layouts under the same headers:
 *  - Normal: v_code=number, SUP_MOD='63 QTROLLY', Purchase_QTL=qty
 *  - Shifted: v_code=center name, purchyno='45 QTROLLY', PUR_ISSUE_DT=qty
 * Bug: isNaN(null)===false, so shifted rows were treated as normal and date serials
 * landed in sup_mod (e.g. '46031').
 */
function isShiftedGctcRow(r) {
  if (isTransportMode(r.purchyno) && !isTransportMode(r.SUP_MOD)) return true;
  if (r.v_code !== null && r.v_code !== undefined && r.v_code !== '' && Number.isNaN(Number(r.v_code))) return true;
  return false;
}

function mapGctcRow(r) {
  if (isShiftedGctcRow(r)) {
    // Columns are offset: mode lives in purchyno, qty in PUR_ISSUE_DT, hours in "Yard Waiting Time"/"Unloading Time"
    return [
      null, // v_code
      parseVal(r['v_name'], 'str'), // village
      null, // g_code
      parseVal(r['g_code'], 'str'), // grower name
      parseVal(r['g_name'], 'str'), // father
      parseVal(r['g_father'], 'int'), // purchyno
      parseVal(r['purchyno'], 'str'), // SUP_MOD e.g. '45 QTROLLY'
      excelDateToISO(r['m_date']),
      excelDateTimeToISO(r['SUP_MOD']), // pur_issue_dt
      excelDateTimeToISO(r['m_date']), // pur_weight_dt
      excelDateTimeToISO(r['CutDate']),
      excelDateTimeToISO(r['KACHATOKENDATETIME']),
      excelDateTimeToISO(r['Grossdatetime']), // Tokendatetime is often junk id in shifted rows
      excelDateTimeToISO(r['Purchase_QTL']), // mill/gross datetime parked in Purchase_QTL col
      excelDateTimeToISO(r['TAREdatetime']),
      parseVal(r['PUR_ISSUE_DT'], 'float'), // actual cane qty
      parseVal(r['Yard Waiting Time'], 'float'), // yard_holding_time (NOT "Yard Holding Time" datetime)
      parseVal(r['CuttoCenterTime'], 'float'),
      parseVal(r['Unloading Time'], 'float'), // hours (NOT UnloadingTime datetime)
      excelDateTimeToISO(r['CentreArr']),
      excelDateTimeToISO(r['Truck @ Yard (GPS Based) (Date/Time)']),
      excelDateToISO(r['Report Date']),
      parseVal(r['Holding Time (Center)'], 'float'),
      parseVal(r['Truck Holding Time @ Center (Minutes)'], 'int'),
      parseVal(r['Truck Transit Time'], 'float'),
      parseVal(r['Yard Waiting Time'], 'float'),
      parseVal(r['Unloading Time'], 'float'),
      parseVal(r['TruckHoldingTime(Center)'], 'float'),
      excelDateToISO(r['Crush Date']),
      parseVal(r['CuttoCenterTime'], 'float'),
      parseVal(r['Mode Code of Transport'], 'int'),
      parseVal(r['Cane Holding Time'], 'float'),
    ];
  }

  return [
    parseVal(r['v_code'], 'int'),
    parseVal(r['v_name'], 'str'),
    parseVal(r['g_code'], 'int'),
    parseVal(r['g_name'], 'str'),
    parseVal(r['g_father'], 'str'),
    parseVal(r['purchyno'], 'int'),
    parseVal(r['SUP_MOD'], 'str'),
    excelDateToISO(r['m_date']),
    excelDateTimeToISO(r['PUR_ISSUE_DT']),
    excelDateTimeToISO(r['PUR_WEIGHT_DT']),
    excelDateTimeToISO(r['CutDate']),
    excelDateTimeToISO(r['KACHATOKENDATETIME']),
    excelDateTimeToISO(r['Tokendatetime']),
    excelDateTimeToISO(r['Grossdatetime']),
    excelDateTimeToISO(r['TAREdatetime']),
    parseVal(r['Purchase_QTL'], 'float'),
    parseVal(r['Yard Holding Time'], 'float'),
    parseVal(r['CuttoTokenTime'], 'float'),
    parseVal(r['UnloadingTime'], 'float'),
    excelDateTimeToISO(r['CentreArr']),
    excelDateTimeToISO(r['Truck @ Yard (GPS Based) (Date/Time)']),
    excelDateToISO(r['Report Date']),
    parseVal(r['Holding Time (Center)'], 'float'),
    parseVal(r['Truck Holding Time @ Center (Minutes)'], 'int'),
    parseVal(r['Truck Transit Time'], 'float'),
    parseVal(r['Yard Waiting Time'], 'float'),
    parseVal(r['Unloading Time'], 'float'),
    parseVal(r['TruckHoldingTime(Center)'], 'float'),
    excelDateToISO(r['Crush Date']),
    parseVal(r['CuttoCenterTime'], 'float'),
    parseVal(r['Mode Code of Transport'], 'int'),
    parseVal(r['Cane Holding Time'], 'float'),
  ];
}

async function runImport() {
  const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || 'all';
  const cntArg = (process.argv.find((a) => a.startsWith('--cnt=')) || '').slice('--cnt='.length);
  const gctcArg = (process.argv.find((a) => a.startsWith('--gctc=')) || '').slice('--gctc='.length);

  const needCnt = only === 'all' || only === 'cnt';
  const needGctc = only === 'all' || only === 'g_ctc';

  const cntPath = needCnt
    ? requireFile(
        resolveDataFile(cntArg || path.join('backlog-data', 'Cane Performance', 'CntPerformance.xlsx')),
        'CntPerformance.xlsx'
      )
    : null;
  const gctcPath = needGctc
    ? requireFile(
        resolveDataFile(gctcArg || path.join('backlog-data', 'Cane Performance', 'G_CTC.xlsx')),
        'G_CTC.xlsx'
      )
    : null;

  console.log(`🚀 Starting Cane Performance Excel Data Import (only=${only})...`);
  if (cntPath) console.log(`   cnt:  ${cntPath}`);
  if (gctcPath) console.log(`   gctc: ${gctcPath}`);
  const conn = await pool.getConnection();

  try {
    // 1. Create cnt_performance table
    if (only === 'all' || only === 'cnt') {
    console.log('Creating cnt_performance table in MySQL...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`cnt_performance\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`center\` VARCHAR(150) NULL,
        \`v_name\` VARCHAR(150) NULL,
        \`grower\` VARCHAR(150) NULL,
        \`g_father\` VARCHAR(150) NULL,
        \`purchy_no\` BIGINT NULL,
        \`transport_mode\` VARCHAR(100) NULL,
        \`purchy_issue_date\` DATE NULL,
        \`weighment_date_purchy\` DATE NULL,
        \`cane_qty_qtls\` DECIMAL(12,2) NULL,
        \`harvest_date\` DATE NULL,
        \`gross_weighment_centre\` DATETIME NULL,
        \`tare_weighment_centre\` DATETIME NULL,
        \`challan_no\` BIGINT NULL,
        \`challan_issue_time\` DATETIME NULL,
        \`vehicle_arrival_center\` DATETIME NULL,
        \`truck_yard_token_time\` DATETIME NULL,
        \`truck_yard_kaccha_token\` DATETIME NULL,
        \`gate_weighment_time\` DATETIME NULL,
        \`tare_weighment_mill\` DATETIME NULL,
        \`centre_arr\` DATETIME NULL,
        \`truck_yard_gps_based\` DATETIME NULL,
        \`report_date\` DATE NULL,
        \`holding_time_center\` DECIMAL(10,4) NULL,
        \`truck_holding_time_center_minutes\` INT NULL,
        \`truck_transit_time\` DECIMAL(10,4) NULL,
        \`yard_waiting_time\` DECIMAL(10,4) NULL,
        \`unloading_time\` DECIMAL(10,4) NULL,
        \`truck_holding_time_center\` DECIMAL(10,4) NULL,
        \`crush_date\` DATE NULL,
        \`cut_to_center_time\` DECIMAL(10,4) NULL,
        \`mode_code_of_transport\` INT NULL,
        \`cane_holding_time\` DECIMAL(10,4) NULL,
        INDEX idx_center (\`center\`),
        INDEX idx_weighment_date_purchy (\`weighment_date_purchy\`),
        INDEX idx_challan_no (\`challan_no\`),
        INDEX idx_purchy_no (\`purchy_no\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    } // end cnt create

    // 2. Create g_ctc table
    console.log('Creating g_ctc table in MySQL...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS \`g_ctc\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`v_code\` INT NULL,
        \`v_name\` VARCHAR(150) NULL,
        \`g_code\` INT NULL,
        \`g_name\` VARCHAR(150) NULL,
        \`g_father\` VARCHAR(150) NULL,
        \`purchyno\` BIGINT NULL,
        \`sup_mod\` VARCHAR(100) NULL,
        \`m_date\` DATE NULL,
        \`pur_issue_dt\` DATETIME NULL,
        \`pur_weight_dt\` DATETIME NULL,
        \`cut_date\` DATETIME NULL,
        \`kacha_token_datetime\` DATETIME NULL,
        \`token_datetime\` DATETIME NULL,
        \`gross_datetime\` DATETIME NULL,
        \`tare_datetime\` DATETIME NULL,
        \`purchase_qtl\` DECIMAL(12,2) NULL,
        \`yard_holding_time\` DECIMAL(10,4) NULL,
        \`cut_to_token_time\` DECIMAL(10,4) NULL,
        \`unloading_time\` DECIMAL(10,4) NULL,
        \`centre_arr\` DATETIME NULL,
        \`truck_yard_gps_based\` DATETIME NULL,
        \`report_date\` DATE NULL,
        \`holding_time_center\` DECIMAL(10,4) NULL,
        \`truck_holding_time_center_minutes\` INT NULL,
        \`truck_transit_time\` DECIMAL(10,4) NULL,
        \`yard_waiting_time\` DECIMAL(10,4) NULL,
        \`unloading_time_2\` DECIMAL(10,4) NULL,
        \`truck_holding_time_center\` DECIMAL(10,4) NULL,
        \`crush_date\` DATE NULL,
        \`cut_to_center_time\` DECIMAL(10,4) NULL,
        \`mode_code_of_transport\` INT NULL,
        \`cane_holding_time\` DECIMAL(10,4) NULL,
        INDEX idx_v_name (\`v_name\`),
        INDEX idx_m_date (\`m_date\`),
        INDEX idx_purchyno (\`purchyno\`),
        INDEX idx_sup_mod (\`sup_mod\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Truncate tables for fresh import
    if (only === 'all' || only === 'cnt') await conn.query('TRUNCATE TABLE `cnt_performance`');
    if (only === 'all' || only === 'g_ctc') await conn.query('TRUNCATE TABLE `g_ctc`');
    console.log('✅ Tables cleared/prepared.');

    const batchSize = 2500;

    // 3. Import CntPerformance.xlsx
    if (only === 'all' || only === 'cnt') {
    console.log('📄 Reading CntPerformance.xlsx...');
    const cntWb = xlsx.readFile(cntPath);
    const cntRows = xlsx.utils.sheet_to_json(cntWb.Sheets[cntWb.SheetNames[0]]);
    console.log(`Processing ${cntRows.length} CntPerformance rows...`);

    let cntValues = [];
    for (let i = 0; i < cntRows.length; i++) {
      const r = cntRows[i];
      cntValues.push([
        parseVal(r['Center'], 'str'),
        parseVal(r['V.Name'], 'str'),
        parseVal(r['Grower'], 'str'),
        parseVal(r['G.Father'], 'str'),
        parseVal(r['Purchy No.'], 'int'),
        parseVal(r['Transport Mode'], 'str'),
        excelDateToISO(r['Purchy Issue Date']),
        excelDateToISO(r['Weighment Date (Purchy)']),
        parseVal(r['Cane Qty (Qtls)'], 'float'),
        excelDateToISO(r['Harvest Date']),
        excelDateTimeToISO(r['Gross Weighment @ Centre (Grower) (Date/Time)']),
        excelDateTimeToISO(r['Tare Weighment @ Centre']),
        parseVal(r['Challan No.'], 'int'),
        excelDateTimeToISO(r['Challan Issue Time']),
        excelDateTimeToISO(r['Vehicle Arrival @ Center']),
        excelDateTimeToISO(r['Truck @ Yard (Token Time)']),
        excelDateTimeToISO(r['Truck @ Yard (Kaccha Token)']),
        excelDateTimeToISO(r['Gate Weighment Time']),
        excelDateTimeToISO(r['Tare Weighment @ Mill']),
        excelDateTimeToISO(r['CentreArr']),
        excelDateTimeToISO(r['Truck @ Yard (GPS Based) (Date/Time)']),
        excelDateToISO(r['Report Date']),
        parseVal(r['Holding Time (Center)'], 'float'),
        parseVal(r['Truck Holding Time @ Center (Minutes)'], 'int'),
        parseVal(r['Truck Transit Time'], 'float'),
        parseVal(r['Yard Waiting Time'], 'float'),
        parseVal(r['Unloading Time'], 'float'),
        parseVal(r['TruckHoldingTime(Center)'], 'float'),
        excelDateToISO(r['Crush Date']),
        parseVal(r['CuttoCenterTime'], 'float'),
        parseVal(r['Mode Code of Transport'], 'int'),
        parseVal(r['Cane Holding Time'], 'float'),
      ]);

      if (cntValues.length >= batchSize || i === cntRows.length - 1) {
        await conn.query(
          `INSERT INTO \`cnt_performance\` 
          (center, v_name, grower, g_father, purchy_no, transport_mode, purchy_issue_date, weighment_date_purchy, cane_qty_qtls, harvest_date, gross_weighment_centre, tare_weighment_centre, challan_no, challan_issue_time, vehicle_arrival_center, truck_yard_token_time, truck_yard_kaccha_token, gate_weighment_time, tare_weighment_mill, centre_arr, truck_yard_gps_based, report_date, holding_time_center, truck_holding_time_center_minutes, truck_transit_time, yard_waiting_time, unloading_time, truck_holding_time_center, crush_date, cut_to_center_time, mode_code_of_transport, cane_holding_time)
          VALUES ?`,
          [cntValues]
        );
        cntValues = [];
        if (i % 50000 === 0 || i === cntRows.length - 1) {
          console.log(`  Processed ${i} / ${cntRows.length} cnt_performance rows`);
        }
      }
    }
    console.log(`✅ Successfully imported ${cntRows.length} rows into cnt_performance.`);
    }

    // 4. Import G_CTC.xlsx
    if (only === 'all' || only === 'g_ctc') {
    console.log('📄 Reading G_CTC.xlsx...');
    const gWb = xlsx.readFile(gctcPath);
    const gRows = xlsx.utils.sheet_to_json(gWb.Sheets[gWb.SheetNames[0]]);
    console.log(`Processing ${gRows.length} G_CTC rows...`);

    let shiftedCount = 0;
    let normalCount = 0;
    let gValues = [];
    for (let i = 0; i < gRows.length; i++) {
      const r = gRows[i];
      if (isShiftedGctcRow(r)) shiftedCount++;
      else normalCount++;
      gValues.push(mapGctcRow(r));

      if (gValues.length >= batchSize || i === gRows.length - 1) {
        await conn.query(
          `INSERT INTO \`g_ctc\` 
          (v_code, v_name, g_code, g_name, g_father, purchyno, sup_mod, m_date, pur_issue_dt, pur_weight_dt, cut_date, kacha_token_datetime, token_datetime, gross_datetime, tare_datetime, purchase_qtl, yard_holding_time, cut_to_token_time, unloading_time, centre_arr, truck_yard_gps_based, report_date, holding_time_center, truck_holding_time_center_minutes, truck_transit_time, yard_waiting_time, unloading_time_2, truck_holding_time_center, crush_date, cut_to_center_time, mode_code_of_transport, cane_holding_time)
          VALUES ?`,
          [gValues]
        );
        gValues = [];
        if (i % 50000 === 0 || i === gRows.length - 1) {
          console.log(`  Processed ${i} / ${gRows.length} g_ctc rows`);
        }
      }
    }
    console.log(`✅ Successfully imported ${gRows.length} rows into g_ctc (normal=${normalCount}, shifted=${shiftedCount}).`);

    const [modeCheck] = await conn.query(`
      SELECT IFNULL(sup_mod,'NULL') as mode, COUNT(*) as cnt
      FROM g_ctc GROUP BY sup_mod ORDER BY cnt DESC LIMIT 15
    `);
    console.log('sup_mod distribution after import:');
    console.table(modeCheck);
    }

    console.log('🎉 ALL IMPORTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Import Error:', err);
  } finally {
    conn.release();
    process.exit(0);
  }
}

runImport();
