const fs = require('fs');
const path = require('path');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const DATA_INGESTION_DIR = path.join(UPLOADS_ROOT, 'data-ingestion');

fs.mkdirSync(DATA_INGESTION_DIR, { recursive: true });

const ALLOWED_EXT = new Set(['.csv', '.xlsx', '.xls']);

function slugify(input, maxLen = 40) {
  const s = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
  return s || 'file';
}

function safeBasename(filename) {
  const base = path.basename(String(filename || 'upload'));
  return base.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 120) || 'upload';
}

function extensionFromName(name) {
  const ext = path.extname(name).toLowerCase();
  return ALLOWED_EXT.has(ext) ? ext : null;
}

function isAllowedUpload(file) {
  const ext = extensionFromName(file.originalname || '');
  if (!ext) return false;
  const mime = (file.mimetype || '').toLowerCase();
  if (
    mime === 'text/csv'
    || mime === 'application/vnd.ms-excel'
    || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || mime === 'application/csv'
    || mime === 'text/plain'
    || mime === 'application/octet-stream'
    || mime === ''
  ) {
    return true;
  }
  return ALLOWED_EXT.has(ext);
}

function buildStoredFilename(userId, category, originalFilename) {
  const now = new Date();
  const ts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const safeOrig = safeBasename(originalFilename);
  const ext = extensionFromName(safeOrig) || '.dat';
  const baseName = safeOrig.replace(/\.[^.]+$/, '');
  return `${ts}_${userId}_${slugify(category, 30)}_${slugify(baseName, 50)}${ext}`;
}

function absolutePathForStored(storedFilename) {
  const rel = path.join('data-ingestion', storedFilename);
  const abs = path.join(UPLOADS_ROOT, rel);
  if (!abs.startsWith(DATA_INGESTION_DIR)) {
    throw new Error('Invalid stored path.');
  }
  return abs;
}

function unlinkStoredFile(storedFilename) {
  try {
    const abs = absolutePathForStored(storedFilename);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {
    /* ignore missing file */
  }
}

module.exports = {
  UPLOADS_ROOT,
  DATA_INGESTION_DIR,
  ALLOWED_EXT,
  slugify,
  safeBasename,
  extensionFromName,
  isAllowedUpload,
  buildStoredFilename,
  absolutePathForStored,
  unlinkStoredFile,
};
