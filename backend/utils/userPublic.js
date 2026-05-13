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
  avatar:       row.avatar != null && row.avatar !== '' ? row.avatar : null,
});

module.exports = { toAuthUser };
