/**
 * Audit/activity From–To dates are IST calendar days.
 * DATETIME columns are stored as UTC (session time_zone +00:00).
 */

const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})$/;

function pad(n) {
  return String(n).padStart(2, '0');
}

function toMysqlUtc(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function istDayStartUtc(yyyyMmDd) {
  return toMysqlUtc(new Date(`${yyyyMmDd}T00:00:00+05:30`));
}

function istDayEndUtc(yyyyMmDd) {
  return toMysqlUtc(new Date(`${yyyyMmDd}T23:59:59+05:30`));
}

function boundValue(raw, endOfDay) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (DATE_ONLY.test(s)) return endOfDay ? istDayEndUtc(s) : istDayStartUtc(s);
  return s;
}

/** Append column >= IST-from and column <= IST-to (UTC DATETIME strings). */
function pushIstDayRange(where, params, column, from, to) {
  const start = boundValue(from, false);
  const end = boundValue(to, true);
  if (start) {
    where.push(`${column} >= ?`);
    params.push(start);
  }
  if (end) {
    where.push(`${column} <= ?`);
    params.push(end);
  }
}

module.exports = {
  istDayStartUtc,
  istDayEndUtc,
  pushIstDayRange,
};
