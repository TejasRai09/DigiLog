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
  sendMaintenanceHistoryModificationReminderEmail,
} = require('./email.service');
const { createUserNotification } = require('./userNotification.service');
const { CLIENT_ORIGIN } = require('../config/env');

const NOTIF_REF_APPROVAL = 'maintenance_history_approval_request';
const NOTIF_TYPE_MH_APPROVED = 'mh_approved';
const NOTIF_TYPE_MH_NEEDS_MODIFICATION = 'mh_needs_modification';
const NOTIF_TYPE_MH_PENDING_HOD = 'mh_pending_hod';
const HOD_APPROVALS_PATH = '/maintenance/approvals';

const DIGEST_TIMEZONE = 'Asia/Kolkata';
const DEFAULT_DIGEST_TIME = '22:00';
/** Employee needs-modification reminder: daily job at 09:00 IST, every 2 calendar days. */
const EMPLOYEE_REMINDER_TIME_IST = '09:00';
const EMPLOYEE_REMINDER_INTERVAL_DAYS = 2;

const SETTINGS_KEYS = {
  sugar: {
    enabled: 'mh_approval_sugar_enabled',
    hodUserId: 'mh_approval_sugar_hod_user_id',
    digestTime: 'mh_approval_sugar_digest_time',
    digestTime2: 'mh_approval_sugar_digest_time_2',
    digestLastSentDate: 'mh_approval_sugar_digest_last_sent_date',
    digestLastSentSlots: 'mh_approval_sugar_digest_last_sent_slots',
  },
  power: {
    enabled: 'mh_approval_power_enabled',
    hodUserId: 'mh_approval_power_hod_user_id',
    digestTime: 'mh_approval_power_digest_time',
    digestTime2: 'mh_approval_power_digest_time_2',
    digestLastSentDate: 'mh_approval_power_digest_last_sent_date',
    digestLastSentSlots: 'mh_approval_power_digest_last_sent_slots',
  },
  production: {
    enabled: 'mh_approval_production_enabled',
    hodUserId: 'mh_approval_production_hod_user_id',
    digestTime: 'mh_approval_production_digest_time',
    digestTime2: 'mh_approval_production_digest_time_2',
    digestLastSentDate: 'mh_approval_production_digest_last_sent_date',
    digestLastSentSlots: 'mh_approval_production_digest_last_sent_slots',
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
  const raw = String(value == null || value === '' ? DEFAULT_DIGEST_TIME : value).trim();
  const match = /^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(raw);
  if (!match) return null;
  return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
}

/** Empty string = slot disabled. Non-empty must be valid HH:mm. */
function normalizeOptionalDigestTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return normalizeDigestTime(raw);
}

function validateDigestTime(value) {
  return normalizeDigestTime(value) != null;
}

function validateOptionalDigestTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return true;
  return normalizeDigestTime(raw) != null;
}

function configuredDigestTimes(domainSettings) {
  const times = [];
  const t1 = normalizeDigestTime(domainSettings?.digestTime) || DEFAULT_DIGEST_TIME;
  const t2 = normalizeOptionalDigestTime(domainSettings?.digestTime2);
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

function slotAlreadySentToday(domainSettings, slot, istDate) {
  const slots = parseDigestLastSentSlots(domainSettings?.digestLastSentSlots);
  if (slots[slot] === istDate) return true;
  // Legacy single-date marker: treat as first configured slot already sent today
  if (domainSettings?.digestLastSentDate === istDate) {
    const first = configuredDigestTimes(domainSettings)[0];
    if (first && slot === first && !slots[slot]) return true;
  }
  return false;
}

async function markDigestSlotSent(domain, slot, istDate) {
  const settings = await getApprovalSettings();
  const slots = parseDigestLastSentSlots(settings[domain]?.digestLastSentSlots);
  // Drop stale dates from other days
  const next = {};
  for (const [key, date] of Object.entries(slots)) {
    if (date === istDate) next[key] = date;
  }
  next[slot] = istDate;
  await setPortalSetting(SETTINGS_KEYS[domain].digestLastSentSlots, JSON.stringify(next));
  await setPortalSetting(SETTINGS_KEYS[domain].digestLastSentDate, istDate);
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

/**
 * mysql2 dateStrings under session UTC → "YYYY-MM-DD HH:mm:ss" (no zone).
 * Parse as UTC so IST day/time math is correct on an IST host.
 */
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

/** API-facing ISO UTC string for created/resolved timestamps. */
function toApiUtcIso(value) {
  const d = parseMysqlUtcDateTime(value);
  return d ? d.toISOString() : null;
}

function timeToMinutes(hhmm) {
  const normalized = normalizeDigestTime(hhmm);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
}

const PATH_SEP = ' › ';

const PRODUCTION_HOUSE_SECTION_LABELS = {
  pan_crystallizer: 'Pan & Crystallizer',
  evaporation: 'Evaporation',
  clarification: 'Clarification',
  centrifugal_drier: 'Centrifugal & Drier House',
};

async function walkHierarchyNodeLabels(nodeId, hierarchyTable) {
  const labels = [];
  let currentId = nodeId;
  const guard = new Set();
  while (currentId && !guard.has(String(currentId))) {
    guard.add(String(currentId));
    const [[row]] = await pool.query(
      `SELECT id, parent_id, name FROM \`${hierarchyTable}\` WHERE id = ? LIMIT 1`,
      [currentId],
    );
    if (!row) break;
    labels.unshift(String(row.name || '').trim());
    currentId = row.parent_id;
  }
  return labels.filter(Boolean);
}

/**
 * Full equipment path labels for HOD display (mail / inbox / logged-in approvals).
 * Sugar/Power: hierarchy tree. Production: house section + equipment name.
 */
async function resolveHierarchyPathLabels(domain, equipId, equipment = null) {
  const eid = Number(equipId);
  if (!Number.isFinite(eid) || eid <= 0) return [];

  if (domain === 'production') {
    let eq = equipment;
    if (!eq) {
      const [[row]] = await pool.query(
        'SELECT name, house_section, equip_no FROM phn_equipment WHERE id = ? LIMIT 1',
        [eid],
      );
      eq = row || null;
    }
    const labels = ['Production House'];
    const sectionLabel = PRODUCTION_HOUSE_SECTION_LABELS[eq?.house_section]
      || String(eq?.house_section || '').trim();
    if (sectionLabel) labels.push(sectionLabel);
    const leaf = String(eq?.name || eq?.equip_no || '').trim();
    if (leaf) labels.push(leaf);
    return labels;
  }

  if (domain === 'sugar' || domain === 'power') {
    const hierarchyTable = domain === 'sugar' ? 'shn_hierarchy_node' : 'ppn_hierarchy_node';
    const equipCol = domain === 'sugar' ? 'shn_equip_id' : 'ppn_equip_id';
    const [[node]] = await pool.query(
      `SELECT id FROM \`${hierarchyTable}\`
       WHERE ${equipCol} = ? AND is_active = 1
       ORDER BY id ASC
       LIMIT 1`,
      [eid],
    );
    if (node?.id) {
      const labels = await walkHierarchyNodeLabels(node.id, hierarchyTable);
      if (labels.length) return labels;
    }

    let eq = equipment;
    if (!eq) {
      const table = DOMAIN_TABLES[domain]?.equipment;
      if (table) {
        const [[row]] = await pool.query(
          `SELECT name, category, subcategory, equip_no, tag_name FROM \`${table}\` WHERE id = ? LIMIT 1`,
          [eid],
        );
        eq = row || null;
      }
    }
    const labels = [DOMAIN_TABLES[domain]?.label || (domain === 'sugar' ? 'Sugar House' : 'Power Plant')];
    if (eq?.category) labels.push(String(eq.category).trim());
    if (eq?.subcategory) labels.push(String(eq.subcategory).trim());
    const leaf = String(eq?.name || eq?.equip_no || eq?.tag_name || '').trim();
    if (leaf) labels.push(leaf);
    return labels.filter(Boolean);
  }

  return [];
}

function formatHierarchyPath(labels = []) {
  return labels.filter(Boolean).join(PATH_SEP);
}

function equipmentLeafNameFromContext(ctx = {}) {
  return String(ctx?.name || ctx?.equip_no || ctx?.tag_name || '').trim() || 'Equipment';
}

/**
 * Split leaf equipment name vs hierarchy path for HOD mail / inbox / approvals.
 * Path uses stored or resolved hierarchy labels; drops the last label when it
 * duplicates the equipment name.
 */
function splitEquipmentDisplay(ctx = {}, hierarchyLabels = []) {
  const equipmentName = equipmentLeafNameFromContext(ctx);
  let pathLabels = Array.isArray(hierarchyLabels)
    ? hierarchyLabels.map((x) => String(x || '').trim()).filter(Boolean)
    : [];
  if (!pathLabels.length && ctx.hierarchyPath) {
    pathLabels = String(ctx.hierarchyPath).split(PATH_SEP).map((x) => x.trim()).filter(Boolean);
  }
  if (pathLabels.length) {
    const last = pathLabels[pathLabels.length - 1];
    if (last && last.toLowerCase() === equipmentName.toLowerCase()) {
      pathLabels = pathLabels.slice(0, -1);
    }
  }
  return {
    equipmentName,
    equipmentPath: formatHierarchyPath(pathLabels),
  };
}

async function equipmentDisplayPartsFromRequest(request) {
  const ctx = parseJson(request.equipment_context_json, {}) || {};
  let labels = Array.isArray(ctx.hierarchyLabels) ? ctx.hierarchyLabels : [];
  if (!labels.length) {
    try {
      labels = await resolveHierarchyPathLabels(request.domain, request.equip_id, null);
    } catch (err) {
      console.error('[maintenanceHistoryApproval] hierarchy path resolve failed:', err.message);
      labels = [];
    }
  }
  return splitEquipmentDisplay(ctx, labels);
}

/** Leaf equipment name only (notifications / short labels). */
async function equipmentDisplayNameFromRequest(request) {
  const parts = await equipmentDisplayPartsFromRequest(request);
  return parts.equipmentName;
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
    k.digestTime2,
    k.digestLastSentDate,
    k.digestLastSentSlots,
  ]);
  const map = await readPortalSettings(keys);
  const settings = {};
  for (const domain of APPROVAL_DOMAINS) {
    const k = SETTINGS_KEYS[domain];
    settings[domain] = {
      enabled: parseBool(map[k.enabled]),
      hodUserId: map[k.hodUserId] ? Number(map[k.hodUserId]) : null,
      digestTime: normalizeDigestTime(map[k.digestTime]) || DEFAULT_DIGEST_TIME,
      digestTime2: normalizeOptionalDigestTime(map[k.digestTime2]),
      digestLastSentDate: map[k.digestLastSentDate] || '',
      digestLastSentSlots: parseDigestLastSentSlots(map[k.digestLastSentSlots]),
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
    const digestTime2 = normalizeOptionalDigestTime(cfg.digestTime2);
    nextByDomain[domain] = { digestTime, digestTime2 };
    updates.push(
      [SETTINGS_KEYS[domain].enabled, cfg.enabled ? '1' : '0'],
      [SETTINGS_KEYS[domain].hodUserId, cfg.hodUserId ? String(cfg.hodUserId) : ''],
      [SETTINGS_KEYS[domain].digestTime, digestTime],
      [SETTINGS_KEYS[domain].digestTime2, digestTime2],
    );
  }
  for (const [key, value] of updates) {
    await setPortalSetting(key, value);
  }

  // If a digest slot already ran today but admin moves that slot later than now (IST),
  // clear today's marker for that slot so the scheduler can send again.
  const ist = getIstDateParts();
  const nowMinutes = timeToMinutes(ist.time);
  for (const domain of APPROVAL_DOMAINS) {
    const prevTimes = configuredDigestTimes(current[domain]);
    const nextTimes = configuredDigestTimes(nextByDomain[domain]);
    const slots = parseDigestLastSentSlots(current[domain]?.digestLastSentSlots);
    let changed = false;
    const nextSlots = { ...slots };

    for (const prevTime of prevTimes) {
      if (nextTimes.includes(prevTime)) continue;
      if (nextSlots[prevTime] === ist.date) {
        delete nextSlots[prevTime];
        changed = true;
      }
    }
    for (const nextTime of nextTimes) {
      if (prevTimes.includes(nextTime)) continue;
      const nextMinutes = timeToMinutes(nextTime);
      if (nowMinutes == null || nextMinutes == null) continue;
      if (nextMinutes <= nowMinutes) continue;
      // New later slot today — ensure it is not blocked by legacy date marker alone
      if (nextSlots[nextTime] === ist.date) {
        delete nextSlots[nextTime];
        changed = true;
      }
    }

    if (changed) {
      await setPortalSetting(SETTINGS_KEYS[domain].digestLastSentSlots, JSON.stringify(nextSlots));
      const stillToday = Object.values(nextSlots).some((d) => d === ist.date);
      if (!stillToday && current[domain]?.digestLastSentDate === ist.date) {
        await setPortalSetting(SETTINGS_KEYS[domain].digestLastSentDate, '');
      }
      console.log(
        `[maintenanceHistoryApproval] ${domain} digest times updated; refreshed today's slot markers`,
      );
    }
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
    .filter((filename) => {
      if (!filename || filename.endsWith('.meta.json') || filename.startsWith('.')) return false;
      try {
        return fs.statSync(path.join(dir, filename)).isFile();
      } catch {
        return false;
      }
    })
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

/** Remove one staged file (+ meta) for an approval request. Returns true if removed. */
function deleteStagedDocument(requestId, fileName) {
  const safeName = path.basename(String(fileName || '').trim());
  if (!safeName || safeName !== String(fileName || '').trim() || safeName.endsWith('.meta.json')) {
    const err = new Error('Invalid document name.');
    err.status = 400;
    throw err;
  }
  const staged = listStagedDocuments(requestId);
  const match = staged.find((f) => f.filename === safeName);
  if (!match) {
    const err = new Error('Document not found.');
    err.status = 404;
    throw err;
  }
  const dir = approvalStagingDir(requestId);
  const abs = path.join(dir, safeName);
  const metaPath = path.join(dir, `${safeName}.meta.json`);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
  if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
  return true;
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

/** Authenticated HOD / owner document URL (Bearer required — open via API client). */
function documentAuthViewUrl(requestId, source, name) {
  const params = new URLSearchParams({
    source: source === 'staged' ? 'staged' : 'stored',
    name: String(name || ''),
  });
  return `/api/approvals/${encodeURIComponent(requestId)}/documents?${params.toString()}`;
}

function mapStoredDocsForReview(docs, makeUrl) {
  return (docs || []).map((doc) => {
    const name = path.basename(doc.storageKey);
    return {
      source: 'stored',
      name,
      displayName: doc.displayName,
      mimeType: doc.mimeType || 'application/octet-stream',
      size: Number(doc.size) || 0,
      url: makeUrl('stored', name),
    };
  });
}

/** After approve, docs live on the history row — payload may still be empty. */
async function findLikelyCreatedHistoryId(request) {
  if (request.action !== 'create' || request.status !== STATUS.APPROVED) return null;
  const tables = DOMAIN_TABLES[request.domain];
  if (!tables?.history) return null;
  const payload = parseJson(request.payload_json, {}) || {};
  try {
    const [[row]] = await pool.query(
      `SELECT id FROM \`${tables.history}\`
       WHERE equip_id = ?
         AND documents IS NOT NULL
         AND JSON_LENGTH(documents) > 0
         AND (date_start <=> ?)
         AND (obs <=> ?)
         AND (act <=> ?)
         AND (rem <=> ?)
       ORDER BY id DESC
       LIMIT 1`,
      [
        request.equip_id,
        payload.date_start || null,
        payload.obs || null,
        payload.act || null,
        payload.rem || null,
      ],
    );
    return row?.id ? Number(row.id) : null;
  } catch (err) {
    console.error('[maintenanceHistoryApproval] find created history id failed:', err.message);
    return null;
  }
}

async function loadHistoryDocumentsForRequest(request) {
  let historyId = Number(request.history_id) || 0;
  if (!historyId) {
    historyId = (await findLikelyCreatedHistoryId(request)) || 0;
    // Lazy backfill so approved Review keeps working after create approvals.
    if (historyId) {
      try {
        await pool.execute(
          `UPDATE maintenance_history_approval_request
           SET history_id = COALESCE(history_id, ?)
           WHERE id = ?`,
          [historyId, request.id],
        );
        request.history_id = historyId;
      } catch {
        /* non-fatal */
      }
    }
  }
  if (!historyId || request.action === 'delete') return [];
  const tables = DOMAIN_TABLES[request.domain];
  if (!tables?.history) return [];
  try {
    const [[row]] = await pool.query(
      `SELECT documents FROM \`${tables.history}\` WHERE id = ? AND equip_id = ? LIMIT 1`,
      [historyId, request.equip_id],
    );
    return parseHistoryDocuments(row?.documents);
  } catch (err) {
    console.error('[maintenanceHistoryApproval] load history documents failed:', err.message);
    return [];
  }
}

async function buildReviewDocuments(request, { acceptToken = null, useAuthUrl = false } = {}) {
  const payload = parseJson(request.payload_json, {});
  const previous = parseJson(request.previous_json, null);
  const docSource = request.action === 'delete' ? previous : payload;
  const makeUrl = (source, name) => (
    useAuthUrl
      ? documentAuthViewUrl(request.id, source, name)
      : documentViewUrl(acceptToken, source, name)
  );
  let stored = mapStoredDocsForReview(parseHistoryDocuments(docSource?.documents), makeUrl);
  const staged = request.action === 'delete'
    ? []
    : listStagedDocuments(request.id).map((file) => ({
      source: 'staged',
      name: file.filename,
      displayName: file.displayName,
      mimeType: file.mimeType || 'application/octet-stream',
      size: Number(file.size) || 0,
      url: makeUrl('staged', file.filename),
    }));

  // Approved creates/updates move staged files into history and clear staging;
  // fall back to the live history row when payload still has no document keys.
  if (
    !stored.length
    && !staged.length
    && request.action !== 'delete'
    && (request.history_id || request.status === STATUS.APPROVED)
  ) {
    stored = mapStoredDocsForReview(await loadHistoryDocumentsForRequest(request), makeUrl);
  }

  return [...stored, ...staged];
}

async function resolveDocumentFileForRequest(request, source, name) {
  const safeName = path.basename(String(name || '').replace(/\\/g, '/'));
  if (!safeName || safeName === '.' || safeName === '..') {
    const err = new Error('Invalid document name.');
    err.status = 400;
    throw err;
  }
  const src = source === 'staged' ? 'staged' : 'stored';

  if (src === 'staged') {
    const file = listStagedDocuments(request.id).find((f) => f.filename === safeName);
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

  const payload = parseJson(request.payload_json, {});
  const previous = parseJson(request.previous_json, null);
  const docSource = request.action === 'delete' ? previous : payload;
  let document = parseHistoryDocuments(docSource?.documents)
    .find((doc) => path.basename(doc.storageKey) === safeName);

  if (!document && request.action !== 'delete'
    && (request.history_id || request.status === STATUS.APPROVED)) {
    document = (await loadHistoryDocumentsForRequest(request))
      .find((doc) => path.basename(doc.storageKey) === safeName);
  }

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

async function getDocumentForReviewToken(token, source, name) {
  const review = await getReviewByToken(token);
  return resolveDocumentFileForRequest(review.request, source, name);
}

async function getDocumentForLoggedInUser(user, requestId, source, name) {
  const request = await getRequestById(requestId);
  await assertCanViewRequest(user, request);
  return resolveDocumentFileForRequest(request, source, name);
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

  const display = await equipmentDisplayPartsFromRequest(request);
  return {
    status: request.status,
    alreadyResolved: !ACTIVE_QUEUE_STATUSES.includes(request.status),
    tokenExpired: Boolean(request.tokenExpired),
    request,
    equipmentName: display.equipmentName,
    equipmentPath: display.equipmentPath,
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
    documents: await buildReviewDocuments(request, { acceptToken }),
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
  const entries = [];
  for (const row of rows) {
    entries.push(await buildDigestEntry(row));
  }
  return {
    status: review.status,
    alreadyResolved: review.alreadyResolved && !rows.length,
    domain: review.domain,
    domainLabel: review.domainLabel,
    hodEmail: review.request.hod_email,
    entries,
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
  const hierarchyLabels = await resolveHierarchyPathLabels(domain, equipId, equipment);
  const display = splitEquipmentDisplay({
    name: equipment?.name || '',
    equip_no: equipment?.equip_no || equipment?.tag_name || '',
    tag_name: equipment?.tag_name || '',
  }, hierarchyLabels);
  const equipmentContext = {
    name: equipment?.name || '',
    equip_no: equipment?.equip_no || equipment?.tag_name || '',
    tag_name: equipment?.tag_name || '',
    dept: equipment?.dept || '',
    house_section: equipment?.house_section || '',
    category: equipment?.category || '',
    subcategory: equipment?.subcategory || '',
    hierarchyLabels,
    hierarchyPath: display.equipmentPath,
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

  // After DB clear + AUTO_INCREMENT reset, new ids can reuse folders that still
  // hold orphaned staged files — wipe so uploads start from an empty quota.
  cleanupStagingDir(result.insertId);

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

  const created = await getRequestById(result.insertId);
  // HOD in-app notify is deferred until the client finishes document uploads
  // (see POST /change-requests/:id/notify-hod). Callers that do not defer
  // should invoke notifyHodInAppPending themselves after createPendingRequest.
  return {
    id: result.insertId,
    tokenAccept: tokens.tokenAccept,
    tokenReject: tokens.tokenReject,
    request: created,
  };
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
  await addColumnIfMissing(
    'maintenance_history_approval_request',
    'employee_reminder_sent_at',
    '`employee_reminder_sent_at` DATETIME NULL DEFAULT NULL',
  );

  const keys = [
    [SETTINGS_KEYS.sugar.digestTime, DEFAULT_DIGEST_TIME],
    [SETTINGS_KEYS.power.digestTime, DEFAULT_DIGEST_TIME],
    [SETTINGS_KEYS.production.digestTime, DEFAULT_DIGEST_TIME],
    [SETTINGS_KEYS.sugar.digestTime2, ''],
    [SETTINGS_KEYS.power.digestTime2, ''],
    [SETTINGS_KEYS.production.digestTime2, ''],
    [SETTINGS_KEYS.sugar.digestLastSentDate, ''],
    [SETTINGS_KEYS.power.digestLastSentDate, ''],
    [SETTINGS_KEYS.production.digestLastSentDate, ''],
    [SETTINGS_KEYS.sugar.digestLastSentSlots, '{}'],
    [SETTINGS_KEYS.power.digestLastSentSlots, '{}'],
    [SETTINGS_KEYS.production.digestLastSentSlots, '{}'],
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
    return rows.filter((row) => getIstDateParts(parseMysqlUtcDateTime(row.hod_notified_at) || new Date(0)).date === istDate).length;
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

async function buildDigestEntry(request) {
  const payload = parseJson(request.payload_json, {});
  const previous = parseJson(request.previous_json, null);
  const diff = buildFieldDiff(request.action, previous, payload);
  const display = await equipmentDisplayPartsFromRequest(request);
  return {
    id: request.id,
    equipmentName: display.equipmentName,
    equipmentPath: display.equipmentPath,
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
    const created = getIstDateParts(parseMysqlUtcDateTime(row.created_at) || new Date(0)).date;
    if (created === istDate) today.push(row);
    else previous.push(row);
  }
  return { previous, today };
}

/**
 * @param {'sugar'|'power'} domain
 * @param {{ force?: boolean, mode?: 'all'|'new', slot?: string }} [options]
 *   - force: bypass "already sent today" guard (admin/HOD resend)
 *   - mode 'new': only rows never included in a digest (hod_notified_at IS NULL)
 *   - slot: HH:mm schedule slot being fired (tracks per-slot daily send)
 */
async function sendDigestForDomain(domain, options = {}) {
  const force = Boolean(options.force);
  const mode = options.mode === 'new' ? 'new' : 'all';
  const slot = normalizeOptionalDigestTime(options.slot);

  const settings = await getApprovalSettings();
  const domainSettings = settings[domain];
  if (!domainSettings?.enabled) {
    return { sent: false, reason: 'disabled' };
  }

  const ist = getIstDateParts();
  if (!force) {
    if (slot) {
      if (slotAlreadySentToday(domainSettings, slot, ist.date)) {
        return { sent: false, reason: 'already-sent' };
      }
    } else if (domainSettings.digestLastSentDate === ist.date) {
      return { sent: false, reason: 'already-sent' };
    }
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

  const entries = [];
  for (const row of refreshed) {
    entries.push(await buildDigestEntry(row));
  }
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

  if (slot) {
    await markDigestSlotSent(domain, slot, ist.date);
  } else {
    await setPortalSetting(SETTINGS_KEYS[domain].digestLastSentDate, ist.date);
  }
  return { sent: true, count: pendingRows.length, mode, force, slot: slot || null };
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
        equipmentName: await equipmentDisplayNameFromRequest(result.request),
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

    const times = configuredDigestTimes(domainSettings);
    if (!times.length) continue;

    try {
      const pending = await fetchPendingForDigest(domain, ist.date);
      if (!pending.length) continue;

      for (const slot of times) {
        const digestMinutes = timeToMinutes(slot);
        if (digestMinutes == null) continue;
        if (slotAlreadySentToday(domainSettings, slot, ist.date)) continue;

        if (nowMinutes < digestMinutes) {
          console.log(
            `[maintenanceHistoryApproval] ${pending.length} pending ${domain} item(s); waiting until ${slot} IST (now ${ist.time})`,
          );
          continue;
        }

        const result = await sendDigestForDomain(domain, { slot });
        if (result.sent) {
          console.log(
            `[maintenanceHistoryApproval] digest sent for ${domain} at slot ${slot}: ${result.count} item(s) to HOD`,
          );
          // Refresh in-memory markers so a second slot in the same tick is not blocked incorrectly
          domainSettings.digestLastSentSlots = {
            ...parseDigestLastSentSlots(domainSettings.digestLastSentSlots),
            [slot]: ist.date,
          };
          domainSettings.digestLastSentDate = ist.date;
        }
      }
    } catch (err) {
      console.error(`[maintenanceHistoryApproval] digest failed for ${domain}:`, err.message);
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

  await sendMaintenanceHistoryModificationReminderEmail({
    to: email,
    submitterName: row.requested_by_name || 'User',
    domainLabel: DOMAIN_TABLES[row.domain]?.label || row.domain,
    equipmentName: await equipmentDisplayNameFromRequest(row),
    actionLabel: actionLabel(row.action),
    comment: row.hod_comment || '',
    openUrl: buildEmployeeModificationOpenUrl(row),
  });

  // Soft in-app ping (does not block email if this fails)
  try {
    const userId = Number(row.requested_by_user_id);
    if (userId) {
      const equipmentName = await equipmentDisplayNameFromRequest(row);
      await createUserNotification({
        userId,
        type: NOTIF_TYPE_MH_NEEDS_MODIFICATION,
        title: 'Reminder: maintenance history needs modification',
        body: `${actionLabel(row.action)} for ${equipmentName} is still waiting for you to revise and resubmit.`,
        linkUrl: buildApprovalDeepLinkPath(row, { includeApprovalQuery: true }),
        ctaLabel: 'View / Edit',
        refType: NOTIF_REF_APPROVAL,
        refId: row.id,
        meta: {
          domain: row.domain,
          action: row.action,
          equipId: row.equip_id,
          status: STATUS.NEEDS_MODIFICATION,
          reminder: true,
        },
      });
    }
  } catch (err) {
    console.error('[maintenanceHistoryApproval] employee reminder in-app notify failed:', err.message);
  }

  await pool.execute(
    `UPDATE maintenance_history_approval_request
     SET employee_reminder_sent_at = NOW()
     WHERE id = ? AND status = 'needs_modification'`,
    [row.id],
  );
  return { sent: true };
}

/**
 * Every day from 09:00 IST: email employees whose needs_modification requests
 * are still open and at least 2 calendar days since HOD send / last reminder.
 */
async function runEmployeeModificationReminderTick() {
  const ist = getIstDateParts();
  const nowMinutes = timeToMinutes(ist.time);
  const reminderMinutes = timeToMinutes(EMPLOYEE_REMINDER_TIME_IST);
  if (nowMinutes == null || reminderMinutes == null) return;
  if (nowMinutes < reminderMinutes) return;

  let rows;
  try {
    const [result] = await pool.query(
      `SELECT * FROM maintenance_history_approval_request
       WHERE status = 'needs_modification'
         AND requested_by_email IS NOT NULL
         AND TRIM(requested_by_email) <> ''
         AND resolved_at IS NOT NULL
       ORDER BY resolved_at ASC, id ASC
       LIMIT 200`,
    );
    rows = result;
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      console.error(
        '[maintenanceHistoryApproval] employee reminder skipped: apply mysql/migrate_maintenance_history_approval_employee_reminder.sql',
      );
      return;
    }
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
          `[maintenanceHistoryApproval] employee modification reminder sent for request #${row.id} → ${row.requested_by_email}`,
        );
      }
    } catch (err) {
      console.error(
        `[maintenanceHistoryApproval] employee reminder failed for request #${row.id}:`,
        err.message,
      );
    }
  }
  if (sent) {
    console.log(`[maintenanceHistoryApproval] employee modification reminders sent: ${sent}`);
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
  return getIstDateParts(parseMysqlUtcDateTime(request.created_at) || new Date(0)).date;
}

async function serializeApprovalRequest(request, extra = {}) {
  const payload = parseJson(request.payload_json, {});
  const previous = parseJson(request.previous_json, null);
  const createdIst = requestCreatedIstDate(request);
  const todayIst = getIstDateParts().date;
  const photoSource = request.action === 'delete' ? previous : payload;
  const display = await equipmentDisplayPartsFromRequest(request);
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
    equipmentName: display.equipmentName,
    equipmentPath: display.equipmentPath,
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
    requestedAt: toApiUtcIso(request.created_at),
    reviewedAt: toApiUtcIso(request.resolved_at),
    reviewedBy: request.reviewed_by_user_id,
    baseVersion: request.base_version,
    notificationCount: request.notification_count,
    lastNotificationAt: toApiUtcIso(request.hod_notified_at),
    group: createdIst && createdIst === todayIst ? 'today' : 'previous',
    photosBefore: imageSources(photoSource?.img_before),
    photosAfter: imageSources(photoSource?.img_after),
    documents: await buildReviewDocuments(request, { useAuthUrl: true }),
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
  let nextPayload = payload;

  if (request.action === 'create' || request.action === 'update') {
    const targetId = historyId || request.history_id;
    if (targetId) {
      nextPayload = await mergeStagedDocumentsIntoPayload(
        request.domain,
        request.equip_id,
        targetId,
        request.id,
        payload,
      );
      if (nextPayload.documents !== payload.documents) {
        await applyHistoryUpdate(request.domain, request.equip_id, targetId, nextPayload);
      }
    }
  } else {
    cleanupStagingDir(request.id);
  }

  // Keep payload_json + history_id in sync so approved Review still shows documents
  // after staging is cleared.
  const docsChanged = JSON.stringify(nextPayload?.documents ?? null)
    !== JSON.stringify(payload?.documents ?? null);
  const needHistoryId = Boolean(historyId) && !request.history_id;
  if (docsChanged || needHistoryId) {
    await pool.execute(
      `UPDATE maintenance_history_approval_request
       SET payload_json = ?, history_id = COALESCE(history_id, ?)
       WHERE id = ?`,
      [JSON.stringify(nextPayload || {}), historyId || null, request.id],
    );
  }
}

async function markRequestApproved(conn, request, actor, historyId = null) {
  await db(conn).execute(
    `UPDATE maintenance_history_approval_request
     SET status = 'approved', resolved_at = NOW(), resolved_by = ?, reviewed_by_user_id = ?,
         history_id = COALESCE(history_id, ?)
     WHERE id = ?`,
    [actor.email || request.hod_email, actor.userId || null, historyId || null, request.id],
  );
}

/** Relative app path for opening an approval request on the equipment history page. */
function buildApprovalDeepLinkPath(request, { includeApprovalQuery = true } = {}) {
  const equipId = Number(request.equip_id);
  const requestId = Number(request.id);
  if (!equipId) return null;

  const payload = parseJson(request.payload_json, {});
  const previous = parseJson(request.previous_json, {});
  const ctx = parseJson(request.equipment_context_json, {}) || {};
  const section = String(
    payload.section
    || previous.section
    || payload.equipment_refs?.[0]?.section
    || previous.equipment_refs?.[0]?.section
    || ctx.dept
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
    // Same query the in-app "View / Edit" notification uses (opens history + edit form)
    return `${pathPrefix}?approvalRequestId=${encodeURIComponent(requestId)}`;
  }
  return pathPrefix;
}

/** Absolute URL for emails — identical destination to the in-app notification CTA. */
function buildEmployeeModificationOpenUrl(request) {
  const relativePath = buildApprovalDeepLinkPath(request, { includeApprovalQuery: true });
  const publicBase = String(CLIENT_ORIGIN || '').replace(/\/+$/, '');
  if (!relativePath) {
    return publicBase ? `${publicBase}/?login=1` : '';
  }
  if (!publicBase) return relativePath;
  return `${publicBase}${relativePath}`;
}

async function notifyHodInAppPending(request, { resubmitted = false } = {}) {
  const userId = Number(request.hod_user_id);
  if (!userId) return null;

  // Create/submit notify is deferred until uploads finish — avoid duplicate toasts
  // if the client calls notify-hod more than once for the same pending request.
  if (!resubmitted) {
    try {
      const [[existing]] = await pool.query(
        `SELECT id FROM user_notification
         WHERE user_id = ? AND type = ? AND ref_type = ? AND ref_id = ?
         LIMIT 1`,
        [userId, NOTIF_TYPE_MH_PENDING_HOD, NOTIF_REF_APPROVAL, Number(request.id)],
      );
      if (existing) return { skipped: true, reason: 'already-notified' };
    } catch (err) {
      console.error('[maintenanceHistoryApproval] notify dedupe check failed:', err.message);
    }
  }

  const equipmentName = await equipmentDisplayNameFromRequest(request);
  const parts = await equipmentDisplayPartsFromRequest(request);
  const domainLabel = DOMAIN_TABLES[request.domain]?.label || '';
  const op = actionLabel(request.action);
  const submitter = request.requested_by_name || request.requested_by_email || 'A user';
  const pathBit = parts.equipmentPath ? ` — ${parts.equipmentPath}` : '';
  await createUserNotification({
    userId,
    type: NOTIF_TYPE_MH_PENDING_HOD,
    title: resubmitted
      ? 'Maintenance history resubmitted for approval'
      : 'Maintenance history awaiting approval',
    body: `${submitter} ${resubmitted ? 'resubmitted' : 'submitted'} ${op.toLowerCase()} for ${equipmentName}${pathBit}${domainLabel ? ` (${domainLabel})` : ''}.`,
    linkUrl: HOD_APPROVALS_PATH,
    ctaLabel: 'Open approvals',
    refType: NOTIF_REF_APPROVAL,
    refId: request.id,
    meta: {
      domain: request.domain,
      action: request.action,
      equipId: request.equip_id,
      status: resubmitted ? STATUS.RESUBMITTED : STATUS.PENDING,
    },
  });
  return { skipped: false };
}

/**
 * Called by the employee client after create/update pending request + document
 * uploads finish, so HOD toast/sound does not fire mid-upload.
 */
async function notifyHodPendingAfterClientSubmit(requestId, user) {
  const request = await getRequestById(requestId);
  if (Number(request.requested_by_user_id) !== Number(user?.id)) {
    const err = new Error('Not allowed to notify for this request.');
    err.status = 403;
    throw err;
  }
  if (![STATUS.PENDING, STATUS.RESUBMITTED].includes(request.status)) {
    const err = new Error('Request is not awaiting HOD review.');
    err.status = 409;
    throw err;
  }
  return notifyHodInAppPending(request, {
    resubmitted: request.status === STATUS.RESUBMITTED,
  });
}

async function notifySubmitterInAppApproved(request) {
  const userId = Number(request.requested_by_user_id);
  if (!userId) return;
  const equipmentName = await equipmentDisplayNameFromRequest(request);
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
  const equipmentName = await equipmentDisplayNameFromRequest(request);
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
    await sendMaintenanceHistoryApprovedEmail({
      to: request.requested_by_email,
      submitterName: request.requested_by_name || 'User',
      domainLabel: DOMAIN_TABLES[request.domain].label,
      equipmentName: await equipmentDisplayNameFromRequest(request),
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
    await sendMaintenanceHistoryModificationEmail({
      to: request.requested_by_email,
      submitterName: request.requested_by_name || 'User',
      domainLabel: DOMAIN_TABLES[request.domain].label,
      equipmentName: await equipmentDisplayNameFromRequest(request),
      actionLabel: actionLabel(request.action),
      comment,
      openUrl: buildEmployeeModificationOpenUrl(request),
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
    await markRequestApproved(conn, request, actor, historyId);
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
         resolved_by = ?, reviewed_by_user_id = ?, employee_reminder_sent_at = NULL
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
         hod_notified_at = NULL, resolved_at = NULL, resolved_by = NULL,
         employee_reminder_sent_at = NULL
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

  const updated = await getRequestById(request.id);
  try {
    await notifyHodInAppPending(updated, { resubmitted: true });
  } catch (err) {
    console.error('[maintenanceHistoryApproval] hod resubmit notify failed:', err.message);
  }

  return updated;
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
  const items = [];
  for (const row of rows) {
    items.push(await serializeApprovalRequest(row));
  }
  return {
    page,
    limit,
    total,
    items,
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

  const sharedClauses = [];
  const sharedParams = [];

  if (domain && domains.includes(domain)) {
    sharedClauses.push('domain = ?');
    sharedParams.push(domain);
  } else {
    sharedClauses.push(`domain IN (${domains.map(() => '?').join(', ')})`);
    sharedParams.push(...domains);
  }

  if (employee) {
    sharedClauses.push('(requested_by_name LIKE ? OR requested_by_email LIKE ? OR requested_by_user_id = ?)');
    sharedParams.push(`%${employee}%`, `%${employee}%`, employee);
  }
  if (operation && ['create', 'update', 'delete'].includes(operation)) {
    sharedClauses.push('action = ?');
    sharedParams.push(operation);
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
    sharedClauses.push('(requested_by_name LIKE ? OR requested_by_email LIKE ? OR equipment_context_json LIKE ?)');
    sharedParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
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

  // Pending KPI cards always from pending queue (ignore approved status filter)
  const pendingClauses = [
    ...sharedClauses,
    `status IN (${HOD_QUEUE_STATUSES.map(() => '?').join(', ')})`,
  ];
  const pendingParams = [...sharedParams, ...HOD_QUEUE_STATUSES];
  const pendingWhere = pendingClauses.join(' AND ');
  const [pendingRows] = await pool.query(
    `SELECT status, created_at FROM maintenance_history_approval_request WHERE ${pendingWhere}`,
    pendingParams,
  );
  let previousPending = 0;
  let newToday = 0;
  let conflict = 0;
  for (const row of pendingRows) {
    if (row.status === STATUS.CONFLICT) conflict += 1;
    const created = getIstDateParts(parseMysqlUtcDateTime(row.created_at) || new Date(0)).date;
    if (created === todayIst) newToday += 1;
    else previousPending += 1;
  }

  // Lifetime / period KPIs (not limited to pending queue status)
  const [[kpiRow]] = await pool.query(
    `SELECT
       COUNT(*) AS totalRequests,
       SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approvedRequests,
       SUM(CASE WHEN status = 'needs_modification' THEN 1 ELSE 0 END) AS needsModification
     FROM maintenance_history_approval_request
     WHERE ${sharedClauses.join(' AND ')}`,
    sharedParams,
  );
  const totalRequests = Number(kpiRow?.totalRequests) || 0;
  const approvedRequests = Number(kpiRow?.approvedRequests) || 0;
  const needsModification = Number(kpiRow?.needsModification) || 0;

  const [[{ listTotal }]] = await pool.query(
    `SELECT COUNT(*) AS listTotal FROM maintenance_history_approval_request WHERE ${listWhere}`,
    listParams,
  );

  const orderSql = statusFilter === STATUS.APPROVED || statusFilter === STATUS.NEEDS_MODIFICATION
    ? 'ORDER BY COALESCE(resolved_at, created_at) DESC, id DESC'
    : "ORDER BY FIELD(status, 'conflict', 'resubmitted', 'pending'), created_at ASC, id ASC";

  const [rows] = await pool.query(
    `SELECT * FROM maintenance_history_approval_request
     WHERE ${listWhere}
     ${orderSql}
     LIMIT ${limit} OFFSET ${offset}`,
    listParams,
  );

  const items = [];
  for (const row of rows) {
    let extra = {};
    if (row.status === STATUS.CONFLICT) {
      extra = { conflict: await loadConflictState(row) };
    }
    items.push(await serializeApprovalRequest(row, extra));
  }

  return {
    page,
    limit,
    total: Number(listTotal) || 0,
    summary: {
      previousPending,
      newToday,
      total: pendingRows.length,
      conflict,
      totalRequests,
      approvedRequests,
      needsModification,
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

  /** Staged approval uploads + any stored keys already in payload/history. */
  function documentsForPendingRequest(request, fallbackDocs) {
    const payload = parseJson(request.payload_json, {}) || {};
    const previous = parseJson(request.previous_json, null);
    const baseRaw = request.action === 'delete'
      ? (previous?.documents ?? fallbackDocs)
      : (payload.documents ?? fallbackDocs);
    const base = parseHistoryDocuments(baseRaw);
    const staged = listStagedDocuments(request.id).map((file) => ({
      storageKey: `staged:${request.id}:${file.filename}`,
      displayName: file.displayName || file.originalName || file.filename,
      originalName: file.originalName || file.displayName || file.filename,
      mimeType: file.mimeType || 'application/octet-stream',
      size: Number(file.size) || 0,
      pending: false,
      staged: true,
      approvalRequestId: Number(request.id),
      stagedFileName: file.filename,
    }));
    const seen = new Set(base.map((d) => d.storageKey));
    const merged = [...base];
    for (const doc of staged) {
      if (seen.has(doc.storageKey)) continue;
      seen.add(doc.storageKey);
      merged.push(doc);
    }
    return merged.slice(0, MAX_HISTORY_DOCUMENTS);
  }

  const stamped = (records || []).map((rec) => {
    const match = rows.find((r) => (
      r.history_id
      && Number(r.history_id) === Number(rec.id)
      && (r.action === 'update' || r.action === 'delete')
    ));
    if (!match) return rec;
    const payload = parseJson(match.payload_json, {}) || {};
    // For pending updates, surface requested payload fields + staged docs on the row
    // so view/edit match what HOD sees (not only the last approved history row).
    const overlaid = match.action === 'update'
      ? {
        ...rec,
        ...payload,
        id: rec.id,
        created_at: rec.created_at,
      }
      : { ...rec };
    return {
      ...overlaid,
      documents: documentsForPendingRequest(match, overlaid.documents ?? rec.documents),
      pendingRequestId: match.id,
      pendingStatus: match.status,
      pendingAction: match.action,
      hodComment: match.hod_comment || '',
    };
  });

  const virtual = rows
    .filter((r) => r.action === 'create')
    .map((r) => {
      const payload = parseJson(r.payload_json, {}) || {};
      return {
        ...payload,
        id: `pending-${r.id}`,
        created_at: r.created_at || r.updated_at || null,
        documents: documentsForPendingRequest(r, payload.documents),
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
    const err = new Error('Not allowed to modify documents for this request.');
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
  notifyHodInAppPending,
  notifyHodPendingAfterClientSubmit,
  getReviewByToken,
  getInboxByToken,
  getDocumentForReviewToken,
  getDocumentForLoggedInUser,
  approveByToken,
  rejectByToken,
  bulkApproveByInboxToken,
  equipmentDisplayNameFromRequest,
  equipmentDisplayPartsFromRequest,
  resendDigestByToken,
  fetchPendingForDigest,
  sendDigestForDomain,
  runDigestSchedulerTick,
  runEmployeeModificationReminderTick,
  ensureDigestSchema,
  validateDigestTime,
  validateOptionalDigestTime,
  normalizeDigestTime,
  buildFieldDiff,
  actionLabel,
  snapshotFromRow,
  approvalStagingDir,
  listStagedDocuments,
  deleteStagedDocument,
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
