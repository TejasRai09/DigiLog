function pad(n) {
  return String(n).padStart(2, '0');
}

/** Local calendar date as YYYY-MM-DD for `<input type="date">`. */
export function todayDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local clock as HH:mm for `<input type="time">`. */
export function nowTime(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local value for `<input type="datetime-local">`. */
export function nowDateTimeLocal(d = new Date()) {
  return `${todayDate(d)}T${nowTime(d)}`;
}

export function nowForInputType(type, offsetMinutes = 0) {
  const d = new Date();
  if (offsetMinutes) d.setMinutes(d.getMinutes() + offsetMinutes);
  if (type === 'date') return todayDate(d);
  if (type === 'time') return nowTime(d);
  if (type === 'datetime-local') return nowDateTimeLocal(d);
  return '';
}

/** End / To fields get now + 1 hour so From < To stays valid. */
export function autoNowOffsetMinutes(name = '') {
  return /^(endTime|end_time|end)$/i.test(String(name)) ? 60 : 0;
}
