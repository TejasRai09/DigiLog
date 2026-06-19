/**
 * Walk powerPlantEquipmentHierarchy.js and emit lookup JSON for classification.
 * Run from repo root: node DigiLog/backend/scripts/generate-power-classification-lookup.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { POWER_PLANT_EQUIPMENT_ROOT } from '../../frontend/src/config/powerPlantEquipmentHierarchy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', '..', '..', 'power_equipment_lookup.json');

function addKey(map, key, category, subcategory) {
  const k = String(key || '').trim();
  if (!k) return;
  const entry = { category, subcategory };
  if (!map[k]) map[k] = entry;
}

function walk(node, category, subcategory, map) {
  if (node.children?.length) {
    if (!category) {
      for (const child of node.children) walk(child, child.name, null, map);
      return;
    }
    if (!subcategory) {
      for (const child of node.children) walk(child, category, child.name, map);
      return;
    }
    for (const child of node.children) walk(child, category, subcategory, map);
    return;
  }

  addKey(map, node.equipNo, category, subcategory);
  addKey(map, node.lookupName, category, subcategory);
  addKey(map, node.name, category, subcategory);
}

const lookup = {};
walk(POWER_PLANT_EQUIPMENT_ROOT, null, null, lookup);

fs.writeFileSync(OUT, JSON.stringify(lookup, null, 2), 'utf8');
console.log(`Wrote ${Object.keys(lookup).length} keys to ${OUT}`);
