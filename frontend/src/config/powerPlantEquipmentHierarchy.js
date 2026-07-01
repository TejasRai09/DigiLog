/** Static power plant equipment hierarchy (boiler / turbine / WTP). */

/** @param {string} name Display label in hierarchy */
/** @param {string|null} equipNo Optional equipment / tag number for DB lookup */
/** @param {string|null} lookupName Canonical name in pp_equipment when it differs from display */
const leaf = (name, equipNo = null, lookupName = null) => {
  const node = { name };
  if (equipNo) node.equipNo = equipNo;
  if (lookupName) node.lookupName = lookupName;
  return node;
};

const group = (name, children, equipNo = null) => {
  const node = { name, children };
  if (equipNo) node.equipNo = equipNo;
  return node;
};

/** Leaf matched in DB by canonical name (no equipment number tag). */
const named = (displayName, dbName = null) => leaf(displayName, null, dbName ?? displayName);

export const POWER_PLANT_EQUIPMENT_ROOT = group('Power Plant', [
  group('150TPH BLR', [
    group('Auxiliary Equipment', [
      leaf('ID Fan -01', 'ZIL/GSM/PP/10', 'ID Fan -1'),
      leaf('ID Fan -02', 'ZIL/GSM/PP/11', 'ID Fan-2'),
      leaf('FD Fan -01', 'ZIL/GSM/PP/12', 'FD Fan-1'),
      leaf('FD Fan -02', 'ZIL/GSM/PP/13', 'FD Fan-2'),
      leaf('SA Fan -01', 'ZIL/GSM/PP/14', 'SA Fan -1'),
      named('SA Fan -02', 'SA Fan -2'),
      leaf('DA Fan -01'),
      leaf('DA Fan -02'),
      named('Air Pre Heater', 'Air Preheater'),
      leaf('Deaerator'),
      leaf('BFP -01', 'ZIL/GSM/PP/06', 'BFP-1'),
      leaf('BFP -02', 'ZIL/GSM/PP/07', 'BFP-2'),
      leaf('BFP -03', 'ZIL/GSM/PP/08', 'BFP-3'),
      leaf('BFP -04', 'ZIL/GSM/PP/09', 'BFP-4'),
      leaf('ESP'),
      leaf('HP-01', 'ZIL/GSM/PP/04', 'HP Heater -1'),
      leaf('HP-02', 'ZIL/GSM/PP/05', 'HP Heater -2'),
      leaf('LP-01'),
      leaf('LP-02'),
    ]),
    group('Pressure Parts', [
      leaf('Steam Drum', 'ZIL/GSM/PP/03', '150TPH Boiler'),
      leaf('Water Wall Tubes'),
      leaf('Riser Tubes'),
      leaf('Superheater Tubes (LTSH)'),
      leaf('Superheater Tubes (RSH)'),
      leaf('Superheater Tubes (FSH)'),
      leaf('Economizer'),
      leaf('Headers'),
      leaf('Steam Piping'),
      leaf('Attemperator-01'),
      leaf('Attemperator-02'),
      leaf('Steam Drum Safety Valves-1'),
      leaf('Steam Drum Safety Valves-2'),
      leaf('Main Steam Line Safety Valves'),
      leaf('EMRV'),
    ]),
    group('Fuel Handling System (Phase-1)', [
      leaf('Belt Conveyor -01', 'ZIL/GSM/PP/15', 'BC-1'),
      leaf('Belt Conveyor -02', 'ZIL/GSM/PP/16', 'BC-2'),
      leaf('Belt Conveyor -03', 'ZIL/GSM/PP/17', 'BC-3'),
      leaf('Belt Conveyor -04', 'ZIL/GSM/PP/18', 'BC-4'),
      leaf('Belt Conveyor -05', 'ZIL/GSM/PP/19', 'BC-5'),
      leaf('Belt Conveyor -06', 'ZIL/GSM/PP/20', 'BC-6'),
      leaf('Belt Conveyor -07', 'ZIL/GSM/PP/21', 'BC-7'),
      leaf('Belt Conveyor -08', 'ZIL/GSM/PP/22', 'BC-8'),
      leaf('Slat Chain Carrier', 'ZIL/GSM/PP/24', 'Slat Chain'),
      leaf('Bagasse Elevator', 'ZIL/GSM/PP/23', 'Bagasse Elevator'),
    ]),
    group('Fuel Handling System (Phase-2)', [
      leaf('New Belt Conveyor -01'),
      leaf('New Belt Conveyor -02'),
      leaf('New Belt Conveyor -03'),
      leaf('New Belt Conveyor -04'),
      leaf('New Belt Conveyor -05'),
      leaf('New Belt Conveyor -06'),
      leaf('New Belt Conveyor -07'),
    ]),
    group('Fuel Feeding System', [
      leaf('Drum Feeder-01'),
      leaf('Drum Feeder-02'),
      leaf('Drum Feeder-03'),
      leaf('Drum Feeder-04'),
      leaf('Drum Feeder-05'),
      leaf('Drum Feeder-06'),
      leaf('Screw Feeder-01'),
      leaf('Screw Feeder-02'),
      leaf('Screw Feeder-03'),
      leaf('Screw Feeder-04'),
      leaf('Screw Feeder-05'),
      leaf('Screw Feeder-06'),
    ]),
    group('Ash Handling System', [
      leaf('Service Air Compressor', null, 'Inst.Air Comp.-1'),
      leaf('Valves & Pipes'),
      leaf('Ash Silo'),
      leaf('Submerged Belt'),
      leaf('Bag Filters'),
      leaf('ESP'),
      leaf('Dense Phase System APH Master'),
      leaf('Dense Phase System APH Slave'),
      leaf('Dense Phase System -1'),
      leaf('Dense Phase System -2'),
      leaf('Dense Phase System -3'),
      leaf('Dense Phase System -4'),
      leaf('APH & ESP Hopper'),
    ]),
  ]),
  group('70TPH BLR', [
    group('Auxiliary Equipment', [
      leaf('ID Fan -01'),
      leaf('ID Fan -02'),
      leaf('FD Fan'),
      leaf('SA Fan -01'),
      leaf('Bagasse Blower Fan -01'),
      leaf('Bagasse Blower Fan -02'),
      leaf('Bagasse Blower Fan -03'),
      named('Air Pre Heater', 'Air Preheater'),
      leaf('Deaerator'),
      leaf('Feed Tank'),
      named('BFP -01', 'BFP-1'),
      named('BFP -02', 'BFP-2'),
      named('BFP -03', 'BFP-3'),
      leaf('HP'),
      leaf('LP'),
      leaf('Transfer Pump'),
      leaf('De-super Heating Pump -1'),
      leaf('De-super Heating Pump -2'),
      named('Exhaust Condensate Drain Pump-1', 'CEP No.-1'),
      named('Exhaust Condensate Drain Pump-2', 'CEP No.-2'),
    ]),
    group('Pressure Parts', [
      leaf('Steam Drum'),
      leaf('Side Wall Tubes'),
      leaf('Riser Tubes'),
      leaf('Roof Tubes'),
      leaf('Bank Zone Tubes'),
      leaf('Superheater Tubes (PSH)'),
      leaf('Superheater Tubes (FSH)'),
      leaf('Economizer'),
      leaf('Steam Piping'),
      leaf('MSV'),
      leaf('Steam Drum Safety Valves-1'),
      leaf('Steam Drum Safety Valves-2'),
      leaf('Main Steam Line Safety Valves'),
    ]),
    group('Fuel Handling System', [
      leaf('Bagasse Elevator'),
      leaf('MBC'),
      leaf('RBC'),
    ]),
    group('Fuel Feeding System', [
      leaf('Bagasse Feeder-01'),
      leaf('Bagasse Feeder-02'),
      leaf('Bagasse Feeder-03'),
      leaf('Bagasse Feeder-04'),
      leaf('Bagasse Feeder-05'),
      leaf('Bagasse Feeder-06'),
    ]),
    group('Ash Handling System', [
      leaf('Ash Clarifier'),
      leaf('Ash Drag Conveyor'),
      leaf('Valves & Pipes'),
      leaf('Slurry Pump No.1'),
      leaf('Slurry Pump No.2'),
      leaf('Slurry Pump No.3'),
      leaf('Injection Pump No.1'),
      leaf('Injection Pump No.2'),
      leaf('Injection Pump No.3'),
      leaf('Wet Scrubber No.1'),
      leaf('Wet Scrubber No.2'),
      leaf('Back Wash Pump'),
      leaf('Sludge Pits'),
    ]),
  ]),
  group('30.85MW STG', [
    group('Condenser', [
      leaf('Surface Condenser'),
      leaf('Pumps', 'ZIL/GSM/PP/25', 'MCW Pump-1'),
    ]),
    group('Turbine', [
      named('Gearbox', '30.85MW Steam Turbine'),
      named('Oil Cooler', 'MOP'),
      leaf('Alternator', 'ZIL/GSM/PP/02', '30.85MW Generator Set'),
      leaf('Ejector'),
      leaf('GVC'),
      named('Pumps', 'CEP No.-1'),
      leaf('Cooling Tower', 'ZIL/GSM/PP/30', 'CT Fan No.-1'),
      leaf('Bleed-1'),
      leaf('Bleed-2'),
      named('HP Heater-1', 'HP Heater -1'),
      named('HP Heater-2', 'HP Heater -2'),
      leaf('Extraction QCNRV-1'),
      leaf('Extraction QCNRV-2', 'ZIL/GSM/PP/01'),
      leaf('Dessicant Air Dryer'),
      named('Barring Gear', '30.85MW Steam Turbine'),
    ]),
  ]),
  group('WTP', [
    group('DM Plant', [
      leaf('Pumps'),
      leaf('SAC'),
      leaf('SBA'),
      leaf('MB'),
    ]),
    group('RO Plant', [
      leaf('MGF'),
      leaf('MCF'),
      leaf('RO System'),
      leaf('Pumps'),
      leaf('Degasser Tower'),
    ]),
    group('Reject Water Pit', [
      leaf('Pumps'),
    ]),
    group('Chemical Storage', [
      leaf('H2SO4 Tank'),
      leaf('HCL Tank'),
      leaf('Caustic Soda Lye Tank'),
    ]),
    group('Chemical Unloading', [
      leaf('Caustic Soda Lye'),
    ]),
    group('Laboratory', [
      leaf('Equipments'),
    ]),
    group('Water Storage', [
      leaf('Tanks'),
    ]),
    group('CPU', [
      leaf('Air Blower-1'),
      leaf('Air Blower-2'),
      leaf('Air Blower-3'),
      leaf('Sludge Pump-1'),
      leaf('Sludge Pump-2'),
      leaf('Filter Feed Pump-1'),
      leaf('Filter Feed Pump-2'),
      leaf('UF Feed Pump-01'),
      leaf('UF Feed Pump-02'),
      leaf('UF Back Wash Pump-01'),
      leaf('UF Back Wash Pump-02'),
      leaf('RO Feed Pump-01'),
      leaf('RO Feed Pump-02'),
      leaf('CPU Feed Pump-01'),
      leaf('CPU Feed Pump-02'),
      leaf('Caustic Dosing System'),
      leaf('Poly Dosing System'),
      leaf('HCL Dosing System'),
      leaf('Hypo Dosing System'),
      leaf('Anti Scalent Dosing System'),
      leaf('SMBS Dosing System'),
      leaf('Ultra Filtration System'),
      leaf('CT Fan'),
      leaf('Multi Grade Filter'),
      leaf('Iron Removal Filter'),
      leaf('Activated Carbon Filter'),
      leaf('CPU RO System'),
      leaf('Air Compressor'),
    ]),
  ]),
]);

/** Built-in root categories from static hierarchy — no card edit/delete. */
export const PROTECTED_ROOT_CATEGORY_NAMES = POWER_PLANT_EQUIPMENT_ROOT.children.map((c) => c.name);

/** Assign stable ids for React keys and navigation paths. */
export function annotateHierarchy(node, path = '0') {
  const id = path;
  const children = node.children?.map((child, i) => annotateHierarchy(child, `${path}.${i}`)) ?? [];
  const isLeaf = children.length === 0;
  return { ...node, id, children, isLeaf };
}

export const POWER_PLANT_EQUIPMENT_TREE = annotateHierarchy(POWER_PLANT_EQUIPMENT_ROOT);

/** Find a node anywhere in the tree by its annotated id. */
export function findNodeById(root, nodeId) {
  if (!root || nodeId == null) return null;
  if (root.id === nodeId) return root;
  for (const child of root.children ?? []) {
    const found = findNodeById(child, nodeId);
    if (found) return found;
  }
  return null;
}

/** Breadcrumb path: array of node ids from root to current. */
export function findNodeByPath(root, pathIds) {
  let node = root;
  for (let i = 1; i < pathIds.length; i += 1) {
    const next = node.children?.find((c) => c.id === pathIds[i]);
    if (!next) return node;
    node = next;
  }
  return node;
}

/** Full node id → breadcrumb path ids, e.g. `0.1.2` → `['0','0.1','0.1.2']`. */
export function pathIdsForNodeId(nodeId) {
  const parts = String(nodeId).split('.');
  return parts.map((_, i) => parts.slice(0, i + 1).join('.'));
}

export function pathLabels(root, pathIds) {
  const labels = [];
  let node = root;
  labels.push(node.name);
  for (let i = 1; i < pathIds.length; i += 1) {
    const next = node.children?.find((c) => c.id === pathIds[i]);
    if (!next) break;
    labels.push(next.name);
    node = next;
  }
  return labels;
}

/** Match a hierarchy leaf to loaded equipment (equip_no, lookupName, or name). */
export function findLeafForEquipment(root, equipment) {
  if (!equipment) return null;
  const equipNo = String(equipment.equip_no || '').trim();
  const tagName = String(equipment.tag_name || '').trim();
  const name = String(equipment.name || '').trim().toLowerCase();
  let found = null;

  const walk = (node) => {
    if (found) return;
    const children = node.children ?? [];
    if (!children.length) {
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
    for (const child of children) walk(child);
  };

  walk(root);
  return found;
}

/** Resolve breadcrumb path ids from navigation state or equipment tree match. */
export function hierarchyPathIdsForEquipment(root, equipment, navPathIds) {
  if (Array.isArray(navPathIds) && navPathIds.length) return navPathIds;
  const leaf = findLeafForEquipment(root, equipment);
  if (leaf) return pathIdsForNodeId(leaf.id);
  return null;
}

/** Labels for equipment detail breadcrumb: hierarchy path ending with equipment name. */
export function hierarchyBreadcrumbLabels(root, equipment, navPathIds) {
  const equipmentName = String(equipment?.name || '').trim() || 'Equipment';
  const pathIds = hierarchyPathIdsForEquipment(root, equipment, navPathIds);

  if (pathIds?.length) {
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
