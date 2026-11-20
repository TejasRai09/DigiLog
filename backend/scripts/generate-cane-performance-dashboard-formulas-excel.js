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
const AMBER = 'FFF8E1';

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
      name: 'Top / Bottom 10 Centers',
      type: 'Table',
      sheet: C,
      mainCols: 'C.Name, Purchased Quantity (Qtl.), Purchy No.',
      otherCols: 'Weighment Date (Purchy)',
      formula: 'For each C.Name:\n• Trips = Count of rows\n• Cane Purchased = Sum of Purchased Quantity (Qtl.)\n• Avg Parchi Size = Cane Purchased ÷ Trips\nThen sort highest / lowest 10 by Cane Purchased',
      meaning: 'Best and lowest centers by cane quantity.',
      example: 'Top center has highest Sum of Purchased Quantity (Qtl.).',
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
      name: 'Vehicle vs Center Holding Time',
      type: 'Table',
      sheet: C,
      mainCols: 'C.Name, Mode Name of Transport, Center Holding (Hrs)',
      otherCols: 'Purchy No.',
      formula: 'For each C.Name and Mode Name of Transport:\n• Avg Holding = Average of Center Holding (Hrs)\n• Vehicles = Count of rows',
      meaning: 'Holding time by center and mode.',
      example: 'Center X, 36 QTROLLY average holding = 7.2 hrs.',
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

function writeSheet(wb, name, title, headers, rows) {
  const ws = wb.addWorksheet(name.slice(0, 31));
  addTitle(ws, title, headers.length);
  const headerRow = ws.addRow(headers.map((h) => h.header));
  styleHeader(headerRow);
  headers.forEach((h, i) => {
    ws.getColumn(i + 1).width = h.width;
  });
  rows.forEach((row, idx) => {
    const values = headers.map((h) => row[h.key] ?? '');
    const r = ws.addRow(values);
    r.eachCell((c) => styleBody(c, idx % 2 === 1));
    r.height = Math.min(90, 28 + Math.ceil(String(row.formula || row.does || '').length / 70) * 12);
  });
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  return ws;
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
      ['Formula style', 'Written like: Sum of Purchase_QTL (Qtls) ÷ Count of rows — never SQL or code.'],
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

  // Column glossary
  {
    const ws = wb.addWorksheet('Export column names');
    addTitle(ws, 'Column names used in formulas (= Season Export Excel headers)', 3);
    const hr = ws.addRow(['Export sheet', 'Column name', 'Simple meaning']);
    styleHeader(hr, TEAL);
    ws.getColumn(1).width = 16;
    ws.getColumn(2).width = 48;
    ws.getColumn(3).width = 56;
    const glossary = [
      [G, 'm_date', 'Gate reporting date used for Gate trends and filters'],
      [G, 'SUP_MOD', 'Transport mode (18 QCART, 36/45/63 QTROLLY, 99 QTROLLY/QTRUCK)'],
      [G, 'purchyno', 'Gate parchie / purchy number'],
      [G, 'Purchase_QTL (Qtls)', 'Cane quantity purchased at gate (quintals)'],
      [G, 'TokenToGross (Min)', 'Yard wait in minutes (token to gross)'],
      [G, 'Yard Holding (Hrs)', 'Yard wait in hours (= TokenToGross ÷ 60)'],
      [G, 'Yard > 8 Hrs (1 = Yes)', '1 if yard holding is more than 8 hours'],
      [G, 'GrossToTare (Min)', 'Unloading time in minutes'],
      [G, 'Time at Donga (Hrs)', 'Unloading time in hours (= GrossToTare ÷ 60)'],
      [G, 'Donga > 0.5 Hrs (1 = Yes)', '1 if unloading is more than 0.5 hours'],
      [G, 'Overrun (Qtls)', 'Purchase_QTL minus mode capacity'],
      [G, 'TAREdatetime', 'Empty-vehicle weighment date/time'],
      [C, 'Weighment Date (Purchy)', 'Center reporting date used for Center trends and filters'],
      [C, 'C.Name', 'Center name'],
      [C, 'Purchy No.', 'Center purchy number'],
      [C, 'Mode Name of Transport', 'Transport mode at center'],
      [C, 'Purchased Quantity (Qtl.)', 'Cane quantity at center (quintals)'],
      [C, 'CHALLAN', 'Challan / trip number'],
      [C, 'WaitingTimeCnt (Min)', 'Center holding in minutes'],
      [C, 'Center Holding (Hrs)', 'Center holding in hours (= WaitingTimeCnt ÷ 60)'],
      [C, 'TravelHrCntYard (Min)', 'Transit time center→yard in minutes'],
      [C, 'Truck Transit (Hrs)', 'Transit time in hours (= TravelHrCntYard ÷ 60)'],
      [C, 'WaitingTimeYard (Min)', 'Yard waiting in minutes (center record)'],
      [C, 'Yard Waiting (Hrs)', 'Yard waiting in hours (= WaitingTimeYard ÷ 60)'],
      [C, 'WaitingTimeDonga (Min)', 'Donga / unloading in minutes'],
      [C, 'Time at Donga (Hrs)', 'Donga time in hours (= WaitingTimeDonga ÷ 60)'],
      [C, 'Truck Holding (Hrs)', 'Truck holding time in hours'],
      [C, 'Truck Holding for KPI (Hrs)', 'Truck holding value used on summary KPI'],
      [C, 'Cane Holding (Hrs)', 'Cane holding time in hours'],
      [C, 'Overrun (Qtls)', 'Purchased Quantity minus mode capacity'],
    ];
    glossary.forEach((row, i) => {
      const r = ws.addRow(row);
      r.eachCell((c) => styleBody(c, i % 2 === 1));
      if (i === 0) r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBER } };
    });
    ws.views = [{ state: 'frozen', ySplit: 2 }];
  }

  const counts = {};
  for (const [tab, metrics] of Object.entries(TAB_METRICS)) {
    writeSheet(
      wb,
      tab,
      `${tab} — numbers, charts and trends (business formulas)`,
      METRIC_HEADERS,
      metrics,
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
      ['Export column names', '—', 'Dictionary of export Excel column names'],
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
