const fs = require('fs');
const path = require('path');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
const AVATAR_DIR = path.join(UPLOADS_ROOT, 'avatars');

/** @param {string|null|undefined} stored */
function resolveAvatarAbsPath(stored) {
  if (!stored || typeof stored !== 'string') return null;
  if (stored.startsWith('data:')) return null;

  let rel = stored.replace(/\\/g, '/');
  if (rel.startsWith('/uploads/')) rel = rel.slice('/uploads/'.length);
  if (rel.startsWith('uploads/')) rel = rel.slice('uploads/'.length);
  if (!rel.startsWith('avatars/')) {
    if (!rel.includes('/')) rel = `avatars/${rel}`;
    else return null;
  }

  const abs = path.normalize(path.join(UPLOADS_ROOT, rel));
  const avatarsRoot = path.normalize(AVATAR_DIR + path.sep);
  if (!abs.startsWith(avatarsRoot)) return null;
  return abs;
}

/** @param {string|null|undefined} stored */
function unlinkStoredAvatar(stored) {
  const abs = resolveAvatarAbsPath(stored);
  if (!abs) return;
  fs.unlink(abs, () => {});
}

function avatarStorageKey(filename) {
  return `avatars/${path.basename(filename)}`;
}

module.exports = {
  unlinkStoredAvatar,
  resolveAvatarAbsPath,
  avatarStorageKey,
  UPLOADS_ROOT,
  AVATAR_DIR,
};
