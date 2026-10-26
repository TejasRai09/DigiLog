/**
 * Maintenance Notes HOD digest tokens + no-login inbox.
 * Combined digest (Forms + History + Notes) lives in combinedApprovalDigest.service.js.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/mysql');
const { CLIENT_ORIGIN } = require('../config/env');
const {
  parseNoteDocuments,
  resolveNoteDocumentAbsPath,
} = require('../utils/noteDocuments');
const {
  PLANTS,
  plantLabel,
  noteRef,
  parseNoteImages,
  getHodSettings,
  decideNote,
} = require('./maintenanceNotes.service');

const TOKEN_TTL_DAYS = 7;
const NOTES_INBOX_PATH = '/api/maintenance-notes-approval/inbox';

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function newTokenPair() {
  const expires = new Date();
  expires.setDate(expires.getDate() + TOKEN_TTL_DAYS);
  return {
    tokenAccept: crypto.randomBytes(32).toString('hex'),
    tokenReject: crypto.randomBytes(32).toString('hex'),
    expires,
  };
}

function parseMysqlUtcDateTime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const s = String(value).trim();
  const mysqlUtc = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(s);
  if (mysqlUtc) {
    const d = new Date(`${mysqlUtc[1]}T${mysqlUtc[2]}${mysqlUtc[3] || ''}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatEntryCreatedAt(value) {
  const d = parseMysqlUtcDateTime(value);
  if (!d) return '—';
  return `${d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })} IST`;
}

async function addColumnIfMissing(table, column, ddl) {
  const [[col]] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (!Number(col?.n)) {
    await pool.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
    console.log(`[maintenanceNotesMail] added ${table}.${column}`);
  }
}

async function addUniqueIndexIfMissing(table, indexName, column) {
  const [[idx]] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );
  if (!Number(idx?.n)) {
    await pool.execute(
      `CREATE UNIQUE INDEX \`${indexName}\` ON \`${table}\` (\`${column}\`)`,
    );
  }
}

async function ensureNotesMailSchema() {
  try {
    await addColumnIfMissing('maintenance_note', 'hod_email', '`hod_email` VARCHAR(200) NULL');
    await addColumnIfMissing('maintenance_note', 'token_accept', '`token_accept` VARCHAR(128) NULL');
    await addColumnIfMissing('maintenance_note', 'token_reject', '`token_reject` VARCHAR(128) NULL');
    await addColumnIfMissing('maintenance_note', 'token_expires_at', '`token_expires_at` DATETIME NULL');
    await addColumnIfMissing('maintenance_note', 'hod_notified_at', '`hod_notified_at` DATETIME NULL');
    await addColumnIfMissing(
      'maintenance_note',
      'notification_count',
      '`notification_count` INT NOT NULL DEFAULT 0',
    );
    await addUniqueIndexIfMissing('maintenance_note', 'uq_mn_token_accept', 'token_accept');
    await addUniqueIndexIfMissing('maintenance_note', 'uq_mn_token_reject', 'token_reject');
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') {
      console.error('[maintenanceNotesMail] schema skipped: apply mysql/migrate_maintenance_notes.sql first');
      return;
    }
    throw err;
  }

  const keys = [
    ['mn_digest_sugar_time', '22:00'],
    ['mn_digest_power_time', '22:00'],
    ['mn_digest_production_time', '22:00'],
    ['mn_digest_sugar_time_2', ''],
    ['mn_digest_power_time_2', ''],
    ['mn_digest_production_time_2', ''],
    ['combined_hod_digest_slots', '{}'],
  ];
  for (const [key, value] of keys) {
    await pool.execute(
      `INSERT INTO portal_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_key = setting_key`,
      [key, value],
    );
  }
}

async function fetchAllPendingNotes() {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM maintenance_note
       WHERE status = 'approval_pending'
       ORDER BY submitted_at ASC, id ASC`,
    );
    return rows;
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return [];
    throw err;
  }
}

async function refreshNotesDigestTokens(rows) {
  const refreshed = [];
  for (const row of rows) {
    const tokens = newTokenPair();
    await pool.execute(
      `UPDATE maintenance_note
       SET token_accept = ?, token_reject = ?, token_expires_at = ?
       WHERE id = ?`,
      [tokens.tokenAccept, tokens.tokenReject, tokens.expires, row.id],
    );
    refreshed.push({
      ...row,
      token_accept: tokens.tokenAccept,
      token_reject: tokens.tokenReject,
      token_expires_at: tokens.expires,
    });
  }
  return refreshed;
}

async function markNotesNotified(ids, hod) {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(', ');
  await pool.execute(
    `UPDATE maintenance_note
     SET hod_notified_at = NOW(),
         notification_count = IFNULL(notification_count, 0) + 1,
         hod_user_id = ?,
         hod_email = ?
     WHERE id IN (${placeholders})`,
    [hod.id, hod.email, ...ids],
  );
}

function noteTitle(row) {
  return `${noteRef(row.id)} · ${String(row.activity_description || 'Maintenance note').trim()}`;
}

function notePath(row) {
  const plant = plantLabel(row.plant);
  if (row.no_equipment) return `${plant} · No equipment`;
  return `${plant} · ${String(row.equipment_name || '—').trim()}`;
}

function buildNotesDigestEntry(row) {
  return {
    id: row.id,
    equipmentName: noteTitle(row),
    equipmentPath: notePath(row),
    actionLabel: row.activity_type || 'Completion',
    submitterName: row.submitted_by_name || row.created_by_name || 'A user',
    submitterEmail: row.created_by_email || '',
    createdAt: row.submitted_at || row.created_at || null,
    acceptToken: row.token_accept,
    rejectToken: row.token_reject,
  };
}

function noteDiff(row) {
  return [
    { label: 'Note', newValue: noteRef(row.id), oldValue: '—' },
    { label: 'Plant', newValue: plantLabel(row.plant), oldValue: '—' },
    { label: 'Equipment', newValue: row.no_equipment ? 'No equipment' : (row.equipment_name || '—'), oldValue: '—' },
    { label: 'Activity type', newValue: row.activity_type || '—', oldValue: '—' },
    { label: 'Activity', newValue: row.activity_description || '—', oldValue: '—' },
    { label: 'Details', newValue: row.activity_details || '—', oldValue: '—' },
    { label: 'Completion remarks', newValue: row.completion_remarks || '—', oldValue: '—' },
  ];
}

function noteDocumentUrl(token, fileName) {
  const publicBase = String(CLIENT_ORIGIN || '').replace(/\/+$/, '');
  return `${publicBase}${NOTES_INBOX_PATH.replace(/\/inbox$/, '/document')}?token=${encodeURIComponent(token)}&name=${encodeURIComponent(fileName)}`;
}

async function getNoteByToken(token, kind = 'any') {
  const raw = String(token || '').trim();
  if (!raw) return null;
  let sql = 'SELECT * FROM maintenance_note WHERE token_accept = ? OR token_reject = ? LIMIT 1';
  let params = [raw, raw];
  if (kind === 'accept') {
    sql = 'SELECT * FROM maintenance_note WHERE token_accept = ? LIMIT 1';
    params = [raw];
  } else if (kind === 'reject') {
    sql = 'SELECT * FROM maintenance_note WHERE token_reject = ? LIMIT 1';
    params = [raw];
  }
  const [[row]] = await pool.query(sql, params);
  return row || null;
}

function markExpiredIfNeeded(row) {
  if (!row) return row;
  if (row.status !== 'approval_pending') return row;
  if (!row.token_expires_at) return row;
  const expires = parseMysqlUtcDateTime(row.token_expires_at);
  if (expires && expires < new Date()) return { ...row, tokenExpired: true };
  return row;
}

async function loadHodActor(hodUserId) {
  const [[user]] = await pool.query(
    'SELECT id, name, email, role, department FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
    [hodUserId],
  );
  if (!user) throw httpError(400, 'Configured HOD user is inactive or missing.');
  return user;
}

async function getReviewByToken(token) {
  let row = await getNoteByToken(token, 'any');
  if (!row) throw httpError(404, 'Invalid review link.');
  row = markExpiredIfNeeded(row);
  const acceptToken = row.token_accept;
  const docs = parseNoteDocuments(row.documents, row.id).map((doc) => ({
    displayName: doc.displayName,
    mimeType: doc.mimeType,
    size: doc.size,
    url: noteDocumentUrl(acceptToken, path.basename(doc.storageKey)),
  }));
  return {
    status: row.status,
    alreadyResolved: row.status !== 'approval_pending',
    tokenExpired: Boolean(row.tokenExpired),
    request: row,
    id: row.id,
    equipmentName: noteTitle(row),
    equipmentPath: notePath(row),
    domain: row.plant,
    domainLabel: plantLabel(row.plant),
    action: 'create',
    actionLabel: row.activity_type || 'Completion',
    submitterName: row.submitted_by_name || row.created_by_name || 'A user',
    submitterEmail: row.created_by_email || '',
    createdAt: row.submitted_at || row.created_at || null,
    createdAtLabel: formatEntryCreatedAt(row.submitted_at || row.created_at),
    diff: noteDiff(row),
    photosBefore: parseNoteImages(row.images),
    photosAfter: [],
    documents: docs,
    hodComment: row.hod_remarks || '',
    acceptToken: row.token_accept,
    rejectToken: row.token_reject,
    tokenExpiresAt: row.token_expires_at || null,
    resolvedAt: row.hod_decision_at || null,
  };
}

async function getInboxByToken(token) {
  const review = await getReviewByToken(token);
  const [rows] = await pool.query(
    `SELECT * FROM maintenance_note
     WHERE plant = ? AND status = 'approval_pending'
     ORDER BY submitted_at ASC, id ASC`,
    [review.request.plant],
  );
  return {
    status: review.status,
    alreadyResolved: review.alreadyResolved && !rows.length,
    domain: review.domain,
    domainLabel: review.domainLabel,
    hodEmail: review.request.hod_email,
    entries: rows.map(buildNotesDigestEntry),
    request: review.request,
  };
}

async function approveByToken(token) {
  let row = await getNoteByToken(token, 'accept');
  if (!row) throw httpError(404, 'Invalid approval link.');
  row = markExpiredIfNeeded(row);
  if (row.tokenExpired) {
    throw httpError(
      410,
      'This approval link has expired. Use the latest digest email, or ask an admin to resend the digest (no DigiLog login required).',
    );
  }
  if (row.status !== 'approval_pending') {
    return { status: row.status, alreadyResolved: true, request: row };
  }
  const hod = await loadHodActor(row.hod_user_id);
  const updated = await decideNote(hod, row.id, { decision: 'approved', remarks: '' });
  return { status: 'completed', alreadyResolved: false, request: { ...row, ...updated } };
}

async function rejectByToken(token, comment) {
  const reason = String(comment || '').trim();
  if (reason.length < 5) {
    throw httpError(400, 'Add a reason so the team knows what to rework.');
  }
  let row = await getNoteByToken(token, 'reject');
  if (!row) throw httpError(404, 'Invalid modification link.');
  row = markExpiredIfNeeded(row);
  if (row.tokenExpired) {
    throw httpError(
      410,
      'This link has expired. Use the latest digest email, or ask an admin to resend the digest (no DigiLog login required).',
    );
  }
  if (row.status !== 'approval_pending') {
    return { status: row.status, alreadyResolved: true, request: row };
  }
  const hod = await loadHodActor(row.hod_user_id);
  const updated = await decideNote(hod, row.id, { decision: 'rejected', remarks: reason });
  return { status: 'rework_required', alreadyResolved: false, request: { ...row, ...updated } };
}

async function bulkApproveByInboxToken(seedToken, ids) {
  const inbox = await getInboxByToken(seedToken);
  const allowed = new Map((inbox.entries || []).map((entry) => [Number(entry.id), entry]));
  const requestedIds = Array.isArray(ids) && ids.length
    ? ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [...allowed.keys()];

  const results = [];
  for (const id of requestedIds) {
    const entry = allowed.get(id);
    if (!entry?.acceptToken) {
      results.push({ id, ok: false, message: 'This item is not in your pending inbox.' });
      continue;
    }
    try {
      const result = await approveByToken(entry.acceptToken);
      results.push({
        id,
        ok: true,
        status: result.status,
        alreadyResolved: Boolean(result.alreadyResolved),
        equipmentName: entry.equipmentName,
      });
    } catch (err) {
      results.push({
        id,
        ok: false,
        status: err.status || 500,
        message: err.message || 'Approval failed.',
        equipmentName: entry.equipmentName,
      });
    }
  }
  return {
    domain: inbox.domain,
    domainLabel: inbox.domainLabel,
    results,
    approved: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  };
}

async function getDocumentForReviewToken(token, fileName) {
  const row = await getNoteByToken(token, 'any');
  if (!row) throw httpError(404, 'Invalid review link.');
  const storageKey = `note-documents/${row.id}/${path.basename(String(fileName || ''))}`;
  const doc = parseNoteDocuments(row.documents, row.id).find((item) => item.storageKey === storageKey);
  const abs = doc ? resolveNoteDocumentAbsPath(doc.storageKey) : null;
  if (!doc || !abs || !fs.existsSync(abs)) throw httpError(404, 'Document not found.');
  return { abs, doc };
}

module.exports = {
  PLANTS,
  NOTES_INBOX_PATH,
  ensureNotesMailSchema,
  fetchAllPendingNotes,
  refreshNotesDigestTokens,
  markNotesNotified,
  buildNotesDigestEntry,
  getHodSettings,
  getReviewByToken,
  getInboxByToken,
  approveByToken,
  rejectByToken,
  bulkApproveByInboxToken,
  getDocumentForReviewToken,
  formatEntryCreatedAt,
};
