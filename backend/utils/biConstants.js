/**
 * Shared BI calculation constants.
 * Per-season values live in `season_bi_constants` (keyed by season_mapping.season_label).
 * `portal_settings` keys remain fallback defaults when a date/season has no row.
 */
const { pool } = require('../config/mysql');

const BRIX_THRESHOLD_KEY = 'brix_threshold';
const THEORETICAL_YIELD_KEY = 'distillery_theoretical_yield';
const POWER_TARIFF_KEY = 'power_tariff_rate';

const BRIX_THRESHOLD_DEFAULT = 18;
const THEORETICAL_YIELD_DEFAULT = 64.4;
const POWER_TARIFF_DEFAULT = 4.85;

function toYmd(v) {
  if (!v) return null;
  if (typeof v === 'string') {
    const s = v.trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function todayYmd() {
  return toYmd(new Date());
}

function parsePositive(v, fallback) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function defaultsShape() {
  return {
    theoreticalYield: THEORETICAL_YIELD_DEFAULT,
    powerTariffRate: POWER_TARIFF_DEFAULT,
    brixThreshold: BRIX_THRESHOLD_DEFAULT,
  };
}

function mapRow(row, fallback) {
  const fb = fallback || defaultsShape();
  return {
    theoreticalYield: parsePositive(row?.theoretical_yield ?? row?.theoreticalYield, fb.theoreticalYield),
    powerTariffRate: parsePositive(row?.power_tariff_rate ?? row?.powerTariffRate, fb.powerTariffRate),
    brixThreshold: parsePositive(row?.brix_threshold ?? row?.brixThreshold, fb.brixThreshold),
  };
}

async function getDefaultConstants() {
  const fallback = defaultsShape();
  try {
    const [rows] = await pool.query(
      'SELECT setting_key, setting_value FROM portal_settings WHERE setting_key IN (?, ?, ?)',
      [THEORETICAL_YIELD_KEY, POWER_TARIFF_KEY, BRIX_THRESHOLD_KEY],
    );
    const map = {};
    rows.forEach((r) => { map[r.setting_key] = r.setting_value; });
    return {
      theoreticalYield: parsePositive(map[THEORETICAL_YIELD_KEY], fallback.theoreticalYield),
      powerTariffRate: parsePositive(map[POWER_TARIFF_KEY], fallback.powerTariffRate),
      brixThreshold: parsePositive(map[BRIX_THRESHOLD_KEY], fallback.brixThreshold),
    };
  } catch {
    return fallback;
  }
}

async function listSeasonMapping() {
  try {
    const [rows] = await pool.query(
      'SELECT season_label, start_date, end_date FROM season_mapping ORDER BY start_date DESC',
    );
    return rows.map((s) => ({
      seasonLabel: s.season_label,
      startDate: toYmd(s.start_date),
      endDate: toYmd(s.end_date),
    }));
  } catch {
    return [];
  }
}

function seasonMappingObject(seasons) {
  const seasonMapping = {};
  seasons.forEach((s) => {
    seasonMapping[s.seasonLabel] = { startDate: s.startDate, endDate: s.endDate };
  });
  return seasonMapping;
}

function findSeasonLabelForDate(iso, seasons) {
  const d = toYmd(iso);
  if (!d || !Array.isArray(seasons) || !seasons.length) return null;
  const hit = seasons.find((s) => s.startDate && s.endDate && d >= s.startDate && d <= s.endDate);
  return hit ? hit.seasonLabel : null;
}

/**
 * Active season: mapping that contains `date` (To), else `from` (From),
 * else `seasonLabel` if it exists, else today's season, else null.
 */
async function resolveSeasonLabel({ date, from, seasonLabel, seasons } = {}) {
  const list = seasons || await listSeasonMapping();
  const fromTo = findSeasonLabelForDate(date, list);
  if (fromTo) return fromTo;
  const fromFrom = findSeasonLabelForDate(from, list);
  if (fromFrom) return fromFrom;
  if (seasonLabel && list.some((s) => s.seasonLabel === seasonLabel)) return seasonLabel;
  return findSeasonLabelForDate(todayYmd(), list);
}

async function getConstantsBySeasonMap(defaults) {
  const fb = defaults || await getDefaultConstants();
  const map = {};
  try {
    const [rows] = await pool.query(
      'SELECT season_label, theoretical_yield, power_tariff_rate, brix_threshold FROM season_bi_constants',
    );
    rows.forEach((r) => {
      if (r?.season_label) map[r.season_label] = mapRow(r, fb);
    });
  } catch {
    // Table may not exist yet on an unmigrated database.
  }
  return map;
}

async function getSeasonConstants({ date, from, seasonLabel } = {}) {
  const [defaults, seasons] = await Promise.all([getDefaultConstants(), listSeasonMapping()]);
  const label = await resolveSeasonLabel({ date, from, seasonLabel, seasons });
  if (!label) return { ...defaults, seasonLabel: null };
  const bySeason = await getConstantsBySeasonMap(defaults);
  return { ...(bySeason[label] || defaults), seasonLabel: label };
}

async function getBrixThreshold(opts = {}) {
  const c = await getSeasonConstants(opts);
  return c.brixThreshold;
}

async function upsertSeasonConstants(seasonLabel, values) {
  await pool.query(
    `INSERT INTO season_bi_constants (season_label, theoretical_yield, power_tariff_rate, brix_threshold)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       theoretical_yield = VALUES(theoretical_yield),
       power_tariff_rate = VALUES(power_tariff_rate),
       brix_threshold = VALUES(brix_threshold)`,
    [seasonLabel, values.theoreticalYield, values.powerTariffRate, values.brixThreshold],
  );
}

async function updateDefaultConstants(values) {
  const pairs = [
    [THEORETICAL_YIELD_KEY, String(values.theoreticalYield)],
    [POWER_TARIFF_KEY, String(values.powerTariffRate)],
    [BRIX_THRESHOLD_KEY, String(values.brixThreshold)],
  ];
  for (const [key, val] of pairs) {
    await pool.query(
      `INSERT INTO portal_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, val],
    );
  }
}

async function renameSeasonConstants(oldLabel, newLabel) {
  if (!oldLabel || !newLabel || oldLabel === newLabel) return;
  try {
    await pool.query(
      `INSERT INTO season_bi_constants (season_label, theoretical_yield, power_tariff_rate, brix_threshold)
       SELECT ?, theoretical_yield, power_tariff_rate, brix_threshold
       FROM season_bi_constants WHERE season_label = ?
       ON DUPLICATE KEY UPDATE
         theoretical_yield = VALUES(theoretical_yield),
         power_tariff_rate = VALUES(power_tariff_rate),
         brix_threshold = VALUES(brix_threshold)`,
      [newLabel, oldLabel],
    );
    await pool.query('DELETE FROM season_bi_constants WHERE season_label = ?', [oldLabel]);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return;
    throw err;
  }
}

async function deleteSeasonConstants(seasonLabel) {
  if (!seasonLabel) return;
  try {
    await pool.query('DELETE FROM season_bi_constants WHERE season_label = ?', [seasonLabel]);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return;
    throw err;
  }
}

async function buildBiConstantsPayload() {
  const [defaults, seasons] = await Promise.all([getDefaultConstants(), listSeasonMapping()]);
  const bySeason = await getConstantsBySeasonMap(defaults);
  const today = todayYmd();
  const todayLabel = findSeasonLabelForDate(today, seasons);
  const current = (todayLabel && bySeason[todayLabel]) || defaults;
  return {
    defaults,
    theoreticalYield: current.theoreticalYield,
    powerTariffRate: current.powerTariffRate,
    brixThreshold: current.brixThreshold,
    constantsBySeason: bySeason,
    seasons: seasons.map((s) => ({
      ...s,
      isCurrent: Boolean(s.startDate && s.endDate && today >= s.startDate && today <= s.endDate),
    })),
    seasonMapping: seasonMappingObject(seasons),
    currentSeasonLabel: todayLabel,
  };
}

module.exports = {
  BRIX_THRESHOLD_KEY,
  THEORETICAL_YIELD_KEY,
  POWER_TARIFF_KEY,
  BRIX_THRESHOLD_DEFAULT,
  THEORETICAL_YIELD_DEFAULT,
  POWER_TARIFF_DEFAULT,
  toYmd,
  getDefaultConstants,
  getSeasonConstants,
  getBrixThreshold,
  getConstantsBySeasonMap,
  listSeasonMapping,
  upsertSeasonConstants,
  updateDefaultConstants,
  renameSeasonConstants,
  deleteSeasonConstants,
  buildBiConstantsPayload,
};
