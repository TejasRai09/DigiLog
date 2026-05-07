const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const { pool } = require('../config/mysql');
const { sendAccountActivationEmail } = require('../services/email.service');

// ─── Mappers ─────────────────────────────────────────────────
const mapUser = (r) => ({
  _id:          r.id,
  id:           r.id,
  name:         r.name,
  email:        r.email,
  role:         r.role,
  isActive:     !!r.is_active,
  authProvider: r.auth_provider,
  mailSent:     !!r.mail_sent,
  createdAt:    r.created_at,
});

const mapApp = (r) => ({
  _id:         r.id,
  id:          r.id,
  name:        r.name,
  description: r.description,
  icon:        r.icon,
  color:       r.color,
  order:       r.sort_order,
});

const mapForm = (r) => ({
  _id:         r.id,
  id:          r.id,
  name:        r.name,
  description: r.description,
  formKey:     r.form_key,
  order:       r.sort_order,
});

// ─── User management ─────────────────────────────────────────

// GET /api/admin/users
const getUsers = async (_req, res) => {
  const [rows] = await pool.query('SELECT * FROM users ORDER BY created_at DESC');
  res.json(rows.map(mapUser));
};

// POST /api/admin/users
const createUser = async (req, res) => {
  const { name, email, role } = req.body;

  if (!name || !email)
    return res.status(400).json({ message: 'Name and email are required.' });

  const [exists] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (exists.length)
    return res.status(409).json({ message: 'Email already registered.' });

  const tempPassword = crypto.randomBytes(6).toString('hex');
  const hashed       = await bcrypt.hash(tempPassword, 12);

  const [result] = await pool.query(
    `INSERT INTO users (name, email, password, role, auth_provider, is_active, mail_sent)
     VALUES (?, ?, ?, ?, 'local', 1, 0)`,
    [name, email.toLowerCase(), hashed, role || 'employee']
  );

  res.status(201).json({
    message: 'User created. Use "Send Mail" to send login credentials.',
    user: { _id: result.insertId, id: result.insertId, name, email: email.toLowerCase(), role: role || 'employee', mailSent: false },
  });
};

// POST /api/admin/users/:id/send-mail
const sendMailToUser = async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  const user = rows[0];

  if (!user) return res.status(404).json({ message: 'User not found.' });
  if (user.auth_provider !== 'local')
    return res.status(400).json({ message: 'Cannot send mail to Outlook users.' });

  const tempPassword = crypto.randomBytes(6).toString('hex');
  const hashed       = await bcrypt.hash(tempPassword, 12);

  await pool.query(
    'UPDATE users SET password = ?, mail_sent = 1 WHERE id = ?',
    [hashed, user.id]
  );

  await sendAccountActivationEmail({ to: user.email, name: user.name, tempPassword });

  res.json({ message: 'Activation email sent.', userId: user.id });
};

// POST /api/admin/users/send-mail-bulk
const sendMailBulk = async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0)
    return res.status(400).json({ message: 'userIds array is required.' });

  const results = await Promise.allSettled(
    userIds.map(async (id) => {
      const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
      const user = rows[0];
      if (!user || user.auth_provider !== 'local') throw new Error(`Skipped ${id}`);

      const tempPassword = crypto.randomBytes(6).toString('hex');
      const hashed       = await bcrypt.hash(tempPassword, 12);

      await pool.query('UPDATE users SET password = ?, mail_sent = 1 WHERE id = ?', [hashed, id]);
      await sendAccountActivationEmail({ to: user.email, name: user.name, tempPassword });
      return id;
    })
  );

  const sent   = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = results.filter((r) => r.status === 'rejected').length;

  res.json({ message: `Sent ${sent.length} email(s). ${failed} failed.`, sent });
};

// PUT /api/admin/users/:id
const updateUser = async (req, res) => {
  const { name, role, isActive } = req.body;
  const fields = [];
  const vals   = [];

  if (name      !== undefined) { fields.push('name = ?');      vals.push(name); }
  if (role      !== undefined) { fields.push('role = ?');      vals.push(role); }
  if (isActive  !== undefined) { fields.push('is_active = ?'); vals.push(isActive ? 1 : 0); }

  if (!fields.length) return res.status(400).json({ message: 'Nothing to update.' });

  vals.push(req.params.id);
  await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);

  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ message: 'User not found.' });

  res.json(mapUser(rows[0]));
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
  res.json({ message: 'User deleted.' });
};

// ─── Mapping management ──────────────────────────────────────

// GET /api/admin/mappings
const getMappings = async (_req, res) => {
  const [mappings] = await pool.query(`
    SELECT m.id, m.user_id, m.app_id,
           u.name AS u_name, u.email AS u_email, u.role AS u_role,
           a.name AS a_name
    FROM mappings m
    JOIN users u ON u.id = m.user_id
    JOIN apps  a ON a.id = m.app_id
    ORDER BY m.id
  `);

  const [mf] = await pool.query(`
    SELECT mf.mapping_id, f.id, f.name, f.form_key
    FROM mapping_forms mf
    JOIN forms f ON f.id = mf.form_id
  `);

  const result = mappings.map((m) => ({
    _id:   m.id,
    id:    m.id,
    user:  { _id: m.user_id, id: m.user_id, name: m.u_name, email: m.u_email, role: m.u_role },
    app:   { _id: m.app_id,  id: m.app_id,  name: m.a_name },
    forms: mf.filter((f) => f.mapping_id === m.id).map((f) => ({
      _id: f.id, id: f.id, name: f.name, formKey: f.form_key,
    })),
  }));

  res.json(result);
};

// POST /api/admin/mappings  – upsert
const upsertMapping = async (req, res) => {
  const { userId, appId, formIds } = req.body;

  if (!userId || !appId)
    return res.status(400).json({ message: 'userId and appId are required.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Upsert the mapping row
    await conn.query(
      `INSERT INTO mappings (user_id, app_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
      [userId, appId]
    );
    const [[{ id: mappingId }]] = await conn.query('SELECT LAST_INSERT_ID() AS id');

    // Replace mapping_forms
    await conn.query('DELETE FROM mapping_forms WHERE mapping_id = ?', [mappingId]);
    if (Array.isArray(formIds) && formIds.length > 0) {
      const vals = formIds.map((fId) => [mappingId, fId]);
      await conn.query('INSERT INTO mapping_forms (mapping_id, form_id) VALUES ?', [vals]);
    }

    await conn.commit();
    res.json({ message: 'Mapping saved.', mappingId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// DELETE /api/admin/mappings/:id
const deleteMapping = async (req, res) => {
  await pool.query('DELETE FROM mappings WHERE id = ?', [req.params.id]);
  res.json({ message: 'Mapping removed.' });
};

// ─── App & Form management (admin convenience) ───────────────

// GET /api/admin/apps-all  (all apps + forms, regardless of mapping)
const getAllAppsWithForms = async (_req, res) => {
  const [apps]  = await pool.query('SELECT * FROM apps  ORDER BY sort_order');
  const [forms] = await pool.query('SELECT * FROM forms ORDER BY sort_order');

  const result = apps.map((app) => ({
    ...mapApp(app),
    forms: forms.filter((f) => f.app_id === app.id).map(mapForm),
  }));

  res.json(result);
};

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  sendMailToUser,
  sendMailBulk,
  getMappings,
  upsertMapping,
  deleteMapping,
  getAllAppsWithForms,
};
