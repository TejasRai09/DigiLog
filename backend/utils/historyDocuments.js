const fs = require('fs');
const path = require('path');

const { UPLOADS_ROOT } = require('./avatarFile');

const HISTORY_DOCUMENTS_ROOT = path.join(UPLOADS_ROOT, 'history-documents');
const MAX_HISTORY_DOCUMENTS = 2;
const MAX_HISTORY_DOCUMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx']);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MIME_TO_EXT = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

/** @param {string} historyTable */
function historyDocPrefix(historyTable) {
  if (historyTable === 'shn_history') return 'shn';
  if (historyTable === 'ppn_history') return 'ppn';
  return 'history';
}

/** @param {string} historyTable @param {string|number} equipId @param {string|number} historyId @param {string} filename */
function historyDocumentStorageKey(historyTable, equipId, historyId, filename) {
  const prefix = historyDocPrefix(historyTable);
  return `history-documents/${prefix}/${equipId}/${historyId}/${path.basename(filename)}`;
}

/** @param {string|null|undefined} stored */
function resolveHistoryDocumentAbsPath(stored) {
  if (!stored || typeof stored !== 'string') return null;

  let rel = stored.replace(/\\/g, '/');
  if (rel.startsWith('/uploads/')) rel = rel.slice('/uploads/'.length);
  if (rel.startsWith('uploads/')) rel = rel.slice('uploads/'.length);
  if (!rel.startsWith('history-documents/')) return null;

  const abs = path.normalize(path.join(UPLOADS_ROOT, rel));
  const root = path.normalize(HISTORY_DOCUMENTS_ROOT + path.sep);
  if (!abs.startsWith(root)) return null;
  return abs;
}

/** @param {string|null|undefined} stored */
function unlinkStoredHistoryDocument(stored) {
  const abs = resolveHistoryDocumentAbsPath(stored);
  if (!abs) return;
  fs.unlink(abs, () => {});
}

/** @param {unknown[]} docs */
function unlinkRemovedHistoryDocuments(docs) {
  for (const doc of docs || []) {
    unlinkStoredHistoryDocument(doc?.storageKey);
  }
}

/** @param {unknown} value */
function parseHistoryDocuments(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeHistoryDocument).filter(Boolean).slice(0, MAX_HISTORY_DOCUMENTS);
  } catch {
    return [];
  }
}

/** @param {unknown} raw */
function normalizeHistoryDocument(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const storageKey = String(raw.storageKey || '').trim();
  const displayName = String(raw.displayName || raw.originalName || '').trim();
  if (!storageKey || !displayName) return null;
  if (!storageKey.startsWith('history-documents/')) return null;
  return {
    storageKey,
    displayName,
    originalName: String(raw.originalName || displayName).trim(),
    mimeType: String(raw.mimeType || 'application/octet-stream').trim(),
    size: Math.max(0, Number(raw.size) || 0),
  };
}

/** @param {unknown} bodyDocuments @param {unknown[]|null|undefined} existingDocuments */
function parseHistoryDocumentsFromBody(bodyDocuments, existingDocuments) {
  if (bodyDocuments === undefined) {
    return parseHistoryDocuments(existingDocuments);
  }
  if (bodyDocuments === null) return [];
  if (!Array.isArray(bodyDocuments)) return null;
  const docs = bodyDocuments.map(normalizeHistoryDocument).filter(Boolean);
  if (docs.length > MAX_HISTORY_DOCUMENTS) return null;
  return docs;
}

/** @param {unknown[]} docs */
function serializeHistoryDocumentsColumn(docs) {
  const list = parseHistoryDocuments(docs);
  return list.length ? JSON.stringify(list) : null;
}

/** @param {string} mimeType @param {string} originalName */
function extensionForUpload(mimeType, originalName) {
  const fromMime = MIME_TO_EXT[String(mimeType || '').trim()];
  if (fromMime) return fromMime;
  const ext = path.extname(String(originalName || '')).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : '';
}

/** @param {string} mimeType @param {string} originalName */
function isAllowedHistoryDocument(mimeType, originalName) {
  const mime = String(mimeType || '').trim();
  if (ALLOWED_MIME_TYPES.has(mime)) return true;
  const ext = path.extname(String(originalName || '')).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

/** @param {unknown[]} prevDocs @param {unknown[]} nextDocs */
function historyDocumentsRemoved(prevDocs, nextDocs) {
  const nextKeys = new Set(parseHistoryDocuments(nextDocs).map((d) => d.storageKey));
  return parseHistoryDocuments(prevDocs).filter((d) => !nextKeys.has(d.storageKey));
}

/** @param {string} historyTable @param {string|number} equipId @param {string|number} historyId */
function historyDocumentDir(historyTable, equipId, historyId) {
  const prefix = historyDocPrefix(historyTable);
  return path.join(HISTORY_DOCUMENTS_ROOT, prefix, String(equipId), String(historyId));
}

module.exports = {
  HISTORY_DOCUMENTS_ROOT,
  MAX_HISTORY_DOCUMENTS,
  MAX_HISTORY_DOCUMENT_BYTES,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  historyDocPrefix,
  historyDocumentStorageKey,
  historyDocumentDir,
  resolveHistoryDocumentAbsPath,
  unlinkStoredHistoryDocument,
  unlinkRemovedHistoryDocuments,
  parseHistoryDocuments,
  normalizeHistoryDocument,
  parseHistoryDocumentsFromBody,
  serializeHistoryDocumentsColumn,
  extensionForUpload,
  isAllowedHistoryDocument,
  historyDocumentsRemoved,
};
