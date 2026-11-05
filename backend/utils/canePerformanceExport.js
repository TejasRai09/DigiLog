/**
 * Cane Performance season workbook. One sheet per dashboard tab (named as in the app),
 * a Summary sheet when every tab is exported, and record sheets holding every
 * g_ctc / cnt_performance row the dashboard aggregates, so each figure can be
 * recomputed date by date. Record sheets carry the live G_CTC / CntPerformance columns
 * the dashboard reads (live names, live order), then the values the dashboard derives from them.
 */
const ExcelJS = require('exceljs');
const { pool: mysqlPool } = require('../config/mysql');
const {
  getMysqlCanePerformanceData,
  gateWhere,
  cntWhere,
  GATE_OVERRUN,
  CNT_OVERRUN,
} = require('../controllers/canePerformanceMysql');
const { CANE_EXPORT_TABS, buildTabSections } = require('./canePerformanceExportSummary');

const GATE_SHEET = 'Gate Records';
const CENTER_SHEET = 'Center Records';

/** MySQL stores live minute durations as hours (minutes / 60, 4 dp); this restores the live minutes exactly. */
const minutes = (hoursCol) => `ROUND(${hoursCol} * 60)`;

/** Live G_CTC columns the dashboard reads, in live order, then derived columns (calc: true). */
const GATE_FIELDS = [
  { header: 'v_code', sql: 'v_code', type: 'id', width: 9 },
  { header: 'purchyno', sql: 'purchyno', type: 'id', width: 16 },
  { header: 'SUP_MOD', sql: 'sup_mod', type: 'text', width: 13 },
  { header: 'm_date', sql: "DATE_FORMAT(m_date, '%Y-%m-%d')", type: 'date', width: 12 },
  { header: 'Purchase_QTL (Qtls)', sql: 'purchase_qtl', type: 'num', width: 18 },
  { header: 'TokenToGross (Min)', sql: minutes('yard_holding_time'), type: 'int', width: 18 },
  { header: 'GrossToTare (Min)', sql: minutes('unloading_time'), type: 'int', width: 17 },
  {
    header: 'Overrun (Qtls)',
    sql: `CASE WHEN purchase_qtl > 0 THEN purchase_qtl - (${GATE_OVERRUN}) END`,
    type: 'num',
    width: 14,
    calc: true,
  },
  { header: 'Yard Holding (Hrs)', sql: 'yard_holding_time', type: 'num', width: 17, calc: true },
  {
    header: 'Yard > 8 Hrs (1 = Yes)',
    sql: 'CASE WHEN yard_holding_time > 8 THEN 1 ELSE 0 END',
    type: 'int',
    width: 19,
    calc: true,
  },
  { header: 'Time at Donga (Hrs)', sql: 'unloading_time', type: 'num', width: 18, calc: true },
  {
    header: 'Donga > 0.5 Hrs (1 = Yes)',
    sql: 'CASE WHEN unloading_time > 0.5 THEN 1 ELSE 0 END',
    type: 'int',
    width: 22,
    calc: true,
  },
];

/** Live CntPerformance columns the dashboard reads, in live order, then derived columns (calc: true). */
const CENTER_FIELDS = [
  { header: 'C.Name', sql: 'center', type: 'text', width: 20 },
  { header: 'Purchy No.', sql: 'purchy_no', type: 'id', width: 16 },
  { header: 'Mode Name of Transport', sql: 'transport_mode', type: 'text', width: 15 },
  { header: 'Weighment Date (Purchy)', sql: "DATE_FORMAT(report_date, '%Y-%m-%d')", type: 'date', width: 15 },
  { header: 'Purchased Quantity (Qtl.)', sql: 'cane_qty_qtls', type: 'num', width: 16 },
  { header: 'CHALLAN', sql: 'challan_no', type: 'id', width: 12 },
  {
    header: 'WaitingTimeCnt (Min)',
    sql: `COALESCE(truck_holding_time_center_minutes, ${minutes('holding_time_center')})`,
    type: 'int',
    width: 15,
  },
  { header: 'TravelHrCntYard (Min)', sql: minutes('truck_transit_time'), type: 'int', width: 16 },
  { header: 'WaitingTimeYard (Min)', sql: minutes('yard_waiting_time'), type: 'int', width: 16 },
  { header: 'WaitingTimeDonga (Min)', sql: minutes('unloading_time'), type: 'int', width: 16 },
  {
    header: 'Overrun (Qtls)',
    sql: `CASE WHEN cane_qty_qtls > 0 AND transport_mode IS NOT NULL THEN cane_qty_qtls - (${CNT_OVERRUN}) END`,
    type: 'num',
    width: 14,
    calc: true,
  },
  { header: 'Center Holding (Hrs)', sql: 'holding_time_center', type: 'num', width: 19, calc: true },
  { header: 'Truck Transit (Hrs)', sql: 'truck_transit_time', type: 'num', width: 18, calc: true },
  { header: 'Yard Waiting (Hrs)', sql: 'yard_waiting_time', type: 'num', width: 17, calc: true },
  { header: 'Time at Donga (Hrs)', sql: 'unloading_time', type: 'num', width: 18, calc: true },
  { header: 'Truck Holding (Hrs)', sql: 'truck_holding_time_center', type: 'num', width: 18, calc: true },
  {
    header: 'Truck Holding for KPI (Hrs)',
    sql: 'COALESCE(truck_holding_time_center, truck_holding_time_center_minutes / 60.0, holding_time_center)',
    type: 'num',
    width: 24,
    calc: true,
  },
  { header: 'Cane Holding (Hrs)', sql: 'cane_holding_time', type: 'num', width: 17, calc: true },
];

/** Record sheets each dashboard tab aggregates. */
const TAB_RECORDS = {
  procurement: [GATE_SHEET, CENTER_SHEET],
  gate1: [GATE_SHEET],
  gate2: [GATE_SHEET],
  'center-purchase': [CENTER_SHEET],
  'vehicle-handling': [CENTER_SHEET],
  'vehicle-holding': [CENTER_SHEET],
  'vehicle-holding2': [CENTER_SHEET],
  'truck-transit': [CENTER_SHEET],
  'truck-holding': [CENTER_SHEET],
};

function recordSheetsOf(tabId) {
  return TAB_RECORDS[tabId] || [];
}

/** Dashboard query packs each summary builder reads. */
const SUMMARY_PACKS = {
  procurement: ['kpis', 'procFlow', 'gateYard', 'gateMill'],
  gate1: ['gateSidebar', 'gateCharts'],
  gate2: ['gateYard', 'gate2Charts'],
  'center-purchase': ['centerSidebar', 'centerPurchase'],
  'vehicle-handling': ['vehicleHandling'],
  'vehicle-holding': ['vehicleHolding'],
  'vehicle-holding2': ['holdingByCenter'],
  'truck-transit': ['transit'],
  'truck-holding': ['truckHold'],
};

const G = GATE_SHEET;
const C = CENTER_SHEET;

/** How each figure is recomputed from the record sheets. Averages skip blank cells. */
const AUDIT_GUIDE = {
  procurement: [
    ['Total Trips (Nos.)', C, 'Count of distinct CHALLAN'],
    ['Avg Transit Time (Hrs)', C, 'Average of Truck Transit (Hrs) = TravelHrCntYard / 60'],
    ['Truck Holding (Hrs)', C, 'Average of Truck Holding for KPI (Hrs)'],
    ['Waiting Time (Hrs)', C, 'Average of Yard Waiting (Hrs) = WaitingTimeYard / 60'],
    [
      'Cane Holding Time (Hrs)',
      C,
      'Sum of Cane Holding (Hrs) x Purchased Quantity (Qtl.) / Sum of Purchased Quantity (Qtl.), rows with Cane Holding only',
    ],
    ['Time at Donga (Hrs)', C, 'Average of Time at Donga (Hrs) = WaitingTimeDonga / 60'],
    ['Gate Vehicles', G, 'Per SUP_MOD: row count, sum of Purchase_QTL (Qtls), average of Yard Holding (Hrs)'],
    [
      'Center Vehicles / Center Holding',
      C,
      'Per Mode Name of Transport: row count, sum of Purchased Quantity (Qtl.), average of Center Holding (Hrs)',
    ],
    ['Yard', G, 'Per SUP_MOD: average of Yard Holding (Hrs); Dev. = sum of Yard > 8 Hrs'],
    ['Mill Premise', G, 'Per SUP_MOD: average of Time at Donga (Hrs); Dev. = sum of Donga > 0.5 Hrs'],
    ['Total rows', `${G} / ${C}`, 'Vehicle-weighted average of the mode rows'],
  ],
  gate1: [
    ['Total Cane Purchased (Qtls)', G, 'Sum of Purchase_QTL (Qtls)'],
    ['No. of Parchy (Nos.)', G, 'Row count'],
    ['Avg Parchy Size (Qtls)', G, 'Sum of Purchase_QTL (Qtls) / row count'],
    ['Overrun by Mode', G, 'Per SUP_MOD: average of Overrun (Qtls)'],
    ['Avg Parchy Overrun (Qtls)', G, 'Average of the Overrun by Mode values'],
    ['Purchase Split - Modewise', G, 'Per SUP_MOD: sum of Purchase_QTL (Qtls), row count'],
    ['Cane Purchase Trend', G, 'Per m_date: sum of Purchase_QTL (Qtls)'],
    ['Parchi Overrun Trend', G, 'Per m_date and SUP_MOD: average of Overrun (Qtls)'],
  ],
  gate2: [
    ['Total Vehicles (Nos.)', G, 'Row count'],
    [
      'Yard Holding by Mode',
      G,
      'Per SUP_MOD: row count, min / average / max of Yard Holding (Hrs), sum of Yard > 8 Hrs',
    ],
    ['Avg Yard Holding (Hrs)', G, 'Average of the per-mode averages above zero'],
    ['Max Yard Holding (Hrs)', G, 'Max of Yard Holding (Hrs) = TokenToGross / 60'],
    ['Vehicles Exceeding >8 Hrs (Nos.)', G, 'Sum of Yard > 8 Hrs'],
    ['Average Yard Holding Time', G, 'Per m_date and SUP_MOD: average of Yard Holding (Hrs)'],
    ['Vehicles Exceeding Standard Holding Time', G, 'Per m_date and SUP_MOD: sum of Yard > 8 Hrs'],
  ],
  'center-purchase': [
    ['Cane Purchased (Qtls)', C, 'Sum of Purchased Quantity (Qtl.)'],
    ['No. of Purchy (Nos.)', C, 'Row count'],
    ['Avg Parchi Size (Qtls)', C, 'Sum of Purchased Quantity (Qtl.) / row count'],
    ['Trips C to G (Nos.)', C, 'Count of distinct CHALLAN'],
    ['Overrun by Mode', C, 'Per Mode Name of Transport: average of Overrun (Qtls)'],
    ['Avg Parchi Overrun (Qtls)', C, 'Average of the Overrun by Mode values'],
    ['Purchase Split - Modewise', C, 'Per Mode Name of Transport: sum of Purchased Quantity (Qtl.), row count'],
    ['Cane Purchase Trend', C, 'Per Weighment Date (Purchy): sum of Purchased Quantity (Qtl.)'],
    [
      'Parchi Overrun Trend',
      C,
      'Per Weighment Date (Purchy) and Mode Name of Transport: average of Overrun (Qtls)',
    ],
    [
      'Top / Bottom 10 Centers',
      C,
      'Per C.Name: row count (Trips), sum of Purchased Quantity (Qtl.), that sum / row count',
    ],
  ],
  'vehicle-handling': [
    ['Vehicles Handled (Nos.)', C, 'Row count'],
    ['Vehicles by Mode', C, 'Per Mode Name of Transport: row count'],
    ['Vehicle Handling Trend', C, 'Per Weighment Date (Purchy) and Mode Name of Transport: row count'],
    ['Most / Least Vehicle Handled', C, 'Per C.Name: row count by Mode Name of Transport and in total'],
  ],
  'vehicle-holding': [
    ['Holding by Mode', C, 'Per Mode Name of Transport: average of Center Holding (Hrs), row count'],
    ['Avg Holding Time (Hrs)', C, 'Average of the Holding by Mode values'],
    [
      'Avg Holding Time at Centers - Trend',
      C,
      'Per Weighment Date (Purchy) and Mode Name of Transport: average of Center Holding (Hrs)',
    ],
    [
      'Vehicle vs Center Holding Time',
      C,
      'Per C.Name and Mode Name of Transport: average of Center Holding (Hrs), row count',
    ],
  ],
  'vehicle-holding2': [
    ['Centers by Holding Time', C, 'Per C.Name: average of Center Holding (Hrs), row count (Vehicles)'],
    ['KPIs', C, 'Count of centers, average of the center values, sum of Vehicles'],
  ],
  'truck-transit': [
    [
      'Centers by Transit Time',
      C,
      'Per C.Name: average of Truck Transit (Hrs), sum of Purchased Quantity (Qtl.), distinct CHALLAN (Trips)',
    ],
    ['KPIs', C, 'Count of centers, average of the center values, sum of Challan Qty'],
  ],
  'truck-holding': [
    ['Centers by Truck Holding', C, 'Per C.Name: average of Truck Holding (Hrs), sum of Purchased Quantity (Qtl.)'],
    ['KPIs', C, 'Count of centers, average of the center values, sum of Challan Qty'],
  ],
};

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SHEET_WIDTHS = [34, 22, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20];
const SHEET_TITLE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
const TITLE_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
const CALC_HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
const HEADER_BORDER = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } };
const HEADER_ALIGNMENT = { wrapText: true, vertical: 'middle' };

function toExcelDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function cellValue(field, raw) {
  if (raw == null || raw === '') return null;
  switch (field.type) {
    case 'date':
      return toExcelDate(raw);
    case 'num':
    case 'int': {
      const x = Number(raw);
      return Number.isFinite(x) ? x : null;
    }
    case 'id': {
      const x = Number(raw);
      return Number.isSafeInteger(x) ? x : String(raw);
    }
    default:
      return String(raw).trim();
  }
}

function numFmtFor(field) {
  if (field.type === 'date') return 'yyyy-mm-dd';
  if (field.type === 'num') return '0.00##';
  if (field.type === 'int' || field.type === 'id') return '0';
  return undefined;
}

/** ExcelJS caches style ids by object identity, so every cell in a column must share one style object. */
function columnStyles(fields) {
  const plain = {};
  const byFmt = new Map();
  return fields.map((field) => {
    const fmt = numFmtFor(field);
    if (!fmt) return plain;
    if (!byFmt.has(fmt)) byFmt.set(fmt, { numFmt: fmt });
    return byFmt.get(fmt);
  });
}

function summaryNumFmt(value) {
  return Number.isInteger(value) ? '#,##0' : '#,##0.00##';
}

function writeRow(sheet, values, style) {
  const row = sheet.addRow(values);
  row.eachCell((cell) => {
    if (style === 'sheet-title') {
      cell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      cell.fill = SHEET_TITLE_FILL;
    } else if (style === 'title') {
      cell.font = { bold: true, size: 12 };
      cell.fill = TITLE_FILL;
    } else if (style === 'header') {
      cell.font = { bold: true };
      cell.fill = HEADER_FILL;
      cell.border = HEADER_BORDER;
      cell.alignment = HEADER_ALIGNMENT;
    } else if (typeof cell.value === 'number') {
      cell.numFmt = summaryNumFmt(cell.value);
    }
  });
  row.commit();
}

function writeSection(sheet, section, tabLabel) {
  const title = [tabLabel, section.title].filter(Boolean);
  if (title.length) writeRow(sheet, title, 'title');
  if (section.headers?.length) {
    writeRow(sheet, section.headers, 'header');
    (section.rows || []).forEach((row) => {
      writeRow(sheet, section.headers.map((header) => row?.[header] ?? null));
    });
  }
  sheet.addRow([]).commit();
}

function infoSection(title, { from, to, dataSource, recordSheets }) {
  const rows = [
    { Field: 'Season from', Value: from },
    { Field: 'Season to', Value: to },
    { Field: 'Exported at', Value: new Date().toISOString() },
  ];
  if (dataSource) rows.push({ Field: 'Data source', Value: dataSource });
  if (recordSheets.includes(GATE_SHEET)) {
    rows.push({
      Field: GATE_SHEET,
      Value: 'Every G_CTC purchy with a valid transport mode and village code, all season dates',
    });
  }
  if (recordSheets.includes(CENTER_SHEET)) {
    rows.push({ Field: CENTER_SHEET, Value: 'Every CntPerformance purchy with a center, all season dates' });
  }
  if (recordSheets.length) {
    rows.push({
      Field: 'Record columns',
      Value: 'Grey headers are the live DB columns the dashboard reads; amber headers are derived from them the way the dashboard derives them',
    });
  }
  return { title, headers: ['Field', 'Value'], rows };
}

function auditGuideSection(tabs, withTab) {
  const rows = [];
  tabs.forEach((tab) => {
    (AUDIT_GUIDE[tab.id] || []).forEach(([figure, sheet, how]) => {
      rows.push({ Tab: tab.label, Figure: figure, 'Records sheet': sheet, 'How to recompute': how });
    });
  });
  const headers = ['Figure', 'Records sheet', 'How to recompute'];
  return {
    title: 'Audit guide',
    headers: withTab ? ['Tab', ...headers] : headers,
    rows,
  };
}

function addSummaryStyleSheet(workbook, name) {
  const sheet = workbook.addWorksheet(name);
  sheet.columns = SHEET_WIDTHS.map((width) => ({ width }));
  return sheet;
}

function writeSummarySheet(workbook, { tabs, payloads, meta }) {
  const sheet = addSummaryStyleSheet(workbook, 'Summary');
  writeRow(sheet, ['Cane Performance - Season Summary'], 'sheet-title');
  sheet.addRow([]).commit();
  writeSection(sheet, infoSection('Cover', meta));
  writeSection(sheet, {
    title: 'Sheets',
    headers: ['Sheet', 'Contents'],
    rows: [
      ...tabs.map((tab) => ({ Sheet: tab.label, Contents: `${tab.label} tab tables and how to audit them` })),
      ...meta.recordSheets.map((name) => ({ Sheet: name, Contents: 'Record-level data behind the tab tables' })),
    ],
  });
  writeSection(sheet, auditGuideSection(tabs, true));
  payloads.forEach(({ tab, sections }) => {
    sections.forEach((section) => writeSection(sheet, section, tab.label));
  });
  sheet.commit();
}

function writeTabSheet(workbook, { tab, sections, meta, withInfo }) {
  const sheet = addSummaryStyleSheet(workbook, tab.label);
  writeRow(sheet, [tab.label], 'sheet-title');
  sheet.addRow([]).commit();
  const recordSheets = recordSheetsOf(tab.id);
  if (withInfo) {
    writeSection(sheet, infoSection('Cover', { ...meta, recordSheets }));
  } else {
    writeSection(sheet, {
      title: 'Season',
      headers: ['Field', 'Value'],
      rows: [
        { Field: 'Season from', Value: meta.from },
        { Field: 'Season to', Value: meta.to },
        { Field: 'Records sheet', Value: recordSheets.join(', ') },
      ],
    });
  }
  sections.forEach((section) => writeSection(sheet, section));
  writeSection(sheet, auditGuideSection([tab], false));
  sheet.commit();
}

async function listDays(table, dateCol, where) {
  const [rows] = await mysqlPool.execute(
    `SELECT DISTINCT DATE_FORMAT(${dateCol}, '%Y-%m-%d') AS d FROM ${table} WHERE ${where.sql} ORDER BY d`,
    where.params,
  );
  return rows.map((row) => row.d).filter(Boolean);
}

/** Streams every record day by day so a full season never sits in memory at once. */
async function writeRecordSheet(workbook, { name, table, dateCol, fields, whereFor, from, to }) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = fields.map((field) => ({ width: field.width }));
  const header = sheet.addRow(fields.map((field) => field.header));
  header.height = 45;
  fields.forEach((field, i) => {
    const cell = header.getCell(i + 1);
    cell.font = { bold: true };
    cell.fill = field.calc ? CALC_HEADER_FILL : HEADER_FILL;
    cell.border = HEADER_BORDER;
    cell.alignment = HEADER_ALIGNMENT;
  });
  header.commit();
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: fields.length } };

  const styles = columnStyles(fields);
  const select = fields.map((field, i) => `${field.sql} AS c${i}`).join(', ');
  const days = await listDays(table, dateCol, whereFor(from, to));
  let count = 0;
  for (const day of days) {
    const where = whereFor(day, day);
    const [rows] = await mysqlPool.execute(
      `SELECT ${select} FROM ${table} WHERE ${where.sql} ORDER BY id`,
      where.params,
    );
    rows.forEach((raw) => {
      const row = sheet.addRow(fields.map((field, i) => cellValue(field, raw[`c${i}`])));
      for (let i = 0; i < fields.length; i += 1) {
        row.getCell(i + 1).style = styles[i];
      }
      row.commit();
    });
    count += rows.length;
  }
  sheet.commit();
  return count;
}

/**
 * Builds the workbook and streams it to `res`.
 * Summary payloads load before any bytes are written, so failures there still return JSON errors.
 */
async function streamCaneSeasonWorkbook(res, { scope, tabId, from, to, dataSource }) {
  const tabs = scope === 'all'
    ? CANE_EXPORT_TABS
    : CANE_EXPORT_TABS.filter((tab) => tab.id === tabId);
  if (!tabs.length) {
    const err = new Error('Unknown cane performance tab.');
    err.status = 400;
    throw err;
  }

  const payloads = [];
  for (const tab of tabs) {
    const data = await getMysqlCanePerformanceData(from, to, {
      tab: tab.id,
      packs: SUMMARY_PACKS[tab.id],
    });
    payloads.push({ tab, sections: buildTabSections(tab.id, data) });
  }

  const wanted = new Set(tabs.flatMap((tab) => recordSheetsOf(tab.id)));
  const recordSheets = [GATE_SHEET, CENTER_SHEET].filter((name) => wanted.has(name));
  const meta = { from, to, dataSource, recordSheets };
  const filename = scope === 'all'
    ? `cane-performance-season-${from}-to-${to}.xlsx`
    : `cane-performance-${tabId}-${from}-to-${to}.xlsx`;
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream: res, useStyles: true, useSharedStrings: false });
  if (scope === 'all') writeSummarySheet(workbook, { tabs, payloads, meta });
  payloads.forEach(({ tab, sections }) => {
    writeTabSheet(workbook, { tab, sections, meta, withInfo: scope !== 'all' });
  });

  if (wanted.has(GATE_SHEET)) {
    await writeRecordSheet(workbook, {
      name: GATE_SHEET,
      table: 'g_ctc',
      dateCol: 'm_date',
      fields: GATE_FIELDS,
      whereFor: (fromDate, toDate) => gateWhere({ fromDate, toDate }),
      from,
      to,
    });
  }
  if (wanted.has(CENTER_SHEET)) {
    await writeRecordSheet(workbook, {
      name: CENTER_SHEET,
      table: 'cnt_performance',
      dateCol: 'report_date',
      fields: CENTER_FIELDS,
      whereFor: (fromDate, toDate) => cntWhere({ fromDate, toDate }),
      from,
      to,
    });
  }

  await workbook.commit();
  return filename;
}

module.exports = { streamCaneSeasonWorkbook, GATE_FIELDS, CENTER_FIELDS, TAB_RECORDS };
