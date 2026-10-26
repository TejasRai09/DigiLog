const fs = require('fs');
const { pool } = require('../config/mysql');
const { CLIENT_ORIGIN } = require('../config/env');
const { createUserNotification } = require('./userNotification.service');
const {
  sendMaintenanceNotesApprovedEmail,
  sendMaintenanceNotesModificationEmail,
} = require('./email.service');
const { validHistoryImageField } = require('../utils/historyImages');
const ppnHierarchy = require('../utils/ppnHierarchyLib');
const shnHierarchy = require('../utils/shnHierarchyLib');
const {
  MAX_NOTE_DOCUMENTS,
  noteDocumentStorageKey,
  parseNoteDocuments,
  resolveNoteDocumentAbsPath,
  unlinkStoredNoteDocument,
} = require('../utils/noteDocuments');
const {
  lockedPlantForUser,
  canUseMaintenanceNotesRegister,
  scopeHodPlantsByCategory,
} = require('../utils/maintenanceNotesPlantAccess');

const NOTIF_TYPE_PENDING = 'mn_pending_hod';
const NOTIF_TYPE_APPROVED = 'mn_approved';
const NOTIF_TYPE_REWORK = 'mn_rework';
const NOTIF_REF = 'maintenance_note';
const HOD_PATH = '/maintenance/approvals?source=notes';
const REGISTER_PATH = '/forms-hub/maintenance-notes';

const PLANTS = {
  sugar: { key: 'sugar', label: 'Sugar House', table: 'shn_equipment' },
  power: { key: 'power', label: 'Power Plant', table: 'ppn_equipment' },
  production: { key: 'production', label: 'Production House', table: 'phn_equipment' },
};

const SETTING_KEYS = {
  sugar: 'mn_hod_sugar',
  power: 'mn_hod_power',
  production: 'mn_hod_production',
};

const DEFAULT_DIGEST_TIME = '22:00';
const DIGEST_KEYS = {
  sugar: {
    digestTime: 'mn_digest_sugar_time',
    digestTime2: 'mn_digest_sugar_time_2',
  },
  power: {
    digestTime: 'mn_digest_power_time',
    digestTime2: 'mn_digest_power_time_2',
  },
  production: {
    digestTime: 'mn_digest_production_time',
    digestTime2: 'mn_digest_production_time_2',
  },
};

const NOTES_ACCESS_MESSAGE = 'Maintenance Notes is only available for Sugar House, Power Plant, and Production employees.';
const NOTES_PLANT_SELECT_MESSAGE = 'Select Sugar House, Power Plant, or Production House.';

const STATUS_LABEL = {
  pending: 'Pending',
  approval_pending: 'Approval Pending',
  completed: 'Completed',
  rework_required: 'Rework Required',
};

const EDITABLE = new Set(['pending', 'rework_required']);
const SUBMITTABLE = new Set(['pending', 'rework_required']);
const MAX_NOTE_PHOTOS = 3;
const ACTIVITY_MAX_LENGTH = 80;
const ACTIVITY_TYPES = [
  'Inspection',
  'Repair',
  'Replacement',
  'Lubrication',
  'Cleaning / Descaling',
  'Overhaul',
  'Calibration',
  'Painting / Civil',
  'Other',
];

const PRODUCTION_HOUSES = [
  { id: 'pan_crystallizer', label: 'Pan & Crystallizer' },
  { id: 'evaporation', label: 'Evaporation' },
  { id: 'clarification', label: 'Clarification' },
  { id: 'centrifugal_drier', label: 'Centrifugal & Drier House' },
];

const NOTE_LIST_COLUMNS = `id, plant, equipment_id, equipment_node_id, equipment_name, no_equipment,
  activity_type, activity_description, activity_details, documents, status,
  created_by_user_id, created_by_name, created_by_email,
  submitted_by_user_id, submitted_by_name, submitted_at, completion_remarks,
  hod_user_id, hod_name, hod_decision, hod_decision_at, hod_remarks, updated_at, created_at`;

function plantLabel(plant) {
  return PLANTS[plant]?.label || plant || '—';
}

function resolveWritablePlant(user, requestedPlant, { existingPlant = null } = {}) {
  if (user?.role === 'admin') {
    const plant = String(requestedPlant || existingPlant || '').trim();
    if (!PLANTS[plant]) throw httpError(400, NOTES_PLANT_SELECT_MESSAGE);
    return plant;
  }
  const locked = lockedPlantForUser(user);
  if (!locked) {
    throw httpError(403, NOTES_ACCESS_MESSAGE);
  }
  const requested = String(requestedPlant || '').trim();
  if (requested && requested !== locked) {
    throw httpError(403, `You can only add notes for ${plantLabel(locked)}.`);
  }
  if (existingPlant && existingPlant !== locked) {
    throw httpError(403, `You can only edit notes for ${plantLabel(locked)}.`);
  }
  return locked;
}

function assertRegisterAccess(user) {
  if (!canUseMaintenanceNotesRegister(user)) {
    throw httpError(403, NOTES_ACCESS_MESSAGE);
  }
}

function noteRef(id) {
  return `MN-${String(id).padStart(5, '0')}`;
}

function actorName(user) {
  return String(user?.name || user?.email || 'User').trim();
}

function isNoteOwner(row, user) {
  return Number(row?.created_by_user_id) === Number(user?.id);
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
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

function validateDigestTime(value) {
  return normalizeDigestTime(value) != null;
}

function validateOptionalDigestTime(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return true;
  return normalizeDigestTime(raw) != null;
}

function configuredNotesDigestTimes(plantSettings) {
  const times = [];
  const t1 = normalizeDigestTime(plantSettings?.digestTime) || DEFAULT_DIGEST_TIME;
  const t2 = normalizeOptionalDigestTime(plantSettings?.digestTime2);
  times.push(t1);
  if (t2 && t2 !== t1) times.push(t2);
  return times;
}

async function getSettingMap() {
  const keys = [
    ...Object.values(SETTING_KEYS),
    ...Object.values(DIGEST_KEYS).flatMap((k) => [k.digestTime, k.digestTime2]),
  ];
  const [rows] = await pool.query(
    `SELECT setting_key, setting_value FROM portal_settings WHERE setting_key IN (${keys.map(() => '?').join(',')})`,
    keys,
  );
  const map = {};
  for (const row of rows) map[row.setting_key] = row.setting_value;
  return map;
}

async function setPortalSetting(key, value) {
  await pool.execute(
    `INSERT INTO portal_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [key, value],
  );
}

async function getHodSettings() {
  const map = await getSettingMap();
  const out = {};
  for (const plant of Object.keys(PLANTS)) {
    const raw = map[SETTING_KEYS[plant]];
    const hodUserId = raw && String(raw).trim() ? Number(raw) : null;
    out[plant] = {
      hodUserId: Number.isFinite(hodUserId) ? hodUserId : null,
      digestTime: normalizeDigestTime(map[DIGEST_KEYS[plant].digestTime]) || DEFAULT_DIGEST_TIME,
      digestTime2: normalizeOptionalDigestTime(map[DIGEST_KEYS[plant].digestTime2]),
    };
  }
  return out;
}

async function updateHodSettings({ sugar, power, production }) {
  const incoming = { sugar, power, production };
  for (const plant of Object.keys(PLANTS)) {
    const cfg = incoming[plant] || {};
    const hodUserId = cfg.hodUserId ? Number(cfg.hodUserId) : null;
    if (hodUserId) {
      const [[user]] = await pool.query(
        'SELECT id FROM users WHERE id = ? AND is_active = 1 LIMIT 1',
        [hodUserId],
      );
      if (!user) throw httpError(400, `Selected HOD for ${plantLabel(plant)} is invalid or inactive.`);
    }
    const digestTime = normalizeDigestTime(cfg.digestTime) || DEFAULT_DIGEST_TIME;
    const digestTime2 = normalizeOptionalDigestTime(cfg.digestTime2);
    await setPortalSetting(DIGEST_KEYS[plant].digestTime, digestTime);
    await setPortalSetting(DIGEST_KEYS[plant].digestTime2, digestTime2);
    await pool.query(
      `INSERT INTO portal_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [SETTING_KEYS[plant], hodUserId ? String(hodUserId) : ''],
    );
  }
  return getHodSettings();
}

async function getNotesHodAccess(userOrId) {
  const userId = userOrId && typeof userOrId === 'object' ? userOrId.id : userOrId;
  let actor = userOrId && typeof userOrId === 'object' ? userOrId : null;
  if (!actor && userId) {
    const [[row]] = await pool.query(
      'SELECT id, role, department FROM users WHERE id = ? LIMIT 1',
      [userId],
    );
    actor = row || { id: userId };
  }
  const settings = await getHodSettings();
  const access = {};
  let enabled = false;
  for (const plant of Object.keys(PLANTS)) {
    const match = Number(settings[plant].hodUserId) === Number(userId);
    access[plant] = match;
    if (match) enabled = true;
  }
  return scopeHodPlantsByCategory({ ...access, enabled }, actor);
}

async function assertHodForPlant(user, plant) {
  const access = await getNotesHodAccess(user);
  if (!access[plant]) {
    throw httpError(403, `Only the assigned ${plantLabel(plant)} HOD can approve or reject this note.`);
  }
}

function snippet(text, max = 120) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

async function notifyUsers(userIds, payload) {
  const seen = new Set();
  for (const raw of userIds) {
    const userId = Number(raw);
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    await createUserNotification({ ...payload, userId });
  }
}

async function notifyHodPending(note, { resubmitted = false } = {}) {
  const hodId = Number(note.hod_user_id);
  if (!hodId) return;
  const access = await getNotesHodAccess(hodId);
  if (!access[note.plant]) return;
  const who = note.submitted_by_name || note.created_by_name || 'A user';
  const ref = noteRef(note.id);
  await notifyUsers([hodId], {
    type: NOTIF_TYPE_PENDING,
    title: resubmitted ? 'Maintenance note resubmitted' : 'Maintenance note awaiting approval',
    body: `${who} ${resubmitted ? 'resubmitted' : 'submitted'} ${ref} (${plantLabel(note.plant)}) for completion: ${snippet(note.activity_description)}`,
    linkUrl: HOD_PATH,
    ctaLabel: 'Review',
    refType: NOTIF_REF,
    refId: note.id,
    meta: { plant: note.plant, status: 'approval_pending' },
  });
}

async function loadActiveUsersByIds(ids) {
  const unique = [...new Set(ids.map((id) => Number(id)).filter(Boolean))];
  if (!unique.length) return [];
  const [rows] = await pool.query(
    `SELECT id, name, email FROM users
     WHERE id IN (${unique.map(() => '?').join(',')}) AND is_active = 1`,
    unique,
  );
  return rows;
}

async function notifyTeamDecision(note, { actorId, decision, remarks } = {}) {
  const recipients = [note.submitted_by_user_id, note.created_by_user_id].filter(
    (id) => Number(id) && Number(id) !== Number(actorId),
  );
  if (!recipients.length) return;
  const ref = noteRef(note.id);
  const plant = plantLabel(note.plant);
  const publicBase = String(CLIENT_ORIGIN || '').replace(/\/+$/, '');
  const openUrl = publicBase ? `${publicBase}${REGISTER_PATH}` : REGISTER_PATH;
  if (decision === 'approved') {
    await notifyUsers(recipients, {
      type: NOTIF_TYPE_APPROVED,
      title: 'Maintenance note completed',
      body: `${ref} (${plant}) was approved by HOD and is now Completed.`,
      linkUrl: REGISTER_PATH,
      ctaLabel: 'Open register',
      refType: NOTIF_REF,
      refId: note.id,
      meta: { plant: note.plant, status: 'completed' },
    });
    const users = await loadActiveUsersByIds(recipients);
    for (const user of users) {
      if (!user.email) continue;
      try {
        await sendMaintenanceNotesApprovedEmail({
          to: user.email,
          submitterName: user.name || 'there',
          plantLabel: plant,
          noteRef: ref,
          activityDescription: note.activity_description,
        });
      } catch (err) {
        console.error('[maintenanceNotes] approved email failed:', err.message);
      }
    }
    return;
  }
  const reason = String(remarks || '').trim();
  await notifyUsers(recipients, {
    type: NOTIF_TYPE_REWORK,
    title: 'Maintenance note needs rework',
    body: reason
      ? `${ref} (${plant}): ${reason}`
      : `${ref} (${plant}) was sent back for rework.`,
    linkUrl: REGISTER_PATH,
    ctaLabel: 'Open register',
    refType: NOTIF_REF,
    refId: note.id,
    meta: { plant: note.plant, status: 'rework_required' },
  });
  const users = await loadActiveUsersByIds(recipients);
  for (const user of users) {
    if (!user.email) continue;
    try {
      await sendMaintenanceNotesModificationEmail({
        to: user.email,
        submitterName: user.name || 'there',
        plantLabel: plant,
        noteRef: ref,
        activityDescription: note.activity_description,
        comment: reason,
        openUrl,
      });
    } catch (err) {
      console.error('[maintenanceNotes] rework email failed:', err.message);
    }
  }
}

async function recordEvent({ noteId, action, user, fromStatus, toStatus, remarks }) {
  await pool.query(
    `INSERT INTO maintenance_note_event
      (note_id, action, actor_user_id, actor_name, from_status, to_status, remarks)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [noteId, action, user?.id || null, actorName(user), fromStatus || null, toStatus || null, remarks || null],
  );
}

function parseNoteImages(value) {
  if (!value) return [];
  const stored = validHistoryImageField(value);
  if (!stored) return [];
  if (stored.startsWith('data:image')) return [stored];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_NOTE_PHOTOS) : [];
  } catch {
    return [];
  }
}

function cleanImages(value) {
  if (value == null || value === '') return null;
  const rawList = Array.isArray(value) ? value.filter(Boolean) : null;
  if (rawList && rawList.length === 0) return null;
  const stored = validHistoryImageField(rawList ? JSON.stringify(rawList) : value);
  if (!stored) throw httpError(400, 'Photos must be image files.');
  const list = parseNoteImages(stored);
  if (rawList && rawList.length !== list.length) throw httpError(400, 'Photos must be image files.');
  if (list.length > MAX_NOTE_PHOTOS) throw httpError(400, `You can add up to ${MAX_NOTE_PHOTOS} photos.`);
  return list.length ? JSON.stringify(list) : null;
}

function trimHierarchyNode(node, plant) {
  const equipmentId = plant === 'sugar' ? node.shnEquipId : node.ppnEquipId;
  return {
    id: String(node.id),
    name: node.name,
    equipNo: node.equipNo || null,
    nodeType: node.nodeType === 'equipment' ? 'equipment' : 'group',
    nodeId: Number(node.dbId || node.id),
    equipmentId: equipmentId ? Number(equipmentId) : null,
    children: (node.children || []).map((child) => trimHierarchyNode(child, plant)),
  };
}

function hierarchyPickerNodes(root, plant) {
  if (!root) return [];
  const trimmed = trimHierarchyNode(root, plant);
  if (trimmed.children.length) return trimmed.children;
  return trimmed.nodeType === 'equipment' ? [trimmed] : [];
}

function plantsForUser(user) {
  const all = Object.values(PLANTS).map((p) => ({ key: p.key, label: p.label }));
  if (user?.role === 'admin') return { plants: all, lockedPlant: null };
  const lockedPlant = lockedPlantForUser(user);
  if (!lockedPlant) {
    throw httpError(403, NOTES_ACCESS_MESSAGE);
  }
  return {
    plants: all.filter((p) => p.key === lockedPlant),
    lockedPlant,
  };
}

async function getEquipmentTree(plant, user) {
  const requested = String(plant || '').trim();
  let key = requested;
  if (user && user.role !== 'admin') {
    assertRegisterAccess(user);
    const locked = lockedPlantForUser(user);
    if (requested && requested !== locked) {
      throw httpError(403, `You can only add notes for ${plantLabel(locked)}.`);
    }
    key = locked;
  }
  if (!PLANTS[key]) throw httpError(400, NOTES_PLANT_SELECT_MESSAGE);
  if (key === 'production') {
    const [rows] = await pool.query(
      `SELECT id, house_section, name, equip_no
       FROM phn_equipment
       ORDER BY name ASC, id ASC`,
    );
    const byHouse = new Map();
    for (const row of rows) {
      const house = String(row.house_section || '');
      if (!byHouse.has(house)) byHouse.set(house, []);
      byHouse.get(house).push({
        id: String(row.id),
        name: row.name,
        equipNo: row.equip_no || null,
        nodeType: 'equipment',
        nodeId: null,
        equipmentId: Number(row.id),
        children: [],
      });
    }
    const known = new Set(PRODUCTION_HOUSES.map((house) => house.id));
    const nodes = PRODUCTION_HOUSES.map((house) => ({
      id: `house:${house.id}`,
      name: house.label,
      equipNo: null,
      nodeType: 'group',
      nodeId: null,
      equipmentId: null,
      children: byHouse.get(house.id) || [],
    })).filter((house) => house.children.length);
    for (const [house, children] of byHouse) {
      if (known.has(house) || !children.length) continue;
      nodes.push({
        id: `house:${house}`,
        name: house,
        equipNo: null,
        nodeType: 'group',
        nodeId: null,
        equipmentId: null,
        children,
      });
    }
    return { plant: key, nodes };
  }
  const lib = key === 'sugar' ? shnHierarchy : ppnHierarchy;
  const root = await lib.getHierarchyTree();
  return { plant: key, nodes: hierarchyPickerNodes(root, key) };
}

async function resolveEquipment(plant, body) {
  const noEquipment = Boolean(body.noEquipment);
  if (noEquipment) {
    return {
      noEquipment: 1,
      equipmentId: null,
      equipmentNodeId: null,
      equipmentName: null,
    };
  }
  if (plant === 'production') {
    const equipmentId = Number(body.equipmentId);
    if (!equipmentId) throw httpError(400, 'Select an equipment from Production House.');
    const [[eq]] = await pool.query(
      'SELECT id, house_section, name FROM phn_equipment WHERE id = ? LIMIT 1',
      [equipmentId],
    );
    if (!eq) throw httpError(400, 'Select an equipment from Production House.');
    const house = PRODUCTION_HOUSES.find((item) => item.id === eq.house_section);
    const equipmentName = [house?.label || eq.house_section, eq.name].filter(Boolean).join(' › ').slice(0, 500);
    return {
      noEquipment: 0,
      equipmentId: eq.id,
      equipmentNodeId: null,
      equipmentName,
    };
  }
  const nodeId = Number(body.equipmentNodeId);
  if (!nodeId) throw httpError(400, 'Select an equipment from the plant hierarchy.');
  const lib = plant === 'sugar' ? shnHierarchy : ppnHierarchy;
  const root = await lib.getHierarchyTree();
  const node = root ? lib.findNodeById(root, String(nodeId)) : null;
  if (!node || node.nodeType !== 'equipment') {
    throw httpError(400, 'Select an equipment from the plant hierarchy.');
  }
  const labels = lib.pathLabels(root, lib.pathIdsForNodeId(root, node.id)).slice(1);
  const equipmentName = (labels.length ? labels : [node.name]).join(' › ').slice(0, 500);
  const linkedId = plant === 'sugar' ? node.shnEquipId : node.ppnEquipId;
  return {
    noEquipment: 0,
    equipmentId: linkedId ? Number(linkedId) : null,
    equipmentNodeId: Number(node.dbId || node.id),
    equipmentName,
  };
}

function serializeNote(row, user, hodAccess = {}, { includeImages = false } = {}) {
  const status = row.status;
  const plant = row.plant;
  const isHod = Boolean(hodAccess[plant]);
  const viewOnly = Boolean(user?.formsHubViewOnly);
  const images = includeImages ? parseNoteImages(row.images) : [];
  return {
    id: row.id,
    noteId: noteRef(row.id),
    plant,
    plantLabel: plantLabel(plant),
    equipmentId: row.equipment_id,
    equipmentNodeId: row.equipment_node_id,
    equipmentName: row.equipment_name || '',
    noEquipment: Boolean(row.no_equipment),
    activityType: row.activity_type || '',
    activityDescription: row.activity_description,
    activityDetails: row.activity_details || '',
    images,
    documents: parseNoteDocuments(row.documents, row.id),
    status,
    statusLabel: STATUS_LABEL[status] || status,
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name,
    createdByEmail: row.created_by_email || '',
    createdAt: row.created_at,
    submittedByUserId: row.submitted_by_user_id,
    submittedByName: row.submitted_by_name || '',
    submittedAt: row.submitted_at,
    completionRemarks: row.completion_remarks || '',
    hodUserId: row.hod_user_id,
    hodName: row.hod_name || '',
    hodDecision: row.hod_decision,
    hodDecisionAt: row.hod_decision_at,
    hodRemarks: row.hod_remarks || '',
    updatedAt: row.updated_at,
    canEdit: !viewOnly && isNoteOwner(row, user) && EDITABLE.has(status),
    canSubmit: !viewOnly && isNoteOwner(row, user) && SUBMITTABLE.has(status),
    canDecide: isHod && status === 'approval_pending',
  };
}

async function listEvents(noteId) {
  const [rows] = await pool.query(
    `SELECT id, action, actor_name, from_status, to_status, remarks, created_at
     FROM maintenance_note_event WHERE note_id = ? ORDER BY id ASC`,
    [noteId],
  );
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actorName: r.actor_name,
    fromStatus: r.from_status,
    toStatus: r.to_status,
    remarks: r.remarks || '',
    createdAt: r.created_at,
  }));
}

function buildListWhere({ status, plant, equipment, search, hodPlants, submittedOnly = false }) {
  const clauses = [];
  const params = [];
  if (hodPlants && hodPlants.length) {
    clauses.push(`plant IN (${hodPlants.map(() => '?').join(',')})`);
    params.push(...hodPlants);
  }
  if (submittedOnly) {
    clauses.push("status <> 'pending'");
  }
  if (status && STATUS_LABEL[status]) {
    clauses.push('status = ?');
    params.push(status);
  }
  if (plant && PLANTS[plant]) {
    clauses.push('plant = ?');
    params.push(plant);
  }
  if (equipment && String(equipment).trim()) {
    clauses.push('(equipment_name LIKE ? OR CAST(equipment_id AS CHAR) = ?)');
    const q = `%${String(equipment).trim()}%`;
    params.push(q, String(equipment).trim());
  }
  if (search && String(search).trim()) {
    const q = `%${String(search).trim()}%`;
    clauses.push('(activity_type LIKE ? OR activity_description LIKE ? OR activity_details LIKE ? OR created_by_name LIKE ? OR equipment_name LIKE ? OR CAST(id AS CHAR) = ?)');
    params.push(q, q, q, q, q, String(search).replace(/\D/g, '') || '0');
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return { where, params };
}

async function listNotes(user, query = {}, { hodOnly = false } = {}) {
  const hodAccess = await getNotesHodAccess(user);
  let hodPlants = hodOnly
    ? Object.keys(PLANTS).filter((p) => hodAccess[p])
    : null;
  if (hodOnly && (!hodPlants || !hodPlants.length)) {
    throw httpError(403, 'You are not the assigned HOD for Maintenance Notes.');
  }
  if (!hodOnly) assertRegisterAccess(user);
  const lockedPlant = lockedPlantForUser(user);
  if (hodOnly && lockedPlant) {
    hodPlants = hodPlants.filter((p) => p === lockedPlant);
  }
  const plant = lockedPlant || query.plant;
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(10, Number(query.limit) || 20));
  const offset = (page - 1) * limit;
  const { where, params } = buildListWhere({
    status: query.status,
    plant,
    equipment: query.equipment,
    search: query.search,
    hodPlants,
    submittedOnly: hodOnly,
  });
  const [[countRow]] = await pool.query(
    `SELECT COUNT(*) AS total FROM maintenance_note ${where}`,
    params,
  );
  const [rows] = await pool.query(
    `SELECT ${NOTE_LIST_COLUMNS} FROM maintenance_note ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const summaryPlants = hodPlants && hodPlants.length
    ? hodPlants
    : (plant && PLANTS[plant] ? [plant] : null);
  const plantFilter = summaryPlants
    ? `WHERE plant IN (${summaryPlants.map(() => '?').join(',')})${hodOnly ? " AND status <> 'pending'" : ''}`
    : '';
  const [summaryRows] = await pool.query(
    `SELECT status, COUNT(*) AS c FROM maintenance_note ${plantFilter} GROUP BY status`,
    summaryPlants || [],
  );
  const summary = {
    pending: 0,
    approval_pending: 0,
    completed: 0,
    rework_required: 0,
  };
  for (const row of summaryRows) summary[row.status] = Number(row.c) || 0;
  return {
    items: rows.map((row) => serializeNote(row, user, hodAccess)),
    total: Number(countRow?.total) || 0,
    page,
    limit,
    summary,
  };
}

async function getNote(user, id, { hodOnly = false } = {}) {
  const hodAccess = await getNotesHodAccess(user);
  const [[row]] = await pool.query('SELECT * FROM maintenance_note WHERE id = ? LIMIT 1', [id]);
  if (!row) throw httpError(404, 'Maintenance note not found.');
  if (hodOnly && !hodAccess[row.plant]) {
    throw httpError(403, 'You are not the assigned HOD for this plant.');
  }
  if (hodOnly && row.status === 'pending') {
    throw httpError(404, 'Maintenance note not found.');
  }
  if (!hodOnly && user?.role !== 'admin' && !hodAccess[row.plant]) {
    const locked = lockedPlantForUser(user);
    if (!locked) {
      throw httpError(403, NOTES_ACCESS_MESSAGE);
    }
    if (row.plant !== locked) {
      throw httpError(403, `You can only view notes for ${plantLabel(locked)}.`);
    }
  }
  return {
    ...serializeNote(row, user, hodAccess, { includeImages: true }),
    events: await listEvents(row.id),
  };
}

function cleanActivityType(value) {
  const text = String(value || '').trim();
  if (!ACTIVITY_TYPES.includes(text)) throw httpError(400, 'Select an activity type.');
  return text;
}

function cleanActivity(value) {
  const text = String(value || '').trim();
  if (!text) throw httpError(400, 'Activity is required.');
  if (text.length > ACTIVITY_MAX_LENGTH) {
    throw httpError(400, `Activity must be ${ACTIVITY_MAX_LENGTH} characters or fewer.`);
  }
  return text;
}

function cleanDetails(value) {
  const text = String(value || '').trim();
  if (text.length > 4000) throw httpError(400, 'Details are too long.');
  return text || null;
}

function activityFields(body) {
  return {
    activityType: cleanActivityType(body.activityType),
    activity: cleanActivity(body.activityDescription ?? body.activity),
    details: cleanDetails(body.activityDetails ?? body.details),
  };
}

function syncDocuments(body, row) {
  const existing = parseNoteDocuments(row.documents, row.id);
  if (!Object.prototype.hasOwnProperty.call(body, 'documents')) return existing;
  if (body.documents != null && !Array.isArray(body.documents)) {
    throw httpError(400, 'Documents are invalid.');
  }
  const incoming = (body.documents || []).filter((doc) => doc && doc.storageKey);
  if (incoming.length > MAX_NOTE_DOCUMENTS) {
    throw httpError(400, `You can add up to ${MAX_NOTE_DOCUMENTS} documents.`);
  }
  const next = parseNoteDocuments(incoming, row.id);
  const nextKeys = new Set(next.map((doc) => doc.storageKey));
  for (const doc of existing) {
    if (!nextKeys.has(doc.storageKey)) unlinkStoredNoteDocument(doc.storageKey);
  }
  return next;
}

async function loadEditableNote(user, id) {
  if (user.formsHubViewOnly) throw httpError(403, 'View-only access. You cannot edit maintenance notes.');
  const [[row]] = await pool.query('SELECT * FROM maintenance_note WHERE id = ? LIMIT 1', [id]);
  if (!row) throw httpError(404, 'Maintenance note not found.');
  if (!isNoteOwner(row, user)) {
    throw httpError(403, 'Only the person who created this note can edit it.');
  }
  if (!EDITABLE.has(row.status)) {
    throw httpError(409, 'This note can only be edited while it is Pending or Rework Required.');
  }
  resolveWritablePlant(user, row.plant, { existingPlant: row.plant });
  return row;
}

async function createNote(user, body) {
  if (user.formsHubViewOnly) throw httpError(403, 'View-only access. You cannot add maintenance notes.');
  const plant = resolveWritablePlant(user, body.plant);
  const equipment = await resolveEquipment(plant, body);
  const { activityType, activity, details } = activityFields(body);
  const images = cleanImages(body.images);
  const [result] = await pool.query(
    `INSERT INTO maintenance_note
      (plant, equipment_id, equipment_node_id, equipment_name, no_equipment,
       activity_type, activity_description, activity_details, images,
       status, created_by_user_id, created_by_name, created_by_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    [
      plant,
      equipment.equipmentId,
      equipment.equipmentNodeId,
      equipment.equipmentName,
      equipment.noEquipment,
      activityType,
      activity,
      details,
      images,
      user.id,
      actorName(user),
      user.email || null,
    ],
  );
  await recordEvent({
    noteId: result.insertId,
    action: 'created',
    user,
    toStatus: 'pending',
  });
  return getNote(user, result.insertId);
}

async function updateNote(user, id, body) {
  const row = await loadEditableNote(user, id);
  const plant = resolveWritablePlant(user, body.plant, { existingPlant: row.plant });
  const equipment = await resolveEquipment(plant, body);
  const { activityType, activity, details } = activityFields({
    activityType: body.activityType ?? row.activity_type,
    activityDescription: body.activityDescription ?? row.activity_description,
    activityDetails: body.activityDetails ?? row.activity_details,
  });
  const images = Object.prototype.hasOwnProperty.call(body, 'images')
    ? cleanImages(body.images)
    : (row.images || null);
  const documents = syncDocuments(body, row);
  await pool.query(
    `UPDATE maintenance_note
     SET plant = ?, equipment_id = ?, equipment_node_id = ?, equipment_name = ?, no_equipment = ?,
         activity_type = ?, activity_description = ?, activity_details = ?, images = ?, documents = ?
     WHERE id = ?`,
    [
      plant,
      equipment.equipmentId,
      equipment.equipmentNodeId,
      equipment.equipmentName,
      equipment.noEquipment,
      activityType,
      activity,
      details,
      images,
      documents.length ? JSON.stringify(documents) : null,
      id,
    ],
  );
  await recordEvent({
    noteId: id,
    action: 'updated',
    user,
    fromStatus: row.status,
    toStatus: row.status,
  });
  return getNote(user, id);
}

async function addNoteDocument(user, id, file, displayName) {
  const row = await loadEditableNote(user, id);
  const docs = parseNoteDocuments(row.documents, row.id);
  if (docs.length >= MAX_NOTE_DOCUMENTS) {
    throw httpError(400, `You can add up to ${MAX_NOTE_DOCUMENTS} documents.`);
  }
  const storageKey = noteDocumentStorageKey(id, file.filename);
  const name = String(displayName || file.originalname || 'Document').trim().slice(0, 200) || 'Document';
  docs.push({
    storageKey,
    displayName: name,
    originalName: String(file.originalname || name).slice(0, 200),
    mimeType: String(file.mimetype || 'application/octet-stream').slice(0, 120),
    size: Number(file.size) || 0,
  });
  await pool.query(
    'UPDATE maintenance_note SET documents = ? WHERE id = ?',
    [JSON.stringify(docs), id],
  );
  return docs[docs.length - 1];
}

async function getNoteDocumentFile(user, id, fileName) {
  await getNote(user, id);
  const [[row]] = await pool.query(
    'SELECT documents FROM maintenance_note WHERE id = ? LIMIT 1',
    [id],
  );
  const storageKey = noteDocumentStorageKey(id, fileName);
  const doc = parseNoteDocuments(row?.documents, id).find((item) => item.storageKey === storageKey);
  const abs = doc ? resolveNoteDocumentAbsPath(doc.storageKey) : null;
  if (!doc || !abs || !fs.existsSync(abs)) throw httpError(404, 'Document not found.');
  return { abs, doc };
}

async function submitNote(user, id, body) {
  if (user.formsHubViewOnly) throw httpError(403, 'View-only access. You cannot submit notes for approval.');
  const settings = await getHodSettings();
  const [[row]] = await pool.query('SELECT * FROM maintenance_note WHERE id = ? LIMIT 1', [id]);
  if (!row) throw httpError(404, 'Maintenance note not found.');
  if (!isNoteOwner(row, user)) {
    throw httpError(403, 'Only the person who created this note can submit it for approval.');
  }
  resolveWritablePlant(user, row.plant, { existingPlant: row.plant });
  if (!SUBMITTABLE.has(row.status)) {
    throw httpError(409, 'Only Pending or Rework Required notes can be submitted for completion.');
  }
  const hodUserId = settings[row.plant]?.hodUserId;
  if (!hodUserId) {
    throw httpError(409, `No HOD is configured for ${plantLabel(row.plant)}. Ask an administrator to set one in Config.`);
  }
  const remarks = String(body?.completionRemarks || '').trim();
  if (remarks.length > 2000) throw httpError(400, 'Completion remarks are too long.');
  const fromStatus = row.status;
  await pool.query(
    `UPDATE maintenance_note
     SET status = 'approval_pending',
         submitted_by_user_id = ?,
         submitted_by_name = ?,
         submitted_at = UTC_TIMESTAMP(),
         completion_remarks = ?,
         hod_user_id = ?,
         hod_decision = NULL,
         hod_decision_at = NULL
     WHERE id = ?`,
    [user.id, actorName(user), remarks || null, hodUserId, id],
  );
  await recordEvent({
    noteId: id,
    action: fromStatus === 'rework_required' ? 'resubmitted' : 'submitted',
    user,
    fromStatus,
    toStatus: 'approval_pending',
    remarks,
  });
  const [[updated]] = await pool.query('SELECT * FROM maintenance_note WHERE id = ? LIMIT 1', [id]);
  try {
    await notifyHodPending(updated, {
      actorId: user.id,
      resubmitted: fromStatus === 'rework_required',
    });
  } catch (err) {
    console.error('[maintenanceNotes] HOD notify failed:', err.message);
  }
  return getNote(user, id);
}

async function decideNote(user, id, { decision, remarks }) {
  const [[row]] = await pool.query('SELECT * FROM maintenance_note WHERE id = ? LIMIT 1', [id]);
  if (!row) throw httpError(404, 'Maintenance note not found.');
  if (row.status !== 'approval_pending') {
    throw httpError(409, 'Only notes awaiting approval can be approved or rejected.');
  }
  await assertHodForPlant(user, row.plant);
  if (decision !== 'approved' && decision !== 'rejected') {
    throw httpError(400, 'Decision must be approve or reject.');
  }
  const reason = String(remarks || '').trim();
  if (decision === 'rejected' && reason.length < 5) {
    throw httpError(400, 'Add a reason so the team knows what to rework.');
  }
  if (reason.length > 2000) throw httpError(400, 'Remarks are too long.');
  const nextStatus = decision === 'approved' ? 'completed' : 'rework_required';
  await pool.query(
    `UPDATE maintenance_note
     SET status = ?,
         hod_user_id = ?,
         hod_name = ?,
         hod_decision = ?,
         hod_decision_at = UTC_TIMESTAMP(),
         hod_remarks = ?
     WHERE id = ? AND status = 'approval_pending'`,
    [nextStatus, user.id, actorName(user), decision, reason || null, id],
  );
  await recordEvent({
    noteId: id,
    action: decision,
    user,
    fromStatus: 'approval_pending',
    toStatus: nextStatus,
    remarks: reason,
  });
  const [[updated]] = await pool.query('SELECT * FROM maintenance_note WHERE id = ? LIMIT 1', [id]);
  try {
    await notifyTeamDecision(updated, { actorId: user.id, decision, remarks: reason });
  } catch (err) {
    console.error('[maintenanceNotes] decision notify failed:', err.message);
  }
  return getNote(user, id, { hodOnly: true });
}

module.exports = {
  PLANTS,
  STATUS_LABEL,
  plantLabel,
  noteRef,
  parseNoteImages,
  getHodSettings,
  updateHodSettings,
  getNotesHodAccess,
  lockedPlantForUser,
  canUseMaintenanceNotesRegister,
  plantsForUser,
  listNotes,
  getNote,
  getEquipmentTree,
  createNote,
  updateNote,
  addNoteDocument,
  getNoteDocumentFile,
  submitNote,
  decideNote,
  validateDigestTime,
  validateOptionalDigestTime,
  configuredNotesDigestTimes,
  DEFAULT_DIGEST_TIME,
};
