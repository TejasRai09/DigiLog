/** Generic helpers for equipment hierarchy trees (static or DB-backed). */

import {
  POWER_PLANT_EQUIPMENT_ROOT,
  PROTECTED_ROOT_CATEGORY_NAMES,
} from '../config/powerPlantEquipmentHierarchy';

export function findNodeById(root, nodeId) {
  if (!root || nodeId == null) return null;
  if (String(root.id) === String(nodeId)) return root;
  for (const child of root.children || []) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

export function findNodeByPath(root, pathIds = []) {
  if (!root || !pathIds?.length) return root;
  let node = root;
  for (let i = 1; i < pathIds.length; i += 1) {
    const next = node.children?.find((c) => String(c.id) === String(pathIds[i]));
    if (!next) return node;
    node = next;
  }
  return node;
}

export function pathIdsForNodeId(root, nodeId) {
  if (!root || nodeId == null) return root ? [root.id] : [];
  const walk = (node, trail) => {
    const nextTrail = [...trail, node.id];
    if (String(node.id) === String(nodeId)) return nextTrail;
    for (const child of node.children || []) {
      const found = walk(child, nextTrail);
      if (found) return found;
    }
    return null;
  };
  return walk(root, []) || (root ? [root.id] : []);
}

export function pathLabels(root, pathIds = []) {
  if (!root || !pathIds?.length) return [];
  return pathIds
    .map((id) => findNodeById(root, id)?.name)
    .filter(Boolean);
}

export function categorySubcategoryFromNode(root, nodeId) {
  const ids = pathIdsForNodeId(root, nodeId);
  const labels = pathLabels(root, ids);
  return {
    category: labels[1] || '',
    subcategory: labels[2] || '',
  };
}

/** Folder node (category / subcategory) — not an equipment leaf. */
export function isHierarchyGroup(node) {
  if (!node) return false;
  if (node.nodeType === 'group') return true;
  if (node.nodeType === 'equipment') return false;
  // Static tree: groups have child folders or isLeaf is false when children exist
  return Boolean(node.children?.length) || node.isLeaf === false;
}

/** Equipment leaf in the hierarchy (opens discipline picker). */
export function isHierarchyEquipment(node) {
  if (!node) return false;
  if (node.nodeType === 'equipment') return true;
  if (node.nodeType === 'group') return false;
  return Boolean(node.isLeaf && !node.children?.length);
}

/** Excel-imported sugar house node — read-only in manage UI. */
export function isImportedHierarchyNode(node) {
  return Boolean(node?.isImported);
}

/** Whether edit/delete should be disabled for a hierarchy node. */
export function isHierarchyNodeLocked(tree, node, apiBase = '/power-new') {
  if (!node) return true;
  if (apiBase === '/sugar-new') return isImportedHierarchyNode(node);
  return Boolean(tree && isProtectedSeededNode(tree, node.id));
}

/** Separator used between sub-equipment name and Inst. History card location. */
export const SUGAR_LEAF_NAME_SEP = ' · ';

/** Compose stored card title: "Equipment name · Location". */
export function composeSugarLeafDisplayName(equipmentName, location) {
  const name = String(equipmentName || '').trim();
  const loc = String(location || '').trim();
  if (!name) return '';
  if (!loc) return name;
  return `${name}${SUGAR_LEAF_NAME_SEP}${loc}`;
}

/**
 * Split a sugar leaf into equipment name + history-card location.
 * Prefers explicit lookupName / histLocation when present.
 */
export function splitSugarLeafLabel(nodeOrName, histLocation = null) {
  if (nodeOrName && typeof nodeOrName === 'object') {
    const lookup = String(nodeOrName.lookupName || '').trim();
    const hist = String(nodeOrName.histLocation || histLocation || '').trim();
    if (lookup || hist) {
      return {
        equipmentName: lookup || String(nodeOrName.name || '').split(SUGAR_LEAF_NAME_SEP)[0].trim(),
        location: hist || '',
      };
    }
    return splitSugarLeafLabel(nodeOrName.name, histLocation);
  }

  const full = String(nodeOrName || '').trim();
  const sepIdx = full.indexOf(SUGAR_LEAF_NAME_SEP);
  if (sepIdx === -1) {
    // Also accept a plain "." separator if users typed it.
    const dotIdx = full.indexOf('.');
    if (dotIdx > 0 && String(histLocation || '').trim() === '') {
      return {
        equipmentName: full.slice(0, dotIdx).trim(),
        location: full.slice(dotIdx + 1).trim(),
      };
    }
    return {
      equipmentName: full,
      location: String(histLocation || '').trim(),
    };
  }
  return {
    equipmentName: full.slice(0, sepIdx).trim(),
    location: full.slice(sepIdx + SUGAR_LEAF_NAME_SEP.length).trim(),
  };
}

/** Sub equipment leaf name used for global uniqueness (lookup_name or name). */
export function subEquipmentNameKey(node) {
  if (!node) return '';
  if (node.lookupName) return String(node.lookupName).trim().toLowerCase();
  const { equipmentName } = splitSugarLeafLabel(node);
  return equipmentName.toLowerCase();
}

/** Find another equipment leaf with the same sub equipment name anywhere in the tree. */
export function findGlobalSubEquipmentNameInTree(tree, name, excludeNodeId = null) {
  const target = String(name || '').trim().toLowerCase();
  if (!target || !tree) return null;

  const walk = (node) => {
    if (!node) return null;
    if (isHierarchyEquipment(node)) {
      if (subEquipmentNameKey(node) === target && String(node.id) !== String(excludeNodeId)) {
        return node;
      }
    }
    for (const child of node.children || []) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };

  return walk(tree);
}

/** Built-in root categories (150TPH, 70TPH, 30.85MW STG, WTP) — read-only on cards. */
export function isProtectedRootCategory(node) {
  const name = String(node?.name || '').trim();
  if (!name) return false;
  return PROTECTED_ROOT_CATEGORY_NAMES.some(
    (protectedName) => protectedName.toLowerCase() === name.toLowerCase(),
  );
}

export function isProtectedRootCategoryName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return false;
  return PROTECTED_ROOT_CATEGORY_NAMES.some(
    (protectedName) => protectedName.toLowerCase() === trimmed.toLowerCase(),
  );
}

function normalizeHierarchyPathKey(labels) {
  return labels
    .map((label) => String(label || '').trim().toLowerCase())
    .filter(Boolean)
    .join('\u001f');
}

function buildSeededHierarchyPathKeys(staticRoot) {
  const keys = new Set();
  const walk = (node, trail) => {
    const nextTrail = [...trail, node.name];
    keys.add(normalizeHierarchyPathKey(nextTrail));
    for (const child of node.children || []) {
      walk(child, nextTrail);
    }
  };
  for (const child of staticRoot.children || []) {
    walk(child, []);
  }
  return keys;
}

const SEEDED_HIERARCHY_PATH_KEYS = buildSeededHierarchyPathKeys(POWER_PLANT_EQUIPMENT_ROOT);

/** Seeded nodes under 150TPH / 70TPH / 30.85MW STG / WTP — not user-created additions. */
export function isProtectedSeededNode(root, nodeId) {
  if (!root || nodeId == null) return false;
  const labels = pathLabels(root, pathIdsForNodeId(root, nodeId));
  if (labels.length < 2) return false;
  if (!isProtectedRootCategoryName(labels[1])) return false;
  const pathKey = normalizeHierarchyPathKey(labels.slice(1));
  return SEEDED_HIERARCHY_PATH_KEYS.has(pathKey);
}

/** True when node sits under 150TPH BLR, 70TPH BLR, 30.85MW STG, or WTP. */
export function isUnderProtectedRootCategory(root, nodeId) {
  if (!root || nodeId == null) return false;
  const ids = pathIdsForNodeId(root, nodeId);
  if (ids.length < 2) return false;
  const categoryNode = findNodeById(root, ids[1]);
  return isProtectedRootCategoryName(categoryNode?.name);
}

/** True when current navigation is inside one of the four built-in category trees. */
export function isInsideProtectedBranch(root, pathIds = []) {
  if (!root || pathIds.length < 2) return false;
  const categoryNode = findNodeById(root, pathIds[1]);
  return isProtectedRootCategoryName(categoryNode?.name);
}

/** Match equipment leaf in tree for breadcrumb fallback. */
export function findLeafForEquipment(root, equipment) {
  if (!equipment || !root) return null;
  const equipNo = String(equipment.equip_no || '').trim();
  const tagName = String(equipment.tag_name || '').trim();
  const name = String(equipment.name || '').trim().toLowerCase();
  let found = null;

  const walk = (node) => {
    if (found) return;
    if (node.isLeaf || !(node.children?.length)) {
      const lookup = (node.lookupName || node.name || '').trim();
      const nodeName = (node.name || '').trim();
      if (equipNo && node.equipNo && node.equipNo === equipNo) {
        found = node;
        return;
      }
      if (tagName && node.equipNo === tagName) {
        found = node;
        return;
      }
      if (name && (name === lookup.toLowerCase() || name === nodeName.toLowerCase())) {
        found = node;
      }
      return;
    }
    for (const child of node.children || []) walk(child);
  };

  walk(root);
  return found;
}

export function hierarchyBreadcrumbLabels(root, equipment, navPathIds) {
  const equipmentName = String(equipment?.name || '').trim() || 'Equipment';
  let pathIds = Array.isArray(navPathIds) && navPathIds.length ? navPathIds : null;

  if (!pathIds && root) {
    const leaf = findLeafForEquipment(root, equipment);
    if (leaf) pathIds = pathIdsForNodeId(root, leaf.id);
  }

  if (pathIds?.length && root) {
    const labels = pathLabels(root, pathIds);
    if (labels.length) labels[labels.length - 1] = equipmentName;
    return { labels, pathIds };
  }

  const fallback = ['Power Plant'];
  if (equipment?.category) fallback.push(String(equipment.category).trim());
  if (equipment?.subcategory) fallback.push(String(equipment.subcategory).trim());
  fallback.push(equipmentName);
  return { labels: fallback, pathIds: null };
}
