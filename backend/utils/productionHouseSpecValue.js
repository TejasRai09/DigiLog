/**
 * Production House spec values sometimes use trailing "F" for diameter (Φ).
 * Replace a final F with Φ (skip values ending in "/F" e.g. B/F).
 */
function formatProductionHouseSpecValue(value) {
  if (value == null || value === '') return value;
  const s = String(value);
  const trimmedEnd = s.replace(/\s+$/, '');
  if (!trimmedEnd.endsWith('F') && !trimmedEnd.endsWith('f')) return s;
  if (trimmedEnd.endsWith('/F') || trimmedEnd.endsWith('/f')) return s;
  const withoutF = trimmedEnd.slice(0, -1);
  const trailingWs = s.slice(trimmedEnd.length);
  return `${withoutF}Φ${trailingWs}`;
}

module.exports = { formatProductionHouseSpecValue };
