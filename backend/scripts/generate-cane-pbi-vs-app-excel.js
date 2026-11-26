/**
 * Cane Performance — Power BI vs DigiLog formula comparison.
 *
 * One sheet per Power BI page, plus the full center-data and gate-data
 * column maps (source name, Power BI renamed name, app column).
 *
 * Usage (from DigiLog/backend):
 *   node scripts/generate-cane-pbi-vs-app-excel.js
 */
const path = require('path');
const ExcelJS = require('exceljs');


const OUT = process.argv.includes('--out')
  ? path.resolve(process.argv[process.argv.indexOf('--out') + 1])
  : path.resolve(__dirname, '../../docs/bi/Cane-Performance-PowerBI-vs-App.xlsx');

const NAVY = '1F3864';
const TEAL = '0F7173';
const WHITE = 'FFFFFF';
const RED = 'FECACA';
const AMBER = 'FDE68A';
const GREEN = 'C6EFCE';
const BLUE = 'DBEAFE';
const GREY = 'E5E7EB';
const LIGHT = 'F8FAFC';

const FILL = {
  Mismatch: RED,
  Review: AMBER,
  Partial: AMBER,
  'Not in app': BLUE,
  'Not in Power BI': GREY,
  Match: GREEN,
  Omitted: GREY,
};

const HEADERS = [
  'What you see',
  'Type',
  'Center data column',
  'Power BI name (renamed)',
  'Power BI formula',
  'Export sheet',
  'App column (export sheet)',
  'App formula',
  'Yellow column formula',
  'Match',
  'Difference',
];

const COL_HEADERS = [
  'Center data column',
  'Power BI name (renamed)',
  'Kept in Power BI?',
  'Power BI formula',
  'App column (export sheet)',
  'App formula',
  'Yellow column formula',
  'Match',
  'Difference',
];

const mismatches = [];

function addSheet(wb, name, headers, rows, note) {
  const ws = wb.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: note ? 3 : 2, showGridLines: false }],
  });
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.paperSize = 9;

  const cols = headers.length;
  ws.mergeCells(1, 1, 1, cols);
  const title = ws.getCell(1, 1);
  title.value = name;
  title.font = { bold: true, size: 14, color: { argb: WHITE } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  title.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 24;

  let headerRow = 2;
  if (note) {
    ws.mergeCells(2, 1, 2, cols);
    const n = ws.getCell(2, 1);
    n.value = note;
    n.font = { italic: true, size: 9, color: { argb: '334155' } };
    n.alignment = { wrapText: true, vertical: 'middle' };
    ws.getRow(2).height = 32;
    headerRow = 3;
  }

  const hr = ws.getRow(headerRow);
  headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10, color: { argb: WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL } };
    c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  });
  hr.height = 30;

  rows.forEach((vals, ri) => {
    const r = ws.getRow(headerRow + 1 + ri);
    const status = vals[vals.length - 2];
    vals.forEach((v, i) => {
      const c = r.getCell(i + 1);
      c.value = v == null ? '' : v;
      c.font = { size: 9 };
      c.alignment = { wrapText: true, vertical: 'top' };
      if (headers[i] === 'Yellow column formula' && v && v !== '—') {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
      } else if (i === vals.length - 2 && FILL[status]) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FILL[status] } };
        c.font = { size: 9, bold: true };
        c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
      } else if (ri % 2 === 1) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
      }
    });
    const longest = vals.reduce((m, v) => Math.max(m, String(v || '').length), 0);
    r.height = Math.min(96, 18 + Math.ceil(longest / 70) * 12);
    if (status && status !== 'Match' && status !== 'Omitted') {
      mismatches.push({ sheet: name, item: vals[0], status, difference: vals[vals.length - 1] });
    }
  });

  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow + rows.length, column: cols },
  };

  const widths = headers.map((h, i) => {
    if (i === headers.length - 1) return 62;
    if (h === 'Power BI formula' || h === 'App formula' || h === 'Yellow column formula') return 56;
    if (h === 'Match' || h === 'Type' || h === 'Kept in Power BI?') return 16;
    if (h === 'Export sheet') return 18;
    return 32;
  });
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  return ws;
}

const DATE_NOTE =
  'Checked on 300,458 center rows. The column the app filters (report_date) equals Power BI Report Date on 99.9% of them: if the hour of Tare Weighment @ Centre is 00:00–07:59, the date is the previous day. Weighment Date (Purchy) equals that same day on 98.8% of rows. The 8-hour shift changes the day on about 1%.';

const sheets = [];

sheets.push({
  name: 'Procurement Summary',
  note: DATE_NOTE,
  headers: HEADERS,
  rows: [
    ['Total Trips', 'KPI', 'CHALLAN', 'Challan No.', 'DISTINCTCOUNT(Challan No.)', 'challan_no', 'COUNT(DISTINCT challan_no) where center is not blank', 'Match', 'Same count. The date column also matches. See the date row.'],
    ['Avg Transit Time (Hrs)', 'KPI', 'TravelHrCntYard', 'Truck Transit Time', 'AVERAGE of DATEDIFF(Challan Issue Time, Truck @ Yard (Kaccha Token), MINUTE) / 60', 'truck_transit_time', 'AVERAGE of TravelHrCntYard / 60', 'Match', 'Same formula. On 300,452 rows, TravelHrCntYard equals that timestamp gap within 1 minute on 99.7%.'],
    ['Truck Holding Time (H)', 'KPI', 'WaitingTimeCnt', 'TruckHoldingTime(Center)', 'AVERAGE of (MAX per challan of DATEDIFF(Gross Weighment @ Centre, Challan Issue Time, MINUTE) / 60)', 'truck_holding_time_center', 'AVERAGE of truck_holding_time_center. That column is the max of WaitingTimeCnt inside the challan, divided by 60.', 'Match', 'WaitingTimeCnt equals gross-weighment to challan-issue on 100% of rows (within 1 minute). The app column equals the challan max of that value on 87.6% of rows. It is not center holding.'],
    ['Waiting Time (Hrs)', 'KPI', 'WaitingTimeYard', 'Yard Waiting Time', 'AVERAGE of DATEDIFF(Truck @ Yard (Kaccha Token), Gate Weighment Time, MINUTE) / 60', 'yard_waiting_time', 'AVERAGE of WaitingTimeYard / 60', 'Match', 'Same formula. WaitingTimeYard equals that gap within 1 minute on 99.7% of 300,429 rows.'],
    ['Cane Holding Time (Hrs)', 'KPI', 'M_TokenDate_Time and TT_GRODATETIME', 'WA Cane Holding Time', 'SUMX( DATEDIFF(Vehicle Arrival @ Center, Gate Weighment Time, MINUTE) / 60 * Cane Qty ) / SUM(Cane Qty)', 'cane_holding_time', 'Same weighted average of the stored cane holding hours', 'Match', 'The stored cane holding equals arrival to gate weighment within 1 minute on 90.7% of rows. It is not WaitingTimeCnt. WaitingTimeCnt is gross weighment to challan issue, which is truck holding.'],
    ['Time at Donga (Hrs)', 'KPI', 'WaitingTimeDonga', 'Unloading Time', 'AVERAGE of DATEDIFF(Gate Weighment Time, Tare Weighment @ Mill, MINUTE) / 60', 'unloading_time on cnt_performance', 'AVERAGE of WaitingTimeDonga / 60', 'Match', 'Same formula. WaitingTimeDonga equals that gap within 1 minute on 100% of 300,329 rows.'],
    ['Center table — Vehicles', 'Table', 'Purchy No.', 'Purchy No.', 'COUNT of Purchy No. by Transport Mode', 'purchy_no', 'COUNT(purchy_no) by transport_mode', 'Match', 'Same count.'],
    ['Center table — Cane (Q)', 'Table', 'Purchased Quantity (Qtl.)', 'Cane Qty (Qtls)', 'SUM of Cane Qty by Transport Mode', 'cane_qty_qtls', 'SUM(cane_qty_qtls) by transport_mode', 'Match', 'Same sum after the rename.'],
    ['Center table — Time (Hrs)', 'Table', 'M_TokenDate_Time and Tare Weighment @ Centre', '—', 'Not listed. The Power BI formula cannot be calculated from our data.', 'holding_time_center', 'Average of Center Holding (Hrs)', 'Omitted', 'Harvest (Date/Time) is filled on 295 of 300,458 rows. Those harvest times are in 2023–2024 and vehicle arrival is in 2026, so the average cannot be calculated. The app shows Center Holding (Hrs).'],
    ['Center holding table', 'Table', 'M_TokenDate_Time and Tare Weighment @ Centre', 'Holding Time (Center)', 'AVERAGE of DATEDIFF(Vehicle Arrival @ Center, Tare Weighment @ Centre, MINUTE) / 60', 'holding_time_center', 'AVERAGE of holding_time_center', 'Match', 'Same formula. holding_time_center equals arrival to centre tare within 1 minute on 90.9% of rows. WaitingTimeCnt is a different gap (gross weighment to challan issue). About 9% of rows were later saved as WaitingTimeCnt and those rows do not match.'],
    ['Gate table — Vehicles', 'Table', 'purchyno', 'purchyno', 'SUM/COUNT of purchyno by SUP_MOD (no v_code filter in the model)', 'purchyno', 'COUNT(purchyno) where v_code is not null and mode is 18/36/45/63/99', 'Partial', 'Count method matches. The app drops rows with a blank v_code and modes outside the six standard modes.'],
    ['Gate table — Cane (Q)', 'Table', 'Purchase_QTL', 'Purchase_QTL', 'SUM of Purchase_QTL by SUP_MOD', 'purchase_qtl', 'SUM(purchase_qtl) by sup_mod, same row filter as vehicles', 'Partial', 'Same sum. Row filter differs (v_code and mode list).'],
    ['Gate table — Time (Hrs)', 'Table', 'Tokendatetime and Grossdatetime', '—', 'Not listed. The Power BI formula cannot be calculated from our data.', 'yard_holding_time', 'Average of Yard Holding (Hrs)', 'Omitted', 'CutDate is filled on 255 of 105,912 gate rows. Those cut times are in 2023–2024 and the token time is in 2026, so the average cannot be calculated. The app shows Yard Holding (Hrs).'],
    ['Yard table — Avg Time', 'Table', 'Tokendatetime and Grossdatetime', 'Yard Holding Time', 'AVERAGE of DATEDIFF(Tokendatetime, Grossdatetime, MINUTE) / 60', 'yard_holding_time', 'AVERAGE of TokenToGross / 60', 'Match', 'Same formula. GrossToTare equals gross to tare on 100% of gate rows whose clocks were saved with a time. TokenToGross equals token to gross on 80% of those rows. About 36,000 gate timestamps were saved as midnight, so those clocks cannot be rechecked.'],
    ['Yard table — Dev (>8H)', 'Table', 'Tokendatetime and Grossdatetime', 'Deviations', 'COUNTROWS where Yard Holding Time > 8', 'yard_holding_time', 'SUM of 1 where yard_holding_time > 8', 'Match', 'Same > 8 hour rule on the same hour column. The app also drops blank v_code and non-standard modes.'],
    ['Mill table — Avg Time', 'Table', 'Grossdatetime and TAREdatetime', 'UnloadingTime', 'AVERAGE of DATEDIFF(Grossdatetime, TAREdatetime, MINUTE) / 60', 'unloading_time on g_ctc', 'AVERAGE of GrossToTare / 60', 'Match', 'Same formula. 69,340 of 69,340 gate rows with a real time on both clocks match within 1 minute.'],
    ['Mill table — Dev (>0.5H)', 'Table', 'Grossdatetime and TAREdatetime', 'DeviationsUT', 'COUNTROWS where UnloadingTime > 0.5', 'unloading_time on g_ctc', 'SUM of 1 where unloading_time > 0.5', 'Match', 'Same > 0.5 hour rule on the same hour column.'],
    ['Date slicer', 'Filter', 'Tare Weighment @ Centre', 'Report Date', 'If hour of centre tare is 0–7, date minus 1 day, else that date.', 'report_date', 'The stored report_date', 'Match', 'report_date equals the Power BI rule on 300,152 of 300,458 rows (99.9%).'],
  ],
});

sheets.push({
  name: 'Gate 1',
  note: 'Gate visuals use G_CTC. The date slicer on this page is still CntPerformance[Report Date], related both ways to G_CTC[m_date]. The app filters g_ctc.m_date and keeps only v_code IS NOT NULL and modes 18 QCART, 36/45/63/99 QTROLLY, 99 QTRUCK.',
  headers: HEADERS,
  rows: [
    ['Cane Purchased', 'KPI', 'Purchase_QTL', 'Purchase_QTL', 'SUM(Purchase_QTL)', 'purchase_qtl', 'SUM(purchase_qtl)', 'Partial', 'Same column. App row filter (v_code and mode list) is not in the Power BI model.'],
    ['No. of Purchy', 'KPI', 'purchyno', 'purchyno', 'COUNT of purchyno', 'purchyno', 'COUNT(purchyno)', 'Partial', 'Same count method. App row filter differs.'],
    ['Avg Purchy Size', 'KPI', 'Purchase_QTL and purchyno', 'Avg Purchy Size', 'SUM(Purchase_QTL) / COUNT(purchyno)', 'purchase_qtl, purchyno', 'SUM(purchase_qtl) / COUNT(purchyno)', 'Partial', 'Same formula. App row filter differs.'],
    ['Mode slicer', 'Filter', 'SUP_MOD', 'SUP_MOD', 'Slicer on SUP_MOD', 'sup_mod', 'Optional sup_mod filter. 99 QTROLLY and 99 QTRUCK are grouped together.', 'Partial', 'Power BI treats 99 QTROLLY and 99 QTRUCK as separate slicer values.'],
    ['Date slicer', 'Filter', 'Tare Weighment @ Centre, linked to m_date', 'Report Date', 'Between filter on Report Date, which filters G_CTC[m_date]', 'm_date', 'm_date between From and To', 'Match', 'Gate rows are filtered on m_date. The center Report Date that drives the slicer matches the Power BI rule on 99.9% of center rows.'],
    ['Overrun 18 QCART', 'KPI', 'Purchase_QTL, SUP_MOD', 'Over 18Q', 'AVERAGE(Purchase_QTL) − 18 where SUP_MOD = "18 QCART" and qty > 0, else blank', 'purchase_qtl, sup_mod', 'AVERAGE(purchase_qtl) − 18 for 18 QCART, qty > 0', 'Match', 'Same per-mode overrun.'],
    ['Overrun 36 QTROLLY', 'KPI', 'Purchase_QTL, SUP_MOD', 'Over 36Q', 'AVERAGE(Purchase_QTL) − 36 where SUP_MOD = "36 QTROLLY"', 'purchase_qtl, sup_mod', 'AVERAGE(purchase_qtl) − 36 for 36 QTROLLY', 'Match', 'Same per-mode overrun.'],
    ['Overrun 45 QTROLLY', 'KPI', 'Purchase_QTL, SUP_MOD', '(not on this page)', 'No Over 45Q measure in Power BI', 'purchase_qtl, sup_mod', 'AVERAGE(purchase_qtl) − 45 for 45 QTROLLY, and it is included in the average-of-modes KPI', 'Not in Power BI', 'The app has a 45 QTROLLY overrun. Gate 1 in Power BI does not.'],
    ['Overrun 63 QTROLLY', 'KPI', 'Purchase_QTL, SUP_MOD', 'Over 63Q', 'AVERAGE(Purchase_QTL) − 63 where SUP_MOD = "63 QTROLLY"', 'purchase_qtl, sup_mod', 'AVERAGE(purchase_qtl) − 63 for 63 QTROLLY', 'Match', 'Same per-mode overrun.'],
    ['Overrun 99', 'KPI', 'Purchase_QTL, SUP_MOD', 'Over 99Q', 'AVERAGE(Purchase_QTL) − 99 where SUP_MOD = "99 QTROLLY" only. The card label says 99 QTRUCK.', 'purchase_qtl, sup_mod', 'Capacity 99 for both 99 QTROLLY and 99 QTRUCK', 'Mismatch', 'Power BI ignores 99 QTRUCK and labels the 99 QTROLLY measure as 99 QTRUCK. The app includes both modes.'],
    ['Avg Parchy Overrun KPI', 'KPI', 'Purchase_QTL, SUP_MOD', 'The four Over measures, shown separately', 'Each mode is its own number. There is no average-of-modes KPI.', 'overruns', 'Unweighted average of the per-mode overruns', 'Partial', 'Per-mode math matches (except 45 and 99 QTRUCK). The single KPI number exists only in the app.'],
    ['Purchase split donut', 'Pie', 'SUP_MOD, Purchase_QTL', 'SUP_MOD, Purchase_QTL', 'SUM(Purchase_QTL) by SUP_MOD', 'sup_mod, purchase_qtl', 'SUM(purchase_qtl) by sup_mod', 'Partial', 'Same split. App row filter differs.'],
    ['No. of Vehicles chart', 'Chart', 'SUP_MOD', 'SUP_MOD', 'COUNT of SUP_MOD by mode', 'sup_mod', 'COUNT(purchyno) by sup_mod', 'Match', 'Both count rows per mode.'],
    ['Cane Purchase Trend', 'Trend', 'm_date, Purchase_QTL', 'm_date, Purchase_QTL', 'SUM(Purchase_QTL) by m_date', 'm_date, purchase_qtl', 'SUM(purchase_qtl) by m_date', 'Partial', 'Same daily sum. App row filter differs.'],
    ['Purchi Overrun Trend', 'Trend', 'm_date, SUP_MOD, Purchase_QTL', 'Over 18Q / 36Q / 63Q / 99Q', 'Per day, the same Over measures (no 45, 99 is QTROLLY only)', 'm_date, sup_mod, purchase_qtl', 'Per day and mode: AVERAGE(purchase_qtl) − capacity, including 45 and both 99 modes', 'Mismatch', 'Missing 45 and the 99 QTRUCK handling differ on every day of the trend.'],
  ],
});

sheets.push({
  name: 'Gate 2',
  note: 'Yard holding is TokenToGross / 60, and that stored minute column is DATEDIFF(Tokendatetime, Grossdatetime). Donga is GrossToTare / 60 = DATEDIFF(Grossdatetime, TAREdatetime). Checked on 105,912 gate rows.',
  headers: HEADERS,
  rows: [
    ['No. of Carts / Trollies / Trucks', 'Card', 'SUP_MOD', 'SUP_MOD', 'COUNT of rows for that SUP_MOD (18 QCART, 36 QTROLLY, 63 QTROLLY, 99 QTRUCK)', 'sup_mod, purchyno', 'COUNT of rows for that mode. 99 card uses rows whose mode contains 99 (QTROLLY and QTRUCK).', 'Partial', '18, 36 and 63 match. The 99 card in the app mixes 99 QTROLLY and 99 QTRUCK. Power BI card is 99 QTRUCK only. 45 is on the app charts, not on these cards.'],
    ['Min Yard Holding (Hrs)', 'Card', 'Tokendatetime, Grossdatetime', 'Yard Holding Time', 'MIN(Yard Holding Time) for the mode', 'yard_holding_time', 'MIN(yard_holding_time) for the mode', 'Match', 'Same token-to-gross gap. The app uses the stored TokenToGross minutes, which are that gap.'],
    ['Avg Yard Holding (Hrs)', 'Card', 'Tokendatetime, Grossdatetime', 'Yard Holding Time', 'AVERAGE(Yard Holding Time) for the mode', 'yard_holding_time', 'AVERAGE(yard_holding_time) for the mode', 'Match', 'Same gap.'],
    ['Max Yard Holding (Hrs)', 'Card', 'Tokendatetime, Grossdatetime', 'Yard Holding Time', 'MAX(Yard Holding Time) for the mode', 'yard_holding_time', 'MAX(yard_holding_time) for the mode', 'Match', 'Same gap.'],
    ['Vehicles exceeding Holding Time', 'Card', 'Yard Holding Time', 'Deviations', 'COUNTROWS where Yard Holding Time > 8, inside the mode filter', 'yard_holding_time', 'Count of rows with yard_holding_time > 8. The card also adds devCenterYard, which the gate query always sets to 0.', 'Match', 'Same > 8 hour rule on the same hour column.'],
    ['Total Vehicles KPI', 'KPI', 'SUP_MOD', 'SUP_MOD', 'Not a separate Power BI card. It is the sum of the mode cards on screen.', 'purchyno', 'Sum of the four mode cards only (18, 36, 63, 99). 45 QTROLLY is excluded from this KPI.', 'Partial', 'Both omit 45 from the headline total. 99 grouping differs.'],
    ['Avg Yard Holding KPI', 'KPI', 'Yard Holding Time', 'Yard Holding Time', 'No single KPI. Each mode card has its own average.', 'yard_holding_time', 'Unweighted average of the four mode averages that are above zero', 'Partial', 'The app adds a headline average Power BI does not show as one number.'],
    ['Max Yard Holding KPI', 'KPI', 'Yard Holding Time', 'Yard Holding Time', 'No single KPI. Each mode card has its own max.', 'yard_holding_time', 'Maximum of the four mode maximums', 'Partial', 'Same underlying max, rolled up only in the app.'],
    ['Vehicles Exceeding KPI', 'KPI', 'Yard Holding Time', 'Deviations', 'Deviations measure is the count > 8. The page does not sum modes into one card.', 'yard_holding_time', 'Sum of devOver8H across the four mode cards', 'Partial', 'Same > 8 rule, rolled up only in the app.'],
    ['Average Yard Holding Time trend', 'Trend', 'm_date, SUP_MOD', 'Yard Holding Time', 'AVERAGE(Yard Holding Time) by m_date and SUP_MOD', 'm_date, sup_mod, yard_holding_time', 'AVERAGE(yard_holding_time) by m_date and sup_mod, including 45', 'Match', 'Same daily average of the same hour column. 45 appears in the app series.'],
    ['Vehicles exceeding standard holding trend', 'Trend', 'm_date, SUP_MOD', 'Vehicles exceeding Holding Time', 'Deviations / COUNT(SUP_MOD), plotted by m_date and SUP_MOD. Format is a percent.', 'm_date, sup_mod, yard_holding_time', 'Count of rows with yard_holding_time > 8, by day and mode. Not a percent.', 'Mismatch', 'Power BI plots a share (count over 8 hours ÷ count of mode). The app plots the count.'],
    ['Date slicer', 'Filter', 'Report Date linked to m_date', 'Report Date', 'Between filter on Report Date', 'm_date', 'm_date between From and To', 'Match', 'The slicer date is the center Report Date, which matches the Power BI rule on 99.9% of center rows, and it filters gate m_date.'],
  ],
});

sheets.push({
  name: 'Center Purchase',
  note: DATE_NOTE + ' The center slicer on this page is Center Data[Center Name], related through Indent, not a direct filter on CntPerformance[Center]. The app filters cnt_performance.center.',
  headers: HEADERS,
  rows: [
    ['Cane Purchased (Qtls)', 'KPI', 'Purchased Quantity (Qtl.)', 'Cane Qty (Qtls)', 'SUM(Cane Qty (Qtls))', 'cane_qty_qtls', 'SUM(cane_qty_qtls) where center is not blank', 'Partial', 'Same sum after the rename. Date column and center slicer differ.'],
    ['No. of Purchy', 'KPI', 'Purchy No.', 'Purchy No.', 'COUNT of Purchy No.', 'purchy_no', 'COUNT(purchy_no)', 'Partial', 'Same count. Date column differs.'],
    ['Avg Parchi Size (Qtls)', 'KPI', 'Cane Qty and Purchy No.', 'Avg Parchi Size', 'SUM(Cane Qty) / COUNT(Purchy No.)', 'cane_qty_qtls, purchy_no', 'SUM(cane_qty_qtls) / COUNT(purchy_no)', 'Partial', 'Same formula. Date column differs.'],
    ['Trips (C to G)', 'KPI', 'CHALLAN', 'Challan No.', 'DISTINCTCOUNT(Challan No.)', 'challan_no', 'COUNT(DISTINCT challan_no)', 'Partial', 'Same distinct count. Date column differs.'],
    ['Overrun 18', 'KPI', 'Purchased Quantity (Qtl.), Mode Name of Transport', 'Overrun18', 'AVERAGE(Cane Qty) − 18 where Transport Mode = "18 QCART" and qty > 0', 'cane_qty_qtls, transport_mode', 'AVERAGE(cane_qty_qtls) − 18 for 18 QCART', 'Match', 'Same per-mode overrun.'],
    ['Overrun 36', 'KPI', 'Purchased Quantity (Qtl.), Mode Name of Transport', 'Overrun36', 'AVERAGE(Cane Qty) − 36 where mode = "36 QTROLLY"', 'cane_qty_qtls, transport_mode', 'AVERAGE(cane_qty_qtls) − 36 for 36 QTROLLY', 'Match', 'Same per-mode overrun.'],
    ['Overrun 45', 'KPI', 'Purchased Quantity (Qtl.), Mode Name of Transport', 'Overrun45', 'AVERAGE(Cane Qty) − 45 where mode = "45 QTROLLY"', 'cane_qty_qtls, transport_mode', 'AVERAGE(cane_qty_qtls) − 45 for 45 QTROLLY', 'Match', 'Same per-mode overrun. Gate 1 does not have this measure; Center Purchase does.'],
    ['Overrun 63', 'KPI', 'Purchased Quantity (Qtl.), Mode Name of Transport', 'Overrun63', 'AVERAGE(Cane Qty) − 63 where mode = "63 QTROLLY"', 'cane_qty_qtls, transport_mode', 'AVERAGE(cane_qty_qtls) − 63 for 63 QTROLLY', 'Match', 'Same per-mode overrun.'],
    ['Overrun 99', 'KPI', 'Mode Name of Transport', '(not in Power BI)', 'No center overrun measure for 99', 'transport_mode', '99 modes are excluded from center overrun (capacity is null)', 'Match', 'Both leave 99 out of center overrun.'],
    ['Avg Parchi Overrun KPI', 'KPI', 'The Overrun measures', 'Shown as four separate numbers', 'No average-of-modes KPI', 'cntOverruns', 'Unweighted average of the per-mode overruns', 'Partial', 'Per-mode numbers match. The single average exists only in the app.'],
    ['Purchase split', 'Pie', 'Mode Name of Transport, Purchased Quantity (Qtl.)', 'Transport Mode, Cane Qty (Qtls)', 'SUM(Cane Qty) by Transport Mode', 'transport_mode, cane_qty_qtls', 'SUM(cane_qty_qtls) by transport_mode', 'Partial', 'Same split. Date column differs.'],
    ['Cane Purchase Trend', 'Trend', 'Tare Weighment @ Centre', 'Report Date', 'SUM(Cane Qty) by Report Date (centre-tare day, shifted before 08:00)', 'report_date', 'SUM(cane_qty_qtls) by report_date', 'Match', 'The app date column equals the Power BI Report Date on 99.9% of rows.'],
    ['Parchi Overrun Trend', 'Trend', 'Report Date, Transport Mode, Cane Qty', 'Overrun18 / 36 / 45 / 63', 'Per Report Date: AVERAGE(Cane Qty) − capacity for that mode', 'report_date, transport_mode, cane_qty_qtls', 'Per report_date: AVERAGE(cane_qty_qtls) − capacity', 'Match', 'Same per-mode math on the same date column.'],
    ['Top 10 centers — cane', 'Chart', 'C.Name, Purchased Quantity (Qtl.)', 'Center, Cane Qty (Qtls)', 'SUM(Cane Qty) by Center, top 10', 'center, cane_qty_qtls', 'SUM(cane_qty_qtls) by center, highest 10', 'Partial', 'Same ranking math. Date column and the Center Data slicer differ.'],
    ['Top 10 centers — avg parchie', 'Chart', 'C.Name, Cane Qty, Purchy No.', 'Avg Parchi Size', 'SUM(Cane Qty) / COUNT(Purchy No.) for those centers', 'center, cane_qty_qtls, purchy_no', 'SUM(cane_qty_qtls) / COUNT(purchy_no) for the same top 10', 'Partial', 'Same average. Population of centers can differ with the date filter.'],
    ['Bottom 10 centers — cane and avg', 'Chart', 'C.Name, Cane Qty, Purchy No.', 'Center, Avg Parchi Size', 'Lowest 10 centers by SUM(Cane Qty), with Avg Parchi Size on the line', 'center, cane_qty_qtls, purchy_no', 'Lowest 10 by SUM(cane_qty_qtls), line is SUM / COUNT', 'Partial', 'Same ranking math. Date filter differs.'],
    ['Mode slicer', 'Filter', 'Mode Name of Transport', 'Transport Mode', 'Slicer on Transport Mode', 'transport_mode', 'Optional transport_mode filter. 99 QTROLLY and 99 QTRUCK grouped.', 'Partial', '99 modes are separate in Power BI.'],
    ['Center slicer', 'Filter', 'Center Data[Center Name] via Indent', 'Center Name', 'Filters indent rows for that center, which filters Report Date, which filters all center rows on those dates. It does not filter CntPerformance[Center].', 'center', 'center = selected name', 'Mismatch', 'Power BI does not filter the center column. The app does.'],
  ],
});

sheets.push({
  name: 'Center Vehicle Handling',
  note: DATE_NOTE,
  headers: HEADERS,
  rows: [
    ['Vehicle Handled', 'KPI', 'Mode Name of Transport', 'Transport Mode', 'COUNT of Transport Mode (row count)', 'purchy_no', 'COUNT(purchy_no)', 'Partial', 'Both count rows. Date column differs. Power BI does not require a non-blank center beyond what the relationship does; the app requires center not blank.'],
    ['Mode wise split', 'Chart', 'Mode Name of Transport', 'Transport Mode', 'COUNT of Transport Mode by mode', 'transport_mode, purchy_no', 'COUNT(purchy_no) by transport_mode', 'Partial', 'Same row count by mode. Date column differs.'],
    ['Vehicle handling trend', 'Trend', 'Report Date, Transport Mode', 'Report Date, Transport Mode', 'COUNT of Transport Mode by Report Date and mode', 'report_date, transport_mode', 'COUNT(purchy_no) by report_date and mode', 'Match', 'Same count on the same Report Date column (99.9% of rows).'],
    ['Centers with most vehicles (top 10)', 'Table', 'C.Name, Mode Name of Transport, Purchy No.', 'Center, Transport Mode, Purchy No.', 'COUNT of Purchy No. by center and mode, top 10 centers', 'center, transport_mode, purchy_no', 'COUNT by center and mode, 10 centers with the highest total, modes 18/36/45/63', 'Partial', 'Same count and top-10 idea. The app mode split stops at 63 and does not show a 99 column. Date column differs.'],
    ['Centers with least vehicles (bottom 10)', 'Table', 'C.Name, Purchy No.', 'Center, Purchy No.', 'COUNT of Purchy No., lowest 10 centers', 'center, purchy_no', 'COUNT by center, lowest 10', 'Partial', 'Same ranking idea. Date column differs.'],
    ['Center slicer', 'Filter', 'C.Name', 'Center', 'Direct slicer on CntPerformance[Center]', 'center', 'center = selected name', 'Match', 'Same column after the rename from C.Name.'],
    ['Mode slicer', 'Filter', 'Mode Name of Transport', 'Transport Mode', 'Slicer on Transport Mode', 'transport_mode', 'Optional mode filter, 99 modes grouped in the app', 'Partial', '99 modes are separate in Power BI.'],
    ['Date slicer', 'Filter', 'Tare Weighment @ Centre', 'Report Date', 'Shifted centre-tare date', 'report_date', 'The stored report_date', 'Match', 'Equals the Power BI rule on 99.9% of rows.'],
  ],
});

sheets.push({
  name: 'Vehicle Holding',
  note: 'holding_time_center equals DATEDIFF(Vehicle Arrival @ Center, Tare Weighment @ Centre, MINUTE) / 60 on 90.9% of 300,419 rows. WaitingTimeCnt is a different column: it equals DATEDIFF(Gross Weighment @ Centre, Challan Issue Time) on 100% of rows.',
  headers: HEADERS,
  rows: [
    ['Avg holding by mode', 'Table', 'M_TokenDate_Time and Tare Weighment @ Centre', 'Holding Time (Center)', 'AVERAGE of the arrival-to-centre-tare hours, by Transport Mode', 'holding_time_center', 'AVERAGE of holding_time_center by transport_mode', 'Match', 'Same formula. The stored hours equal that gap within 1 minute on 90.9% of rows. About 9% were later saved as WaitingTimeCnt (gross to challan issue) and those do not match.'],
    ['Avg holding trend', 'Trend', 'Report Date, Transport Mode', 'Holding Time (Center)', 'AVERAGE of Holding Time (Center) by Report Date and mode', 'report_date, holding_time_center', 'AVERAGE of holding_time_center by report_date and mode', 'Match', 'Same duration and the same Report Date (99.9%).'],
    ['Vehicle vs holding plot', 'Chart', 'Holding Time (Center), Purchy No., Transport Mode', 'Holding Time (Center)', 'Scatter of holding hours against purchy, split by mode', 'holding_time_center, purchy_no, transport_mode', 'One point per center and mode: AVERAGE(holding_time_center) and COUNT(purchy_no)', 'Match', 'Same holding hours. The app averages them by center before plotting.'],
    ['Center slicer', 'Filter', 'C.Name', 'Center', 'Slicer on Center', 'center', 'center = selected name', 'Match', 'Same column.'],
    ['Mode slicer', 'Filter', 'Mode Name of Transport', 'Transport Mode', 'Slicer on Transport Mode', 'transport_mode', 'Optional mode filter', 'Partial', '99 modes are grouped only in the app.'],
    ['Date slicer', 'Filter', 'Tare Weighment @ Centre', 'Report Date', 'Shifted centre-tare date', 'report_date', 'The stored report_date', 'Match', 'Equals the Power BI rule on 99.9% of rows.'],
  ],
});

sheets.push({
  name: 'Vehicle Holding 2',
  note: 'This is the one holding page where the app formula matches Power BI: both use minutes from Vehicle Arrival @ Center to Tare Weighment @ Centre, divided by 60.',
  headers: HEADERS,
  rows: [
    ['Holding time by center', 'Table', 'M_TokenDate_Time and Tare Weighment @ Centre (Grower)', 'Holding Time (Center)', 'AVERAGE of DATEDIFF(Vehicle Arrival @ Center, Tare Weighment @ Centre, MINUTE) / 60', 'vehicle_arrival_center, tare_weighment_centre', 'AVERAGE of TIMESTAMPDIFF(MINUTE, vehicle_arrival_center, tare_weighment_centre) / 60', 'Match', 'Same two timestamps. This page does not use WaitingTimeCnt.'],
    ['Vehicles by center', 'Table', 'Purchy No.', 'Purchy No.', 'SUM/COUNT of Purchy No. by center (visual aggregation is the row count on the other holding tables; here the field is Purchy No.)', 'purchy_no', 'COUNT(purchy_no) by center', 'Match', 'Same vehicle count beside the holding time.'],
    ['Which centers are shown', 'Table', 'C.Name', 'Center', 'Tables are titled Top 10 but each visual is filtered to a fixed list of center names saved in the report', 'center', 'Every center in the date range, sorted by name. No top-10 cut.', 'Partial', 'The hour formula matches. The set of centers does not. Power BI shows a saved list. The app shows all centers.'],
    ['Date slicer', 'Filter', 'Tare Weighment @ Centre', 'Report Date', 'Shifted centre-tare date', 'report_date', 'The stored report_date', 'Match', 'The holding formula matches, and the date column matches the Power BI rule on 99.9% of rows.'],
    ['Center slicer', 'Filter', 'C.Name', 'Center', 'Slicer on Center', 'center', 'center = selected name', 'Match', 'Same column.'],
    ['Mode slicer', 'Filter', 'Mode Name of Transport', 'Transport Mode', 'Slicer on Transport Mode', 'transport_mode', 'Optional mode filter', 'Partial', '99 modes are grouped only in the app.'],
  ],
});

sheets.push({
  name: 'Truck Transit Time',
  note: 'TravelHrCntYard equals DATEDIFF(Challan Issue Time, Truck @ Yard Kaccha Token, MINUTE) on 99.7% of 300,452 rows. The app divides that stored column by 60. Distance is the one field that is not in the live center data.',
  headers: HEADERS,
  rows: [
    ['Transit time by center', 'Table', 'CH_DEP_DATE and KTOKENDATETIME', 'Truck Transit Time', 'AVERAGE of DATEDIFF(Challan Issue Time, Kaccha Token, MINUTE) / 60', 'truck_transit_time', 'AVERAGE of TravelHrCntYard / 60 by center', 'Match', 'Same formula. The stored minutes equal that gap within 1 minute on 99.7% of rows.'],
    ['Distance', 'Table', 'CenterDist workbook (not CntPerformance)', 'CenterDist[Distance]', 'Distance of the center from the Center Distance 2023-2024 file, related on center name', 'dist', 'Always 0. The app does not join a distance table.', 'Not in app', 'Power BI shows km. The app has no distance.'],
    ['Trips', 'Table', 'CHALLAN', 'Challan No.', 'DISTINCTCOUNT(Challan No.) by center', 'challan_no', 'COUNT(DISTINCT challan_no) by center', 'Match', 'Same distinct challan count. The screen also shows cane quantity in the app, which this Power BI table does not.'],
    ['Cane on the trip', 'Table', 'Purchased Quantity (Qtl.)', '(not on this table)', 'Power BI transit tables do not show cane quantity', 'cane_qty_qtls', 'SUM(cane_qty_qtls) by center, shown as the volume', 'Not in Power BI', 'The app draws volume from cane quantity. Power BI draws the trip count only.'],
    ['Which centers', 'Table', 'C.Name', 'Center', 'Fixed center-name lists saved on each table', 'center', 'All centers, highest transit time first', 'Partial', 'Ranking in the app is calculated. Power BI shows a saved center list.'],
    ['Date slicer', 'Filter', 'Tare Weighment @ Centre', 'Report Date', 'Shifted centre-tare date', 'report_date', 'The stored report_date', 'Match', 'Equals the Power BI rule on 99.9% of rows.'],
    ['Center slicer', 'Filter', 'C.Name', 'Center', 'Slicer on Center', 'center', 'center = selected name', 'Match', 'Same column.'],
    ['Mode slicer', 'Filter', 'Mode Name of Transport', 'Transport Mode', 'Slicer on Transport Mode', 'transport_mode', 'Optional mode filter', 'Partial', '99 modes are grouped only in the app.'],
  ],
});

sheets.push({
  name: 'Truck Holding',
  note: 'WaitingTimeCnt equals DATEDIFF(Gross Weighment @ Centre, CH_DEP_DATE, MINUTE) on 100% of 300,453 rows (within 1 minute). Power BI then takes the MAX of that value inside each challan and divides by 60. The app column truck_holding_time_center equals that challan max on 87.6% of rows. WaitingTimeCnt is not the same on every row of a challan (37,016 of 37,478 challans vary), so the max step still matters.',
  headers: HEADERS,
  rows: [
    ['Holding time by center', 'Table', 'Gross Weighment @ Centre and CH_DEP_DATE', 'TruckHoldingTime(Center)', 'AVERAGE of (max of WaitingTimeCnt inside the challan / 60). WaitingTimeCnt is already that datediff.', 'truck_holding_time_center', 'AVERAGE of truck_holding_time_center by center', 'Match', 'Same formula. 263,095 of 300,453 rows equal the challan max. The other rows store the row’s own WaitingTimeCnt instead of the max.'],
    ['Trips', 'Table', 'CHALLAN', 'Challan No.', 'DISTINCTCOUNT(Challan No.)', 'challan_no', 'COUNT(DISTINCT challan_no)', 'Match', 'Same distinct challan count.'],
    ['Cane quantity', 'Table', 'Purchased Quantity (Qtl.)', '(not on this table)', 'Not shown', 'cane_qty_qtls', 'SUM(cane_qty_qtls) shown as volume', 'Not in Power BI', 'The app shows cane quantity beside holding. Power BI shows trips.'],
    ['Challan slicer', 'Filter', 'CHALLAN', 'Challan No.', 'Slicer on Challan No.', 'challan_no', 'challan_no = entered challan', 'Match', 'Same column after the rename from CHALLAN.'],
    ['Which centers', 'Table', 'C.Name', 'Center', 'Fixed center-name lists on each table', 'center', 'All centers, highest holding first', 'Partial', 'The app ranks from the data. Power BI uses a saved center list.'],
    ['Date slicer', 'Filter', 'Tare Weighment @ Centre', 'Report Date', 'Shifted centre-tare date', 'report_date', 'The stored report_date', 'Match', 'Equals the Power BI rule on 99.9% of rows.'],
    ['Mode slicer', 'Filter', 'Mode Name of Transport', 'Transport Mode', 'Slicer on Transport Mode', 'transport_mode', 'Optional mode filter', 'Partial', '99 modes are grouped only in the app.'],
  ],
});

sheets.push({
  name: 'Database',
  note: 'Power BI is a row-level table of CntPerformance. The app returns 500 rows and maps two of the time columns to different fields than Power BI.',
  headers: HEADERS,
  rows: [
    ['Purchy No.', 'Column', 'Purchy No.', 'Purchy No.', 'Purchy No. (shown with Sum; one row per parchie so the value is the number)', 'purchy_no', 'purchy_no', 'Match', 'Same column.'],
    ['Center', 'Column', 'C.Name', 'Center', 'Center', 'center', 'center, blank shown as Gate', 'Partial', 'Same column. The app labels a blank center as Gate. Power BI shows the blank.'],
    ['Grower', 'Column', 'G.Name', 'Grower', 'Grower', 'grower', 'grower', 'Match', 'Rename only.'],
    ['Vehicle', 'Column', 'V.Name', 'V.Name', 'V.Name', 'v_name', 'v_name', 'Match', 'Same column. Power BI did not rename V.Name.'],
    ['Cane (Q)', 'Column', 'Purchased Quantity (Qtl.)', 'Cane Qty (Qtls)', 'Cane Qty (Qtls)', 'cane_qty_qtls', 'cane_qty_qtls', 'Match', 'Rename only.'],
    ['Challan No.', 'Column', 'CHALLAN', 'Challan No.', 'Challan No.', 'challan_no', 'challan_no', 'Match', 'Rename only.'],
    ['Mode', 'Column', 'Mode Name of Transport', 'Transport Mode', 'Not on the Power BI database table', 'transport_mode', 'transport_mode', 'Not in Power BI', 'The app shows mode. This Power BI table does not.'],
    ['Arrival / report date', 'Column', 'Weighment Date (Purchy)', 'Vehicle Arrival @ Center', 'The arrival column is M_TokenDate_Time, renamed Vehicle Arrival @ Center. Report Date is the slicer, not this column.', 'report_date', 'Shown as arrival, but the value is Weighment Date (Purchy), not the arrival timestamp', 'Mismatch', 'The app column labeled arrival is the weighment date. Power BI shows the arrival timestamp.'],
    ['Gross weighment at centre', 'Column', 'Gross Weighment @ Centre (Grower) (Date/Time)', 'Gross Weighment @ Centre', 'That timestamp', 'gross_weighment_centre', 'Stored, not shown on the database tab', 'Not in app', 'Power BI shows the timestamp. The app keeps it and does not display it here.'],
    ['Vehicle holding time', 'Column', 'M_TokenDate_Time and Tare Weighment @ Centre', 'Holding Time (Center)', 'DATEDIFF(arrival, centre tare, MINUTE) / 60, summed on the row', 'yard_waiting_time', 'Shown in the holding column, but the value is WaitingTimeYard / 60', 'Mismatch', 'The app database holding column is yard waiting, not center holding.'],
    ['Tare at centre, challan issue, kaccha token, gate weighment, mill tare', 'Column', 'Those source timestamps', 'Renamed names in the Center Data Columns sheet', 'Shown as their own columns', 'The matching app columns', 'Stored, not shown on the database tab', 'Not in app', 'Power BI shows the chain of timestamps. The app database tab does not.'],
    ['Truck holding', 'Column', 'Gross at centre and CH_DEP_DATE', 'TruckHoldingTime(Center)', 'Max per challan of DATEDIFF(gross at centre, challan issue, MINUTE) / 60', 'unloading_time', 'Shown as truckH, but the value is WaitingTimeDonga / 60', 'Mismatch', 'The app database truck column is donga time, not truck holding.'],
    ['Row limit', 'Table', 'All rows', 'All rows in the filter', 'No 500-row cap in the visual', 'cnt_performance', 'ORDER BY report_date DESC LIMIT 500', 'Mismatch', 'The app shows the latest 500 rows only.'],
    ['Date slicer', 'Filter', 'Tare Weighment @ Centre', 'Report Date', 'Shifted centre-tare date', 'report_date', 'The stored report_date. This query does not require a center name.', 'Match', 'The date matches the Power BI rule on 99.9% of rows. The app also keeps rows with a blank center on this tab.'],
    ['Center slicer', 'Filter', 'C.Name', 'Center', 'Slicer on Center', 'center', 'center = selected name', 'Match', 'Same column.'],
  ],
});

const centerColumns = [
  ['C.Code', 'Removed', 'No', 'Dropped in Power Query', 'c_code', 'Stored. Not used in a KPI.', 'Not in Power BI', 'The app keeps the code. Power BI drops it.'],
  ['C.Name', 'Center', 'Yes', 'Renamed only', 'center', 'center. Blank centers are excluded on center tabs.', 'Match', 'Rename only. The app also treats blank as “no center”.'],
  ['V.Code', 'Removed', 'No', 'Dropped in Power Query', 'v_code', 'Stored. Not used in a KPI.', 'Not in Power BI', 'The app keeps the code.'],
  ['V.Name', 'V.Name', 'Yes', 'Not renamed', 'v_name', 'v_name', 'Match', 'Same name.'],
  ['G.Code', 'Removed', 'No', 'Dropped in Power Query', 'g_code', 'Stored. Not used in a KPI.', 'Not in Power BI', 'The app keeps the code.'],
  ['G.Name', 'Grower', 'Yes', 'Renamed only', 'grower', 'grower', 'Match', 'Rename only.'],
  ['G.Father', 'G.Father', 'Yes', 'Not renamed', 'g_father', 'Stored. Not shown on the dashboard tabs.', 'Match', 'Same column, unused on the KPI pages.'],
  ['Purchy No.', 'Purchy No.', 'Yes', 'Not renamed. Count = number of parchies. Avg Parchi Size divides cane by this count.', 'purchy_no', 'COUNT(purchy_no). Avg parchie = SUM(cane) / COUNT(purchy_no).', 'Match', 'Same role.'],
  ['Mode Code of Transport', 'Mode Code of Transport', 'Yes', 'Not renamed. Not used on the dashboard pages.', 'mode_code_of_transport', 'Stored. The app filters by mode name, not this code.', 'Match', 'Both keep it and neither KPI uses it.'],
  ['Mode Name of Transport', 'Transport Mode', 'Yes', 'Renamed. Slicer and every mode split.', 'transport_mode', 'transport_mode. 99 QTROLLY and 99 QTRUCK are treated as one mode when that filter is on.', 'Partial', 'Rename matches. The 99 grouping exists only in the app.'],
  ['Purchy Issue Date (SMS Date)', 'Purchy Issue Date', 'Yes', 'Renamed. Not the date slicer.', 'purchy_issue_date', 'Stored. Not the dashboard date filter.', 'Match', 'Both keep it and neither uses it as the page date.'],
  ['Weighment Date (Purchy)', 'Weighment Date (Purchy)', 'Yes', 'Kept. The slicer is the calculated Report Date, not this column.', 'report_date', 'The dashboard filters report_date. That stored value equals the Power BI Report Date on 99.9% of rows. Weighment Date itself equals that day on 98.8%.', 'Match', 'The day the app filters is the Power BI day. The 8-hour shift changes about 1% of rows versus the raw weighment date.'],
  ['Purchased Quantity (Qtl.)', 'Cane Qty (Qtls)', 'Yes', 'Renamed. SUM for cane, and the weight in WA Cane Holding Time.', 'cane_qty_qtls', 'SUM for cane. Weight in the cane-holding average. Overrun = this minus 18/36/45/63.', 'Match', 'Rename only. Overrun capacity for 99 is omitted on both sides for centers.'],
  ['Harvest (Date/Time)', 'Harvest Date', 'Yes', 'Renamed only. Not used in a listed formula.', 'harvest_datetime', 'On Center Records. Not used in a dashboard formula.', 'Omitted', 'Filled on 295 of 300,458 rows. Those times are in 2023–2024, so a formula that starts from this column cannot be calculated.'],
  ['Gross Weighment @ Centre (Grower) (Date/Time)', 'Gross Weighment @ Centre (Grower) (Date/Time)', 'Yes', 'Start of truck-holding minutes: DATEDIFF(this, Challan Issue Time, MINUTE).', 'gross_weighment_centre', 'WaitingTimeCnt is this gap. Truck holding reads that column.', 'Match', '100% of rows: WaitingTimeCnt equals this timestamp gap within 1 minute.'],
  ['Tare Weighment @ Centre (Grower) (Date/Time) (6)', 'Tare Weighment @ Centre', 'Yes', 'Renamed. End of Holding Time (Center), and the clock for Report Date.', 'tare_weighment_centre', 'End of holding_time_center. Also the clock behind report_date.', 'Match', 'holding_time_center equals arrival to this timestamp on 90.9% of rows. report_date follows this clock on 99.9%.'],
  ['CHALLAN', 'Challan No.', 'Yes', 'Renamed. DISTINCTCOUNT = trips.', 'challan_no', 'COUNT(DISTINCT challan_no) = trips. Truck Holding can filter one challan.', 'Match', 'Rename only. Trip count matches.'],
  ['CH_DEP_DATE', 'Challan Issue Time', 'Yes', 'End of WaitingTimeCnt and start of TravelHrCntYard.', 'challan_issue_time', 'Used through WaitingTimeCnt and TravelHrCntYard.', 'Match', 'Those stored minute columns equal the Power BI gaps from this timestamp.'],
  ['M_TokenDate_Time', 'Vehicle Arrival @ Center', 'Yes', 'Start of Holding Time (Center) and of Cane Holding Time.', 'vehicle_arrival_center', 'Start of holding_time_center and of cane_holding_time.', 'Match', 'The stored hour columns equal the Power BI gaps that start here.'],
  ['TT_TOKDATETIME', 'Truck @ Yard (Token Time)', 'Yes', 'Renamed. Not used in the measures on these pages.', 'truck_yard_token_time', 'Stored. Not used in a KPI.', 'Match', 'Both keep it unused on the KPI pages.'],
  ['KTOKENDATETIME', 'Truck @ Yard (Kaccha Token)', 'Yes', 'End of TravelHrCntYard and start of WaitingTimeYard.', 'truck_yard_kaccha_token', 'Used through those two stored minute columns.', 'Match', '99.7% of rows: the stored minutes equal the Power BI gaps around this timestamp.'],
  ['TT_GRODATETIME', 'Gate Weighment Time', 'Yes', 'End of cane holding and yard waiting. Start of WaitingTimeDonga.', 'gate_weighment_time', 'Used through cane_holding_time, WaitingTimeYard and WaitingTimeDonga.', 'Match', 'Those stored columns equal the Power BI gaps.'],
  ['TT_DATE', 'Tare Weighment @ Mill', 'Yes', 'End of WaitingTimeDonga. Crush Date uses this clock with the 00:00–07:59 shift.', 'tare_weighment_mill', 'End of WaitingTimeDonga. No crush date in the app.', 'Match', 'Donga minutes match this gap on 100% of rows. Crush Date itself is not in the app.'],
  ['TravelHrToCnt', 'Removed', 'No', 'Dropped. Not replaced by a calculated column on these pages.', 'travel_to_center_minutes', 'Stored. Not used in a KPI.', 'Not in Power BI', 'The app keeps the minutes. Power BI drops them.'],
  ['WaitingTimeCnt', 'Removed from the model', 'No', 'Power BI does not load this column. It recalculates DATEDIFF(Gross Weighment @ Centre, Challan Issue Time, MINUTE).', 'truck_holding_time_center_minutes', 'The raw WaitingTimeCnt minutes. Truck holding then uses the max inside the challan, divided by 60.', 'Match', 'Checked: WaitingTimeCnt equals that datediff within 1 minute on 100% of 300,453 rows. It is not center holding and it is not cane holding.'],
  ['TravelHrCntYard', 'Removed from the model', 'No', 'Power BI recalculates DATEDIFF(Challan Issue Time, Kaccha Token, MINUTE).', 'truck_transit_time', 'TravelHrCntYard / 60', 'Match', 'Equals that gap within 1 minute on 99.7% of rows.'],
  ['WaitingTimeYard', 'Removed from the model', 'No', 'Power BI recalculates DATEDIFF(Kaccha Token, Gate Weighment, MINUTE).', 'yard_waiting_time', 'WaitingTimeYard / 60', 'Match', 'Equals that gap within 1 minute on 99.7% of rows.'],
  ['WaitingTimeDonga', 'Removed from the model', 'No', 'Power BI recalculates DATEDIFF(Gate Weighment, Mill Tare, MINUTE).', 'unloading_time', 'WaitingTimeDonga / 60', 'Match', 'Equals that gap within 1 minute on 100% of rows.'],
  ['ToalTimeCTC', 'Removed', 'No', 'Dropped. Not replaced.', 'total_ctc_minutes', 'Stored. Not used in a KPI.', 'Not in Power BI', 'Typo “Toal” is the source name. The app keeps the minutes.'],
  ['CentreArr', 'CentreArr', 'Yes', 'Not renamed. Not used on these pages.', 'centre_arr', 'Stored. Not used in a KPI.', 'Match', 'Both keep it unused.'],
  ['Truck @ Yard (GPS Based) (Date/Time)', 'Truck @ Yard (GPS Based) (Date/Time)', 'Yes', 'Not renamed. Not used on these pages.', 'truck_yard_gps_based', 'Stored. Not used in a KPI.', 'Match', 'Both keep it unused.'],
  ['(calculated) Report Date', 'Report Date', 'Calculated', 'If HOUR(Tare Weighment @ Centre) is 0–7 then that date minus 1 day, else that date. This is the date slicer.', 'report_date', 'The stored report_date', 'Match', 'Equals the Power BI rule on 300,152 of 300,458 rows (99.9%).'],
  ['(calculated) Holding Time (Center)', 'Holding Time (Center)', 'Calculated', 'DATEDIFF(Vehicle Arrival @ Center, Tare Weighment @ Centre, MINUTE) / 60', 'holding_time_center', 'The stored holding_time_center', 'Match', 'Equals that gap within 1 minute on 90.9% of rows. This is not WaitingTimeCnt. About 9% of rows were later overwritten with WaitingTimeCnt.'],
  ['(calculated) Truck Holding Time @ Center (Minutes)', 'Truck Holding Time @ Center (Minutes)', 'Calculated', 'DATEDIFF(Gross Weighment @ Centre, Challan Issue Time, MINUTE)', 'truck_holding_time_center_minutes', 'WaitingTimeCnt, stored in minutes', 'Match', '100% within 1 minute. This is the column the user described as CH_DEP_DATE minus gross weighment.'],
  ['(calculated) Truck Transit Time', 'Truck Transit Time', 'Calculated', 'DATEDIFF(Challan Issue Time, Kaccha Token, MINUTE) / 60', 'truck_transit_time', 'TravelHrCntYard / 60', 'Match', '99.7% within 1 minute.'],
  ['(calculated) Yard Waiting Time', 'Yard Waiting Time', 'Calculated', 'DATEDIFF(Kaccha Token, Gate Weighment Time, MINUTE) / 60', 'yard_waiting_time', 'WaitingTimeYard / 60', 'Match', '99.7% within 1 minute.'],
  ['(calculated) Unloading Time', 'Unloading Time', 'Calculated', 'DATEDIFF(Gate Weighment Time, Tare Weighment @ Mill, MINUTE) / 60', 'unloading_time', 'WaitingTimeDonga / 60', 'Match', '100% within 1 minute.'],
  ['(calculated) TruckHoldingTime(Center)', 'TruckHoldingTime(Center)', 'Calculated', 'MAX of WaitingTimeCnt inside the same Challan No., divided by 60', 'truck_holding_time_center', 'The stored truck holding hours', 'Match', 'Equals that challan max on 87.6% of rows (263,095 of 300,453). WaitingTimeCnt is not the same on every row of a challan.'],
  ['(calculated) Cane Holding Time', 'Cane Holding Time', 'Calculated', 'DATEDIFF(Vehicle Arrival @ Center, Gate Weighment Time, MINUTE) / 60. The KPI weights this by cane qty.', 'cane_holding_time', 'The stored cane holding hours, then weighted by cane qty', 'Match', 'Equals arrival to gate weighment within 1 minute on 90.7% of rows. It is not WaitingTimeCnt and it is not the sum of the four minute columns.'],
  ['(calculated) CuttoCenterTime', '—', 'Calculated', 'Not listed. Cannot be calculated from our data.', '—', 'Not calculated.', 'Omitted', 'Harvest (Date/Time) is filled on 295 of 300,458 rows and those times are in 2023–2024 while arrival is in 2026.'],
  ['(calculated) Crush Date', 'Crush Date', 'Calculated', 'Same 00:00–07:59 shift, using Tare Weighment @ Mill. Not placed on these pages.', '(none)', 'Not calculated', 'Not in app', 'In the model only.'],
  ['(measure) DevHoldingTime(%)', 'DevHoldingTime(%)', 'Measure', 'Rows with Holding Time (Center) >= 8, divided by all rows. Not placed on these pages.', '(none)', 'Not calculated. Gate yard uses > 8 hours, which is a different column.', 'Not in app', 'In the model only. The 8-hour test is center holding, and the cutoff is >= 8 rather than > 8.'],
  ['(measure) ExpectionChallan%', 'ExpectionChallan%', 'Measure', 'DISTINCTCOUNT of challans whose truck-holding minutes >= 4, divided by all challans. Not placed on these pages.', '(none)', 'Not calculated', 'Not in app', 'In the model only. Spelled Expection in Power BI.'],
];

const gateColumns = [
  ['v_code', 'v_code', 'Yes', 'Not renamed. The model does not drop blank v_code.', 'v_code', 'Every gate query requires v_code IS NOT NULL', 'Mismatch', 'The app excludes rows Power BI still counts.'],
  ['v_name', 'v_name', 'Yes', 'Not renamed. Not on the KPI pages.', 'v_name', 'Stored. Not on the KPI pages.', 'Match', 'Same column.'],
  ['g_code', 'g_code', 'Yes', 'Not renamed. Not on the KPI pages.', 'g_code', 'Stored. Not on the KPI pages.', 'Match', 'Same column.'],
  ['g_name', 'g_name', 'Yes', 'Not renamed. Not on the KPI pages.', 'g_name', 'Stored. Not on the KPI pages.', 'Match', 'Same column.'],
  ['g_father', 'g_father', 'Yes', 'Not renamed. Not on the KPI pages.', 'g_father', 'Stored. Not on the KPI pages.', 'Match', 'Same column.'],
  ['purchyno', 'purchyno', 'Yes', 'COUNT = No. of Purchy and the denominator of Avg Purchy Size', 'purchyno', 'COUNT(purchyno). Avg purchy = SUM(purchase_qtl) / COUNT(purchyno).', 'Match', 'Same role.'],
  ['SUP_MOD', 'SUP_MOD', 'Yes', 'Not renamed. Mode slicer and every gate split. No mode whitelist.', 'sup_mod', 'Kept only for 18 QCART, 36/45/63/99 QTROLLY, 99 QTRUCK. 99 modes group together in the filter.', 'Partial', 'Same column. The app drops other mode text and groups the two 99 modes.'],
  ['m_date', 'm_date', 'Yes', 'Gate trend axis. The page slicer is Report Date, related both ways to m_date.', 'm_date', 'Direct From–To filter', 'Match', 'Gate numbers use m_date. The slicer date is the center Report Date, which matches Power BI on 99.9% of center rows.'],
  ['PUR_ISSUE_DT', 'PUR_ISSUE_DT', 'Yes', 'Not used on these pages', 'pur_issue_dt', 'Stored. Not used in a KPI.', 'Match', 'Both keep it unused.'],
  ['PUR_WEIGHT_DT', 'PUR_WEIGHT_DT', 'Yes', 'Not used on these pages', 'pur_weight_dt', 'Stored. Not used in a KPI.', 'Match', 'Both keep it unused.'],
  ['CutDate', 'CutDate', 'Yes', 'Not used in a listed formula.', 'cut_date', 'On Gate Records. Not used in a dashboard formula.', 'Omitted', 'Filled on 255 of 105,912 gate rows. Those times are in 2023–2024.'],
  ['KACHATOKENDATETIME', 'KACHATOKENDATETIME', 'Yes', 'Not used in the gate measures', 'kacha_token_datetime', 'Stored. Not used in a gate KPI.', 'Match', 'Both keep it unused on gate KPIs.'],
  ['Tokendatetime', 'Tokendatetime', 'Yes', 'Start of Yard Holding Time', 'token_datetime', 'TokenToGross is the minutes from this clock to gross.', 'Match', 'Same clock. The stored minutes are that gap.'],
  ['Grossdatetime', 'Grossdatetime', 'Yes', 'End of Yard Holding Time and start of UnloadingTime', 'gross_datetime', 'Used through TokenToGross and GrossToTare.', 'Match', 'Same clocks.'],
  ['TAREdatetime', 'TAREdatetime', 'Yes', 'End of UnloadingTime', 'tare_datetime', 'GrossToTare is the minutes from gross to this clock.', 'Match', '100% of rows with a real time on both clocks match within 1 minute.'],
  ['Purchase_QTL', 'Purchase_QTL', 'Yes', 'SUM = cane. Overrun = AVERAGE(Purchase_QTL) − 18/36/63/99.', 'purchase_qtl', 'SUM = cane. Overrun = AVERAGE(purchase_qtl) − 18/36/45/63/99.', 'Partial', 'Same quantity. 45 exists only in the app. 99 QTRUCK exists only in the app overrun.'],
  ['GrossToTare', 'Removed from the model', 'No', 'Power BI recalculates DATEDIFF(Grossdatetime, TAREdatetime, MINUTE) / 60.', 'unloading_time', 'GrossToTare / 60. Dev count is rows above 0.5 hours.', 'Match', 'Same formula. 69,340 of 69,340 rows with a real time on both clocks match within 1 minute.'],
  ['TokenToGross', 'Removed from the model', 'No', 'Power BI recalculates DATEDIFF(Tokendatetime, Grossdatetime, MINUTE) / 60.', 'yard_holding_time', 'TokenToGross / 60. Dev count is rows above 8 hours.', 'Match', 'Same formula. 80% of rows with a real time on both clocks match within 1 minute. About 36,000 timestamps were saved as midnight, so those cannot be rechecked.'],
  ['CutToToken', 'Removed from the model', 'No', 'Not used in a listed formula.', 'cut_to_token_time', 'On Gate Records. Not used in a dashboard formula.', 'Omitted', 'Filled on the same 255 gate rows as CutDate.'],
  ['CTC', 'Removed', 'No', 'Dropped. Not replaced by a measure on these pages.', 'ctc_minutes', 'Stored. Not used in a KPI.', 'Not in Power BI', 'The app keeps the minutes.'],
  ['(calculated) Yard Holding Time', 'Yard Holding Time', 'Calculated', 'DATEDIFF(Tokendatetime, Grossdatetime, MINUTE) / 60. Deviations = count of rows > 8.', 'yard_holding_time', 'TokenToGross / 60. Count of rows > 8.', 'Match', 'Same formula. See TokenToGross.'],
  ['(calculated) UnloadingTime', 'UnloadingTime', 'Calculated', 'DATEDIFF(Grossdatetime, TAREdatetime, MINUTE) / 60. DeviationsUT = count of rows > 0.5.', 'unloading_time', 'GrossToTare / 60. Count of rows > 0.5.', 'Match', 'Same formula. 100% where both clocks have a time.'],
  ['(calculated) CuttoTokenTime', '—', 'Calculated', 'Not listed. Cannot be calculated from our data.', '—', 'Not calculated.', 'Omitted', 'CutDate is filled on 255 of 105,912 gate rows and those times are in 2023–2024 while the token time is in 2026.'],
  ['(measure) Avg Purchy Size', 'Avg Purchy Size', 'Measure', 'SUM(Purchase_QTL) / COUNT(purchyno)', 'purchase_qtl, purchyno', 'SUM(purchase_qtl) / COUNT(purchyno)', 'Match', 'Same formula.'],
  ['(measure) Deviations', 'Deviations', 'Measure', 'COUNTROWS where Yard Holding Time > 8', 'yard_holding_time', 'Count where yard_holding_time > 8', 'Match', 'Same cutoff on the same hour column.'],
  ['(measure) DeviationsUT', 'DeviationsUT', 'Measure', 'COUNTROWS where UnloadingTime > 0.5', 'unloading_time', 'Count where unloading_time > 0.5', 'Match', 'Same cutoff on the same hour column.'],
  ['(measure) Vehicles exceeding Holding Time', 'Vehicles exceeding Holding Time', 'Measure', 'Deviations / COUNT(SUP_MOD). Shown as a percent on the Gate 2 trend.', 'yard_holding_time', 'The Gate 2 trend is the count of rows > 8, not the percent.', 'Mismatch', 'Power BI divides by the mode count. The app does not.'],
  ['(measure) Over 18Q / 36Q / 63Q / 99Q', 'Over 18Q, Over 36Q, Over 63Q, Over 99Q', 'Measure', 'AVERAGE(Purchase_QTL) − 18, 36, 63 or 99 for that exact SUP_MOD. Over 99Q is 99 QTROLLY only. No Over 45Q.', 'purchase_qtl, sup_mod', 'AVERAGE(purchase_qtl) − 18/36/45/63/99. 99 covers QTROLLY and QTRUCK.', 'Mismatch', '45 is missing in Power BI. 99 QTRUCK is missing in Power BI and the 99 label says QTRUCK while the filter is QTROLLY.'],
];

const centerMaster = [
  ['Center Code', 'Center Code', 'In the Center Data table. Not on a KPI visual.', 'Not used', 'Not in app', 'The app has no center-master table.'],
  ['Center Name', 'Center Name', 'Slicer on Center Purchase only. It filters Indent, then Report Date. It does not filter CntPerformance[Center].', 'center on cnt_performance', 'Mismatch', 'The name matches a center, but the filter path is different. See Center Purchase.'],
  ['Latitude', 'Latitude', 'Loaded. Hidden in the model. Not on these pages.', 'Not used', 'Not in app', 'Map coordinate only.'],
  ['Longitude', 'Longitude', 'Loaded. Not on these pages.', 'Not used', 'Not in app', 'Map coordinate only.'],
  ['No. of Villages', 'No. of Villages', 'Loaded. Not on these pages.', 'Not used', 'Not in app', 'Master attribute only.'],
  ['No. of Growers', 'No. of Growers', 'Loaded. Not on these pages.', 'Not used', 'Not in app', 'Master attribute only.'],
  ['No. of Bonded Growers', 'No. of Bonded Growers', 'Loaded. Not on these pages.', 'Not used', 'Not in app', 'Master attribute only.'],
  ['Total Bonding', 'Total Bonding', 'Loaded. Not on these pages.', 'Not used', 'Not in app', 'Master attribute only.'],
  ['Last Year Total Supply', 'Last Year Total Supply', 'Loaded. Not on these pages.', 'Not used', 'Not in app', 'Master attribute only.'],
  ['Indent Till Date', 'Indent Till Date', 'Loaded. Not on these pages.', 'Not used', 'Not in app', 'Master attribute only.'],
  ['Supply Till Date', 'Supply Till Date', 'Loaded. Not on these pages.', 'Not used', 'Not in app', 'Master attribute only.'],
  ['Target Cane Procurement', 'Target Cane Procurement', 'Loaded. Not on these pages.', 'Not used', 'Not in app', 'Master attribute only.'],
  ['Cul. Area', 'Cul. Area', 'Loaded. Not on these pages.', 'Not used', 'Not in app', 'Master attribute only.'],
  ['Final Survey Area (of Members)', 'Final Survey Area (of Members)', 'Loaded. Not on these pages.', 'Not used', 'Not in app', 'Master attribute only.'],
  ['Bonded Area', 'Bonded Area', 'Loaded. Not on these pages.', 'Not used', 'Not in app', 'Master attribute only.'],
  ['Column16', 'Column16', 'Empty import column', 'Not used', 'Not in app', 'No header in the source sheet.'],
  ['Column17', 'Column17', 'Empty import column', 'Not used', 'Not in app', 'No header in the source sheet.'],
  ['Column18', 'Column18', 'Empty import column', 'Not used', 'Not in app', 'No header in the source sheet.'],
  ['Column19', 'Column19', 'Empty import column', 'Not used', 'Not in app', 'No header in the source sheet.'],
  ['(measure) Days', 'Days', 'MAX(Purchase2[Purchase Date]) − 27 Oct 2024, plus 1. Not on these pages.', 'Operating Days = calendar days from From to To, including both ends', 'Mismatch', 'Power BI counts days from a fixed season start on the purchase file. The app counts the days in the selected range.'],
  ['CenterDist Distance', 'Distance', 'Used on Truck Transit Time. Source file is Center Distance 2023-2024, matched on center name.', 'dist = 0', 'Not in app', 'See Truck Transit Time.'],
];

/** Yellow export headers, written the same way as the season export workbook. */
const Y = {
  gateOver: 'Overrun (Qtls) = Purchase_QTL (Qtls) − capacity of SUP_MOD (18 QCART = 18, 36 QTROLLY = 36, 45 QTROLLY = 45, 63 QTROLLY = 63, 99 QTROLLY or 99 QTRUCK = 99). Blank when Purchase_QTL (Qtls) is blank or 0.',
  yard: 'Yard Holding (Hrs) = TokenToGross (Min) ÷ 60',
  yard8: 'Yard > 8 Hrs (1 = Yes) = 1 when TokenToGross (Min) ÷ 60 is more than 8, otherwise 0',
  gateDonga: 'Time at Donga (Hrs) = GrossToTare (Min) ÷ 60',
  donga05: 'Donga > 0.5 Hrs (1 = Yes) = 1 when GrossToTare (Min) ÷ 60 is more than 0.5, otherwise 0',
  cntOver: 'Overrun (Qtls) = Purchased Quantity (Qtl.) − capacity of Mode Name of Transport (18 QCART = 18, 36 QTROLLY = 36, 45 QTROLLY = 45, 63 QTROLLY = 63). Blank when Purchased Quantity (Qtl.) is blank or 0, or the mode is blank.',
  hold: 'Center Holding (Hrs) = WaitingTimeCnt (Min) ÷ 60',
  transit: 'Truck Transit (Hrs) = TravelHrCntYard (Min) ÷ 60',
  yardWait: 'Yard Waiting (Hrs) = WaitingTimeYard (Min) ÷ 60',
  cntDonga: 'Time at Donga (Hrs) = WaitingTimeDonga (Min) ÷ 60',
  truck: 'Truck Holding (Hrs) = WaitingTimeCnt (Min) ÷ 60',
  truckKpi: 'Truck Holding for KPI (Hrs) = WaitingTimeCnt (Min) ÷ 60',
  cane: 'Cane Holding (Hrs) = (WaitingTimeCnt (Min) + TravelHrCntYard (Min) + WaitingTimeYard (Min) + WaitingTimeDonga (Min)) ÷ 60. Blank when all four minute columns are blank.',
};

function cell(sheet, column, formula, yellow) {
  return { sheet, column, formula, yellow: yellow || '—' };
}

function col(column, formula, yellow) {
  return { column, formula, yellow: yellow || '' };
}

const G = 'Gate Records';
const C = 'Center Records';

/** App formula for each dashboard row, written with export-sheet column names. */
const EXPORT_APP = {
  'Procurement Summary': {
    'Total Trips': cell(C, 'CHALLAN', 'Count of distinct CHALLAN, where C.Name is not blank'),
    'Avg Transit Time (Hrs)': cell(C, 'Truck Transit (Hrs)', 'Average of Truck Transit (Hrs)', Y.transit),
    'Truck Holding Time (H)': cell(C, 'Truck Holding for KPI (Hrs)', 'Average of Truck Holding for KPI (Hrs)', Y.truckKpi),
    'Waiting Time (Hrs)': cell(C, 'Yard Waiting (Hrs)', 'Average of Yard Waiting (Hrs)', Y.yardWait),
    'Cane Holding Time (Hrs)': cell(C, 'Cane Holding (Hrs)', 'Sum of (Cane Holding (Hrs) × Purchased Quantity (Qtl.)) ÷ Sum of Purchased Quantity (Qtl.), only on rows where Cane Holding (Hrs) is not blank', Y.cane),
    'Time at Donga (Hrs)': cell(C, 'Time at Donga (Hrs)', 'Average of Time at Donga (Hrs)', Y.cntDonga),
    'Center table — Vehicles': cell(C, 'Purchy No.', 'Count of Purchy No. by Mode Name of Transport'),
    'Center table — Cane (Q)': cell(C, 'Purchased Quantity (Qtl.)', 'Sum of Purchased Quantity (Qtl.) by Mode Name of Transport'),
    'Center table — Time (Hrs)': cell(C, 'Center Holding (Hrs)', 'Average of Center Holding (Hrs) by Mode Name of Transport', Y.hold),
    'Center holding table': cell(C, 'Center Holding (Hrs)', 'Average of Center Holding (Hrs) by Mode Name of Transport', Y.hold),
    'Gate table — Vehicles': cell(G, 'purchyno', 'Count of purchyno by SUP_MOD. Rows kept only when v_code is not blank and SUP_MOD is 18 QCART, 36 QTROLLY, 45 QTROLLY, 63 QTROLLY, 99 QTROLLY, or 99 QTRUCK.'),
    'Gate table — Cane (Q)': cell(G, 'Purchase_QTL (Qtls)', 'Sum of Purchase_QTL (Qtls) by SUP_MOD, on the same rows as the vehicle count'),
    'Gate table — Time (Hrs)': cell(G, 'Yard Holding (Hrs)', 'Average of Yard Holding (Hrs) by SUP_MOD', Y.yard),
    'Yard table — Avg Time': cell(G, 'Yard Holding (Hrs)', 'Average of Yard Holding (Hrs) by SUP_MOD', Y.yard),
    'Yard table — Dev (>8H)': cell(G, 'Yard > 8 Hrs (1 = Yes)', 'Sum of Yard > 8 Hrs (1 = Yes) by SUP_MOD', Y.yard8),
    'Mill table — Avg Time': cell(G, 'Time at Donga (Hrs)', 'Average of Time at Donga (Hrs) by SUP_MOD', Y.gateDonga),
    'Mill table — Dev (>0.5H)': cell(G, 'Donga > 0.5 Hrs (1 = Yes)', 'Sum of Donga > 0.5 Hrs (1 = Yes) by SUP_MOD', Y.donga05),
    'Date slicer': cell(C, 'Weighment Date (Purchy)', 'Filter Weighment Date (Purchy) between From and To'),
  },
  'Gate 1': {
    'Cane Purchased': cell(G, 'Purchase_QTL (Qtls)', 'Sum of Purchase_QTL (Qtls)'),
    'No. of Purchy': cell(G, 'purchyno', 'Count of purchyno'),
    'Avg Purchy Size': cell(G, 'Purchase_QTL (Qtls), purchyno', 'Sum of Purchase_QTL (Qtls) ÷ Count of purchyno'),
    'Mode slicer': cell(G, 'SUP_MOD', 'Optional filter on SUP_MOD. 99 QTROLLY and 99 QTRUCK are grouped together.'),
    'Date slicer': cell(G, 'm_date', 'Filter m_date between From and To'),
    'Overrun 18 QCART': cell(G, 'Overrun (Qtls)', 'Average of Overrun (Qtls) where SUP_MOD = 18 QCART', Y.gateOver),
    'Overrun 36 QTROLLY': cell(G, 'Overrun (Qtls)', 'Average of Overrun (Qtls) where SUP_MOD = 36 QTROLLY', Y.gateOver),
    'Overrun 45 QTROLLY': cell(G, 'Overrun (Qtls)', 'Average of Overrun (Qtls) where SUP_MOD = 45 QTROLLY, and this mode is included in the average-of-modes KPI', Y.gateOver),
    'Overrun 63 QTROLLY': cell(G, 'Overrun (Qtls)', 'Average of Overrun (Qtls) where SUP_MOD = 63 QTROLLY', Y.gateOver),
    'Overrun 99': cell(G, 'Overrun (Qtls)', 'Average of Overrun (Qtls) where SUP_MOD is 99 QTROLLY or 99 QTRUCK', Y.gateOver),
    'Avg Parchy Overrun KPI': cell(G, 'Overrun (Qtls)', 'Unweighted average of the per-mode Overrun (Qtls) averages', Y.gateOver),
    'Purchase split donut': cell(G, 'SUP_MOD, Purchase_QTL (Qtls)', 'Sum of Purchase_QTL (Qtls) by SUP_MOD'),
    'No. of Vehicles chart': cell(G, 'SUP_MOD, purchyno', 'Count of purchyno by SUP_MOD'),
    'Cane Purchase Trend': cell(G, 'm_date, Purchase_QTL (Qtls)', 'Sum of Purchase_QTL (Qtls) by m_date'),
    'Purchi Overrun Trend': cell(G, 'Overrun (Qtls)', 'By m_date and SUP_MOD: average of Overrun (Qtls), including 45 QTROLLY and both 99 modes', Y.gateOver),
  },
  'Gate 2': {
    'No. of Carts / Trollies / Trucks': cell(G, 'SUP_MOD, purchyno', 'Count of purchyno for that SUP_MOD. The 99 card counts rows whose SUP_MOD contains 99 (99 QTROLLY and 99 QTRUCK).'),
    'Min Yard Holding (Hrs)': cell(G, 'Yard Holding (Hrs)', 'Minimum of Yard Holding (Hrs) for the mode', Y.yard),
    'Avg Yard Holding (Hrs)': cell(G, 'Yard Holding (Hrs)', 'Average of Yard Holding (Hrs) for the mode', Y.yard),
    'Max Yard Holding (Hrs)': cell(G, 'Yard Holding (Hrs)', 'Maximum of Yard Holding (Hrs) for the mode', Y.yard),
    'Vehicles exceeding Holding Time': cell(G, 'Yard > 8 Hrs (1 = Yes)', 'Sum of Yard > 8 Hrs (1 = Yes) for the mode', Y.yard8),
    'Total Vehicles KPI': cell(G, 'purchyno', 'Sum of the four mode cards only (18 QCART, 36 QTROLLY, 63 QTROLLY, and 99). 45 QTROLLY is excluded.'),
    'Avg Yard Holding KPI': cell(G, 'Yard Holding (Hrs)', 'Unweighted average of the four mode averages that are above zero', Y.yard),
    'Max Yard Holding KPI': cell(G, 'Yard Holding (Hrs)', 'Maximum of the four mode maximums', Y.yard),
    'Vehicles Exceeding KPI': cell(G, 'Yard > 8 Hrs (1 = Yes)', 'Sum of Yard > 8 Hrs (1 = Yes) across the four mode cards', Y.yard8),
    'Average Yard Holding Time trend': cell(G, 'Yard Holding (Hrs)', 'Average of Yard Holding (Hrs) by m_date and SUP_MOD, including 45 QTROLLY', Y.yard),
    'Vehicles exceeding standard holding trend': cell(G, 'Yard > 8 Hrs (1 = Yes)', 'Sum of Yard > 8 Hrs (1 = Yes) by m_date and SUP_MOD. This is a count, not a percent.', Y.yard8),
    'Date slicer': cell(G, 'm_date', 'Filter m_date between From and To'),
  },
  'Center Purchase': {
    'Cane Purchased (Qtls)': cell(C, 'Purchased Quantity (Qtl.)', 'Sum of Purchased Quantity (Qtl.), where C.Name is not blank'),
    'No. of Purchy': cell(C, 'Purchy No.', 'Count of Purchy No.'),
    'Avg Parchi Size (Qtls)': cell(C, 'Purchased Quantity (Qtl.), Purchy No.', 'Sum of Purchased Quantity (Qtl.) ÷ Count of Purchy No.'),
    'Trips (C to G)': cell(C, 'CHALLAN', 'Count of distinct CHALLAN'),
    'Overrun 18': cell(C, 'Overrun (Qtls)', 'Average of Overrun (Qtls) where Mode Name of Transport = 18 QCART', Y.cntOver),
    'Overrun 36': cell(C, 'Overrun (Qtls)', 'Average of Overrun (Qtls) where Mode Name of Transport = 36 QTROLLY', Y.cntOver),
    'Overrun 45': cell(C, 'Overrun (Qtls)', 'Average of Overrun (Qtls) where Mode Name of Transport = 45 QTROLLY', Y.cntOver),
    'Overrun 63': cell(C, 'Overrun (Qtls)', 'Average of Overrun (Qtls) where Mode Name of Transport = 63 QTROLLY', Y.cntOver),
    'Overrun 99': cell(C, 'Overrun (Qtls)', '99 modes are left out. Overrun (Qtls) is blank for them.', Y.cntOver),
    'Avg Parchi Overrun KPI': cell(C, 'Overrun (Qtls)', 'Unweighted average of the per-mode Overrun (Qtls) averages', Y.cntOver),
    'Purchase split': cell(C, 'Mode Name of Transport, Purchased Quantity (Qtl.)', 'Sum of Purchased Quantity (Qtl.) by Mode Name of Transport'),
    'Cane Purchase Trend': cell(C, 'Weighment Date (Purchy), Purchased Quantity (Qtl.)', 'Sum of Purchased Quantity (Qtl.) by Weighment Date (Purchy)'),
    'Parchi Overrun Trend': cell(C, 'Overrun (Qtls)', 'By Weighment Date (Purchy) and Mode Name of Transport: average of Overrun (Qtls)', Y.cntOver),
    'Top 10 centers — cane': cell(C, 'C.Name, Purchased Quantity (Qtl.)', 'Sum of Purchased Quantity (Qtl.) by C.Name, highest 10'),
    'Top 10 centers — avg parchie': cell(C, 'C.Name, Purchased Quantity (Qtl.), Purchy No.', 'Sum of Purchased Quantity (Qtl.) ÷ Count of Purchy No. for those same 10 centers'),
    'Bottom 10 centers — cane and avg': cell(C, 'C.Name, Purchased Quantity (Qtl.), Purchy No.', 'Lowest 10 C.Name by Sum of Purchased Quantity (Qtl.). The line is that sum ÷ Count of Purchy No.'),
    'Mode slicer': cell(C, 'Mode Name of Transport', 'Optional filter on Mode Name of Transport. 99 QTROLLY and 99 QTRUCK are grouped together.'),
    'Center slicer': cell(C, 'C.Name', 'C.Name = the selected center'),
  },
  'Center Vehicle Handling': {
    'Vehicle Handled': cell(C, 'Purchy No.', 'Count of Purchy No., where C.Name is not blank'),
    'Mode wise split': cell(C, 'Mode Name of Transport, Purchy No.', 'Count of Purchy No. by Mode Name of Transport'),
    'Vehicle handling trend': cell(C, 'Weighment Date (Purchy), Mode Name of Transport, Purchy No.', 'Count of Purchy No. by Weighment Date (Purchy) and Mode Name of Transport'),
    'Centers with most vehicles (top 10)': cell(C, 'C.Name, Mode Name of Transport, Purchy No.', 'Count of Purchy No. by C.Name and Mode Name of Transport. Ten centers with the highest total. Mode columns are 18, 36, 45 and 63.'),
    'Centers with least vehicles (bottom 10)': cell(C, 'C.Name, Purchy No.', 'Count of Purchy No. by C.Name, lowest 10'),
    'Center slicer': cell(C, 'C.Name', 'C.Name = the selected center'),
    'Mode slicer': cell(C, 'Mode Name of Transport', 'Optional filter on Mode Name of Transport. 99 modes are grouped together.'),
    'Date slicer': cell(C, 'Weighment Date (Purchy)', 'Filter Weighment Date (Purchy) between From and To'),
  },
  'Vehicle Holding': {
    'Avg holding by mode': cell(C, 'Center Holding (Hrs)', 'Average of Center Holding (Hrs) by Mode Name of Transport', Y.hold),
    'Avg holding trend': cell(C, 'Center Holding (Hrs)', 'Average of Center Holding (Hrs) by Weighment Date (Purchy) and Mode Name of Transport', Y.hold),
    'Vehicle vs holding plot': cell(C, 'Center Holding (Hrs), Purchy No.', 'One point per C.Name and Mode Name of Transport: average of Center Holding (Hrs), and count of Purchy No.', Y.hold),
    'Center slicer': cell(C, 'C.Name', 'C.Name = the selected center'),
    'Mode slicer': cell(C, 'Mode Name of Transport', 'Optional filter on Mode Name of Transport'),
    'Date slicer': cell(C, 'Weighment Date (Purchy)', 'Filter Weighment Date (Purchy) between From and To'),
  },
  'Vehicle Holding 2': {
    'Holding time by center': cell(C, 'M_TokenDate_Time, Tare Weighment @ Centre (Grower) (Date/Time) (6)', 'Average, by C.Name, of the minutes from M_TokenDate_Time to Tare Weighment @ Centre (Grower) (Date/Time) (6), divided by 60'),
    'Vehicles by center': cell(C, 'Purchy No.', 'Count of Purchy No. by C.Name'),
    'Which centers are shown': cell(C, 'C.Name', 'Every C.Name in the date range, sorted by name. No top-10 cut.'),
    'Date slicer': cell(C, 'Weighment Date (Purchy)', 'Filter Weighment Date (Purchy) between From and To'),
    'Center slicer': cell(C, 'C.Name', 'C.Name = the selected center'),
    'Mode slicer': cell(C, 'Mode Name of Transport', 'Optional filter on Mode Name of Transport'),
  },
  'Truck Transit Time': {
    'Transit time by center': cell(C, 'Truck Transit (Hrs)', 'Average of Truck Transit (Hrs) by C.Name', Y.transit),
    'Distance': cell(C, '(not on Center Records)', 'No distance column on the export sheet. The app shows 0.'),
    'Trips': cell(C, 'CHALLAN', 'Count of distinct CHALLAN by C.Name'),
    'Cane on the trip': cell(C, 'Purchased Quantity (Qtl.)', 'Sum of Purchased Quantity (Qtl.) by C.Name'),
    'Which centers': cell(C, 'C.Name', 'All centers, highest Truck Transit (Hrs) first', Y.transit),
    'Date slicer': cell(C, 'Weighment Date (Purchy)', 'Filter Weighment Date (Purchy) between From and To'),
    'Center slicer': cell(C, 'C.Name', 'C.Name = the selected center'),
    'Mode slicer': cell(C, 'Mode Name of Transport', 'Optional filter on Mode Name of Transport'),
  },
  'Truck Holding': {
    'Holding time by center': cell(C, 'Truck Holding (Hrs)', 'Average of Truck Holding (Hrs) by C.Name', Y.truck),
    'Trips': cell(C, 'CHALLAN', 'Count of distinct CHALLAN'),
    'Cane quantity': cell(C, 'Purchased Quantity (Qtl.)', 'Sum of Purchased Quantity (Qtl.) by C.Name'),
    'Challan slicer': cell(C, 'CHALLAN', 'CHALLAN = the challan that was entered'),
    'Which centers': cell(C, 'C.Name', 'All centers, highest Truck Holding (Hrs) first', Y.truck),
    'Date slicer': cell(C, 'Weighment Date (Purchy)', 'Filter Weighment Date (Purchy) between From and To'),
    'Mode slicer': cell(C, 'Mode Name of Transport', 'Optional filter on Mode Name of Transport'),
  },
  Database: {
    'Purchy No.': cell(C, 'Purchy No.', 'Purchy No.'),
    Center: cell(C, 'C.Name', 'C.Name. A blank C.Name is shown as Gate.'),
    Grower: cell(C, 'G.Name', 'G.Name'),
    Vehicle: cell(C, 'V.Name', 'V.Name'),
    'Cane (Q)': cell(C, 'Purchased Quantity (Qtl.)', 'Purchased Quantity (Qtl.)'),
    'Challan No.': cell(C, 'CHALLAN', 'CHALLAN'),
    Mode: cell(C, 'Mode Name of Transport', 'Mode Name of Transport'),
    'Arrival / report date': cell(C, 'Weighment Date (Purchy)', 'Shown in the arrival column. The value is Weighment Date (Purchy), not M_TokenDate_Time.'),
    'Gross weighment at centre': cell(C, 'Gross Weighment @ Centre (Grower) (Date/Time)', 'On Center Records. Not shown on this tab.'),
    'Vehicle holding time': cell(C, 'Yard Waiting (Hrs)', 'Shown in the holding column. The value is Yard Waiting (Hrs).', Y.yardWait),
    'Tare at centre, challan issue, kaccha token, gate weighment, mill tare': cell(C, 'Tare Weighment @ Centre (Grower) (Date/Time) (6), CH_DEP_DATE, KTOKENDATETIME, TT_GRODATETIME, TT_DATE', 'On Center Records. Not shown on this tab.'),
    'Truck holding': cell(C, 'Time at Donga (Hrs)', 'Shown in the truck-holding column. The value is Time at Donga (Hrs).', Y.cntDonga),
    'Row limit': cell(C, 'Weighment Date (Purchy)', 'Latest 500 Center Records rows, ordered by Weighment Date (Purchy) descending'),
    'Date slicer': cell(C, 'Weighment Date (Purchy)', 'Filter Weighment Date (Purchy) between From and To. A blank C.Name is kept on this tab.'),
    'Center slicer': cell(C, 'C.Name', 'C.Name = the selected center'),
  },
};

/** Column-inventory rows, same export names. Yellow text is appended when the column is calculated. */
const COLUMN_EXPORT = {
  'C.Code': col('C.Code', 'On Center Records. Not used in a dashboard formula.'),
  'C.Name': col('C.Name', 'C.Name. Blank centers are excluded on center tabs.'),
  'V.Code': col('V.Code', 'On Center Records. Not used in a dashboard formula.'),
  'V.Name': col('V.Name', 'V.Name'),
  'G.Code': col('G.Code', 'On Center Records. Not used in a dashboard formula.'),
  'G.Name': col('G.Name', 'G.Name'),
  'G.Father': col('G.Father', 'On Center Records. Not shown on the dashboard tabs.'),
  'Purchy No.': col('Purchy No.', 'Count of Purchy No. Avg parchie = Sum of Purchased Quantity (Qtl.) ÷ Count of Purchy No.'),
  'Mode Code of Transport': col('Mode Code of Transport', 'On Center Records. The app filters by Mode Name of Transport, not this code.'),
  'Mode Name of Transport': col('Mode Name of Transport', 'Mode Name of Transport. 99 QTROLLY and 99 QTRUCK are treated as one mode when that filter is on.'),
  'Purchy Issue Date (SMS Date)': col('Purchy Issue Date (SMS Date)', 'On Center Records. Not the dashboard date filter.'),
  'Weighment Date (Purchy)': col('Weighment Date (Purchy)', 'The dashboard filters Weighment Date (Purchy).'),
  'Purchased Quantity (Qtl.)': col('Purchased Quantity (Qtl.)', 'Sum of Purchased Quantity (Qtl.) for cane. This is also the weight in the cane-holding average, and the quantity inside Overrun (Qtls).', Y.cntOver),
  'Harvest (Date/Time)': col('Harvest (Date/Time)', 'On Center Records. Not used in a dashboard formula.'),
  'Gross Weighment @ Centre (Grower) (Date/Time)': col('Gross Weighment @ Centre (Grower) (Date/Time)', 'Blue timestamp. WaitingTimeCnt (Min) is the minutes from this column to CH_DEP_DATE. Truck Holding (Hrs) is built from that.', Y.truck),
  'Tare Weighment @ Centre (Grower) (Date/Time) (6)': col('Tare Weighment @ Centre (Grower) (Date/Time) (6)', 'Blue timestamp. Vehicle Holding 2 uses the minutes from M_TokenDate_Time to this column, divided by 60. Weighment Date (Purchy) is the date taken from this clock.'),
  CHALLAN: col('CHALLAN', 'Count of distinct CHALLAN = trips. Truck Holding can filter one CHALLAN.'),
  CH_DEP_DATE: col('CH_DEP_DATE', 'Blue timestamp. End of WaitingTimeCnt (Min) and start of TravelHrCntYard (Min).'),
  M_TokenDate_Time: col('M_TokenDate_Time', 'Blue timestamp. Start of the Vehicle Holding 2 minutes, and start of the Power BI cane-holding gap.'),
  TT_TOKDATETIME: col('TT_TOKDATETIME', 'On Center Records. Not used in a dashboard formula.'),
  KTOKENDATETIME: col('KTOKENDATETIME', 'Blue timestamp. End of TravelHrCntYard (Min) and start of WaitingTimeYard (Min).'),
  TT_GRODATETIME: col('TT_GRODATETIME', 'Blue timestamp. End of WaitingTimeYard (Min) and start of WaitingTimeDonga (Min).'),
  TT_DATE: col('TT_DATE', 'Blue timestamp. End of WaitingTimeDonga (Min).'),
  TravelHrToCnt: col('TravelHrToCnt (Min)', 'On Center Records. Not used in a dashboard formula.'),
  WaitingTimeCnt: col('WaitingTimeCnt (Min)', 'Blue minute column. These yellow columns are WaitingTimeCnt (Min) ÷ 60.', `${Y.hold}\n${Y.truck}\n${Y.truckKpi}`),
  TravelHrCntYard: col('TravelHrCntYard (Min)', 'Blue minute column.', Y.transit),
  WaitingTimeYard: col('WaitingTimeYard (Min)', 'Blue minute column.', Y.yardWait),
  WaitingTimeDonga: col('WaitingTimeDonga (Min)', 'Blue minute column.', Y.cntDonga),
  ToalTimeCTC: col('ToalTimeCTC (Min)', 'On Center Records. Not used in a dashboard formula.'),
  CentreArr: col('CentreArr', 'On Center Records. Not used in a dashboard formula.'),
  'Truck @ Yard (GPS Based) (Date/Time)': col('Truck @ Yard (GPS Based) (Date/Time)', 'On Center Records. Not used in a dashboard formula.'),
  '(calculated) Report Date': col('Weighment Date (Purchy)', 'The export sheet shows this day as Weighment Date (Purchy). It is not a yellow column.'),
  '(calculated) Holding Time (Center)': col('Center Holding (Hrs)', 'Average of Center Holding (Hrs)', Y.hold),
  '(calculated) Truck Holding Time @ Center (Minutes)': col('WaitingTimeCnt (Min)', 'WaitingTimeCnt (Min). This is the blue minute column, not a yellow column.'),
  '(calculated) Truck Transit Time': col('Truck Transit (Hrs)', 'Average of Truck Transit (Hrs)', Y.transit),
  '(calculated) Yard Waiting Time': col('Yard Waiting (Hrs)', 'Average of Yard Waiting (Hrs)', Y.yardWait),
  '(calculated) Unloading Time': col('Time at Donga (Hrs)', 'Average of Time at Donga (Hrs)', Y.cntDonga),
  '(calculated) TruckHoldingTime(Center)': col('Truck Holding (Hrs)', 'Average of Truck Holding (Hrs)', Y.truck),
  '(calculated) Cane Holding Time': col('Cane Holding (Hrs)', 'Weighted average: Sum of (Cane Holding (Hrs) × Purchased Quantity (Qtl.)) ÷ Sum of Purchased Quantity (Qtl.)', Y.cane),
  '(calculated) CuttoCenterTime': col('—', 'Not calculated.'),
  '(calculated) Crush Date': col('(not on the export sheet)', 'Not calculated on the export sheet.'),
  '(measure) DevHoldingTime(%)': col('(not a yellow column)', 'Not on the export sheet. Gate yard uses Yard > 8 Hrs (1 = Yes), which is a different column.', Y.yard8),
  '(measure) ExpectionChallan%': col('(not on the export sheet)', 'Not calculated on the export sheet.'),
  v_code: col('v_code', 'Every gate formula keeps a row only when v_code is not blank.'),
  v_name: col('v_name', 'On Gate Records. Not used in a dashboard formula.'),
  g_code: col('g_code', 'On Gate Records. Not used in a dashboard formula.'),
  g_name: col('g_name', 'On Gate Records. Not used in a dashboard formula.'),
  g_father: col('g_father', 'On Gate Records. Not used in a dashboard formula.'),
  purchyno: col('purchyno', 'Count of purchyno. Avg purchy = Sum of Purchase_QTL (Qtls) ÷ Count of purchyno.'),
  SUP_MOD: col('SUP_MOD', 'Kept only for 18 QCART, 36 QTROLLY, 45 QTROLLY, 63 QTROLLY, 99 QTROLLY, and 99 QTRUCK. The two 99 modes are grouped in the filter.'),
  m_date: col('m_date', 'Filter m_date between From and To. Gate trends use this date.'),
  PUR_ISSUE_DT: col('PUR_ISSUE_DT', 'On Gate Records. Not used in a dashboard formula.'),
  PUR_WEIGHT_DT: col('PUR_WEIGHT_DT', 'On Gate Records. Not used in a dashboard formula.'),
  CutDate: col('CutDate', 'On Gate Records. Not used in a dashboard formula.'),
  KACHATOKENDATETIME: col('KACHATOKENDATETIME', 'On Gate Records. Not used in a gate formula.'),
  Tokendatetime: col('Tokendatetime', 'Blue timestamp. Start of TokenToGross (Min), which is Yard Holding (Hrs).', Y.yard),
  Grossdatetime: col('Grossdatetime', 'Blue timestamp. End of TokenToGross (Min) and start of GrossToTare (Min).', `${Y.yard}\n${Y.gateDonga}`),
  TAREdatetime: col('TAREdatetime', 'Blue timestamp. End of GrossToTare (Min), which is Time at Donga (Hrs).', Y.gateDonga),
  Purchase_QTL: col('Purchase_QTL (Qtls)', 'Sum of Purchase_QTL (Qtls) for cane. Overrun (Qtls) subtracts the mode capacity from this column.', Y.gateOver),
  GrossToTare: col('GrossToTare (Min)', 'Blue minute column. Time at Donga (Hrs) and the donga flag are built from it.', `${Y.gateDonga}\n${Y.donga05}`),
  TokenToGross: col('TokenToGross (Min)', 'Blue minute column. Yard Holding (Hrs) and the 8-hour flag are built from it.', `${Y.yard}\n${Y.yard8}`),
  CutToToken: col('CutToToken (Min)', 'On Gate Records. Not used in a dashboard formula.'),
  CTC: col('CTC (Min)', 'On Gate Records. Not used in a dashboard formula.'),
  '(calculated) Yard Holding Time': col('Yard Holding (Hrs)', 'Average of Yard Holding (Hrs). Rows over 8 hours are Yard > 8 Hrs (1 = Yes).', `${Y.yard}\n${Y.yard8}`),
  '(calculated) UnloadingTime': col('Time at Donga (Hrs)', 'Average of Time at Donga (Hrs). Rows over 0.5 hours are Donga > 0.5 Hrs (1 = Yes).', `${Y.gateDonga}\n${Y.donga05}`),
  '(calculated) CuttoTokenTime': col('—', 'Not calculated.'),
  '(measure) Avg Purchy Size': col('Purchase_QTL (Qtls), purchyno', 'Sum of Purchase_QTL (Qtls) ÷ Count of purchyno'),
  '(measure) Deviations': col('Yard > 8 Hrs (1 = Yes)', 'Sum of Yard > 8 Hrs (1 = Yes)', Y.yard8),
  '(measure) DeviationsUT': col('Donga > 0.5 Hrs (1 = Yes)', 'Sum of Donga > 0.5 Hrs (1 = Yes)', Y.donga05),
  '(measure) Vehicles exceeding Holding Time': col('Yard > 8 Hrs (1 = Yes)', 'The Gate 2 trend is the sum of Yard > 8 Hrs (1 = Yes), not that sum divided by the mode count.', Y.yard8),
  '(measure) Over 18Q / 36Q / 63Q / 99Q': col('Overrun (Qtls)', 'Average of Overrun (Qtls) for 18, 36, 45, 63, and both 99 modes', Y.gateOver),
};

function withExport(name, rows) {
  const page = EXPORT_APP[name];
  if (!page) throw new Error(`No export formulas for sheet ${name}`);
  return rows.map((r) => {
    const a = page[r[0]];
    if (!a) throw new Error(`No export formula for ${name} / ${r[0]}`);
    return [r[0], r[1], r[2], r[3], r[4], a.sheet, a.column, a.formula, a.yellow, r[7], r[8]];
  });
}

function paintColumns(rows) {
  return rows.map((r) => {
    const a = COLUMN_EXPORT[r[0]];
    if (!a) throw new Error(`No export wording for column ${r[0]}`);
    return [r[0], r[1], r[2], r[3], a.column, a.formula, a.yellow || '—', r[6], r[7]];
  });
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLog';
  wb.created = new Date();

  for (const s of sheets) addSheet(wb, s.name, s.headers, withExport(s.name, s.rows), s.note);
  addSheet(
    wb,
    'Center Data Columns',
    COL_HEADERS,
    paintColumns(centerColumns),
    'Every CntPerformance column. Center data column is the live SQL name. Power BI name (renamed) is the name after Power Query. Calculated rows are columns Power BI adds and the source table does not have.',
  );
  addSheet(
    wb,
    'Gate Data Columns',
    COL_HEADERS,
    paintColumns(gateColumns),
    'Every G_CTC column. Power BI drops GrossToTare, TokenToGross and CTC, then rebuilds yard holding and donga time from the timestamps.',
  );
  addSheet(
    wb,
    'Center Master',
    ['Center Data column', 'Power BI name', 'Where Power BI uses it', 'App column', 'Match', 'Difference'],
    centerMaster,
    'The Center Data sheet inside Indent&Purchase.xlsx (villages, growers, bonding, target). None of these columns are in the DigiLog cane tables. Center Name is the only one that reaches a dashboard slicer, and it does not filter CntPerformance[Center] directly.',
  );
  addSheet(
    wb,
    'Live Column Check',
    ['Live calculated column', 'Power BI timestamp formula', 'Rows checked', 'Result', 'Match', 'What this means'],
    [
      ['WaitingTimeCnt', 'DATEDIFF(Gross Weighment @ Centre, CH_DEP_DATE, MINUTE)', '300,453', '91.2% exact, 100% within 1 minute', 'Match', 'This is truck-holding minutes. It is not cane holding and it is not center holding.'],
      ['TravelHrCntYard', 'DATEDIFF(CH_DEP_DATE, Kaccha Token, MINUTE)', '300,452', '90.6% exact, 99.7% within 1 minute', 'Match', 'The app divides this by 60 for transit time.'],
      ['WaitingTimeYard', 'DATEDIFF(Kaccha Token, Gate Weighment, MINUTE)', '300,429', '91.0% exact, 99.7% within 1 minute', 'Match', 'The app divides this by 60 for yard waiting.'],
      ['WaitingTimeDonga', 'DATEDIFF(Gate Weighment, Mill Tare, MINUTE)', '300,329', '95.3% exact, 100% within 1 minute', 'Match', 'The app divides this by 60 for center donga time.'],
      ['holding_time_center', 'DATEDIFF(Vehicle Arrival, Centre Tare, MINUTE) / 60', '300,419', '90.9% within 1 minute', 'Match', 'Center holding. About 9% of rows were later saved as WaitingTimeCnt and those do not match.'],
      ['cane_holding_time', 'DATEDIFF(Vehicle Arrival, Gate Weighment, MINUTE) / 60', '300,390', '90.7% within 1 minute', 'Match', 'Cane holding. It does not equal WaitingTimeCnt. The sum of the four minute columns matches this on only 10% of rows.'],
      ['truck_holding_time_center', 'MAX(WaitingTimeCnt) inside the challan / 60', '300,453', '87.6% equal the challan max', 'Match', 'WaitingTimeCnt differs across rows of the same challan on 37,016 of 37,478 challans. Power BI keeps the max.'],
      ['report_date', 'Centre tare date, moved back one day when the hour is 00:00–07:59', '300,458', '99.9% equal that rule', 'Match', 'Weighment Date equals that day on 98.8% of rows. The shift changes about 1%.'],
      ['GrossToTare (gate)', 'DATEDIFF(Grossdatetime, TAREdatetime, MINUTE)', '69,340 with a real time on both clocks', '100% within 1 minute', 'Match', 'About 36,000 gate timestamps are saved as midnight, so those clocks cannot be rechecked. The stored minutes are still the column both sides use.'],
      ['TokenToGross (gate)', 'DATEDIFF(Tokendatetime, Grossdatetime, MINUTE)', '68,403 with a real time on both clocks', '80% within 1 minute', 'Match', 'Same formula. The rows that miss are bad stored clocks, not a different calculation.'],
    ],
    'Each row was checked on the DigiLog copy of the live center and gate tables. “Within 1 minute” means the stored minute column and the Power BI timestamp gap differ by at most 1 minute.',
  );

  const summaryRows = mismatches.map((m) => [m.sheet, m.item, m.status, m.difference]);
  const order = { Mismatch: 0, 'Not in app': 1, 'Not in Power BI': 2, Partial: 3, Review: 4 };
  summaryRows.sort((a, b) => (order[a[2]] ?? 9) - (order[b[2]] ?? 9) || String(a[0]).localeCompare(String(b[0])));
  const n = (status) => summaryRows.filter((r) => r[2] === status).length;

  const summaryWb = new ExcelJS.Workbook();
  summaryWb.creator = wb.creator;
  summaryWb.created = wb.created;
  addSheet(
    summaryWb,
    'Mismatch Summary',
    ['Sheet', 'Item', 'Match', 'Difference'],
    summaryRows,
    `Read this sheet first. ${n('Mismatch')} mismatches, ${n('Partial')} partial, ${n('Not in app') + n('Not in Power BI')} missing on one side. Match rows stay on the page sheets. A row is left off this list when the Power BI formula cannot be calculated from our data. Each page writes the app formula with Gate Records or Center Records column names. When that column is yellow on the export sheet, the yellow-column formula is how it is built from the blue source columns. Mismatch means the formula or the column is different. Partial means the main math matches and a filter, a mode, or a rollup does not.`,
  );
  for (const ws of wb.worksheets) {
    const copy = summaryWb.addWorksheet(ws.name, {
      views: ws.views,
      pageSetup: ws.pageSetup,
    });
    copy.columns = ws.columns.map((col) => ({ width: col.width }));
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const target = copy.getRow(rowNumber);
      target.height = row.height;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const t = target.getCell(colNumber);
        t.value = cell.value;
        t.style = cell.style;
      });
    });
    copy.autoFilter = ws.autoFilter;
    if (ws._merges) {
      Object.keys(ws._merges).forEach((key) => {
        try { copy.mergeCells(key); } catch (e) { /* already merged */ }
      });
    }
  }

  await summaryWb.xlsx.writeFile(OUT);
  const counts = summaryRows.reduce((acc, r) => {
    acc[r[2]] = (acc[r[2]] || 0) + 1;
    return acc;
  }, {});
  console.log('Wrote', OUT);
  console.log(counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
