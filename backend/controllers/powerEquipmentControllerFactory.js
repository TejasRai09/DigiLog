const { pool } = require('../config/mysql');
const { validHistoryImageField } = require('../utils/historyImages');
const { enrichEquipment } = require('../utils/powerEquipmentClassification');

const META_SUBSECTIONS_LBL = '__subsections__';

function normalizeEquipmentRef(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const section = String(raw.section || '').trim();
  const sub_section = String(raw.sub_section || raw.subSection || '').trim();
  if (!section || !sub_section) return null;
  return { section, sub_section };
}

function parseEquipmentRefsFromBody(body = {}) {
  if (Array.isArray(body.equipment_refs)) {
    return body.equipment_refs.map(normalizeEquipmentRef).filter(Boolean);
  }
  const section = String(body.section || '').trim();
  const sub_section = String(body.sub_section || body.subSection || '').trim();
  if (section && sub_section) return [{ section, sub_section }];
  return [];
}

function parseEquipmentRefsFromRow(row = {}) {
  if (row.equipment_refs) {
    try {
      const raw = typeof row.equipment_refs === 'string'
        ? JSON.parse(row.equipment_refs)
        : row.equipment_refs;
      if (Array.isArray(raw)) {
        const refs = raw.map(normalizeEquipmentRef).filter(Boolean);
        if (refs.length) return refs;
      }
    } catch {
      /* fall through */
    }
  }
  const section = String(row.section || '').trim();
  const sub_section = String(row.sub_section || row.subSection || '').trim();
  if (section && sub_section) return [{ section, sub_section }];
  return [];
}

function serializeEquipmentRefsColumn(refs = []) {
  if (!refs.length) return null;
  return JSON.stringify(refs);
}

function renameSubSectionInRefs(refs, section, oldSubSection, newSubSection) {
  return refs.map((ref) => (
    ref.section === section && ref.sub_section === oldSubSection
      ? { section, sub_section: newSubSection }
      : ref
  ));
}

async function renameSubGroupRefsInTable(poolConn, tableName, equipId, section, oldSubSection, newSubSection) {
  const [rows] = await poolConn.execute(
    `SELECT id, section, sub_section, equipment_refs FROM \`${tableName}\` WHERE equip_id = ?`,
    [equipId],
  );

  for (const row of rows) {
    const prevRefs = parseEquipmentRefsFromRow(row);
    const refs = renameSubSectionInRefs(prevRefs, section, oldSubSection, newSubSection);

    const legacySubSection = row.section === section && row.sub_section === oldSubSection
      ? newSubSection
      : row.sub_section;

    const changed = JSON.stringify(refs) !== JSON.stringify(prevRefs)
      || legacySubSection !== row.sub_section;

    if (!changed) continue;

    await poolConn.execute(
      `UPDATE \`${tableName}\`
       SET section = ?, sub_section = ?, equipment_refs = ?
       WHERE id = ? AND equip_id = ?`,
      [
        refs[0]?.section || row.section,
        refs[0]?.sub_section || legacySubSection,
        serializeEquipmentRefsColumn(refs),
        row.id,
        equipId,
      ],
    );
  }
}

async function deleteSubGroupRefsInTable(poolConn, tableName, equipId, section, subSection) {
  const [rows] = await poolConn.execute(
    `SELECT id, section, sub_section, equipment_refs FROM \`${tableName}\` WHERE equip_id = ?`,
    [equipId],
  );

  for (const row of rows) {
    const refs = parseEquipmentRefsFromRow(row);
    const matchesLegacy = row.section === section && row.sub_section === subSection;
    const nextRefs = refs.filter(
      (ref) => !(ref.section === section && ref.sub_section === subSection),
    );

    if (!matchesLegacy && nextRefs.length === refs.length) continue;

    if (nextRefs.length === 0) {
      await poolConn.execute(`DELETE FROM \`${tableName}\` WHERE id = ? AND equip_id = ?`, [row.id, equipId]);
    } else {
      await poolConn.execute(
        `UPDATE \`${tableName}\` SET section = ?, sub_section = ?, equipment_refs = ? WHERE id = ? AND equip_id = ?`,
        [nextRefs[0].section, nextRefs[0].sub_section, serializeEquipmentRefsColumn(nextRefs), row.id, equipId],
      );
    }
  }
}

function scheduleRowMatchesSection(row, section) {
  if (!section) return true;
  const refs = parseEquipmentRefsFromRow(row);
  if (refs.length) {
    return refs.some((ref) => ref.section === section);
  }
  const rowSection = String(row.section || '').trim();
  if (rowSection) return rowSection === section;
  return false;
}

function scheduleDbRowToPayload(row) {
  let equipment_refs = null;
  if (row.equipment_refs) {
    try {
      equipment_refs = typeof row.equipment_refs === 'string'
        ? JSON.parse(row.equipment_refs)
        : row.equipment_refs;
    } catch {
      equipment_refs = null;
    }
  }
  return {
    section: row.section ?? null,
    sub_section: row.sub_section ?? null,
    equipment_refs,
    no: row.no ?? 0,
    comp: row.comp ?? '',
    act: row.act ?? '',
    iv_W: row.iv_W ?? null,
    iv_M: row.iv_M ?? null,
    iv_Q: row.iv_Q ?? null,
    iv_H: row.iv_H ?? null,
    iv_Y: row.iv_Y ?? null,
    iv_T: row.iv_T ?? null,
    iv_3Y: row.iv_3Y ?? null,
  };
}

async function insertScheduleRows(conn, tableName, equipId, rows, scheduleEquipmentScoped) {
  for (const s of rows) {
    if (scheduleEquipmentScoped) {
      const refs = Array.isArray(s.equipment_refs) ? s.equipment_refs : [];
      const equipmentRefsJson = refs.length
        ? JSON.stringify(refs.map((ref) => ({
          section: ref.section ?? null,
          sub_section: ref.sub_section ?? ref.subSection ?? null,
        })).filter((ref) => ref.section && ref.sub_section))
        : null;
      await conn.execute(
        `INSERT INTO \`${tableName}\`
           (equip_id, section, sub_section, equipment_refs, no, comp, act, iv_W, iv_M, iv_Q, iv_H, iv_Y, iv_T, iv_3Y)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          equipId,
          s.section ?? null,
          s.sub_section ?? null,
          equipmentRefsJson,
          s.no ?? 0,
          s.comp ?? '',
          s.act ?? '',
          s.iv_W ?? null, s.iv_M ?? null, s.iv_Q ?? null,
          s.iv_H ?? null, s.iv_Y ?? null, s.iv_T ?? null, s.iv_3Y ?? null,
        ],
      );
    } else {
      await conn.execute(
        `INSERT INTO \`${tableName}\`
           (equip_id, no, comp, act, iv_W, iv_M, iv_Q, iv_H, iv_Y, iv_T, iv_3Y)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [equipId, s.no ?? 0, s.comp ?? '', s.act ?? '',
          s.iv_W ?? null, s.iv_M ?? null, s.iv_Q ?? null,
          s.iv_H ?? null, s.iv_Y ?? null, s.iv_T ?? null, s.iv_3Y ?? null],
      );
    }
  }
}

/**
 * @param {{ equipment: string, specs: string, schedule: string, history: string, defaultDept?: string, logPrefix?: string }} tables
 */
function createPowerEquipmentController(tables) {
  const {
    equipment: EQUIP,
    specs: SPECS,
    schedule: SCHED,
    history: HIST,
    defaultDept = 'electrical',
    logPrefix = 'power',
    historySubGroupScoped = false,
    scheduleEquipmentScoped = false,
  } = tables;

  const getEq = async (id) => {
    const [[eq]] = await pool.execute(`SELECT * FROM \`${EQUIP}\` WHERE id = ?`, [id]);
    return eq || null;
  };

  const EQUIPMENT_LOOKUP_SELECT = `SELECT id, dept, category, subcategory, equip_no, tag_name, name, location, commissioned, drive, sort_order
       FROM \`${EQUIP}\``;

  async function findEquipmentForLookup(equipNo, name) {
    const run = async (where, params) => {
      const [rows] = await pool.query(
        `${EQUIPMENT_LOOKUP_SELECT} WHERE ${where}
         ORDER BY sort_order ASC, id ASC LIMIT 1`,
        params,
      );
      return rows[0] || null;
    };

    if (equipNo && name) {
      const exact = await run(
        '(equip_no = ? OR tag_name = ?) AND name = ?',
        [equipNo, equipNo, name],
      );
      if (exact) return exact;
    }

    if (name) {
      const byName = await run('name = ?', [name]);
      if (byName) return byName;
    }

    if (equipNo) {
      const byTag = await run('equip_no = ? OR tag_name = ?', [equipNo, equipNo]);
      if (byTag) return byTag;

      const byTagPrefix = await run('name LIKE ?', [`${equipNo} (%`]);
      if (byTagPrefix) return byTagPrefix;
    }

    return null;
  }

  const lookupEquipment = async (req, res) => {
    try {
      const equipNo = String(req.query.equip_no || '').trim();
      const name = String(req.query.name || '').trim();

      if (!equipNo && !name) {
        return res.status(400).json({ message: 'equip_no or name is required.' });
      }

      const equipment = await findEquipmentForLookup(equipNo, name);
      if (!equipment) return res.status(404).json({ message: 'Equipment not found.' });
      res.json({ equipment });
    } catch (err) {
      console.error(`${logPrefix}.lookupEquipment:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  const listEquipment = async (req, res) => {
    try {
      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const limit = Math.min(200, parseInt(req.query.limit || '100', 10));
      const q = req.query.q || '';
      const dept = req.query.dept || '';
      const category = req.query.category || '';
      const subcategory = req.query.subcategory || '';
      const offset = (page - 1) * limit;

      const conditions = [];
      const params = [];
      if (dept) { conditions.push('dept = ?'); params.push(dept); }
      if (category) { conditions.push('category = ?'); params.push(category); }
      if (subcategory) { conditions.push('subcategory = ?'); params.push(subcategory); }
      if (q) {
        conditions.push('(name LIKE ? OR equip_no LIKE ? OR tag_name LIKE ? OR category LIKE ? OR subcategory LIKE ?)');
        params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM \`${EQUIP}\` ${where}`, params,
      );
      const [rows] = await pool.query(
        `SELECT id, dept, category, subcategory, equip_no, tag_name, name, location, commissioned, drive, sort_order
         FROM \`${EQUIP}\` ${where} ORDER BY sort_order ASC, id ASC LIMIT ${limit} OFFSET ${offset}`,
        params,
      );
      res.json({ total, page, limit, equipment: rows });
    } catch (err) {
      console.error(`${logPrefix}.listEquipment:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  const createEquipment = async (req, res) => {
    try {
      const { name, equip_no, tag_name, category, subcategory, location, commissioned, drive, dept } = req.body;
      const trimmedName = String(name || '').trim();
      if (!trimmedName) {
        return res.status(400).json({ message: 'name is required.' });
      }

      const enriched = enrichEquipment({
        dept: String(dept || defaultDept).trim() || defaultDept,
        name: trimmedName,
        equip_no: equip_no ?? null,
        tag_name: tag_name ?? null,
        category: category ?? null,
        subcategory: subcategory ?? null,
        location: location ?? null,
      });

      const [result] = await pool.execute(
        `INSERT INTO \`${EQUIP}\` (dept, category, subcategory, equip_no, tag_name, name, location, commissioned, drive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          enriched.dept,
          enriched.category,
          enriched.subcategory,
          enriched.equip_no,
          enriched.tag_name,
          trimmedName,
          location?.trim() || null,
          commissioned?.trim() || null,
          drive?.trim() || null,
        ],
      );

      const eq = await getEq(result.insertId);
      res.status(201).json({ equipment: eq });
    } catch (err) {
      console.error(`${logPrefix}.createEquipment:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  const getEquipment = async (req, res) => {
    try {
      const eq = await getEq(req.params.id);
      if (!eq) return res.status(404).json({ message: 'Equipment not found.' });

      const section = String(req.query.section || '').trim() || null;

      const [specs] = await pool.execute(
        `SELECT * FROM \`${SPECS}\` WHERE equip_id = ? ORDER BY sort_order, id`, [eq.id],
      );
      const [scheduleRows] = await pool.execute(
        `SELECT * FROM \`${SCHED}\` WHERE equip_id = ? ORDER BY no`, [eq.id],
      );
      const schedule = (scheduleEquipmentScoped && section)
        ? scheduleRows.filter((row) => scheduleRowMatchesSection(row, section))
        : scheduleRows;
      const [[{ total }]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM \`${HIST}\` WHERE equip_id = ?`, [eq.id],
      );
      const [history] = await pool.execute(
        `SELECT * FROM \`${HIST}\` WHERE equip_id = ?
         ORDER BY (date_start IS NULL) ASC, date_start DESC, created_at DESC
         LIMIT 20`,
        [eq.id],
      );

      res.json({ equipment: eq, specs, schedule, history, histTotal: total });
    } catch (err) {
      console.error(`${logPrefix}.getEquipment:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  const updateEquipment = async (req, res) => {
    try {
      const eq = await getEq(req.params.id);
      if (!eq) return res.status(404).json({ message: 'Equipment not found.' });
      const { name, equip_no, tag_name, category, subcategory, location, commissioned, drive } = req.body;
      const enriched = enrichEquipment({
        ...eq,
        name: name ?? eq.name,
        equip_no: equip_no ?? eq.equip_no,
        tag_name: tag_name ?? eq.tag_name,
        category: category ?? eq.category,
        subcategory: subcategory ?? eq.subcategory,
        location: location ?? eq.location,
      });
      await pool.execute(
        `UPDATE \`${EQUIP}\` SET name=?, category=?, subcategory=?, equip_no=?, tag_name=?, location=?, commissioned=?, drive=? WHERE id=?`,
        [enriched.name, enriched.category, enriched.subcategory,
          enriched.equip_no, enriched.tag_name, location ?? eq.location,
          commissioned ?? eq.commissioned, drive ?? eq.drive, eq.id],
      );
      res.json({ message: 'Equipment updated.' });
    } catch (err) {
      console.error(`${logPrefix}.updateEquipment:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  const uploadImage = async (req, res) => {
    try {
      const { id, type } = req.params;
      if (!['photo', 'plate'].includes(type)) {
        return res.status(400).json({ message: 'Invalid image type.' });
      }
      const { data } = req.body;
      if (!data || !String(data).startsWith('data:image')) {
        return res.status(400).json({ message: 'Invalid image data.' });
      }
      await pool.execute(`UPDATE \`${EQUIP}\` SET \`${type}\` = ? WHERE id = ?`, [data, id]);
      res.json({ message: `${type} updated.` });
    } catch (err) {
      console.error(`${logPrefix}.uploadImage:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  const deleteImage = async (req, res) => {
    try {
      const { id, type } = req.params;
      if (!['photo', 'plate'].includes(type)) {
        return res.status(400).json({ message: 'Invalid image type.' });
      }
      await pool.execute(`UPDATE \`${EQUIP}\` SET \`${type}\` = NULL WHERE id = ?`, [id]);
      res.json({ message: `${type} removed.` });
    } catch (err) {
      console.error(`${logPrefix}.deleteImage:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  const updateSpecs = async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const { id } = req.params;
      const specs = Array.isArray(req.body.specs) ? req.body.specs : [];
      await conn.beginTransaction();
      await conn.execute(`DELETE FROM \`${SPECS}\` WHERE equip_id = ?`, [id]);
      for (let i = 0; i < specs.length; i++) {
        const s = specs[i];
        const lbl = s.lbl ?? '';
        if (!lbl) continue;

        const section = s.section ?? null;
        const subSection = s.sub_section ?? s.subSection ?? null;
        const sortOrder = s.sort_order ?? i;

        if (lbl === META_SUBSECTIONS_LBL) {
          await conn.execute(
            `INSERT INTO \`${SPECS}\` (equip_id, section, sub_section, lbl, val, sort_order) VALUES (?, NULL, NULL, ?, ?, ?)`,
            [id, lbl, s.val ?? '{}', sortOrder],
          );
          continue;
        }

        if (!lbl.trim()) continue;

        await conn.execute(
          `INSERT INTO \`${SPECS}\` (equip_id, section, sub_section, lbl, val, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, section, subSection, lbl.trim(), s.val ?? '', sortOrder],
        );
      }
      await conn.commit();
      res.json({ message: 'Specs updated.' });
    } catch (err) {
      await conn.rollback();
      console.error(`${logPrefix}.updateSpecs:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    } finally {
      conn.release();
    }
  };

  const updateSchedule = async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const { id } = req.params;
      const sched = Array.isArray(req.body.schedule) ? req.body.schedule : [];
      const scopeSection = String(req.query.section || req.body.scope_section || '').trim() || null;

      await conn.beginTransaction();

      let rowsToSave = sched;
      if (scheduleEquipmentScoped && scopeSection) {
        const [existing] = await conn.execute(
          `SELECT * FROM \`${SCHED}\` WHERE equip_id = ? ORDER BY no`,
          [id],
        );
        const preserved = existing
          .filter((row) => !scheduleRowMatchesSection(row, scopeSection))
          .map(scheduleDbRowToPayload);
        rowsToSave = [...preserved, ...sched];
      }

      await conn.execute(`DELETE FROM \`${SCHED}\` WHERE equip_id = ?`, [id]);
      await insertScheduleRows(conn, SCHED, id, rowsToSave, scheduleEquipmentScoped);
      await conn.commit();
      res.json({ message: 'Schedule updated.' });
    } catch (err) {
      await conn.rollback();
      console.error(`${logPrefix}.updateSchedule:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    } finally {
      conn.release();
    }
  };

  const historyWhereClause = (id, section, subSection) => {
    const conditions = ['equip_id = ?'];
    const params = [id];
    if (historySubGroupScoped && section) {
      conditions.push('section = ?');
      params.push(section);
    }
    if (historySubGroupScoped && subSection) {
      conditions.push('sub_section = ?');
      params.push(subSection);
    }
    return { where: conditions.join(' AND '), params };
  };

  const getHistory = async (req, res) => {
    try {
      const { id } = req.params;
      const page = Math.max(1, parseInt(req.query.page || '1', 10));
      const limit = Math.min(200, parseInt(req.query.limit || '20', 10));
      const offset = (page - 1) * limit;
      const section = String(req.query.section || '').trim() || null;
      const subSection = String(req.query.sub_section || req.query.subSection || '').trim() || null;
      const { where, params } = historyWhereClause(id, section, subSection);
      const [[{ total }]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM \`${HIST}\` WHERE ${where}`, params,
      );
      const [records] = await pool.query(
        `SELECT * FROM \`${HIST}\` WHERE ${where}
         ORDER BY (date_start IS NULL) ASC, date_start DESC, created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        params,
      );
      res.json({ total, page, limit, records });
    } catch (err) {
      console.error(`${logPrefix}.getHistory:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  const addHistory = async (req, res) => {
    try {
      const { id } = req.params;
      const eq = await getEq(id);
      if (!eq) return res.status(404).json({ message: 'Equipment not found.' });

      const {
        season, year, date_start, date_finish, obs, act, cost, svc, maintenance_type, provider, resp, rem, img_before, img_after,
        section, sub_section: subSectionBody, subSection, equipment_refs,
      } = req.body;
      const equipmentRefs = parseEquipmentRefsFromBody({ equipment_refs, section, sub_section: subSectionBody ?? subSection });

      if (historySubGroupScoped && equipmentRefs.length === 0) {
        return res.status(400).json({ message: 'At least one equipment mapping is required.' });
      }

      const cols = ['equip_id'];
      const placeholders = ['?'];
      const values = [id];

      if (historySubGroupScoped) {
        cols.push('section', 'sub_section', 'equipment_refs');
        placeholders.push('?', '?', '?');
        values.push(
          equipmentRefs[0].section,
          equipmentRefs[0].sub_section,
          serializeEquipmentRefsColumn(equipmentRefs),
        );
      }

      cols.push(
        'season', 'year', 'date_start', 'date_finish', 'obs', 'act', 'cost', 'svc', 'maintenance_type', 'provider', 'resp', 'rem',
        'img_before', 'img_after',
      );
      placeholders.push('?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?', '?');
      values.push(
        season || null, year || null,
        date_start || null, date_finish || null,
        obs || null, act || null, cost || null,
        svc || null, maintenance_type || null, provider || null, resp || null, rem || null,
        validHistoryImageField(img_before), validHistoryImageField(img_after),
      );

      const [result] = await pool.execute(
        `INSERT INTO \`${HIST}\` (${cols.join(', ')}) VALUES (${placeholders.join(', ')})`,
        values,
      );
      res.status(201).json({ message: 'Record added.', id: result.insertId });
    } catch (err) {
      console.error(`${logPrefix}.addHistory:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  const updateHistory = async (req, res) => {
    try {
      const { id, hid } = req.params;
      const {
        season, year, date_start, date_finish, obs, act, cost, svc, maintenance_type, provider, resp, rem, img_before, img_after,
        section, sub_section: subSectionBody, subSection, equipment_refs,
      } = req.body;

      const setParts = [
        'season=?', 'year=?', 'date_start=?', 'date_finish=?',
        'obs=?', 'act=?', 'cost=?', 'svc=?', 'maintenance_type=?', 'provider=?', 'resp=?', 'rem=?',
        'img_before=?', 'img_after=?',
      ];
      const values = [
        season || null, year || null,
        date_start || null, date_finish || null,
        obs || null, act || null, cost || null,
        svc || null, maintenance_type || null, provider || null, resp || null, rem || null,
        validHistoryImageField(img_before), validHistoryImageField(img_after),
      ];

      if (historySubGroupScoped) {
        const equipmentRefs = parseEquipmentRefsFromBody({
          equipment_refs,
          section,
          sub_section: subSectionBody ?? subSection,
        });
        if (equipmentRefs.length === 0) {
          return res.status(400).json({ message: 'At least one equipment mapping is required.' });
        }
        setParts.push('section=?', 'sub_section=?', 'equipment_refs=?');
        values.push(
          equipmentRefs[0].section,
          equipmentRefs[0].sub_section,
          serializeEquipmentRefsColumn(equipmentRefs),
        );
      }

      values.push(hid, id);

      const [result] = await pool.execute(
        `UPDATE \`${HIST}\`
         SET ${setParts.join(', ')}
         WHERE id=? AND equip_id=?`,
        values,
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Record not found.' });
      }
      res.json({ message: 'Record updated.' });
    } catch (err) {
      console.error(`${logPrefix}.updateHistory:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  const deleteSubGroupHistory = async (req, res) => {
    if (!historySubGroupScoped) {
      return res.status(404).json({ message: 'Not found.' });
    }
    try {
      const { id } = req.params;
      const section = String(req.body.section || '').trim();
      const sub_section = String(req.body.sub_section || req.body.subSection || '').trim();
      if (!section || !sub_section) {
        return res.status(400).json({ message: 'section and sub_section are required.' });
      }

      await deleteSubGroupRefsInTable(pool, HIST, id, section, sub_section);
      if (scheduleEquipmentScoped) {
        await deleteSubGroupRefsInTable(pool, SCHED, id, section, sub_section);
      }

      res.json({ message: 'Sub-group history updated.' });
    } catch (err) {
      console.error(`${logPrefix}.deleteSubGroupHistory:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  const renameSubGroupHistory = async (req, res) => {
    if (!historySubGroupScoped) {
      return res.status(404).json({ message: 'Not found.' });
    }
    try {
      const { id } = req.params;
      const section = String(req.body.section || '').trim();
      const old_sub_section = String(req.body.old_sub_section || req.body.oldSubSection || '').trim();
      const new_sub_section = String(req.body.new_sub_section || req.body.newSubSection || '').trim();
      if (!section || !old_sub_section || !new_sub_section) {
        return res.status(400).json({ message: 'section, old_sub_section, and new_sub_section are required.' });
      }

      await renameSubGroupRefsInTable(pool, HIST, id, section, old_sub_section, new_sub_section);
      if (scheduleEquipmentScoped) {
        await renameSubGroupRefsInTable(pool, SCHED, id, section, old_sub_section, new_sub_section);
      }

      res.json({ message: 'Sub-group history renamed.' });
    } catch (err) {
      console.error(`${logPrefix}.renameSubGroupHistory:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  const deleteHistory = async (req, res) => {
    try {
      const { id, hid } = req.params;
      const [result] = await pool.execute(
        `DELETE FROM \`${HIST}\` WHERE id=? AND equip_id=?`, [hid, id],
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Record not found.' });
      }
      res.json({ message: 'Record deleted.' });
    } catch (err) {
      console.error(`${logPrefix}.deleteHistory:`, err.message);
      res.status(500).json({ message: 'Database error: ' + err.message });
    }
  };

  return {
    lookupEquipment,
    listEquipment,
    createEquipment,
    getEquipment,
    updateEquipment,
    uploadImage,
    deleteImage,
    updateSpecs,
    updateSchedule,
    getHistory,
    addHistory,
    updateHistory,
    deleteHistory,
    deleteSubGroupHistory,
    renameSubGroupHistory,
  };
}

module.exports = { createPowerEquipmentController };
