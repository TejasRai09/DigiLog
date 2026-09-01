const xlsx = require('xlsx');
const { pool } = require('../config/mysql');

function excelDateToISO(excelDate) {
  if (!excelDate) return null;
  if (typeof excelDate === 'string') return excelDate;
  try {
    const dateObj = xlsx.SSF.parse_date_code(excelDate);
    if (!dateObj) return null;
    return `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
  } catch (e) { return null; }
}

async function run() {
  const wb = xlsx.readFile('c:/vivek/PLANT/DigiLog/backend/backlog-data/Cane Performance/G_CTC.xlsx', {sheetRows: 6});
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log('Total rows read:', rows.length);
  
  const gValues = rows.map(r => [
    r.v_code || null, r.v_name || null, r.g_code || null, r.g_name || null, r.g_father || null, r.purchyno || null,
    r.SUP_MOD || null, excelDateToISO(r.m_date), null, null, null, null, null, null, null,
    r.Purchase_QTL || null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null
  ]);
  
  console.log('Value list count:', gValues.length);
  console.log('Sample values:', gValues[0]);
  
  const conn = await pool.getConnection();
  try {
    await conn.query('TRUNCATE TABLE g_ctc');
    const [res] = await conn.query(
      'INSERT INTO g_ctc (v_code, v_name, g_code, g_name, g_father, purchyno, sup_mod, m_date, pur_issue_dt, pur_weight_dt, cut_date, kacha_token_datetime, token_datetime, gross_datetime, tare_datetime, purchase_qtl, yard_holding_time, cut_to_token_time, unloading_time, centre_arr, truck_yard_gps_based, report_date, holding_time_center, truck_holding_time_center_minutes, truck_transit_time, yard_waiting_time, unloading_time_2, truck_holding_time_center, crush_date, cut_to_center_time, mode_code_of_transport, cane_holding_time) VALUES ?',
      [gValues]
    );
    console.log('Insert result info:', res);
    const [count] = await conn.query('SELECT COUNT(*) as count FROM g_ctc');
    console.log('Count after insert:', count[0].count);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
}
run();
