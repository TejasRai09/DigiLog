/**
 * Generate Cane Performance Dashboard — complete formula verification Excel.
 *
 * Usage (from DigiLog/backend):
 *   node scripts/generate-cane-performance-formulas-excel.js
 *
 * Output:
 *   DigiLog/docs/Cane_Performance_Dashboard_Formulas.xlsx
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const OUT = path.resolve(
  __dirname,
  '..',
  '..',
  'docs',
  'Cane_Performance_Dashboard_Formulas.xlsx'
);

const NAVY = '1F3864';
const TEAL = '0F7173';
const LIGHT = 'EBF5FB';
const AMBER = 'FFF8E1';
const GREEN = 'E8F5E9';
const WHITE = 'FFFFFF';

function styleHeader(row, fill = NAVY) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: WHITE }, size: 10 };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    c.alignment = { vertical: 'middle', wrapText: true, horizontal: 'center' };
  });
  row.height = 28;
}

function addTitle(ws, text, cols = 8) {
  ws.mergeCells(1, 1, 1, cols);
  const cell = ws.getCell(1, 1);
  cell.value = text;
  cell.font = { bold: true, size: 14, color: { argb: WHITE } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 26;
}

function setWidths(ws, widths) {
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
}

function addRows(ws, startRow, headers, rows, widths) {
  setWidths(ws, widths);
  const hr = ws.getRow(startRow);
  headers.forEach((h, i) => {
    hr.getCell(i + 1).value = h;
  });
  styleHeader(hr, TEAL);
  rows.forEach((vals, ri) => {
    const r = ws.getRow(startRow + 1 + ri);
    vals.forEach((v, i) => {
      const cell = r.getCell(i + 1);
      cell.value = v;
      cell.alignment = { wrapText: true, vertical: 'top' };
      cell.font = { size: 9 };
      if (ri % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
      }
    });
    r.height = Math.min(120, 18 + Math.ceil(String(vals[vals.length - 2] || '').length / 60) * 12);
  });
}

/** Shared filter rules applied across DigiLog / PBI parity */
const FILTERS = [
  ['Date (Gate / G_CTC)', 'G_CTC[m_date] / g_ctc.m_date', 'Between From and To (inclusive)', 'Gate 1, Gate 2, Gate tables on Procurement'],
  ['Date (Center / Cnt)', 'CntPerformance[Report Date] / cnt_performance.report_date', 'Between From and To (inclusive)', 'All center tabs + center KPIs on Procurement'],
  ['Gate row filter', 'G_CTC[v_code] IS NOT NULL', 'Direct gate vehicles only (DigiLog parity)', 'All G_CTC visuals'],
  ['Valid modes', "SUP_MOD / transport_mode LIKE %QCART%|%QTROLLY%|%QTRUCK%", 'Excludes junk numeric modes', 'All mode visuals'],
  ['Center rows', "Center IS NOT NULL AND Center <> ''", 'Center-sourced only', 'Center Purchase / Handling / Holding / Transit'],
  ['Transport Mode slicer', 'G_CTC[SUP_MOD] or CntPerformance[Transport Mode]', 'Optional; All = no filter', 'Per tab as in PBI'],
  ['Center slicer', 'CntPerformance[Center]', 'Optional; All = no filter', 'Center tabs'],
  ['Challan slicer', 'CntPerformance[Challan No.]', 'Optional text filter', 'Truck Holding tab'],
];

const DAX_MEASURES = [
  [
    'WA Cane Holding Time',
    'CntPerformance',
    'Procurement → Cane Holding Time (Hrs)',
    `WA Cane Holding Time =
DIVIDE(
    SUMX(
        CntPerformance,
        (DATEDIFF(CntPerformance[Vehicle Arrival @ Center], CntPerformance[Gate Weighment Time], MINUTE) / 60)
        * CntPerformance[Cane Qty (Qtls)]
    ),
    SUM(CntPerformance[Cane Qty (Qtls)]),
    0
)`,
    `DigiLog prefers imported cane_holding_time (hours):
SUM(cane_holding_time * cane_qty_qtls)
/ NULLIF(SUM(CASE WHEN cane_holding_time IS NOT NULL THEN cane_qty_qtls END),0)
WHERE report_date BETWEEN @from AND @to AND center IS NOT NULL`,
    'Weighted avg hours cane held (arrival→gate weighment) by cane qty',
  ],
  [
    'Deviations',
    'G_CTC',
    'Procurement Yard table Dev (>8H); Gate 2 cards',
    `Deviations = COUNTROWS(FILTER('G_CTC', 'G_CTC'[Yard Holding Time] > 8))`,
    `SUM(CASE WHEN yard_holding_time > 8 THEN 1 ELSE 0 END)
FROM g_ctc WHERE m_date BETWEEN @from AND @to AND v_code IS NOT NULL
[+ optional SUP_MOD filter]`,
    'Vehicles with yard holding > 8 hours',
  ],
  [
    'DeviationsUT',
    'G_CTC',
    'Procurement Mill table Dev (>0.5H)',
    `DeviationsUT = COUNTROWS(FILTER('G_CTC', 'G_CTC'[UnloadingTime] > 0.5))`,
    `SUM(CASE WHEN unloading_time > 0.5 THEN 1 ELSE 0 END)
FROM g_ctc WHERE m_date BETWEEN @from AND @to AND v_code IS NOT NULL`,
    'Vehicles with unloading/donga time > 0.5 hours',
  ],
  [
    'Vehicles exceeding Holding Time',
    'G_CTC',
    'Gate 2 trend chart',
    `Vehicles exceeding Holding Time = [Deviations] / COUNT(G_CTC[SUP_MOD])
(or daily count of Deviations by mode — DigiLog uses count of yard_holding_time > 8)`,
    `Per day/mode: COUNT(*) WHERE yard_holding_time > 8`,
    'Share or count of vehicles over standard yard hold',
  ],
  [
    'Avg Purchy Size',
    'G_CTC',
    'Gate 1 KPI',
    `Avg Purchy Size = DIVIDE(SUM(G_CTC[Purchase_QTL]), COUNT(G_CTC[purchyno]))`,
    `SUM(purchase_qtl) / NULLIF(COUNT(purchyno),0) FROM g_ctc ...`,
    'Average gate purchy size (Qtls)',
  ],
  [
    'Avg Parchi Size',
    'CntPerformance',
    'Center Purchase KPI + Top/Bottom charts',
    `Avg Parchi Size = SUM(CntPerformance[Cane Qty (Qtls)]) / COUNT(CntPerformance[Purchy No.])`,
    `SUM(cane_qty_qtls) / NULLIF(COUNT(purchy_no),0) FROM cnt_performance WHERE center IS NOT NULL`,
    'Average center parchi size (Qtls)',
  ],
  [
    'Over 18Q',
    'G_CTC',
    'Gate 1 overrun cards + trend',
    `Over 18Q =
CALCULATE (
    IF (
        COUNTROWS ( FILTER ( G_CTC, G_CTC[Purchase_QTL] > 0 ) ) > 0,
        AVERAGE ( [Purchase_QTL] ) - 18,
        BLANK()
    ),
    G_CTC[SUP_MOD] = "18 QCART"
)`,
    `AVG(purchase_qtl) - 18 WHERE sup_mod='18 QCART' AND purchase_qtl > 0`,
    'Avg overrun vs 18 QTL capacity',
  ],
  [
    'Over 36Q',
    'G_CTC',
    'Gate 1',
    `Same pattern as Over 18Q with SUP_MOD="36 QTROLLY" and -36`,
    `AVG(purchase_qtl)-36 WHERE sup_mod='36 QTROLLY' AND purchase_qtl>0`,
    '',
  ],
  [
    'Over 63Q',
    'G_CTC',
    'Gate 1',
    `Same pattern; SUP_MOD="63 QTROLLY"; -63`,
    `AVG(purchase_qtl)-63 WHERE sup_mod='63 QTROLLY'`,
    '',
  ],
  [
    'Over 99Q',
    'G_CTC',
    'Gate 1 (display as 99 QTRUCK)',
    `Same pattern; SUP_MOD="99 QTROLLY"; -99`,
    `AVG(purchase_qtl)-99 WHERE sup_mod IN ('99 QTROLLY','99 QTRUCK')`,
    '',
  ],
  [
    'Overrun18',
    'CntPerformance',
    'Center Purchase overrun cards + trend',
    `Overrun18 =
CALCULATE (
    IF (
        COUNTROWS ( FILTER ( CntPerformance, CntPerformance[Cane Qty (Qtls)] > 0 ) ) > 0,
        AVERAGE ( CntPerformance[Cane Qty (Qtls)] ) - 18,
        BLANK()
    ),
    CntPerformance[Transport Mode] = "18 QCART"
)`,
    `AVG(cane_qty_qtls)-18 WHERE transport_mode='18 QCART' AND cane_qty_qtls>0 AND center IS NOT NULL`,
    'Center parchi overrun vs 18',
  ],
  [
    'Overrun36 / Overrun45 / Overrun63',
    'CntPerformance',
    'Center Purchase',
    `Same as Overrun18 with modes 36/45/63 QTROLLY and subtract 36/45/63`,
    `AVG(cane_qty_qtls) - capacity WHERE transport_mode = mode`,
    '',
  ],
];

const COLUMNS = [
  ['g_ctc / G_CTC', 'm_date', 'Date', 'Date filter, purchase & overrun trends'],
  ['g_ctc / G_CTC', 'sup_mod', 'SUP_MOD', 'Mode filter, pies, cards, charts'],
  ['g_ctc / G_CTC', 'v_code', 'v_code', 'Gate-only filter (IS NOT NULL)'],
  ['g_ctc / G_CTC', 'purchyno', 'purchyno', 'Vehicle / purchy counts'],
  ['g_ctc / G_CTC', 'purchase_qtl', 'Purchase_QTL', 'Cane purchased, avg size, overrun'],
  ['g_ctc / G_CTC', 'yard_holding_time', 'Yard Holding Time', 'Yard avg/min/max, Deviations >8'],
  ['g_ctc / G_CTC', 'unloading_time', 'UnloadingTime', 'Mill avg, DeviationsUT >0.5'],
  ['cnt_performance / CntPerformance', 'report_date', 'Report Date', 'Date filter + trends'],
  ['cnt_performance / CntPerformance', 'transport_mode', 'Transport Mode', 'Mode filter / splits'],
  ['cnt_performance / CntPerformance', 'center', 'Center', 'Center filter / rankings'],
  ['cnt_performance / CntPerformance', 'challan_no', 'Challan No.', 'Trips DISTINCT; challan filter'],
  ['cnt_performance / CntPerformance', 'purchy_no', 'Purchy No.', 'Vehicle / purchy counts'],
  ['cnt_performance / CntPerformance', 'cane_qty_qtls', 'Cane Qty (Qtls)', 'Cane, avg parchi, WA weight'],
  ['cnt_performance / CntPerformance', 'holding_time_center', 'Holding Time (Center)', 'Center holding KPIs'],
  ['cnt_performance / CntPerformance', 'truck_transit_time', 'Truck Transit Time', 'Transit KPIs / lists'],
  ['cnt_performance / CntPerformance', 'truck_holding_time_center', 'TruckHoldingTime(Center)', 'Truck holding lists'],
  ['cnt_performance / CntPerformance', 'yard_waiting_time', 'Yard Waiting Time', 'Procurement yard wait card'],
  ['cnt_performance / CntPerformance', 'unloading_time', 'Unloading Time', 'Time at Donga card'],
  ['cnt_performance / CntPerformance', 'cane_holding_time', 'WA Cane Holding Time (col/measure)', 'Cane holding KPI'],
  ['cnt_performance / CntPerformance', 'grower', 'Grower', 'Database tab display'],
  ['cnt_performance / CntPerformance', 'v_name', 'Vehicle name', 'Database tab display'],
  ['CenterDist (PBI only)', 'Distance', 'Distance', 'Truck Transit Dist. column — not in DigiLog MySQL yet'],
];

/** Tab → section → metric rows: [Section, Visual, Metric Label, Formula Type, Table, Field/Measure, DAX or Aggregation, DigiLog SQL / note, Verify tip] */
const TAB_SECTIONS = {
  '04_Procurement': [
    ['Filters', 'Date slicer', 'Report Date', 'Filter', 'CntPerformance', 'Report Date', 'CntPerformance[Report Date]', 'Applies to center metrics; DigiLog also applies m_date to gate', 'Change range and recompute all'],
    ['Farm / Gate Vehicles', 'Gate Vehicles table', 'Mode', 'Column', 'G_CTC', 'SUP_MOD', 'G_CTC[SUP_MOD]', 'GROUP BY sup_mod', 'Match mode list'],
    ['Farm / Gate Vehicles', 'Gate Vehicles table', 'Vehicles', 'Aggregation', 'G_CTC', 'purchyno', 'COUNT(G_CTC[purchyno])', 'COUNT(purchyno) WHERE v_code IS NOT NULL', 'Total vehicles'],
    ['Farm / Gate Vehicles', 'Gate Vehicles table', 'Cane (Q)', 'Aggregation', 'G_CTC', 'Purchase_QTL', 'SUM(G_CTC[Purchase_QTL])', 'SUM(purchase_qtl)', 'Total cane'],
    ['Centers / Center Vehicles', 'Center sourcing table', 'Mode', 'Column', 'CntPerformance', 'Transport Mode', 'CntPerformance[Transport Mode]', 'GROUP BY transport_mode', ''],
    ['Centers / Center Vehicles', 'Center sourcing table', 'Vehicles', 'Aggregation', 'CntPerformance', 'Purchy No.', 'COUNT(CntPerformance[Purchy No.])', 'COUNT(purchy_no) WHERE center IS NOT NULL', 'PBI Farm/Center vehicle counts'],
    ['Centers / Center Vehicles', 'Center sourcing table', 'Cane (Q)', 'Aggregation', 'CntPerformance', 'Cane Qty (Qtls)', 'SUM(CntPerformance[Cane Qty (Qtls)])', 'SUM(cane_qty_qtls)', ''],
    ['Centers KPI', 'Trips card', 'Trips', 'Aggregation', 'CntPerformance', 'Challan No.', 'COUNT(CntPerformance[Challan No.]) ≈ DISTINCT challans', 'COUNT(DISTINCT challan_no)', '≈8,940 for 24-Oct→30-Nov-2025'],
    ['Centers KPI', 'Avg Time card', 'Avg Time (Hrs)', 'Aggregation', 'CntPerformance', 'Holding Time (Center) OR Truck Transit', 'AVG(Holding Time (Center)) for center hold; PBI multiRow also shows Truck Transit', 'AVG(holding_time_center) for hold; AVG(truck_transit_time) shown separately as travel', 'Match PBI 2.97 hold / 2.95 trips avg'],
    ['Centers Holding', 'Holding by mode table', 'Holding Time (H)', 'Aggregation', 'CntPerformance', 'Holding Time (Center)', 'AVG(CntPerformance[Holding Time (Center)])', 'AVG(holding_time_center) GROUP BY transport_mode', '18≈3.09, 45≈2.80'],
    ['Centers Holding', 'Truck Holding card', 'Truck Holding Time (H)', 'Aggregation', 'CntPerformance', 'TruckHoldingTime(Center)', 'AVG(CntPerformance[TruckHoldingTime(Center)])', 'AVG(truck_holding_time_center)', '≈3.94 for Oct–Nov sample'],
    ['Yard', 'Yard wait card', 'Waiting Time (Hrs)', 'Aggregation', 'CntPerformance', 'Yard Waiting Time', 'AVG(CntPerformance[Yard Waiting Time])', 'AVG(yard_waiting_time)', '≈8.20'],
    ['Yard', 'Gate yard table', 'Avg Time', 'Aggregation', 'G_CTC', 'Yard Holding Time', 'AVG(G_CTC[Yard Holding Time])', 'AVG(yard_holding_time) GROUP BY sup_mod', 'Total ≈8.76'],
    ['Yard', 'Gate yard table', 'Dev. (>8H)', 'Measure', 'G_CTC', 'Deviations', '[Deviations]', 'COUNT where yard_holding_time > 8', 'Total 7794 (Oct–Nov)'],
    ['Mill Premise', 'Cane Holding card', 'Cane Holding Time (Hrs)', 'Measure', 'CntPerformance', 'WA Cane Holding Time', '[WA Cane Holding Time]', 'Weighted cane_holding_time', '≈15.37'],
    ['Mill Premise', 'Donga card', 'Time at Donga (Hrs)', 'Aggregation', 'CntPerformance', 'Unloading Time', 'AVG(CntPerformance[Unloading Time])', 'AVG(unloading_time) on cnt', '≈1.11'],
    ['Mill Premise', 'Mill table', 'Avg Time', 'Aggregation', 'G_CTC', 'UnloadingTime', 'AVG(G_CTC[UnloadingTime])', 'AVG(unloading_time) on g_ctc', 'Total ≈0.53'],
    ['Mill Premise', 'Mill table', 'Dev (>0.5H)', 'Measure', 'G_CTC', 'DeviationsUT', '[DeviationsUT]', 'COUNT where unloading_time > 0.5', 'Total 10165 (Oct–Nov)'],
  ],
  '05_Gate1': [
    ['Filters', 'Mode of Transport', 'SUP_MOD', 'Filter', 'G_CTC', 'SUP_MOD', 'G_CTC[SUP_MOD]', 'Optional mode filter', 'All / single mode'],
    ['Filters', 'Date', 'm_date / Report Date', 'Filter', 'G_CTC + Cnt', 'm_date', 'Between dates', 'm_date BETWEEN @from AND @to', 'Default DigiLog: 2025-10-24 → 2026-04-06'],
    ['KPI', 'Cane Purchased', 'Quintals', 'Aggregation', 'G_CTC', 'Purchase_QTL', 'SUM(G_CTC[Purchase_QTL])', 'SUM(purchase_qtl)', 'Full season ≈6.15M'],
    ['KPI', 'No. of Purchy', 'Purchies', 'Aggregation', 'G_CTC', 'purchyno', 'COUNT(G_CTC[purchyno])', 'COUNT(purchyno)', '≈91.85K'],
    ['KPI', 'Avg Purchy Size', 'Quintals', 'Measure', 'G_CTC', 'Avg Purchy Size', '[Avg Purchy Size]', 'SUM(qtl)/COUNT(purchyno)', '≈66.91'],
    ['KPI', 'Avg Purchi Overrun', '18 QCART', 'Measure', 'G_CTC', 'Over 18Q', '[Over 18Q]', 'AVG(qtl)-18 for 18 QCART', '≈7.16'],
    ['KPI', 'Avg Purchi Overrun', '36 QTROLLY', 'Measure', 'G_CTC', 'Over 36Q', '[Over 36Q]', 'AVG(qtl)-36', '≈5.01'],
    ['KPI', 'Avg Purchi Overrun', '63 QTROLLY', 'Measure', 'G_CTC', 'Over 63Q', '[Over 63Q]', 'AVG(qtl)-63', '≈13.35'],
    ['KPI', 'Avg Purchi Overrun', '99 QTRUCK', 'Measure', 'G_CTC', 'Over 99Q', '[Over 99Q]', 'AVG(qtl)-99', '≈3.71'],
    ['Charts', 'Purchase Split - Mode wise', 'Cane by mode', 'Aggregation', 'G_CTC', 'Purchase_QTL', 'SUM by SUP_MOD', 'SUM(purchase_qtl) GROUP BY sup_mod', '63 QTROLLY ~81%'],
    ['Charts', 'Cane Purchase Trend', 'Daily cane', 'Aggregation', 'G_CTC', 'Purchase_QTL', 'SUM by m_date', 'SUM(purchase_qtl) GROUP BY m_date', 'Area chart'],
    ['Charts', 'Purchi Overrun Trend', 'Daily overrun by mode', 'Measure', 'G_CTC', 'Over 18/36/63/99Q', 'Measures on m_date axis', 'AVG(qtl)-cap GROUP BY m_date,sup_mod', 'Line chart'],
    ['Charts', 'No. of Vehicles', 'Count by mode', 'Aggregation', 'G_CTC', 'SUP_MOD / purchyno', 'COUNT by SUP_MOD', 'COUNT(*) GROUP BY sup_mod', '63≈66K'],
  ],
  '06_Gate2': [
    ['Filters', 'Date', 'Date range', 'Filter', 'G_CTC', 'm_date', 'Between', 'm_date BETWEEN', ''],
    ['18 QCART card', 'No. of Carts', 'Count', 'Aggregation', 'G_CTC', 'SUP_MOD', "COUNTROWS filtered SUP_MOD='18 QCART'", "COUNT(*) WHERE sup_mod='18 QCART'", '15810 full season'],
    ['18 QCART card', 'Min Yard Holding', 'Hrs', 'Aggregation', 'G_CTC', 'Yard Holding Time', 'MIN(...)', 'MIN(yard_holding_time)', '0.03'],
    ['18 QCART card', 'Avg Yard Holding', 'Hrs', 'Aggregation', 'G_CTC', 'Yard Holding Time', 'AVG(...)', 'AVG(yard_holding_time)', '9.78'],
    ['18 QCART card', 'Max Yard Holding', 'Hrs', 'Aggregation', 'G_CTC', 'Yard Holding Time', 'MAX(...)', 'MAX(yard_holding_time)', '40.47'],
    ['18 QCART card', 'Vehicles exceeding', 'Count', 'Measure', 'G_CTC', 'Deviations', '[Deviations]', 'COUNT yard_holding_time>8', '6151'],
    ['36 QTROLLY card', '(same 5 metrics)', '…', 'Agg+Measure', 'G_CTC', 'Yard Holding Time / Deviations', 'MIN/AVG/MAX + [Deviations]', 'Filter sup_mod=36 QTROLLY', '5083 / 8.49 / 1699'],
    ['63 QTROLLY card', '(same 5 metrics)', '…', 'Agg+Measure', 'G_CTC', 'Yard Holding Time / Deviations', 'MIN/AVG/MAX + [Deviations]', 'Filter 63 QTROLLY', '65640 / 8.49 / 22136'],
    ['99 QTRUCK card', '(same 5 metrics)', '…', 'Agg+Measure', 'G_CTC', 'Yard Holding Time / Deviations', 'MIN/AVG/MAX + [Deviations]', "sup_mod IN ('99 QTROLLY','99 QTRUCK')", '4996 / 10.29 / 2057'],
    ['Charts', 'Average Yard Holding Time', 'Daily avg by mode', 'Aggregation', 'G_CTC', 'Yard Holding Time', 'AVG by m_date, SUP_MOD', 'AVG(yard_holding_time) GROUP BY m_date,sup_mod', 'Line chart'],
    ['Charts', 'Vehicles exceeding Standard Holding', 'Daily deviations', 'Measure', 'G_CTC', 'Vehicles exceeding Holding Time', '[Vehicles exceeding Holding Time]', 'COUNT >8 by day/mode', 'Line/bar'],
  ],
  '07_Center_Purchase': [
    ['Filters', 'Center / Mode / Date', 'Slicers', 'Filter', 'CntPerformance', 'Center, Transport Mode, Report Date', 'All optional', 'WHERE report_date + optional center/mode', ''],
    ['KPI Sidebar', 'Cane Purchased', 'Qtls', 'Aggregation', 'CntPerformance', 'Cane Qty (Qtls)', 'SUM(...)', 'SUM(cane_qty_qtls) center rows', '≈94,86,249.84'],
    ['KPI Sidebar', 'No. of Purchy', 'Count', 'Aggregation', 'CntPerformance', 'Purchy No.', 'COUNT(...)', 'COUNT(purchy_no)', '272282'],
    ['KPI Sidebar', 'Avg Parchi Size', 'Qtls', 'Measure', 'CntPerformance', 'Avg Parchi Size', '[Avg Parchi Size]', 'SUM(cane)/COUNT(purchy)', '34.84'],
    ['KPI Sidebar', 'Trips (C to G)', 'Count', 'Aggregation', 'CntPerformance', 'Challan No.', 'COUNT(Challan No.) / DISTINCT', 'COUNT(DISTINCT challan_no)', '≈37467'],
    ['KPI Sidebar', 'Avg Parchi Overrun', 'By mode', 'Measure', 'CntPerformance', 'Overrun18/36/45/63', '[OverrunXX]', 'AVG(cane)-cap by mode', '3.51 / 6.56 / 7.40 / 5.87'],
    ['Charts', 'Cane Purchase Trend', 'Daily', 'Aggregation', 'CntPerformance', 'Cane Qty', 'SUM by Report Date', 'SUM GROUP BY report_date', ''],
    ['Charts', 'Purchase Split Modewise', 'Donut', 'Aggregation', 'CntPerformance', 'Cane Qty', 'SUM by Transport Mode', 'SUM GROUP BY transport_mode', '45 QTROLLY ~63%'],
    ['Charts', 'Top 10 Centers', 'Cane + Avg Parchi', 'Agg + Measure', 'CntPerformance', 'Center, Cane, Avg Parchi Size', 'TOPN by SUM cane; [Avg Parchi Size]', 'ORDER BY cane DESC LIMIT 10', 'SAKETHU etc.'],
    ['Charts', 'Bottom 10 Centers', 'Cane + Avg Parchi', 'Agg + Measure', 'CntPerformance', 'Center', 'BOTTOMN by SUM cane', 'ORDER BY cane ASC LIMIT 10', ''],
    ['Charts', 'Parchi Overrun Trend', 'Daily by mode', 'Measure', 'CntPerformance', 'Overrun18/36/45/63', 'Measures vs Report Date', 'AVG-cap GROUP BY report_date, mode', ''],
  ],
  '08_Vehicle_Handling': [
    ['Filters', 'Center / Mode / Date', 'Slicers', 'Filter', 'CntPerformance', 'Center, Mode, Report Date', '', '', ''],
    ['KPI', 'Vehicle Handled', 'Count', 'Aggregation', 'CntPerformance', 'Transport Mode / Purchy No.', 'COUNT(Transport Mode) or COUNT(Purchy No.)', 'COUNT(purchy_no) center rows', '≈272.2K'],
    ['Charts', 'Mode wise Split', 'Bar', 'Aggregation', 'CntPerformance', 'Transport Mode', 'COUNT by mode', 'COUNT GROUP BY transport_mode', '18≈155K, 45≈115K'],
    ['Charts', 'Vehicle Handling Trend', 'Line by mode', 'Aggregation', 'CntPerformance', 'Report Date + Mode', 'COUNT by date, mode', 'COUNT GROUP BY report_date, transport_mode', ''],
    ['Tables', 'Top 10 centers matrix', 'Count by mode', 'Aggregation', 'CntPerformance', 'Center × Mode', 'COUNT(Purchy No.) matrix; Top 10 by Total', 'Pivot COUNT by center,mode ORDER BY total DESC LIMIT 10', 'SAKETHU 7634'],
    ['Tables', 'Bottom 10 centers matrix', 'Count by mode', 'Aggregation', 'CntPerformance', 'Center × Mode', 'Ascending total', 'ORDER BY total ASC LIMIT 10', ''],
  ],
  '09_Vehicle_Holding': [
    ['Filters', 'Center / Mode / Date', 'Slicers', 'Filter', 'CntPerformance', '', '', '', ''],
    ['Summary', 'Avg Holding Time (Hrs)', 'By mode', 'Aggregation', 'CntPerformance', 'Holding Time (Center)', 'AVG by Transport Mode', 'AVG(holding_time_center) GROUP BY mode', '≈2.99 / 2.86 / 2.95 / 2.23'],
    ['Charts', 'Avg Holding Trend', 'Line', 'Aggregation', 'CntPerformance', 'Report Date + Mode', 'AVG holding by date, mode', 'GROUP BY report_date, transport_mode', ''],
    ['Charts', 'Vehicle vs Holding scatter', 'Scatter', 'Agg + Column', 'CntPerformance', 'Holding Time (Center), Purchy No.', 'X=holding (or avg by center/mode), Y=vehicle count', 'AVG(h), COUNT(purchy) GROUP BY center, mode', ''],
  ],
  '10_Vehicle_Holding2': [
    ['Filters', 'Center / Mode / Date', 'Slicers', 'Filter', 'CntPerformance', '', '', '', ''],
    ['Lists', 'Center-wise holding tables', 'Time + Vehicles', 'Aggregation', 'CntPerformance', 'Center, Holding Time, Purchy No.', 'AVG(Holding Time (Center)); COUNT(Purchy No.)', 'AVG(holding_time_center), COUNT(purchy_no) GROUP BY center', 'Heatmap on Time'],
  ],
  '11_Truck_Transit': [
    ['Filters', 'Center / Mode / Date', 'Slicers', 'Filter', 'CntPerformance', '', '', '', ''],
    ['Lists', 'Center transit tables', 'Time', 'Aggregation', 'CntPerformance', 'Truck Transit Time', 'AVG(Truck Transit Time)', 'AVG(truck_transit_time) GROUP BY center', 'Heatmap'],
    ['Lists', 'Center transit tables', 'Dist.', 'Column', 'CenterDist', 'Distance', 'CenterDist[Distance]', 'Not in DigiLog MySQL yet — blank/0', 'PBI join only'],
    ['Lists', 'Center transit tables', 'Trips', 'Aggregation', 'CntPerformance', 'Challan No.', 'COUNT(Challan No.)', 'COUNT(DISTINCT challan_no)', ''],
  ],
  '12_Truck_Holding': [
    ['Filters', 'Challan / Mode / Date', 'Slicers', 'Filter', 'CntPerformance', 'Challan No., Mode, Report Date', '', 'Optional challan text filter', ''],
    ['Lists', 'Center truck holding tables', 'Holding Time', 'Aggregation', 'CntPerformance', 'TruckHoldingTime(Center)', 'AVG(...)', 'AVG(truck_holding_time_center) GROUP BY center', 'Heatmap'],
    ['Lists', 'Center truck holding tables', 'Trips', 'Aggregation', 'CntPerformance', 'Challan No.', 'COUNT(Challan No.)', 'COUNT(DISTINCT challan_no)', ''],
  ],
  '13_Database': [
    ['Table', 'Raw rows', 'All display cols', 'Column', 'CntPerformance', 'Purchy, Center, Grower, Vehicle, Cane, Challan, Mode, Date, Yard wait, Unload', 'Direct columns', 'SELECT … LIMIT 500 ORDER BY report_date DESC', 'Spot-check sample rows'],
  ],
};

const VERIFY_SAMPLES = [
  ['2025-10-24', '2025-11-30', 'All', 'All', 'Procurement', 'Trips', '8940', 'COUNT DISTINCT challan center'],
  ['2025-10-24', '2025-11-30', 'All', 'All', 'Procurement', 'Truck Holding (H)', '3.94', 'AVG truck_holding_time_center'],
  ['2025-10-24', '2025-11-30', 'All', 'All', 'Procurement', 'Yard Waiting (H)', '8.20', 'AVG yard_waiting_time cnt'],
  ['2025-10-24', '2025-11-30', 'All', 'All', 'Procurement', 'Donga (H)', '1.11', 'AVG unloading_time cnt'],
  ['2025-10-24', '2025-11-30', 'All', 'All', 'Procurement', 'Cane Holding (H)', '15.37', 'WA cane_holding_time'],
  ['2025-10-24', '2025-11-30', 'All', 'All', 'Procurement', 'Yard Total Avg / Dev', '8.76 / 7794', 'G_CTC yard'],
  ['2025-10-24', '2025-11-30', 'All', 'All', 'Procurement', 'Mill Total Avg / Dev', '0.53 / 10165', 'G_CTC unload'],
  ['2025-10-24', '2025-11-30', 'All', 'All', 'Procurement', 'Center 45 QTROLLY veh/cane', '26104 / 1376712', 'cnt purchy/cane'],
  ['2025-10-24', '2026-04-06', 'All', 'All', 'Gate 1', 'Cane / Purchy / Avg', '6.15M / 91.85K / 66.91', 'g_ctc'],
  ['2025-10-24', '2026-04-06', 'All', 'All', 'Gate 1', 'Overrun 18/36/63/99', '7.16 / 5.01 / 13.35 / 3.71', 'Over *Q'],
  ['2025-10-24', '2026-04-06', 'All', 'All', 'Gate 2', '18 QCART count/avg/dev', '15810 / 9.78 / 6151', ''],
  ['2025-10-24', '2026-04-06', 'All', 'All', 'Gate 2', '63 QTROLLY count/avg/dev', '65640 / 8.49 / 22136', ''],
  ['2025-10-24', '2026-04-06', 'All', 'All', 'Center Purchase', 'Cane / Purchy / Avg / Trips', '9486249.84 / 272282 / 34.84 / 37467', ''],
  ['2025-10-24', '2026-04-06', 'All', 'All', 'Vehicle Handling', 'SAKETHU total', '7634', 'Top matrix'],
  ['2025-10-24', '2026-04-06', 'All', 'All', 'Vehicle Handling', 'NAKHA-III total', '7544', ''],
];

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLog';
  wb.created = new Date();

  // —— Readme ——
  {
    const ws = wb.addWorksheet('00_Readme', { views: [{ state: 'frozen', ySplit: 1 }] });
    addTitle(ws, 'Cane Performance Dashboard — Formula Verification Workbook', 4);
    setWidths(ws, [28, 70, 40, 40]);
    const lines = [
      ['Purpose', 'Verify every DigiLog / Power BI number tab-wise and section-wise', '', ''],
      ['Sources', 'Power BI Cane Performance Report + DigiLog canePerformanceMysql.js + user DAX', '', ''],
      ['Tables', 'G_CTC (g_ctc) = Gate; CntPerformance (cnt_performance) = Center', '', ''],
      ['How to use', '1) Open DAX_Measures for full measure text', '', ''],
      ['', '2) Open each tab sheet (01_…10_) — every visual metric has DAX + DigiLog SQL', '', ''],
      ['', '3) Use 11_Verify_Samples to compare known good values for two date ranges', '', ''],
      ['', '4) Apply same Filters_Rules before comparing DigiLog vs PBI', '', ''],
      ['Sheet index', '00_Readme | 01_Filters_Rules | 02_DAX_Measures | 03_Columns_Used', '', ''],
      ['', '04–13 tab sheets | 14_Verify_Samples | 15_All_Visuals_Dump', '', ''],
      ['Generated', new Date().toISOString(), '', ''],
    ];
    lines.forEach((row, i) => {
      const r = ws.getRow(3 + i);
      row.forEach((v, ci) => {
        r.getCell(ci + 1).value = v;
        r.getCell(ci + 1).font = { size: 10, bold: ci === 0 };
      });
    });
  }

  // —— Filters ——
  {
    const ws = wb.addWorksheet('01_Filters_Rules', { views: [{ state: 'frozen', ySplit: 2 }] });
    addTitle(ws, 'Global Filters & Row Filters (apply before verifying any number)', 4);
    addRows(
      ws,
      2,
      ['Filter / Rule', 'Column', 'Logic', 'Applies To'],
      FILTERS,
      [28, 40, 50, 40]
    );
  }

  // —— DAX Measures ——
  {
    const ws = wb.addWorksheet('02_DAX_Measures', { views: [{ state: 'frozen', ySplit: 2 }] });
    addTitle(ws, 'Complete DAX Measures (with DigiLog / MySQL equivalent)', 6);
    addRows(
      ws,
      2,
      ['Measure', 'Table', 'Used In', 'Power BI DAX', 'DigiLog / MySQL Equivalent', 'Business Meaning'],
      DAX_MEASURES,
      [22, 16, 36, 55, 50, 28]
    );
  }

  // —— Columns ——
  {
    const ws = wb.addWorksheet('03_Columns_Used', { views: [{ state: 'frozen', ySplit: 2 }] });
    addTitle(ws, 'Columns used from the two source tables', 4);
    addRows(
      ws,
      2,
      ['Table', 'MySQL Column', 'PBI / Excel Name', 'Used For'],
      COLUMNS,
      [32, 28, 36, 50]
    );
  }

  // —— Per-tab sheets ——
  const tabHeaders = [
    'Section',
    'Visual / Card',
    'Metric Label',
    'Formula Type',
    'Source Table',
    'Field / Measure',
    'Power BI DAX / Aggregation',
    'DigiLog SQL / Implementation',
    'Verify Tip / Expected Sample',
  ];
  for (const [sheetName, rows] of Object.entries(TAB_SECTIONS)) {
    const ws = wb.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 2 }] });
    const title = sheetName.replace(/^\d+_/, '').replace(/_/g, ' ');
    addTitle(ws, `Tab: ${title} — section-wise formulas`, 9);
    addRows(ws, 2, tabHeaders, rows, [18, 28, 22, 12, 16, 28, 42, 42, 28]);
  }

  // —— Verify samples ——
  {
    const ws = wb.addWorksheet('14_Verify_Samples', { views: [{ state: 'frozen', ySplit: 2 }] });
    addTitle(ws, 'Known-good verification samples (DigiLog matched PBI)', 9);
    addRows(
      ws,
      2,
      ['From', 'To', 'Mode', 'Center', 'Tab', 'Metric', 'Expected Value', 'Notes', 'Pass? (Y/N)'],
      VERIFY_SAMPLES.map((r) => [...r, '']),
      [12, 12, 10, 10, 18, 32, 36, 28, 10]
    );
    // highlight expected col
    for (let i = 3; i < 3 + VERIFY_SAMPLES.length; i++) {
      ws.getRow(i).getCell(7).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: GREEN },
      };
    }
  }

  // —— All visuals from dump ——
  {
    const dumpPath = path.resolve(__dirname, '..', '..', '..', 'formulas_dump.txt');
    const ws = wb.addWorksheet('15_All_Visuals_Dump', { views: [{ state: 'frozen', ySplit: 2 }] });
    addTitle(ws, 'All visuals from formulas_dump.txt (PBI extract) — skip Sort/Static rows for verification', 11);
    const headers = [
      'Tab Name',
      'Visual Type',
      'Visual Title',
      'Query Section',
      'Formula Type',
      'Source Table',
      'Source Field',
      'Formula/Expression',
      'Display Name',
      'Query Reference',
      'Category',
    ];
    let rows = [];
    if (fs.existsSync(dumpPath)) {
      const text = fs.readFileSync(dumpPath, 'utf8');
      const start = text.indexOf('========== SHEET: All Formulas ==========');
      const end = text.indexOf('========== SHEET:', start + 40);
      const block = text.slice(start, end > 0 ? end : undefined);
      block.split(/\r?\n/).forEach((line) => {
        if (!line.includes('|') || line.startsWith('Tab Name') || line.startsWith('====')) return;
        const parts = line.split(' | ').map((s) => s.trim());
        if (parts.length >= 8 && !parts[0].startsWith('#')) {
          // skip pure sort/static noise optionally — keep all for completeness
          rows.push(parts.slice(0, 11));
        }
      });
    } else {
      rows = [['formulas_dump.txt not found', '', '', '', '', '', '', '', '', '', '']];
    }
    addRows(ws, 2, headers, rows, [18, 14, 28, 12, 12, 16, 22, 50, 24, 28, 12]);
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log('Wrote', OUT);
  console.log('Sheets:', wb.worksheets.map((s) => s.name).join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
