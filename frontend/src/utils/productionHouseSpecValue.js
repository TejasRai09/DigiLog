/**
 * Production House spec values sometimes use trailing "F" for diameter (Φ).
 */
export function formatProductionHouseSpecValue(value) {
  if (value == null || value === '') return value;
  const s = String(value);
  const trimmedEnd = s.replace(/\s+$/, '');
  if (!trimmedEnd.endsWith('F') && !trimmedEnd.endsWith('f')) return s;
  if (trimmedEnd.endsWith('/F') || trimmedEnd.endsWith('/f')) return s;
  const withoutF = trimmedEnd.slice(0, -1);
  const trailingWs = s.slice(trimmedEnd.length);
  return `${withoutF}Φ${trailingWs}`;
}

export function formatProductionHouseSpecRows(rows = []) {
  return rows.map((row) => {
    if (!row || row.lbl === '__subsections__' || row.lbl === '__subgroup_meta__') return row;
    return { ...row, val: formatProductionHouseSpecValue(row.val) };
  });
}
