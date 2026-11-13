/** Grower Intelligence labels follow the imported file. 2025 = 2025-26, 2026 = 2026-27. */

export function normalizeSeasonYear(value) {
  return Number(value) === 2026 ? 2026 : 2025;
}

export function loyaltySlicerLabel(seasonYear) {
  const year = normalizeSeasonYear(seasonYear);
  const to = year - 1;
  const from = year - 5;
  const yy = (n) => String(n).slice(-2);
  return `Loyalty_Slicer ('${yy(from)}-'${yy(to)})`;
}

export function seasonLabel(name, seasonYear) {
  return `${normalizeSeasonYear(seasonYear)} ${name}`;
}

/** Imported crushing season, e.g. 2025-2026. */
export function seasonChipLabel(seasonYear) {
  const year = normalizeSeasonYear(seasonYear);
  return `${year}-${year + 1}`;
}
