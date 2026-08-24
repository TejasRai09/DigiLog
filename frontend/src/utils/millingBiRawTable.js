/** Column defs + row builders for Milling Division Cockpit raw tables. */

export const STOPPAGE_RAW_COLUMNS = [
  { key: 'dateIso', label: 'Date', kind: 'date' },
  { key: 'startTime', label: 'Start', kind: 'text' },
  { key: 'endTime', label: 'End', kind: 'text' },
  { key: 'hours', label: 'Loss (Hrs)', kind: 'num' },
  { key: 'section', label: 'Section', kind: 'text' },
  { key: 'machinery', label: 'Machinery', kind: 'text' },
  { key: 'remarks', label: 'Remarks', kind: 'text' },
];

export function filterSeriesByRange(series, fromDate, toDate) {
  if (!fromDate || !toDate) return series;
  const lo = fromDate <= toDate ? fromDate : toDate;
  const hi = fromDate <= toDate ? toDate : fromDate;
  return series.filter((r) => r.dateIso && r.dateIso >= lo && r.dateIso <= hi);
}

/** Min / max dateIso in a logbook series. */
export function seriesDateBounds(series) {
  let min = null;
  let max = null;
  for (const r of series || []) {
    const d = r.dateIso;
    if (!d) continue;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  return { min, max };
}

function formatTimeFromIso(timeIso) {
  if (!timeIso) return '';
  const d = new Date(timeIso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

function labelForMappingEntry(entry) {
  return entry.equipmentName || entry.variableName || entry.label || entry.variable;
}

/** Build { key, label, kind } columns for a logbook series table. */
export function buildLogbookColumns(mapping, variableKeys) {
  const labelByVar = new Map();
  for (const m of mapping || []) {
    if (m.variable) labelByVar.set(m.variable, labelForMappingEntry(m));
  }

  const cols = [
    { key: 'dateIso', label: 'Date', kind: 'date' },
    { key: 'shift', label: 'Shift', kind: 'text' },
    { key: 'timeLabel', label: 'Time', kind: 'text' },
  ];

  for (const key of variableKeys) {
    cols.push({
      key,
      label: labelByVar.get(key) || key,
      kind: 'num',
    });
  }
  return cols;
}

export function collectVariableKeys(series, prefixTest) {
  const keys = new Set();
  for (const row of series) {
    for (const k of Object.keys(row.values || {})) {
      if (!prefixTest || prefixTest(k)) keys.add(k);
    }
  }
  return [...keys].sort();
}

/** Flatten API series rows into table rows (newest first). */
export function buildLogbookTableRows(series, variableKeys, fromDate, toDate, shift = 'All') {
  let filtered = filterSeriesByRange(series, fromDate, toDate);
  if (shift && shift !== 'All') {
    const sh = shift.trim().toUpperCase();
    filtered = filtered.filter((r) => (r.shift || '').trim().toUpperCase() === sh);
  }

  return [...filtered]
    .map((row) => {
      const flat = {
        dateIso: row.dateIso,
        shift: row.shift || '',
        timeLabel: formatTimeFromIso(row.timeIso),
      };
      for (const k of variableKeys) {
        flat[k] = row.values?.[k] ?? null;
      }
      return flat;
    })
    .reverse();
}

export function buildStoppageTableRows(records) {
  return [...records].sort((a, b) => (b.dateIso || '').localeCompare(a.dateIso || ''));
}

export function isShredderVariable(key) {
  return key.startsWith('shredR_') || key.startsWith('shredL_');
}

export function isOtgVariable(key) {
  return /^M[1-4]_/.test(key);
}
