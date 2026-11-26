/**
 * One-sheet tracker for the dashboard change list.
 *
 * Usage (from DigiLog/backend):
 *   node scripts/generate-dashboard-change-tracker.js
 */
const path = require('path');
const ExcelJS = require('exceljs');

const OUT = process.argv.includes('--out')
  ? path.resolve(process.argv[process.argv.indexOf('--out') + 1])
  : path.resolve(__dirname, '../../docs/bi/Dashboard-Change-Status.xlsx');

const STATUSES = ['Pending', 'In Progress', 'Done', 'Need to discuss', 'Blocked'];

const HEADERS = [
  'No.',
  'Item',
  'Dashboard',
  'Tab',
  'Change',
  'What to change',
  'How it works today',
  'Raised by',
  'Status',
  'Owner',
  'Remarks',
];

const ROWS = [
  [
    'A1',
    'All dashboards',
    'Filter bar',
    'Crop day / date toggle',
    'Add a toggle between Crop Day-Based Filter and Date-Based Filter on every dashboard. Build it first on the four dashboards in A2 to A5.',
    'Each dashboard filters by a From and To date.',
    'Change list',
    '',
  ],
  [
    'A2',
    'Cane Operations',
    'All tabs',
    'Add the filter toggle',
    'Put the Crop Day-Based / Date-Based toggle on the Cane Operations filter bar.',
    'From and To date boxes on the filter bar.',
    'Change list',
    '',
  ],
  [
    'A3',
    'Cane Quality',
    'Field and Yard',
    'Add the filter toggle',
    'Put the same toggle on Field sampling and Yard sampling.',
    'Each tab has its own From and To sampling dates.',
    'Change list',
    '',
  ],
  [
    'A4',
    'Centre Maturity',
    'Centre Maturity',
    'Add the filter toggle',
    'Put the same toggle on Centre Maturity.',
    'The page filters centre indent and purchase by date.',
    'Change list',
    '',
  ],
  [
    'A5',
    'Milling Operations',
    'Mill cockpit',
    'Add the filter toggle',
    'Put the same toggle on Milling Operations.',
    'From and To dates, plus WTD / MTD / STD.',
    'Change list',
    '',
  ],
  [
    'A6',
    'Cane Operations, Cane Quality, Centre Maturity, Milling Operations',
    'Filter bar',
    'Crop day range',
    'When Crop Day-Based Filter is selected, replace the date range with a crop day range, for example day 1 to day 8.',
    'The filter is a calendar date range.',
    'Change list',
    '',
  ],
  [
    'A7',
    'Cane Operations, Cane Quality, Centre Maturity, Milling Operations',
    'Filter bar',
    'Crop days from the DMR sheet',
    'Number the crop days from the DMR daily sheet. Day 1 is the first DMR date of the season. A range of 1 to 8 means those eight crushing days.',
    'Crop day is not a filter. Management Overview already counts days from the DMR daily sheet.',
    'Change list',
    '',
  ],
  [
    'A8',
    'Cane Operations, Cane Quality, Centre Maturity, Milling Operations',
    'Filter bar',
    'Date-based filter stays on the Purchase sheet',
    'When Date-Based Filter is selected, keep filtering by the purchase dates used today.',
    'Cane Operations uses Weighment Date (Purchy) for centre rows and m_date for gate rows.',
    'Change list',
    '',
  ],
  [
    'B1',
    'Cane Operations',
    'Procurement Summary',
    'Sort tables by mode',
    'Sort every table on the Cut to Crush view by mode: 18 QCART, 36 QTROLLY, 45 QTROLLY, 63 QTROLLY, 99 QTROLLY, 99 QTRUCK. Keep the Total row last. Tables: Gate Vehicles, Center Vehicles, Center Holding, Yard, Mill Premise.',
    'Rows follow the order returned by the query.',
    'Change list',
    '',
  ],
  [
    'B2',
    'Cane Operations',
    'Procurement Summary',
    'Remove the bottom-left table',
    'Remove the bottom-left table on the Cut to Crush view. That table is Center Holding (Mode, Holding Time).',
    'The table sits at the lower left, beside the Truck Holding card.',
    'Change list',
    'Confirm this is the Center Holding table, not the Center Vehicles table above it.',
  ],
  [
    'B3',
    'Cane Operations',
    'Procurement Summary',
    'Move the Truck Holding Time card',
    'Move the Truck Holding Time KPI so it sits between the Centers image and the table.',
    'The card is at the bottom of the scene, to the right of the Center Holding table and below the Centers image.',
    'Change list',
    '',
  ],
  [
    'C1',
    'Distillery Operations',
    'Top KPI cards',
    'Remove decimals',
    'Show the top KPI cards as whole numbers. Drop the decimal places.',
    'The top cards show two decimal places (ethanol, syrup molasses, fermentation efficiency, distillation efficiency).',
    'Change list',
    '',
  ],
  [
    'D1',
    'Centre Maturity',
    'Purchase and indent',
    'Match the Management dashboard',
    'Use the purchase date for purchase quantity and indent quantity so the numbers match the Management dashboard.',
    'Centre Maturity reads centre indent and centre purchase. The date used for those totals does not match Management.',
    'Kashif Malik',
    '',
  ],
  [
    'D2',
    'Cane Quality',
    'Brix Sampling',
    'Open on the current season',
    'On first load, show the current season only.',
    'The first load shows data for all seasons.',
    'Kashif Malik',
    '',
  ],
  [
    'D3',
    'Cane Quality',
    'Yard Sampling',
    'Charts visible without zooming out',
    'Make the Yard Sampling charts fit the screen. The user should not have to zoom out to see them.',
    'The charts are cut off until the browser zoom is reduced.',
    'Kashif Malik',
    '',
  ],
];

const STATUS_FILL = {
  Pending: 'DBEAFE',
  'In Progress': 'FDE68A',
  Done: 'C6EFCE',
  'Need to discuss': 'FED7AA',
  Blocked: 'FECACA',
};

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLog';
  wb.created = new Date();
  const ws = wb.addWorksheet('Change status', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
  });
  ws.pageSetup.orientation = 'landscape';
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;
  ws.pageSetup.fitToHeight = 0;
  ws.pageSetup.paperSize = 9;

  const cols = HEADERS.length;
  ws.mergeCells(1, 1, 1, cols);
  const title = ws.getCell(1, 1);
  title.value = 'Dashboard change status';
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F3864' } };
  title.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, cols);
  const note = ws.getCell(2, 1);
  note.value = 'One row per change. Status starts as Pending. Set it from the dropdown: Pending, In Progress, Done, Need to discuss, Blocked. A covers the crop-day and date filters. B is the Cane Operations Procurement tab. C is Distillery. D is from Kashif Malik.';
  note.font = { italic: true, size: 10, color: { argb: '334155' } };
  note.alignment = { wrapText: true, vertical: 'middle' };
  ws.getRow(2).height = 32;

  ws.mergeCells(3, 1, 3, cols);
  const legend = ws.getCell(3, 1);
  legend.value = 'Pending = not started    In Progress = being built    Done = on the dashboard    Need to discuss = the request needs a decision    Blocked = waiting on data or another change';
  legend.font = { size: 9, color: { argb: '475569' } };
  legend.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(3).height = 18;

  const header = ws.getRow(4);
  HEADERS.forEach((h, i) => {
    const c = header.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, size: 10, color: { argb: 'FFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F7173' } };
    c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
  });
  header.height = 22;

  const statusCol = HEADERS.indexOf('Status') + 1;
  ROWS.forEach((row, i) => {
    const r = ws.getRow(5 + i);
    const values = [
      i + 1,
      row[0],
      row[1],
      row[2],
      row[3],
      row[4],
      row[5],
      row[6],
      'Pending',
      '',
      row[7],
    ];
    values.forEach((v, col) => {
      const c = r.getCell(col + 1);
      c.value = v;
      c.font = { size: 10 };
      c.alignment = { wrapText: true, vertical: 'top' };
      if (col + 1 === statusCol) {
        c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' };
        c.font = { size: 10, bold: true };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL.Pending } };
        c.dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`"${STATUSES.join(',')}"`],
          showErrorMessage: true,
          errorTitle: 'Status',
          error: 'Choose Pending, In Progress, Done, Need to discuss, or Blocked.',
        };
      } else if (i % 2 === 1) {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
    });
    r.height = 48;
  });

  const first = 5;
  const last = 4 + ROWS.length;
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: last, column: cols } };

  Object.entries(STATUS_FILL).forEach(([label, argb]) => {
    ws.addConditionalFormatting({
      ref: `${ws.getColumn(statusCol).letter}${first}:${ws.getColumn(statusCol).letter}${last}`,
      rules: [
        {
          type: 'containsText',
          operator: 'containsText',
          text: label,
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: `FF${argb}` } },
            font: { bold: true },
          },
        },
      ],
    });
  });

  const widths = [6, 10, 42, 22, 28, 62, 48, 16, 18, 16, 42];
  widths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });

  await wb.xlsx.writeFile(OUT);
  console.log('Wrote', OUT, 'rows', ROWS.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
