const ExcelJS = require('exceljs');

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const EXPORT_ROW_CAP = 20000;

function parseAuditUtc(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const s = String(value).trim();
  const mysqlUtc = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(s);
  if (mysqlUtc) return new Date(`${mysqlUtc[1]}T${mysqlUtc[2]}${mysqlUtc[3] || ''}Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatIstDateTime(value) {
  const d = parseAuditUtc(value);
  if (!d) return value ? String(value) : '';
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function istYmd(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function formatDurationMinutes(minutes) {
  if (minutes == null || minutes === '') return '';
  const m = Number(minutes);
  if (!Number.isFinite(m)) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function formatDwellSeconds(seconds) {
  if (seconds == null || seconds === '') return '';
  const s = Number(seconds);
  if (!Number.isFinite(s)) return '';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

async function streamXlsx(res, { filename, sheetName, columns, rows }) {
  res.setHeader('Content-Type', XLSX_MIME);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: res,
    useStyles: true,
    useSharedStrings: false,
  });
  const sheet = workbook.addWorksheet(sheetName || 'Sheet1');
  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width || 20,
  }));
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.commit();
  for (const row of rows) {
    sheet.addRow(row).commit();
  }
  await workbook.commit();
  return filename;
}

module.exports = {
  EXPORT_ROW_CAP,
  XLSX_MIME,
  formatIstDateTime,
  formatDurationMinutes,
  formatDwellSeconds,
  istYmd,
  streamXlsx,
};
