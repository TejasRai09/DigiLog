const bcrypt = require('bcryptjs');
const { pool }                    = require('../config/mysql');
const { signToken }               = require('../utils/jwt');
const { getMicrosoftUserProfile } = require('../services/microsoft.service');

const NO_ACCESS_MSG =
  'You do not have access to use this application. Please contact the administrator.';

const buildTokenResponse = (row) => ({
  token: signToken({ id: row.id, role: row.role }),
  user: {
    id:           row.id,
    _id:          row.id,
    name:         row.name,
    email:        row.email,
    role:         row.role,
    authProvider: row.auth_provider,
  },
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

module.exports = { login, outlookLogin, getMe };
