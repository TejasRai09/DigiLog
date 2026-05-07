const { verifyToken } = require('../utils/jwt');
const { pool }        = require('../config/mysql');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer '))
    return res.status(401).json({ message: 'No token provided.' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);

    const [rows] = await pool.query(
      `SELECT id, name, email, role, is_active, auth_provider
       FROM users WHERE id = ?`,
      [decoded.id]
    );
    const row = rows[0];

    if (!row)          return res.status(401).json({ message: 'User not found.' });
    if (!row.is_active) return res.status(403).json({ message: 'Account is deactivated.' });

    req.user = {
      id:           row.id,
      _id:          row.id,
      name:         row.name,
      email:        row.email,
      role:         row.role,
      isActive:     !!row.is_active,
      authProvider: row.auth_provider,
    };

    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

module.exports = { authenticate };
