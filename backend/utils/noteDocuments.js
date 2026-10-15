const fs = require('fs');
const path = require('path');

const { UPLOADS_ROOT } = require('./avatarFile');

const NOTE_DOCUMENTS_ROOT = path.join(UPLOADS_ROOT, 'note-documents');
const MAX_NOTE_DOCUMENTS = 3;
const MAX_NOTE_DOCUMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const MIME_TO_EXT = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
};

function noteDocumentDir(noteId) {
  return path.join(NOTE_DOCUMENTS_ROOT, String(noteId));
}

function noteDocumentStorageKey(noteId, filename) {
  return `note-documents/${noteId}/${path.basename(String(filename || ''))}`;
}

function resolveNoteDocumentAbsPath(stored) {
  if (!stored || typeof stored !== 'string') return null;
  let rel = stored.replace(/\\/g, '/');
  if (rel.startsWith('/uploads/')) rel = rel.slice('/uploads/'.length);
  if (rel.startsWith('uploads/')) rel = rel.slice('uploads/'.length);
  if (!rel.startsWith('note-documents/')) return null;
  const abs = path.normalize(path.join(UPLOADS_ROOT, rel));
  const root = path.normalize(NOTE_DOCUMENTS_ROOT + path.sep);
  if (!abs.startsWith(root)) return null;
  return abs;
}

function unlinkStoredNoteDocument(stored) {
  const abs = resolveNoteDocumentAbsPath(stored);
  if (!abs) return;
  fs.unlink(abs, () => {});
}

function extensionForUpload(mimeType, originalName) {
  const fromMime = MIME_TO_EXT[String(mimeType || '').trim()];
  if (fromMime) return fromMime;
  const ext = path.extname(String(originalName || '')).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : '';
}

function isAllowedNoteDocument(mimeType, originalName) {
  const ext = path.extname(String(originalName || '')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_MIME_TYPES.has(String(mimeType || '').trim())) {
    return false;
  }
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) return false;
  return true;
}

function normalizeNoteDocument(raw, noteId) {
  if (!raw || typeof raw !== 'object') return null;
  const storageKey = String(raw.storageKey || '').trim().replace(/\\/g, '/');
  const displayName = String(raw.displayName || raw.originalName || '').trim();
  if (!storageKey || !displayName) return null;
  const prefix = `note-documents/${noteId}/`;
  if (!storageKey.startsWith(prefix)) return null;
  const fileName = path.basename(storageKey);
  if (!fileName || fileName !== storageKey.slice(prefix.length)) return null;
  return {
    storageKey,
    displayName: displayName.slice(0, 200),
    originalName: String(raw.originalName || displayName).trim().slice(0, 200),
    mimeType: String(raw.mimeType || 'application/octet-stream').trim().slice(0, 120),
    size: Math.max(0, Number(raw.size) || 0),
  };
}

function parseNoteDocuments(value, noteId) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => normalizeNoteDocument(item, noteId))
      .filter(Boolean)
      .slice(0, MAX_NOTE_DOCUMENTS);
  } catch {
    return [];
  }
}

module.exports = {
  NOTE_DOCUMENTS_ROOT,
  MAX_NOTE_DOCUMENTS,
  MAX_NOTE_DOCUMENT_BYTES,
  noteDocumentDir,
  noteDocumentStorageKey,
  resolveNoteDocumentAbsPath,
  unlinkStoredNoteDocument,
  extensionForUpload,
  isAllowedNoteDocument,
  normalizeNoteDocument,
  parseNoteDocuments,
};
