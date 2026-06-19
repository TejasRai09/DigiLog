/** Parse stored image field (single base64 or JSON array) → string[]. */
export function parseHistoryPhotos(value) {
  if (!value) return [];
  const s = String(value);
  if (s.startsWith('data:image')) return [s];
  try {
    const parsed = JSON.parse(s);
    if (Array.isArray(parsed)) {
      return parsed.filter((x) => x && String(x).startsWith('data:image'));
    }
  } catch {
    /* legacy single value */
  }
  return [];
}

/** string[] → API image field (single or JSON array). */
export function serializeHistoryPhotos(photos) {
  const list = (photos || []).filter((x) => x && String(x).startsWith('data:image'));
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  return JSON.stringify(list);
}

export function formatEntryId(id) {
  if (!id) return 'EM-0000';
  const n = Number(id);
  if (!Number.isNaN(n) && n < 10000) {
    return `EM-${String(n).padStart(4, '0')}`;
  }
  return `EM-${String(id).slice(-4)}`;
}

export function formatDateDisplay(dateString) {
  if (!dateString || dateString === '—') return '—';
  const s = String(dateString).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yy, mm, dd] = s.split('-');
    return `${dd}-${mm}-${yy}`;
  }
  return dateString;
}

export function normalizeSeasonFromApi(season) {
  if (!season) return '';
  if (season === 'OFF Season' || season === 'Off-Season') return 'Off-Season';
  if (season === 'Season') return 'Season';
  return season;
}

export function seasonToApi(season) {
  if (!season) return null;
  return season;
}

export function isOffSeason(season) {
  return season === 'Off-Season' || season === 'OFF Season';
}

/** API row → UI record for the maintenance history hub. */
export function historyRecordFromApi(row) {
  return {
    id: row.id,
    season: normalizeSeasonFromApi(row.season),
    year: row.year || '',
    start: row.date_start ? String(row.date_start).slice(0, 10) : '',
    finish: row.date_finish ? String(row.date_finish).slice(0, 10) : '',
    observation: row.obs || '',
    action: row.act || '',
    repairCost: row.cost || '',
    service: row.svc || '',
    provider: row.provider || '',
    responsible: row.resp || '',
    remarks: row.rem || '',
    photosBefore: parseHistoryPhotos(row.img_before),
    photosAfter: parseHistoryPhotos(row.img_after),
  };
}

/** UI form → API body for POST/PUT history. */
export function historyRecordToApi(form) {
  return {
    season: seasonToApi(form.season),
    year: form.year?.trim() || null,
    date_start: form.start || null,
    date_finish: form.finish || null,
    obs: form.observation?.trim() || null,
    act: form.action?.trim() || null,
    cost: form.repairCost ? String(form.repairCost) : null,
    svc: form.service || null,
    provider: form.provider?.trim() || null,
    resp: form.responsible?.trim() || null,
    rem: form.remarks?.trim() || null,
    img_before: serializeHistoryPhotos(form.photosBefore),
    img_after: serializeHistoryPhotos(form.photosAfter),
  };
}

export const EMPTY_HISTORY_FORM = {
  season: '',
  year: '',
  start: '',
  finish: '',
  observation: '',
  action: '',
  repairCost: '',
  service: '',
  provider: '',
  responsible: '',
  remarks: '',
  photosBefore: [],
  photosAfter: [],
};

export const HISTORY_SERVICE_OPTIONS = [
  'Mechanical Overhaul',
  'Hydraulic overhaul',
  'Electrical Repair',
  'Gear Overhaul',
  'Inspection',
  'INTERNAL',
  'EXTERNAL',
  'BOTH',
];
