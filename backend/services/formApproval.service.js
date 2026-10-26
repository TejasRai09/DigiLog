const crypto = require('crypto');
const { pool } = require('../config/mysql');
const { createUserNotification } = require('./userNotification.service');
const { CLIENT_ORIGIN } = require('../config/env');
const {
  sendFormApprovalDigestEmail,
  sendFormApprovalApprovedEmail,
  sendFormApprovalModificationEmail,
  sendFormApprovalModificationReminderEmail,
} = require('./email.service');

const STATUS = {
  PENDING: 'pending',
  NEEDS_MODIFICATION: 'needs_modification',
  RESUBMITTED: 'resubmitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

const HOD_QUEUE_STATUSES = [STATUS.PENDING, STATUS.RESUBMITTED];
const HOD_APPROVALS_PATH = '/maintenance/approvals?source=forms';
const DEFAULT_DIGEST_TIME = '22:00';
const TOKEN_TTL_DAYS = 7;
const EMPLOYEE_REMINDER_TIME_IST = '09:00';
const EMPLOYEE_REMINDER_INTERVAL_DAYS = 2;

const NOTIF_TYPE_PENDING = 'form_pending_hod';
const NOTIF_TYPE_APPROVED = 'form_approved';
const NOTIF_TYPE_MODIFY = 'form_needs_modification';
const NOTIF_REF = 'form_approval';

const RETIRED_APP_NAMES = new Set([
  'Mill House Equipment History',
  'Power Plant Equipment History (old)',
]);

function isMissingTable(err) {
  return err?.code === 'ER_NO_SUCH_TABLE' || /form_approval_/i.test(String(err?.message || ''));
}

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseJson(raw, fallback) {
  if (raw == null || raw === '') return fallback;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function getIstDateParts(date = new Date()) {
  const raw = date.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(raw);
  if (!match) return { date: '', time: '' };
  return { date: match[1], time: `${match[2]}:${match[3]}` };
}

function formOpenUrl(formKey) {
  const base = String(CLIENT_ORIGIN || '').replace(/\/+$/, '');
  return `${base}/forms/${encodeURIComponent(formKey)}`;
}

/** View Data table for a queued submission (highlight + edit when sent back). */
function formRecordsUrl(request) {
  const base = String(CLIENT_ORIGIN || '').replace(/\/+$/, '');
  const formKey = encodeURIComponent(request.form_key);
  const rid = Number(request.id) || '';
  if (request.app_id) {
    return `${base}/apps/${request.app_id}?viewForm=${formKey}&approvalRequestId=${rid}`;
  }
  return `${base}/forms/${formKey}?viewData=1&approvalRequestId=${rid}`;
}

function formRecordsPath(request) {
  const formKey = encodeURIComponent(request.form_key);
  const rid = Number(request.id) || '';
  if (request.app_id) {
    return `/apps/${request.app_id}?viewForm=${formKey}&approvalRequestId=${rid}`;
  }
  return `/forms/${formKey}?viewData=1&approvalRequestId=${rid}`;
}

function rowsFromStoredPayload(stored) {
  const payload = parseJson(stored, {});
  if (payload?.batch && Array.isArray(payload.rows)) return payload.rows.filter(Boolean);
  const row = payload?.row && typeof payload.row === 'object' ? payload.row : payload;
  return row && typeof row === 'object' && Object.keys(row).length ? [row] : [{}];
}

function stripPendingMeta(row) {
  if (!row || typeof row !== 'object') return {};
  const out = { ...row };
  delete out.pendingRequestId;
  delete out.pendingStatus;
  delete out.pendingAction;
  delete out.pendingRowIndex;
  delete out.hodComment;
  return out;
}

/**
 * Virtual rows for View Data: the submitter's queued creates (not yet in the live table).
 */
async function listOpenFormApprovalRecords(formKey, userId) {
  if (!userId || !formKey) return [];
  let rows;
  try {
    const [result] = await pool.query(
      `SELECT * FROM form_approval_request
       WHERE requested_by_user_id = ? AND form_key = ?
         AND status IN ('pending', 'resubmitted', 'needs_modification')
       ORDER BY FIELD(status, 'needs_modification', 'resubmitted', 'pending'),
                updated_at DESC, id DESC`,
      [userId, formKey],
    );
    rows = result;
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }

  const virtual = [];
  for (const r of rows) {
    const dataRows = rowsFromStoredPayload(r.payload_json);
    dataRows.forEach((row, index) => {
      virtual.push({
        ...row,
        pendingRequestId: Number(r.id),
        pendingStatus: r.status,
        pendingAction: r.action || 'create',
        pendingRowIndex: index,
        hodComment: r.hod_comment || '',
      });
    });
  }
  return virtual;
}

function parsePendingRecordKey(recordKey) {
  const raw = decodeURIComponent(String(recordKey || ''));
  const m = /^pending:(\d+)(?::(\d+))?$/.exec(raw);
  if (!m) return null;
  return {
    requestId: Number(m[1]),
    rowIndex: m[2] != null ? Number(m[2]) : 0,
  };
}

async function resubmitFromRecordEdit(formKey, recordKey, columnUpdates, user) {
  const parsed = parsePendingRecordKey(recordKey);
  if (!parsed) return null;

  const request = await getRequestById(parsed.requestId);
  if (request.form_key !== formKey) {
    throw httpError('This pending entry does not belong to this form.', 400);
  }
  if (Number(request.requested_by_user_id) !== Number(user.id)) {
    throw httpError('You can only edit your own pending form entry.', 403);
  }
  if (request.status !== STATUS.NEEDS_MODIFICATION) {
    throw httpError('This entry is under HOD review and cannot be edited until it is sent back for modification.', 409);
  }

  const stored = parseJson(request.payload_json, {});
  const patch = stripPendingMeta(columnUpdates);
  let nextPayload;
  if (stored?.batch && Array.isArray(stored.rows)) {
    const idx = Number.isFinite(parsed.rowIndex) ? parsed.rowIndex : 0;
    if (idx < 0 || idx >= stored.rows.length) {
      throw httpError('Pending batch row not found.', 404);
    }
    const nextRows = stored.rows.map((row, i) => (i === idx ? { ...row, ...patch } : row));
    nextPayload = { batch: true, rows: nextRows };
  } else {
    const row = stored?.row && typeof stored.row === 'object' ? stored.row : stored;
    nextPayload = { batch: false, row: { ...row, ...patch } };
  }

  return resubmitRequest(request, nextPayload, user, { isBatch: Boolean(nextPayload.batch) });
}

function actionLabel(request) {
  return request?.is_batch ? 'Create (batch)' : 'Create';
}

function normalizeDigestTime(value) {
  const raw = String(value == null || value === '' ? DEFAULT_DIGEST_TIME : value).trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(raw);
  if (!match) return null;
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
}

function normalizeOptionalDigestTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return normalizeDigestTime(raw) || '';
}

function configuredDigestTimes(cardSettings) {
  const times = [];
  const t1 = normalizeDigestTime(cardSettings?.digestTime) || DEFAULT_DIGEST_TIME;
  const t2 = normalizeOptionalDigestTime(cardSettings?.digestTime2);
  times.push(t1);
  if (t2 && t2 !== t1) times.push(t2);
  return times;
}

function parseDigestLastSentSlots(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function slotAlreadySentToday(cardSettings, slot, istDate) {
  const slots = parseDigestLastSentSlots(cardSettings?.digestLastSentSlots);
  if (slots[slot] === istDate) return true;
  if (cardSettings?.digestLastSentDate === istDate) {
    const first = configuredDigestTimes(cardSettings)[0];
    if (first && slot === first && !slots[slot]) return true;
  }
  return false;
}

function timeToMinutes(hhmm) {
  const normalized = normalizeDigestTime(hhmm);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
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

function actorId(user) {
  return Number(user?.id || user?.userId) || null;
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

function toApiUtcIso(value) {
  const d = parseMysqlUtcDateTime(value);
  return d ? d.toISOString() : null;
}

function getFormController() {
  return require('../controllers/form.controller');
}

function isDataFormKey(formKey) {
  return Boolean(getFormController().FORM_CONFIG?.[formKey]);
}

function dataFormKeyList() {
  return Object.keys(getFormController().FORM_CONFIG || {});
}

function summarizeValue(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') {
    if (value.startsWith('data:') || value.length > 240) return 'File attached';
    return value;
  }
  if (typeof value === 'object') {
    const s = JSON.stringify(value);
    return s.length > 240 ? `${s.slice(0, 240)}…` : s;
  }
  return String(value);
}

function payloadForReview(stored) {
  const payload = parseJson(stored, {});
  const out = {};
  if (payload?.batch && Array.isArray(payload.rows)) {
    payload.rows.forEach((row, index) => {
      Object.entries(row || {}).forEach(([key, value]) => {
        out[`Row ${index + 1} · ${key}`] = summarizeValue(value);
      });
    });
    return out;
  }
  const row = payload?.row && typeof payload.row === 'object' ? payload.row : payload;
  Object.entries(row || {}).forEach(([key, value]) => {
    out[key] = summarizeValue(value);
  });
  return out;
}

async function writeAudit(requestId, action, actor, previousStatus, newStatus, comment = null) {
  await pool.execute(
    `INSERT INTO form_approval_audit
       (request_id, action, performed_by_user_id, performed_by_email, previous_status, new_status, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      requestId,
      action,
      actor?.id || actor?.userId || null,
      actor?.email || null,
      previousStatus || null,
      newStatus || null,
      comment,
    ],
  );
}

async function getRequestById(id) {
  const [[row]] = await pool.query(
    'SELECT * FROM form_approval_request WHERE id = ? LIMIT 1',
    [id],
  );
  if (!row) throw httpError('Form approval request not found.', 404);
  return row;
}

async function resolveHodUser(hodUserId) {
  const [[user]] = await pool.query(
    'SELECT id, name, email FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
    [hodUserId],
  );
  if (!user?.email) throw httpError('Assigned HOD is invalid or inactive.', 400);
  return user;
}

/**
 * form override → card default → off
 */
async function resolvePolicy(formKey, { requireHod = true } = {}) {
  if (!isDataFormKey(formKey)) return { enabled: false };

  const [[form]] = await pool.query(
    `SELECT f.id, f.name, f.form_key, f.app_id, a.name AS app_name
     FROM forms f
     JOIN apps a ON a.id = f.app_id
     WHERE f.form_key = ? AND f.is_active = 1
     LIMIT 1`,
    [formKey],
  );
  if (!form) return { enabled: false };

  let card = null;
  let formSet = null;
  try {
    const [[cardRow]] = await pool.query(
      'SELECT enabled, hod_user_id FROM form_approval_card_setting WHERE app_id = ? LIMIT 1',
      [form.app_id],
    );
    card = cardRow || null;
    const [[formRow]] = await pool.query(
      'SELECT mode, hod_user_id FROM form_approval_form_setting WHERE form_id = ? LIMIT 1',
      [form.id],
    );
    formSet = formRow || null;
  } catch (err) {
    if (isMissingTable(err)) return { enabled: false };
    throw err;
  }

  const mode = formSet?.mode || 'inherit';
  let enabled = false;
  let hodUserId = null;

  if (mode === 'off') {
    enabled = false;
  } else if (mode === 'on') {
    enabled = true;
    hodUserId = formSet.hod_user_id || card?.hod_user_id || null;
  } else {
    enabled = Boolean(card?.enabled);
    hodUserId = card?.hod_user_id || null;
  }

  if (enabled && requireHod && !hodUserId) {
    throw httpError('Approval is enabled but no HOD is assigned for this form.', 409);
  }

  return {
    enabled,
    hodUserId: hodUserId ? Number(hodUserId) : null,
    formId: form.id,
    formKey: form.form_key,
    formName: form.name,
    appId: form.app_id,
    appName: form.app_name,
    mode,
  };
}

async function findOpenModification(userId, formKey) {
  const [[row]] = await pool.query(
    `SELECT * FROM form_approval_request
     WHERE requested_by_user_id = ? AND form_key = ? AND status = ?
     ORDER BY id DESC
     LIMIT 1`,
    [userId, formKey, STATUS.NEEDS_MODIFICATION],
  );
  return row || null;
}

async function notifyHodPending(request, { resubmitted = false } = {}) {
  const userId = Number(request.hod_user_id);
  if (!userId) return null;

  if (!resubmitted) {
    try {
      const [[existing]] = await pool.query(
        `SELECT id FROM user_notification
         WHERE user_id = ? AND type = ? AND ref_type = ? AND ref_id = ?
         LIMIT 1`,
        [userId, NOTIF_TYPE_PENDING, NOTIF_REF, Number(request.id)],
      );
      if (existing) return { skipped: true };
    } catch (err) {
      console.error('[formApproval] notify dedupe failed:', err.message);
    }
  }

  const submitter = request.requested_by_name || request.requested_by_email || 'A user';
  await createUserNotification({
    userId,
    type: NOTIF_TYPE_PENDING,
    title: resubmitted ? 'Form resubmitted for approval' : 'Form awaiting approval',
    body: `${submitter} ${resubmitted ? 'resubmitted' : 'submitted'} ${request.form_name} (${request.app_name}).`,
    linkUrl: HOD_APPROVALS_PATH,
    ctaLabel: 'Open approvals',
    refType: NOTIF_REF,
    refId: request.id,
    meta: {
      formKey: request.form_key,
      status: resubmitted ? STATUS.RESUBMITTED : STATUS.PENDING,
    },
  });
  return { skipped: false };
}

async function notifySubmitterApproved(request) {
  const userId = Number(request.requested_by_user_id);
  if (userId) {
    await createUserNotification({
      userId,
      type: NOTIF_TYPE_APPROVED,
      title: 'Form approved',
      body: `${request.form_name} was approved by HOD.`,
      linkUrl: formRecordsPath(request),
      refType: NOTIF_REF,
      refId: request.id,
      meta: { formKey: request.form_key, status: STATUS.APPROVED },
    });
  }
  const email = String(request.requested_by_email || '').trim();
  if (!email) return;
  try {
    await sendFormApprovalApprovedEmail({
      to: email,
      submitterName: request.requested_by_name || 'User',
      cardLabel: request.app_name || 'Forms Hub',
      formName: request.form_name,
      actionLabel: actionLabel(request),
    });
  } catch (err) {
    console.error('[formApproval] approved email failed:', err.message);
  }
}

async function notifySubmitterNeedsModification(request, comment) {
  const userId = Number(request.requested_by_user_id);
  const commentText = String(comment || '').trim();
  if (userId) {
    await createUserNotification({
      userId,
      type: NOTIF_TYPE_MODIFY,
      title: 'Form needs modification',
      body: commentText
        ? `${request.form_name}: ${commentText}`
        : `${request.form_name} was sent back for modification. Open View Data to edit and resubmit.`,
      linkUrl: formRecordsPath(request),
      ctaLabel: 'View entry',
      refType: NOTIF_REF,
      refId: request.id,
      meta: { formKey: request.form_key, status: STATUS.NEEDS_MODIFICATION },
    });
  }
  const email = String(request.requested_by_email || '').trim();
  if (!email) return;
  try {
    await sendFormApprovalModificationEmail({
      to: email,
      submitterName: request.requested_by_name || 'User',
      cardLabel: request.app_name || 'Forms Hub',
      formName: request.form_name,
      actionLabel: actionLabel(request),
      comment: commentText,
      openUrl: formRecordsUrl(request),
    });
  } catch (err) {
    console.error('[formApproval] modification email failed:', err.message);
  }
}

async function createPending({ formKey, storedPayload, user, isBatch = false }) {
  const policy = await resolvePolicy(formKey, { requireHod: true });
  if (!policy.enabled) return null;

  if (Number(user.id) === Number(policy.hodUserId)) {
    throw httpError(
      'You are the assigned HOD for this form, so you cannot submit it for your own approval.',
      403,
    );
  }

  const hod = await resolveHodUser(policy.hodUserId);
  const open = await findOpenModification(user.id, formKey);
  if (open) {
    return resubmitRequest(open, storedPayload, user, { isBatch });
  }

  const tokens = newTokenPair();
  let result;
  try {
    [result] = await pool.execute(
      `INSERT INTO form_approval_request
         (app_id, form_id, form_key, form_name, app_name, action, is_batch, payload_json,
          requested_by_user_id, requested_by_email, requested_by_name,
          hod_user_id, hod_email, token_accept, token_reject, token_expires_at, status)
       VALUES (?, ?, ?, ?, ?, 'create', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        policy.appId,
        policy.formId,
        policy.formKey,
        policy.formName,
        policy.appName,
        isBatch ? 1 : 0,
        JSON.stringify(storedPayload),
        user.id || null,
        user.email || null,
        user.name || null,
        hod.id,
        hod.email,
        tokens.tokenAccept,
        tokens.tokenReject,
        tokens.expires,
        STATUS.PENDING,
      ],
    );
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
    [result] = await pool.execute(
      `INSERT INTO form_approval_request
         (app_id, form_id, form_key, form_name, app_name, action, is_batch, payload_json,
          requested_by_user_id, requested_by_email, requested_by_name,
          hod_user_id, hod_email, status)
       VALUES (?, ?, ?, ?, ?, 'create', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        policy.appId,
        policy.formId,
        policy.formKey,
        policy.formName,
        policy.appName,
        isBatch ? 1 : 0,
        JSON.stringify(storedPayload),
        user.id || null,
        user.email || null,
        user.name || null,
        hod.id,
        hod.email,
        STATUS.PENDING,
      ],
    );
  }

  const request = await getRequestById(result.insertId);
  await writeAudit(request.id, 'submitted', user, null, STATUS.PENDING);
  await notifyHodPending(request, { resubmitted: false });
  return request;
}

async function resubmitRequest(request, storedPayload, user, { isBatch } = {}) {
  if (Number(request.requested_by_user_id) !== Number(user.id)) {
    throw httpError('You can only resubmit your own form request.', 403);
  }
  if (request.status !== STATUS.NEEDS_MODIFICATION) {
    throw httpError('Only requests sent back for modification can be resubmitted.', 409);
  }

  const batchFlag = typeof isBatch === 'boolean' ? (isBatch ? 1 : 0) : request.is_batch;
  const tokens = newTokenPair();
  await pool.execute(
    `UPDATE form_approval_request
     SET payload_json = ?, is_batch = ?, status = ?, hod_comment = NULL,
         token_accept = ?, token_reject = ?, token_expires_at = ?,
         hod_notified_at = NULL, resolved_at = NULL, resolved_by = NULL,
         employee_reminder_sent_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      JSON.stringify(storedPayload),
      batchFlag,
      STATUS.RESUBMITTED,
      tokens.tokenAccept,
      tokens.tokenReject,
      tokens.expires,
      request.id,
    ],
  );
  const updated = await getRequestById(request.id);
  await writeAudit(updated.id, 'resubmitted', user, STATUS.NEEDS_MODIFICATION, STATUS.RESUBMITTED);
  await notifyHodPending(updated, { resubmitted: true });
  return updated;
}

/**
 * After validation, queue if the form requires approval. Returns the request or null.
 */
async function queueIfRequired({ formKey, storedPayload, user, isBatch = false }) {
  const policy = await resolvePolicy(formKey, { requireHod: true });
  if (!policy.enabled) return null;
  return createPending({ formKey, storedPayload, user, isBatch });
}

async function getFormHodAccess(userId) {
  try {
    const [[card]] = await pool.query(
      `SELECT COUNT(*) AS n FROM form_approval_card_setting
       WHERE enabled = 1 AND hod_user_id = ?`,
      [userId],
    );
    const [[formOn]] = await pool.query(
      `SELECT COUNT(*) AS n FROM form_approval_form_setting
       WHERE mode = 'on' AND hod_user_id = ?`,
      [userId],
    );
    return { enabled: Number(card?.n) > 0 || Number(formOn?.n) > 0 };
  } catch (err) {
    if (isMissingTable(err)) return { enabled: false };
    throw err;
  }
}

function assertHodForRequest(user, request) {
  if (Number(request.hod_user_id) !== actorId(user)) {
    throw httpError('Only the assigned HOD can review this form request.', 403);
  }
}

function serializeRequest(request) {
  const requestedData = payloadForReview(request.payload_json);
  const createdIst = getIstDateParts(parseMysqlUtcDateTime(request.created_at) || new Date(0)).date;
  const todayIst = getIstDateParts().date;
  return {
    id: request.id,
    module: 'forms',
    entityType: 'form_submission',
    domain: 'forms',
    domainLabel: 'Forms',
    operation: request.action || 'create',
    operationLabel: request.is_batch ? 'Create (batch)' : 'Create',
    equipmentName: request.form_name,
    equipmentPath: request.app_name,
    formKey: request.form_key,
    formName: request.form_name,
    appName: request.app_name,
    previousData: null,
    requestedData,
    changedFields: Object.entries(requestedData).map(([field, newValue]) => ({
      label: field,
      oldValue: '—',
      newValue,
    })),
    requestedBy: {
      id: request.requested_by_user_id,
      name: request.requested_by_name,
      email: request.requested_by_email,
    },
    status: request.status,
    hodComment: request.hod_comment || '',
    requestedAt: toApiUtcIso(request.created_at),
    reviewedAt: toApiUtcIso(request.resolved_at),
    reviewedBy: request.reviewed_by_user_id,
    group: createdIst && createdIst === todayIst ? 'today' : 'previous',
    photosBefore: [],
    photosAfter: [],
    documents: [],
  };
}

async function listPendingForHod(user, query = {}) {
  const access = await getFormHodAccess(user.id);
  if (!access.enabled) {
    throw httpError('You are not the assigned HOD for form approval.', 403);
  }

  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const offset = (page - 1) * limit;
  const employee = String(query.employee || '').trim();
  const status = String(query.status || '').trim();
  const search = String(query.search || '').trim();
  const from = String(query.from || '').trim();
  const to = String(query.to || '').trim();

  const sharedClauses = ['hod_user_id = ?'];
  const sharedParams = [user.id];

  if (employee) {
    sharedClauses.push('(requested_by_name LIKE ? OR requested_by_email LIKE ? OR requested_by_user_id = ?)');
    sharedParams.push(`%${employee}%`, `%${employee}%`, employee);
  }
  if (from) {
    sharedClauses.push('created_at >= ?');
    sharedParams.push(`${from} 00:00:00`);
  }
  if (to) {
    sharedClauses.push('created_at <= ?');
    sharedParams.push(`${to} 23:59:59`);
  }
  if (search) {
    sharedClauses.push(
      '(requested_by_name LIKE ? OR requested_by_email LIKE ? OR form_name LIKE ? OR app_name LIKE ? OR form_key LIKE ?)',
    );
    sharedParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const listClauses = [...sharedClauses];
  const listParams = [...sharedParams];
  const todayIst = getIstDateParts().date;
  const todayStartUtc = todayIst
    ? new Date(`${todayIst}T00:00:00+05:30`).toISOString().slice(0, 19).replace('T', ' ')
    : null;
  const todayEndUtc = todayIst
    ? new Date(`${todayIst}T23:59:59.999+05:30`).toISOString().slice(0, 19).replace('T', ' ')
    : null;
  const statusFilter = status || 'today_pending';

  if (statusFilter === 'today_pending') {
    listClauses.push(`status IN (${HOD_QUEUE_STATUSES.map(() => '?').join(', ')})`);
    listParams.push(...HOD_QUEUE_STATUSES);
    if (todayStartUtc && todayEndUtc) {
      listClauses.push('created_at >= ?');
      listParams.push(todayStartUtc);
      listClauses.push('created_at <= ?');
      listParams.push(todayEndUtc);
    }
  } else if (statusFilter === 'previous_pending') {
    listClauses.push(`status IN (${HOD_QUEUE_STATUSES.map(() => '?').join(', ')})`);
    listParams.push(...HOD_QUEUE_STATUSES);
    if (todayStartUtc) {
      listClauses.push('created_at < ?');
      listParams.push(todayStartUtc);
    }
  } else if (statusFilter === STATUS.APPROVED) {
    listClauses.push('status = ?');
    listParams.push(STATUS.APPROVED);
  } else if (statusFilter === STATUS.NEEDS_MODIFICATION) {
    listClauses.push('status = ?');
    listParams.push(STATUS.NEEDS_MODIFICATION);
  } else if (statusFilter === 'total_pending' || statusFilter === STATUS.PENDING) {
    listClauses.push(`status IN (${HOD_QUEUE_STATUSES.map(() => '?').join(', ')})`);
    listParams.push(...HOD_QUEUE_STATUSES);
  } else if (HOD_QUEUE_STATUSES.includes(statusFilter)) {
    listClauses.push('status = ?');
    listParams.push(statusFilter);
  } else {
    listClauses.push(`status IN (${HOD_QUEUE_STATUSES.map(() => '?').join(', ')})`);
    listParams.push(...HOD_QUEUE_STATUSES);
  }

  const listWhere = listClauses.join(' AND ');
  const pendingClauses = [
    ...sharedClauses,
    `status IN (${HOD_QUEUE_STATUSES.map(() => '?').join(', ')})`,
  ];
  const pendingParams = [...sharedParams, ...HOD_QUEUE_STATUSES];

  const [pendingRows] = await pool.query(
    `SELECT status, created_at FROM form_approval_request WHERE ${pendingClauses.join(' AND ')}`,
    pendingParams,
  );
  let previousPending = 0;
  let newToday = 0;
  for (const row of pendingRows) {
    const created = getIstDateParts(parseMysqlUtcDateTime(row.created_at) || new Date(0)).date;
    if (created === todayIst) newToday += 1;
    else previousPending += 1;
  }

  const [[kpiRow]] = await pool.query(
    `SELECT
       COUNT(*) AS totalRequests,
       SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approvedRequests,
       SUM(CASE WHEN status = 'needs_modification' THEN 1 ELSE 0 END) AS needsModification
     FROM form_approval_request
     WHERE ${sharedClauses.join(' AND ')}`,
    sharedParams,
  );

  const [[{ listTotal }]] = await pool.query(
    `SELECT COUNT(*) AS listTotal FROM form_approval_request WHERE ${listWhere}`,
    listParams,
  );

  const orderSql = statusFilter === STATUS.APPROVED || statusFilter === STATUS.NEEDS_MODIFICATION
    ? 'ORDER BY COALESCE(resolved_at, created_at) DESC, id DESC'
    : "ORDER BY FIELD(status, 'resubmitted', 'pending'), created_at ASC, id ASC";

  const [rows] = await pool.query(
    `SELECT * FROM form_approval_request WHERE ${listWhere} ${orderSql} LIMIT ${limit} OFFSET ${offset}`,
    listParams,
  );

  return {
    page,
    limit,
    total: Number(listTotal) || 0,
    items: rows.map(serializeRequest),
    summary: {
      previousPending,
      newToday,
      total: previousPending + newToday,
      totalRequests: Number(kpiRow?.totalRequests) || 0,
      approvedRequests: Number(kpiRow?.approvedRequests) || 0,
      needsModification: Number(kpiRow?.needsModification) || 0,
    },
  };
}

async function approveRequest(request, actor) {
  assertHodForRequest(actor, request);
  if (Number(request.requested_by_user_id) === Number(actor.id || actor.userId)) {
    throw httpError('You cannot approve your own request.', 403);
  }
  if (request.status === STATUS.APPROVED) {
    return { status: STATUS.APPROVED, alreadyResolved: true, request };
  }
  if (![STATUS.PENDING, STATUS.RESUBMITTED].includes(request.status)) {
    throw httpError('This request is not waiting for approval.', 409);
  }

  const stored = parseJson(request.payload_json, {});
  await getFormController().applyApprovedInsert(request.form_key, stored);

  const previous = request.status;
  await pool.execute(
    `UPDATE form_approval_request
     SET status = ?, resolved_at = UTC_TIMESTAMP(), resolved_by = ?, reviewed_by_user_id = ?
     WHERE id = ?`,
    [STATUS.APPROVED, actor.email || actor.name || 'HOD', actorId(actor), request.id],
  );
  const updated = await getRequestById(request.id);
  await writeAudit(updated.id, 'approved', actor, previous, STATUS.APPROVED);
  await notifySubmitterApproved(updated);
  return { status: STATUS.APPROVED, alreadyResolved: false, request: updated };
}

async function sendForModification(request, comment, actor) {
  assertHodForRequest(actor, request);
  const text = String(comment || '').trim();
  if (!text) throw httpError('A comment is required when sending for modification.', 400);
  if (request.status === STATUS.NEEDS_MODIFICATION) {
    return { status: STATUS.NEEDS_MODIFICATION, alreadyResolved: true, request };
  }
  if (![STATUS.PENDING, STATUS.RESUBMITTED].includes(request.status)) {
    throw httpError('This request is not waiting for approval.', 409);
  }

  const previous = request.status;
  await pool.execute(
    `UPDATE form_approval_request
     SET status = ?, hod_comment = ?, resolved_at = UTC_TIMESTAMP(), resolved_by = ?,
         reviewed_by_user_id = ?, employee_reminder_sent_at = NULL
     WHERE id = ?`,
    [STATUS.NEEDS_MODIFICATION, text, actor.email || 'HOD', actorId(actor), request.id],
  );
  const updated = await getRequestById(request.id);
  await writeAudit(updated.id, 'sent_for_modification', actor, previous, STATUS.NEEDS_MODIFICATION, text);
  await notifySubmitterNeedsModification(updated, text);
  return { status: STATUS.NEEDS_MODIFICATION, alreadyResolved: false, request: updated };
}

async function bulkApprove(ids, user) {
  const results = [];
  for (const rawId of ids) {
    const id = Number(rawId);
    try {
      const request = await getRequestById(id);
      const result = await approveRequest(request, { id: user.id, userId: user.id, email: user.email });
      results.push({ id, ok: true, status: result.status, alreadyResolved: result.alreadyResolved });
    } catch (err) {
      results.push({ id, ok: false, message: err.message });
    }
  }
  return results;
}

async function listSettingsTree() {
  const keys = dataFormKeyList();
  if (!keys.length) return [];

  const [apps] = await pool.query(
    `SELECT id, name, description, sort_order
     FROM apps
     WHERE is_active = 1
     ORDER BY sort_order ASC, name ASC`,
  );
  const [forms] = await pool.query(
    `SELECT id, app_id, name, form_key, sort_order
     FROM forms
     WHERE is_active = 1 AND form_key IN (${keys.map(() => '?').join(', ')})
     ORDER BY sort_order ASC, name ASC`,
    keys,
  );
  let cardRows;
  try {
    const [rows] = await pool.query(
      `SELECT app_id, enabled, hod_user_id, digest_time, digest_time_2,
              digest_last_sent_date, digest_last_sent_slots
       FROM form_approval_card_setting`,
    );
    cardRows = rows;
  } catch (err) {
    if (isMissingTable(err)) cardRows = [];
    else if (err.code === 'ER_BAD_FIELD_ERROR') {
      const [rows] = await pool.query('SELECT app_id, enabled, hod_user_id FROM form_approval_card_setting');
      cardRows = rows;
    } else throw err;
  }
  const [formRows] = await pool.query('SELECT form_id, mode, hod_user_id FROM form_approval_form_setting').catch((err) => {
    if (isMissingTable(err)) return [[]];
    throw err;
  });

  const cardMap = new Map(cardRows.map((r) => [Number(r.app_id), r]));
  const formMap = new Map(formRows.map((r) => [Number(r.form_id), r]));

  return apps
    .filter((app) => !RETIRED_APP_NAMES.has(String(app.name || '').trim()))
    .filter((app) => String(app.name || '').trim() !== 'BI Control Tower')
    .map((app) => {
      const card = cardMap.get(Number(app.id));
      const appForms = forms.filter((f) => Number(f.app_id) === Number(app.id));
      return {
        appId: app.id,
        name: app.name,
        description: app.description || '',
        enabled: Boolean(card?.enabled),
        hodUserId: card?.hod_user_id ? Number(card.hod_user_id) : null,
        digestTime: normalizeDigestTime(card?.digest_time) || DEFAULT_DIGEST_TIME,
        digestTime2: normalizeOptionalDigestTime(card?.digest_time_2) || '',
        forms: appForms.map((form) => {
          const fs = formMap.get(Number(form.id));
          return {
            formId: form.id,
            formKey: form.form_key,
            name: form.name,
            mode: fs?.mode || 'inherit',
            hodUserId: fs?.hod_user_id ? Number(fs.hod_user_id) : null,
          };
        }),
      };
    })
    .filter((card) => card.forms.length > 0);
}

async function saveSettingsTree(cards = []) {
  if (!Array.isArray(cards)) throw httpError('cards must be an array.', 400);

  for (const card of cards) {
    const appId = Number(card.appId);
    if (!appId) continue;
    const enabled = Boolean(card.enabled);
    const hodUserId = card.hodUserId ? Number(card.hodUserId) : null;
    if (enabled && !hodUserId) {
      throw httpError(`Select an HOD before enabling approval for ${card.name || 'this card'}.`, 400);
    }
    if (hodUserId) await resolveHodUser(hodUserId);

    const digestTime = normalizeDigestTime(card.digestTime);
    if (!digestTime) {
      throw httpError(`Digest time 1 is invalid for ${card.name || 'this card'}.`, 400);
    }
    const digestTime2Raw = String(card.digestTime2 ?? '').trim();
    const digestTime2 = digestTime2Raw ? normalizeOptionalDigestTime(digestTime2Raw) : '';
    if (digestTime2Raw && !digestTime2) {
      throw httpError(`Digest time 2 is invalid for ${card.name || 'this card'}.`, 400);
    }

    try {
      await pool.execute(
        `INSERT INTO form_approval_card_setting (app_id, enabled, hod_user_id, digest_time, digest_time_2)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           enabled = VALUES(enabled),
           hod_user_id = VALUES(hod_user_id),
           digest_time = VALUES(digest_time),
           digest_time_2 = VALUES(digest_time_2)`,
        [appId, enabled ? 1 : 0, hodUserId, digestTime, digestTime2 || null],
      );
    } catch (err) {
      if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
      await pool.execute(
        `INSERT INTO form_approval_card_setting (app_id, enabled, hod_user_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), hod_user_id = VALUES(hod_user_id)`,
        [appId, enabled ? 1 : 0, hodUserId],
      );
    }

    for (const form of card.forms || []) {
      const formId = Number(form.formId);
      if (!formId) continue;
      const mode = ['inherit', 'on', 'off'].includes(form.mode) ? form.mode : 'inherit';
      const formHod = form.hodUserId ? Number(form.hodUserId) : null;
      if (mode === 'on' && !formHod && !hodUserId) {
        throw httpError(`Select an HOD for ${form.name || 'this form'}, or inherit from the card.`, 400);
      }
      if (formHod) await resolveHodUser(formHod);
      await pool.execute(
        `INSERT INTO form_approval_form_setting (form_id, mode, hod_user_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE mode = VALUES(mode), hod_user_id = VALUES(hod_user_id)`,
        [formId, mode, mode === 'off' ? null : formHod],
      );
    }
  }

  return listSettingsTree();
}

async function addColumnIfMissing(table, column, ddl) {
  const [[col]] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (!Number(col?.n)) {
    await pool.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
    console.log(`[formApproval] added ${table}.${column}`);
  }
}

async function addUniqueIndexIfMissing(table, indexName, column) {
  const [[idx]] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, indexName],
  );
  if (!Number(idx?.n)) {
    await pool.execute(`ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${indexName}\` (\`${column}\`)`);
    console.log(`[formApproval] added unique key ${table}.${indexName}`);
  }
}

async function ensureFormApprovalMailSchema() {
  try {
    await addColumnIfMissing(
      'form_approval_card_setting',
      'digest_time',
      "`digest_time` VARCHAR(5) NOT NULL DEFAULT '22:00'",
    );
    await addColumnIfMissing(
      'form_approval_card_setting',
      'digest_time_2',
      '`digest_time_2` VARCHAR(5) NULL DEFAULT NULL',
    );
    await addColumnIfMissing(
      'form_approval_card_setting',
      'digest_last_sent_date',
      '`digest_last_sent_date` VARCHAR(10) NULL DEFAULT NULL',
    );
    await addColumnIfMissing(
      'form_approval_card_setting',
      'digest_last_sent_slots',
      '`digest_last_sent_slots` TEXT NULL DEFAULT NULL',
    );
    await addColumnIfMissing(
      'form_approval_request',
      'token_accept',
      '`token_accept` VARCHAR(64) NULL DEFAULT NULL',
    );
    await addColumnIfMissing(
      'form_approval_request',
      'token_reject',
      '`token_reject` VARCHAR(64) NULL DEFAULT NULL',
    );
    await addColumnIfMissing(
      'form_approval_request',
      'token_expires_at',
      '`token_expires_at` DATETIME NULL DEFAULT NULL',
    );
    await addColumnIfMissing(
      'form_approval_request',
      'hod_notified_at',
      '`hod_notified_at` DATETIME NULL DEFAULT NULL',
    );
    await addColumnIfMissing(
      'form_approval_request',
      'notification_count',
      '`notification_count` INT NOT NULL DEFAULT 0',
    );
    await addColumnIfMissing(
      'form_approval_request',
      'employee_reminder_sent_at',
      '`employee_reminder_sent_at` DATETIME NULL DEFAULT NULL',
    );
    await addUniqueIndexIfMissing('form_approval_request', 'uq_form_approval_token_accept', 'token_accept');
    await addUniqueIndexIfMissing('form_approval_request', 'uq_form_approval_token_reject', 'token_reject');
  } catch (err) {
    if (isMissingTable(err)) {
      console.error('[formApproval] mail schema skipped: apply mysql/migrate_form_approval.sql first');
      return;
    }
    throw err;
  }
}

function cardSettingsFromRow(row) {
  return {
    appId: Number(row.app_id),
    appName: row.app_name || 'Forms Hub',
    enabled: Boolean(row.enabled),
    hodUserId: row.hod_user_id ? Number(row.hod_user_id) : null,
    digestTime: normalizeDigestTime(row.digest_time) || DEFAULT_DIGEST_TIME,
    digestTime2: normalizeOptionalDigestTime(row.digest_time_2) || '',
    digestLastSentDate: row.digest_last_sent_date || null,
    digestLastSentSlots: parseDigestLastSentSlots(row.digest_last_sent_slots),
  };
}

async function loadCardSetting(appId) {
  const [[row]] = await pool.query(
    `SELECT c.app_id, c.enabled, c.hod_user_id, c.digest_time, c.digest_time_2,
            c.digest_last_sent_date, c.digest_last_sent_slots, a.name AS app_name
     FROM form_approval_card_setting c
     JOIN apps a ON a.id = c.app_id
     WHERE c.app_id = ?
     LIMIT 1`,
    [appId],
  );
  if (row) return cardSettingsFromRow(row);
  const [[app]] = await pool.query('SELECT id, name FROM apps WHERE id = ? LIMIT 1', [appId]);
  return {
    appId: Number(appId),
    appName: app?.name || 'Forms Hub',
    enabled: false,
    hodUserId: null,
    digestTime: DEFAULT_DIGEST_TIME,
    digestTime2: '',
    digestLastSentDate: null,
    digestLastSentSlots: {},
  };
}

async function fetchPendingForCard(appId, hodUserId = null) {
  const params = [appId];
  let sql = `SELECT * FROM form_approval_request
     WHERE app_id = ?
       AND status IN ('pending', 'resubmitted')`;
  if (hodUserId) {
    sql += ' AND hod_user_id = ?';
    params.push(hodUserId);
  }
  sql += ' ORDER BY created_at ASC, id ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function fetchAllPendingFormRequests() {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM form_approval_request
       WHERE status IN ('pending', 'resubmitted')
       ORDER BY created_at ASC, id ASC`,
    );
    return rows;
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

async function markFormRequestsNotified(ids, hod = null) {
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(', ');
  if (hod?.id && hod?.email) {
    await pool.execute(
      `UPDATE form_approval_request
       SET hod_notified_at = NOW(),
           notification_count = IFNULL(notification_count, 0) + 1,
           hod_user_id = ?,
           hod_email = ?
       WHERE id IN (${placeholders})`,
      [hod.id, hod.email, ...ids],
    );
    return;
  }
  await pool.execute(
    `UPDATE form_approval_request
     SET hod_notified_at = NOW(),
         notification_count = IFNULL(notification_count, 0) + 1
     WHERE id IN (${placeholders})`,
    ids,
  );
}

async function listFormDigestSchedules() {
  try {
    const [rows] = await pool.query(
      `SELECT app_id, hod_user_id, digest_time, digest_time_2
       FROM form_approval_card_setting
       WHERE enabled = 1 AND hod_user_id IS NOT NULL`,
    );
    return rows.map((row) => ({
      appId: Number(row.app_id),
      hodUserId: Number(row.hod_user_id),
      digestTime: normalizeDigestTime(row.digest_time) || DEFAULT_DIGEST_TIME,
      digestTime2: normalizeOptionalDigestTime(row.digest_time_2) || '',
    }));
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

function splitDigestByIstDate(rows, istDate) {
  const previous = [];
  const today = [];
  for (const row of rows) {
    const created = getIstDateParts(parseMysqlUtcDateTime(row.created_at) || new Date(0)).date;
    if (created === istDate) today.push(row);
    else previous.push(row);
  }
  return { previous, today };
}

function buildDigestEntry(request) {
  return {
    id: request.id,
    equipmentName: request.form_name,
    equipmentPath: request.app_name,
    actionLabel: actionLabel(request),
    submitterName: request.requested_by_name || 'A user',
    submitterEmail: request.requested_by_email || '',
    createdAt: request.created_at || null,
    acceptToken: request.token_accept,
    rejectToken: request.token_reject,
  };
}

async function refreshTokensForRows(rows) {
  const refreshed = [];
  for (const row of rows) {
    const tokens = newTokenPair();
    await pool.execute(
      `UPDATE form_approval_request
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

async function markDigestSlotSent(appId, slot, istDate) {
  const settings = await loadCardSetting(appId);
  const slots = { ...settings.digestLastSentSlots };
  const next = {};
  for (const [key, date] of Object.entries(slots)) {
    if (date === istDate) next[key] = date;
  }
  next[slot] = istDate;
  const payload = JSON.stringify(next);
  const [result] = await pool.execute(
    `UPDATE form_approval_card_setting
     SET digest_last_sent_date = ?, digest_last_sent_slots = ?
     WHERE app_id = ?`,
    [istDate, payload, appId],
  );
  if (!result.affectedRows) {
    await pool.execute(
      `INSERT INTO form_approval_card_setting
         (app_id, enabled, hod_user_id, digest_time, digest_time_2, digest_last_sent_date, digest_last_sent_slots)
       VALUES (?, 0, NULL, ?, NULL, ?, ?)
       ON DUPLICATE KEY UPDATE
         digest_last_sent_date = VALUES(digest_last_sent_date),
         digest_last_sent_slots = VALUES(digest_last_sent_slots)`,
      [appId, settings.digestTime || DEFAULT_DIGEST_TIME, istDate, payload],
    );
  }
}

function groupRowsByHod(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = Number(row.hod_user_id) || 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return groups;
}

/**
 * @param {number} appId
 * @param {{ force?: boolean, mode?: 'all'|'new', slot?: string }} [options]
 */
async function sendDigestForCard(appId, options = {}) {
  const force = Boolean(options.force);
  const mode = options.mode === 'new' ? 'new' : 'all';
  const slot = normalizeOptionalDigestTime(options.slot);
  const numericAppId = Number(appId);
  if (!numericAppId) throw httpError('appId is required.', 400);

  const cardSettings = await loadCardSetting(numericAppId);
  const ist = getIstDateParts();
  if (!force) {
    if (slot) {
      if (slotAlreadySentToday(cardSettings, slot, ist.date)) {
        return { sent: false, reason: 'already-sent' };
      }
    } else if (cardSettings.digestLastSentDate === ist.date) {
      return { sent: false, reason: 'already-sent' };
    }
  }

  let pendingRows = await fetchPendingForCard(numericAppId);
  if (mode === 'new') {
    pendingRows = pendingRows.filter((row) => !row.hod_notified_at);
  }
  if (pendingRows.length === 0) {
    return {
      sent: false,
      count: 0,
      reason: 'empty',
      mode,
      message: mode === 'new'
        ? 'No new pending items since the last digest email.'
        : 'No pending approvals to email.',
    };
  }

  const allPending = mode === 'new'
    ? await fetchPendingForCard(numericAppId)
    : pendingRows;

  let sentCount = 0;
  for (const [hodId, group] of groupRowsByHod(pendingRows)) {
    if (!hodId) continue;
    let hod;
    try {
      hod = await resolveHodUser(hodId);
    } catch (err) {
      console.error(`[formApproval] digest skipped HOD ${hodId}:`, err.message);
      continue;
    }

    await pool.execute(
      `UPDATE form_approval_request
       SET hod_user_id = ?, hod_email = ?
       WHERE app_id = ? AND hod_user_id = ? AND status IN ('pending', 'resubmitted')`,
      [hod.id, hod.email, numericAppId, hod.id],
    );

    const refreshed = await refreshTokensForRows(group);
    const allForHod = allPending.filter((row) => Number(row.hod_user_id) === Number(hod.id));
    const { previous, today } = splitDigestByIstDate(allForHod, ist.date);
    await sendFormApprovalDigestEmail({
      to: hod.email,
      hodName: hod.name,
      cardLabel: cardSettings.appName,
      digestDate: ist.date,
      entries: refreshed.map(buildDigestEntry),
      previousCount: previous.length,
      newTodayCount: today.length,
      totalCount: mode === 'new' ? refreshed.length : allForHod.length,
      mode,
    });

    const ids = refreshed.map((row) => row.id);
    const placeholders = ids.map(() => '?').join(', ');
    await pool.execute(
      `UPDATE form_approval_request
       SET hod_notified_at = NOW(),
           notification_count = IFNULL(notification_count, 0) + 1
       WHERE id IN (${placeholders})`,
      ids,
    );
    sentCount += refreshed.length;
  }

  if (!sentCount) {
    return {
      sent: false,
      count: 0,
      reason: 'empty',
      mode,
      message: 'No pending approvals with a valid HOD email.',
    };
  }

  if (slot) {
    await markDigestSlotSent(numericAppId, slot, ist.date);
  } else {
    const [result] = await pool.execute(
      `UPDATE form_approval_card_setting SET digest_last_sent_date = ? WHERE app_id = ?`,
      [ist.date, numericAppId],
    );
    if (!result.affectedRows) {
      await pool.execute(
        `INSERT INTO form_approval_card_setting (app_id, enabled, hod_user_id, digest_time, digest_last_sent_date)
         VALUES (?, 0, NULL, ?, ?)
         ON DUPLICATE KEY UPDATE digest_last_sent_date = VALUES(digest_last_sent_date)`,
        [numericAppId, DEFAULT_DIGEST_TIME, ist.date],
      );
    }
  }

  return {
    sent: true,
    count: sentCount,
    mode,
    force,
    slot: slot || null,
    appId: numericAppId,
    cardLabel: cardSettings.appName,
  };
}

async function runFormDigestSchedulerTick() {
  const ist = getIstDateParts();
  const nowMinutes = timeToMinutes(ist.time);
  if (nowMinutes == null) {
    console.error('[formApproval] digest tick skipped: could not parse IST time', ist);
    return;
  }

  let pendingAppIds;
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT app_id FROM form_approval_request
       WHERE status IN ('pending', 'resubmitted')`,
    );
    pendingAppIds = rows.map((r) => Number(r.app_id)).filter(Boolean);
  } catch (err) {
    if (isMissingTable(err) || err.code === 'ER_BAD_FIELD_ERROR') return;
    throw err;
  }

  for (const appId of pendingAppIds) {
    let cardSettings;
    try {
      cardSettings = await loadCardSetting(appId);
    } catch (err) {
      console.error(`[formApproval] digest load card ${appId} failed:`, err.message);
      continue;
    }
    const times = configuredDigestTimes(cardSettings);
    if (!times.length) continue;

    try {
      const pending = await fetchPendingForCard(appId);
      if (!pending.length) continue;

      for (const slot of times) {
        const digestMinutes = timeToMinutes(slot);
        if (digestMinutes == null) continue;
        if (slotAlreadySentToday(cardSettings, slot, ist.date)) continue;
        if (nowMinutes < digestMinutes) {
          console.log(
            `[formApproval] ${pending.length} pending ${cardSettings.appName} item(s); waiting until ${slot} IST (now ${ist.time})`,
          );
          continue;
        }

        const result = await sendDigestForCard(appId, { slot });
        if (result.sent) {
          console.log(
            `[formApproval] digest sent for ${cardSettings.appName} at slot ${slot}: ${result.count} item(s) to HOD`,
          );
          cardSettings.digestLastSentSlots = {
            ...parseDigestLastSentSlots(cardSettings.digestLastSentSlots),
            [slot]: ist.date,
          };
          cardSettings.digestLastSentDate = ist.date;
        }
      }
    } catch (err) {
      console.error(`[formApproval] digest failed for app ${appId}:`, err.message);
    }
  }
}

function istCalendarDaysBetween(earlierIstDate, laterIstDate) {
  if (!earlierIstDate || !laterIstDate) return 0;
  const a = new Date(`${earlierIstDate}T00:00:00+05:30`).getTime();
  const b = new Date(`${laterIstDate}T00:00:00+05:30`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / (24 * 60 * 60 * 1000));
}

function isEmployeeModificationReminderDue(row, todayIstDate) {
  const anchor = parseMysqlUtcDateTime(row.employee_reminder_sent_at)
    || parseMysqlUtcDateTime(row.resolved_at);
  if (!anchor) return false;
  const anchorIst = getIstDateParts(anchor).date;
  return istCalendarDaysBetween(anchorIst, todayIstDate) >= EMPLOYEE_REMINDER_INTERVAL_DAYS;
}

async function sendEmployeeModificationReminderForRequest(row) {
  const email = String(row.requested_by_email || '').trim();
  if (!email) return { sent: false, reason: 'no-email' };

  await sendFormApprovalModificationReminderEmail({
    to: email,
    submitterName: row.requested_by_name || 'User',
    cardLabel: row.app_name || 'Forms Hub',
    formName: row.form_name,
    actionLabel: actionLabel(row),
    comment: row.hod_comment || '',
    openUrl: formRecordsUrl(row),
  });

  try {
    const userId = Number(row.requested_by_user_id);
    if (userId) {
      await createUserNotification({
        userId,
        type: NOTIF_TYPE_MODIFY,
        title: 'Reminder: form needs modification',
        body: `${row.form_name} is still waiting for you to revise and resubmit.`,
        linkUrl: `/forms/${encodeURIComponent(row.form_key)}`,
        ctaLabel: 'Open form',
        refType: NOTIF_REF,
        refId: row.id,
        meta: { formKey: row.form_key, status: STATUS.NEEDS_MODIFICATION, reminder: true },
      });
    }
  } catch (err) {
    console.error('[formApproval] employee reminder in-app notify failed:', err.message);
  }

  await pool.execute(
    `UPDATE form_approval_request
     SET employee_reminder_sent_at = NOW()
     WHERE id = ? AND status = 'needs_modification'`,
    [row.id],
  );
  return { sent: true };
}

async function runFormEmployeeModificationReminderTick() {
  const ist = getIstDateParts();
  const nowMinutes = timeToMinutes(ist.time);
  const reminderMinutes = timeToMinutes(EMPLOYEE_REMINDER_TIME_IST);
  if (nowMinutes == null || reminderMinutes == null) return;
  if (nowMinutes < reminderMinutes) return;

  let rows;
  try {
    const [result] = await pool.query(
      `SELECT * FROM form_approval_request
       WHERE status = 'needs_modification'
         AND requested_by_email IS NOT NULL
         AND TRIM(requested_by_email) <> ''
         AND resolved_at IS NOT NULL
       ORDER BY resolved_at ASC, id ASC
       LIMIT 200`,
    );
    rows = result;
  } catch (err) {
    if (isMissingTable(err) || err.code === 'ER_BAD_FIELD_ERROR') return;
    throw err;
  }

  let sent = 0;
  for (const row of rows) {
    if (!isEmployeeModificationReminderDue(row, ist.date)) continue;
    try {
      const result = await sendEmployeeModificationReminderForRequest(row);
      if (result.sent) {
        sent += 1;
        console.log(
          `[formApproval] employee modification reminder sent for request #${row.id} → ${row.requested_by_email}`,
        );
      }
    } catch (err) {
      console.error(`[formApproval] employee reminder failed for request #${row.id}:`, err.message);
    }
  }
  if (sent) {
    console.log(`[formApproval] employee modification reminders sent: ${sent}`);
  }
}

async function getRequestByToken(token, type) {
  const col = type === 'reject' ? 'token_reject' : 'token_accept';
  const [[row]] = await pool.query(
    `SELECT * FROM form_approval_request WHERE ${col} = ? LIMIT 1`,
    [token],
  );
  return row || null;
}

async function markExpiredIfNeeded(request) {
  if (!HOD_QUEUE_STATUSES.includes(request.status) && request.status !== STATUS.NEEDS_MODIFICATION) {
    return request;
  }
  if (!request.token_expires_at) return request;
  if (new Date(request.token_expires_at) >= new Date()) return request;
  return { ...request, tokenExpired: true };
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

async function getReviewByToken(token) {
  let request = await getRequestByToken(token, 'accept');
  if (!request) {
    throw httpError('Invalid review link.', 404);
  }
  request = await markExpiredIfNeeded(request);
  const requestedData = payloadForReview(request.payload_json);
  return {
    status: request.status,
    alreadyResolved: !HOD_QUEUE_STATUSES.includes(request.status),
    tokenExpired: Boolean(request.tokenExpired),
    request,
    id: request.id,
    equipmentName: request.form_name,
    equipmentPath: request.app_name,
    domain: 'forms',
    domainLabel: request.app_name,
    action: request.action,
    actionLabel: actionLabel(request),
    submitterName: request.requested_by_name || 'A user',
    submitterEmail: request.requested_by_email || '',
    createdAt: request.created_at || null,
    createdAtLabel: formatEntryCreatedAt(request.created_at),
    diff: Object.entries(requestedData).map(([label, newValue]) => ({
      label,
      oldValue: '—',
      newValue,
    })),
    hodComment: request.hod_comment || '',
    acceptToken: request.token_accept,
    rejectToken: request.token_reject,
    tokenExpiresAt: request.token_expires_at || null,
    resolvedAt: request.resolved_at || null,
  };
}

async function getInboxByToken(token) {
  const review = await getReviewByToken(token);
  const rows = await fetchPendingForCard(review.request.app_id, review.request.hod_user_id);
  const entries = rows.map(buildDigestEntry);
  return {
    status: review.status,
    alreadyResolved: review.alreadyResolved && !rows.length,
    domain: 'forms',
    domainLabel: review.request.app_name,
    hodEmail: review.request.hod_email,
    entries,
    request: review.request,
  };
}

async function approveByToken(token) {
  let request = await getRequestByToken(token, 'accept');
  if (!request) throw httpError('Invalid approval link.', 404);
  request = await markExpiredIfNeeded(request);
  if (request.tokenExpired) {
    throw httpError(
      'This approval link has expired. Use the latest daily digest email, or ask an admin to resend the digest (no DigiLog login required).',
      410,
    );
  }
  return approveRequest(request, {
    id: request.hod_user_id,
    userId: request.hod_user_id,
    email: request.hod_email,
  });
}

async function rejectByToken(token, comment) {
  let request = await getRequestByToken(token, 'reject');
  if (!request) throw httpError('Invalid modification link.', 404);
  request = await markExpiredIfNeeded(request);
  if (request.tokenExpired) {
    throw httpError(
      'This link has expired. Use the latest daily digest email, or ask an admin to resend the digest (no DigiLog login required).',
      410,
    );
  }
  return sendForModification(request, comment, {
    id: request.hod_user_id,
    userId: request.hod_user_id,
    email: request.hod_email,
  });
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
        equipmentName: result.request?.form_name || entry.equipmentName,
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
    domain: 'forms',
    domainLabel: inbox.domainLabel,
    results,
    approved: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  };
}

module.exports = {
  STATUS,
  isDataFormKey,
  resolvePolicy,
  queueIfRequired,
  getFormHodAccess,
  getRequestById,
  listPendingForHod,
  approveRequest,
  sendForModification,
  bulkApprove,
  serializeRequest,
  listSettingsTree,
  saveSettingsTree,
  ensureFormApprovalMailSchema,
  sendDigestForCard,
  fetchAllPendingFormRequests,
  refreshTokensForRows,
  buildDigestEntry,
  markFormRequestsNotified,
  listFormDigestSchedules,
  loadCardSetting,
  runFormDigestSchedulerTick,
  runFormEmployeeModificationReminderTick,
  getReviewByToken,
  getInboxByToken,
  approveByToken,
  rejectByToken,
  bulkApproveByInboxToken,
  formatEntryCreatedAt,
  listOpenFormApprovalRecords,
  parsePendingRecordKey,
  resubmitFromRecordEdit,
};
