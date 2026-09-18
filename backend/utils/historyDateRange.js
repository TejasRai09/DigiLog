function toDateOnly(value) {
  if (value == null) return '';
  const text = String(value).trim();
  if (!text) return '';
  return text.slice(0, 10);
}

/**
 * When both dates are present, start must not be after finish.
 * Same-day work is allowed. Missing either date is allowed.
 */
function historyDateRangeError(dateStart, dateFinish) {
  const start = toDateOnly(dateStart);
  const finish = toDateOnly(dateFinish);
  if (!start || !finish) return null;
  if (start > finish) {
    return 'Date of Start must be before Date of Finish.';
  }
  return null;
}

module.exports = { historyDateRangeError };
