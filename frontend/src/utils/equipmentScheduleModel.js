import { parseEquipmentOptionKey } from './equipmentSpecModel';

export const SCHEDULE_INTERVALS = [
  { key: 'WEEK', dbKey: 'iv_W', label: 'WEEK', fullLabel: 'Weekly', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'MONT', dbKey: 'iv_M', label: 'MONT', fullLabel: 'Monthly', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'QUAR', dbKey: 'iv_Q', label: 'QUAR', fullLabel: 'Quarterly', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { key: 'HALF', dbKey: 'iv_H', label: 'HALF', fullLabel: 'Half Yearly', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { key: 'YEAR', dbKey: 'iv_Y', label: 'YEAR', fullLabel: 'Yearly', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: '2-YE', dbKey: 'iv_T', label: '2-YE', fullLabel: '2-Yearly', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { key: '3-YE', dbKey: 'iv_3Y', label: '3-YE', fullLabel: '3-Yearly', color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

const ACTIVE_MARKS = new Set(['√', 'Y', 'y', '1', 'X', 'x']);

export function parseActionSteps(act = '') {
  const raw = String(act || '').trim();
  if (!raw) return [];
  if (raw.includes('||')) {
    return raw.split('||').map((s) => s.trim()).filter(Boolean);
  }
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  if (raw.includes(';')) {
    const parts = raw.split(';').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  return [raw];
}

export function joinActionSteps(actions = []) {
  return actions.map((s) => s.trim()).filter(Boolean).join(' || ');
}

export function newScheduleId() {
  return `sched-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

function rowIntervalsFromApi(row) {
  return SCHEDULE_INTERVALS
    .filter((c) => ACTIVE_MARKS.has(String(row[c.dbKey] || '').trim()))
    .map((c) => c.key);
}

function equipmentKeysFromScheduleRow(row = {}) {
  if (row.equipment_refs) {
    try {
      const raw = typeof row.equipment_refs === 'string'
        ? JSON.parse(row.equipment_refs)
        : row.equipment_refs;
      if (Array.isArray(raw)) {
        const keys = raw
          .map((ref) => {
            const section = ref?.section || '';
            const subSection = ref?.sub_section || ref?.subSection || '';
            if (!section || !subSection) return null;
            return `${section}::${subSection}`;
          })
          .filter(Boolean);
        if (keys.length) return keys;
      }
    } catch {
      /* fall through */
    }
  }

  const subSection = row.sub_section ?? row.subSection ?? '';
  if (row.section && subSection) {
    return [`${row.section}::${subSection}`];
  }
  return [];
}

/** API schedule rows → UI model */
export function parseScheduleFromApi(rows = []) {
  return rows
    .slice()
    .sort((a, b) => (a.no ?? 0) - (b.no ?? 0))
    .map((row, index) => {
      const actions = parseActionSteps(row.act);
      return {
        id: String(row.id ?? newScheduleId()),
        no: row.no ?? index + 1,
        equipmentKeys: equipmentKeysFromScheduleRow(row),
        component: row.comp ?? '',
        actions: actions.length ? actions : [''],
        intervals: rowIntervalsFromApi(row),
      };
    });
}

/** UI model → API payload */
export function serializeScheduleForApi(rows = []) {
  return rows
    .filter((r) => r.component?.trim() || r.actions?.some((a) => a?.trim()))
    .map((row, index) => {
      const intervals = row.intervals || [];
      const keys = Array.isArray(row.equipmentKeys) ? row.equipmentKeys : [];
      const refs = keys.map((key) => parseEquipmentOptionKey(key)).filter(Boolean);
      const payload = {
        no: index + 1,
        comp: row.component?.trim() ?? '',
        act: joinActionSteps(row.actions),
      };
      if (refs.length) {
        payload.section = refs[0].section;
        payload.sub_section = refs[0].subSection;
        payload.equipment_refs = refs.map((ref) => ({
          section: ref.section,
          sub_section: ref.subSection,
        }));
      }
      for (const cfg of SCHEDULE_INTERVALS) {
        payload[cfg.dbKey] = intervals.includes(cfg.key) ? '√' : null;
      }
      return payload;
    });
}
