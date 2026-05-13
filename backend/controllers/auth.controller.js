const fs = require('fs');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/mysql');
const { signToken } = require('../utils/jwt');
const { getMicrosoftUserProfile } = require('../services/microsoft.service');
const { toAuthUser } = require('../utils/userPublic');
const { unlinkStoredAvatar } = require('../utils/avatarFile');

const NO_ACCESS_MSG =
  'You do not have access to use this application. Please contact the administrator.';

const buildTokenResponse = (row) => ({
  token: signToken({ id: row.id, role: row.role }),
  user: toAuthUser(row),
});

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required.' });

  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ?',
    [email.toLowerCase()]
  );
  const user = rows[0];

  if (!user || user.auth_provider === 'outlook')
    return res.status(401).json({ message: 'Invalid credentials.' });

  if (!user.is_active)
    return res.status(403).json({ message: 'Account is deactivated.' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch)
    return res.status(401).json({ message: 'Invalid credentials.' });

  res.json(buildTokenResponse(user));
};

// POST /api/auth/outlook
const outlookLogin = async (req, res) => {
  const { accessToken } = req.body;

  if (!accessToken)
    return res.status(400).json({ message: 'Microsoft access token is required.' });

  const profile = await getMicrosoftUserProfile(accessToken);

  if (!profile.email)
    return res.status(400).json({ message: 'Could not retrieve email from Microsoft.' });

  let [rows] = await pool.query('SELECT * FROM users WHERE LOWER(email) = ?', [
    profile.email.toLowerCase(),
  ]);
  let user = rows[0];

  if (!user) {
    return res.status(403).json({ message: NO_ACCESS_MSG });
  }

  if (!user.microsoft_id) {
    await pool.query(
      'UPDATE users SET microsoft_id = ?, auth_provider = ? WHERE id = ?',
      [profile.microsoftId, 'outlook', user.id]
    );
    user.microsoft_id = profile.microsoftId;
    user.auth_provider = 'outlook';
  }
  if (!user.is_active) {
    return res.status(403).json({ message: 'Account is deactivated.' });
  }

  res.json(buildTokenResponse(user));
};

// GET /api/auth/me
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

// POST /api/auth/me/avatar — multipart field name: avatar (PNG/JPEG), stored under uploads/avatars
const uploadMyAvatar = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Image file is required (field name: avatar).' });
  }

  try {
    const publicPath = `/uploads/avatars/${req.file.filename}`;

    const [prevRows] = await pool.query('SELECT avatar FROM users WHERE id = ?', [req.user.id]);
    unlinkStoredAvatar(prevRows[0]?.avatar);

    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [publicPath, req.user.id]);
    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_active, auth_provider, department, avatar FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ user: toAuthUser(rows[0]) });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    console.error('uploadMyAvatar:', err.message);
    res.status(500).json({ message: 'Could not save profile photo.' });
  }
};

// DELETE /api/auth/me/avatar — remove file on disk if path stored
const deleteMyAvatar = async (req, res) => {
  try {
    const [prevRows] = await pool.query('SELECT avatar FROM users WHERE id = ?', [req.user.id]);
    unlinkStoredAvatar(prevRows[0]?.avatar);

    await pool.query('UPDATE users SET avatar = NULL WHERE id = ?', [req.user.id]);
    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_active, auth_provider, department, avatar FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ user: toAuthUser(rows[0]) });
  } catch (err) {
    console.error('deleteMyAvatar:', err.message);
    res.status(500).json({ message: 'Could not remove profile photo.' });
  }
};

module.exports = { login, outlookLogin, getMe, uploadMyAvatar, deleteMyAvatar };
