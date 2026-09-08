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
  resolveHistoryDocumentAbsPath,
} = require('../utils/historyDocuments');
const {
  sendMaintenanceHistoryDigestEmail,
  sendMaintenanceHistoryApprovedEmail,
  sendMaintenanceHistoryModificationEmail,
} = require('./email.service');
const { createUserNotification } = require('./userNotification.service');
const { CLIENT_ORIGIN } = require('../config/env');

const NOTIF_REF_APPROVAL = 'maintenance_history_approval_request';
const NOTIF_TYPE_MH_APPROVED = 'mh_approved';
const NOTIF_TYPE_MH_NEEDS_MODIFICATION = 'mh_needs_modification';

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
  production: {
    enabled: 'mh_approval_production_enabled',
    hodUserId: 'mh_approval_production_hod_user_id',
    digestTime: 'mh_approval_production_digest_time',
    digestLastSentDate: 'mh_approval_production_digest_last_sent_date',
  },
};

const DOMAIN_TABLES = {
  sugar: { equipment: 'shn_equipment', history: 'shn_history', label: 'Sugar House' },
  power: { equipment: 'ppn_equipment', history: 'ppn_history', label: 'Power Plant' },
  production: { equipment: 'phn_equipment', history: 'phn_history', label: 'Production House' },
};

const APPROVAL_DOMAINS = Object.keys(DOMAIN_TABLES);

const TOKEN_TTL_DAYS = 7;

const STATUS = {
  PENDING: 'pending',
  NEEDS_MODIFICATION: 'needs_modification',
  RESUBMITTED: 'resubmitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CONFLICT: 'conflict',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

const OPERATION = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
};

const ACTIVE_QUEUE_STATUSES = [STATUS.PENDING, STATUS.RESUBMITTED];
const EMPLOYEE_VISIBLE_STATUSES = [
  STATUS.PENDING,
  STATUS.RESUBMITTED,
  STATUS.NEEDS_MODIFICATION,
  STATUS.CONFLICT,
];
const HOD_QUEUE_STATUSES = [STATUS.PENDING, STATUS.RESUBMITTED, STATUS.CONFLICT];

const AUDIT_ACTION = {
  CREATED: 'employee_created_request',
  RESUBMITTED: 'employee_resubmitted_request',
  APPROVED: 'hod_approved_request',
  SENT_FOR_MODIFICATION: 'hod_sent_for_modification',
  CONFLICT_DETECTED: 'conflict_detected',
  CONFLICT_RESOLVED_APPLY: 'conflict_resolved_apply',
  CONFLICT_RESOLVED_DISCARD: 'conflict_resolved_discard',
};

function db(conn) {
  return conn || pool;
}

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
  const settings = {};
  for (const domain of APPROVAL_DOMAINS) {
    const k = SETTINGS_KEYS[domain];
    settings[domain] = {
      enabled: parseBool(map[k.enabled]),
      hodUserId: map[k.hodUserId] ? Number(map[k.hodUserId]) : null,
      digestTime: normalizeDigestTime(map[k.digestTime]) || DEFAULT_DIGEST_TIME,
      digestLastSentDate: map[k.digestLastSentDate] || '',
    };
  }
  return settings;
}

async function updateApprovalSettings(body) {
  const current = await getApprovalSettings();
  const nextByDomain = {};
  const updates = [];
  for (const domain of APPROVAL_DOMAINS) {
    const cfg = body?.[domain] || {};
    const digestTime = normalizeDigestTime(cfg.digestTime) || DEFAULT_DIGEST_TIME;
    nextByDomain[domain] = digestTime;
    updates.push(
      [SETTINGS_KEYS[domain].enabled, cfg.enabled ? '1' : '0'],
      [SETTINGS_KEYS[domain].hodUserId, cfg.hodUserId ? String(cfg.hodUserId) : ''],
      [SETTINGS_KEYS[domain].digestTime, digestTime],
    );
  }
  for (const [key, value] of updates) {
    await setPortalSetting(key, value);
  }

  // If digest already ran today but admin moves the time to later than now (IST),
  // clear today's "sent" marker so the scheduler can send again at the new time.
  const ist = getIstDateParts();
  const nowMinutes = timeToMinutes(ist.time);
  for (const domain of APPROVAL_DOMAINS) {
    const prevTime = normalizeDigestTime(current[domain]?.digestTime) || DEFAULT_DIGEST_TIME;
    const nextTime = nextByDomain[domain];
    if (prevTime === nextTime) continue;
    if (current[domain]?.digestLastSentDate !== ist.date) continue;
    const nextMinutes = timeToMinutes(nextTime);
    if (nowMinutes == null || nextMinutes == null) continue;
    if (nextMinutes <= nowMinutes) continue;

    await setPortalSetting(SETTINGS_KEYS[domain].digestLastSentDate, '');
    console.log(
      `[maintenanceHistoryApproval] ${domain} digest time changed ${prevTime} → ${nextTime} IST `
      + `(after today's send); cleared last-sent so digest can run again at ${nextTime}`,
    );
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

async function applyHistoryCreate(domain, equipId, payload, conn) {
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

  const [result] = await db(conn).execute(
    `INSERT INTO \`${HIST}\` (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
    values,
  );
  return result.insertId;
}

async function applyHistoryUpdate(domain, equipId, historyId, payload, conn) {
  const { history: HIST } = DOMAIN_TABLES[domain];
  const [[existingRow]] = await db(conn).execute(
    `SELECT * FROM \`${HIST}\` WHERE id=? AND equip_id=? LIMIT 1`,
    [historyId, equipId],
  );
  if (!existingRow) throw new Error('Record not found.');

  const parsedDocuments = parseHistoryDocumentsFromBody(payload.documents, existingRow.documents);
  if (parsedDocuments === null) {
    throw new Error(`Invalid documents (max ${MAX_HISTORY_DOCUMENTS} files).`);
  }
  if (!conn) {
    unlinkRemovedHistoryDocuments(
      historyDocumentsRemoved(existingRow.documents, parsedDocuments),
    );
  }

  const equipmentRefs = parseEquipmentRefsFromPayload(payload);
  if (!equipmentRefs.length) {
    throw new Error('At least one equipment mapping is required.');
  }

  await db(conn).execute(
    `UPDATE \`${HIST}\`
     SET section=?, sub_section=?, equipment_refs=?,
         season=?, year=?, date_start=?, date_finish=?,
         obs=?, act=?, cost=?, svc=?, maintenance_type=?, provider=?, resp=?, rem=?,
         img_before=?, img_after=?, documents=?,
         version = IFNULL(version, 1) + 1
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

async function applyHistoryDelete(domain, equipId, historyId, conn) {
  const { history: HIST } = DOMAIN_TABLES[domain];
  const [[existingRow]] = await db(conn).execute(
    `SELECT documents FROM \`${HIST}\` WHERE id=? AND equip_id=? LIMIT 1`,
    [historyId, equipId],
  );
  if (!existingRow) throw new Error('Record not found.');
  if (!conn) {
    unlinkRemovedHistoryDocuments(parseHistoryDocuments(existingRow.documents));
  }

  const [result] = await db(conn).execute(
    `DELETE FROM \`${HIST}\` WHERE id=? AND equip_id=?`,
    [historyId, equipId],
  );
  if (result.affectedRows === 0) throw new Error('Record not found.');
  return existingRow;
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
  let list = value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        list = Array.isArray(parsed) ? parsed : [value];
      } catch {
        list = [value];
      }
    } else {
      list = [value];
    }
  } else if (!Array.isArray(value)) {
    list = [value];
  }
  return list
    .map((item) => String(item || '').trim())
    .filter((src) => src.startsWith('data:image') || src.startsWith('http://') || src.startsWith('https://'));
}

function documentViewUrl(acceptToken, source, name) {
  const params = new URLSearchParams({
    token: String(acceptToken || ''),
    source: source === 'staged' ? 'staged' : 'stored',
    name: String(name || ''),
  });
  return `/api/maintenance-approval/document?${params.toString()}`;
}

function buildReviewDocuments(request, acceptToken) {
  const payload = parseJson(request.payload_json, {});
  const previous = parseJson(request.previous_json, null);
  const docSource = request.action === 'delete' ? previous : payload;
  const stored = parseHistoryDocuments(docSource?.documents).map((doc) => {
    const name = path.basename(doc.storageKey);
    return {
      source: 'stored',
      name,
      displayName: doc.displayName,
      mimeType: doc.mimeType || 'application/octet-stream',
      size: Number(doc.size) || 0,
      url: documentViewUrl(acceptToken, 'stored', name),
    };
  });
  const staged = request.action === 'delete'
    ? []
    : listStagedDocuments(request.id).map((file) => ({
      source: 'staged',
      name: file.filename,
      displayName: file.displayName,
      mimeType: file.mimeType || 'application/octet-stream',
      size: Number(file.size) || 0,
      url: documentViewUrl(acceptToken, 'staged', file.filename),
    }));
  return [...stored, ...staged];
}

async function getDocumentForReviewToken(token, source, name) {
  const review = await getReviewByToken(token);
  const safeName = path.basename(String(name || '').replace(/\\/g, '/'));
  if (!safeName || safeName === '.' || safeName === '..') {
    const err = new Error('Invalid document name.');
    err.status = 400;
    throw err;
  }
  const src = source === 'staged' ? 'staged' : 'stored';

  if (src === 'staged') {
    const file = listStagedDocuments(review.request.id).find((f) => f.filename === safeName);
    if (!file || !fs.existsSync(file.absPath)) {
      const err = new Error('Document not found.');
      err.status = 404;
      throw err;
    }
    return {
      absPath: file.absPath,
      displayName: file.displayName || safeName,
      mimeType: file.mimeType || 'application/octet-stream',
    };
  }

  const payload = parseJson(review.request.payload_json, {});
  const previous = parseJson(review.request.previous_json, null);
  const docSource = review.request.action === 'delete' ? previous : payload;
  const document = parseHistoryDocuments(docSource?.documents)
    .find((doc) => path.basename(doc.storageKey) === safeName);
  if (!document) {
    const err = new Error('Document not found.');
    err.status = 404;
    throw err;
  }
  const absPath = resolveHistoryDocumentAbsPath(document.storageKey);
  if (!absPath || !fs.existsSync(absPath)) {
    const err = new Error('Document file not found.');
    err.status = 404;
    throw err;
  }
  return {
    absPath,
    displayName: document.displayName || safeName,
    mimeType: document.mimeType || 'application/octet-stream',
  };
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
  const acceptToken = request.token_accept;

  return {
    status: request.status,
    alreadyResolved: !ACTIVE_QUEUE_STATUSES.includes(request.status),
    tokenExpired: Boolean(request.tokenExpired),
    request,
    equipmentName: equipmentNameFromRequest(request),
    domain: request.domain,
    domainLabel: DOMAIN_TABLES[request.domain]?.label || '',
    action: request.action,
    actionLabel: actionLabel(request.action),
    submitterName: request.requested_by_name || 'A user',
    submitterEmail: request.requested_by_email || '',
    createdAt: request.created_at || null,
    diff: buildFieldDiff(request.action, previous, payload),
    hodComment: request.hod_comment || '',
    acceptToken,
    rejectToken: request.token_reject,
    tokenExpiresAt: request.token_expires_at || null,
    resolvedAt: request.resolved_at || null,
    photosBefore: imageSources(photoSource?.img_before),
    photosAfter: imageSources(photoSource?.img_after),
    documents: buildReviewDocuments(request, acceptToken),
  };
}

async function getInboxByToken(token) {
  const review = await getReviewByToken(token);
  const [rows] = await pool.query(
    `SELECT * FROM maintenance_history_approval_request
     WHERE domain = ? AND hod_email = ? AND status IN ('pending', 'resubmitted')
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
  if (!ACTIVE_QUEUE_STATUSES.includes(request.status) && request.status !== STATUS.NEEDS_MODIFICATION) {
    return request;
  }
  if (!request.token_expires_at) return request;
  if (new Date(request.token_expires_at) >= new Date()) return request;
  return { ...request, tokenExpired: true };
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

async function findActiveRequestForHistory(domain, historyId) {
  if (!historyId) return null;
  const [[row]] = await pool.query(
    `SELECT id FROM maintenance_history_approval_request
     WHERE domain = ? AND history_id = ? AND action IN ('update', 'delete')
       AND status IN ('pending', 'resubmitted')
     LIMIT 1`,
    [domain, historyId],
  );
  return row || null;
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

  if (action !== 'create' && historyId) {
    const existing = await findActiveRequestForHistory(domain, historyId);
    if (existing) {
      const err = new Error(
        'Another pending change already exists for this record. Wait for HOD review before submitting another edit or delete.',
      );
      err.status = 409;
      throw err;
    }
  }

  const tokens = newTokenPair();
  const equipmentContext = {
    name: equipment?.name || '',
    equip_no: equipment?.equip_no || equipment?.tag_name || '',
    tag_name: equipment?.tag_name || '',
    dept: equipment?.dept || '',
  };

  const previousSnapshot = previousRow ? snapshotFromRow(previousRow) : null;
  const baseVersion = action === 'create'
    ? 0
    : Number(previousRow?.version || 1);

  const [result] = await pool.execute(
    "INSERT INTO maintenance_history_approval_request "
    + "(module, entity_type, domain, action, equip_id, history_id, payload_json, previous_json, equipment_context_json, "
    + "requested_by_user_id, requested_by_email, requested_by_name, hod_user_id, hod_email, "
    + "status, base_version, token_accept, token_reject, token_expires_at) "
    + "VALUES ('maintenance', 'maintenance_history', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)",
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
      baseVersion,
      tokens.tokenAccept,
      tokens.tokenReject,
      tokens.expires,
    ],
  );

  try {
    await insertAudit({
      requestId: result.insertId,
      action: AUDIT_ACTION.CREATED,
      performedByUserId: reqUser?.id,
      performedByEmail: reqUser?.email,
      previousStatus: null,
      newStatus: STATUS.PENDING,
    });
  } catch (err) {
    console.error('[maintenanceHistoryApproval] audit create failed:', err.message);
  }

  return { id: result.insertId, tokenAccept: tokens.tokenAccept, tokenReject: tokens.tokenReject };
}

async function fetchPendingForDigest(domain, _istDate) {
  const [rows] = await pool.query(
    `SELECT * FROM maintenance_history_approval_request
     WHERE domain = ?
       AND status IN ('pending', 'resubmitted')
     ORDER BY created_at ASC, id ASC`,
    [domain],
  );
  return rows;
}

async function addColumnIfMissing(table, column, ddl) {
  const [[col]] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  if (!Number(col?.n)) {
    await pool.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${ddl}`);
    console.log(`[maintenanceHistoryApproval] added ${table}.${column}`);
  }
}

async function ensureWorkflowSchema() {
  await addColumnIfMissing(
    'maintenance_history_approval_request',
    'module',
    "`module` VARCHAR(40) NOT NULL DEFAULT 'maintenance'",
  );
  await addColumnIfMissing(
    'maintenance_history_approval_request',
    'entity_type',
    "`entity_type` VARCHAR(60) NOT NULL DEFAULT 'maintenance_history'",
  );
  await addColumnIfMissing(
    'maintenance_history_approval_request',
    'hod_comment',
    '`hod_comment` TEXT NULL DEFAULT NULL',
  );
  await addColumnIfMissing(
    'maintenance_history_approval_request',
    'reviewed_by_user_id',
    '`reviewed_by_user_id` INT NULL DEFAULT NULL',
  );
  await addColumnIfMissing(
    'maintenance_history_approval_request',
    'base_version',
    '`base_version` INT NOT NULL DEFAULT 1',
  );
  await addColumnIfMissing(
    'maintenance_history_approval_request',
    'notification_count',
    '`notification_count` INT NOT NULL DEFAULT 0',
  );
  await addColumnIfMissing('shn_history', 'version', '`version` INT NOT NULL DEFAULT 1');
  await addColumnIfMissing('ppn_history', 'version', '`version` INT NOT NULL DEFAULT 1');
  await addColumnIfMissing('phn_history', 'version', '`version` INT NOT NULL DEFAULT 1');
  await addColumnIfMissing('phn_history', 'documents', '`documents` JSON DEFAULT NULL');
  await addColumnIfMissing('phn_history', 'equipment_refs', '`equipment_refs` JSON DEFAULT NULL');

  const [[domainCol]] = await pool.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'maintenance_history_approval_request'
       AND COLUMN_NAME = 'domain'`,
  );
  const domainType = String(domainCol?.COLUMN_TYPE || '');
  if (domainType && !domainType.includes('production')) {
    await pool.execute(
      `ALTER TABLE maintenance_history_approval_request
       MODIFY COLUMN domain ENUM('sugar','power','production') NOT NULL`,
    );
    console.log('[maintenanceHistoryApproval] expanded domain enum to include production');
  }

  const [[statusCol]] = await pool.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'maintenance_history_approval_request'
       AND COLUMN_NAME = 'status'`,
  );
  const statusType = String(statusCol?.COLUMN_TYPE || '');
  if (statusType && !statusType.includes('needs_modification')) {
    await pool.execute(
      `ALTER TABLE maintenance_history_approval_request
       MODIFY COLUMN status ENUM(
         'pending','needs_modification','resubmitted','approved','rejected','conflict','cancelled','expired'
       ) NOT NULL DEFAULT 'pending'`,
    );
    console.log('[maintenanceHistoryApproval] expanded status enum');
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS maintenance_history_approval_audit (
      id INT AUTO_INCREMENT PRIMARY KEY,
      request_id INT NOT NULL,
      action VARCHAR(60) NOT NULL,
      performed_by_user_id INT DEFAULT NULL,
      performed_by_email VARCHAR(200) DEFAULT NULL,
      previous_status VARCHAR(40) DEFAULT NULL,
      new_status VARCHAR(40) DEFAULT NULL,
      comment TEXT DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_mh_audit_request (request_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

async function ensureDigestSchema() {
  await addColumnIfMissing(
    'maintenance_history_approval_request',
    'hod_notified_at',
    '`hod_notified_at` DATETIME NULL DEFAULT NULL',
  );

  const keys = [
    [SETTINGS_KEYS.sugar.digestTime, DEFAULT_DIGEST_TIME],
    [SETTINGS_KEYS.power.digestTime, DEFAULT_DIGEST_TIME],
    [SETTINGS_KEYS.production.digestTime, DEFAULT_DIGEST_TIME],
    [SETTINGS_KEYS.sugar.digestLastSentDate, ''],
    [SETTINGS_KEYS.power.digestLastSentDate, ''],
    [SETTINGS_KEYS.production.digestLastSentDate, ''],
  ];
  for (const [key, value] of keys) {
    await pool.execute(
      `INSERT INTO portal_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_key = setting_key`,
      [key, value],
    );
  }

  try {
    await ensureWorkflowSchema();
  } catch (err) {
    console.error('[maintenanceHistoryApproval] workflow schema check failed:', err.message);
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
    createdAt: request.created_at || null,
    diff,
    acceptToken: request.token_accept,
    rejectToken: request.token_reject,
  };
}

function splitDigestByIstDate(rows, istDate) {
  const previous = [];
  const today = [];
  for (const row of rows) {
    const created = getIstDateParts(new Date(row.created_at)).date;
    if (created === istDate) today.push(row);
    else previous.push(row);
  }
  return { previous, today };
}

/**
 * @param {'sugar'|'power'} domain
 * @param {{ force?: boolean, mode?: 'all'|'new' }} [options]
 *   - force: bypass "already sent today" guard (admin/HOD resend)
 *   - mode 'new': only rows never included in a digest (hod_notified_at IS NULL)
 */
async function sendDigestForDomain(domain, options = {}) {
  const force = Boolean(options.force);
  const mode = options.mode === 'new' ? 'new' : 'all';

  const settings = await getApprovalSettings();
  const domainSettings = settings[domain];
  if (!domainSettings?.enabled) {
    return { sent: false, reason: 'disabled' };
  }

  const ist = getIstDateParts();
  if (!force && domainSettings.digestLastSentDate === ist.date) {
    return { sent: false, reason: 'already-sent' };
  }

  let pendingRows = await fetchPendingForDigest(domain, ist.date);
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
    ? await fetchPendingForDigest(domain, ist.date)
    : pendingRows;
  const { previous, today } = splitDigestByIstDate(allPending, ist.date);
  const hod = await resolveHodUser(domain);

  const refreshed = [];
  for (const row of pendingRows) {
    const tokens = newTokenPair();
    await pool.execute(
      `UPDATE maintenance_history_approval_request
       SET token_accept = ?,
           token_reject = ?,
           token_expires_at = ?
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

  const entries = refreshed.map(buildDigestEntry);
  await sendMaintenanceHistoryDigestEmail({
    to: hod.email,
    hodName: hod.name,
    domainLabel: DOMAIN_TABLES[domain].label,
    digestDate: ist.date,
    entries,
    previousCount: previous.length,
    newTodayCount: today.length,
    totalCount: mode === 'new' ? pendingRows.length : allPending.length,
    mode,
  });

  const ids = pendingRows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(', ');
  await pool.execute(
    `UPDATE maintenance_history_approval_request
     SET hod_notified_at = NOW(),
         notification_count = IFNULL(notification_count, 0) + 1
     WHERE id IN (${placeholders})`,
    ids,
  );

  await setPortalSetting(SETTINGS_KEYS[domain].digestLastSentDate, ist.date);
  return { sent: true, count: pendingRows.length, mode, force };
}

async function resendDigestByToken(token, options = {}) {
  const review = await getReviewByToken(token);
  if (review.tokenExpired && ACTIVE_QUEUE_STATUSES.includes(review.status)) {
    const err = new Error(
      'This link has expired. Wait for the next daily digest email, or ask an admin to resend the digest.',
    );
    err.status = 410;
    throw err;
  }
  const domain = review.request.domain;
  if (!domain || !DOMAIN_TABLES[domain]) {
    const err = new Error('Unable to determine domain for this link.');
    err.status = 400;
    throw err;
  }
  return sendDigestForDomain(domain, {
    force: true,
    mode: options.mode === 'new' ? 'new' : 'all',
  });
}

async function bulkApproveByInboxToken(seedToken, ids) {
  const inbox = await getInboxByToken(seedToken);
  const allowed = new Map(
    (inbox.entries || []).map((entry) => [Number(entry.id), entry]),
  );

  const requestedIds = Array.isArray(ids) && ids.length
    ? ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : [...allowed.keys()];

  const results = [];
  for (const id of requestedIds) {
    const entry = allowed.get(id);
    if (!entry?.acceptToken) {
      results.push({
        id,
        ok: false,
        message: 'This item is not in your pending inbox.',
      });
      continue;
    }
    try {
      const result = await approveByToken(entry.acceptToken);
      const conflict = result.status === STATUS.CONFLICT;
      results.push({
        id,
        ok: !conflict,
        status: result.status,
        alreadyResolved: Boolean(result.alreadyResolved),
        conflict: conflict || null,
        equipmentName: equipmentNameFromRequest(result.request),
        message: conflict
          ? 'Version conflict — open Review for this row.'
          : null,
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

async function runDigestSchedulerTick() {
  const settings = await getApprovalSettings();
  const ist = getIstDateParts();
  const nowMinutes = timeToMinutes(ist.time);
  if (nowMinutes == null) {
    console.error('[maintenanceHistoryApproval] digest tick skipped: could not parse IST time', ist);
    return;
  }

  for (const domain of APPROVAL_DOMAINS) {
    const domainSettings = settings[domain];
    if (!domainSettings?.enabled) continue;

    const digestMinutes = timeToMinutes(domainSettings.digestTime);
    if (digestMinutes == null) continue;

    try {
      if (domainSettings.digestLastSentDate === ist.date) continue;

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

async function insertAudit({
  requestId,
  action,
  performedByUserId,
  performedByEmail,
  previousStatus,
  newStatus,
  comment,
  conn,
}) {
  await db(conn).execute(
    `INSERT INTO maintenance_history_approval_audit
       (request_id, action, performed_by_user_id, performed_by_email, previous_status, new_status, comment)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      requestId,
      action,
      performedByUserId || null,
      performedByEmail || null,
      previousStatus || null,
      newStatus || null,
      comment || null,
    ],
  );
}

async function getRequestById(id) {
  const [[row]] = await pool.query(
    `SELECT * FROM maintenance_history_approval_request WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!row) {
    const err = new Error('Change request not found.');
    err.status = 404;
    throw err;
  }
  return row;
}

async function getLiveHistoryRow(domain, equipId, historyId, conn) {
  if (!historyId) return null;
  const { history: HIST } = DOMAIN_TABLES[domain];
  const [[row]] = await db(conn).execute(
    `SELECT * FROM \`${HIST}\` WHERE id=? AND equip_id=? LIMIT 1`,
    [historyId, equipId],
  );
  return row || null;
}

async function loadConflictState(request, conn) {
  if (request.action === 'create') return null;
  const live = await getLiveHistoryRow(request.domain, request.equip_id, request.history_id, conn);
  const expected = parseJson(request.previous_json, null);
  const requested = parseJson(request.payload_json, {});
  if (!live) {
    return {
      kind: 'missing',
      expectedVersion: Number(request.base_version || 1),
      currentVersion: null,
      expected,
      current: null,
      requested,
    };
  }
  const currentVersion = Number(live.version || 1);
  const expectedVersion = Number(request.base_version || 0);
  if (currentVersion !== expectedVersion) {
    return {
      kind: 'version',
      expectedVersion,
      currentVersion,
      expected,
      current: snapshotFromRow(live),
      requested,
    };
  }
  return null;
}

function requestCreatedIstDate(request) {
  return getIstDateParts(new Date(request.created_at)).date;
}

function serializeApprovalRequest(request, extra = {}) {
  const payload = parseJson(request.payload_json, {});
  const previous = parseJson(request.previous_json, null);
  const createdIst = requestCreatedIstDate(request);
  const todayIst = getIstDateParts().date;
  const photoSource = request.action === 'delete' ? previous : payload;
  return {
    id: request.id,
    module: request.module || 'maintenance',
    entityType: request.entity_type || 'maintenance_history',
    domain: request.domain,
    domainLabel: DOMAIN_TABLES[request.domain]?.label || '',
    operation: request.action,
    operationLabel: actionLabel(request.action),
    entityId: request.history_id,
    equipId: request.equip_id,
    equipmentName: equipmentNameFromRequest(request),
    previousData: previous,
    requestedData: payload,
    changedFields: buildFieldDiff(request.action, previous, payload),
    requestedBy: {
      id: request.requested_by_user_id,
      name: request.requested_by_name,
      email: request.requested_by_email,
    },
    status: request.status,
    hodComment: request.hod_comment || '',
    requestedAt: request.created_at,
    reviewedAt: request.resolved_at,
    reviewedBy: request.reviewed_by_user_id,
    baseVersion: request.base_version,
    notificationCount: request.notification_count,
    lastNotificationAt: request.hod_notified_at,
    group: createdIst && createdIst === todayIst ? 'today' : 'previous',
    photosBefore: imageSources(photoSource?.img_before),
    photosAfter: imageSources(photoSource?.img_after),
    ...extra,
  };
}

async function getHodAccess(userId) {
  const settings = await getApprovalSettings();
  const access = {};
  for (const domain of APPROVAL_DOMAINS) {
    access[domain] = Boolean(
      settings[domain].enabled && Number(settings[domain].hodUserId) === Number(userId),
    );
  }
  return access;
}

async function assertHodForRequest(user, request) {
  const access = await getHodAccess(user.id);
  if (!access[request.domain]) {
    const err = new Error('Only the assigned HOD can review this request.');
    err.status = 403;
    throw err;
  }
}

async function assertCanViewRequest(user, request) {
  const isOwner = Number(request.requested_by_user_id) === Number(user.id);
  if (isOwner) return;
  const access = await getHodAccess(user.id);
  if (access[request.domain]) return;
  const err = new Error('Not allowed to view this change request.');
  err.status = 403;
  throw err;
}

async function applyPendingRequestDb(request, conn) {
  const payload = parseJson(request.payload_json, {});
  if (request.action === 'create') {
    return applyHistoryCreate(request.domain, request.equip_id, payload, conn);
  }
  if (request.action === 'update') {
    await applyHistoryUpdate(request.domain, request.equip_id, request.history_id, payload, conn);
    return request.history_id;
  }
  if (request.action === 'delete') {
    await applyHistoryDelete(request.domain, request.equip_id, request.history_id, conn);
    return null;
  }
  throw new Error('Unknown action.');
}

async function applyPendingRequestFiles(request, historyId) {
  const payload = parseJson(request.payload_json, {});
  if (request.action === 'create' || request.action === 'update') {
    const targetId = historyId || request.history_id;
    if (!targetId) return;
    const withDocs = await mergeStagedDocumentsIntoPayload(
      request.domain,
      request.equip_id,
      targetId,
      request.id,
      payload,
    );
    if (withDocs.documents !== payload.documents) {
      await applyHistoryUpdate(request.domain, request.equip_id, targetId, withDocs);
    }
    return;
  }
  cleanupStagingDir(request.id);
}

async function markRequestApproved(conn, request, actor) {
  await db(conn).execute(
    `UPDATE maintenance_history_approval_request
     SET status = 'approved', resolved_at = NOW(), resolved_by = ?, reviewed_by_user_id = ?
     WHERE id = ?`,
    [actor.email || request.hod_email, actor.userId || null, request.id],
  );
}

/** Relative app path for opening an approval request on the equipment history page. */
function buildApprovalDeepLinkPath(request, { includeApprovalQuery = true } = {}) {
  const equipId = Number(request.equip_id);
  const requestId = Number(request.id);
  if (!equipId) return null;

  const payload = parseJson(request.payload_json, {});
  const previous = parseJson(request.previous_json, {});
  const section = String(
    payload.section
    || previous.section
    || payload.equipment_refs?.[0]?.section
    || previous.equipment_refs?.[0]?.section
    || '',
  ).trim().toLowerCase();
  const basePath = request.domain === 'sugar'
    ? `/sugar-house-equipment-new/${equipId}`
    : request.domain === 'production'
      ? `/production-house-equipment/${equipId}`
      : `/power-plant-equipment-new/${equipId}`;
  // Production House has no discipline segment in the URL
  const pathPrefix = (section && request.domain !== 'production')
    ? `${basePath}/${encodeURIComponent(section)}`
    : basePath;
  if (includeApprovalQuery && requestId) {
    return `${pathPrefix}?approvalRequestId=${encodeURIComponent(requestId)}`;
  }
  return pathPrefix;
}

async function notifySubmitterInAppApproved(request) {
  const userId = Number(request.requested_by_user_id);
  if (!userId) return;
  const ctx = parseJson(request.equipment_context_json, {});
  const equipmentName = ctx.name || ctx.equip_no || 'Equipment';
  const domainLabel = DOMAIN_TABLES[request.domain]?.label || '';
  const op = actionLabel(request.action);
  await createUserNotification({
    userId,
    type: NOTIF_TYPE_MH_APPROVED,
    title: 'Maintenance history approved',
    body: `${op} for ${equipmentName}${domainLabel ? ` (${domainLabel})` : ''} was approved by HOD.`,
    linkUrl: buildApprovalDeepLinkPath(request, { includeApprovalQuery: false }),
    ctaLabel: null,
    refType: NOTIF_REF_APPROVAL,
    refId: request.id,
    meta: {
      domain: request.domain,
      action: request.action,
      equipId: request.equip_id,
      status: STATUS.APPROVED,
    },
  });
}

async function notifySubmitterInAppNeedsModification(request, comment) {
  const userId = Number(request.requested_by_user_id);
  if (!userId) return;
  const ctx = parseJson(request.equipment_context_json, {});
  const equipmentName = ctx.name || ctx.equip_no || 'Equipment';
  const domainLabel = DOMAIN_TABLES[request.domain]?.label || '';
  const op = actionLabel(request.action);
  const commentText = String(comment || '').trim();
  await createUserNotification({
    userId,
    type: NOTIF_TYPE_MH_NEEDS_MODIFICATION,
    title: 'Maintenance history needs modification',
    body: commentText
      ? `${op} for ${equipmentName}${domainLabel ? ` (${domainLabel})` : ''}: ${commentText}`
      : `${op} for ${equipmentName} was sent back for modification.`,
    linkUrl: buildApprovalDeepLinkPath(request, { includeApprovalQuery: true }),
    ctaLabel: 'View / Edit',
    refType: NOTIF_REF_APPROVAL,
    refId: request.id,
    meta: {
      domain: request.domain,
      action: request.action,
      equipId: request.equip_id,
      status: STATUS.NEEDS_MODIFICATION,
    },
  });
}

async function notifyApproved(request) {
  await notifySubmitterInAppApproved(request);
  if (!request.requested_by_email) return;
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

async function notifyNeedsModification(request, comment) {
  await notifySubmitterInAppNeedsModification(request, comment);
  if (!request.requested_by_email) return;
  try {
    const ctx = parseJson(request.equipment_context_json, {});
    const publicBase = String(CLIENT_ORIGIN || '').replace(/\/+$/, '');
    const relativePath = buildApprovalDeepLinkPath(request, { includeApprovalQuery: true });
    const openUrl = publicBase && relativePath ? `${publicBase}${relativePath}` : '';
    await sendMaintenanceHistoryModificationEmail({
      to: request.requested_by_email,
      submitterName: request.requested_by_name || 'User',
      domainLabel: DOMAIN_TABLES[request.domain].label,
      equipmentName: ctx.name || ctx.equip_no || 'Equipment',
      actionLabel: actionLabel(request.action),
      comment,
      openUrl,
    });
  } catch (err) {
    console.error('[maintenanceHistoryApproval] modification notify failed:', err.message);
  }
}

async function markConflict(request, conflict, actor) {
  await pool.execute(
    `UPDATE maintenance_history_approval_request
     SET status = 'conflict', resolved_at = NOW(), resolved_by = ?, reviewed_by_user_id = ?
     WHERE id = ?`,
    [actor.email || request.hod_email, actor.userId || null, request.id],
  );
  try {
    await insertAudit({
      requestId: request.id,
      action: AUDIT_ACTION.CONFLICT_DETECTED,
      performedByUserId: actor.userId,
      performedByEmail: actor.email,
      previousStatus: request.status,
      newStatus: STATUS.CONFLICT,
    });
  } catch (err) {
    console.error('[maintenanceHistoryApproval] conflict audit failed:', err.message);
  }
  return {
    alreadyResolved: false,
    status: STATUS.CONFLICT,
    request: { ...request, status: STATUS.CONFLICT },
    conflict,
  };
}

async function approveRequest(request, actor = {}, { force = false } = {}) {
  if (actor.userId && request.requested_by_user_id
    && Number(request.requested_by_user_id) === Number(actor.userId)) {
    const err = new Error('You cannot approve your own request.');
    err.status = 403;
    throw err;
  }

  if (request.status === STATUS.APPROVED) {
    return { alreadyResolved: true, status: STATUS.APPROVED, request };
  }

  const approvable = force
    ? [STATUS.PENDING, STATUS.RESUBMITTED, STATUS.CONFLICT]
    : ACTIVE_QUEUE_STATUSES;
  if (!approvable.includes(request.status)) {
    const err = new Error(`This request was already ${request.status}.`);
    err.status = 409;
    throw err;
  }

  if (!force) {
    const conflict = await loadConflictState(request);
    if (conflict) {
      return markConflict(request, conflict, actor);
    }
  }

  const conn = await pool.getConnection();
  let historyId = request.history_id;
  try {
    await conn.beginTransaction();
    historyId = await applyPendingRequestDb(request, conn);
    await markRequestApproved(conn, request, actor);
    await insertAudit({
      conn,
      requestId: request.id,
      action: force ? AUDIT_ACTION.CONFLICT_RESOLVED_APPLY : AUDIT_ACTION.APPROVED,
      performedByUserId: actor.userId,
      performedByEmail: actor.email,
      previousStatus: request.status,
      newStatus: STATUS.APPROVED,
    });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  try {
    await applyPendingRequestFiles(request, historyId);
  } catch (err) {
    console.error('[maintenanceHistoryApproval] post-approve files failed:', err.message);
  }

  const updated = { ...request, status: STATUS.APPROVED, history_id: historyId };
  await notifyApproved(updated);
  return { alreadyResolved: false, status: STATUS.APPROVED, request: updated };
}

async function sendForModification(request, comment, actor = {}) {
  const trimmed = String(comment || '').trim();
  if (!trimmed) {
    const err = new Error('A comment is required when sending for modification.');
    err.status = 400;
    throw err;
  }

  if (request.status === STATUS.NEEDS_MODIFICATION) {
    return { alreadyResolved: true, status: STATUS.NEEDS_MODIFICATION, request };
  }
  if (!ACTIVE_QUEUE_STATUSES.includes(request.status) && request.status !== STATUS.CONFLICT) {
    const err = new Error(`This request was already ${request.status}.`);
    err.status = 409;
    throw err;
  }

  await pool.execute(
    `UPDATE maintenance_history_approval_request
     SET status = 'needs_modification', hod_comment = ?, resolved_at = NOW(),
         resolved_by = ?, reviewed_by_user_id = ?
     WHERE id = ?`,
    [trimmed, actor.email || request.hod_email, actor.userId || null, request.id],
  );

  try {
    await insertAudit({
      requestId: request.id,
      action: AUDIT_ACTION.SENT_FOR_MODIFICATION,
      performedByUserId: actor.userId,
      performedByEmail: actor.email,
      previousStatus: request.status,
      newStatus: STATUS.NEEDS_MODIFICATION,
      comment: trimmed,
    });
  } catch (err) {
    console.error('[maintenanceHistoryApproval] modification audit failed:', err.message);
  }

  const updated = {
    ...request,
    status: STATUS.NEEDS_MODIFICATION,
    hod_comment: trimmed,
  };
  await notifyNeedsModification(updated, trimmed);
  return { alreadyResolved: false, status: STATUS.NEEDS_MODIFICATION, request: updated };
}

async function approveByToken(token) {
  let request = await getRequestByToken(token, 'accept');
  if (!request) {
    const err = new Error('Invalid approval link.');
    err.status = 404;
    throw err;
  }
  request = await markExpiredIfNeeded(request);
  if (request.tokenExpired) {
    const err = new Error(
      'This approval link has expired. Use the latest daily digest email, or ask an admin to resend the digest (no DigiLog login required).',
    );
    err.status = 410;
    throw err;
  }

  return approveRequest(request, { email: request.hod_email, userId: request.hod_user_id });
}

async function rejectByToken(token, comment) {
  let request = await getRequestByToken(token, 'reject');
  if (!request) {
    const err = new Error('Invalid modification link.');
    err.status = 404;
    throw err;
  }
  request = await markExpiredIfNeeded(request);
  if (request.tokenExpired) {
    const err = new Error(
      'This link has expired. Use the latest daily digest email, or ask an admin to resend the digest (no DigiLog login required).',
    );
    err.status = 410;
    throw err;
  }

  return sendForModification(request, comment, {
    email: request.hod_email,
    userId: request.hod_user_id,
  });
}

async function resubmitRequest(request, payload, user) {
  if (Number(request.requested_by_user_id) !== Number(user.id)) {
    const err = new Error('You can only resubmit your own change request.');
    err.status = 403;
    throw err;
  }
  if (request.status !== STATUS.NEEDS_MODIFICATION) {
    const err = new Error('Only requests sent back for modification can be resubmitted.');
    err.status = 409;
    throw err;
  }

  let previousSnapshot = parseJson(request.previous_json, null);
  let baseVersion = Number(request.base_version || 0);
  if (request.action !== 'create' && request.history_id) {
    const live = await getLiveHistoryRow(request.domain, request.equip_id, request.history_id);
    if (live) {
      previousSnapshot = snapshotFromRow(live);
      baseVersion = Number(live.version || 1);
    }
  }

  const tokens = newTokenPair();
  await pool.execute(
    `UPDATE maintenance_history_approval_request
     SET payload_json = ?, previous_json = ?, status = 'resubmitted',
         base_version = ?, token_accept = ?, token_reject = ?, token_expires_at = ?,
         hod_notified_at = NULL, resolved_at = NULL, resolved_by = NULL
     WHERE id = ?`,
    [
      JSON.stringify(payload || {}),
      previousSnapshot ? JSON.stringify(previousSnapshot) : null,
      baseVersion,
      tokens.tokenAccept,
      tokens.tokenReject,
      tokens.expires,
      request.id,
    ],
  );

  try {
    await insertAudit({
      requestId: request.id,
      action: AUDIT_ACTION.RESUBMITTED,
      performedByUserId: user.id,
      performedByEmail: user.email,
      previousStatus: STATUS.NEEDS_MODIFICATION,
      newStatus: STATUS.RESUBMITTED,
    });
  } catch (err) {
    console.error('[maintenanceHistoryApproval] resubmit audit failed:', err.message);
  }

  return getRequestById(request.id);
}

async function resolveConflict(request, resolution, actor) {
  if (request.status !== STATUS.CONFLICT) {
    const err = new Error('This request is not in conflict.');
    err.status = 409;
    throw err;
  }
  if (resolution === 'discard') {
    await pool.execute(
      `UPDATE maintenance_history_approval_request
       SET status = 'cancelled', resolved_at = NOW(), resolved_by = ?, reviewed_by_user_id = ?
       WHERE id = ?`,
      [actor.email || request.hod_email, actor.userId || null, request.id],
    );
    await insertAudit({
      requestId: request.id,
      action: AUDIT_ACTION.CONFLICT_RESOLVED_DISCARD,
      performedByUserId: actor.userId,
      performedByEmail: actor.email,
      previousStatus: STATUS.CONFLICT,
      newStatus: STATUS.CANCELLED,
    });
    cleanupStagingDir(request.id);
    return { status: STATUS.CANCELLED, request: { ...request, status: STATUS.CANCELLED } };
  }
  if (resolution === 'apply') {
    const live = await getLiveHistoryRow(request.domain, request.equip_id, request.history_id);
    if (live) {
      await pool.execute(
        `UPDATE maintenance_history_approval_request SET base_version = ? WHERE id = ?`,
        [Number(live.version || 1), request.id],
      );
      request = { ...request, base_version: Number(live.version || 1) };
    }
    return approveRequest(request, actor, { force: true });
  }
  const err = new Error("Resolution must be 'apply' or 'discard'.");
  err.status = 400;
  throw err;
}

async function bulkApprove(ids, actor) {
  const results = [];
  for (const rawId of ids) {
    const id = Number(rawId);
    try {
      const request = await getRequestById(id);
      await assertHodForRequest(actor, request);
      const result = await approveRequest(request, {
        userId: actor.id,
        email: actor.email,
      });
      results.push({
        id,
        ok: result.status !== STATUS.CONFLICT,
        status: result.status,
        alreadyResolved: result.alreadyResolved,
        conflict: result.conflict || null,
        message: result.status === STATUS.CONFLICT
          ? 'Version conflict — review expected vs current vs requested values.'
          : null,
      });
    } catch (err) {
      results.push({
        id,
        ok: false,
        status: err.status || 500,
        message: err.message,
      });
    }
  }
  return results;
}

async function listMyRequests(userId, query = {}) {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const offset = (page - 1) * limit;
  const status = String(query.status || '').trim();
  const params = [userId];
  let where = 'requested_by_user_id = ?';
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM maintenance_history_approval_request WHERE ${where}`,
    params,
  );
  const [rows] = await pool.query(
    `SELECT * FROM maintenance_history_approval_request
     WHERE ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return {
    page,
    limit,
    total,
    items: rows.map((row) => serializeApprovalRequest(row)),
  };
}

async function listPendingForHod(user, query = {}) {
  const access = await getHodAccess(user.id);
  const domains = APPROVAL_DOMAINS.filter((d) => access[d]);
  if (!domains.length) {
    const err = new Error('You are not the assigned HOD for maintenance history approval.');
    err.status = 403;
    throw err;
  }

  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const offset = (page - 1) * limit;
  const domain = String(query.domain || '').trim();
  const employee = String(query.employee || '').trim();
  const operation = String(query.operation || query.action || '').trim().toLowerCase();
  const status = String(query.status || '').trim();
  const search = String(query.search || '').trim();
  const from = String(query.from || '').trim();
  const to = String(query.to || '').trim();

  const clauses = [];
  const params = [];

  if (domain && domains.includes(domain)) {
    clauses.push('domain = ?');
    params.push(domain);
  } else {
    clauses.push(`domain IN (${domains.map(() => '?').join(', ')})`);
    params.push(...domains);
  }

  if (status && HOD_QUEUE_STATUSES.includes(status)) {
    clauses.push('status = ?');
    params.push(status);
  } else {
    clauses.push(`status IN (${HOD_QUEUE_STATUSES.map(() => '?').join(', ')})`);
    params.push(...HOD_QUEUE_STATUSES);
  }

  if (employee) {
    clauses.push('(requested_by_name LIKE ? OR requested_by_email LIKE ? OR requested_by_user_id = ?)');
    params.push(`%${employee}%`, `%${employee}%`, employee);
  }
  if (operation && ['create', 'update', 'delete'].includes(operation)) {
    clauses.push('action = ?');
    params.push(operation);
  }
  if (from) {
    clauses.push('created_at >= ?');
    params.push(`${from} 00:00:00`);
  }
  if (to) {
    clauses.push('created_at <= ?');
    params.push(`${to} 23:59:59`);
  }
  if (search) {
    clauses.push('(requested_by_name LIKE ? OR requested_by_email LIKE ? OR equipment_context_json LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = clauses.join(' AND ');
  const [countRows] = await pool.query(
    `SELECT status, created_at FROM maintenance_history_approval_request WHERE ${where}`,
    params,
  );
  const todayIst = getIstDateParts().date;
  let previousPending = 0;
  let newToday = 0;
  let conflict = 0;
  for (const row of countRows) {
    if (row.status === STATUS.CONFLICT) conflict += 1;
    const created = getIstDateParts(new Date(row.created_at)).date;
    if (created === todayIst) newToday += 1;
    else previousPending += 1;
  }

  const [rows] = await pool.query(
    `SELECT * FROM maintenance_history_approval_request
     WHERE ${where}
     ORDER BY FIELD(status, 'conflict', 'resubmitted', 'pending'), created_at ASC, id ASC
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );

  const items = [];
  for (const row of rows) {
    let extra = {};
    if (row.status === STATUS.CONFLICT) {
      extra = { conflict: await loadConflictState(row) };
    }
    items.push(serializeApprovalRequest(row, extra));
  }

  return {
    page,
    limit,
    total: countRows.length,
    summary: {
      previousPending,
      newToday,
      total: countRows.length,
      conflict,
    },
    items,
  };
}

async function overlayPendingHistory(domain, equipId, userId, records) {
  if (!userId || !domain) return records;
  let rows;
  try {
    const [result] = await pool.query(
      `SELECT * FROM maintenance_history_approval_request
       WHERE domain = ? AND equip_id = ? AND requested_by_user_id = ?
         AND status IN ('pending', 'resubmitted', 'needs_modification', 'conflict')
       ORDER BY created_at DESC`,
      [domain, equipId, userId],
    );
    rows = result;
  } catch (err) {
    console.error('[maintenanceHistoryApproval] overlay query failed:', err.message);
    return records;
  }

  const stamped = (records || []).map((rec) => {
    const match = rows.find((r) => (
      r.history_id
      && Number(r.history_id) === Number(rec.id)
      && (r.action === 'update' || r.action === 'delete')
    ));
    if (!match) return rec;
    return {
      ...rec,
      pendingRequestId: match.id,
      pendingStatus: match.status,
      pendingAction: match.action,
      hodComment: match.hod_comment || '',
    };
  });

  const virtual = rows
    .filter((r) => r.action === 'create')
    .map((r) => {
      const payload = parseJson(r.payload_json, {});
      return {
        ...payload,
        id: `pending-${r.id}`,
        created_at: r.created_at || r.updated_at || null,
        pendingRequestId: r.id,
        pendingStatus: r.status,
        pendingAction: 'create',
        hodComment: r.hod_comment || '',
      };
    });

  return [...virtual, ...stamped];
}

async function assertPendingRequestForUser(requestId, equipId, domain, userId) {
  const [[row]] = await pool.query(
    `SELECT * FROM maintenance_history_approval_request
     WHERE id = ? AND equip_id = ? AND domain = ?
       AND status IN ('pending', 'resubmitted', 'needs_modification')
     LIMIT 1`,
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

async function getRequestForRejectToken(token) {
  let request = await getRequestByToken(token, 'reject');
  if (!request) {
    const err = new Error('Invalid modification link.');
    err.status = 404;
    throw err;
  }
  return markExpiredIfNeeded(request);
}

module.exports = {
  DOMAIN_TABLES,
  SETTINGS_KEYS,
  STATUS,
  OPERATION,
  getApprovalSettings,
  updateApprovalSettings,
  isApprovalEnabled,
  resolveHodUser,
  createPendingRequest,
  getReviewByToken,
  getInboxByToken,
  getDocumentForReviewToken,
  approveByToken,
  rejectByToken,
  bulkApproveByInboxToken,
  resendDigestByToken,
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
  getHodAccess,
  getRequestById,
  serializeApprovalRequest,
  assertHodForRequest,
  assertCanViewRequest,
  approveRequest,
  sendForModification,
  resubmitRequest,
  resolveConflict,
  bulkApprove,
  listMyRequests,
  listPendingForHod,
  overlayPendingHistory,
  loadConflictState,
  getRequestForRejectToken,
};
