function normalizeCategory(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function plantFromUserCategory(department) {
  const raw = normalizeCategory(department);
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, '');
  if (compact.includes('distill')) return null;
  if (compact.includes('sugarhouse') || compact === 'sugar' || compact.startsWith('sugar')) return 'sugar';
  if (compact.includes('powerplant') || compact === 'power' || compact.startsWith('power')) return 'power';
  if (compact === 'production' || compact.startsWith('production') || compact.includes('producton')) return 'production';
  return null;
}

function lockedPlantForUser(user) {
  if (!user || user.role === 'admin') return null;
  return plantFromUserCategory(user.department);
}

function canUseMaintenanceNotesRegister(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Boolean(plantFromUserCategory(user.department));
}

const HOD_PLANTS = ['sugar', 'power', 'production'];

/** Keep only the plant that matches the employee's Config category. Admin keeps assigned plants. */
function scopeHodPlantsByCategory(access, user) {
  const next = { ...(access || {}) };
  if (user && user.role !== 'admin') {
    const locked = lockedPlantForUser(user);
    for (const plant of HOD_PLANTS) {
      if (Object.prototype.hasOwnProperty.call(next, plant)) {
        next[plant] = Boolean(locked && plant === locked && next[plant]);
      }
    }
  }
  if (Object.prototype.hasOwnProperty.call(next, 'enabled')) {
    next.enabled = HOD_PLANTS.some((plant) => next[plant]);
  }
  return next;
}

/**
 * HOD in-app push / inbox: admin always; others only for their Config category plant.
 * Unknown plant on a typed notification is allowed when the user has a locked plant.
 */
function userMayReceivePlantNotification(user, plant) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const locked = lockedPlantForUser(user);
  if (!locked) return false;
  const scoped = String(plant || '').trim();
  if (!scoped) return true;
  return locked === scoped;
}

module.exports = {
  plantFromUserCategory,
  lockedPlantForUser,
  canUseMaintenanceNotesRegister,
  scopeHodPlantsByCategory,
  userMayReceivePlantNotification,
};
