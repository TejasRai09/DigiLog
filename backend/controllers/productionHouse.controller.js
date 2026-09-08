const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const { validHistoryImageField } = require('../utils/historyImages');
const { formatProductionHouseSpecValue } = require('../utils/productionHouseSpecValue');
const { canManageLockedCards } = require('../services/lockedCardManageAccess.service');
const {
  isApprovalEnabled,
  createPendingRequest,
  overlayPendingHistory,
} = require('../services/maintenanceHistoryApproval.service');

const HOUSE_SECTIONS = new Set([
  'pan_crystallizer',
  'evaporation',
  'clarification',
  'centrifugal_drier',
]);

const SPEC_SECTION = 'mechanical';
const APPROVAL_DOMAIN = 'production';

function serializeEquipment(eq) {
  if (!eq) return eq;
  return {
    ...eq,
    isImported: Boolean(eq.is_imported),
  };
}

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

function historyPayloadFromBody(body, eq) {
  const { section, sub_section } = historyScopeFromBody(body, eq);
  return {
    season: body.season,
    year: body.year,
    date_start: body.date_start,
    date_finish: body.date_finish,
    obs: body.obs,
    act: body.act,
    cost: body.cost,
    svc: body.svc,
    maintenance_type: body.maintenance_type,
    provider: body.provider,
    resp: body.resp,
    rem: body.rem,
    img_before: body.img_before,
    img_after: body.img_after,
    documents: body.documents,
    section,
    sub_section,
    equipment_refs: [{ section, sub_section }],
  };
}

async function queueProductionHistoryApproval(req, res, {
  action,
  equipId,
  historyId,
  payload,
  previousRow,
  equipment,
}) {
  const enabled = await isApprovalEnabled(APPROVAL_DOMAIN);
  if (!enabled) return false;

  try {
    const pending = await createPendingRequest({
      domain: APPROVAL_DOMAIN,
      action,
      equipId,
      historyId,
      payload,
      previousRow,
      reqUser: req.user,
      equipment,
    });
    res.status(202).json({
      message: 'Submitted for HOD approval.',
      pending: true,
      approvalRequestId: pending.id,
    });
    return true;
  } catch (err) {
    if (err.status) {
      res.status(err.status).json({ message: err.message });
      return true;
    }
    throw err;
  }
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
              e.duty, e.capacity, e.sort_order, e.is_imported,
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
    res.json({ total, page, limit, equipment: rows.map(serializeEquipment) });
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
       ORDER BY created_at DESC, id DESC
       LIMIT 200`,
      [eq.id]
    );
    const scoped = scopeHistoryRows(history, eq);
    const withPending = await overlayPendingHistory(
      APPROVAL_DOMAIN,
      eq.id,
      req.user?.id,
      scoped,
    );

    res.json({
      equipment: serializeEquipment(eq),
      specs,
      schedule: [],
      history: withPending,
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

    if (eq.is_imported && !(await canManageLockedCards(req.user, 'production'))) {
      return res.status(403).json({
        message: 'Imported production equipment cannot be edited without locked-card manage access.',
      });
    }

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

const deleteEquipment = async (req, res) => {
  try {
    const eq = await getEq(req.params.id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found.' });

    if (eq.is_imported && !(await canManageLockedCards(req.user, 'production'))) {
      return res.status(403).json({
        message: 'Imported production equipment cannot be deleted without locked-card manage access.',
      });
    }

    await pool.execute('DELETE FROM phn_equipment WHERE id = ?', [eq.id]);
    res.json({ message: 'Equipment deleted.' });
  } catch (err) {
    sendServerError(res, 'deleteEquipment:', err, MSG.DELETE);
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
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [id]
    );
    const scoped = scopeHistoryRows(records, eq);
    const withPending = await overlayPendingHistory(
      APPROVAL_DOMAIN,
      id,
      req.user?.id,
      scoped,
    );
    res.json({ total, page, limit, records: withPending });
  } catch (err) {
    sendServerError(res, 'getHistory:', err, MSG.LOAD);
  }
};

const addHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const eq = await getEq(id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found.' });

    const payload = historyPayloadFromBody(req.body, eq);
    const queued = await queueProductionHistoryApproval(req, res, {
      action: 'create',
      equipId: id,
      historyId: null,
      payload,
      previousRow: null,
      equipment: eq,
    });
    if (queued) return;

    const { section, sub_section } = payload;
    const [result] = await pool.execute(
      `INSERT INTO phn_history
         (equip_id, section, sub_section, season, year, date_start, date_finish, obs, act, cost, svc, maintenance_type, provider, resp, rem, img_before, img_after)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        section,
        sub_section,
        payload.season || null, payload.year || null,
        payload.date_start || null, payload.date_finish || null,
        payload.obs || null, payload.act || null, payload.cost || null,
        payload.svc || null, payload.maintenance_type || null, payload.provider || null, payload.resp || null, payload.rem || null,
        validHistoryImageField(payload.img_before), validHistoryImageField(payload.img_after),
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

    const [[existingRow]] = await pool.execute(
      'SELECT * FROM phn_history WHERE id=? AND equip_id=? LIMIT 1',
      [hid, id],
    );
    if (!existingRow) return res.status(404).json({ message: 'Record not found.' });

    const payload = historyPayloadFromBody(req.body, eq);
    const queued = await queueProductionHistoryApproval(req, res, {
      action: 'update',
      equipId: id,
      historyId: Number(hid),
      payload,
      previousRow: existingRow,
      equipment: eq,
    });
    if (queued) return;

    const { section, sub_section } = payload;
    const [result] = await pool.execute(
      `UPDATE phn_history
       SET section=?, sub_section=?, season=?, year=?, date_start=?, date_finish=?,
           obs=?, act=?, cost=?, svc=?, maintenance_type=?, provider=?, resp=?, rem=?,
           img_before=?, img_after=?
       WHERE id=? AND equip_id=?`,
      [
        section,
        sub_section,
        payload.season || null, payload.year || null,
        payload.date_start || null, payload.date_finish || null,
        payload.obs || null, payload.act || null, payload.cost || null,
        payload.svc || null, payload.maintenance_type || null, payload.provider || null, payload.resp || null, payload.rem || null,
        validHistoryImageField(payload.img_before), validHistoryImageField(payload.img_after),
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
    const eq = await getEq(id);
    if (!eq) return res.status(404).json({ message: 'Equipment not found.' });

    const [[existingRow]] = await pool.execute(
      'SELECT * FROM phn_history WHERE id=? AND equip_id=? LIMIT 1',
      [hid, id],
    );
    if (!existingRow) return res.status(404).json({ message: 'Record not found.' });

    const queued = await queueProductionHistoryApproval(req, res, {
      action: 'delete',
      equipId: id,
      historyId: Number(hid),
      payload: {},
      previousRow: existingRow,
      equipment: eq,
    });
    if (queued) return;

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
  deleteEquipment,
  updateSpecs,
  getHistory,
  addHistory,
  updateHistory,
  deleteHistory,
};
