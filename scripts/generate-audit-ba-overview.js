const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  Header,
  Footer,
  PageNumber,
} = require('docx');
const fs = require('fs');
const path = require('path');

const BLUE = '1A5276';
const HEADER_BG = '2C3E50';
const HEADER_TEXT = 'FFFFFF';
const ALT_ROW = 'F8F9FA';
const BORDER_COLOR = 'BDC3C7';

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
};

function headerCell(text, widthPct) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: HEADER_TEXT, size: 18, font: 'Calibri' })],
        spacing: { before: 30, after: 30 },
      }),
    ],
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: HEADER_BG },
    borders: thinBorder,
  });
}

function bodyCell(text, widthPct, opts = {}) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || '', bold: !!opts.bold, size: 18, font: 'Calibri' })],
        spacing: { before: 25, after: 25 },
      }),
    ],
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: opts.shaded ? { type: ShadingType.SOLID, color: ALT_ROW } : undefined,
    borders: thinBorder,
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 220, after: 80 },
  });
}

function para(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, font: 'Calibri' })],
    spacing: { before: 40, after: 40 },
  });
}

function bullet(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 20, font: 'Calibri' })],
    bullet: { level: 0 },
    spacing: { before: 20, after: 20 },
  });
}

function bulletBold(label, desc) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, size: 20, font: 'Calibri', bold: true }),
      new TextRun({ text: desc, size: 20, font: 'Calibri' }),
    ],
    bullet: { level: 0 },
    spacing: { before: 20, after: 20 },
  });
}

async function main() {
  const today = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const doc = new Document({
    creator: 'DigiLog',
    title: 'DigiLog Audit & Activity Tracking — Business Overview',
    description: 'Non-technical overview of DigiLog audit and activity tracking for business stakeholders',
    styles: {
      default: {
        document: { run: { size: 20, font: 'Calibri' } },
      },
      heading1: {
        run: { size: 26, bold: true, color: BLUE, font: 'Calibri' },
        paragraph: { spacing: { before: 220, after: 80 } },
      },
      heading2: {
        run: { size: 22, bold: true, color: BLUE, font: 'Calibri' },
        paragraph: { spacing: { before: 160, after: 60 } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'DigiLog — Audit & Activity Tracking (Business Overview)',
                    size: 16,
                    color: '808080',
                    font: 'Calibri',
                    italics: true,
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Internal use  ·  Page ', size: 16, color: '808080', font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '808080', font: 'Calibri' }),
                  new TextRun({ text: ' of ', size: 16, color: '808080', font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '808080', font: 'Calibri' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'DigiLog Audit & Activity Tracking', size: 36, bold: true, color: BLUE, font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Business Overview for Management', size: 24, color: '5D6D7E', font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Date: ${today}`, size: 18, color: '808080', font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),

          heading('1. Purpose'),
          para('DigiLog will keep a clear business record of who did what, where, and for how long. This supports accountability, operations review, and understanding of how teams use Forms Hub, BI Control Tower, and Equipment History — without requiring technical knowledge to read the reports.'),

          heading('2. Three Parts of the Solution'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('Part', 18),
                  headerCell('Business Question It Answers', 42),
                  headerCell('Business Value', 40),
                ],
                tableHeader: true,
              }),
              new TableRow({
                children: [
                  bodyCell('1. Change Log', 18, { bold: true }),
                  bodyCell('Who changed plant / form / admin data? What was created, updated, or deleted?', 42),
                  bodyCell('Accountability and dispute resolution when data looks wrong.', 40),
                ],
              }),
              new TableRow({
                children: [
                  bodyCell('2. Activity Log', 18, { bold: true, shaded: true }),
                  bodyCell('Who opened which section, card, form, or dashboard? How long did they stay?', 42, { shaded: true }),
                  bodyCell('Usage insight, training focus, and feature adoption.', 40, { shaded: true }),
                ],
              }),
              new TableRow({
                children: [
                  bodyCell('3. Session Log', 18, { bold: true }),
                  bodyCell('When did someone log in / out? How long were they in the system? Who is online now?', 42),
                  bodyCell('Engagement visibility and attendance-style system usage.', 40),
                ],
              }),
            ],
          }),

          heading('3. Change Log — What Managers Will See'),
          para('This part records data-changing actions only (Create / Update / Delete). Examples:'),
          bullet('Added category “160 tph” under Power Plant'),
          bullet('Updated specifications for “equipment 1” under Instrument discipline'),
          bullet('Submitted form “Equipment Temperature”'),
          bullet('Created employee “John Doe”'),
          para('Each entry shows: time, person (name / email / role), action type, plain-English description, location in the app, and success or failure. Details of submitted fields can be expanded when needed.'),

          heading('4. Activity & Session Tracking'),
          bulletBold('Activity examples', 'Opened Forms Hub → Mill Logbook → Equipment Temperature; opened BI Control Tower → Milling Division Cockpit; spent 12 minutes on Cane Performance Dashboard.'),
          bulletBold('Session examples', 'Logged in 09:00, logged out 11:30 (2.5 hours); average session length by department; list of currently online users.'),
          para('Together, these answer questions like: which forms are used most, which dashboards are ignored, and how long people actually work in DigiLog.'),

          heading('5. Easy Filters (No Technical Knowledge Needed)'),
          para('Filters follow the same path users take in the app:'),
          bullet('Step 1 — Section: Forms Hub / BI Control Tower / Power Plant / Sugar House / Admin / Data Upload'),
          bullet('Step 2 — Card: e.g. Mill Logbook, Lab Logbook, Milling Division Cockpit'),
          bullet('Step 3 — Form or Dashboard: e.g. Equipment Temperature, Brix Sampling Analytics'),
          para('For equipment hubs, the same idea applies: Section → Category / Section → Equipment. Users can also filter by person, date range, action type, and success / failure.'),

          heading('6. What We Deliberately Do Not Log'),
          para('To keep reports useful and readable, we avoid noise such as system health checks and internal background syncs that are not real user edits. The focus stays on meaningful business activity.'),

          heading('7. Business Outcomes'),
          bulletBold('Accountability', 'Clear ownership of data changes'),
          bulletBold('Transparency', 'Managers can review activity without technical knowledge'),
          bulletBold('Usage insight', 'Which forms and dashboards matter most'),
          bulletBold('Support & training', 'Find underused or confusing areas'),
          bulletBold('Governance', 'Stronger audit trail for plant operations'),

          heading('8. Current Status'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('Capability', 55),
                  headerCell('Status', 45),
                ],
                tableHeader: true,
              }),
              new TableRow({
                children: [
                  bodyCell('Change Log (Create / Update / Delete)', 55, { bold: true }),
                  bodyCell('Live', 45),
                ],
              }),
              new TableRow({
                children: [
                  bodyCell('Activity Log (pages, forms, dashboards, time spent)', 55, { bold: true, shaded: true }),
                  bodyCell('Live', 45, { shaded: true }),
                ],
              }),
              new TableRow({
                children: [
                  bodyCell('Session Log (login duration / online status)', 55, { bold: true }),
                  bodyCell('Live', 45),
                ],
              }),
              new TableRow({
                children: [
                  bodyCell('Cascading filters (Section → Card → Form)', 55, { bold: true, shaded: true }),
                  bodyCell('Live', 45, { shaded: true }),
                ],
              }),
            ],
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: 'In short: DigiLog will show not only what data changed, but also how people use the system — in business language, with simple filters, for management review.',
                size: 20,
                font: 'Calibri',
                italics: true,
              }),
            ],
            spacing: { before: 160, after: 40 },
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.resolve(__dirname, '..', 'Admin_Audit_Log_Business_Overview.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`Document generated: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
