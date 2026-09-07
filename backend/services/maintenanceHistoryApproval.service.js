const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/mysql');
const { validHistoryImageField } = require('../utils/historyImages');
const {
  MAX_HISTORY_DOCUMENTS,
  historyDocumentStorageKey,
  historyDocumentDir,
  parseHistoryDocuments,
  parseHistoryDocumentsFromBody,
  serializeHistoryDocumentsColumn,
  unlinkRemovedHistoryDocuments,
  historyDocumentsRemoved,
  HISTORY_DOCUMENTS_ROOT,
  extensionForUpload,
} = require('../utils/historyDocuments');
const {
  sendMaintenanceHistoryDigestEmail,
  sendMaintenanceHistoryRejectedEmail,
  sendMaintenanceHistoryApprovedEmail,
} = require('./email.service');

const DIGEST_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_DIGEST_TIME = '22:00';

const SETTINGS_KEYS = {
  sugar: {
    enabled: 'mh_approval_sugar_enabled',
    hodUserId: 'mh_approval_sugar_hod_user_id',
    digestTime: 'mh_approval_sugar_digest_time',
    digestLastSentDate: 'mh_approval_sugar_digest_last_sent_date',
  },
  power: {
    enabled: 'mh_approval_power_enabled',
    hodUserId: 'mh_approval_power_hod_user_id',
    digestTime: 'mh_approval_power_digest_time',
    digestLastSentDate: 'mh_approval_power_digest_last_sent_date',
  },
};

const DOMAIN_TABLES = {
  sugar: { equipment: 'shn_equipment', history: 'shn_history', label: 'Sugar House' },
  power: { equipment: 'ppn_equipment', history: 'ppn_history', label: 'Power Plant' },
};

const TOKEN_TTL_DAYS = 7;

const FIELD_LABELS = {
  season: 'Season',
  year: 'Year',
  date_start: 'Date of Start',
  date_finish: 'Date of Finish',
  obs: 'Observation',
  act: 'Action Taken',
  cost: 'Repair Cost',
  svc: 'Service',
  maintenance_type: 'Maintenance Type',
  provider: 'Provider',
  resp: 'Responsible',
  rem: 'Remarks',
  section: 'Section',
  sub_section: 'Equipment',
  equipment_refs: 'Equipment mapping',
};

function parseBool(v) {
  return v === '1' || v === 'true' || v === true;
}

function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeEquipmentRef(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const section = String(raw.section || '').trim();
  const sub_section = String(raw.sub_section || raw.subSection || '').trim();
  if (!section || !sub_section) return null;
  return { section, sub_section };
}

function parseEquipmentRefsFromPayload(payload = {}) {
  if (Array.isArray(payload.equipment_refs)) {
    return payload.equipment_refs.map(normalizeEquipmentRef).filter(Boolean);
  }
  const section = String(payload.section || '').trim();
  const sub_section = String(payload.sub_section || payload.subSection || '').trim();
  if (section && sub_section) return [{ section, sub_section }];
  return [];
}

function serializeEquipmentRefsColumn(refs = []) {
  if (!refs.length) return null;
  return JSON.stringify(refs);
}

function formatEquipmentRefs(refs) {
  if (!refs?.length) return '';
  return refs.map((r) => `${r.section} / ${r.sub_section}`).join(', ');
}

function displayValue(key, value) {
  if (value == null || value === '') return '—';
  if (key === 'equipment_refs') {
    const refs = Array.isArray(value) ? value : parseEquipmentRefsFromPayload({ equipment_refs: value });
    return formatEquipmentRefs(refs) || '—';
  }
  if (key === 'img_before' || key === 'img_after') {
    const s = String(value || '');
    if (s.startsWith('data:image') || s.startsWith('[')) return '(photo attached)';
    return '—';
  }
  if (key === 'documents') {
    const docs = parseHistoryDocuments(value);
    return docs.length ? `(${docs.length} document(s))` : '—';
  }
  if (key === 'date_start' || key === 'date_finish') {
    return String(value).slice(0, 10) || '—';
  }
  return String(value);
}

function snapshotFromRow(row) {
  if (!row) return null;
  let equipment_refs = row.equipment_refs;
  if (typeof equipment_refs === 'string') {
    equipment_refs = parseJson(equipment_refs, []);
  }
  return {
    season: row.season,
    year: row.year,
    date_start: row.date_start,
    date_finish: row.date_finish,
    obs: row.obs,
    act: row.act,
    cost: row.cost,
    svc: row.svc,
    maintenance_type: row.maintenance_type,
    provider: row.provider,
    resp: row.resp,
    rem: row.rem,
    section: row.section,
    sub_section: row.sub_section,
    equipment_refs,
    img_before: row.img_before,
    img_after: row.img_after,
    documents: row.documents,
  };
}

function buildFieldDiff(action, previous, payload) {
  const keys = Object.keys(FIELD_LABELS);
  const rows = [];

  if (action === 'create') {
    for (const key of keys) {
      const val = payload?.[key];
      if (val == null || val === '') continue;
      if ((key === 'img_before' || key === 'img_after') && !String(val).startsWith('data:image')) continue;
      rows.push({ label: FIELD_LABELS[key], oldValue: '—', newValue: displayValue(key, val) });
    }
    return rows;
  }

  if (action === 'delete') {
    for (const key of keys) {
      const val = previous?.[key];
      if (val == null || val === '') continue;
      rows.push({ label: FIELD_LABELS[key], oldValue: displayValue(key, val), newValue: '—' });
    }
    return rows;
  }

  for (const key of keys) {
    const oldVal = displayValue(key, previous?.[key]);
    const newVal = displayValue(key, payload?.[key]);
    if (oldVal === newVal) continue;
    rows.push({ label: FIELD_LABELS[key], oldValue: oldVal, newValue: newVal });
  }
  return rows;
}

function normalizeDigestTime(value) {
  const raw = String(value || DEFAULT_DIGEST_TIME).trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(raw);
  if (!match) return null;
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
}

function validateDigestTime(value) {
  return normalizeDigestTime(value) != null;
}

/** Reliable 24h IST clock (sv-SE). en-GB + hour12:false can stay 12-hour on Windows Node. */
function getIstDateParts(date = new Date()) {
  const raw = date.toLocaleString('sv-SE', { timeZone: DIGEST_TIMEZONE });
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(raw);
  if (!match) {
    return { date: '', time: '' };
  }
  return {
    date: match[1],
    time: `${match[2]}:${match[3]}`,
  };
}

function timeToMinutes(hhmm) {
  const normalized = normalizeDigestTime(hhmm);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
}

function equipmentNameFromRequest(request) {
  try {
    const ctx = typeof request.equipment_context_json === 'string'
      ? JSON.parse(request.equipment_context_json)
      : request.equipment_context_json;
    return ctx?.name || ctx?.equip_no || ctx?.tag_name || 'Equipment';
  } catch {
    return 'Equipment';
  }
}

async function setPortalSetting(key, value) {
  await pool.execute(
    `INSERT INTO portal_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value],
  );
}

function actionLabel(action) {
  if (action === 'create') return 'Created';
  if (action === 'update') return 'Updated';
  if (action === 'delete') return 'Deleted';
  return action;
}

async function readPortalSettings(keys) {
  if (!keys.length) return {};
  const placeholders = keys.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM portal_settings WHERE setting_key IN (${placeholders})`,
    keys,
  );
  const map = {};
  rows.forEach((r) => { map[r.setting_key] = r.setting_value; });
  return map;
}

async function getApprovalSettings() {
  const keys = Object.values(SETTINGS_KEYS).flatMap((k) => [
    k.enabled,
    k.hodUserId,
    k.digestTime,
    k.digestLastSentDate,
  ]);
  const map = await readPortalSettings(keys);
  return {
    sugar: {
      enabled: parseBool(map[SETTINGS_KEYS.sugar.enabled]),
      hodUserId: map[SETTINGS_KEYS.sugar.hodUserId] ? Number(map[SETTINGS_KEYS.sugar.hodUserId]) : null,
      digestTime: normalizeDigestTime(map[SETTINGS_KEYS.sugar.digestTime]) || DEFAULT_DIGEST_TIME,
      digestLastSentDate: map[SETTINGS_KEYS.sugar.digestLastSentDate] || '',
    },
    power: {
      enabled: parseBool(map[SETTINGS_KEYS.power.enabled]),
      hodUserId: map[SETTINGS_KEYS.power.hodUserId] ? Number(map[SETTINGS_KEYS.power.hodUserId]) : null,
      digestTime: normalizeDigestTime(map[SETTINGS_KEYS.power.digestTime]) || DEFAULT_DIGEST_TIME,
      digestLastSentDate: map[SETTINGS_KEYS.power.digestLastSentDate] || '',
    },
  };
}

async function updateApprovalSettings(body) {
  const sugarDigestTime = normalizeDigestTime(body.sugar?.digestTime) || DEFAULT_DIGEST_TIME;
  const powerDigestTime = normalizeDigestTime(body.power?.digestTime) || DEFAULT_DIGEST_TIME;
  const updates = [
    [SETTINGS_KEYS.sugar.enabled, body.sugar?.enabled ? '1' : '0'],
    [SETTINGS_KEYS.power.enabled, body.power?.enabled ? '1' : '0'],
    [SETTINGS_KEYS.sugar.hodUserId, body.sugar?.hodUserId ? String(body.sugar.hodUserId) : ''],
    [SETTINGS_KEYS.power.hodUserId, body.power?.hodUserId ? String(body.power.hodUserId) : ''],
    [SETTINGS_KEYS.sugar.digestTime, sugarDigestTime],
    [SETTINGS_KEYS.power.digestTime, powerDigestTime],
  ];
  for (const [key, value] of updates) {
    await setPortalSetting(key, value);
  }
  return getApprovalSettings();
}

async function isApprovalEnabled(domain) {
  const settings = await getApprovalSettings();
  return Boolean(settings[domain]?.enabled);
}

async function resolveHodUser(domain) {
  const settings = await getApprovalSettings();
  const hodUserId = settings[domain]?.hodUserId;
  if (!hodUserId) {
    const err = new Error('HOD is not configured. Ask an admin to set the HOD in Config → Maintenance History Approval.');
    err.status = 400;
    throw err;
  }
  const [[user]] = await pool.query(
    'SELECT id, name, email FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
    [hodUserId],
  );
  if (!user?.email) {
    const err = new Error('Configured HOD user is inactive or has no email.');
    err.status = 400;
    throw err;
  }
  return user;
}

function approvalStagingDir(requestId) {
  return path.join(HISTORY_DOCUMENTS_ROOT, 'approval', String(requestId));
}

function listStagedDocuments(requestId) {
  const dir = approvalStagingDir(requestId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((filename) => !filename.endsWith('.meta.json'))
    .map((filename) => {
      const metaPath = path.join(dir, `${filename}.meta.json`);
      let meta = {};
      if (fs.existsSync(metaPath)) {
        try {
          meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch {
          meta = {};
        }
      }
      const abs = path.join(dir, filename);
      const stat = fs.statSync(abs);
      return {
        filename,
        absPath: abs,
        displayName: meta.displayName || filename,
        originalName: meta.originalName || filename,
        mimeType: meta.mimeType || 'application/octet-stream',
        size: stat.size,
      };
    });
}

function cleanupStagingDir(requestId) {
  const dir = approvalStagingDir(requestId);
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

async function moveStagedDocumentsToHistory(domain, equipId, historyId, requestId) {
  const staged = listStagedDocuments(requestId);
  if (!staged.length) return [];

  const { history: histTable } = DOMAIN_TABLES[domain];
  const destDir = historyDocumentDir(histTable, equipId, historyId);
  fs.mkdirSync(destDir, { recursive: true });

  const docs = [];
  for (const file of staged.slice(0, MAX_HISTORY_DOCUMENTS)) {
    const ext = path.extname(file.filename) || extensionForUpload(file.mimeType, file.originalName) || '.bin';
    const destName = `${crypto.randomUUID()}${ext}`;
    const destAbs = path.join(destDir, destName);
    fs.renameSync(file.absPath, destAbs);
    const metaPath = path.join(approvalStagingDir(requestId), `${file.filename}.meta.json`);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);

    docs.push({
      storageKey: historyDocumentStorageKey(histTable, equipId, historyId, destName),
      displayName: file.displayName,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
    });
  }
  cleanupStagingDir(requestId);
  return docs;
}

async function applyHistoryCreate(domain, equipId, payload) {
  const { history: HIST } = DOMAIN_TABLES[domain];
  const equipmentRefs = parseEquipmentRefsFromPayload(payload);
  if (!equipmentRefs.length) {
    throw new Error('At least one equipment mapping is required.');
  }

  const parsedDocuments = parseHistoryDocumentsFromBody(payload.documents, null);
  if (parsedDocuments === null) {
    throw new Error(`Invalid documents (max ${MAX_HISTORY_DOCUMENTS} files).`);
  }

  const cols = ['equip_id', 'section', 'sub_section', 'equipment_refs'];
  const placeholders = ['?', '?', '?', '?'];
  const values = [
    equipId,
    equipmentRefs[0].section,
    equipmentRefs[0].sub_section,
    serializeEquipmentRefsColumn(equipmentRefs),
  ];

  cols.push(
    'season', 'year', 'date_start', 'date_finish', 'obs', 'act', 'cost', 'svc',
    'maintenance_type', 'provider', 'resp', 'rem', 'img_before', 'img_after', 'documents',
  );
  placeholders.push('?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?');
  values.push(
    payload.season || null,
    payload.year || null,
    payload.date_start || null,
    payload.date_finish || null,
    payload.obs || null,
    payload.act || null,
    payload.cost || null,
    payload.svc || null,
    payload.maintenance_type || null,
    payload.provider || null,
    payload.resp || null,
    payload.rem || null,
    validHistoryImageField(payload.img_before),
    validHistoryImageField(payload.img_after),
    serializeHistoryDocumentsColumn(parsedDocuments),
  );

  const [result] = await pool.execute(
    `INSERT INTO \`${HIST}\` (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
    values,
  );
  return result.insertId;
}

async function applyHistoryUpdate(domain, equipId, historyId, payload) {
  const { history: HIST } = DOMAIN_TABLES[domain];
  const [[existingRow]] = await pool.execute(
    `SELECT * FROM \`${HIST}\` WHERE id=? AND equip_id=? LIMIT 1`,
    [historyId, equipId],
  );
  if (!existingRow) throw new Error('Record not found.');

  const parsedDocuments = parseHistoryDocumentsFromBody(payload.documents, existingRow.documents);
  if (parsedDocuments === null) {
    throw new Error(`Invalid documents (max ${MAX_HISTORY_DOCUMENTS} files).`);
  }
  unlinkRemovedHistoryDocuments(
    historyDocumentsRemoved(existingRow.documents, parsedDocuments),
  );

  const equipmentRefs = parseEquipmentRefsFromPayload(payload);
  if (!equipmentRefs.length) {
    throw new Error('At least one equipment mapping is required.');
  }

  await pool.execute(
    `UPDATE \`${HIST}\`
     SET section=?, sub_section=?, equipment_refs=?,
         season=?, year=?, date_start=?, date_finish=?,
         obs=?, act=?, cost=?, svc=?, maintenance_type=?, provider=?, resp=?, rem=?,
         img_before=?, img_after=?, documents=?
     WHERE id=? AND equip_id=?`,
    [
      equipmentRefs[0].section,
      equipmentRefs[0].sub_section,
      serializeEquipmentRefsColumn(equipmentRefs),
      payload.season || null,
      payload.year || null,
      payload.date_start || null,
      payload.date_finish || null,
      payload.obs || null,
      payload.act || null,
      payload.cost || null,
      payload.svc || null,
      payload.maintenance_type || null,
      payload.provider || null,
      payload.resp || null,
      payload.rem || null,
      validHistoryImageField(payload.img_before),
      validHistoryImageField(payload.img_after),
      serializeHistoryDocumentsColumn(parsedDocuments),
      historyId,
      equipId,
    ],
  );
  return historyId;
}

async function applyHistoryDelete(domain, equipId, historyId) {
  const { history: HIST } = DOMAIN_TABLES[domain];
  const [[existingRow]] = await pool.execute(
    `SELECT documents FROM \`${HIST}\` WHERE id=? AND equip_id=? LIMIT 1`,
    [historyId, equipId],
  );
  if (!existingRow) throw new Error('Record not found.');
  unlinkRemovedHistoryDocuments(parseHistoryDocuments(existingRow.documents));

  const [result] = await pool.execute(
    `DELETE FROM \`${HIST}\` WHERE id=? AND equip_id=?`,
    [historyId, equipId],
  );
  if (result.affectedRows === 0) throw new Error('Record not found.');
}

async function mergeStagedDocumentsIntoPayload(domain, equipId, historyId, requestId, payload) {
  const stagedDocs = await moveStagedDocumentsToHistory(domain, equipId, historyId, requestId);
  if (!stagedDocs.length) return payload;

  const existing = parseHistoryDocuments(payload.documents);
  const merged = [...existing, ...stagedDocs].slice(0, MAX_HISTORY_DOCUMENTS);
  return { ...payload, documents: merged };
}

async function applyPendingRequest(request) {
  const domain = request.domain;
  const equipId = request.equip_id;
  const payload = parseJson(request.payload_json, {});
  const historyId = request.history_id;

  if (request.action === 'create') {
    const insertId = await applyHistoryCreate(domain, equipId, payload);
    const withDocs = await mergeStagedDocumentsIntoPayload(domain, equipId, insertId, request.id, payload);
    if (withDocs.documents !== payload.documents) {
      await applyHistoryUpdate(domain, equipId, insertId, withDocs);
    }
    return insertId;
  }

  if (request.action === 'update') {
    const withDocs = await mergeStagedDocumentsIntoPayload(domain, equipId, historyId, request.id, payload);
    await applyHistoryUpdate(domain, equipId, historyId, withDocs);
    return historyId;
  }

  if (request.action === 'delete') {
    await applyHistoryDelete(domain, equipId, historyId);
    cleanupStagingDir(request.id);
    return null;
  }

  throw new Error('Unknown action.');
}

async function getRequestByToken(token, type) {
  const col = type === 'accept' ? 'token_accept' : 'token_reject';
  const [[row]] = await pool.query(
    `SELECT * FROM maintenance_history_approval_request WHERE ${col} = ? LIMIT 1`,
    [token],
  );
  return row || null;
}

function imageSources(value) {
  if (value == null || value === '') return [];
  const list = Array.isArray(value) ? value : [value];
  return list
    .map((item) => String(item || '').trim())
    .filter((src) => src.startsWith('data:image') || src.startsWith('http://') || src.startsWith('https://'));
}

async function getReviewByToken(token) {
  let request = await getRequestByToken(token, 'accept');
  if (!request) {
    const err = new Error('Invalid review link.');
    err.status = 404;
    throw err;
  }
  request = await markExpiredIfNeeded(request);

  const payload = parseJson(request.payload_json, {});
  const previous = parseJson(request.previous_json, null);
  const photoSource = request.action === 'delete' ? previous : payload;

  return {
    status: request.status,
    alreadyResolved: request.status !== 'pending',
    request,
    equipmentName: equipmentNameFromRequest(request),
    domain: request.domain,
    domainLabel: DOMAIN_TABLES[request.domain]?.label || '',
    action: request.action,
    actionLabel: actionLabel(request.action),
    submitterName: request.requested_by_name || 'A user',
    submitterEmail: request.requested_by_email || '',
    diff: buildFieldDiff(request.action, previous, payload),
    acceptToken: request.token_accept,
    rejectToken: request.token_reject,
    tokenExpiresAt: request.token_expires_at || null,
    resolvedAt: request.resolved_at || null,
    photosBefore: imageSources(photoSource?.img_before),
    photosAfter: imageSources(photoSource?.img_after),
  };
}

async function getInboxByToken(token) {
  const review = await getReviewByToken(token);
  const [rows] = await pool.query(
    `SELECT * FROM maintenance_history_approval_request
     WHERE domain = ? AND hod_email = ? AND status = 'pending'
     ORDER BY created_at ASC, id ASC`,
    [review.request.domain, review.request.hod_email],
  );
  return {
    status: review.status,
    alreadyResolved: review.alreadyResolved && !rows.length,
    domain: review.domain,
    domainLabel: review.domainLabel,
    hodEmail: review.request.hod_email,
    entries: rows.map(buildDigestEntry),
  };
}

async function markExpiredIfNeeded(request) {
  if (request.status !== 'pending') return request;
  if (new Date(request.token_expires_at) >= new Date()) return request;
  await pool.execute(
    `UPDATE maintenance_history_approval_request SET status = 'expired', resolved_at = NOW() WHERE id = ?`,
    [request.id],
  );
  return { ...request, status: 'expired' };
}

async function createPendingRequest({
  domain,
  action,
  equipId,
  historyId,
  payload,
  previousRow,
  reqUser,
  equipment,
}) {
  const hod = await resolveHodUser(domain);
  const tokenAccept = crypto.randomBytes(32).toString('hex');
  const tokenReject = crypto.randomBytes(32).toString('hex');
  const expires = new Date();
  expires.setDate(expires.getDate() + TOKEN_TTL_DAYS);

  const equipmentContext = {
    name: equipment?.name || '',
    equip_no: equipment?.equip_no || equipment?.tag_name || '',
    tag_name: equipment?.tag_name || '',
    dept: equipment?.dept || '',
  };

  const previousSnapshot = previousRow ? snapshotFromRow(previousRow) : null;

  const [result] = await pool.execute(
    `INSERT INTO maintenance_history_approval_request
       (domain, action, equip_id, history_id, payload_json, previous_json, equipment_context_json,
        requested_by_user_id, requested_by_email, requested_by_name, hod_user_id, hod_email,
        status, token_accept, token_reject, token_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      domain,
      action,
      equipId,
      historyId || null,
      JSON.stringify(payload || {}),
      previousSnapshot ? JSON.stringify(previousSnapshot) : null,
      JSON.stringify(equipmentContext),
      reqUser?.id || null,
      reqUser?.email || null,
      reqUser?.name || null,
      hod.id,
      hod.email,
      tokenAccept,
      tokenReject,
      expires,
    ],
  );

  return { id: result.insertId, tokenAccept, tokenReject };
}

async function fetchPendingForDigest(domain, _istDate) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM maintenance_history_approval_request
       WHERE domain = ?
         AND status = 'pending'
         AND hod_notified_at IS NULL
       ORDER BY created_at ASC, id ASC`,
      [domain],
    );
    return rows;
  } catch (err) {
    if (String(err.message || '').includes('hod_notified_at')) {
      const wrap = new Error(
        'Digest column missing. Apply mysql/migrate_maintenance_history_approval_digest.sql and restart the backend.',
      );
      wrap.status = 500;
      throw wrap;
    }
    throw err;
  }
}

async function ensureDigestSchema() {
  const [[col]] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'maintenance_history_approval_request'
       AND COLUMN_NAME = 'hod_notified_at'`,
  );
  if (!Number(col?.n)) {
    await pool.execute(
      `ALTER TABLE maintenance_history_approval_request
       ADD COLUMN hod_notified_at DATETIME NULL DEFAULT NULL`,
    );
    console.log('[maintenanceHistoryApproval] added hod_notified_at column');
  }

  const keys = [
    [SETTINGS_KEYS.sugar.digestTime, DEFAULT_DIGEST_TIME],
    [SETTINGS_KEYS.power.digestTime, DEFAULT_DIGEST_TIME],
    [SETTINGS_KEYS.sugar.digestLastSentDate, ''],
    [SETTINGS_KEYS.power.digestLastSentDate, ''],
  ];
  for (const [key, value] of keys) {
    await pool.execute(
      `INSERT INTO portal_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_key = setting_key`,
      [key, value],
    );
  }
}

async function countNotifiedOnIstDate(domain, istDate) {
  try {
    const [rows] = await pool.query(
      `SELECT hod_notified_at FROM maintenance_history_approval_request
       WHERE domain = ? AND hod_notified_at IS NOT NULL`,
      [domain],
    );
    return rows.filter((row) => getIstDateParts(new Date(row.hod_notified_at)).date === istDate).length;
  } catch (err) {
    if (String(err.message || '').includes('hod_notified_at')) {
      const wrap = new Error(
        'Digest column missing. Apply mysql/migrate_maintenance_history_approval_digest.sql and restart the backend.',
      );
      wrap.status = 500;
      throw wrap;
    }
    throw err;
  }
}

function buildDigestEntry(request) {
  const payload = parseJson(request.payload_json, {});
  const previous = parseJson(request.previous_json, null);
  const diff = buildFieldDiff(request.action, previous, payload);
  return {
    id: request.id,
    equipmentName: equipmentNameFromRequest(request),
    actionLabel: actionLabel(request.action),
    submitterName: request.requested_by_name || 'A user',
    submitterEmail: request.requested_by_email || '',
    diff,
    acceptToken: request.token_accept,
    rejectToken: request.token_reject,
  };
}

async function sendDigestForDomain(domain) {
  const settings = await getApprovalSettings();
  const domainSettings = settings[domain];
  if (!domainSettings?.enabled) {
    return { sent: false, reason: 'disabled' };
  }

  const ist = getIstDateParts();
  const pendingRows = await fetchPendingForDigest(domain, ist.date);

  if (pendingRows.length === 0) {
    return { sent: false, count: 0, reason: 'empty' };
  }

  const hod = await resolveHodUser(domain);
  const entries = pendingRows.map(buildDigestEntry);
  await sendMaintenanceHistoryDigestEmail({
    to: hod.email,
    hodName: hod.name,
    domainLabel: DOMAIN_TABLES[domain].label,
    digestDate: ist.date,
    entries,
  });

  const ids = pendingRows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  await pool.execute(
    `UPDATE maintenance_history_approval_request
     SET hod_notified_at = NOW()
     WHERE id IN (${placeholders})`,
    ids,
  );

  await setPortalSetting(SETTINGS_KEYS[domain].digestLastSentDate, ist.date);
  return { sent: true, count: pendingRows.length };
}

async function runDigestSchedulerTick() {
  const settings = await getApprovalSettings();
  const ist = getIstDateParts();
  const nowMinutes = timeToMinutes(ist.time);
  if (nowMinutes == null) {
    console.error('[maintenanceHistoryApproval] digest tick skipped: could not parse IST time', ist);
    return;
  }

  for (const domain of ['sugar', 'power']) {
    const domainSettings = settings[domain];
    if (!domainSettings?.enabled) continue;

    const digestMinutes = timeToMinutes(domainSettings.digestTime);
    if (digestMinutes == null) continue;

    try {
      const pending = await fetchPendingForDigest(domain, ist.date);
      if (!pending.length) continue;

      if (nowMinutes < digestMinutes) {
        console.log(
          `[maintenanceHistoryApproval] ${pending.length} pending ${domain} item(s); waiting until ${domainSettings.digestTime} IST (now ${ist.time})`,
        );
        continue;
      }

      const result = await sendDigestForDomain(domain);
      if (result.sent) {
        console.log(`[maintenanceHistoryApproval] digest sent for ${domain}: ${result.count} item(s) to HOD`);
      }
    } catch (err) {
      console.error(`[maintenanceHistoryApproval] digest failed for ${domain}:`, err.message);
    }
  }
}

async function approveByToken(token) {
  let request = await getRequestByToken(token, 'accept');
  if (!request) {
    const err = new Error('Invalid approval link.');
    err.status = 404;
    throw err;
  }
  request = await markExpiredIfNeeded(request);

  if (request.status === 'approved') {
    return { alreadyResolved: true, status: 'approved', request };
  }
  if (request.status !== 'pending') {
    const err = new Error(`This request was already ${request.status}.`);
    err.status = 409;
    throw err;
  }

  await applyPendingRequest(request);

  await pool.execute(
    `UPDATE maintenance_history_approval_request
     SET status = 'approved', resolved_at = NOW(), resolved_by = ?
     WHERE id = ?`,
    [request.hod_email, request.id],
  );

  if (request.requested_by_email) {
    try {
      const ctx = parseJson(request.equipment_context_json, {});
      await sendMaintenanceHistoryApprovedEmail({
        to: request.requested_by_email,
        submitterName: request.requested_by_name || 'User',
        domainLabel: DOMAIN_TABLES[request.domain].label,
        equipmentName: ctx.name || ctx.equip_no || 'Equipment',
        actionLabel: actionLabel(request.action),
      });
    } catch (err) {
      console.error('[maintenanceHistoryApproval] approved notify failed:', err.message);
    }
  }

  return { alreadyResolved: false, status: 'approved', request };
}

async function rejectByToken(token) {
  let request = await getRequestByToken(token, 'reject');
  if (!request) {
    const err = new Error('Invalid rejection link.');
    err.status = 404;
    throw err;
  }
  request = await markExpiredIfNeeded(request);

  if (request.status === 'rejected') {
    return { alreadyResolved: true, status: 'rejected', request };
  }
  if (request.status !== 'pending') {
    const err = new Error(`This request was already ${request.status}.`);
    err.status = 409;
    throw err;
  }

  cleanupStagingDir(request.id);

  await pool.execute(
    `UPDATE maintenance_history_approval_request
     SET status = 'rejected', resolved_at = NOW(), resolved_by = ?
     WHERE id = ?`,
    [request.hod_email, request.id],
  );

  if (request.requested_by_email) {
    try {
      const ctx = parseJson(request.equipment_context_json, {});
      await sendMaintenanceHistoryRejectedEmail({
        to: request.requested_by_email,
        submitterName: request.requested_by_name || 'User',
        domainLabel: DOMAIN_TABLES[request.domain].label,
        equipmentName: ctx.name || ctx.equip_no || 'Equipment',
        actionLabel: actionLabel(request.action),
      });
    } catch (err) {
      console.error('[maintenanceHistoryApproval] reject notify failed:', err.message);
    }
  }

  return { alreadyResolved: false, status: 'rejected', request };
}

async function assertPendingRequestForUser(requestId, equipId, domain, userId) {
  const [[row]] = await pool.query(
    `SELECT * FROM maintenance_history_approval_request
     WHERE id = ? AND equip_id = ? AND domain = ? AND status = 'pending' LIMIT 1`,
    [requestId, equipId, domain],
  );
  if (!row) {
    const err = new Error('Approval request not found or no longer pending.');
    err.status = 404;
    throw err;
  }
  if (userId && row.requested_by_user_id && row.requested_by_user_id !== userId) {
    const err = new Error('Not allowed to upload documents for this request.');
    err.status = 403;
    throw err;
  }
  return row;
}

module.exports = {
  DOMAIN_TABLES,
  SETTINGS_KEYS,
  getApprovalSettings,
  updateApprovalSettings,
  isApprovalEnabled,
  resolveHodUser,
  createPendingRequest,
  getReviewByToken,
  getInboxByToken,
  approveByToken,
  rejectByToken,
  fetchPendingForDigest,
  sendDigestForDomain,
  runDigestSchedulerTick,
  ensureDigestSchema,
  validateDigestTime,
  normalizeDigestTime,
  buildFieldDiff,
  actionLabel,
  snapshotFromRow,
  approvalStagingDir,
  listStagedDocuments,
  assertPendingRequestForUser,
  cleanupStagingDir,
};
