const fs = require('fs');
const path = require('path');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

/** @param {string|null|undefined} stored */
function unlinkStoredAvatar(stored) {
  if (!stored || typeof stored !== 'string') return;
  if (!stored.startsWith('/uploads/')) return;
  const rel = stored.replace(/^\/uploads\//, '');
  const abs = path.join(UPLOADS_ROOT, rel);
  if (!abs.startsWith(UPLOADS_ROOT)) return;
  fs.unlink(abs, () => {});
}

module.exports = { unlinkStoredAvatar, UPLOADS_ROOT };
