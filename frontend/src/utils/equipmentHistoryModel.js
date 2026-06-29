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

export function parseEquipmentKey(key) {
  if (!key || !String(key).includes('::')) return null;
  const [section, ...rest] = String(key).split('::');
  const subSection = rest.join('::');
  if (!section || !subSection) return null;
  return { section, subSection };
}

export function equipmentKeyFromRef(ref) {
  if (!ref?.section || !(ref.sub_section || ref.subSection)) return '';
  return `${ref.section}::${ref.sub_section || ref.subSection}`;
}

export function parseEquipmentRefsFromRow(row = {}) {
  if (row.equipment_refs) {
    try {
      const raw = typeof row.equipment_refs === 'string'
        ? JSON.parse(row.equipment_refs)
        : row.equipment_refs;
      if (Array.isArray(raw)) {
        const refs = raw
          .map((ref) => {
            const section = ref?.section || '';
            const subSection = ref?.sub_section || ref?.subSection || '';
            if (!section || !subSection) return null;
            return { section, subSection };
          })
          .filter(Boolean);
        if (refs.length) return refs;
      }
    } catch {
      /* fall through */
    }
  }
  if (row.section && (row.sub_section || row.subSection)) {
    return [{
      section: row.section,
      subSection: row.sub_section || row.subSection,
    }];
  }
  return [];
}

export function equipmentKeysFromRecord(record) {
  return parseEquipmentRefsFromRow(record).map(
    (ref) => `${ref.section}::${ref.subSection}`,
  );
}

/** @deprecated use equipmentKeysFromRecord */
export function equipmentKeyFromRecord(record) {
  const keys = equipmentKeysFromRecord(record);
  return keys[0] || '';
}

export function historyRecordMatchesSection(row, section) {
  if (!section) return true;
  const refs = parseEquipmentRefsFromRow(row);
  if (!refs.length) return true;
  return refs.some((ref) => ref.section === section);
}

export function isPlaceholderNo(value) {
  return String(value || '').trim().toUpperCase() === 'NO';
}

function displayHistoryText(primary, fallback = '') {
  const main = String(primary || '').trim();
  if (main && !isPlaceholderNo(main)) return main;
  const alt = String(fallback || '').trim();
  if (alt && !isPlaceholderNo(alt)) return alt;
  return '';
}

/** API row → UI record for the maintenance history hub. */
export function historyRecordFromApi(row) {
  const equipmentRefs = parseEquipmentRefsFromRow(row);
  const first = equipmentRefs[0] || {};
  const rawObs = row.obs || '';
  const rawAct = row.act || '';
  const rawRem = row.rem || '';
  return {
    id: row.id,
    section: first.section || row.section || '',
    subSection: first.subSection || row.sub_section || row.subSection || '',
    equipmentRefs,
    equipmentKeys: equipmentRefs.map((ref) => `${ref.section}::${ref.subSection}`),
    season: normalizeSeasonFromApi(row.season),
    year: row.year || '',
    start: row.date_start ? String(row.date_start).slice(0, 10) : '',
    finish: row.date_finish ? String(row.date_finish).slice(0, 10) : '',
    observation: displayHistoryText(rawObs, rawRem),
    action: displayHistoryText(rawAct),
    repairCost: row.cost || '',
    service: row.svc || '',
    provider: row.provider || '',
    responsible: row.resp || '',
    remarks: isPlaceholderNo(rawRem) ? '' : rawRem,
    photosBefore: parseHistoryPhotos(row.img_before),
    photosAfter: parseHistoryPhotos(row.img_after),
  };
}

/** UI form → API body for POST/PUT history. */
export function historyRecordToApi(form) {
  const keys = Array.isArray(form.equipmentKeys) ? form.equipmentKeys : [];
  const fromKeys = keys.map(parseEquipmentKey).filter(Boolean);
  const fromLegacyKey = parseEquipmentKey(form.equipmentKey);
  const equipment_refs = (fromKeys.length ? fromKeys : fromLegacyKey ? [fromLegacyKey] : [])
    .map(({ section, subSection }) => ({
      section,
      sub_section: subSection,
    }));

  const body = {
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
    equipment_refs,
  };

  if (equipment_refs.length) {
    body.section = equipment_refs[0].section;
    body.sub_section = equipment_refs[0].sub_section;
  }

  return body;
}

export const EMPTY_HISTORY_FORM = {
  equipmentKeys: [],
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
