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

    const [[{ maxSort }]] = await pool.execute(
      `SELECT COALESCE(MAX(sort_order), -1) AS maxSort FROM shn_hierarchy_node
       WHERE ${parent_id ? 'parent_id = ?' : 'parent_id IS NULL'}`,
      parent_id ? [parent_id] : [],
    );

    const sort_order = req.body.sort_order != null
      ? parseInt(req.body.sort_order, 10)
      : (maxSort ?? -1) + 1;

    let shn_equip_id = null;
    if (node_type === 'equipment') {
      shn_equip_id = await resolveShnEquipIdForNode({
        equipNo: equip_no,
        lookupName: lookup_name || name,
        name,
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO shn_hierarchy_node
         (parent_id, node_type, name, equip_no, lookup_name, shn_equip_id, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [parent_id, node_type, name, equip_no, lookup_name, shn_equip_id, sort_order],
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

    const name = req.body.name != null ? String(req.body.name).trim() : existing.name;
    const equip_no = req.body.equip_no != null || req.body.equipNo != null
      ? (String(req.body.equip_no || req.body.equipNo || '').trim() || null)
      : existing.equipNo;
    const lookup_name = req.body.lookup_name != null || req.body.lookupName != null
      ? (String(req.body.lookup_name || req.body.lookupName || '').trim() || null)
      : existing.lookupName;

    if (!name) return res.status(400).json({ message: 'name is required.' });

    const parentId = existing.parentId != null ? parseInt(existing.parentId, 10) : null;
    const nameConflict = await findSiblingNameConflict(parentId, name, id);
    if (nameConflict) {
      return res.status(409).json({ message: `"${name}" already exists at this level.` });
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
       SET name = ?, equip_no = ?, lookup_name = ?, shn_equip_id = ?, sort_order = ?
       WHERE id = ?`,
      [name, equip_no, lookup_name, shn_equip_id, sort_order, id],
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

module.exports = {
  getTree,
  getPath,
  createNode,
  updateNode,
  deleteNode,
};
