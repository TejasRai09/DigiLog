/**
 * Shared helpers for importing Power Plant Equipment History (new) into ppn_* tables.
 */

const { enrichEquipment } = require('../../utils/powerEquipmentClassification');

const META_SUBSECTIONS_LBL = '__subsections__';
const SPEC_SECTIONS = ['mechanical', 'civil', 'instrument', 'electrical'];
const DEFAULT_DEPT = 'plant';

const DEFAULT_SUB_SECTIONS = {
  mechanical: [],
  civil: [],
  instrument: [],
  electrical: [],
};

function emptyToNull(v) {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? null : s;
}

/** Normalize discipline header to mechanical | civil | instrument | electrical. */
function normalizeSection(value) {
  const s = String(value || '').trim().toLowerCase();
  if (SPEC_SECTIONS.includes(s)) return s;
  if (s.includes('mechanical') || s === '1' || s === '1. mechanical') return 'mechanical';
  if (s.includes('civil') || s === '2' || s === '2. civil') return 'civil';
  if (s.includes('instrument') || s === '3' || s === '3. instrument') return 'instrument';
  if (s.includes('electrical') || s === '4' || s === '4. electrical') return 'electrical';
  return 'mechanical';
}

function readSectionFromSpec(spec) {
  const raw = spec.section ?? spec.discipline ?? spec.spec_section ?? spec.specSection;
  return normalizeSection(raw);
}

function readSubSectionFromSpec(spec, section, subSections) {
  const raw = spec.sub_section ?? spec.subSection ?? spec.subsection;
  const sub = emptyToNull(raw) || subSections[section]?.[0] || 'General';
  return sub;
}

/**
 * Turn feed specs into DB rows with section/sub_section and __subsections__ meta row.
 * Specs without a section field default to mechanical.
 */
function prepareSpecsForDb(rawSpecs = []) {
  const subSections = {
    mechanical: [],
    civil: [],
    instrument: [],
    electrical: [],
  };
  const rows = [];

  for (const spec of rawSpecs) {
    if (!spec || spec.lbl === META_SUBSECTIONS_LBL) continue;
    const lbl = emptyToNull(spec.lbl ?? spec.label);
    const val = spec.val ?? spec.value ?? '';
    if (!lbl && !String(val).trim()) continue;

    const section = readSectionFromSpec(spec);
    const subSection = readSubSectionFromSpec(spec, section, subSections);

    if (!subSections[section].includes(subSection)) {
      if (subSections[section].length < 6) subSections[section].push(subSection);
    }

    rows.push({
      section,
      sub_section: subSection,
      lbl,
      val: String(val),
    });
  }

  for (const sec of SPEC_SECTIONS) {
    if (!subSections[sec].length) subSections[sec] = [...DEFAULT_SUB_SECTIONS[sec]];
  }

  rows.push({
    section: null,
    sub_section: null,
    lbl: META_SUBSECTIONS_LBL,
    val: JSON.stringify(subSections),
  });

  return rows;
}

function normalizeIvMark(value) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;
  if (s === '√' || s.toLowerCase() === 'x' || s === '1' || s === 'Y' || s === 'y') return 'X';
  return s.length <= 1 ? s : 'X';
}

function joinActionSteps(actions = []) {
  return actions.map((s) => String(s).trim()).filter(Boolean).join(' || ');
}

function parseActionStepsForImport(act = '') {
  const raw = String(act || '').trim();
  if (!raw) return [];
  if (raw.includes('||')) {
    return raw.split('||').map((s) => s.trim()).filter(Boolean);
  }
  const lines = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  if (raw.includes(';')) {
    const parts = raw.split(';').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
  }
  return raw ? [raw] : [];
}

function normalizeScheduleRow(row, index) {
  let actText = row.act ?? row.activity ?? '';
  if (Array.isArray(row.actions) && row.actions.length) {
    actText = joinActionSteps(row.actions);
  } else if (typeof actText === 'string' && actText.trim()) {
    actText = joinActionSteps(parseActionStepsForImport(actText));
  }
  const iv = row.int || row;
  return {
    no: Number(row.no) || index + 1,
    comp: emptyToNull(row.comp ?? row.component) ?? '',
    act: actText,
    iv_W: normalizeIvMark(iv.iv_W ?? iv.W),
    iv_M: normalizeIvMark(iv.iv_M ?? iv.M),
    iv_Q: normalizeIvMark(iv.iv_Q ?? iv.Q),
    iv_H: normalizeIvMark(iv.iv_H ?? iv.H),
    iv_Y: normalizeIvMark(iv.iv_Y ?? iv.Y),
    iv_T: normalizeIvMark(iv.iv_T ?? iv.T),
    iv_3Y: normalizeIvMark(iv.iv_3Y ?? iv['3Y']),
  };
}

function normalizeHistoryRow(row) {
  const section = emptyToNull(row.section);
  const sub_section = emptyToNull(row.sub_section ?? row.subSection);
  const equipment_refs = Array.isArray(row.equipment_refs)
    ? row.equipment_refs
      .map((ref) => ({
        section: emptyToNull(ref.section),
        sub_section: emptyToNull(ref.sub_section ?? ref.subSection),
      }))
      .filter((ref) => ref.section && ref.sub_section)
    : null;

  return {
    section,
    sub_section,
    equipment_refs,
    season: emptyToNull(row.season),
    year: emptyToNull(row.year),
    date_start: emptyToNull(row.date_start ?? row.dateStart),
    date_finish: emptyToNull(row.date_finish ?? row.dateFinish),
    obs: emptyToNull(row.obs ?? row.observation),
    act: emptyToNull(row.act ?? row.action),
    cost: emptyToNull(row.cost),
    svc: emptyToNull(row.svc ?? row.service),
    provider: emptyToNull(row.provider),
    resp: emptyToNull(row.resp ?? row.responsible),
    rem: emptyToNull(row.rem ?? row.remark ?? row.remarks),
    img_before: row.img_before ?? null,
    img_after: row.img_after ?? null,
  };
}

function readSubSectionsMeta(specRows) {
  const meta = specRows.find((s) => s.lbl === META_SUBSECTIONS_LBL);
  if (!meta?.val) return { ...DEFAULT_SUB_SECTIONS };
  try {
    const parsed = JSON.parse(meta.val);
    const out = { ...DEFAULT_SUB_SECTIONS };
    for (const sec of SPEC_SECTIONS) {
      if (Array.isArray(parsed[sec]) && parsed[sec].length) out[sec] = parsed[sec];
    }
    return out;
  } catch {
    return { ...DEFAULT_SUB_SECTIONS };
  }
}

/** Pick the discipline that owns most spec rows (for scoping maintenance history). */
function inferPrimarySectionFromSpecs(specRows) {
  const counts = {};
  for (const row of specRows) {
    if (!row.section || row.lbl === META_SUBSECTIONS_LBL) continue;
    counts[row.section] = (counts[row.section] || 0) + 1;
  }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] || 'mechanical';
}

/** Attach section / sub_section / equipment_refs when feed history rows omit them. */
function scopeHistoryFromSpecs(historyRows, specRows, opts = {}) {
  const subSections = readSubSectionsMeta(specRows);
  const primarySection = opts.defaultSection
    ? normalizeSection(opts.defaultSection)
    : inferPrimarySectionFromSpecs(specRows);
  const primarySubSection = emptyToNull(opts.defaultSubSection)
    || subSections[primarySection]?.[0]
    || 'General';

  return historyRows.map((row) => {
    const section = row.section || primarySection;
    const sub_section = row.sub_section || primarySubSection;
    const equipment_refs = row.equipment_refs?.length
      ? row.equipment_refs
      : [{ section, sub_section }];
    return { ...row, section, sub_section, equipment_refs };
  });
}

function resolveDbName(record) {
  return String(
    record.hierarchy_name
    ?? record.lookup_name
    ?? record.lookupName
    ?? record.name
    ?? '',
  ).trim();
}

/** Breadcrumb path for console output after each feed. */
function formatHierarchyPath(record) {
  if (record.hierarchy_path) return String(record.hierarchy_path).trim();
  const parts = ['Power Plant'];
  if (record.category) parts.push(String(record.category).trim());
  if (record.subcategory) parts.push(String(record.subcategory).trim());
  const card = record.hierarchy_card || record.hierarchy_name || resolveDbName(record);
  if (card) parts.push(String(card).trim());
  return parts.join(' > ');
}

function buildFeedMeta(record, equipId = null) {
  const imageName = record.image_name ?? record.imageName ?? null;
  const hierarchyCard = record.hierarchy_card ?? record.hierarchy_name ?? resolveDbName(record);
  const hierarchyPath = formatHierarchyPath(record);
  const uiPath = equipId != null ? `/power-plant-equipment-new/${equipId}` : null;
  return {
    hierarchyPath,
    hierarchyCard,
    imageName,
    uiPath,
    dbName: resolveDbName(record),
    equipNo: record.equip_no ?? record.equipNo ?? null,
    tagName: record.tag_name ?? record.tagName ?? null,
  };
}

function normalizeEquipmentRecord(record, sortOrder = 0) {
  const dbName = resolveDbName(record);
  const enriched = enrichEquipment({
    dept: DEFAULT_DEPT,
    name: dbName,
    equip_no: record.equip_no ?? record.equipNo ?? null,
    tag_name: record.tag_name ?? record.tagName ?? null,
    category: record.category ?? null,
    subcategory: record.subcategory ?? record.sub_category ?? null,
    location: record.location ?? null,
    commissioned: record.commissioned ?? null,
    drive: record.drive ?? null,
  });

  const specs = prepareSpecsForDb(record.specs || []);
  const rawHistory = (record.history || [])
    .map(normalizeHistoryRow)
    .filter((h) => h.obs || h.act || h.year || h.date_start);

  return {
    dept: DEFAULT_DEPT,
    category: enriched.category,
    subcategory: enriched.subcategory,
    equip_no: enriched.equip_no,
    tag_name: enriched.tag_name,
    name: dbName || enriched.name,
    location: emptyToNull(record.location) ?? enriched.location,
    commissioned: emptyToNull(record.commissioned),
    drive: emptyToNull(record.drive),
    sort_order: Number(record.sort_order ?? sortOrder) || sortOrder,
    specs,
    schedule: (record.schedule || []).map(normalizeScheduleRow),
    history: scopeHistoryFromSpecs(rawHistory, specs, {
      defaultSection: record.history_section ?? record.historySection,
      defaultSubSection: record.history_sub_section ?? record.historySubSection ?? record.sub_section,
    }),
  };
}

/**
 * Flatten feed JSON into an array of equipment records.
 * Accepts:
 *   - [ { name, specs, ... }, ... ]
 *   - { equipment: [ ... ] }
 *   - legacy power_data.json: { electrical: [...], instrument: [...], ... }
 */
function flattenFeedPayload(data) {
  if (Array.isArray(data)) return data;

  if (data && Array.isArray(data.equipment)) return data.equipment;

  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    const looksLegacy = keys.some((k) => Array.isArray(data[k]));
    if (looksLegacy) {
      const out = [];
      for (const [, items] of Object.entries(data)) {
        if (!Array.isArray(items)) continue;
        for (const item of items) out.push(item);
      }
      return out;
    }
  }

  throw new Error('Unrecognized feed format. Expected an array or { equipment: [...] } or legacy dept map.');
}

async function findExistingPpnId(conn, equipment) {
  if (equipment.equip_no) {
    const [rows] = await conn.execute(
      'SELECT id FROM ppn_equipment WHERE dept = ? AND equip_no = ? LIMIT 1',
      [DEFAULT_DEPT, equipment.equip_no],
    );
    if (rows[0]) return rows[0].id;
  }

  if (equipment.tag_name) {
    const [rows] = await conn.execute(
      'SELECT id FROM ppn_equipment WHERE dept = ? AND tag_name = ? LIMIT 1',
      [DEFAULT_DEPT, equipment.tag_name],
    );
    if (rows[0]) return rows[0].id;

    const [byTagInEquipNo] = await conn.execute(
      'SELECT id FROM ppn_equipment WHERE dept = ? AND equip_no = ? LIMIT 1',
      [DEFAULT_DEPT, equipment.tag_name],
    );
    if (byTagInEquipNo[0]) return byTagInEquipNo[0].id;
  }

  if (equipment.name) {
    const [rows] = await conn.execute(
      'SELECT id FROM ppn_equipment WHERE dept = ? AND name = ? LIMIT 1',
      [DEFAULT_DEPT, equipment.name],
    );
    if (rows[0]) return rows[0].id;
  }

  return null;
}

/** Match feed record by hierarchy_name, hierarchy_card, name, equip_no, tag_name. */
async function findExistingPpnIdFromRecord(conn, record) {
  const candidates = [
    resolveDbName(record),
    record.hierarchy_name,
    record.hierarchy_card,
    record.name,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  const uniqueNames = [...new Set(candidates)];

  for (const name of uniqueNames) {
    const id = await findExistingPpnId(conn, {
      name,
      equip_no: record.equip_no ?? record.equipNo,
      tag_name: record.tag_name ?? record.tagName,
    });
    if (id) return id;
  }
  return null;
}

async function ensureSubSectionsMeta(conn, equipId, section, subSection) {
  const [existing] = await conn.execute(
    'SELECT id FROM ppn_specs WHERE equip_id = ? AND lbl = ? LIMIT 1',
    [equipId, META_SUBSECTIONS_LBL],
  );
  if (existing[0]) return;

  const subSections = { ...DEFAULT_SUB_SECTIONS };
  const sec = normalizeSection(section) || 'mechanical';
  const sub = emptyToNull(subSection) || 'General';
  subSections[sec] = [sub];

  await conn.execute(
    `INSERT INTO ppn_specs (equip_id, section, sub_section, lbl, val, sort_order)
     VALUES (?, NULL, NULL, ?, ?, 99999)`,
    [equipId, META_SUBSECTIONS_LBL, JSON.stringify(subSections)],
  );
}

/**
 * Create a minimal ppn_equipment row (+ __subsections__) for history-only feeds
 * when the card has not been opened in the app yet.
 */
async function ensureHistoryEquipmentStub(conn, record, scope = {}) {
  const dbName = resolveDbName(record);
  const existingId = await findExistingPpnIdFromRecord(conn, record);
  if (existingId) return existingId;

  const enriched = enrichEquipment({
    dept: DEFAULT_DEPT,
    name: dbName,
    equip_no: record.equip_no ?? record.equipNo ?? null,
    tag_name: record.tag_name ?? record.tagName ?? null,
    category: record.category ?? null,
    subcategory: record.subcategory ?? record.sub_category ?? null,
    location: record.location ?? null,
  });

  const equipId = await insertPpnEquipment(conn, {
    dept: DEFAULT_DEPT,
    category: enriched.category,
    subcategory: enriched.subcategory,
    equip_no: enriched.equip_no,
    tag_name: enriched.tag_name,
    name: dbName || enriched.name,
    location: emptyToNull(record.location),
    commissioned: emptyToNull(record.commissioned),
    drive: emptyToNull(record.drive),
    sort_order: Number(record.sort_order) || 0,
  });

  await ensureSubSectionsMeta(
    conn,
    equipId,
    scope.section ?? record.history_section ?? record.section ?? 'mechanical',
    scope.subSection ?? record.sub_section ?? record.subSection ?? 'General',
  );

  return equipId;
}

async function deletePpnTree(conn, equipId) {
  await conn.execute('DELETE FROM ppn_history WHERE equip_id = ?', [equipId]);
  await conn.execute('DELETE FROM ppn_oem_schedule WHERE equip_id = ?', [equipId]);
  await conn.execute('DELETE FROM ppn_specs WHERE equip_id = ?', [equipId]);
  await conn.execute('DELETE FROM ppn_equipment WHERE id = ?', [equipId]);
}

async function insertPpnEquipment(conn, equipment) {
  const [result] = await conn.execute(
    `INSERT INTO ppn_equipment
       (dept, category, subcategory, equip_no, tag_name, name, location, commissioned, drive, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      equipment.dept,
      equipment.category,
      equipment.subcategory,
      equipment.equip_no,
      equipment.tag_name,
      equipment.name,
      equipment.location,
      equipment.commissioned,
      equipment.drive,
      equipment.sort_order,
    ],
  );
  return result.insertId;
}

async function insertPpnSpecs(conn, equipId, specs) {
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    if (!s.lbl) continue;
    await conn.execute(
      `INSERT INTO ppn_specs (equip_id, section, sub_section, lbl, val, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [equipId, s.section, s.sub_section, s.lbl, s.val ?? '', i],
    );
  }
}

async function insertPpnSchedule(conn, equipId, scheduleRows) {
  for (const row of scheduleRows) {
    await conn.execute(
      `INSERT INTO ppn_oem_schedule
         (equip_id, no, comp, act, iv_W, iv_M, iv_Q, iv_H, iv_Y, iv_T, iv_3Y)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipId, row.no, row.comp, row.act,
        row.iv_W, row.iv_M, row.iv_Q, row.iv_H, row.iv_Y, row.iv_T, row.iv_3Y,
      ],
    );
  }
}

async function insertPpnHistory(conn, equipId, historyRows) {
  for (const row of historyRows) {
    const refs = row.equipment_refs?.length
      ? row.equipment_refs
      : (row.section && row.sub_section
        ? [{ section: row.section, sub_section: row.sub_section }]
        : []);
    const equipmentRefsJson = refs.length ? JSON.stringify(refs) : null;
    const primary = refs[0] || {};

    await conn.execute(
      `INSERT INTO ppn_history
         (equip_id, section, sub_section, equipment_refs, season, year, date_start, date_finish, obs, act, cost, svc, provider, resp, rem)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        equipId,
        primary.section || row.section || null,
        primary.sub_section || row.sub_section || null,
        equipmentRefsJson,
        row.season, row.year, row.date_start, row.date_finish,
        row.obs, row.act, row.cost, row.svc, row.provider, row.resp, row.rem,
      ],
    );
  }
}

async function importPpnRecord(conn, rawRecord, index, opts) {
  const equipment = normalizeEquipmentRecord(rawRecord, index);

  if (!equipment.name) {
    return {
      status: 'skipped',
      reason: 'missing name',
      name: rawRecord.name || '(unnamed)',
      ...buildFeedMeta(rawRecord),
    };
  }

  const feedMeta = buildFeedMeta(rawRecord);

  if (opts.dryRun) {
    const specSections = equipment.specs
      .filter((s) => s.lbl !== META_SUBSECTIONS_LBL)
      .reduce((acc, s) => {
        acc[s.section] = (acc[s.section] || 0) + 1;
        return acc;
      }, {});

    return {
      status: 'dry-run',
      name: equipment.name,
      specs: equipment.specs.length - 1,
      specSections,
      schedule: equipment.schedule.length,
      history: equipment.history.length,
      ...feedMeta,
    };
  }

  const connTx = await conn.getConnection();
  try {
    await connTx.beginTransaction();

    const existingId = await findExistingPpnId(connTx, equipment);
    if (existingId) {
      if (!opts.replace) {
        await connTx.rollback();
        return {
          status: 'skipped',
          reason: 'exists',
          name: equipment.name,
          equipId: existingId,
          ...feedMeta,
          uiPath: `/power-plant-equipment-new/${existingId}`,
        };
      }
      await deletePpnTree(connTx, existingId);
    }

    const equipId = await insertPpnEquipment(connTx, equipment);
    await insertPpnSpecs(connTx, equipId, equipment.specs);
    await insertPpnSchedule(connTx, equipId, equipment.schedule);
    await insertPpnHistory(connTx, equipId, equipment.history);

    await connTx.commit();
    return {
      status: 'imported',
      name: equipment.name,
      equipId,
      specs: equipment.specs.length - 1,
      schedule: equipment.schedule.length,
      history: equipment.history.length,
      ...feedMeta,
      uiPath: `/power-plant-equipment-new/${equipId}`,
    };
  } catch (err) {
    await connTx.rollback();
    throw err;
  } finally {
    connTx.release();
  }
}

module.exports = {
  DEFAULT_DEPT,
  META_SUBSECTIONS_LBL,
  SPEC_SECTIONS,
  flattenFeedPayload,
  normalizeEquipmentRecord,
  normalizeHistoryRow,
  prepareSpecsForDb,
  scopeHistoryFromSpecs,
  inferPrimarySectionFromSpecs,
  readSubSectionsMeta,
  importPpnRecord,
  findExistingPpnId,
  findExistingPpnIdFromRecord,
  ensureHistoryEquipmentStub,
  ensureSubSectionsMeta,
  insertPpnEquipment,
  deletePpnTree,
  formatHierarchyPath,
  buildFeedMeta,
  resolveDbName,
};
