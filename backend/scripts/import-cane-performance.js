/**
 * Cane Performance Excel → MySQL (cnt_performance + g_ctc)
 *
 * Low-RAM (Lightsail 2GB): streams sheets with ExcelJS — does NOT load whole workbook
 * into memory like the old xlsx.readFile + sheet_to_json path.
 *
 *   npm run db:import-cane-performance
 *   npm run db:import-cane-performance -- --only=cnt
 *   npm run db:import-cane-performance -- --only=g_ctc
 *   npm run db:import-cane-performance -- --batch=300
 *   npm run db:import-cane-performance -- --cnt=/path/CntPerformance.xlsx --gctc=/path/G_CTC.xlsx
 *
 * Tips on 2GB RAM:
 *   1) Import one file at a time (--only=cnt then --only=g_ctc)
 *   2) Prefer --batch=300 (default)
 *   3) Do NOT use --max-old-space-size=4096 (larger than RAM → swap death)
 */

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { pool } = require('../config/mysql');

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

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : '';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatDateParts(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function formatDateTimeParts(y, m, d, hh, mm, ss) {
  return `${formatDateParts(y, m, d)} ${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

/** ExcelJS / Date / serial / string → YYYY-MM-DD */
function excelDateToISO(val) {
  if (val == null || val === '') return null;

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return formatDateParts(val.getUTCFullYear(), val.getUTCMonth() + 1, val.getUTCDate());
  }

  if (typeof val === 'number' && Number.isFinite(val)) {
    // Excel serial (days since 1899-12-30)
    const ms = Date.UTC(1899, 11, 30) + Math.round(val) * 86400000;
    const d = new Date(ms);
    return formatDateParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  if (typeof val === 'string') {
    const cleanStr = val.trim();
    if (cleanStr.includes('-')) {
      const parts = cleanStr.split('-');
      if (parts[0].length === 4) return parts.slice(0, 3).join('-');
      if (parts[2] && parts[2].length >= 4) {
        const y = parts[2].slice(0, 4);
        return `${y}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    if (cleanStr.includes('/')) {
      const parts = cleanStr.split('/');
      const thirdPartWithTime = String(parts[2] || '').split(' ');
      const year = thirdPartWithTime[0];
      if (year && year.length === 4) {
        return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
      }
    }
    return cleanStr;
  }

  return null;
}

/** ExcelJS / Date / serial / string → YYYY-MM-DD HH:MM:SS */
function excelDateTimeToISO(val) {
  if (val == null || val === '') return null;

  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return formatDateTimeParts(
      val.getUTCFullYear(),
      val.getUTCMonth() + 1,
      val.getUTCDate(),
      val.getUTCHours(),
      val.getUTCMinutes(),
      val.getUTCSeconds()
    );
  }

  if (typeof val === 'number' && Number.isFinite(val)) {
    const ms = Date.UTC(1899, 11, 30) + val * 86400000;
    const d = new Date(ms);
    return formatDateTimeParts(
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds()
    );
  }

  if (typeof val === 'string') {
    const cleanStr = val.trim();
    if (cleanStr.includes('/')) {
      const parts = cleanStr.split('/');
      const thirdPartWithTime = String(parts[2] || '').split(' ');
      const year = thirdPartWithTime[0];
      const timeStr = thirdPartWithTime[1] || '00:00:00';
      if (year && year.length === 4) {
        return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')} ${timeStr}`;
      }
    }
    return cleanStr;
  }

  return null;
}

function parseVal(val, type) {
  if (val === undefined || val === null || val === '') return null;
  if (type === 'int') {
    const parsed = parseInt(val, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (type === 'float') {
    const parsed = parseFloat(val);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (type === 'str') {
    return String(val).trim();
  }
  return val;
}

function isTransportMode(val) {
  return typeof val === 'string' && /QCART|QTROLLY|QTRUCK/i.test(val);
}

function isShiftedGctcRow(r) {
  if (isTransportMode(r.purchyno) && !isTransportMode(r.SUP_MOD)) return true;
  if (r.v_code !== null && r.v_code !== undefined && r.v_code !== '' && Number.isNaN(Number(r.v_code))) return true;
  return false;
}

function mapGctcRow(r) {
  if (isShiftedGctcRow(r)) {
    return [
      null,
      parseVal(r['v_name'], 'str'),
      null,
      parseVal(r['g_code'], 'str'),
      parseVal(r['g_name'], 'str'),
      parseVal(r['g_father'], 'int'),
      parseVal(r['purchyno'], 'str'),
      excelDateToISO(r['m_date']),
      excelDateTimeToISO(r['SUP_MOD']),
      excelDateTimeToISO(r['m_date']),
      excelDateTimeToISO(r['CutDate']),
      excelDateTimeToISO(r['KACHATOKENDATETIME']),
      excelDateTimeToISO(r['Grossdatetime']),
      excelDateTimeToISO(r['Purchase_QTL']),
      excelDateTimeToISO(r['TAREdatetime']),
      parseVal(r['PUR_ISSUE_DT'], 'float'),
      parseVal(r['Yard Waiting Time'], 'float'),
      parseVal(r['CuttoCenterTime'], 'float'),
      parseVal(r['Unloading Time'], 'float'),
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

function mapCntRow(r) {
  return [
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
  ];
}

function normalizeCell(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.result != null) return normalizeCell(v.result);
    if (typeof v.text === 'string') return v.text;
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
  }
  return v;
}

/**
 * Stream first worksheet row-by-row (low RAM).
 * onRow(obj) may be async; awaited per row so batches flush without huge backlog.
 */
async function streamFirstSheet(filePath, onRow) {
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: 'emit',
    sharedStrings: 'cache',
    styles: 'ignore',
    hyperlinks: 'ignore',
    worksheets: 'emit',
  });

  let headers = null;
  let rowIndex = 0;
  let sheetCount = 0;

  for await (const worksheetReader of workbookReader) {
    sheetCount += 1;
    if (sheetCount > 1) {
      // Drain extra sheets without keeping rows.
      // eslint-disable-next-line no-unused-vars
      for await (const _row of worksheetReader) {
        /* skip */
      }
      continue;
    }

    for await (const row of worksheetReader) {
      const values = row.values || [];
      if (!headers) {
        headers = [];
        for (let i = 1; i < values.length; i += 1) {
          const h = normalizeCell(values[i]);
          headers.push(h == null ? '' : String(h).trim());
        }
        continue;
      }

      const obj = {};
      let any = false;
      for (let i = 0; i < headers.length; i += 1) {
        const key = headers[i];
        if (!key) continue;
        const cell = normalizeCell(values[i + 1]);
        if (cell != null && cell !== '') any = true;
        obj[key] = cell;
      }
      if (!any) continue;

      rowIndex += 1;
      await onRow(obj, rowIndex);
    }
  }

  return rowIndex;
}

async function dropIndexes(conn, table, indexNames) {
  for (const name of indexNames) {
    try {
      await conn.query(`ALTER TABLE \`${table}\` DROP INDEX \`${name}\``);
    } catch (e) {
      if (e && e.code !== 'ER_CANT_DROP_FIELD_OR_KEY') {
        // ignore missing index
      }
    }
  }
}

async function ensureCntIndexes(conn) {
  const indexes = [
    ['idx_center', 'center'],
    ['idx_weighment_date_purchy', 'weighment_date_purchy'],
    ['idx_challan_no', 'challan_no'],
    ['idx_purchy_no', 'purchy_no'],
  ];
  for (const [name, col] of indexes) {
    try {
      await conn.query(`CREATE INDEX \`${name}\` ON \`cnt_performance\` (\`${col}\`)`);
    } catch (e) {
      if (e && e.code !== 'ER_DUP_KEYNAME') throw e;
    }
  }
}

async function ensureGctcIndexes(conn) {
  const indexes = [
    ['idx_v_name', 'v_name'],
    ['idx_m_date', 'm_date'],
    ['idx_purchyno', 'purchyno'],
    ['idx_sup_mod', 'sup_mod'],
  ];
  for (const [name, col] of indexes) {
    try {
      await conn.query(`CREATE INDEX \`${name}\` ON \`g_ctc\` (\`${col}\`)`);
    } catch (e) {
      if (e && e.code !== 'ER_DUP_KEYNAME') throw e;
    }
  }
}

async function flushBatch(conn, sql, batch) {
  if (!batch.length) return;
  await conn.query(sql, [batch]);
  batch.length = 0;
}

async function runImport() {
  const only = argValue('--only=') || 'all';
  const cntArg = argValue('--cnt=');
  const gctcArg = argValue('--gctc=');
  const batchSize = Math.max(50, parseInt(argValue('--batch=') || '300', 10) || 300);

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

  const heapMb = Math.round(process.memoryUsage().heapTotal / 1024 / 1024);
  console.log(`🚀 Cane Performance import (only=${only}, batch=${batchSize}, heap≈${heapMb}MB)`);
  if (cntPath) console.log(`   cnt:  ${cntPath}`);
  if (gctcPath) console.log(`   gctc: ${gctcPath}`);
  console.log('   mode: ExcelJS stream (low RAM)');

  const conn = await pool.getConnection();

  try {
    await conn.query('SET SESSION unique_checks=0');
    await conn.query('SET SESSION foreign_key_checks=0');

    if (needCnt) {
      console.log('Creating cnt_performance (no secondary indexes yet)...');
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
          \`cane_holding_time\` DECIMAL(10,4) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await dropIndexes(conn, 'cnt_performance', [
        'idx_center',
        'idx_weighment_date_purchy',
        'idx_challan_no',
        'idx_purchy_no',
      ]);
      await conn.query('TRUNCATE TABLE `cnt_performance`');
    }

    if (needGctc) {
      console.log('Creating g_ctc (no secondary indexes yet)...');
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
          \`cane_holding_time\` DECIMAL(10,4) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await dropIndexes(conn, 'g_ctc', ['idx_v_name', 'idx_m_date', 'idx_purchyno', 'idx_sup_mod']);
      await conn.query('TRUNCATE TABLE `g_ctc`');
    }

    console.log('✅ Tables cleared/prepared.');

    const cntInsertSql = `INSERT INTO \`cnt_performance\`
      (center, v_name, grower, g_father, purchy_no, transport_mode, purchy_issue_date, weighment_date_purchy, cane_qty_qtls, harvest_date, gross_weighment_centre, tare_weighment_centre, challan_no, challan_issue_time, vehicle_arrival_center, truck_yard_token_time, truck_yard_kaccha_token, gate_weighment_time, tare_weighment_mill, centre_arr, truck_yard_gps_based, report_date, holding_time_center, truck_holding_time_center_minutes, truck_transit_time, yard_waiting_time, unloading_time, truck_holding_time_center, crush_date, cut_to_center_time, mode_code_of_transport, cane_holding_time)
      VALUES ?`;

    const gctcInsertSql = `INSERT INTO \`g_ctc\`
      (v_code, v_name, g_code, g_name, g_father, purchyno, sup_mod, m_date, pur_issue_dt, pur_weight_dt, cut_date, kacha_token_datetime, token_datetime, gross_datetime, tare_datetime, purchase_qtl, yard_holding_time, cut_to_token_time, unloading_time, centre_arr, truck_yard_gps_based, report_date, holding_time_center, truck_holding_time_center_minutes, truck_transit_time, yard_waiting_time, unloading_time_2, truck_holding_time_center, crush_date, cut_to_center_time, mode_code_of_transport, cane_holding_time)
      VALUES ?`;

    if (needCnt) {
      console.log('📄 Streaming CntPerformance.xlsx...');
      const batch = [];
      const total = await streamFirstSheet(cntPath, async (obj, i) => {
        batch.push(mapCntRow(obj));
        if (batch.length >= batchSize) {
          await flushBatch(conn, cntInsertSql, batch);
          if (i % 20000 === 0) {
            const used = Math.round(process.memoryUsage().rss / 1024 / 1024);
            console.log(`  cnt_performance: ${i} rows (rss≈${used}MB)`);
          }
        }
      });
      await flushBatch(conn, cntInsertSql, batch);
      console.log(`✅ Imported ${total} rows into cnt_performance. Building indexes...`);
      await ensureCntIndexes(conn);
      console.log('✅ cnt_performance indexes ready.');
    }

    if (needGctc) {
      console.log('📄 Streaming G_CTC.xlsx...');
      let shiftedCount = 0;
      let normalCount = 0;
      const batch = [];
      const total = await streamFirstSheet(gctcPath, async (obj, i) => {
        if (isShiftedGctcRow(obj)) shiftedCount += 1;
        else normalCount += 1;
        batch.push(mapGctcRow(obj));
        if (batch.length >= batchSize) {
          await flushBatch(conn, gctcInsertSql, batch);
          if (i % 20000 === 0) {
            const used = Math.round(process.memoryUsage().rss / 1024 / 1024);
            console.log(`  g_ctc: ${i} rows (rss≈${used}MB)`);
          }
        }
      });
      await flushBatch(conn, gctcInsertSql, batch);
      console.log(
        `✅ Imported ${total} rows into g_ctc (normal=${normalCount}, shifted=${shiftedCount}). Building indexes...`
      );
      await ensureGctcIndexes(conn);
      console.log('✅ g_ctc indexes ready.');

      const [modeCheck] = await conn.query(`
        SELECT IFNULL(sup_mod,'NULL') as mode, COUNT(*) as cnt
        FROM g_ctc GROUP BY sup_mod ORDER BY cnt DESC LIMIT 15
      `);
      console.log('sup_mod distribution after import:');
      console.table(modeCheck);
    }

    await conn.query('SET SESSION unique_checks=1');
    await conn.query('SET SESSION foreign_key_checks=1');

    console.log('🎉 ALL IMPORTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Import Error:', err);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

runImport();
