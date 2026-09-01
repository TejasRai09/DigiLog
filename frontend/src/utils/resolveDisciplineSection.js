import { findDiscipline } from '../config/engineeringDisciplines';

const POWER_DISCIPLINE_PATH_RE = /\/power-plant-equipment-new\/(?:new|\d+)\/(mechanical|civil|electrical|instrument)\/?$/i;
const SUGAR_DISCIPLINE_PATH_RE = /\/sugar-house-equipment-new\/(?:new|\d+)\/(mechanical|civil|electrical|instrument)\/?$/i;

/** Discipline id from URL path when route param is missing (e.g. older deployments). */
export function disciplineFromPathname(pathname = '') {
  const path = String(pathname);
  const match = path.match(POWER_DISCIPLINE_PATH_RE) || path.match(SUGAR_DISCIPLINE_PATH_RE);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Resolve mechanical | civil | electrical | instrument from route param, path, or router state.
 * @returns {string|null}
 */
export function resolveDisciplineSection({ disciplineParam, pathname, stateSection }) {
  const candidates = [
    disciplineParam,
    disciplineFromPathname(pathname),
    stateSection,
  ];
  for (const value of candidates) {
    const id = String(value || '').trim().toLowerCase();
    if (id && findDiscipline(id)) return id;
  }
  return null;
}

export function powerNewDetailPath(equipId, specSection = null) {
  const base = `/power-plant-equipment-new/${equipId}`;
  if (specSection && findDiscipline(specSection)) return `${base}/${specSection}`;
  return base;
}

export function sugarNewDetailPath(equipId, specSection = null) {
  const base = `/sugar-house-equipment-new/${equipId}`;
  if (specSection && findDiscipline(specSection)) return `${base}/${specSection}`;
  return base;
}
