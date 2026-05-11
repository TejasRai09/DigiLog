const { pool } = require('../config/mysql');

const getEq = async (id) => {
  const [[eq]] = await pool.execute('SELECT * FROM pp_equipment WHERE id = ?', [id]);
  return eq || null;
};

// GET /api/power  (?dept=electrical|instrument|instrument2)
const listEquipment = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  || '1',   10));
    const limit = Math.min(200, parseInt(req.query.limit || '100', 10));
    const q     = req.query.q    || '';
    const dept  = req.query.dept || '';
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    if (dept) { conditions.push('dept = ?'); params.push(dept); }
    if (q)    { conditions.push('(name LIKE ? OR equip_no LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM pp_equipment ${where}`, params
    );
    const [rows] = await pool.query(
      `SELECT id, dept, equip_no, name, location, commissioned, drive, sort_order
       FROM pp_equipment ${where} ORDER BY sort_order ASC, id ASC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json({ total, page, limit, equipment: rows });
  } catch (err) {
    console.error('power.listEquipment:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

// GET /api/power/:id
const getEquipment = async (req, res) => {
  try {
    const eq = await getEq(req.params.id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found.' });

    const [specs]    = await pool.execute(
      'SELECT * FROM pp_specs WHERE equip_id = ? ORDER BY sort_order, id', [eq.id]
    );
    const [schedule] = await pool.execute(
      'SELECT * FROM pp_oem_schedule WHERE equip_id = ? ORDER BY no', [eq.id]
    );
    const [[{ total }]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM pp_history WHERE equip_id = ?', [eq.id]
    );
    const [history] = await pool.execute(
      'SELECT * FROM pp_history WHERE equip_id = ? ORDER BY created_at DESC LIMIT 20', [eq.id]
    );

    res.json({ equipment: eq, specs, schedule, history, histTotal: total });
  } catch (err) {
    console.error('power.getEquipment:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

// PUT /api/power/:id
const updateEquipment = async (req, res) => {
  try {
    const eq = await getEq(req.params.id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found.' });
    const { name, equip_no, location, commissioned, drive } = req.body;
    await pool.execute(
      'UPDATE pp_equipment SET name=?, equip_no=?, location=?, commissioned=?, drive=? WHERE id=?',
      [name ?? eq.name, equip_no ?? eq.equip_no, location ?? eq.location,
       commissioned ?? eq.commissioned, drive ?? eq.drive, eq.id]
    );
    res.json({ message: 'Equipment updated.' });
  } catch (err) {
    console.error('power.updateEquipment:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

// PUT /api/power/:id/image/:type
const uploadImage = async (req, res) => {
  try {
    const { id, type } = req.params;
    if (!['photo', 'plate'].includes(type))
      return res.status(400).json({ message: 'Invalid image type.' });
    const { data } = req.body;
    if (!data || !String(data).startsWith('data:image'))
      return res.status(400).json({ message: 'Invalid image data.' });
    await pool.execute(`UPDATE pp_equipment SET \`${type}\` = ? WHERE id = ?`, [data, id]);
    res.json({ message: `${type} updated.` });
  } catch (err) {
    console.error('power.uploadImage:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

// DELETE /api/power/:id/image/:type
const deleteImage = async (req, res) => {
  try {
    const { id, type } = req.params;
    if (!['photo', 'plate'].includes(type))
      return res.status(400).json({ message: 'Invalid image type.' });
    await pool.execute(`UPDATE pp_equipment SET \`${type}\` = NULL WHERE id = ?`, [id]);
    res.json({ message: `${type} removed.` });
  } catch (err) {
    console.error('power.deleteImage:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

// PUT /api/power/:id/specs
const updateSpecs = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const specs = Array.isArray(req.body.specs) ? req.body.specs : [];
    await conn.beginTransaction();
    await conn.execute('DELETE FROM pp_specs WHERE equip_id = ?', [id]);
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      if (!s.lbl) continue;
      await conn.execute(
        'INSERT INTO pp_specs (equip_id, lbl, val, sort_order) VALUES (?, ?, ?, ?)',
        [id, s.lbl, s.val ?? '', i]
      );
    }
    await conn.commit();
    res.json({ message: 'Specs updated.' });
  } catch (err) {
    await conn.rollback();
    console.error('power.updateSpecs:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  } finally {
    conn.release();
  }
};

// PUT /api/power/:id/schedule
const updateSchedule = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const sched = Array.isArray(req.body.schedule) ? req.body.schedule : [];
    await conn.beginTransaction();
    await conn.execute('DELETE FROM pp_oem_schedule WHERE equip_id = ?', [id]);
    for (const s of sched) {
      await conn.execute(
        `INSERT INTO pp_oem_schedule
           (equip_id, no, comp, act, iv_W, iv_M, iv_Q, iv_H, iv_Y, iv_T, iv_3Y)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [id, s.no ?? 0, s.comp ?? '', s.act ?? '',
         s.iv_W ?? null, s.iv_M ?? null, s.iv_Q ?? null,
         s.iv_H ?? null, s.iv_Y ?? null, s.iv_T ?? null, s.iv_3Y ?? null]
      );
    }
    await conn.commit();
    res.json({ message: 'Schedule updated.' });
  } catch (err) {
    await conn.rollback();
    console.error('power.updateSchedule:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  } finally {
    conn.release();
  }
};

// GET /api/power/:id/history
const getHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit  = Math.min(200, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;
    const [[{ total }]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM pp_history WHERE equip_id = ?', [id]
    );
    const [records] = await pool.query(
      `SELECT * FROM pp_history WHERE equip_id = ? ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      [id]
    );
    res.json({ total, page, limit, records });
  } catch (err) {
    console.error('power.getHistory:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

// POST /api/power/:id/history
const addHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const eq = await getEq(id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found.' });

    const { season, year, date_start, date_finish, obs, act, cost, svc, provider, resp, rem, img_before, img_after } = req.body;
    const validImg = (d) => (d && String(d).startsWith('data:image') ? d : null);
    const [result] = await pool.execute(
      `INSERT INTO pp_history
         (equip_id, season, year, date_start, date_finish, obs, act, cost, svc, provider, resp, rem, img_before, img_after)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id,
       season || null, year || null,
       date_start || null, date_finish || null,
       obs || null, act || null, cost || null,
       svc || null, provider || null, resp || null, rem || null,
       validImg(img_before), validImg(img_after)]
    );
    res.status(201).json({ message: 'Record added.', id: result.insertId });
  } catch (err) {
    console.error('power.addHistory:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

// PUT /api/power/:id/history/:hid
const updateHistory = async (req, res) => {
  try {
    const { id, hid } = req.params;
    const { season, year, date_start, date_finish, obs, act, cost, svc, provider, resp, rem, img_before, img_after } = req.body;
    const validImg = (d) => (d && String(d).startsWith('data:image') ? d : null);
    const [result] = await pool.execute(
      `UPDATE pp_history
       SET season=?, year=?, date_start=?, date_finish=?,
           obs=?, act=?, cost=?, svc=?, provider=?, resp=?, rem=?,
           img_before=?, img_after=?
       WHERE id=? AND equip_id=?`,
      [season || null, year || null,
       date_start || null, date_finish || null,
       obs || null, act || null, cost || null,
       svc || null, provider || null, resp || null, rem || null,
       validImg(img_before), validImg(img_after),
       hid, id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'Record not found.' });
    res.json({ message: 'Record updated.' });
  } catch (err) {
    console.error('power.updateHistory:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

// DELETE /api/power/:id/history/:hid
const deleteHistory = async (req, res) => {
  try {
    const { id, hid } = req.params;
    const [result] = await pool.execute(
      'DELETE FROM pp_history WHERE id=? AND equip_id=?', [hid, id]
    );
    if (result.affectedRows === 0)
      return res.status(404).json({ message: 'Record not found.' });
    res.json({ message: 'Record deleted.' });
  } catch (err) {
    console.error('power.deleteHistory:', err.message);
    res.status(500).json({ message: 'Database error: ' + err.message });
  }
};

module.exports = {
  listEquipment, getEquipment, updateEquipment,
  uploadImage, deleteImage,
  updateSpecs, updateSchedule,
  getHistory, addHistory, updateHistory, deleteHistory,
};
