export const EMPTY = '—';

export function hasValue(v) {
  return v !== '' && v !== null && v !== undefined;
}

export function formatDate(iso) {
  if (!hasValue(iso)) return EMPTY;
  const [y, m, d] = String(iso).split('-');
  if (y && m && d) return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  return String(iso);
}

export function formatDateTimeLocal(v) {
  if (!hasValue(v)) return EMPTY;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function displayValue(v, opts = {}) {
  if (!hasValue(v)) return EMPTY;
  if (opts.date) return formatDate(v);
  if (opts.dateTime) return formatDateTimeLocal(v);
  let s = String(v);
  if (opts.percent && !s.includes('%')) s = `${s}%`;
  if (opts.suffix) s = `${s}${opts.suffix}`;
  return s;
}

/** @param {Record<string, unknown>} form @param {{ key: string, label: string, date?: boolean, dateTime?: boolean, percent?: boolean, suffix?: string }[]} defs */
export function fieldsFromDefs(form, defs, { onlyFilled = true } = {}) {
  const fields = defs.map((d) => ({
    label: d.label,
    value: displayValue(form[d.key], d),
  }));
  return onlyFilled ? fields.filter((f) => f.value !== EMPTY) : fields;
}

export function labSummary(form, extra = []) {
  const items = [{ label: 'Report Date', value: formatDate(form.date) }];
  if (hasValue(form.shift)) items.push({ label: 'Shift', value: form.shift, badge: true });
  if (hasValue(form.op_mode)) items.push({ label: 'Mode of Operation', value: form.op_mode, badge: true });
  if (hasValue(form.samplingTime)) items.push({ label: 'Sampling Time', value: form.samplingTime });
  if (hasValue(form.time)) items.push({ label: 'Time', value: form.time });
  return [...items, ...extra];
}

export function millSummary(form) {
  return labSummary(form);
}

const SUBTITLE =
  'Verify all inputs and calculations prior to final log commitment.';

export function reviewMeta(title, summary, sections) {
  return { title, subtitle: SUBTITLE, summary, sections };
}
