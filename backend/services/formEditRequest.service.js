const { pool } = require('../config/mysql');
const { createUserNotification } = require('./userNotification.service');

const EDIT_REQUESTS_SETTING_KEY = 'form_edit_requests_enabled';

async function isEditRequestFlowEnabled() {
  const [[row]] = await pool.query(
    'SELECT setting_value FROM portal_settings WHERE setting_key = ? LIMIT 1',
    [EDIT_REQUESTS_SETTING_KEY],
  );
  if (!row) return false;
  return row.setting_value === '1' || row.setting_value === 'true';
}

async function setEditRequestFlowEnabled(enabled) {
  const value = enabled ? '1' : '0';
  await pool.query(
    `INSERT INTO portal_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [EDIT_REQUESTS_SETTING_KEY, value],
  );
  return Boolean(enabled);
}

function formApi() {
  return require('../controllers/form.controller');
}

function sameValue(a, b) {
  const empty = (v) => v == null || v === '';
  if (empty(a) && empty(b)) return true;
  if (typeof a === 'number' || typeof b === 'number') {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na === nb;
  }
  return String(a) === String(b);
}

function changedFields(existing, payload) {
  const before = {};
  const after = {};
  for (const key of Object.keys(payload)) {
    if (sameValue(existing[key], payload[key])) continue;
    before[key] = existing[key] == null ? null : existing[key];
    after[key] = payload[key];
  }
  return { before, after };
}

function parseJson(value) {
  if (value == null) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

async function lookupFormNames(formKey) {
  const [[row]] = await pool.query(
    `SELECT f.name AS form_name, a.id AS app_id, a.name AS app_name
       FROM forms f
       LEFT JOIN apps a ON a.id = f.app_id
      WHERE f.form_key = ?
      LIMIT 1`,
    [formKey],
  );
  return {
    formName: row?.form_name || formKey,
    appId: row?.app_id || null,
    appName: row?.app_name || '',
  };
}

async function notifyAdmins(requestId, names) {
  const [admins] = await pool.query(
    `SELECT id FROM users WHERE role = 'admin' AND is_active = 1`,
  );
  const title = 'New edit request';
  const body = `${names.formName} — a saved row is waiting for review.`;
  await Promise.all(admins.map((admin) => createUserNotification({
    userId: admin.id,
    type: 'form_edit_request_new',
    title,
    body,
    linkUrl: '/admin/config?section=edit-requests',
    ctaLabel: 'Review',
    refType: 'form_edit_request',
    refId: requestId,
  })));
}

async function notifyRequester(row, { approved }) {
  const linkUrl = approved && row.app_id
    ? `/apps/${row.app_id}?viewForm=${encodeURIComponent(row.form_key)}&viewData=1&recordTs=${encodeURIComponent(row.record_key)}`
    : null;
  await createUserNotification({
    userId: row.user_id,
    type: approved ? 'form_edit_request_approved' : 'form_edit_request_rejected',
    title: approved ? 'Your edit request was approved' : 'Your edit request was rejected',
    body: row.form_name || row.form_key,
    linkUrl,
    ctaLabel: approved ? 'View row' : null,
    refType: 'form_edit_request',
    refId: row.id,
  });
}

async function createEditRequest({ user, formKey, recordKey, body, comment }) {
  if (!(await isEditRequestFlowEnabled())) {
    const err = new Error('Edit requests are turned off.');
    err.status = 403;
    throw err;
  }
  const api = formApi();
  const config = api.FORM_CONFIG[formKey];
  if (!config) {
    const err = new Error('Unknown form.');
    err.status = 400;
    throw err;
  }
  const note = String(comment || '').trim().slice(0, 2000);
  if (note.length < 10) {
    const err = new Error('Comment must be at least 10 characters.');
    err.status = 400;
    throw err;
  }
  if (user?.role === 'admin') {
    const err = new Error('Admins edit a saved row directly.');
    err.status = 400;
    throw err;
  }
  const allowed = await api.canAccessForm(user, formKey);
  if (!allowed) {
    const err = new Error('Access denied to this form.');
    err.status = 403;
    throw err;
  }

  const existing = await api.fetchRecordByKey(config, recordKey);
  if (!existing) {
    const err = new Error('Record not found.');
    err.status = 404;
    throw err;
  }
  const storedKey = api.normalizeRecordTimestamp(existing[config.tsCol]);
  const payload = api.buildAdminUpdatePayload(formKey, config, body);
  const { before, after } = changedFields(existing, payload);
  if (Object.keys(after).length === 0) {
    const err = new Error('No fields were changed.');
    err.status = 400;
    throw err;
  }
  const storedBefore = {};
  const storedAfter = {};
  for (const key of Object.keys(payload)) {
    storedBefore[key] = existing[key] == null ? null : existing[key];
    storedAfter[key] = payload[key];
  }

  const fieldCheck = api.validateFormPayload(formKey, payload);
  if (!fieldCheck.ok) {
    const err = new Error(fieldCheck.message);
    err.status = 400;
    throw err;
  }
  const dup = await api.hasDuplicateOperationRow(pool, config.table, config.pattern, payload, {
    autoTime: config.autoTime,
    tsCol: config.tsCol,
    excludeRecordKey: recordKey,
  });
  if (dup) {
    const err = new Error(api.DUPLICATE_OPERATION_MSG);
    err.status = 409;
    throw err;
  }

  const [[open]] = await pool.query(
    `SELECT id FROM form_edit_requests
      WHERE form_key = ? AND record_key = ? AND status = 'pending'
      LIMIT 1`,
    [formKey, storedKey],
  );
  if (open) {
    const err = new Error('An edit request is already pending for this row.');
    err.status = 409;
    throw err;
  }

  const names = await lookupFormNames(formKey);
  const [result] = await pool.execute(
    `INSERT INTO form_edit_requests
       (user_id, form_key, record_key, app_id, app_name, form_name, before_json, after_json, comment, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      user.id,
      formKey,
      storedKey,
      names.appId,
      names.appName,
      names.formName,
      JSON.stringify(storedBefore),
      JSON.stringify(storedAfter),
      note,
    ],
  );
  await notifyAdmins(result.insertId, names);
  return { id: result.insertId };
}

function mapRequest(row) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || '',
    email: row.email || '',
    department: row.department || '',
    formKey: row.form_key,
    recordKey: row.record_key,
    appId: row.app_id,
    appName: row.app_name || '',
    formName: row.form_name || '',
    before: parseJson(row.before_json),
    after: parseJson(row.after_json),
    comment: row.comment || '',
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

const LIST_SQL = `
  SELECT r.*, u.name AS user_name, u.email, u.department
    FROM form_edit_requests r
    JOIN users u ON u.id = r.user_id
`;

async function listEditRequests(status) {
  const where = status ? 'WHERE r.status = ?' : '';
  const params = status ? [status] : [];
  const [rows] = await pool.query(
    `${LIST_SQL} ${where} ORDER BY r.created_at DESC LIMIT 200`,
    params,
  );
  return rows.map(mapRequest);
}

async function countPending() {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS total FROM form_edit_requests WHERE status = 'pending'`,
  );
  return Number(row?.total || 0);
}

async function loadRequest(id) {
  const [[row]] = await pool.query(
    `${LIST_SQL} WHERE r.id = ? LIMIT 1`,
    [id],
  );
  return row || null;
}

async function approveEditRequest(id, reviewer) {
  const row = await loadRequest(id);
  if (!row) {
    const err = new Error('Edit request not found.');
    err.status = 404;
    throw err;
  }
  if (row.status !== 'pending') {
    const err = new Error('This request is already decided.');
    err.status = 409;
    throw err;
  }
  const after = parseJson(row.after_json);
  await formApi().applySavedRecordUpdate(row.form_key, row.record_key, after);
  await pool.execute(
    `UPDATE form_edit_requests
        SET status = 'approved', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'`,
    [reviewer.id, id],
  );
  await notifyRequester(row, { approved: true });
  return { id };
}

async function rejectEditRequest(id, reviewer) {
  const row = await loadRequest(id);
  if (!row) {
    const err = new Error('Edit request not found.');
    err.status = 404;
    throw err;
  }
  if (row.status !== 'pending') {
    const err = new Error('This request is already decided.');
    err.status = 409;
    throw err;
  }
  await pool.execute(
    `UPDATE form_edit_requests
        SET status = 'rejected', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'pending'`,
    [reviewer.id, id],
  );
  await notifyRequester(row, { approved: false });
  return { id };
}

async function attachPendingFlags(formKey, config, records) {
  if (!records?.length) return records;
  let rows = [];
  try {
    const [found] = await pool.query(
      `SELECT id, record_key FROM form_edit_requests
        WHERE form_key = ? AND status = 'pending'`,
      [formKey],
    );
    rows = found;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return records;
    throw err;
  }
  if (!rows.length) return records;
  const byKey = new Map(rows.map((row) => [row.record_key, row.id]));
  const api = formApi();
  return records.map((record) => {
    if (record.pendingRequestId) return record;
    const key = api.normalizeRecordTimestamp(record[config.tsCol]);
    const editRequestId = byKey.get(key);
    if (!editRequestId) return record;
    return { ...record, editRequestId };
  });
}

async function focusPageForRecord(config, recordKey, { limit, virtualCount }) {
  const ts = formApi().normalizeRecordTimestamp(decodeURIComponent(recordKey));
  if (!ts) return null;
  const [[{ older }]] = await pool.query(
    `SELECT COUNT(*) AS older FROM \`${config.table}\` WHERE \`${config.tsCol}\` > ?`,
    [ts],
  );
  const index = Number(virtualCount || 0) + Number(older || 0);
  return Math.floor(index / limit) + 1;
}

module.exports = {
  createEditRequest,
  listEditRequests,
  countPending,
  approveEditRequest,
  rejectEditRequest,
  attachPendingFlags,
  focusPageForRecord,
  isEditRequestFlowEnabled,
  setEditRequestFlowEnabled,
};
