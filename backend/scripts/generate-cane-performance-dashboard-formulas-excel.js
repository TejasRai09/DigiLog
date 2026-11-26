/**
 * Cane Performance Dashboard — formula workbook for BUSINESS OWNERS.
 *
 * Rules:
 * - Plain English formulas only (no SQL, no JavaScript).
 * - Column names match the season Export Excel headers
 *   (Gate Records / Center Records sheets).
 *
 * Usage (from DigiLog/backend):
 *   node scripts/generate-cane-performance-dashboard-formulas-excel.js
 */
const path = require('path');
const ExcelJS = require('exceljs');

const OUT = process.argv.includes('--out')
  ? path.resolve(process.argv[process.argv.indexOf('--out') + 1])
  : path.resolve(__dirname, '../../docs/bi/Cane-Performance-Dashboard-Formulas.xlsx');

const NAVY = '1F3864';
const TEAL = '0F7173';
const WHITE = 'FFFFFF';
const LIGHT = 'EBF5FB';
const YELLOW = 'FEF3C7';
const BLUE = 'DBEAFE';

/** Yellow export headers and how each is calculated from the blue (source) columns. */
const YELLOW_COLUMNS = {
  'Gate Records': [
    {
      name: 'Overrun (Qtls)',
      formula: 'Overrun (Qtls) = Purchase_QTL (Qtls) − capacity of SUP_MOD (18 QCART = 18, 36 QTROLLY = 36, 45 QTROLLY = 45, 63 QTROLLY = 63, 99 QTROLLY or 99 QTRUCK = 99). Blank when Purchase_QTL (Qtls) is blank or 0.',
    },
    {
      name: 'Yard Holding (Hrs)',
      formula: 'Yard Holding (Hrs) = TokenToGross (Min) ÷ 60',
    },
    {
      name: 'Yard > 8 Hrs (1 = Yes)',
      formula: 'Yard > 8 Hrs (1 = Yes) = 1 when TokenToGross (Min) ÷ 60 is more than 8, otherwise 0',
    },
    {
      name: 'Time at Donga (Hrs)',
      formula: 'Time at Donga (Hrs) = GrossToTare (Min) ÷ 60',
    },
    {
      name: 'Donga > 0.5 Hrs (1 = Yes)',
      formula: 'Donga > 0.5 Hrs (1 = Yes) = 1 when GrossToTare (Min) ÷ 60 is more than 0.5, otherwise 0',
    },
  ],
  'Center Records': [
    {
      name: 'Overrun (Qtls)',
      formula: 'Overrun (Qtls) = Purchased Quantity (Qtl.) − capacity of Mode Name of Transport (18 QCART = 18, 36 QTROLLY = 36, 45 QTROLLY = 45, 63 QTROLLY = 63). Blank when Purchased Quantity (Qtl.) is blank or 0, or the mode is blank.',
    },
    {
      name: 'Center Holding (Hrs)',
      formula: 'Center Holding (Hrs) = WaitingTimeCnt (Min) ÷ 60',
    },
    {
      name: 'Truck Transit (Hrs)',
      formula: 'Truck Transit (Hrs) = TravelHrCntYard (Min) ÷ 60',
    },
    {
      name: 'Yard Waiting (Hrs)',
      formula: 'Yard Waiting (Hrs) = WaitingTimeYard (Min) ÷ 60',
    },
    {
      name: 'Time at Donga (Hrs)',
      formula: 'Time at Donga (Hrs) = WaitingTimeDonga (Min) ÷ 60',
    },
    {
      name: 'Truck Holding (Hrs)',
      formula: 'Truck Holding (Hrs) = WaitingTimeCnt (Min) ÷ 60',
    },
    {
      name: 'Truck Holding for KPI (Hrs)',
      formula: 'Truck Holding for KPI (Hrs) = WaitingTimeCnt (Min) ÷ 60',
    },
    {
      name: 'Cane Holding (Hrs)',
      formula: 'Cane Holding (Hrs) = (WaitingTimeCnt (Min) + TravelHrCntYard (Min) + WaitingTimeYard (Min) + WaitingTimeDonga (Min)) ÷ 60. Blank when all four minute columns are blank.',
    },
  ],
};

const STATUS_OPTIONS = ['Verified', 'Need to discuss', 'Mistake', 'Pending'];
const STATUS_FILLS = {
  Verified: 'C6EFCE',
  'Need to discuss': 'FDE68A',
  Mistake: 'FECACA',
  Pending: 'DBEAFE',
};

const G = 'Gate Records';
const C = 'Center Records';

/** Sheet column layout for metric tabs */
const METRIC_HEADERS = [
  { header: 'What you see on screen', key: 'name', width: 34 },
  { header: 'Type', key: 'type', width: 12 },
  { header: 'Export sheet', key: 'sheet', width: 16 },
  { header: 'Main column(s) used', key: 'mainCols', width: 36 },
  { header: 'Other columns used', key: 'otherCols', width: 36 },
  { header: 'Simple formula', key: 'formula', width: 78 },
  { header: 'What it means', key: 'meaning', width: 56 },
  { header: 'Example', key: 'example', width: 48 },
];

const COMMON_HEADERS = [
  { header: 'Area', key: 'area', width: 20 },
  { header: 'Feature', key: 'feature', width: 26 },
  { header: 'What it does', key: 'does', width: 62 },
  { header: 'Example', key: 'example', width: 52 },
];

const COMMON_ROWS = [
  [
    'Date filter',
    'From / To date',
    'Selects which days are included on every tab. Gate tabs use m_date. Center tabs use Weighment Date (Purchy).',
    'From 1 Nov, To 17 Nov → only those days are counted.',
  ],
  [
    'Date filter',
    'Operating Days',
    'Count of calendar days in the From–To range, including both ends. It is not cane quantity.',
    'From 1 Nov, To 7 Nov → Operating Days = 7.',
  ],
  [
    'Date filter',
    'WTD (Week to Date)',
    'Sets From to Monday of this week and To to today.',
    'Today is Wednesday 19 Nov → From = Monday 17 Nov, To = 19 Nov.',
  ],
  [
    'Date filter',
    'MTD (Month to Date)',
    'Sets From to the 1st of this month and To to today.',
    'Today is 19 Nov → From = 1 Nov, To = 19 Nov.',
  ],
  [
    'Date filter',
    'STD (Season to Date)',
    'Sets From to the start of the current crushing season and To to today.',
    'Season starts 24 Oct → From = 24 Oct, To = today.',
  ],
  [
    'Date filter',
    'Custom dates',
    'You choose From and To yourself.',
    'From = 24 Oct, To = 31 Oct for the first week only.',
  ],
  [
    'Other filters',
    'Transport Mode',
    'Optional. Shows only one vehicle mode (Cart / Trolley / Truck sizes). All = every mode.',
    'Select 63 QTROLLY → only that mode is counted.',
  ],
  [
    'Other filters',
    'Center',
    'Optional. Used on center tabs only. Shows one center. All = every center.',
    'Select SAKETHU → only that center.',
  ],
  [
    'Other filters',
    'Challan No.',
    'Used on Truck Holding only. Narrows the list to one challan.',
    'Enter a challan number → only that trip’s centers show.',
  ],
  [
    'Compare',
    'Compare season / period',
    'Picks another period (previous week / month / season) to put next to current numbers. KPI cards show % change.',
    'Current cane 1,00,000 Qtls; compare 80,000 → +25%.',
  ],
  [
    'Compare',
    '% change',
    '(Current − Compare) ÷ Compare × 100.',
    '100 − 80 = 20; 20 ÷ 80 × 100 = +25%.',
  ],
  [
    'Sync',
    'Live Sync (Refresh)',
    'Copies latest cane data from the factory live database into DigiLog, then the dashboard reads that copy.',
    'Click Sync → new gate and center weighments appear after refresh.',
  ],
  [
    'Export',
    'Season Excel download',
    'Downloads Gate Records and Center Records with the same column names used in this formula file, plus summary sheets.',
    'Open Gate Records → column Purchase_QTL (Qtls) is the cane quantity used in Gate 1.',
  ],
  [
    'Important',
    'How to read formulas in this file',
    'Every formula uses the Export Excel column names. You can open the season export and recompute the number yourself.',
    'Gate 1 Total Cane = Sum of Purchase_QTL (Qtls) on Gate Records for the selected dates.',
  ],
];

/**
 * Business metrics per tab.
 * mainCols / otherCols / formula use EXPORT headers only.
 */
const TAB_METRICS = {
  'Procurement Summary': [
    {
      name: 'Total Trips (Nos.)',
      type: 'KPI',
      sheet: C,
      mainCols: 'CHALLAN',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'Count of distinct CHALLAN',
      meaning: 'How many unique center-to-gate trips happened in the period.',
      example: '100 different challan numbers → Total Trips = 100.',
    },
    {
      name: 'Avg Transit Time (Hrs)',
      type: 'KPI',
      sheet: C,
      mainCols: 'Truck Transit (Hrs)',
      otherCols: 'TravelHrCntYard (Min)',
      formula: 'Average of Truck Transit (Hrs)\n(Truck Transit (Hrs) = TravelHrCntYard (Min) ÷ 60)',
      meaning: 'Average travel time from center to yard.',
      example: 'Times 2.0, 3.0, 4.0 hrs → average = 3.0 hrs.',
    },
    {
      name: 'Truck Holding (Hrs)',
      type: 'KPI',
      sheet: C,
      mainCols: 'Truck Holding for KPI (Hrs)',
      otherCols: 'Truck Holding (Hrs), WaitingTimeCnt (Min)',
      formula: 'Average of Truck Holding for KPI (Hrs)',
      meaning: 'Average truck holding time at center used on the summary card.',
      example: 'Holdings 1.5, 2.5, 3.0 hrs → average = 2.33 hrs.',
    },
    {
      name: 'Waiting Time / Yard Waiting (Hrs)',
      type: 'KPI',
      sheet: C,
      mainCols: 'Yard Waiting (Hrs)',
      otherCols: 'WaitingTimeYard (Min)',
      formula: 'Average of Yard Waiting (Hrs)\n(Yard Waiting (Hrs) = WaitingTimeYard (Min) ÷ 60)',
      meaning: 'Average time vehicles wait in the yard.',
      example: 'If KPI is missing, dashboard may use trip-weighted average by mode:\nSum of (Avg Yard Wait of mode × Trips of mode) ÷ Total trips.',
    },
    {
      name: 'Cane Holding Time (Hrs)',
      type: 'KPI',
      sheet: C,
      mainCols: 'Cane Holding (Hrs), Purchased Quantity (Qtl.)',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'Sum of (Cane Holding (Hrs) × Purchased Quantity (Qtl.)) ÷ Sum of Purchased Quantity (Qtl.)\n(only rows that have Cane Holding)',
      meaning: 'Quantity-weighted average cane holding time.',
      example: '2 hrs × 100 Qtls + 4 hrs × 300 Qtls = 1400 ÷ 400 = 3.5 hrs.',
    },
    {
      name: 'Time at Donga (Hrs)',
      type: 'KPI',
      sheet: C,
      mainCols: 'Time at Donga (Hrs)',
      otherCols: 'WaitingTimeDonga (Min)',
      formula: 'Average of Time at Donga (Hrs)\n(Time at Donga (Hrs) = WaitingTimeDonga (Min) ÷ 60)',
      meaning: 'Average unloading / donga time.',
      example: '0.4, 0.6, 0.5 hrs → average = 0.5 hrs.',
    },
    {
      name: 'Gate Vehicles table',
      type: 'Table',
      sheet: G,
      mainCols: 'SUP_MOD, Purchase_QTL (Qtls), Yard Holding (Hrs)',
      otherCols: 'purchyno, m_date',
      formula: 'For each SUP_MOD:\n• Vehicles = Count of rows\n• Cane = Sum of Purchase_QTL (Qtls)\n• Avg Yard Holding = Average of Yard Holding (Hrs)',
      meaning: 'Gate activity broken down by transport mode.',
      example: '63 QTROLLY: 50 rows, sum Purchase_QTL = 4,000 → shown under that mode.',
    },
    {
      name: 'Center Vehicles / Center Holding table',
      type: 'Table',
      sheet: C,
      mainCols: 'Mode Name of Transport, Purchased Quantity (Qtl.), Center Holding (Hrs)',
      otherCols: 'WaitingTimeCnt (Min), Purchy No.',
      formula: 'For each Mode Name of Transport:\n• Vehicles = Count of rows\n• Cane = Sum of Purchased Quantity (Qtl.)\n• Avg Center Holding = Average of Center Holding (Hrs)\n(Center Holding (Hrs) = WaitingTimeCnt (Min) ÷ 60)',
      meaning: 'Center activity broken down by transport mode.',
      example: '36 QTROLLY average center holding 5.2 hrs.',
    },
    {
      name: 'Yard table (Gate)',
      type: 'Table',
      sheet: G,
      mainCols: 'SUP_MOD, Yard Holding (Hrs), Yard > 8 Hrs (1 = Yes)',
      otherCols: 'TokenToGross (Min)',
      formula: 'For each SUP_MOD:\n• Avg Yard Holding = Average of Yard Holding (Hrs)\n• Dev. = Sum of Yard > 8 Hrs (1 = Yes)',
      meaning: 'Yard holding by mode and how many vehicles exceeded 8 hours.',
      example: '10 vehicles over 8 hrs → Dev. = 10.',
    },
    {
      name: 'Mill Premise table (Gate)',
      type: 'Table',
      sheet: G,
      mainCols: 'SUP_MOD, Time at Donga (Hrs), Donga > 0.5 Hrs (1 = Yes)',
      otherCols: 'GrossToTare (Min)',
      formula: 'For each SUP_MOD:\n• Avg Time at Donga = Average of Time at Donga (Hrs)\n• Dev. = Sum of Donga > 0.5 Hrs (1 = Yes)',
      meaning: 'Unloading time by mode and count above half an hour.',
      example: '8 vehicles above 0.5 hrs → Dev. = 8.',
    },
  ],

  'Gate 1': [
    {
      name: 'Total Cane Purchased (Qtls)',
      type: 'KPI',
      sheet: G,
      mainCols: 'Purchase_QTL (Qtls)',
      otherCols: 'm_date, SUP_MOD',
      formula: 'Sum of Purchase_QTL (Qtls)',
      meaning: 'Total cane purchased at the gate in the selected dates.',
      example: 'Day totals 10,000 + 12,000 + 8,000 = 30,000 Qtls.',
    },
    {
      name: 'No. of Parchy (Nos.)',
      type: 'KPI',
      sheet: G,
      mainCols: 'purchyno',
      otherCols: 'm_date',
      formula: 'Count of rows (each purchyno is one parchie)',
      meaning: 'How many gate parchies were recorded.',
      example: '720 rows → 720 parchies.',
    },
    {
      name: 'Avg Parchy Size (Qtls)',
      type: 'KPI',
      sheet: G,
      mainCols: 'Purchase_QTL (Qtls), purchyno',
      otherCols: 'm_date',
      formula: 'Sum of Purchase_QTL (Qtls) ÷ Count of rows',
      meaning: 'Average cane quantity per parchie.',
      example: '30,000 Qtls ÷ 720 parchies = 41.7 Qtls.',
    },
    {
      name: 'Avg Parchy Overrun (Qtls)',
      type: 'KPI',
      sheet: G,
      mainCols: 'Overrun (Qtls), SUP_MOD',
      otherCols: 'Purchase_QTL (Qtls)',
      formula: 'For each SUP_MOD: Average of Overrun (Qtls)\nThen: Average of those mode values\n(Overrun (Qtls) = Purchase_QTL (Qtls) − mode capacity 18/36/45/63/99)',
      meaning: 'How much above standard capacity the typical parchie is.',
      example: 'Mode overruns 2, 4, 6 → Avg Parchy Overrun = 4 Qtls.',
    },
    {
      name: 'Overrun by Mode',
      type: 'Table',
      sheet: G,
      mainCols: 'SUP_MOD, Overrun (Qtls)',
      otherCols: 'Purchase_QTL (Qtls)',
      formula: 'For each SUP_MOD: Average of Overrun (Qtls)',
      meaning: 'Average overrun for each vehicle mode.',
      example: '18 QCART average overrun = 3.2 Qtls.',
    },
    {
      name: 'Purchase Split - Modewise (pie / donut)',
      type: 'Pie',
      sheet: G,
      mainCols: 'SUP_MOD, Purchase_QTL (Qtls)',
      otherCols: 'purchyno',
      formula: 'For each SUP_MOD:\n• Cane Qty = Sum of Purchase_QTL (Qtls)\n• No. of Parchy = Count of rows\nDonut center = Sum of Purchase_QTL (Qtls) for all modes',
      meaning: 'Share of gate cane by vehicle mode.',
      example: '63 QTROLLY = 20,000 of 30,000 → about 67% of the pie.',
    },
    {
      name: 'Cane Purchase Trend',
      type: 'Trend',
      sheet: G,
      mainCols: 'm_date, Purchase_QTL (Qtls)',
      otherCols: 'SUP_MOD',
      formula: 'For each m_date: Sum of Purchase_QTL (Qtls)',
      meaning: 'Daily gate cane purchase line/area chart.',
      example: '16 Nov sum = 41,489 Qtls; 17 Nov sum = 18,799 Qtls → two points on the chart.',
    },
    {
      name: 'Parchi Overrun Trend',
      type: 'Trend',
      sheet: G,
      mainCols: 'm_date, SUP_MOD, Overrun (Qtls)',
      otherCols: 'Purchase_QTL (Qtls)',
      formula: 'For each m_date and SUP_MOD: Average of Overrun (Qtls)',
      meaning: 'Daily overrun trend by mode.',
      example: 'On 16 Nov, 63 QTROLLY average overrun = 5.1 Qtls.',
    },
  ],

  'Gate 2': [
    {
      name: 'Total Vehicles (Nos.)',
      type: 'KPI',
      sheet: G,
      mainCols: 'purchyno',
      otherCols: 'm_date, SUP_MOD',
      formula: 'Count of rows',
      meaning: 'Total gate vehicles in the period.',
      example: '850 rows → 850 vehicles.',
    },
    {
      name: 'Avg Yard Holding (Hrs)',
      type: 'KPI',
      sheet: G,
      mainCols: 'Yard Holding (Hrs), SUP_MOD',
      otherCols: 'TokenToGross (Min)',
      formula: 'Average of the per-mode Avg Yard Holding values (modes above zero)\n(Yard Holding (Hrs) = TokenToGross (Min) ÷ 60)',
      meaning: 'Typical yard holding across modes.',
      example: 'Mode averages 2.0, 3.0, 4.0 → KPI average = 3.0 hrs.',
    },
    {
      name: 'Max Yard Holding (Hrs)',
      type: 'KPI',
      sheet: G,
      mainCols: 'Yard Holding (Hrs)',
      otherCols: 'TokenToGross (Min)',
      formula: 'Maximum of Yard Holding (Hrs)',
      meaning: 'Longest yard hold in the period.',
      example: 'Highest value in the column = 12.5 hrs.',
    },
    {
      name: 'Vehicles Exceeding >8 Hrs (Nos.)',
      type: 'KPI',
      sheet: G,
      mainCols: 'Yard > 8 Hrs (1 = Yes)',
      otherCols: 'Yard Holding (Hrs)',
      formula: 'Sum of Yard > 8 Hrs (1 = Yes)',
      meaning: 'How many vehicles stayed in yard more than 8 hours.',
      example: '25 rows marked 1 → 25 vehicles.',
    },
    {
      name: 'Yard Holding by Mode cards / table',
      type: 'Table',
      sheet: G,
      mainCols: 'SUP_MOD, Yard Holding (Hrs), Yard > 8 Hrs (1 = Yes)',
      otherCols: 'purchyno',
      formula: 'For each SUP_MOD:\n• Vehicles = Count of rows\n• Min / Avg / Max Yard Holding = Min / Average / Max of Yard Holding (Hrs)\n• Exceeding >8 Hrs = Sum of Yard > 8 Hrs (1 = Yes)',
      meaning: 'Yard holding detail for each mode.',
      example: '36 QTROLLY: Avg 3.2 hrs, Max 9.1 hrs, 4 over 8 hrs.',
    },
    {
      name: 'Average Yard Holding Time (trend)',
      type: 'Trend',
      sheet: G,
      mainCols: 'm_date, SUP_MOD, Yard Holding (Hrs)',
      otherCols: 'TokenToGross (Min)',
      formula: 'For each m_date and SUP_MOD: Average of Yard Holding (Hrs)',
      meaning: 'Daily yard holding trend by mode.',
      example: '15 Nov, 63 QTROLLY average = 2.8 hrs.',
    },
    {
      name: 'Vehicles Exceeding Standard Holding Time (trend)',
      type: 'Trend',
      sheet: G,
      mainCols: 'm_date, SUP_MOD, Yard > 8 Hrs (1 = Yes)',
      otherCols: 'Yard Holding (Hrs)',
      formula: 'For each m_date and SUP_MOD: Sum of Yard > 8 Hrs (1 = Yes)',
      meaning: 'Daily count of vehicles over 8 hours, by mode.',
      example: '16 Nov, 99 QTROLLY exceeding = 6.',
    },
  ],

  'Center Purchase': [
    {
      name: 'Cane Purchased (Qtls)',
      type: 'KPI',
      sheet: C,
      mainCols: 'Purchased Quantity (Qtl.)',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'Sum of Purchased Quantity (Qtl.)',
      meaning: 'Total cane purchased at centers.',
      example: 'Sum of the column = 2,50,000 Qtls.',
    },
    {
      name: 'No. of Purchy (Nos.)',
      type: 'KPI',
      sheet: C,
      mainCols: 'Purchy No.',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'Count of rows',
      meaning: 'Number of center parchies.',
      example: '1,200 rows → 1,200 purchies.',
    },
    {
      name: 'Avg Parchi Size (Qtls)',
      type: 'KPI',
      sheet: C,
      mainCols: 'Purchased Quantity (Qtl.), Purchy No.',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'Sum of Purchased Quantity (Qtl.) ÷ Count of rows',
      meaning: 'Average cane per center parchie.',
      example: '2,50,000 ÷ 1,200 = 208.3 Qtls.',
    },
    {
      name: 'Trips C to G (Nos.)',
      type: 'KPI',
      sheet: C,
      mainCols: 'CHALLAN',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'Count of distinct CHALLAN',
      meaning: 'Unique trips from center to gate.',
      example: '900 distinct challans → 900 trips.',
    },
    {
      name: 'Avg Parchi Overrun (Qtls)',
      type: 'KPI',
      sheet: C,
      mainCols: 'Overrun (Qtls), Mode Name of Transport',
      otherCols: 'Purchased Quantity (Qtl.)',
      formula: 'For each Mode Name of Transport: Average of Overrun (Qtls)\nThen: Average of those mode values\n(Overrun (Qtls) = Purchased Quantity (Qtl.) − mode capacity)',
      meaning: 'Typical excess over mode capacity at centers.',
      example: 'Mode overruns 5, 7, 9 → average = 7 Qtls.',
    },
    {
      name: 'Overrun by Mode',
      type: 'Table',
      sheet: C,
      mainCols: 'Mode Name of Transport, Overrun (Qtls)',
      otherCols: 'Purchased Quantity (Qtl.)',
      formula: 'For each Mode Name of Transport: Average of Overrun (Qtls)',
      meaning: 'Average overrun by mode.',
      example: '63 QTROLLY average overrun = 8.4 Qtls.',
    },
    {
      name: 'Purchase Split - Modewise (pie)',
      type: 'Pie',
      sheet: C,
      mainCols: 'Mode Name of Transport, Purchased Quantity (Qtl.)',
      otherCols: 'Purchy No.',
      formula: 'For each Mode Name of Transport:\n• Cane Qty = Sum of Purchased Quantity (Qtl.)\n• No. of Purchy = Count of rows',
      meaning: 'Share of center cane by mode.',
      example: 'One mode has 40% of total cane → largest pie slice.',
    },
    {
      name: 'Cane Purchase Trend',
      type: 'Trend',
      sheet: C,
      mainCols: 'Weighment Date (Purchy), Purchased Quantity (Qtl.)',
      otherCols: 'Mode Name of Transport',
      formula: 'For each Weighment Date (Purchy): Sum of Purchased Quantity (Qtl.)',
      meaning: 'Daily center cane purchase trend.',
      example: '14 Nov sum = 36,953 Qtls.',
    },
    {
      name: 'Parchi Overrun Trend',
      type: 'Trend',
      sheet: C,
      mainCols: 'Weighment Date (Purchy), Mode Name of Transport, Overrun (Qtls)',
      otherCols: 'Purchased Quantity (Qtl.)',
      formula: 'For each Weighment Date (Purchy) and Mode Name of Transport: Average of Overrun (Qtls)',
      meaning: 'Daily overrun by mode at centers.',
      example: '15 Nov, 36 QTROLLY average overrun = 4.2 Qtls.',
    },
    {
      name: 'Top 10 Centers - Cane Purchase (bar)',
      type: 'Chart',
      sheet: C,
      mainCols: 'C.Name, Purchased Quantity (Qtl.)',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'For each C.Name: Cane Purchased (Qtls) = Sum of Purchased Quantity (Qtl.)\nKeep the 10 centers with the highest Cane Purchased\nBar height = that sum',
      meaning: 'Bar series on the Top 10 chart.',
      example: 'Highest center sum = 18,400 Qtls → tallest bar.',
    },
    {
      name: 'Top 10 Centers - Avg Parchi Size (line)',
      type: 'Chart',
      sheet: C,
      mainCols: 'C.Name, Purchased Quantity (Qtl.), Purchy No.',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'For the same Top 10 centers:\nAvg Parchi Size = Sum of Purchased Quantity (Qtl.) ÷ Count of rows\nLine point = that average',
      meaning: 'Line series on the Top 10 chart (right axis). Trips are not drawn.',
      example: '18,400 Qtls ÷ 80 parchies = 230 Qtls on the line.',
    },
    {
      name: 'Bottom 10 Centers - Cane Purchase (bar)',
      type: 'Chart',
      sheet: C,
      mainCols: 'C.Name, Purchased Quantity (Qtl.)',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'For each C.Name: Cane Purchased (Qtls) = Sum of Purchased Quantity (Qtl.)\nKeep the 10 centers with the lowest Cane Purchased\nBar height = that sum',
      meaning: 'Bar series on the Bottom 10 chart.',
      example: 'Lowest center sum = 420 Qtls → shortest bar.',
    },
    {
      name: 'Bottom 10 Centers - Avg Parchi Size (line)',
      type: 'Chart',
      sheet: C,
      mainCols: 'C.Name, Purchased Quantity (Qtl.), Purchy No.',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'For the same Bottom 10 centers:\nAvg Parchi Size = Sum of Purchased Quantity (Qtl.) ÷ Count of rows\nLine point = that average',
      meaning: 'Line series on the Bottom 10 chart (right axis).',
      example: '420 Qtls ÷ 12 parchies = 35 Qtls on the line.',
    },
  ],

  'Vehicle Handling': [
    {
      name: 'Vehicles Handled (Nos.)',
      type: 'KPI',
      sheet: C,
      mainCols: 'Purchy No.',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'Count of rows',
      meaning: 'Total vehicles handled at centers.',
      example: '1,500 rows → 1,500 vehicles.',
    },
    {
      name: 'Vehicles by Mode',
      type: 'Chart / Table',
      sheet: C,
      mainCols: 'Mode Name of Transport',
      otherCols: 'Purchy No.',
      formula: 'For each Mode Name of Transport: Count of rows',
      meaning: 'How many vehicles per mode.',
      example: '63 QTROLLY = 800 vehicles.',
    },
    {
      name: 'Vehicle Handling Trend',
      type: 'Trend',
      sheet: C,
      mainCols: 'Weighment Date (Purchy), Mode Name of Transport',
      otherCols: 'Purchy No.',
      formula: 'For each Weighment Date (Purchy) and Mode Name of Transport: Count of rows',
      meaning: 'Daily vehicle count by mode.',
      example: '16 Nov, 18 QCART = 40 vehicles.',
    },
    {
      name: 'Most / Least Vehicle Handled (by center)',
      type: 'Table',
      sheet: C,
      mainCols: 'C.Name, Mode Name of Transport',
      otherCols: 'Purchy No.',
      formula: 'For each C.Name: Count of rows by Mode Name of Transport and Total\nThen show highest / lowest centers by Total',
      meaning: 'Which centers handle the most or least vehicles.',
      example: 'Center A total 120 vehicles → near top of Most list.',
    },
  ],

  'Vehicle Holding': [
    {
      name: 'Holding by Mode',
      type: 'Table / Cards',
      sheet: C,
      mainCols: 'Mode Name of Transport, Center Holding (Hrs)',
      otherCols: 'WaitingTimeCnt (Min), Purchy No.',
      formula: 'For each Mode Name of Transport:\n• Avg Holding = Average of Center Holding (Hrs)\n• Vehicles = Count of rows\n(Center Holding (Hrs) = WaitingTimeCnt (Min) ÷ 60)',
      meaning: 'Average center holding time by mode.',
      example: '45 QTROLLY average holding = 6.1 hrs.',
    },
    {
      name: 'Avg Holding Time (Hrs)',
      type: 'KPI',
      sheet: C,
      mainCols: 'Center Holding (Hrs), Mode Name of Transport',
      otherCols: 'WaitingTimeCnt (Min)',
      formula: 'Average of the Holding by Mode values',
      meaning: 'Overall typical center holding across modes.',
      example: 'Mode averages 4, 5, 6 → KPI = 5 hrs.',
    },
    {
      name: 'Avg Holding Time at Centers - Trend',
      type: 'Trend',
      sheet: C,
      mainCols: 'Weighment Date (Purchy), Mode Name of Transport, Center Holding (Hrs)',
      otherCols: 'WaitingTimeCnt (Min)',
      formula: 'For each Weighment Date (Purchy) and Mode Name of Transport: Average of Center Holding (Hrs)',
      meaning: 'Daily center holding trend by mode.',
      example: '17 Nov, 63 QTROLLY average = 5.4 hrs.',
    },
    {
      name: 'Vehicle vs Center Holding Time (scatter)',
      type: 'Scatter',
      sheet: C,
      mainCols: 'C.Name, Mode Name of Transport, Center Holding (Hrs), Purchy No.',
      otherCols: 'WaitingTimeCnt (Min)',
      formula: 'One dot per center and mode:\n• X axis (Holding Hrs) = Average of Center Holding (Hrs)\n• Y axis (Vehicles) = Count of rows\nOne colour per Mode Name of Transport (18 QCART, 36 QTROLLY, 45 QTROLLY, 63 QTROLLY, 99 QTRUCK)',
      meaning: 'Scatter chart. It is not a table.',
      example: 'Center X, 36 QTROLLY: X = 7.2 hrs, Y = 40 vehicles.',
    },
  ],

  'Vehicle Holding 2': [
    {
      name: 'Centers by Holding Time',
      type: 'Table / Chart',
      sheet: C,
      mainCols: 'C.Name, Center Holding (Hrs)',
      otherCols: 'WaitingTimeCnt (Min), Purchy No.',
      formula: 'For each C.Name:\n• Avg Holding = Average of Center Holding (Hrs)\n• Vehicles = Count of rows',
      meaning: 'Each center’s average holding and vehicle count.',
      example: 'Center Y average holding 8.0 hrs, 45 vehicles.',
    },
    {
      name: 'Summary KPIs (centers / average / vehicles)',
      type: 'KPI',
      sheet: C,
      mainCols: 'C.Name, Center Holding (Hrs)',
      otherCols: 'Purchy No.',
      formula: '• No. of Centers = Count of distinct C.Name\n• Avg Holding = Average of the center Avg Holding values\n• Total Vehicles = Sum of Vehicles across centers',
      meaning: 'Overall summary of the center holding list.',
      example: '40 centers, average of center averages = 5.5 hrs.',
    },
  ],

  'Truck Transit': [
    {
      name: 'Centers by Transit Time',
      type: 'Table / Chart',
      sheet: C,
      mainCols: 'C.Name, Truck Transit (Hrs), Purchased Quantity (Qtl.), CHALLAN',
      otherCols: 'TravelHrCntYard (Min)',
      formula: 'For each C.Name:\n• Avg Transit = Average of Truck Transit (Hrs)\n• Cane Qty = Sum of Purchased Quantity (Qtl.)\n• Trips = Count of distinct CHALLAN\n(Truck Transit (Hrs) = TravelHrCntYard (Min) ÷ 60)',
      meaning: 'How long trucks take from each center and how much cane they bring.',
      example: 'Center Z average transit 2.1 hrs, cane 12,000 Qtls, 30 trips.',
    },
    {
      name: 'Summary KPIs',
      type: 'KPI',
      sheet: C,
      mainCols: 'C.Name, Truck Transit (Hrs), Purchased Quantity (Qtl.)',
      otherCols: 'CHALLAN',
      formula: '• Centers = Count of distinct C.Name\n• Avg Transit = Average of the center Avg Transit values\n• Total Cane = Sum of Cane Qty across centers',
      meaning: 'Overall transit summary.',
      example: '35 centers, overall average transit about 2.4 hrs.',
    },
  ],

  'Truck Holding': [
    {
      name: 'Centers by Truck Holding',
      type: 'Table / Chart',
      sheet: C,
      mainCols: 'C.Name, Truck Holding (Hrs), Purchased Quantity (Qtl.)',
      otherCols: 'CHALLAN, Truck Holding for KPI (Hrs)',
      formula: 'For each C.Name:\n• Avg Truck Holding = Average of Truck Holding (Hrs)\n• Cane Qty = Sum of Purchased Quantity (Qtl.)',
      meaning: 'Average truck holding and cane by center.',
      example: 'Center W average truck holding 3.5 hrs.',
    },
    {
      name: 'Summary KPIs',
      type: 'KPI',
      sheet: C,
      mainCols: 'C.Name, Truck Holding (Hrs), Purchased Quantity (Qtl.)',
      otherCols: 'CHALLAN',
      formula: '• Centers = Count of distinct C.Name\n• Avg Holding = Average of the center Avg Truck Holding values\n• Total Cane = Sum of Cane Qty across centers',
      meaning: 'Overall truck holding summary.',
      example: '28 centers, average holding about 3.0 hrs.',
    },
    {
      name: 'Challan filter effect',
      type: 'Filter',
      sheet: C,
      mainCols: 'CHALLAN',
      otherCols: 'C.Name, Truck Holding (Hrs)',
      formula: 'Keep only rows where CHALLAN matches the typed challan number, then apply the same formulas above',
      meaning: 'Lets you inspect one trip across centers.',
      example: 'Enter challan 110001 → only that challan’s rows remain.',
    },
  ],
};

const MODE5 = ['18 QCART', '36 QTROLLY', '45 QTROLLY', '63 QTROLLY', '99 QTRUCK'];
const GATE2_MODES = [
  { mode: '18 QCART', countLabel: 'No. of Carts' },
  { mode: '36 QTROLLY', countLabel: 'No. of Trollies' },
  { mode: '63 QTROLLY', countLabel: 'No. of Trollies' },
  { mode: '99 QTRUCK', countLabel: 'No. of Trucks' },
];

function row(partial) {
  return partial;
}

function pctRow(name, sheet, currentHow) {
  return row({
    name: `${name} — % change`,
    type: 'Compare',
    sheet,
    mainCols: 'Compare period (same columns)',
    otherCols: 'From / To dates of the compare chip',
    formula: `(Current ${name} − Compare ${name}) ÷ Compare ${name} × 100\n${currentHow}`,
    meaning: 'Green or red % shown on this KPI card against the selected compare period.',
    example: 'Current 100, compare 80 → (100 − 80) ÷ 80 × 100 = +25%.',
  });
}

function modeSeriesRows({ chart, modes, sheet, dateCol, modeCol, perModeFormula, unit, type = 'Trend series' }) {
  return modes.map((mode) => row({
    name: `${chart} — ${mode}`,
    type,
    sheet,
    mainCols: `${dateCol}, ${modeCol}`,
    otherCols: mode,
    formula: `Line or bar for ${mode} only.\nFor each ${dateCol}: ${perModeFormula}\nKeep rows where ${modeCol} = ${mode}.`,
    meaning: `One series on “${chart}”.`,
    example: `16 Nov, ${mode} = 5.1 ${unit}.`,
  }));
}

function pieDetailRows({ chart, sheet, modeCol, qtyCol, countCol, countLabel }) {
  const rows = [
    row({
      name: `${chart} — donut center total`,
      type: 'Pie',
      sheet,
      mainCols: qtyCol,
      otherCols: modeCol,
      formula: `Sum of ${qtyCol} for every mode`,
      meaning: 'Number in the middle of the donut.',
      example: 'Mode sums 10,000 + 20,000 = 30,000 in the center.',
    }),
  ];
  for (const mode of MODE5) {
    rows.push(row({
      name: `${chart} — ${mode} cane qty`,
      type: 'Pie',
      sheet,
      mainCols: `${modeCol}, ${qtyCol}`,
      otherCols: countCol,
      formula: `Sum of ${qtyCol} where ${modeCol} = ${mode}`,
      meaning: `Cane quantity printed on the ${mode} slice.`,
      example: `${mode} sum = 20,000 Qtls.`,
    }));
    rows.push(row({
      name: `${chart} — ${mode} ${countLabel}`,
      type: 'Pie',
      sheet,
      mainCols: `${modeCol}, ${countCol}`,
      otherCols: qtyCol,
      formula: `Count of rows where ${modeCol} = ${mode}`,
      meaning: `${countLabel} for the ${mode} slice.`,
      example: `${mode} has 400 rows.`,
    }));
    rows.push(row({
      name: `${chart} — ${mode} % of total`,
      type: 'Pie',
      sheet,
      mainCols: `${modeCol}, ${qtyCol}`,
      otherCols: 'All modes',
      formula: `Sum of ${qtyCol} for ${mode} ÷ Sum of ${qtyCol} for all modes × 100`,
      meaning: `Percent printed under the ${mode} callout.`,
      example: '20,000 ÷ 30,000 × 100 = 66.7%.',
    }));
  }
  return rows;
}

function logisticsRows({
  kpi1, kpi1How,
  kpi2, kpi2How,
  kpi3, kpi3How,
  timeName, entityNoun,
  fastRule, slaDefault,
  volumeColLabel,
  sheet, mainCols,
}) {
  return [
    row({
      name: kpi1,
      type: 'KPI',
      sheet,
      mainCols,
      otherCols: 'C.Name',
      formula: kpi1How,
      meaning: 'First card on this tab.',
      example: '40 names in the list → 40.',
    }),
    row({
      name: kpi2,
      type: 'KPI',
      sheet,
      mainCols,
      otherCols: timeName,
      formula: kpi2How,
      meaning: 'Second card. Average of the center times already on the list. Lower is better.',
      example: 'Center times 2, 4, 6 → average = 4 hrs.',
    }),
    row({
      name: kpi3,
      type: 'KPI',
      sheet,
      mainCols,
      otherCols: volumeColLabel,
      formula: kpi3How,
      meaning: 'Third card. Sum of the volume column on the list.',
      example: 'Center volumes 100 + 200 = 300.',
    }),
    row({
      name: 'SLA Target Compliance %',
      type: 'KPI',
      sheet,
      mainCols: timeName,
      otherCols: `SLA slider (starts at ${slaDefault} hrs)`,
      formula: `Count of ${entityNoun} whose ${timeName} ≤ SLA ÷ Count of ${entityNoun} × 100`,
      meaning: 'Fourth card. Share of the list inside the SLA.',
      example: `30 of 40 ${entityNoun} are within SLA → 75.0%.`,
    }),
    row({
      name: `Breach count (${entityNoun} exceeding SLA)`,
      type: 'KPI',
      sheet,
      mainCols: timeName,
      otherCols: `SLA slider (starts at ${slaDefault} hrs)`,
      formula: `Count of ${entityNoun} whose ${timeName} > SLA`,
      meaning: 'Number under the compliance card, and the Breach filter count.',
      example: '10 above SLA → Breach (10).',
    }),
    row({
      name: `Fast count (< threshold)`,
      type: 'Filter count',
      sheet,
      mainCols: timeName,
      otherCols: fastRule,
      formula: `Count of ${entityNoun} whose ${timeName} ${fastRule}`,
      meaning: 'Count on the Fast filter chip.',
      example: '8 centers under the fast line → Fast (8).',
    }),
    row({
      name: 'Target count (within SLA)',
      type: 'Filter count',
      sheet,
      mainCols: timeName,
      otherCols: `SLA slider (starts at ${slaDefault} hrs)`,
      formula: `Count of ${entityNoun} whose ${timeName} ≤ SLA\n(This includes the fast ones.)`,
      meaning: 'Count on the Target filter chip.',
      example: '30 within SLA → Target (30).',
    }),
    row({
      name: 'All count',
      type: 'Filter count',
      sheet,
      mainCols: 'C.Name',
      otherCols: '',
      formula: `Count of ${entityNoun} on the list`,
      meaning: 'Count on the All filter chip.',
      example: '40 centers → All (40).',
    }),
    row({
      name: 'SLA slider',
      type: 'Control',
      sheet,
      mainCols: '—',
      otherCols: '',
      formula: `Starts at ${slaDefault} hrs. Moving it changes Compliance %, Breach, and Target. It does not change the stored times.`,
      meaning: 'Threshold the operator sets on this tab.',
      example: `Default ${slaDefault} hrs.`,
    }),
    row({
      name: 'Fastest leaderboard (top 3)',
      type: 'Chart',
      sheet,
      mainCols: `C.Name, ${timeName}, ${volumeColLabel}`,
      otherCols: '',
      formula: `Sort ${entityNoun} by ${timeName} from lowest to highest\nShow the first 3: name, volume, and time`,
      meaning: 'Three cards above the table.',
      example: 'Fastest time 1.2 hrs is card 1.',
    }),
    row({
      name: 'Table — Rank',
      type: 'Column',
      sheet,
      mainCols: timeName,
      otherCols: 'C.Name',
      formula: `1, 2, 3… after sorting by ${timeName} from lowest to highest`,
      meaning: 'Rank column.',
      example: 'Lowest time is rank 1.',
    }),
    row({
      name: 'Table — Name',
      type: 'Column',
      sheet,
      mainCols: 'C.Name',
      otherCols: '',
      formula: 'Center name on the row',
      meaning: 'Name column.',
      example: 'SAKETHU.',
    }),
    row({
      name: 'Table — Status',
      type: 'Column',
      sheet,
      mainCols: timeName,
      otherCols: `SLA (${slaDefault} hrs) and fast line`,
      formula: `Green if ${timeName} ${fastRule}\nAmber if time is at least the fast line and ≤ SLA\nRed if ${timeName} > SLA`,
      meaning: 'Status pill next to the time.',
      example: '4.2 hrs with SLA 3.0 → red.',
    }),
    row({
      name: `Table — ${timeName}`,
      type: 'Column',
      sheet,
      mainCols: timeName,
      otherCols: '',
      formula: kpi2How.includes('Average') ? `The center’s own ${timeName} (same average used to build the list)` : kpi2How,
      meaning: 'Time column.',
      example: '2.40 h.',
    }),
    row({
      name: 'Table — SLA Meter',
      type: 'Column',
      sheet,
      mainCols: timeName,
      otherCols: 'SLA slider',
      formula: `Bar length = ${timeName} ÷ chart scale\nColour follows Status (green / amber / red)`,
      meaning: 'Bar beside the time. It is not a separate stored number.',
      example: 'Time halfway to the scale → bar about 50% full.',
    }),
    row({
      name: `Table — ${volumeColLabel}`,
      type: 'Column',
      sheet,
      mainCols: volumeColLabel,
      otherCols: '',
      formula: kpi3How.includes('Sum') ? `That center’s own volume, using the same rule as “${kpi3}”` : kpi3How,
      meaning: 'Volume column.',
      example: '12,000 on that center’s row.',
    }),
    row({
      name: 'Table — Action',
      type: 'Column',
      sheet,
      mainCols: '—',
      otherCols: '',
      formula: 'Opens the detail drawer for that row. No extra calculation.',
      meaning: 'Button on the row.',
      example: 'Click Action on rank 1 to see that center.',
    }),
  ];
}

function addScreenDetailRows() {
  const P = TAB_METRICS['Procurement Summary'];
  P.push(
    pctRow('Total Trips (Nos.)', C, 'Current = Count of distinct CHALLAN'),
    pctRow('Avg Transit Time (Hrs)', C, 'Current = Average of Truck Transit (Hrs)'),
    pctRow('Truck Holding (Hrs)', C, 'Current = Average of Truck Holding for KPI (Hrs)'),
    pctRow('Waiting Time / Yard Waiting (Hrs)', C, 'Current = Average of Yard Waiting (Hrs)'),
    pctRow('Cane Holding Time (Hrs)', C, 'Current = quantity-weighted average of Cane Holding (Hrs)'),
    pctRow('Time at Donga (Hrs)', C, 'Current = Average of Time at Donga (Hrs)'),
    row({
      name: 'Gate Vehicles — Mode',
      type: 'Column',
      sheet: G,
      mainCols: 'SUP_MOD',
      otherCols: 'm_date',
      formula: 'One row per SUP_MOD',
      meaning: 'First column of the Gate Vehicles table on the cut-to-crush map.',
      example: '63 QTROLLY.',
    }),
    row({
      name: 'Gate Vehicles — Vehicles',
      type: 'Column',
      sheet: G,
      mainCols: 'SUP_MOD, purchyno',
      otherCols: 'm_date',
      formula: 'For that SUP_MOD: Count of rows',
      meaning: 'Vehicles column.',
      example: '63 QTROLLY has 50 rows → 50.',
    }),
    row({
      name: 'Gate Vehicles — Cane (Q)',
      type: 'Column',
      sheet: G,
      mainCols: 'SUP_MOD, Purchase_QTL (Qtls)',
      otherCols: 'm_date',
      formula: 'For that SUP_MOD: Sum of Purchase_QTL (Qtls)',
      meaning: 'Cane (Q) column.',
      example: 'Sum = 4,000 Qtls.',
    }),
    row({
      name: 'Gate Vehicles — Time (Hrs)',
      type: 'Column',
      sheet: G,
      mainCols: 'SUP_MOD, Yard Holding (Hrs)',
      otherCols: 'TokenToGross (Min)',
      formula: 'For that SUP_MOD: Average of Yard Holding (Hrs)',
      meaning: 'Time (Hrs) column.',
      example: 'Average yard holding = 2.4 hrs.',
    }),
    row({
      name: 'Center Vehicles — Mode',
      type: 'Column',
      sheet: C,
      mainCols: 'Mode Name of Transport',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'One row per Mode Name of Transport',
      meaning: 'First column of the farm / center vehicles table.',
      example: '36 QTROLLY.',
    }),
    row({
      name: 'Center Vehicles — Vehicles',
      type: 'Column',
      sheet: C,
      mainCols: 'Mode Name of Transport, Purchy No.',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'For that mode: Count of rows',
      meaning: 'Vehicles column.',
      example: '36 QTROLLY has 80 rows → 80.',
    }),
    row({
      name: 'Center Vehicles — Cane (Q)',
      type: 'Column',
      sheet: C,
      mainCols: 'Mode Name of Transport, Purchased Quantity (Qtl.)',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'For that mode: Sum of Purchased Quantity (Qtl.)',
      meaning: 'Cane (Q) column.',
      example: 'Sum = 6,500 Qtls.',
    }),
    row({
      name: 'Center Vehicles — Time (Hrs)',
      type: 'Column',
      sheet: C,
      mainCols: 'Mode Name of Transport, Center Holding (Hrs)',
      otherCols: 'WaitingTimeCnt (Min)',
      formula: 'For that mode: Average of Center Holding (Hrs)\n(Center Holding (Hrs) = WaitingTimeCnt (Min) ÷ 60)',
      meaning: 'Time (Hrs) column.',
      example: 'Average = 5.2 hrs.',
    }),
    row({
      name: 'Center Holding table — Mode',
      type: 'Column',
      sheet: C,
      mainCols: 'Mode Name of Transport',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'One row per Mode Name of Transport (Total row is not shown)',
      meaning: 'Small holding table under Centers.',
      example: '18 QCART.',
    }),
    row({
      name: 'Center Holding table — Holding Time (H)',
      type: 'Column',
      sheet: C,
      mainCols: 'Mode Name of Transport, Center Holding (Hrs)',
      otherCols: 'WaitingTimeCnt (Min)',
      formula: 'For that mode: Average of Center Holding (Hrs)',
      meaning: 'Holding Time (H) column.',
      example: '18 QCART average = 3.1 hrs.',
    }),
    row({
      name: 'Yard table — Mode',
      type: 'Column',
      sheet: G,
      mainCols: 'SUP_MOD',
      otherCols: 'm_date',
      formula: 'One row per SUP_MOD',
      meaning: 'Yard table, first column.',
      example: '63 QTROLLY.',
    }),
    row({
      name: 'Yard table — Avg Time',
      type: 'Column',
      sheet: G,
      mainCols: 'SUP_MOD, Yard Holding (Hrs)',
      otherCols: 'TokenToGross (Min)',
      formula: 'For that SUP_MOD: Average of Yard Holding (Hrs)',
      meaning: 'Avg Time column.',
      example: 'Average = 2.8 hrs.',
    }),
    row({
      name: 'Yard table — Dev. (>8H)',
      type: 'Column',
      sheet: G,
      mainCols: 'SUP_MOD, Yard > 8 Hrs (1 = Yes)',
      otherCols: 'Yard Holding (Hrs)',
      formula: 'For that SUP_MOD: Sum of Yard > 8 Hrs (1 = Yes)',
      meaning: 'Count of vehicles over 8 hours.',
      example: '10 vehicles → Dev. = 10.',
    }),
    row({
      name: 'Mill Premise table — Mode',
      type: 'Column',
      sheet: G,
      mainCols: 'SUP_MOD',
      otherCols: 'm_date',
      formula: 'One row per SUP_MOD',
      meaning: 'Mill table, first column.',
      example: '99 QTRUCK.',
    }),
    row({
      name: 'Mill Premise table — Avg Time',
      type: 'Column',
      sheet: G,
      mainCols: 'SUP_MOD, Time at Donga (Hrs)',
      otherCols: 'GrossToTare (Min)',
      formula: 'For that SUP_MOD: Average of Time at Donga (Hrs)',
      meaning: 'Avg Time column.',
      example: 'Average = 0.4 hrs.',
    }),
    row({
      name: 'Mill Premise table — Dev (>0.5H)',
      type: 'Column',
      sheet: G,
      mainCols: 'SUP_MOD, Donga > 0.5 Hrs (1 = Yes)',
      otherCols: 'Time at Donga (Hrs)',
      formula: 'For that SUP_MOD: Sum of Donga > 0.5 Hrs (1 = Yes)',
      meaning: 'Count of vehicles unloading longer than half an hour.',
      example: '8 vehicles → Dev = 8.',
    }),
  );

  TAB_METRICS['Gate 1'].push(
    pctRow('Total Cane Purchased (Qtls)', G, 'Current = Sum of Purchase_QTL (Qtls)'),
    pctRow('No. of Parchy (Nos.)', G, 'Current = Count of rows'),
    pctRow('Avg Parchy Size (Qtls)', G, 'Current = Sum of Purchase_QTL (Qtls) ÷ Count of rows'),
    pctRow('Avg Parchy Overrun (Qtls)', G, 'Current = average of the per-mode Average of Overrun (Qtls)'),
    ...pieDetailRows({
      chart: 'Purchase Split - Modewise',
      sheet: G,
      modeCol: 'SUP_MOD',
      qtyCol: 'Purchase_QTL (Qtls)',
      countCol: 'purchyno',
      countLabel: 'No. of Parchy',
    }),
    ...modeSeriesRows({
      chart: 'Parchi Overrun Trend (Qtls)',
      modes: MODE5,
      sheet: G,
      dateCol: 'm_date',
      modeCol: 'SUP_MOD',
      perModeFormula: 'Average of Overrun (Qtls)',
      unit: 'Qtls',
    }),
  );

  const g2 = TAB_METRICS['Gate 2'];
  g2.push(
    pctRow('Total Vehicles (Nos.)', G, 'Current = Count of rows'),
    pctRow('Avg Yard Holding (Hrs)', G, 'Current = average of the per-mode averages'),
    pctRow('Max Yard Holding (Hrs)', G, 'Current = Maximum of Yard Holding (Hrs)'),
    pctRow('Vehicles Exceeding >8 Hrs (Nos.)', G, 'Current = Sum of Yard > 8 Hrs (1 = Yes)'),
    row({
      name: 'Gate 2 mode cards on screen',
      type: 'Note',
      sheet: G,
      mainCols: 'SUP_MOD',
      otherCols: '',
      formula: 'The screen draws four cards only: 18 QCART, 36 QTROLLY, 63 QTROLLY, 99 QTRUCK.\n45 QTROLLY is not a Gate 2 card.',
      meaning: 'Which modes appear as cards.',
      example: 'No 45 QTROLLY card on Gate 2.',
    }),
  );
  for (const { mode, countLabel } of GATE2_MODES) {
    g2.push(
      row({
        name: `${mode} — ${countLabel}`,
        type: 'Card',
        sheet: G,
        mainCols: 'SUP_MOD, purchyno',
        otherCols: 'm_date',
        formula: `Count of rows where SUP_MOD = ${mode}`,
        meaning: `Vehicle count on the ${mode} card.`,
        example: `${mode} has 120 rows → 120.`,
      }),
      row({
        name: `${mode} — Min Yard Holding (Hrs)`,
        type: 'Card',
        sheet: G,
        mainCols: 'SUP_MOD, Yard Holding (Hrs)',
        otherCols: 'TokenToGross (Min)',
        formula: `Minimum of Yard Holding (Hrs) where SUP_MOD = ${mode}`,
        meaning: `Min on the ${mode} card.`,
        example: 'Shortest hold = 0.4 hrs.',
      }),
      row({
        name: `${mode} — Avg Yard Holding (Hrs)`,
        type: 'Card',
        sheet: G,
        mainCols: 'SUP_MOD, Yard Holding (Hrs)',
        otherCols: 'TokenToGross (Min)',
        formula: `Average of Yard Holding (Hrs) where SUP_MOD = ${mode}`,
        meaning: `Average on the ${mode} card.`,
        example: 'Average = 3.2 hrs.',
      }),
      row({
        name: `${mode} — Max Yard Holding (Hrs)`,
        type: 'Card',
        sheet: G,
        mainCols: 'SUP_MOD, Yard Holding (Hrs)',
        otherCols: 'TokenToGross (Min)',
        formula: `Maximum of Yard Holding (Hrs) where SUP_MOD = ${mode}`,
        meaning: `Max on the ${mode} card.`,
        example: 'Longest hold = 9.1 hrs.',
      }),
      row({
        name: `${mode} — Exceeding Holding Time`,
        type: 'Card',
        sheet: G,
        mainCols: 'SUP_MOD, Yard > 8 Hrs (1 = Yes)',
        otherCols: 'Yard Holding (Hrs)',
        formula: `Sum of Yard > 8 Hrs (1 = Yes) where SUP_MOD = ${mode}`,
        meaning: `Exceeding count on the ${mode} card.`,
        example: '4 rows marked 1 → 4.',
      }),
    );
  }
  g2.push(
    ...modeSeriesRows({
      chart: 'Average Yard Holding Time',
      modes: GATE2_MODES.map((m) => m.mode),
      sheet: G,
      dateCol: 'm_date',
      modeCol: 'SUP_MOD',
      perModeFormula: 'Average of Yard Holding (Hrs)',
      unit: 'Hrs',
    }),
    ...modeSeriesRows({
      chart: 'Vehicles Exceeding Standard Holding Time',
      modes: GATE2_MODES.map((m) => m.mode),
      sheet: G,
      dateCol: 'm_date',
      modeCol: 'SUP_MOD',
      perModeFormula: 'Sum of Yard > 8 Hrs (1 = Yes)',
      unit: 'vehicles',
      type: 'Bar series',
    }),
  );

  TAB_METRICS['Center Purchase'].push(
    pctRow('Cane Purchased (Qtls)', C, 'Current = Sum of Purchased Quantity (Qtl.)'),
    pctRow('No. of Purchy (Nos.)', C, 'Current = Count of rows'),
    pctRow('Avg Parchi Size (Qtls)', C, 'Current = Sum of Purchased Quantity (Qtl.) ÷ Count of rows'),
    pctRow('Trips C to G (Nos.)', C, 'Current = Count of distinct CHALLAN'),
    pctRow('Avg Parchi Overrun (Qtls)', C, 'Current = average of the per-mode Average of Overrun (Qtls)'),
    ...pieDetailRows({
      chart: 'Purchase Split - Modewise',
      sheet: C,
      modeCol: 'Mode Name of Transport',
      qtyCol: 'Purchased Quantity (Qtl.)',
      countCol: 'Purchy No.',
      countLabel: 'No. of Purchy',
    }),
    ...modeSeriesRows({
      chart: 'Parchi Overrun Trend (Qtls)',
      modes: MODE5,
      sheet: C,
      dateCol: 'Weighment Date (Purchy)',
      modeCol: 'Mode Name of Transport',
      perModeFormula: 'Average of Overrun (Qtls)',
      unit: 'Qtls',
    }),
  );

  const vh = TAB_METRICS['Vehicle Handling'];
  vh.push(
    pctRow('Vehicles Handled (Nos.)', C, 'Current = Count of rows'),
    row({
      name: 'Top 3 mode KPI cards',
      type: 'KPI',
      sheet: C,
      mainCols: 'Mode Name of Transport, Purchy No.',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'For each Mode Name of Transport: Vehicles = Count of rows\nSort modes by Vehicles from highest to lowest\nShow the first 3 mode names and their vehicle counts\nThese three cards have no % change',
      meaning: 'The three mode cards beside Vehicles Handled.',
      example: '63 QTROLLY 800, 36 QTROLLY 400, 18 QCART 200.',
    }),
    row({
      name: 'Mode wise Split — bar value label',
      type: 'Chart',
      sheet: C,
      mainCols: 'Mode Name of Transport',
      otherCols: 'Purchy No.',
      formula: 'Bar height and the number above the bar = Count of rows for that mode',
      meaning: 'Number printed on each bar.',
      example: '63 QTROLLY bar labelled 800.',
    }),
    ...modeSeriesRows({
      chart: 'Vehicle Handling Trend (Mode wise)',
      modes: MODE5,
      sheet: C,
      dateCol: 'Weighment Date (Purchy)',
      modeCol: 'Mode Name of Transport',
      perModeFormula: 'Count of rows',
      unit: 'vehicles',
    }),
    row({
      name: 'Centers with Most Vehicle Handled (Top 10)',
      type: 'Table',
      sheet: C,
      mainCols: 'C.Name, Mode Name of Transport',
      otherCols: 'Purchy No.',
      formula: 'For each C.Name, count rows in 18 QCART, 36 QTROLLY, 45 QTROLLY, 63 QTROLLY, and Total\nTotal = sum of those four counts\n99 QTRUCK is not a column on this table\nKeep the 10 centers with the highest Total',
      meaning: 'Left table. Columns: Center, 18 QCART, 36 QTROLLY, 45 QTROLLY, 63 QTROLLY, Total.',
      example: 'Center A total 120 → near the top.',
    }),
    row({
      name: 'Centers with Least Vehicle Handled (Top 10)',
      type: 'Table',
      sheet: C,
      mainCols: 'C.Name, Mode Name of Transport',
      otherCols: 'Purchy No.',
      formula: 'Same four mode columns and Total as the Most table\nKeep the 10 centers with the lowest Total\n99 QTRUCK is not a column',
      meaning: 'Right table. Same columns as Most.',
      example: 'Center B total 4 → near the top of Least.',
    }),
  );

  const hold = TAB_METRICS['Vehicle Holding'];
  hold.push(
    pctRow('Avg Holding Time (Hrs)', C, 'Current = average of the per-mode Average of Center Holding (Hrs)'),
  );
  for (const mode of MODE5) {
    hold.push(
      row({
        name: `${mode} — holding card (Hrs)`,
        type: 'KPI',
        sheet: C,
        mainCols: 'Mode Name of Transport, Center Holding (Hrs)',
        otherCols: 'WaitingTimeCnt (Min)',
        formula: `Average of Center Holding (Hrs) where Mode Name of Transport = ${mode}\nA mode with no rows is not shown as a card`,
        meaning: `Mode card next to Avg Holding Time. % change uses the same mode in the compare period.`,
        example: `${mode} average = 6.1 hrs.`,
      }),
      pctRow(`${mode} — holding card (Hrs)`, C, `Current = Average of Center Holding (Hrs) for ${mode}`),
    );
  }
  hold.push(
    ...modeSeriesRows({
      chart: 'Avg Holding Time at Centers - Trend',
      modes: MODE5,
      sheet: C,
      dateCol: 'Weighment Date (Purchy)',
      modeCol: 'Mode Name of Transport',
      perModeFormula: 'Average of Center Holding (Hrs)',
      unit: 'Hrs',
    }),
  );

  TAB_METRICS['Vehicle Holding 2'].push(...logisticsRows({
    kpi1: 'Total Active Centers',
    kpi1How: 'Count of distinct C.Name on the holding list',
    kpi2: 'Avg Turnaround Time',
    kpi2How: 'Average of each center’s Average of Center Holding (Hrs)',
    kpi3: 'Total Fleet Processed',
    kpi3How: 'Sum of each center’s vehicle count (Count of rows)',
    timeName: 'Turnaround Duration',
    entityNoun: 'centers',
    fastRule: '< 2.0 hrs',
    slaDefault: '3.0',
    volumeColLabel: 'Volume (Vehicles)',
    sheet: C,
    mainCols: 'C.Name, Center Holding (Hrs), Purchy No.',
  }));

  TAB_METRICS['Truck Transit'].push(...logisticsRows({
    kpi1: 'Total Centers',
    kpi1How: 'Count of distinct C.Name on the transit list',
    kpi2: 'Avg Transit Duration',
    kpi2How: 'Average of each center’s Average of Truck Transit (Hrs)',
    kpi3: 'Total Cane Qty (Qtls)',
    kpi3How: 'Sum of each center’s Sum of Purchased Quantity (Qtl.)',
    timeName: 'Transit Time',
    entityNoun: 'centers',
    fastRule: '< 2.0 hrs',
    slaDefault: '3.0',
    volumeColLabel: 'Cane Qty (Qtls)',
    sheet: C,
    mainCols: 'C.Name, Truck Transit (Hrs), Purchased Quantity (Qtl.)',
  }));

  TAB_METRICS['Truck Holding'].push(...logisticsRows({
    kpi1: 'Active Holding Yards',
    kpi1How: 'Count of distinct C.Name on the truck-holding list',
    kpi2: 'Avg Truck Holding Time',
    kpi2How: 'Average of each center’s Average of Truck Holding (Hrs)',
    kpi3: 'Total Cane Qty (Qtls)',
    kpi3How: 'Sum of each center’s Sum of Purchased Quantity (Qtl.)',
    timeName: 'Holding Duration',
    entityNoun: 'yards',
    fastRule: '< 0.35 hrs',
    slaDefault: '0.5',
    volumeColLabel: 'Cane Qty (Qtls)',
    sheet: C,
    mainCols: 'C.Name, Truck Holding (Hrs), Purchased Quantity (Qtl.)',
  }));
}

function withYellowFormulas(formula, sheet) {
  const text = String(formula || '');
  const specs = YELLOW_COLUMNS[sheet] || [];
  const notes = [];
  specs
    .slice()
    .sort((a, b) => b.name.length - a.name.length)
    .forEach((spec) => {
      if (!text.includes(spec.name)) return;
      if (text.includes(spec.formula) || text.includes(`${spec.name} =`)) return;
      notes.push(spec.formula);
    });
  if (!notes.length) return text;
  return `${text}\n${notes.join('\n')}`;
}

function styleHeader(row, fill = TEAL) {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: WHITE }, size: 10, name: 'Calibri' };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
    c.alignment = { vertical: 'middle', wrapText: true, horizontal: 'center' };
    c.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });
  row.height = 32;
}

function styleBody(cell, stripe) {
  cell.alignment = { vertical: 'top', wrapText: true };
  cell.font = { name: 'Calibri', size: 10 };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
  if (stripe) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
}

function addTitle(ws, text, colCount) {
  ws.mergeCells(1, 1, 1, colCount);
  const cell = ws.getCell(1, 1);
  cell.value = text;
  cell.font = { bold: true, size: 13, color: { argb: WHITE }, name: 'Calibri' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 28;
}

function writeSheet(wb, name, title, headers, rows, { status = false } = {}) {
  const ws = wb.addWorksheet(name.slice(0, 31));
  addTitle(ws, title, headers.length);
  const headerRow = ws.addRow(headers.map((h) => h.header));
  styleHeader(headerRow);
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = h.width;
  });
  const statusCol = status ? headers.findIndex((h) => h.key === 'status') + 1 : 0;
  rows.forEach((row, idx) => {
    const values = headers.map((h) => (h.key === 'status' ? 'Pending' : (row[h.key] ?? '')));
    const r = ws.addRow(values);
    r.eachCell((c) => styleBody(c, idx % 2 === 1));
    r.height = Math.min(140, 28 + Math.ceil(String(row.formula || row.does || '').length / 70) * 12);
    if (statusCol) {
      const cell = r.getCell(statusCol);
      cell.value = 'Pending';
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILLS.Pending } };
      cell.dataValidation = {
        type: 'list',
        allowBlank: false,
        formulae: [`"${STATUS_OPTIONS.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Status',
        error: 'Choose Verified, Need to discuss, Mistake, or Pending.',
      };
    }
  });
  if (statusCol && rows.length) {
    const letter = ws.getColumn(statusCol).letter;
    const ref = `${letter}3:${letter}${rows.length + 2}`;
    ws.addConditionalFormatting({
      ref,
      rules: Object.entries(STATUS_FILLS).map(([label, argb]) => ({
        type: 'cellIs',
        operator: 'equal',
        formulae: [`"${label}"`],
        style: {
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb }, bgColor: { argb } },
          font: { name: 'Calibri', size: 10, bold: true },
        },
      })),
    });
  }
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  return ws;
}

const COLUMN_MEANING = {
  'm_date': 'Gate reporting date used for Gate trends and filters',
  'SUP_MOD': 'Transport mode (18 QCART, 36/45/63 QTROLLY, 99 QTROLLY/QTRUCK)',
  'purchyno': 'Gate parchie / purchy number',
  'Purchase_QTL (Qtls)': 'Cane quantity purchased at gate (quintals). Blue source column.',
  'TokenToGross (Min)': 'Yard wait in minutes, from token to gross. Blue source column.',
  'GrossToTare (Min)': 'Unloading time in minutes. Blue source column.',
  'CutToToken (Min)': 'Minutes from cut to token. Blue source column.',
  'CTC (Min)': 'Cut-to-crush minutes. Blue source column.',
  'TAREdatetime': 'Empty-vehicle weighment date/time. Blue source column.',
  'v_code': 'Village code on the gate record',
  'v_name': 'Village name on the gate record',
  'Weighment Date (Purchy)': 'Center reporting date used for Center trends and filters',
  'C.Name': 'Center name',
  'C.Code': 'Center code',
  'Purchy No.': 'Center purchy number',
  'Mode Name of Transport': 'Transport mode at center',
  'Mode Code of Transport': 'Transport mode code at center',
  'Purchased Quantity (Qtl.)': 'Cane quantity at center (quintals). Blue source column.',
  'CHALLAN': 'Challan / trip number',
  'WaitingTimeCnt (Min)': 'Center holding in minutes. Blue source column.',
  'TravelHrCntYard (Min)': 'Transit time from center to yard, in minutes. Blue source column.',
  'WaitingTimeYard (Min)': 'Yard waiting in minutes on the center record. Blue source column.',
  'WaitingTimeDonga (Min)': 'Donga / unloading in minutes. Blue source column.',
  'TravelHrToCnt (Min)': 'Travel time to the center, in minutes. Blue source column.',
  'ToalTimeCTC (Min)': 'Total cut-to-crush minutes on the center record. Blue source column.',
};

function columnMeaning(sheet, name) {
  const yellow = (YELLOW_COLUMNS[sheet] || []).find((spec) => spec.name === name);
  if (yellow) return yellow.formula;
  return COLUMN_MEANING[name] || 'Column used in a dashboard formula.';
}

function columnsUsedInFormulas(metricsByTab) {
  const used = [];
  const seen = new Set();
  const add = (sheet, name) => {
    const key = `${sheet}|${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    used.push({ sheet, name });
  };
  Object.values(metricsByTab).forEach((metrics) => {
    metrics.forEach((metric) => {
      const sheet = metric.sheet;
      const headers = (YELLOW_COLUMNS[sheet] || []).map((spec) => spec.name)
        .concat(Object.keys(COLUMN_MEANING));
      const unique = [...new Set(headers)].sort((a, b) => b.length - a.length);
      let rest = String(metric.formula || '');
      unique.forEach((name) => {
        if (!rest.includes(name)) return;
        add(sheet, name);
        rest = rest.split(name).join('');
      });
    });
  });
  used.sort((a, b) => a.sheet.localeCompare(b.sheet) || a.name.localeCompare(b.name));
  return used;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLog';
  wb.created = new Date();

  // How to read
  {
    const ws = wb.addWorksheet('How to read');
    addTitle(ws, 'Cane Performance formulas — for business owners', 2);
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 90;
    const intro = [
      ['Audience', 'Business owners / operations — not developers.'],
      ['Purpose', 'Explain every number and chart on the Cane Performance dashboard in simple words.'],
      ['Column names', 'Always use the same names as the Season Export Excel (Gate Records / Center Records).'],
      ['Gate Records', 'Gate tabs: Procurement (gate part), Gate 1, Gate 2.'],
      ['Center Records', 'Center tabs: Center Purchase, Vehicle Handling / Holding, Truck Transit / Holding.'],
      ['Formula style', 'Written like: Sum of Purchase_QTL (Qtls) ÷ Count of rows — never SQL or code. If a formula uses a yellow export column, the same cell also shows how that column is calculated from the blue source columns.'],
      ['Status', 'Last column on every dashboard tab. Choose Verified, Need to discuss, Mistake, or Pending. New rows start as Pending.'],
      ['First sheet', 'Common Filters & Controls = shared date filters, WTD/MTD/STD, sync, compare.'],
      ['Other sheets', 'One sheet per dashboard tab.'],
      ['How to verify', 'Download season Excel → open Gate Records or Center Records → apply the Simple formula on those columns.'],
    ];
    const hr = ws.addRow(['Topic', 'Guidance']);
    styleHeader(hr, TEAL);
    intro.forEach((pair, i) => {
      const r = ws.addRow(pair);
      r.eachCell((c) => styleBody(c, i % 2 === 1));
      r.height = 36;
    });
    ws.views = [{ state: 'frozen', ySplit: 2 }];
  }

  writeSheet(
    wb,
    'Common Filters & Controls',
    'Shared filters, sync, WTD / MTD / STD, compare — with examples',
    COMMON_HEADERS,
    COMMON_ROWS.map((r) => ({
      area: r[0],
      feature: r[1],
      does: r[2],
      example: r[3],
    })),
  );

  addScreenDetailRows();
  for (const metrics of Object.values(TAB_METRICS)) {
    metrics.forEach((metric) => {
      metric.formula = withYellowFormulas(metric.formula, metric.sheet);
    });
  }

  const glossary = columnsUsedInFormulas(TAB_METRICS);

  // Column glossary — every column named in a Simple formula, including blue sources of yellow columns
  {
    const ws = wb.addWorksheet('Export column names');
    addTitle(ws, 'Every column used in Simple formula (same names as the Season Export)', 4);
    const hr = ws.addRow(['Export sheet', 'Column name', 'Header on export', 'Simple meaning / formula from blue columns']);
    styleHeader(hr, TEAL);
    ws.getColumn(1).width = 18;
    ws.getColumn(2).width = 36;
    ws.getColumn(3).width = 22;
    ws.getColumn(4).width = 88;
    glossary.forEach((item, i) => {
      const yellow = (YELLOW_COLUMNS[item.sheet] || []).some((spec) => spec.name === item.name);
      const r = ws.addRow([
        item.sheet,
        item.name,
        yellow ? 'Yellow — calculated' : 'Blue — source',
        columnMeaning(item.sheet, item.name),
      ]);
      r.eachCell((c) => styleBody(c, i % 2 === 1));
      r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: yellow ? YELLOW : BLUE } };
      r.height = Math.min(80, 22 + Math.ceil(String(r.getCell(4).value || '').length / 80) * 14);
    });
    ws.views = [{ state: 'frozen', ySplit: 2 }];
  }

  const counts = {};
  const statusHeader = { header: 'Status', key: 'status', width: 22 };
  for (const [tab, metrics] of Object.entries(TAB_METRICS)) {
    writeSheet(
      wb,
      tab,
      `${tab} — numbers, charts and trends (business formulas)`,
      [...METRIC_HEADERS, statusHeader],
      metrics,
      { status: true },
    );
    counts[tab] = metrics.length;
  }

  // Index
  {
    const ws = wb.addWorksheet('Index');
    addTitle(ws, 'Sheet index', 3);
    const hr = ws.addRow(['Sheet', 'Rows', 'Purpose']);
    styleHeader(hr, TEAL);
    ws.getColumn(1).width = 28;
    ws.getColumn(2).width = 10;
    ws.getColumn(3).width = 60;
    const indexRows = [
      ['How to read', '—', 'How business owners should use this file'],
      ['Common Filters & Controls', String(COMMON_ROWS.length), 'Shared date filters, sync, compare'],
      ['Export column names', String(glossary.length), 'Every column used in Simple formula. Yellow = calculated, Blue = source.'],
      ...Object.entries(counts).map(([k, n]) => [k, String(n), `Formulas for ${k} tab`]),
    ];
    indexRows.forEach((row, i) => {
      const r = ws.addRow(row);
      r.eachCell((c) => styleBody(c, i % 2 === 1));
    });
  }

  await wb.xlsx.writeFile(OUT);
  console.log('Wrote', OUT);
  console.log('Counts', counts);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
