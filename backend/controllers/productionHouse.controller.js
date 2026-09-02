const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const { validHistoryImageField } = require('../utils/historyImages');
const { formatProductionHouseSpecValue } = require('../utils/productionHouseSpecValue');

const HOUSE_SECTIONS = new Set([
  'pan_crystallizer',
  'evaporation',
  'clarification',
  'centrifugal_drier',
]);

const SPEC_SECTION = 'mechanical';

function scopeHistoryRow(row, eq) {
  if (!row || !eq) return row;
  return {
    ...row,
    section: row.section || SPEC_SECTION,
    sub_section: row.sub_section || eq.name,
  };
}

function scopeHistoryRows(rows, eq) {
  return rows.map((row) => scopeHistoryRow(row, eq));
}

function historyScopeFromBody(body = {}, eq) {
  const section = String(body.section || SPEC_SECTION).trim() || SPEC_SECTION;
  const sub_section = String(body.sub_section || body.subSection || eq?.name || '').trim()
    || eq?.name
    || null;
  return { section, sub_section };
}

const getEq = async (id) => {
  const [[eq]] = await pool.execute('SELECT * FROM phn_equipment WHERE id = ?', [id]);
  return eq || null;
};

const listHouses = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT house_section, COUNT(*) AS equipment_count
       FROM phn_equipment
       GROUP BY house_section`
    );
    const counts = Object.fromEntries(rows.map((r) => [r.house_section, r]));
    res.json({ houses: counts });
  } catch (err) {
    sendServerError(res, 'listHouses:', err, MSG.LOAD);
  }
};

const listEquipment = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, parseInt(req.query.limit || '100', 10));
    const q = String(req.query.q || '').trim();
    const house = String(req.query.house || '').trim();
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    if (house) {
      if (!HOUSE_SECTIONS.has(house)) {
        return res.status(400).json({ message: 'Unknown house section.' });
      }
      where.push('e.house_section = ?');
      params.push(house);
    }
    if (q) {
      const search = `%${q}%`;
      where.push('(e.name LIKE ? OR e.sheet_name LIKE ? OR e.type LIKE ? OR e.equip_no LIKE ?)');
      params.push(search, search, search, search);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM phn_equipment e ${whereSql}`,
      params
    );
    const [rows] = await pool.query(
      `SELECT e.id, e.house_section, e.sheet_name, e.equip_no, e.name, e.type,
              e.duty, e.capacity, e.sort_order,
              (SELECT COUNT(*) FROM phn_specs s
                 WHERE s.equip_id = e.id
                   AND s.lbl NOT IN ('__subsections__', '__subgroup_meta__')) AS spec_count,
              (SELECT COUNT(*) FROM phn_history h WHERE h.equip_id = e.id) AS history_count
       FROM phn_equipment e
       ${whereSql}
       ORDER BY e.name ASC, e.id ASC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    res.json({ total, page, limit, equipment: rows });
  } catch (err) {
    sendServerError(res, 'listEquipment:', err, MSG.LOAD);
  }
};

const getEquipment = async (req, res) => {
  try {
    const eq = await getEq(req.params.id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found.' });

    const [specRows] = await pool.execute(
      'SELECT * FROM phn_specs WHERE equip_id = ? ORDER BY sort_order, id',
      [eq.id]
    );
    const specs = specRows.map((row) => ({
      ...row,
      val: row.lbl?.startsWith('__') ? row.val : formatProductionHouseSpecValue(row.val),
    }));
    const [[{ total }]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM phn_history WHERE equip_id = ?',
      [eq.id]
    );
    const [history] = await pool.execute(
      `SELECT * FROM phn_history WHERE equip_id = ?
       ORDER BY (year IS NULL OR year = '') ASC, year DESC, id DESC
       LIMIT 200`,
      [eq.id]
    );

    res.json({
      equipment: eq,
      specs,
      schedule: [],
      history: scopeHistoryRows(history, eq),
      histTotal: total,
    });
  } catch (err) {
    sendServerError(res, 'getEquipment:', err, MSG.LOAD);
  }
};

const updateEquipment = async (req, res) => {
  try {
    const eq = await getEq(req.params.id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found.' });

    const { name, type, duty, capacity } = req.body;
    await pool.execute(
      'UPDATE phn_equipment SET name=?, type=?, duty=?, capacity=? WHERE id=?',
      [name ?? eq.name, type ?? eq.type, duty ?? eq.duty, capacity ?? eq.capacity, eq.id]
    );
    res.json({ message: 'Equipment updated.' });
  } catch (err) {
    sendServerError(res, 'updateEquipment:', err, MSG.SAVE);
  }
};

const updateSpecs = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const eq = await getEq(id);
    if (!eq) {
      conn.release();
      return res.status(404).json({ message: 'Equipment not found.' });
    }
    const specs = Array.isArray(req.body.specs) ? req.body.specs : [];
    await conn.beginTransaction();
    await conn.execute('DELETE FROM phn_specs WHERE equip_id = ?', [id]);
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      if (!s.lbl) continue;
      await conn.execute(
        `INSERT INTO phn_specs (equip_id, section, sub_section, lbl, val, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, s.section ?? null, s.sub_section ?? null, s.lbl, formatProductionHouseSpecValue(s.val ?? ''), s.sort_order ?? i]
      );
    }
    await conn.commit();
    res.json({ message: 'Specs updated.' });
  } catch (err) {
    await conn.rollback();
    sendServerError(res, 'updateSpecs:', err, MSG.SAVE);
  } finally {
    conn.release();
  }
};

const getHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, parseInt(req.query.limit || '20', 10));
    const offset = (page - 1) * limit;
    const [[{ total }]] = await pool.execute(
      'SELECT COUNT(*) AS total FROM phn_history WHERE equip_id = ?',
      [id]
    );
    const eq = await getEq(id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found.' });

    const [records] = await pool.query(
      `SELECT * FROM phn_history WHERE equip_id = ?
       ORDER BY (year IS NULL OR year = '') ASC, year DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [id]
    );
    res.json({ total, page, limit, records: scopeHistoryRows(records, eq) });
  } catch (err) {
    sendServerError(res, 'getHistory:', err, MSG.LOAD);
  }
};

const addHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const eq = await getEq(id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found.' });

    const {
      season, year, date_start, date_finish, obs, act, cost, svc,
      maintenance_type, provider, resp, rem, img_before, img_after,
    } = req.body;
    const { section, sub_section } = historyScopeFromBody(req.body, eq);
    const [result] = await pool.execute(
      `INSERT INTO phn_history
         (equip_id, section, sub_section, season, year, date_start, date_finish, obs, act, cost, svc, maintenance_type, provider, resp, rem, img_before, img_after)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        section,
        sub_section,
        season || null, year || null,
        date_start || null, date_finish || null,
        obs || null, act || null, cost || null,
        svc || null, maintenance_type || null, provider || null, resp || null, rem || null,
        validHistoryImageField(img_before), validHistoryImageField(img_after),
      ]
    );
    res.status(201).json({ message: 'Record added.', id: result.insertId });
  } catch (err) {
    sendServerError(res, 'addHistory:', err, MSG.SAVE);
  }
};

const updateHistory = async (req, res) => {
  try {
    const { id, hid } = req.params;
    const eq = await getEq(id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found.' });

    const {
      season, year, date_start, date_finish, obs, act, cost, svc,
      maintenance_type, provider, resp, rem, img_before, img_after,
    } = req.body;
    const { section, sub_section } = historyScopeFromBody(req.body, eq);
    const [result] = await pool.execute(
      `UPDATE phn_history
       SET section=?, sub_section=?, season=?, year=?, date_start=?, date_finish=?,
           obs=?, act=?, cost=?, svc=?, maintenance_type=?, provider=?, resp=?, rem=?,
           img_before=?, img_after=?
       WHERE id=? AND equip_id=?`,
      [
        section,
        sub_section,
        season || null, year || null,
        date_start || null, date_finish || null,
        obs || null, act || null, cost || null,
        svc || null, maintenance_type || null, provider || null, resp || null, rem || null,
        validHistoryImageField(img_before), validHistoryImageField(img_after),
        hid, id,
      ]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Record not found.' });
    }
    res.json({ message: 'Record updated.' });
  } catch (err) {
    sendServerError(res, 'updateHistory:', err, MSG.SAVE);
  }
};

const deleteHistory = async (req, res) => {
  try {
    const { id, hid } = req.params;
    const [result] = await pool.execute(
      'DELETE FROM phn_history WHERE id=? AND equip_id=?',
      [hid, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Record not found.' });
    }
    res.json({ message: 'Record deleted.' });
  } catch (err) {
    sendServerError(res, 'deleteHistory:', err, MSG.DELETE);
  }
};

module.exports = {
  listHouses,
  listEquipment,
  getEquipment,
  updateEquipment,
  updateSpecs,
  getHistory,
  addHistory,
  updateHistory,
  deleteHistory,
};
