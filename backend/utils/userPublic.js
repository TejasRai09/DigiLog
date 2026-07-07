function resolveAvatarForClient(row) {
  const stored = row.avatar != null && row.avatar !== '' ? String(row.avatar) : null;
  if (!stored) return null;
  if (
    stored.startsWith('data:')
    || stored.startsWith('http://')
    || stored.startsWith('https://')
  ) {
    return stored;
  }
  return `/auth/users/${row.id}/avatar`;
}

/** Shape returned on /auth/me, login, and JWT-backed req.user */
const toAuthUser = (row) => ({
  id:           row.id,
  _id:          row.id,
  name:         row.name,
  email:        row.email,
  role:         row.role,
  isActive:     !!row.is_active,
  authProvider: row.auth_provider,
  department:   row.department != null && row.department !== '' ? row.department : null,
  avatar:       resolveAvatarForClient(row),
});

module.exports = { toAuthUser };
