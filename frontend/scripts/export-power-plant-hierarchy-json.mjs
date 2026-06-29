/**
 * Export POWER_PLANT_EQUIPMENT_TREE as JSON for Excel documentation.
 * Run: node scripts/export-power-plant-hierarchy-json.mjs
 */
import {
  POWER_PLANT_EQUIPMENT_TREE,
  pathLabels,
  pathIdsForNodeId,
} from '../src/config/powerPlantEquipmentHierarchy.js';
import { ENGINEERING_DISCIPLINES } from '../src/config/engineeringDisciplines.js';

function collectEquipmentRows(root) {
  const rows = [];

  const walk = (node) => {
    const children = node.children ?? [];
    if (children.length === 0) {
      const pathIds = pathIdsForNodeId(node.id);
      const labels = pathLabels(root, pathIds);
      const lookupName = node.lookupName ?? node.name ?? '';
      rows.push({
        nodeId: node.id,
        hierarchyPath: labels.join(' > '),
        levels: labels,
        displayName: node.name ?? '',
        lookupName,
        dbName: lookupName || node.name || '',
        equipNo: node.equipNo ?? '',
        depth: labels.length,
        category: labels.length >= 2 ? labels[1] : '',
        subcategory: labels.length >= 3 ? labels[2] : '',
      });
      return;
    }
    for (const child of children) walk(child);
  };

  walk(root);
  return rows;
}

const equipment = collectEquipmentRows(POWER_PLANT_EQUIPMENT_TREE);

const output = {
  sourceFile: 'frontend/src/config/powerPlantEquipmentHierarchy.js',
  generatedAt: new Date().toISOString(),
  rootName: POWER_PLANT_EQUIPMENT_TREE.name,
  equipmentCount: equipment.length,
  equipment,
  engineeringDisciplines: ENGINEERING_DISCIPLINES.map((d) => ({
    id: d.id,
    name: d.name,
    tag: d.tag,
    description: d.description,
  })),
};

process.stdout.write(JSON.stringify(output, null, 2));
