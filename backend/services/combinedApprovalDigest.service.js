/**
 * One HOD digest email containing Operations Forms, Maintenance History,
 * and Maintenance Notes pending items.
 */
const { pool } = require('../config/mysql');
const { sendCombinedApprovalDigestEmail } = require('./email.service');
const {
  fetchAllPendingFormRequests,
  refreshTokensForRows: refreshFormTokens,
  buildDigestEntry: buildFormDigestEntry,
  markFormRequestsNotified,
  listFormDigestSchedules,
  loadCardSetting,
} = require('./formApproval.service');
const {
  fetchAllPendingHistoryRequests,
  refreshHistoryDigestTokens,
  markHistoryRequestsNotified,
  buildDigestEntry: buildHistoryDigestEntry,
  getApprovalSettings,
  DOMAIN_TABLES,
} = require('./maintenanceHistoryApproval.service');
const {
  fetchAllPendingNotes,
  refreshNotesDigestTokens,
  markNotesNotified,
  buildNotesDigestEntry,
  getHodSettings: getNotesHodSettings,
} = require('./maintenanceNotesMail.service');
const { configuredNotesDigestTimes } = require('./maintenanceNotes.service');

const COMBINED_SLOTS_KEY = 'combined_hod_digest_slots';
const DEFAULT_DIGEST_TIME = '22:00';

function getIstDateParts(date = new Date()) {
  const raw = date.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})/.exec(raw);
  if (!match) return { date: '', time: '' };
  return { date: match[1], time: `${match[2]}:${match[3]}` };
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

function timeToMinutes(hhmm) {
  const normalized = normalizeDigestTime(hhmm);
  if (!normalized) return null;
  const [h, m] = normalized.split(':').map(Number);
  return h * 60 + m;
}

function configuredTimes(digestTime, digestTime2) {
  const times = [];
  const t1 = normalizeDigestTime(digestTime) || DEFAULT_DIGEST_TIME;
  const t2 = normalizeOptionalDigestTime(digestTime2);
  times.push(t1);
  if (t2 && t2 !== t1) times.push(t2);
  return times;
}

function parseSlotsMap(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw };
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function splitByIstDate(rows, istDate, createdField = 'created_at') {
  const previous = [];
  const today = [];
  for (const row of rows) {
    const created = getIstDateParts(
      parseMysqlUtcDateTime(row[createdField] || row.created_at) || new Date(0),
    ).date;
    if (created === istDate) today.push(row);
    else previous.push(row);
  }
  return { previous, today };
}

async function loadCombinedSlots() {
  const [[row]] = await pool.query(
    'SELECT setting_value FROM portal_settings WHERE setting_key = ? LIMIT 1',
    [COMBINED_SLOTS_KEY],
  );
  return parseSlotsMap(row?.setting_value);
}

async function saveCombinedSlots(map) {
  await pool.execute(
    `INSERT INTO portal_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [COMBINED_SLOTS_KEY, JSON.stringify(map || {})],
  );
}

function slotSentToday(slotsMap, hodUserId, slot, istDate) {
  const hodSlots = slotsMap[String(hodUserId)] || {};
  return hodSlots[slot] === istDate;
}

async function markHodSlotSent(hodUserId, slot, istDate) {
  const map = await loadCombinedSlots();
  const key = String(hodUserId);
  const nextHod = {};
  for (const [time, date] of Object.entries(map[key] || {})) {
    if (date === istDate) nextHod[time] = date;
  }
  nextHod[slot] = istDate;
  map[key] = nextHod;
  await saveCombinedSlots(map);
}

async function resolveHodUser(hodUserId) {
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

async function collectScheduleByHod() {
  const byHod = new Map();
  const addTimes = (hodUserId, times) => {
    const id = Number(hodUserId);
    if (!id) return;
    if (!byHod.has(id)) byHod.set(id, new Set());
    for (const t of times) {
      if (t) byHod.get(id).add(t);
    }
  };

  const formSchedules = await listFormDigestSchedules();
  for (const row of formSchedules) {
    addTimes(row.hodUserId, configuredTimes(row.digestTime, row.digestTime2));
  }

  const historySettings = await getApprovalSettings();
  for (const domain of Object.keys(DOMAIN_TABLES)) {
    const cfg = historySettings[domain];
    if (!cfg?.enabled || !cfg.hodUserId) continue;
    addTimes(cfg.hodUserId, configuredTimes(cfg.digestTime, cfg.digestTime2));
  }

  const notesSettings = await getNotesHodSettings();
  for (const plant of Object.keys(notesSettings)) {
    const cfg = notesSettings[plant];
    if (!cfg?.hodUserId) continue;
    addTimes(cfg.hodUserId, configuredNotesDigestTimes(cfg));
  }

  const out = [];
  for (const [hodUserId, times] of byHod.entries()) {
    out.push({ hodUserId, times: [...times].sort() });
  }
  return out;
}

async function loadPendingBundle(hodUserId, { mode = 'all' } = {}) {
  const hid = Number(hodUserId);
  const [formRows, historyRows, noteRows, formSchedules, historySettings, notesSettings] = await Promise.all([
    fetchAllPendingFormRequests(),
    fetchAllPendingHistoryRequests(),
    fetchAllPendingNotes(),
    listFormDigestSchedules(),
    getApprovalSettings(),
    getNotesHodSettings(),
  ]);
  const formAppIds = new Set(
    formSchedules.filter((row) => Number(row.hodUserId) === hid).map((row) => Number(row.appId)),
  );
  const historyDomains = new Set(
    Object.keys(DOMAIN_TABLES).filter((domain) => Number(historySettings[domain]?.hodUserId) === hid),
  );
  const notesPlants = new Set(
    Object.keys(notesSettings).filter((plant) => Number(notesSettings[plant]?.hodUserId) === hid),
  );

  let forms = formRows.filter(
    (row) => Number(row.hod_user_id) === hid || formAppIds.has(Number(row.app_id)),
  );
  let history = historyRows.filter(
    (row) => Number(row.hod_user_id) === hid || historyDomains.has(row.domain),
  );
  let notes = noteRows.filter(
    (row) => Number(row.hod_user_id) === hid || notesPlants.has(row.plant),
  );
  if (mode === 'new') {
    forms = forms.filter((row) => !row.hod_notified_at);
    history = history.filter((row) => !row.hod_notified_at);
    notes = notes.filter((row) => !row.hod_notified_at);
  }
  return { forms, history, notes };
}

/**
 * @param {number} hodUserId
 * @param {{ force?: boolean, mode?: 'all'|'new', slot?: string }} [options]
 */
async function sendCombinedDigestForHod(hodUserId, options = {}) {
  const force = Boolean(options.force);
  const mode = options.mode === 'new' ? 'new' : 'all';
  const slot = normalizeOptionalDigestTime(options.slot);
  const hid = Number(hodUserId);
  if (!hid) {
    return { sent: false, reason: 'no-hod', count: 0 };
  }

  const ist = getIstDateParts();
  if (!force && slot) {
    const slotsMap = await loadCombinedSlots();
    if (slotSentToday(slotsMap, hid, slot, ist.date)) {
      return { sent: false, reason: 'already-sent', count: 0, slot };
    }
  }

  const pending = await loadPendingBundle(hid, { mode });
  const allForCounts = mode === 'new' ? await loadPendingBundle(hid, { mode: 'all' }) : pending;
  const formCount = pending.forms.length;
  const historyCount = pending.history.length;
  const notesCount = pending.notes.length;
  const count = formCount + historyCount + notesCount;
  if (!count) {
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

  let hod;
  try {
    hod = await resolveHodUser(hid);
  } catch (err) {
    console.error(`[combinedDigest] skip HOD ${hid}:`, err.message);
    return { sent: false, reason: 'invalid-hod', count: 0, message: err.message };
  }

  const refreshedForms = formCount ? await refreshFormTokens(pending.forms) : [];
  const refreshedHistory = historyCount ? await refreshHistoryDigestTokens(pending.history) : [];
  const refreshedNotes = notesCount ? await refreshNotesDigestTokens(pending.notes) : [];

  const formEntries = refreshedForms.map(buildFormDigestEntry);
  const historyEntries = [];
  for (const row of refreshedHistory) {
    historyEntries.push(await buildHistoryDigestEntry(row));
  }
  const noteEntries = refreshedNotes.map(buildNotesDigestEntry);

  const formSplit = splitByIstDate(allForCounts.forms, ist.date);
  const historySplit = splitByIstDate(allForCounts.history, ist.date);
  const notesSplit = splitByIstDate(allForCounts.notes, ist.date, 'submitted_at');
  const previousCount = formSplit.previous.length + historySplit.previous.length + notesSplit.previous.length;
  const newTodayCount = formSplit.today.length + historySplit.today.length + notesSplit.today.length;

  await sendCombinedApprovalDigestEmail({
    to: hod.email,
    hodName: hod.name,
    digestDate: ist.date,
    forms: { entries: formEntries },
    history: { entries: historyEntries },
    notes: { entries: noteEntries },
    previousCount,
    newTodayCount,
    mode,
  });

  if (refreshedForms.length) {
    await markFormRequestsNotified(refreshedForms.map((row) => row.id), hod);
  }
  if (refreshedHistory.length) {
    await markHistoryRequestsNotified(refreshedHistory.map((row) => row.id), hod);
  }
  if (refreshedNotes.length) {
    await markNotesNotified(refreshedNotes.map((row) => row.id), hod);
  }

  if (slot) {
    await markHodSlotSent(hid, slot, ist.date);
  }

  return {
    sent: true,
    count,
    formCount,
    historyCount,
    notesCount,
    mode,
    force,
    slot: slot || null,
    hodUserId: hid,
    hodEmail: hod.email,
  };
}

async function sendCombinedDigestForFormCard(appId, options = {}) {
  const card = await loadCardSetting(appId);
  if (!card?.hodUserId) {
    return { sent: false, reason: 'no-hod', count: 0, message: 'No HOD is configured for this card.' };
  }
  return sendCombinedDigestForHod(card.hodUserId, options);
}

async function sendCombinedDigestForHistoryDomain(domain, options = {}) {
  const settings = await getApprovalSettings();
  const hodUserId = settings[domain]?.hodUserId;
  if (!hodUserId) {
    return { sent: false, reason: 'no-hod', count: 0, message: 'No HOD is configured for this plant.' };
  }
  return sendCombinedDigestForHod(hodUserId, options);
}

async function sendCombinedDigestForNotesPlant(plant, options = {}) {
  const settings = await getNotesHodSettings();
  const hodUserId = settings[plant]?.hodUserId;
  if (!hodUserId) {
    return { sent: false, reason: 'no-hod', count: 0, message: 'No HOD is configured for this plant.' };
  }
  return sendCombinedDigestForHod(hodUserId, options);
}

async function runCombinedDigestSchedulerTick() {
  const ist = getIstDateParts();
  const nowMinutes = timeToMinutes(ist.time);
  if (nowMinutes == null) {
    console.error('[combinedDigest] tick skipped: could not parse IST time', ist);
    return;
  }

  const schedules = await collectScheduleByHod();
  const slotsMap = await loadCombinedSlots();

  for (const { hodUserId, times } of schedules) {
    if (!times.length) continue;
    try {
      const pending = await loadPendingBundle(hodUserId, { mode: 'all' });
      const pendingCount = pending.forms.length + pending.history.length + pending.notes.length;
      if (!pendingCount) continue;

      for (const slot of times) {
        const digestMinutes = timeToMinutes(slot);
        if (digestMinutes == null) continue;
        if (slotSentToday(slotsMap, hodUserId, slot, ist.date)) continue;
        if (nowMinutes < digestMinutes) {
          console.log(
            `[combinedDigest] ${pendingCount} pending item(s) for HOD ${hodUserId}; waiting until ${slot} IST (now ${ist.time})`,
          );
          continue;
        }

        const result = await sendCombinedDigestForHod(hodUserId, { slot });
        if (result.sent) {
          console.log(
            `[combinedDigest] sent ${result.count} item(s) to HOD ${hodUserId} at ${slot} (forms ${result.formCount}, history ${result.historyCount}, notes ${result.notesCount})`,
          );
          if (!slotsMap[String(hodUserId)]) slotsMap[String(hodUserId)] = {};
          slotsMap[String(hodUserId)][slot] = ist.date;
        }
      }
    } catch (err) {
      console.error(`[combinedDigest] failed for HOD ${hodUserId}:`, err.message);
    }
  }
}

async function ensureCombinedDigestSchema() {
  await pool.execute(
    `INSERT INTO portal_settings (setting_key, setting_value) VALUES (?, '{}')
     ON DUPLICATE KEY UPDATE setting_key = setting_key`,
    [COMBINED_SLOTS_KEY],
  );
}

module.exports = {
  sendCombinedDigestForHod,
  sendCombinedDigestForFormCard,
  sendCombinedDigestForHistoryDomain,
  sendCombinedDigestForNotesPlant,
  runCombinedDigestSchedulerTick,
  ensureCombinedDigestSchema,
};
