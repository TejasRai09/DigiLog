const path = require('path');
const { pathToFileURL } = require('url');
const { pathIdsForNodeId, pathLabels, getHierarchyTree } = require('./ppnHierarchyLib');

const PROTECTED_ROOT_CATEGORY_NAMES = ['150TPH BLR', '70TPH BLR', '30.85MW STG', 'WTP'];

let seededPathKeysPromise = null;

function normalizeHierarchyPathKey(labels) {
  return labels
    .map((label) => String(label || '').trim().toLowerCase())
    .filter(Boolean)
    .join('\u001f');
}

function isProtectedRootCategoryName(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return false;
  return PROTECTED_ROOT_CATEGORY_NAMES.some(
    (protectedName) => protectedName.toLowerCase() === trimmed.toLowerCase(),
  );
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

async function loadSeededPathKeys() {
  const modPath = pathToFileURL(
    path.join(__dirname, '../../frontend/src/config/powerPlantEquipmentHierarchy.js'),
  ).href;
  const mod = await import(modPath);
  return buildSeededHierarchyPathKeys(mod.POWER_PLANT_EQUIPMENT_ROOT);
}

async function getSeededPathKeys() {
  if (!seededPathKeysPromise) {
    seededPathKeysPromise = loadSeededPathKeys();
  }
  return seededPathKeysPromise;
}

async function isProtectedSeededNodeId(nodeId, tree = null) {
  const id = parseInt(nodeId, 10);
  if (!id) return false;

  const hierarchy = tree || await getHierarchyTree();
  if (!hierarchy) return false;

  const labels = pathLabels(hierarchy, pathIdsForNodeId(hierarchy, String(id)));
  if (labels.length < 2) return false;
  if (!isProtectedRootCategoryName(labels[1])) return false;

  const pathKey = normalizeHierarchyPathKey(labels.slice(1));
  const seededKeys = await getSeededPathKeys();
  return seededKeys.has(pathKey);
}

module.exports = {
  isProtectedSeededNodeId,
  isProtectedRootCategoryName,
};
