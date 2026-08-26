/**
 * Milling Division Cockpit — DigiLog formula reference.
 * Main tab → sub-tab → section. DigiLog formulas only (no Power BI / Excel).
 *
 * Usage (from DigiLog/backend):
 *   node scripts/generate-milling-dashboard-formulas-excel.js
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const OUT = process.argv.includes('--out')
  ? path.resolve(process.argv[process.argv.indexOf('--out') + 1])
  : path.resolve(__dirname, '../../docs/bi/Milling-Dashboard-Formulas.xlsx');

const NAVY = '1F3864';
const TEAL = '0F7173';
const WHITE = 'FFFFFF';
const LIGHT = 'EBF5FB';

const WINDOW =
  'Rows where From ≤ date ≤ To. If a Shift is selected (not All), keep only that shift.';

const AVG =
  `AVERAGE of finite readings for that sensor in the date window. Skip blank / non-numeric. ` +
  `If Shift is selected, filter to that shift first. ` +
  `Avg = SUM(readings) / COUNT(readings).`;

const LATEST =
  'Latest finite reading in the date window, using the latest time (then date) on the row.';

const MAX = 'MAX of finite readings for that sensor in the date window.';

const PCT_KPI =
  '% change = (Current − Compare) / Compare × 100. If Compare = 0, show 0.0%. ' +
  'Label: vs {comparisonLabel} {MTD|STD|YTD|Custom}. ' +
  'Hours / Events / Max: red if % is up. MTBF: green if % is up.';

const PCT_TEMP =
  '% change = (Current Avg − Compare Avg) / Compare Avg × 100. ' +
  'If Compare Avg is 0 or missing, hide the chip. ' +
  'Chip shows ±n.n%. Bar text: vs {comparisonLabel}. ' +
  'Temps: red if hotter vs compare. Pressure: green if up.';

const COMPARE_OVERLAY =
  'Dashed line = daily AVERAGE of the compare window, aligned onto current dates ' +
  '(PP: same day-offset from window start; S1/S2/S3: same month/day in that Indian FY Apr–Mar).';

const SECTIONS = [
  'CANE',
  'CANE HANDLING EQUIPMENTS',
  'PREPERATORY DEVICES',
  'MILLS',
  '70TPH BOILER',
  '150TPH BOILER',
  'PROCESS DS',
  'PROCESS RS',
  'BOILING HOUSE',
  'REDUCED JUICE FLOW',
  'OTHERS',
];

const SENSORS5 = [
  ['BearTempDE', 'Bearing Temp (DE)'],
  ['BearTempNDE', 'Bearing Temp (NDE)'],
  ['GearTempDE', 'Gear Temp (DE)'],
  ['GearTempNDE', 'Gear Temp (NDE)'],
  ['MtrTemp', 'Motor Temp'],
];
const SENSORS3 = [
  ['GearTempDE', 'Gear Temp (DE)'],
  ['GearTempNDE', 'Gear Temp (NDE)'],
  ['MtrTemp', 'Motor Temp'],
];
const TEMP1 = [
  ['BeltConvy', 'Belt Convy'],
  ['CaneCar', 'Cane Carrier'],
  ['CardDrum1', 'Cardian Drum 1'],
  ['CardDrum2', 'Cardian Drum 2'],
  ['CaneKeig', 'Cane Kicker'],
  ['FeedDrum', 'Feeder Drum'],
];
const TEMP2_FULL = [
  ['IRC1', 'IRC 1'],
  ['IRC2', 'IRC 2'],
  ['IRC3', 'IRC 3'],
  ['IRC4', 'IRC 4'],
  ['ShredCar', 'Shred. Carrier'],
];
const TEMP2_PARTIAL = [
  ['Mill0', 'Mill 0'],
  ['Mill4', 'Mill 4'],
];
const SHRED_LHS = [
  ['shredL_BearTempDCS', 'Bearing Temp (DCS)', '°C'],
  ['shredL_BearTempSite', 'Bearing Temp (Site)', '°C'],
  ['shredL_MtrTemp', 'Motor Temp', '°C'],
  ['shredL_VibA', 'Vibrations - Accel (A)', 'g'],
  ['shredL_VibV', 'Vibrations - Vel (V)', 'mm/s'],
  ['shredL_VibH', 'Vibrations - Horiz (H)', 'mm/s'],
];
const SHRED_RHS = [
  ['shredR_BearTempDCS', 'Bearing Temp (DCS)', '°C'],
  ['shredR_BearTempSite', 'Bearing Temp (Site)', '°C'],
  ['shredR_MtrTemp', 'Motor Temp', '°C'],
  ['shredR_VibA', 'Vibrations - Accel (A)', 'g'],
  ['shredR_VibV', 'Vibrations - Vel (V)', 'mm/s'],
  ['shredR_VibH', 'Vibrations - Horiz (H)', 'mm/s'],
];
const OTG = [
  ['InpM', 'Input-M'],
  ['InpT', 'Input-T'],
  ['IntM', 'Intermediate-M'],
  ['IntT', 'Intermediate-T'],
  ['OutM', 'Output-M'],
  ['OutT', 'Output-T'],
];
const LUBE_PRESS = [
  ['LubePressure_ACC', 'ACC Pump Line', 'kg/cm²'],
  ['LubePressure_MCC', 'MCC Pump Line', 'kg/cm²'],
  ['LubePressure_M0', 'Mill 0 Supply', 'kg/cm²'],
  ['LubePressure_Shred', 'Shredder Line', 'kg/cm²'],
];
const ROLLER = [
  ['gsB', 'Gear Side (B)'],
  ['gsT', 'Gear Side (T)'],
  ['gsUF', 'Gear Side (U/F)'],
  ['psB', 'Pintal Side (B)'],
  ['psT', 'Pintal Side (T)'],
  ['psUF', 'Pintal Side (U/F)'],
];

function r(main, sub, section, metric, unit, formula, pct) {
  return { main, sub, section, metric, unit, formula, pct };
}

const ROWS = [
  r(
    'Mill Outage',
    'Dashboard',
    'All selected sections',
    'Duration (hours) per stoppage',
    'Hrs',
    'hours = (end_time − start_time) in milliseconds / 3,600,000. If either time is missing or end < start → 0.',
    'Not a % chip — used by every outage number below',
  ),
  r(
    'Mill Outage',
    'Dashboard',
    'All selected sections',
    'Total Stoppage Hours',
    'Hrs',
    'SUM(hours) of stoppages in From–To whose section is selected.',
    PCT_KPI,
  ),
  r(
    'Mill Outage',
    'Dashboard',
    'All selected sections',
    'Stoppage Events',
    'Events',
    'COUNT of stoppages in the window where hours > 0.',
    PCT_KPI,
  ),
  r(
    'Mill Outage',
    'Dashboard',
    'All selected sections',
    'Max Incident Duration',
    'Hrs',
    'MAX(hours) of stoppages in the window.',
    PCT_KPI,
  ),
  r(
    'Mill Outage',
    'Dashboard',
    'All selected sections',
    'MTBF',
    'Hrs',
    'days = calendar days from From to To (inclusive), at least 1. ' +
      'Available hours = days × 24. ' +
      'If Events > 0: MTBF = (Available hours − Total Stoppage Hours) / Events. ' +
      'If Events = 0: MTBF = Available hours. ' +
      'Compare MTBF still uses the current From–To day count (not the compare window length).',
    PCT_KPI,
  ),
  r(
    'Mill Outage',
    'Dashboard',
    'Header',
    'Operating Days',
    'count',
    'COUNT of filtered stoppage rows (not unique calendar days).',
    'No %',
  ),
  r(
    'Mill Outage',
    'Dashboard',
    'Charts',
    'Outage Duration — Daily Trend',
    'Hrs',
    'For each date: SUM(hours). ' + COMPARE_OVERLAY,
    'No % on the chart — the four KPI cards above carry %',
  ),
  r(
    'Mill Outage',
    'Dashboard',
    'Charts',
    'Total Outage (Hours) by section',
    'Hrs',
    'SUM(hours) grouped by section, sorted highest first.',
    'No % on bars',
  ),
  r(
    'Mill Outage',
    'Dashboard',
    'Tables',
    'Machinery hours',
    'Hrs',
    'SUM(hours) grouped by machinery, sorted highest first.',
    'No %',
  ),
  r(
    'Mill Outage',
    'Table',
    'Raw log',
    'Mill Stoppage Log',
    'Hrs',
    'Same filtered rows. Loss (Hrs) = Duration formula above.',
    'No % in Table view',
  ),
  ...SECTIONS.map((sec) =>
    r(
      'Mill Outage',
      'Dashboard',
      sec,
      `Hours — ${sec}`,
      'Hrs',
      `SUM(hours) WHERE section = "${sec}" AND From ≤ date ≤ To.`,
      'Feeds the four KPI cards and the section bar chart',
    ),
  ),
  r(
    'Equipment Temperature',
    'Summary - Equipment Temp',
    'Selected machine',
    'Latest',
    '°C',
    LATEST,
    'No % on Latest',
  ),
  r(
    'Equipment Temperature',
    'Summary - Equipment Temp',
    'Selected machine',
    'Avg',
    '°C',
    AVG,
    PCT_TEMP,
  ),
  r(
    'Equipment Temperature',
    'Summary - Equipment Temp',
    'Selected machine',
    'Max',
    '°C',
    MAX,
    'No % on Max',
  ),
  r(
    'Equipment Temperature',
    'Summary - Equipment Temp',
    'Selected machine',
    'Daily Temp Curve',
    '°C',
    'Plot each selected sensor vs time in the window. ' + COMPARE_OVERLAY,
    '% is on the Avg column, not on the curve',
  ),
];

for (const [, label] of TEMP1) {
  ROWS.push(
    r(
      'Equipment Temperature',
      'Equipment Temp 1',
      label,
      'Chart (5 sensors)',
      '°C',
      `${WINDOW} ${AVG} Sensors: Bearing DE/NDE, Gear DE/NDE, Motor. ${COMPARE_OVERLAY}`,
      'No per-line % chip',
    ),
  );
}
for (const [, label] of TEMP2_FULL) {
  ROWS.push(
    r(
      'Equipment Temperature',
      'Equipment Temp 2',
      label,
      'Chart (5 sensors)',
      '°C',
      `${WINDOW} ${AVG} Sensors: Bearing DE/NDE, Gear DE/NDE, Motor. ${COMPARE_OVERLAY}`,
      'No per-line % chip',
    ),
  );
}
for (const [, label] of TEMP2_PARTIAL) {
  ROWS.push(
    r(
      'Equipment Temperature',
      'Equipment Temp 2',
      label,
      'Chart (gear + motor only)',
      '°C',
      `${WINDOW} ${AVG} Sensors: Gear DE, Gear NDE, Motor. Bearing lines are not plotted for Mill 0 / Mill 4. ${COMPARE_OVERLAY}`,
      'No per-line % chip',
    ),
  );
}

for (const [, label, unit] of SHRED_LHS) {
  ROWS.push(
    r(
      'Shredder and OTG Temp',
      'Shredder Temp',
      'Shredder LHS',
      label,
      unit,
      AVG,
      PCT_TEMP,
    ),
  );
}
for (const [, label, unit] of SHRED_RHS) {
  ROWS.push(
    r(
      'Shredder and OTG Temp',
      'Shredder Temp',
      'Shredder RHS',
      label,
      unit,
      AVG,
      PCT_TEMP,
    ),
  );
}

ROWS.push(
  r(
    'Shredder and OTG Temp',
    'Shredder Temp',
    'Charts',
    'Shredder Temp — Daily Trend',
    '°C',
    'Line per selected temp sensor. ' + COMPARE_OVERLAY,
    '% is on the LHS/RHS cards',
  ),
  r(
    'Shredder and OTG Temp',
    'Shredder Temp',
    'Charts',
    'Shredder Vibrations — Daily Trend',
    'g / mm/s',
    'Line per selected vibration sensor. ' + COMPARE_OVERLAY,
    '% is on the LHS/RHS cards',
  ),
);

for (let n = 1; n <= 4; n++) {
  ROWS.push(
    r(
      'Shredder and OTG Temp',
      'OTG Bearing Temp',
      `Mill ${n}`,
      'Chart (6 sensors)',
      '°C',
      `${WINDOW} ${AVG} Sensors: Input-M, Input-T, Intermediate-M, Intermediate-T, Output-M, Output-T. ${COMPARE_OVERLAY}`,
      'No per-line % chip',
    ),
  );
}

for (const [, label, unit] of LUBE_PRESS) {
  ROWS.push(
    r(
      'Lube & Roller Temp',
      'Summary - Lube Press & Roller Temp',
      'Lube Pump Pressure',
      label,
      unit,
      AVG,
      PCT_TEMP.replace('Temps: red if hotter vs compare. Pressure: green if up.', 'Pressure: not inverse (green if up).'),
    ),
  );
}

for (let mill = 0; mill <= 4; mill++) {
  for (const [, label] of ROLLER) {
    ROWS.push(
      r(
        'Lube & Roller Temp',
        'Summary - Lube Press & Roller Temp',
        `Mill ${mill}`,
        label,
        '°C',
        AVG,
        PCT_TEMP,
      ),
    );
  }
}

ROWS.push(
  r(
    'Lube & Roller Temp',
    'Summary - Lube Press & Roller Temp',
    'Selected unit',
    'Daily Trend Curves',
    '°C or kg/cm²',
    'Lines for the selected unit’s sensors. ' + COMPARE_OVERLAY,
    '% is on the left-hand averages',
  ),
  r(
    'Lube & Roller Temp',
    'Lube Pump & Roller Temp Grid',
    'Lube Pump Pressure',
    'Lube Pump Pressure (Kg/Sq.cm)',
    'kg/cm²',
    `${AVG} Columns: ACC, MCC, Mill 0 Supply, Shredder Line. ${COMPARE_OVERLAY}`,
    'No % on this grid chart',
  ),
);

for (let mill = 0; mill <= 4; mill++) {
  ROWS.push(
    r(
      'Lube & Roller Temp',
      'Lube Pump & Roller Temp Grid',
      `Mill ${mill}`,
      `Mill ${mill} (Degree Celsius)`,
      '°C',
      `${AVG} Six roller temps (gs B/T/U/F, ps B/T/U/F). ${COMPARE_OVERLAY}`,
      'No % on this grid chart',
    ),
  );
}

const PCT_ROWS = [
  [
    'Shared',
    'Compare label',
    'PP + MTD',
    '(Current − Compare) / Compare × 100',
    'vs Prev. Month (d MMM - d MMM) MTD',
  ],
  [
    'Shared',
    'Compare label',
    'PP + STD',
    '(Current − Compare) / Compare × 100',
    'vs Prev. Season (d MMM - d MMM) STD',
  ],
  [
    'Shared',
    'Compare label',
    'PP + YTD',
    '(Current − Compare) / Compare × 100',
    'vs Prev. Year (d MMM - d MMM) YTD',
  ],
  [
    'Shared',
    'Compare label',
    'PP + Custom',
    '(Current − Compare) / Compare × 100',
    'vs Prev. Period (d MMM - d MMM) Custom',
  ],
  [
    'Shared',
    'Compare label',
    'S1',
    '(Current − Compare) / Compare × 100',
    'vs 2024-2025 (d MMM - d MMM) {MTD|STD|YTD|Custom}   (year labels follow calendar year of today)',
  ],
  [
    'Shared',
    'Compare label',
    'S2',
    '(Current − Compare) / Compare × 100',
    'vs 2023-2024 (d MMM - d MMM) {preset}',
  ],
  [
    'Shared',
    'Compare label',
    'S3 (if enabled)',
    '(Current − Compare) / Compare × 100',
    'vs 2022-2023 (d MMM - d MMM) {preset}',
  ],
  [
    'Mill Outage',
    'Total Stoppage Hours',
    'KPI chip',
    'If Compare Hours = 0 → show 0.0%. Else (Current − Compare) / Compare × 100',
    'vs {comparisonLabel} {preset}   ·  red if hours went up',
  ],
  [
    'Mill Outage',
    'Stoppage Events',
    'KPI chip',
    'If Compare Events = 0 → 0.0%. Else (Current − Compare) / Compare × 100',
    'vs {comparisonLabel} {preset}   ·  red if events went up',
  ],
  [
    'Mill Outage',
    'Max Incident Duration',
    'KPI chip',
    'If Compare Max = 0 → 0.0%. Else (Current − Compare) / Compare × 100',
    'vs {comparisonLabel} {preset}   ·  red if max duration went up',
  ],
  [
    'Mill Outage',
    'MTBF',
    'KPI chip',
    'If Compare MTBF = 0 → 0.0%. Else (Current − Compare) / Compare × 100',
    'vs {comparisonLabel} {preset}   ·  green if MTBF went up',
  ],
  [
    'Equipment Temperature',
    'Summary Avg (each equipment)',
    'Chip under Avg',
    'If Compare Avg is 0 or missing → hide chip. Else (Current Avg − Compare Avg) / Compare Avg × 100',
    '±n.n% under Avg  +  vs {comparisonLabel}   ·  red if hotter',
  ],
  [
    'Shredder and OTG Temp',
    'Shredder LHS / RHS cards',
    'Chip under average',
    'If Compare Avg is 0 or missing → hide chip. Else (Current Avg − Compare Avg) / Compare Avg × 100',
    '±n.n% under the number  +  vs {comparisonLabel}   ·  red if hotter (°C)',
  ],
  [
    'Lube & Roller Temp',
    'Summary param list',
    'Chip under average',
    'If Compare Avg is 0 or missing → hide chip. Else (Current Avg − Compare Avg) / Compare Avg × 100',
    '±n.n% under the number  +  vs {comparisonLabel}   ·  temps inverse; pressure not inverse',
  ],
];

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
  row.height = 28;
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
  if (stripe) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } };
  }
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLog';
  wb.created = new Date();

  const readme = wb.addWorksheet('How to read', { views: [{ state: 'frozen', ySplit: 1 }] });
  readme.columns = [
    { header: 'Topic', key: 'topic', width: 28 },
    { header: 'DigiLog rule', key: 'rule', width: 130 },
  ];
  styleHeader(readme.getRow(1), NAVY);
  [
    ['What this file is', 'Formulas actually used by Milling Division Cockpit in DigiLog. Not Power BI. Not Excel.'],
    ['Main tabs', 'Mill Outage | Equipment Temperature | Shredder and OTG Temp | Lube & Roller Temp'],
    ['Date window', 'Every number uses From–To. Anchor To = today if that day exists in data, else the latest data day.'],
    ['MTD', 'From = 1st of that month. To = anchor.'],
    ['STD', 'From = 1 Oct of the crushing season (Oct–Sep). To = anchor.'],
    ['YTD', 'From = 1 Jan of that calendar year. To = anchor.'],
    ['Custom', 'User From and To. Editing dates switches the preset to Custom.'],
    ['Compare PP', 'MTD → previous month, same days. STD/YTD → minus 1 year. Custom → equal-length window ending the day before From.'],
    ['Compare S1/S2/S3', 'Same month/day mapped into Indian FY Apr–Mar (not crushing Oct–Sep).'],
    ['Outage %', PCT_KPI],
    ['Temp / lube / shredder %', PCT_TEMP],
    ['Sheets', '1 How to read  2 Formulas  3 % Change labels  4 Date & Compare  5 Sensors'],
  ].forEach((pair, i) => {
    const row = readme.addRow({ topic: pair[0], rule: pair[1] });
    row.height = 40;
    row.eachCell((c) => styleBody(c, i % 2 === 1));
    row.getCell(1).font = { bold: true, name: 'Calibri', size: 10 };
  });

  const f = wb.addWorksheet('Formulas', { views: [{ state: 'frozen', ySplit: 1, xSplit: 4 }] });
  f.columns = [
    { header: 'Main tab', key: 'main', width: 26 },
    { header: 'Sub-tab', key: 'sub', width: 38 },
    { header: 'Section', key: 'section', width: 28 },
    { header: 'Metric', key: 'metric', width: 36 },
    { header: 'Unit', key: 'unit', width: 14 },
    { header: 'DigiLog formula', key: 'formula', width: 90 },
    { header: '% change label', key: 'pct', width: 70 },
  ];
  styleHeader(f.getRow(1));
  ROWS.forEach((row, i) => {
    const added = f.addRow(row);
    added.height = 52;
    added.eachCell((c) => styleBody(c, i % 2 === 1));
  });

  const p = wb.addWorksheet('% Change labels', { views: [{ state: 'frozen', ySplit: 1 }] });
  p.columns = [
    { header: 'Main tab', key: 'a', width: 26 },
    { header: 'Where it shows', key: 'b', width: 34 },
    { header: 'Compare mode', key: 'c', width: 22 },
    { header: 'DigiLog formula', key: 'd', width: 70 },
    { header: 'On-screen label', key: 'e', width: 70 },
  ];
  styleHeader(p.getRow(1));
  PCT_ROWS.forEach((vals, i) => {
    const added = p.addRow({ a: vals[0], b: vals[1], c: vals[2], d: vals[3], e: vals[4] });
    added.height = 38;
    added.eachCell((c) => styleBody(c, i % 2 === 1));
  });

  const fil = wb.addWorksheet('Date & Compare', { views: [{ state: 'frozen', ySplit: 1 }] });
  fil.columns = [
    { header: 'Control', key: 'ctrl', width: 28 },
    { header: 'From', key: 'from', width: 48 },
    { header: 'To', key: 'to', width: 36 },
    { header: 'Compare window', key: 'prev', width: 52 },
    { header: 'Applies to', key: 'applies', width: 32 },
  ];
  styleHeader(fil.getRow(1));
  [
    ['MTD', '1st of the month of To', 'Today if in data, else latest data day', 'Same days of previous month (Prev. Month)', 'All main tabs'],
    ['STD', '1 Oct of crushing season (if Jan–Sep, last year’s Oct)', 'Same To', 'From/To minus 1 year (Prev. Season)', 'All main tabs'],
    ['YTD', '1 Jan of To’s calendar year', 'Same To', 'From/To minus 1 year (Prev. Year)', 'All main tabs'],
    ['Custom', 'User From', 'User To', 'Equal-length window ending the day before From (Prev. Period)', 'All main tabs'],
    ['Compare S1 / S2 / S3', 'Same month/day in that Indian FY (Apr–Mar)', 'Clamped to Apr 1 – Mar 31 of that FY', 'This range is the compare window', 'Dashboard view'],
    ['Section filter', '—', '—', 'Same sections applied to compare rows', 'Mill Outage only'],
    ['Shift filter', '—', '—', 'Same shift applied to compare series', 'Equipment / Shredder-OTG / Lube'],
  ].forEach((row, i) => {
    const added = fil.addRow({ ctrl: row[0], from: row[1], to: row[2], prev: row[3], applies: row[4] });
    added.height = 36;
    added.eachCell((c) => styleBody(c, i % 2 === 1));
    added.getCell(1).font = { bold: true, name: 'Calibri', size: 10 };
  });

  const sen = wb.addWorksheet('Sensors', { views: [{ state: 'frozen', ySplit: 1 }] });
  sen.columns = [
    { header: 'Main tab', key: 'main', width: 26 },
    { header: 'Section / machine', key: 'sec', width: 24 },
    { header: 'Sensor', key: 'name', width: 28 },
    { header: 'Column', key: 'col', width: 28 },
    { header: 'Unit', key: 'unit', width: 12 },
    { header: 'DigiLog formula', key: 'formula', width: 70 },
  ];
  styleHeader(sen.getRow(1));
  const sensors = [];
  for (const [key, label] of [...TEMP1, ...TEMP2_FULL]) {
    for (const [suffix, sensor] of SENSORS5) {
      sensors.push(['Equipment Temperature', label, sensor, `${key}_${suffix}`, '°C']);
    }
  }
  for (const [key, label] of TEMP2_PARTIAL) {
    for (const [suffix, sensor] of SENSORS3) {
      sensors.push(['Equipment Temperature', label, sensor, `${key}_${suffix}`, '°C']);
    }
  }
  for (const [col, label, unit] of [...SHRED_LHS, ...SHRED_RHS]) {
    sensors.push(['Shredder Temp', col.startsWith('shredL') ? 'LHS' : 'RHS', label, col, unit]);
  }
  for (let n = 1; n <= 4; n++) {
    for (const [sfx, label] of OTG) {
      sensors.push(['OTG Bearing Temp', `Mill ${n}`, label, `M${n}_${sfx}`, '°C']);
    }
  }
  for (const [col, label, unit] of LUBE_PRESS) {
    sensors.push(['Lube & Roller Temp', 'Lube Pump Pressure', label, col, unit]);
  }
  for (let mill = 0; mill <= 4; mill++) {
    for (const [sfx, label] of ROLLER) {
      sensors.push(['Lube & Roller Temp', `Mill ${mill}`, label, `M${mill}_${sfx}`, '°C']);
    }
  }
  sensors.forEach((s, i) => {
    const added = sen.addRow({
      main: s[0],
      sec: s[1],
      name: s[2],
      col: s[3],
      unit: s[4],
      formula: AVG,
    });
    added.height = 36;
    added.eachCell((c) => styleBody(c, i % 2 === 1));
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log('Wrote', OUT);
  console.log(`Formulas rows: ${ROWS.length}  % labels: ${PCT_ROWS.length}  Sensors: ${sensors.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
