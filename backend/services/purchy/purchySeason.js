/**
 * Grower Intelligence season follows the imported workbook.
 * 2025 = Season 2025-26 (Weight Qty 2025). 2026 = Season 2026-27 (supply2026).
 */
const SETTING_KEY = 'purchy_current_season_year';

function normalizeSeasonYear(value) {
  const year = Number(value);
  return year === 2026 ? 2026 : 2025;
}

function historyYears(seasonYear) {
  const year = normalizeSeasonYear(seasonYear);
  const years = ['2021', '2022', '2023', '2024'];
  if (year === 2026) years.push('2025');
  return years;
}

function loyaltySlicerLabel(seasonYear) {
  const year = normalizeSeasonYear(seasonYear);
  const to = year - 1;
  const from = year - 5;
  const yy = (n) => String(n).slice(-2);
  return `Loyalty_Slicer ('${yy(from)}-'${yy(to)})`;
}

function seasonLabel(name, seasonYear) {
  return `${normalizeSeasonYear(seasonYear)} ${name}`;
}

/** Chip text for the imported crushing season, e.g. 2025-2026. */
function seasonChipLabel(seasonYear) {
  const year = normalizeSeasonYear(seasonYear);
  return `${year}-${year + 1}`;
}

function normalizeSeasonLabel(label) {
  return String(label || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[–—]/g, '-');
}

/** Start and end from Season Mapping for the imported season, else the latest mapped season. */
async function seasonBoundsForYear(seasonYear) {
  const { listSeasonMapping } = require('../../utils/biConstants');
  const year = normalizeSeasonYear(seasonYear);
  const seasons = await listSeasonMapping();
  const wanted = new Set([
    normalizeSeasonLabel(`${year}-${year + 1}`),
    normalizeSeasonLabel(`${year}-${String(year + 1).slice(-2)}`),
  ]);
  const exact = seasons.find((s) => wanted.has(normalizeSeasonLabel(s.seasonLabel)));
  const latest = [...seasons].sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)))[0];
  const chosen = exact || latest || null;
  if (!chosen?.startDate || !chosen?.endDate) {
    return { seasonDateFrom: null, seasonDateTo: null, seasonDateLabel: null };
  }
  return {
    seasonDateFrom: chosen.startDate,
    seasonDateTo: chosen.endDate,
    seasonDateLabel: chosen.seasonLabel,
  };
}

function loyaltyCountExpr(seasonYear) {
  const cols = normalizeSeasonYear(seasonYear) === 2026
    ? ['supply_2021', 'supply_2022', 'supply_2023', 'supply_2024', 'supply_2025']
    : ['supply_2020', 'supply_2021', 'supply_2022', 'supply_2023', 'supply_2024'];
  return cols.map((col) => `IF(IFNULL(\`${col}\`, 0) > 0, 1, 0)`).join(' + ');
}

function loyaltyAssignmentSql(seasonYear) {
  const count = loyaltyCountExpr(seasonYear);
  return `CASE (${count})
    WHEN 5 THEN '5. Supplied 5 years'
    WHEN 4 THEN '4. Supplied 4 years'
    WHEN 3 THEN '3. Supplied 3 years'
    WHEN 2 THEN '2. Supplied 2 years'
    WHEN 1 THEN '1. Supplied 1 year'
    ELSE '0. Never supplied'
  END`;
}

async function readSavedSeasonYear(conn) {
  const [[row]] = await conn.query(
    'SELECT setting_value FROM portal_settings WHERE setting_key = ? LIMIT 1',
    [SETTING_KEY],
  );
  const year = Number(row?.setting_value);
  return year === 2025 || year === 2026 ? year : null;
}

async function inferSeasonYear(conn) {
  const [[row]] = await conn.query(
    `SELECT SUM(
       CASE WHEN IFNULL(supply_2025, 0) <> 0 OR IFNULL(issue25, 0) <> 0 THEN 1 ELSE 0 END
     ) AS n
     FROM purchy_grower_summary`,
  );
  return Number(row?.n) > 0 ? 2026 : 2025;
}

async function saveSeasonYear(conn, seasonYear) {
  const year = String(normalizeSeasonYear(seasonYear));
  await conn.query(
    `INSERT INTO portal_settings (setting_key, setting_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [SETTING_KEY, year],
  );
  return Number(year);
}

/** Saved year, or inferred from loaded columns and then saved. */
async function resolveSeasonYear(conn) {
  const saved = await readSavedSeasonYear(conn);
  if (saved) return saved;
  const inferred = await inferSeasonYear(conn);
  await saveSeasonYear(conn, inferred);
  return inferred;
}

/** Rewrite loyalty_slicer for every grower to match the imported file's year window. */
async function applyLoyaltyForSeason(conn, seasonYear) {
  const year = normalizeSeasonYear(seasonYear);
  await conn.query(
    `UPDATE purchy_grower_summary SET loyalty_slicer = ${loyaltyAssignmentSql(year)}`,
  );
  await saveSeasonYear(conn, year);
  return year;
}

module.exports = {
  SETTING_KEY,
  normalizeSeasonYear,
  historyYears,
  loyaltySlicerLabel,
  seasonLabel,
  seasonChipLabel,
  seasonBoundsForYear,
  loyaltyAssignmentSql,
  readSavedSeasonYear,
  inferSeasonYear,
  saveSeasonYear,
  resolveSeasonYear,
  applyLoyaltyForSeason,
};
