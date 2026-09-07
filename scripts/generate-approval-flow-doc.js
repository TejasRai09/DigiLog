/**
 * Business guide: DigiLog Maintenance History HOD Approval (plain language).
 * Run: node scripts/generate-approval-flow-doc.js
 */
const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
} = require('docx');

const PAGE_W = 11906;
const MARGIN = 720; // 0.5"

function title(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 60 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 28,
        font: 'Calibri',
        color: '1E3A8A',
      }),
    ],
  });
}

function subtitle(text) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 160 },
    children: [
      new TextRun({
        text,
        size: 16,
        font: 'Calibri',
        color: '64748B',
        italics: true,
      }),
    ],
  });
}

function h(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 160, after: 80 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 20,
        font: 'Calibri',
        color: '1D4ED8',
      }),
    ],
  });
}

function p(text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    children: [
      new TextRun({
        text,
        size: 18,
        font: 'Calibri',
        color: '334155',
      }),
    ],
  });
}

function boldLabel(label, rest) {
  return new Paragraph({
    spacing: { before: 36, after: 36 },
    indent: { left: 180 },
    children: [
      new TextRun({
        text: `• ${label}`,
        bold: true,
        size: 17,
        font: 'Calibri',
        color: '0F172A',
      }),
      new TextRun({
        text: rest ? ` — ${rest}` : '',
        size: 17,
        font: 'Calibri',
        color: '334155',
      }),
    ],
  });
}

function numbered(n, text) {
  return new Paragraph({
    spacing: { before: 36, after: 36 },
    indent: { left: 180 },
    children: [
      new TextRun({
        text: `${n}. `,
        bold: true,
        size: 17,
        font: 'Calibri',
        color: '0F172A',
      }),
      new TextRun({
        text,
        size: 17,
        font: 'Calibri',
        color: '334155',
      }),
    ],
  });
}

async function main() {
  const outDir = path.join(__dirname, '..', 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'Maintenance_History_Approval_Business_Guide.docx');
  const legacyPath = path.join(outDir, 'Maintenance_History_Approval_Flow_User_Stories.docx');

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: 16838 },
            margin: {
              top: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
              right: MARGIN,
            },
          },
        },
        children: [
          title('DigiLog — Maintenance History Approval'),
          subtitle('Simple business guide  ·  Sugar House & Power Plant  ·  What everyone does and which buttons to use'),

          h('1. What this feature does'),
          p(
            'When this feature is turned on, an employee’s maintenance history change (add, edit, or delete) for Sugar House or Power Plant equipment is not final until the HOD reviews it. The HOD can accept the change or send it back for correction. Production House is not part of this process.',
          ),

          h('2. Who is involved'),
          boldLabel('Admin', 'Turns the feature on or off, chooses the HOD, and sets when the daily email is sent.'),
          boldLabel(
            'Employee (person who enters the record)',
            'Adds, edits, or deletes maintenance history. Fixes items the HOD sends back.',
          ),
          boldLabel(
            'HOD',
            'Reviews pending changes from a daily email and an approvals inbox. No DigiLog login is required for the email or inbox.',
          ),

          h('3. End-to-end flow'),
          numbered(
            1,
            'Admin opens DigiLog Config for Maintenance History Approval, turns Enable HOD approval ON for Sugar and/or Power, selects the HOD employee, sets the Daily digest time, and clicks Save.',
          ),
          numbered(
            2,
            'Employee saves a maintenance history entry. DigiLog shows that it was submitted for HOD approval. The change is waiting — it is not permanent yet.',
          ),
          numbered(
            3,
            'At the chosen daily time, the HOD receives one email listing all pending items (with Created at / entry date, equipment, action, and who submitted it).',
          ),
          numbered(
            4,
            'HOD clicks Open approvals inbox (no login), or Review on a single row. In the inbox they can Select all, Approve selected, or open Review for one item.',
          ),
          numbered(
            5,
            'In Review, HOD clicks Accept (change becomes permanent and the employee is notified) or Send for modification (must add a comment; employee is asked to fix it).',
          ),
          numbered(
            6,
            'If sent back, the employee sees a notification and a highlighted row, clicks View / Edit (or opens the email link), corrects the entry, and saves again. It returns to the HOD as a new pending item.',
          ),

          h('4. Admin screens and buttons'),
          boldLabel(
            'Enable HOD approval',
            'ON = changes need HOD approval. OFF = changes save immediately as final (no HOD step). Separate switch for Sugar House and Power Plant.',
          ),
          boldLabel('HOD employee', 'Dropdown to choose who receives the daily list and reviews approvals.'),
          boldLabel('Daily digest time (IST)', 'Clock time when DigiLog sends the HOD one email for that day.'),
          boldLabel('Save', 'Stores the settings above. You must choose an HOD before you can turn the feature ON and save.'),
          boldLabel(
            'Resend full digest',
            'Sends the HOD the full list of items still waiting (useful if they missed the email).',
          ),
          boldLabel(
            'Email new pending only',
            'Sends only items that were never included in an earlier email.',
          ),

          h('5. What the employee sees and uses'),
          boldLabel(
            'After save',
            'Message that the entry was submitted for HOD approval (when the feature is ON).',
          ),
          boldLabel(
            'Pending HOD approval / Needs modification labels',
            'Rows waiting for the HOD or sent back for correction are highlighted and shown near the top of the history list.',
          ),
          boldLabel(
            'Notification bell (left of Logout)',
            'Shows a count of new alerts. Opens a list under the bell. Use Mark all read to clear the count. For “needs modification”, use View / Edit to jump to that entry and open it for editing.',
          ),
          boldLabel(
            'Email / link from HOD',
            'Opens the same equipment history and focuses the entry that needs correction.',
          ),

          h('6. What the HOD sees and uses'),
          boldLabel(
            'Daily email',
            'Summary of pending work. Open approvals inbox (no login) opens the full list. Each row has Review. Columns include Equipment, Action, Created at, Submitted by, and Details.',
          ),
          boldLabel('Select all', 'Ticks or unticks every row in the inbox.'),
          boldLabel('Approve selected', 'Accepts all ticked rows in one go (only those rows — others stay pending).'),
          boldLabel(
            'Review',
            'Opens a popup with what changed (and photos/documents if any). From there: Accept or Send for modification.',
          ),
          boldLabel(
            'Accept',
            'Makes that change permanent in DigiLog. The employee gets an email and an in-app notification.',
          ),
          boldLabel(
            'Send for modification',
            'Returns the change to the employee with a required comment explaining what to fix. The employee gets an email and a notification with View / Edit.',
          ),
          boldLabel(
            'Approvals (in DigiLog menu)',
            'If the HOD is logged into DigiLog, they can also review pending items from the Approvals page — same decisions as the email inbox.',
          ),

          h('7. Accept vs send for modification (in short)'),
          p(
            'Accept means the HOD is satisfied — the maintenance history change is saved for good and the employee is informed. Send for modification means the HOD wants a correction — nothing is final until the employee updates it and the HOD accepts later.',
          ),

          new Paragraph({
            spacing: { before: 200 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: 'DigiLog  ·  For business users  ·  Maintenance History Approval',
                size: 14,
                font: 'Calibri',
                color: '94A3B8',
                italics: true,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log('Wrote', outPath);
  try {
    fs.writeFileSync(legacyPath, buffer);
    console.log('Also updated', legacyPath);
  } catch (err) {
    if (err && err.code === 'EBUSY') {
      console.warn('Could not update locked file (close it in Word to refresh):', legacyPath);
    } else {
      throw err;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
