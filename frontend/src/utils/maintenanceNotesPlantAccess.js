/** Map Config employee category → Maintenance Notes plant. Distillery is Sugar House. */

function normalizeCategory(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function plantFromUserCategory(department) {
  const raw = normalizeCategory(department);
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, '');
  if (compact.includes('distill') || compact === 'sugar' || compact.includes('sugarhouse')) return 'sugar';
  if (compact.includes('powerplant') || compact === 'power' || compact.startsWith('power')) return 'power';
  if (compact === 'production' || compact.startsWith('production') || compact.includes('producton')) return 'production';
  return null;
}

export function lockedPlantForUser(user) {
  if (!user || user.role === 'admin') return null;
  return plantFromUserCategory(user.department);
}

export function canUseMaintenanceNotes(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Boolean(plantFromUserCategory(user.department));
}
