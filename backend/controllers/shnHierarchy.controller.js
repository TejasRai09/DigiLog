const { pool } = require('../config/mysql');
const { sendServerError, MSG } = require('../utils/httpError');
const {
  getHierarchyTree,
  getNodeById,
  pathIdsForNodeId,
  pathLabels,
  categorySubcategoryFromPath,
  findNodeById,
  resolveShnEquipIdForNode,
  findSiblingNameConflict,
  findGlobalSubEquipmentNameConflict,
  NODE_SELECT,
  rowToPayload,
} = require('../utils/shnHierarchyLib');

const getTree = async (req, res) => {
  try {
    const tree = await getHierarchyTree();
    res.json({ tree, source: tree ? 'database' : 'empty' });
  } catch (err) {
    sendServerError(res, 'shnHierarchy.getTree:', err, MSG.LOAD);
  }
};

const getPath = async (req, res) => {
  try {
    const nodeId = parseInt(req.params.nodeId, 10);
    if (!nodeId) return res.status(400).json({ message: 'Invalid node id.' });
    const tree = await getHierarchyTree();
    if (!tree) return res.status(404).json({ message: 'Hierarchy not found.' });
    const node = findNodeById(tree, String(nodeId));
    if (!node) return res.status(404).json({ message: 'Node not found.' });
    const pathIds = pathIdsForNodeId(tree, String(nodeId));
    const labels = pathLabels(tree, pathIds);
    const { category, subcategory } = categorySubcategoryFromPath(tree, String(nodeId));
    res.json({ pathIds, labels, category, subcategory, node });
  } catch (err) {
    sendServerError(res, 'shnHierarchy.getPath:', err, MSG.LOAD);
  }
};

const createNode = async (req, res) => {
  try {
    const parent_id = req.body.parent_id != null ? parseInt(req.body.parent_id, 10) : null;
    const node_type = String(req.body.node_type || 'group').trim();
    const name = String(req.body.name || '').trim();
    const equip_no = String(req.body.equip_no || req.body.equipNo || '').trim() || null;
    const lookup_name = String(req.body.lookup_name || req.body.lookupName || '').trim() || null;
    const hist_location = String(req.body.hist_location || req.body.histLocation || '').trim() || null;

    if (!name) return res.status(400).json({ message: 'name is required.' });
    if (!['group', 'equipment'].includes(node_type)) {
      return res.status(400).json({ message: 'node_type must be group or equipment.' });
    }

    if (parent_id) {
      const parent = await getNodeById(parent_id);
      if (!parent) return res.status(404).json({ message: 'Parent node not found.' });
      if (parent.nodeType === 'equipment') {
        return res.status(400).json({ message: 'Cannot add children under an equipment node.' });
      }
    }

    const nameConflict = await findSiblingNameConflict(parent_id, name);
    if (nameConflict) {
      return res.status(409).json({ message: `"${name}" already exists at this level.` });
    }

    const subEquipmentName = node_type === 'equipment' ? (lookup_name || name) : null;
    if (node_type === 'equipment') {
      const globalConflict = await findGlobalSubEquipmentNameConflict(subEquipmentName);
      if (globalConflict) {
        return res.status(409).json({
          message: `Sub equipment name "${subEquipmentName}" already exists in another section.`,
        });
      }
    }

    const [[{ maxSort }]] = await pool.execute(
      `SELECT COALESCE(MAX(sort_order), -1) AS maxSort FROM shn_hierarchy_node
       WHERE ${parent_id ? 'parent_id = ?' : 'parent_id IS NULL'}`,
      parent_id ? [parent_id] : [],
    );

    const sort_order = req.body.sort_order != null
      ? parseInt(req.body.sort_order, 10)
      : (maxSort ?? -1) + 1;

    let shn_equip_id = null;
    const resolvedLookupName = node_type === 'equipment' ? (lookup_name || name) : lookup_name;
    const resolvedHistLocation = node_type === 'equipment' ? hist_location : null;
    if (node_type === 'equipment') {
      shn_equip_id = await resolveShnEquipIdForNode({
        equipNo: equip_no,
        lookupName: resolvedLookupName,
        name,
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO shn_hierarchy_node
         (parent_id, node_type, name, equip_no, lookup_name, hist_location, shn_equip_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parent_id,
        node_type,
        name,
        equip_no,
        resolvedLookupName,
        resolvedHistLocation,
        shn_equip_id,
        sort_order,
      ],
    );

    const created = await getNodeById(result.insertId);
    const tree = await getHierarchyTree();
    res.status(201).json({
      node: created,
      pathIds: tree ? pathIdsForNodeId(tree, String(result.insertId)) : [String(result.insertId)],
    });
  } catch (err) {
    sendServerError(res, 'shnHierarchy.createNode:', err, MSG.SAVE);
  }
};

const updateNode = async (req, res) => {
  try {
    const id = parseInt(req.params.nodeId, 10);
    if (!id) return res.status(400).json({ message: 'Invalid node id.' });

    const existing = await getNodeById(id);
    if (!existing) return res.status(404).json({ message: 'Node not found.' });
    if (existing.isImported) {
      return res.status(403).json({ message: 'Imported hierarchy items cannot be edited.' });
    }

    const name = req.body.name != null ? String(req.body.name).trim() : existing.name;
    const equip_no = req.body.equip_no != null || req.body.equipNo != null
      ? (String(req.body.equip_no || req.body.equipNo || '').trim() || null)
      : existing.equipNo;
    const lookup_name = req.body.lookup_name != null || req.body.lookupName != null
      ? (String(req.body.lookup_name || req.body.lookupName || '').trim() || null)
      : existing.lookupName;
    const hist_location = req.body.hist_location != null || req.body.histLocation != null
      ? (String(req.body.hist_location || req.body.histLocation || '').trim() || null)
      : existing.histLocation;

    if (!name) return res.status(400).json({ message: 'name is required.' });

    const parentId = existing.parentId != null ? parseInt(existing.parentId, 10) : null;
    const nameConflict = await findSiblingNameConflict(parentId, name, id);
    if (nameConflict) {
      return res.status(409).json({ message: `"${name}" already exists at this level.` });
    }

    if (existing.nodeType === 'equipment') {
      const subEquipmentName = lookup_name || name;
      const globalConflict = await findGlobalSubEquipmentNameConflict(subEquipmentName, id);
      if (globalConflict) {
        return res.status(409).json({
          message: `Sub equipment name "${subEquipmentName}" already exists in another section.`,
        });
      }
    }

    const sort_order = req.body.sort_order != null
      ? parseInt(req.body.sort_order, 10)
      : existing.sortOrder;

    let shn_equip_id = existing.shnEquipId;
    if (existing.nodeType === 'equipment') {
      shn_equip_id = await resolveShnEquipIdForNode({
        equipNo: equip_no,
        lookupName: lookup_name || name,
        name,
        shnEquipId: existing.shnEquipId,
      });
    }

    await pool.execute(
      `UPDATE shn_hierarchy_node
       SET name = ?, equip_no = ?, lookup_name = ?, hist_location = ?, shn_equip_id = ?, sort_order = ?
       WHERE id = ?`,
      [name, equip_no, lookup_name, hist_location, shn_equip_id, sort_order, id],
    );

    const updated = await getNodeById(id);
    res.json({ node: updated });
  } catch (err) {
    sendServerError(res, 'shnHierarchy.updateNode:', err, MSG.SAVE);
  }
};

const deleteNode = async (req, res) => {
  try {
    const id = parseInt(req.params.nodeId, 10);
    if (!id) return res.status(400).json({ message: 'Invalid node id.' });

    const existing = await getNodeById(id);
    if (!existing) return res.status(404).json({ message: 'Node not found.' });
    if (existing.isImported) {
      return res.status(403).json({ message: 'Imported hierarchy items cannot be deleted.' });
    }

    const [[rootRow]] = await pool.execute(
      'SELECT id FROM shn_hierarchy_node WHERE parent_id IS NULL AND is_active = 1 ORDER BY id LIMIT 1',
    );
    if (rootRow && rootRow.id === id) {
      return res.status(400).json({ message: 'Cannot delete the root node.' });
    }

    const [[child]] = await pool.execute(
      'SELECT id FROM shn_hierarchy_node WHERE parent_id = ? AND is_active = 1 LIMIT 1',
      [id],
    );
    if (child) {
      return res.status(400).json({ message: 'Remove or move child nodes first.' });
    }

    const [result] = await pool.execute(
      'UPDATE shn_hierarchy_node SET is_active = 0 WHERE id = ?',
      [id],
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Node not found.' });
    }
    res.json({ message: 'Node deleted.' });
  } catch (err) {
    sendServerError(res, 'shnHierarchy.deleteNode:', err, MSG.DELETE);
  }
};

/**
 * PATCH /hierarchy/:nodeId/sync-name
 * Sync hierarchy leaf name when equipment is renamed from the detail form.
 */
const syncNodeName = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'name is required.' });

    let nodeId = parseInt(req.params.nodeId, 10);
    const shnEquipId = req.body.shn_equip_id != null || req.body.ppn_equip_id != null
      ? parseInt(req.body.shn_equip_id || req.body.ppn_equip_id, 10)
      : null;

    let existing = nodeId ? await getNodeById(nodeId) : null;

    if (!existing && shnEquipId) {
      const [[row]] = await pool.execute(
        `SELECT ${NODE_SELECT}
         FROM shn_hierarchy_node
         WHERE shn_equip_id = ? AND is_active = 1 AND node_type = 'equipment'
         ORDER BY id ASC LIMIT 1`,
        [shnEquipId],
      );
      if (row) {
        existing = rowToPayload(row);
        nodeId = existing.dbId;
      }
    }

    if (!existing) return res.status(404).json({ message: 'Hierarchy node not found.' });
    if (existing.nodeType !== 'equipment') {
      return res.status(400).json({ message: 'Only equipment nodes can be renamed via sync.' });
    }
    if (existing.isImported) {
      return res.status(403).json({ message: 'Imported hierarchy items cannot be renamed.' });
    }

    const parentId = existing.parentId != null ? parseInt(existing.parentId, 10) : null;
    const nameConflict = await findSiblingNameConflict(parentId, name, nodeId);
    if (nameConflict) {
      return res.status(409).json({ message: `"${name}" already exists at this level.` });
    }

    const globalConflict = await findGlobalSubEquipmentNameConflict(name, nodeId);
    if (globalConflict) {
      return res.status(409).json({
        message: `Sub equipment name "${name}" already exists in another section.`,
      });
    }

    const nextEquipId = shnEquipId || existing.shnEquipId || null;

    await pool.execute(
      `UPDATE shn_hierarchy_node
       SET name = ?, lookup_name = ?, shn_equip_id = COALESCE(?, shn_equip_id)
       WHERE id = ?`,
      [name, name, nextEquipId, nodeId],
    );

    const updated = await getNodeById(nodeId);
    res.json({ message: 'Hierarchy name synced.', node: updated });
  } catch (err) {
    sendServerError(res, 'shnHierarchy.syncNodeName:', err, MSG.SAVE);
  }
};

const CARD_SOURCES = [
  {
    table: 'shn_specs',
    key: 'specs',
    extraWhere: "AND lbl NOT IN ('__subsections__', '__subgroup_meta__')",
  },
  { table: 'shn_oem_schedule', key: 'schedule', extraWhere: '' },
  { table: 'shn_history', key: 'history', extraWhere: '' },
];

function equipTagKey(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

function equipNameKey(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Child equipment cards (sub_section) per hierarchy node and discipline.
 * One bulk payload so the mind map can render the whole plant without a
 * request per equipment.
 */
const getCards = async (req, res) => {
  try {
    const [nodes] = await pool.execute(
      `SELECT id, name, lookup_name, equip_no, shn_equip_id
       FROM shn_hierarchy_node
       WHERE is_active = 1 AND node_type = 'equipment'`,
    );

    const [equipment] = await pool.execute(
      'SELECT id, equip_no, tag_name, name FROM shn_equipment',
    );

    const byTag = new Map();
    const byName = new Map();
    for (const row of equipment) {
      for (const tag of [row.equip_no, row.tag_name]) {
        const key = equipTagKey(tag);
        if (key && !byTag.has(key)) byTag.set(key, row.id);
      }
      const nameKey = equipNameKey(row.name);
      if (nameKey && !byName.has(nameKey)) byName.set(nameKey, row.id);
    }

    // equipId -> section -> cardName -> counts
    const cardsByEquip = new Map();
    for (const source of CARD_SOURCES) {
      const [rows] = await pool.query(
        `SELECT equip_id, section, sub_section, COUNT(*) AS total
         FROM \`${source.table}\`
         WHERE sub_section IS NOT NULL AND TRIM(sub_section) <> '' ${source.extraWhere}
         GROUP BY equip_id, section, sub_section`,
      );
      for (const row of rows) {
        const section = String(row.section || '').trim().toLowerCase();
        const name = String(row.sub_section || '').trim();
        if (!row.equip_id || !section || !name) continue;

        if (!cardsByEquip.has(row.equip_id)) cardsByEquip.set(row.equip_id, new Map());
        const bySection = cardsByEquip.get(row.equip_id);
        if (!bySection.has(section)) bySection.set(section, new Map());
        const byCard = bySection.get(section);
        if (!byCard.has(name)) byCard.set(name, { name, specs: 0, schedule: 0, history: 0 });
        byCard.get(name)[source.key] += Number(row.total) || 0;
      }
    }

    // Attach tag / equip no from subgroup meta onto child cards when present.
    const [metaRows] = await pool.query(
      `SELECT equip_id, val FROM shn_specs WHERE lbl = '__subgroup_meta__'`,
    );
    for (const row of metaRows) {
      let parsed;
      try {
        parsed = JSON.parse(row.val || '{}');
      } catch {
        continue;
      }
      const bySection = cardsByEquip.get(row.equip_id);
      if (!bySection || !parsed || typeof parsed !== 'object') continue;
      for (const [section, groups] of Object.entries(parsed)) {
        const byCard = bySection.get(String(section).trim().toLowerCase());
        if (!byCard || !groups || typeof groups !== 'object') continue;
        for (const [subName, meta] of Object.entries(groups)) {
          const card = byCard.get(subName);
          if (!card) continue;
          const tag = String(meta?.tagNo || meta?.tag_no || '').trim()
            || String(meta?.equipNo || meta?.equip_no || '').trim();
          if (tag) card.tagNo = tag;
        }
      }
    }

    const byNodeId = {};
    let nodesWithCards = 0;
    for (const node of nodes) {
      const equipId =
        node.shn_equip_id ||
        byTag.get(equipTagKey(node.equip_no)) ||
        byName.get(equipNameKey(node.lookup_name || node.name)) ||
        null;
      if (!equipId) continue;

      const bySection = cardsByEquip.get(equipId);
      if (!bySection?.size) continue;

      const payload = {};
      for (const [section, byCard] of bySection) {
        payload[section] = [...byCard.values()].sort((a, b) => a.name.localeCompare(b.name));
      }
      byNodeId[String(node.id)] = payload;
      nodesWithCards += 1;
    }

    res.json({ byNodeId, nodeCount: nodes.length, nodesWithCards });
  } catch (err) {
    sendServerError(res, 'shnHierarchy.getCards:', err, MSG.LOAD);
  }
};

module.exports = {
  getTree,
  getPath,
  getCards,
  createNode,
  updateNode,
  deleteNode,
  syncNodeName,
};
