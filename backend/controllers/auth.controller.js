const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/mysql');
const { signToken } = require('../utils/jwt');
const { getMicrosoftUserProfile } = require('../services/microsoft.service');
const { verifyGoogleIdToken, getGoogleUserProfile } = require('../services/google.service');
const { toAuthUser } = require('../utils/userPublic');
const { unlinkStoredAvatar, avatarStorageKey, resolveAvatarAbsPath } = require('../utils/avatarFile');
const { logServerError, sendServerError, MSG } = require('../utils/httpError');

const NO_ACCESS_MSG =
  'You do not have access to use this application. Please contact the administrator.';

const HOME_PORTAL_DENIED_MSG = 'You do not have permission to sign in on this page.';

const NOT_ADMIN_MSG = 'You do not have permission to sign in on this page.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

/** @returns {{ ok: true } | { ok: false, status: number, message: string }} */
const enforceAdminPortalRules = (user, adminPortal) => {
  const isAdmin = user.role === 'admin';
  if (adminPortal) {
    if (!isAdmin) return { ok: false, status: 403, message: NOT_ADMIN_MSG };
  } else if (isAdmin) {
    return { ok: false, status: 403, message: HOME_PORTAL_DENIED_MSG };
  }
  return { ok: true };
};

const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

const buildTokenResponse = (row) => ({
  token: signToken({ id: row.id, role: row.role }),
  user: toAuthUser(row),
});

// POST /api/auth/login
const login = async (req, res) => {
  try {
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

    const portalCheck = enforceAdminPortalRules(user, Boolean(req.body?.adminPortal));
    if (!portalCheck.ok)
      return res.status(portalCheck.status).json({ message: portalCheck.message });

    res.json(buildTokenResponse(user));
  } catch (err) {
    sendServerError(res, 'login', err, MSG.SERVER);
  }
};

// POST /api/auth/outlook
const outlookLogin = async (req, res) => {
  try {
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

    const portalCheck = enforceAdminPortalRules(user, Boolean(req.body?.adminPortal));
    if (!portalCheck.ok)
      return res.status(portalCheck.status).json({ message: portalCheck.message });

    res.json(buildTokenResponse(user));
  } catch (err) {
    sendServerError(res, 'outlookLogin', err, MSG.SERVER);
  }
};

// POST /api/auth/google
const googleLogin = async (req, res) => {
  try {
    const { accessToken, idToken } = req.body;

    if (!accessToken && !idToken)
      return res.status(400).json({ message: 'Google access token or ID token is required.' });

    let profile;
    try {
      profile = idToken
        ? await verifyGoogleIdToken(idToken)
        : await getGoogleUserProfile(accessToken);
    } catch (err) {
      logServerError('googleLogin verify', err);
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

    const portalCheck = enforceAdminPortalRules(user, Boolean(req.body?.adminPortal));
    if (!portalCheck.ok)
      return res.status(portalCheck.status).json({ message: portalCheck.message });

    res.json(buildTokenResponse(user));
  } catch (err) {
    sendServerError(res, 'googleLogin', err, MSG.SERVER);
  }
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
    const storedKey = avatarStorageKey(req.file.filename);

    const [prevRows] = await pool.query('SELECT avatar FROM users WHERE id = ?', [req.user.id]);
    unlinkStoredAvatar(prevRows[0]?.avatar);

    await pool.query('UPDATE users SET avatar = ? WHERE id = ?', [storedKey, req.user.id]);
    const [rows] = await pool.query(
      'SELECT id, name, email, role, is_active, auth_provider, department, avatar FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ user: toAuthUser(rows[0]) });
  } catch (err) {
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    sendServerError(res, 'uploadMyAvatar', err, MSG.SAVE);
  }
};

/** GET /api/auth/users/:userId/avatar — authenticated; files are not public under /uploads */
const getUserAvatar = async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }

  try {
    const [[row]] = await pool.query(
      'SELECT id, avatar, is_active FROM users WHERE id = ? LIMIT 1',
      [userId],
    );
    if (!row || !row.is_active || !row.avatar) {
      return res.status(404).json({ message: 'Avatar not found.' });
    }

    const stored = String(row.avatar);
    if (stored.startsWith('data:')) {
      const match = stored.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return res.status(404).json({ message: 'Avatar not found.' });
      const buf = Buffer.from(match[2], 'base64');
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.type(match[1]).send(buf);
    }

    const abs = resolveAvatarAbsPath(stored);
    if (!abs || !fs.existsSync(abs)) {
      return res.status(404).json({ message: 'Avatar not found.' });
    }

    const ext = path.extname(abs).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.type(mime);
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    sendServerError(res, 'getUserAvatar', err, MSG.LOAD);
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
    sendServerError(res, 'deleteMyAvatar', err, MSG.DELETE);
  }
};

module.exports = { login, outlookLogin, googleLogin, getMe, uploadMyAvatar, deleteMyAvatar, getUserAvatar };
