const { canManageLockedCards } = require('../services/lockedCardManageAccess.service');
const { ensureMoveHistoryTable, recordHierarchyMoves } = require('./hierarchyMoveHistory');

function uniquePositiveIds(raw) {
  const seen = new Set();
  const ids = [];
  for (const value of Array.isArray(raw) ? raw : []) {
    const id = parseInt(value, 10);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function collectDescendantIds(node, acc = []) {
  if (!node) return acc;
  acc.push(Number(node.dbId || node.id));
  for (const child of node.children || []) collectDescendantIds(child, acc);
  return acc;
}

function collectEquipmentLeaves(node, acc = []) {
  if (!node) return acc;
  if (node.nodeType === 'equipment') acc.push(node);
  for (const child of node.children || []) collectEquipmentLeaves(child, acc);
  return acc;
}

function nameKey(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Move same-level hierarchy nodes under a new parent. Children stay attached
 * to each moved folder. Specs / schedule / history are not copied.
 */
async function moveHierarchyNodes({
  house,
  nodeIds: rawNodeIds,
  targetParentId: rawTargetParentId,
  user,
  pool,
  fetchTree,
  findNodeById,
  pathIdsForNodeId,
  categorySubcategoryFromPath,
  findSiblingNameConflict,
  findGlobalSubEquipmentNameConflict,
  isProtectedSeededNodeId,
  table,
  equipTable,
  refreshLocation = false,
}) {
  const nodeIds = uniquePositiveIds(rawNodeIds);
  const targetParentId = parseInt(rawTargetParentId, 10);
  if (!nodeIds.length) {
    return { error: { status: 400, message: 'Select at least one item to move.' } };
  }
  if (!targetParentId) {
    return { error: { status: 400, message: 'Select a destination folder.' } };
  }

  const tree = await fetchTree();
  if (!tree) {
    return { error: { status: 404, message: 'Hierarchy not found.' } };
  }

  const targetParent = findNodeById(tree, String(targetParentId));
  if (!targetParent) {
    return { error: { status: 404, message: 'Destination folder not found.' } };
  }
  if (targetParent.nodeType === 'equipment') {
    return { error: { status: 400, message: 'Cannot move items into an equipment card.' } };
  }

  const sources = [];
  for (const id of nodeIds) {
    const node = findNodeById(tree, String(id));
    if (!node) {
      return { error: { status: 404, message: 'One of the selected items was not found.' } };
    }
    sources.push(node);
  }

  const rootId = String(tree.id);
  if (sources.some((node) => String(node.id) === rootId)) {
    return { error: { status: 400, message: 'Cannot move the plant root.' } };
  }

  const depths = sources.map((node) => pathIdsForNodeId(tree, node.id).length);
  const sourceDepth = depths[0];
  if (depths.some((d) => d !== sourceDepth)) {
    return { error: { status: 400, message: 'Select items from the same level to move together.' } };
  }

  const targetDepth = pathIdsForNodeId(tree, targetParent.id).length;
  if (targetDepth !== sourceDepth - 1) {
    return {
      error: {
        status: 400,
        message: 'Items can only be moved into a folder of the parent level.',
      },
    };
  }

  const canManage = await canManageLockedCards(user, house);
  for (const node of sources) {
    let locked = false;
    if (house === 'sugar') {
      locked = Boolean(node.isImported)
        || collectEquipmentLeaves(node).some((leaf) => leaf.isImported);
    } else if (typeof isProtectedSeededNodeId === 'function') {
      locked = await isProtectedSeededNodeId(node.dbId || node.id, tree);
    }
    if (locked && !canManage) {
      return {
        error: {
          status: 403,
          message: house === 'sugar'
            ? 'Imported hierarchy items cannot be moved without locked-card manage access.'
            : 'Built-in hierarchy items cannot be moved without locked-card manage access.',
        },
      };
    }
  }

  const forbidden = new Set();
  for (const node of sources) {
    collectDescendantIds(node).forEach((id) => forbidden.add(id));
  }
  if (forbidden.has(targetParentId)) {
    return { error: { status: 400, message: 'Cannot move a folder into itself or one of its items.' } };
  }

  const stillMoving = sources.filter((node) => Number(node.parentId) !== targetParentId);
  if (!stillMoving.length) {
    return { error: { status: 400, message: 'Those items are already in this folder.' } };
  }

  const movingNameKeys = stillMoving.map((node) => nameKey(node.name));
  if (new Set(movingNameKeys).size !== movingNameKeys.length) {
    return { error: { status: 409, message: 'Two selected items have the same name and cannot share a folder.' } };
  }

  const movingIds = new Set(nodeIds);
  for (const node of stillMoving) {
    const conflict = await findSiblingNameConflict(targetParentId, node.name, node.dbId || node.id);
    if (conflict && !movingIds.has(Number(conflict.id))) {
      return {
        error: { status: 409, message: `"${node.name}" already exists in the destination folder.` },
      };
    }
    if (house === 'sugar' && node.nodeType === 'equipment' && findGlobalSubEquipmentNameConflict) {
      const globalConflict = await findGlobalSubEquipmentNameConflict(
        node.lookupName || node.name,
        node.dbId || node.id,
      );
      if (globalConflict && !movingIds.has(Number(globalConflict.id))) {
        return {
          error: {
            status: 409,
            message: `Sub equipment name "${node.lookupName || node.name}" already exists in another section.`,
          },
        };
      }
    }
  }

  await ensureMoveHistoryTable();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[{ maxSort }]] = await conn.execute(
      `SELECT COALESCE(MAX(sort_order), -1) AS maxSort FROM \`${table}\`
       WHERE parent_id = ? AND is_active = 1`,
      [targetParentId],
    );
    let nextSort = (maxSort ?? -1) + 1;

    for (const node of stillMoving) {
      const id = node.dbId || Number(node.id);
      await conn.execute(
        `UPDATE \`${table}\` SET parent_id = ?, sort_order = ? WHERE id = ? AND is_active = 1`,
        [targetParentId, nextSort, id],
      );
      nextSort += 1;
    }

    await recordHierarchyMoves(conn, {
      house,
      tree,
      movedNodes: stillMoving,
      targetParent,
      user,
      pathIdsForNodeId,
      findNodeById,
    });

    const rebuilt = await fetchTree(conn);
    if (rebuilt) {
      for (const id of nodeIds) {
        const moved = findNodeById(rebuilt, String(id));
        if (!moved) continue;
        const leaves = collectEquipmentLeaves(moved);
        for (const leaf of leaves) {
          const equipId = leaf.shnEquipId || leaf.ppnEquipId;
          if (!equipId) continue;
          const { category, subcategory } = categorySubcategoryFromPath(rebuilt, leaf.id);
          if (refreshLocation) {
            await conn.execute(
              `UPDATE \`${equipTable}\`
               SET category = ?, subcategory = ?, location = COALESCE(?, location)
               WHERE id = ?`,
              [category || null, subcategory || null, leaf.histLocation || null, equipId],
            );
          } else {
            await conn.execute(
              `UPDATE \`${equipTable}\` SET category = ?, subcategory = ? WHERE id = ?`,
              [category || null, subcategory || null, equipId],
            );
          }
        }
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return { moved: stillMoving.length, targetParentId };
}

module.exports = {
  uniquePositiveIds,
  collectDescendantIds,
  collectEquipmentLeaves,
  moveHierarchyNodes,
};
