const fs = require('fs');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/mysql');
const { signToken } = require('../utils/jwt');
const { getMicrosoftUserProfile } = require('../services/microsoft.service');
const { verifyGoogleIdToken, getGoogleUserProfile } = require('../services/google.service');
const { toAuthUser } = require('../utils/userPublic');
const { unlinkStoredAvatar } = require('../utils/avatarFile');

const NO_ACCESS_MSG =
  'You do not have access to use this application. Please contact the administrator.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

const buildTokenResponse = (row) => ({
  token: signToken({ id: row.id, role: row.role }),
  user: toAuthUser(row),
});

// POST /api/auth/login
const login = async (req, res) => {
  const emailRaw = req.body?.email;
  const password = req.body?.password;

  if (!String(emailRaw ?? '').trim() || !password)
    return res.status(400).json({ message: 'Email and password are required.' });

  const email = normalizeEmail(emailRaw);
  if (!EMAIL_RE.test(email))
    return res.status(400).json({ message: 'Please enter a valid email address.' });

  const [rows] = await pool.query(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );
  const user = rows[0];

  if (!user)
    return res.status(401).json({ message: 'Invalid email or password.' });

  if (user.auth_provider === 'outlook')
    return res.status(401).json({
      message: 'This account uses Microsoft sign-in. Please use Sign in with Microsoft.',
    });

  if (user.auth_provider === 'google')
    return res.status(401).json({
      message: 'This account uses Google sign-in. Please use Sign in with Google.',
    });

  if (!user.is_active)
    return res.status(403).json({ message: 'Your account is deactivated. Contact your administrator.' });

  if (!user.password)
    return res.status(401).json({ message: 'Invalid email or password.' });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch)
    return res.status(401).json({ message: 'Invalid email or password.' });

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

// POST /api/auth/google
const googleLogin = async (req, res) => {
  const { accessToken, idToken } = req.body;

  if (!accessToken && !idToken)
    return res.status(400).json({ message: 'Google access token or ID token is required.' });

  let profile;
  try {
    profile = idToken
      ? await verifyGoogleIdToken(idToken)
      : await getGoogleUserProfile(accessToken);
  } catch (err) {
    console.error('googleLogin verify:', err.message);
    return res.status(401).json({ message: 'Invalid Google sign-in. Please try again.' });
  }

  const [rows] = await pool.query('SELECT * FROM users WHERE LOWER(email) = ?', [
    profile.email,
  ]);
  const user = rows[0];

  if (!user) {
    return res.status(403).json({ message: NO_ACCESS_MSG });
  }

  if (!user.google_id) {
    await pool.query(
      'UPDATE users SET google_id = ?, auth_provider = ? WHERE id = ?',
      [profile.googleId, 'google', user.id]
    );
    user.google_id = profile.googleId;
    user.auth_provider = 'google';
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

module.exports = { login, outlookLogin, googleLogin, getMe, uploadMyAvatar, deleteMyAvatar };
