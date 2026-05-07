const { pool } = require('../config/mysql');

const mapApp  = (r) => ({ _id: r.id, id: r.id, name: r.name, description: r.description, icon: r.icon, color: r.color, order: r.sort_order });
const mapForm = (r) => ({ _id: r.id, id: r.id, name: r.name, description: r.description, formKey: r.form_key, order: r.sort_order });

const getAccessibleApps = async (req, res) => {
  const { user } = req;

  if (user.role === 'admin') {
    const [apps]  = await pool.query('SELECT * FROM apps  WHERE is_active = 1 ORDER BY sort_order');
    const [forms] = await pool.query('SELECT * FROM forms WHERE is_active = 1 ORDER BY sort_order');

    return res.json(
      apps.map((app) => ({
        ...mapApp(app),
        forms: forms.filter((f) => f.app_id === app.id).map(mapForm),
      }))
    );
  }

  // Employee: build result from mappings
  const [rows] = await pool.query(
    `SELECT m.id AS mapping_id, m.app_id, mf.form_id
     FROM mappings m
     LEFT JOIN mapping_forms mf ON mf.mapping_id = m.id
     WHERE m.user_id = ?`,
    [user.id]
  );

  // Group form_ids by app_id
  const byApp = {};
  for (const r of rows) {
    if (!byApp[r.app_id]) byApp[r.app_id] = [];
    if (r.form_id) byApp[r.app_id].push(r.form_id);
  }

  const result = [];
  for (const [appId, formIds] of Object.entries(byApp)) {
    const [appRows] = await pool.query('SELECT * FROM apps WHERE id = ? AND is_active = 1', [appId]);
    if (!appRows[0]) continue;

    let formRows;
    if (formIds.length === 0) {
      // No restriction → all active forms for this app
      [formRows] = await pool.query(
        'SELECT * FROM forms WHERE app_id = ? AND is_active = 1 ORDER BY sort_order',
        [appId]
      );
    } else {
      [formRows] = await pool.query(
        `SELECT * FROM forms WHERE id IN (${formIds.map(() => '?').join(',')}) AND is_active = 1 ORDER BY sort_order`,
        formIds
      );
    }

    result.push({ ...mapApp(appRows[0]), forms: formRows.map(mapForm) });
  }

  res.json(result);
};

module.exports = { getAccessibleApps };
