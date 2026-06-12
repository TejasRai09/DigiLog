/** Static power plant equipment hierarchy (boiler / turbine / WTP). */

/** @param {string} name Display label in hierarchy */
/** @param {string|null} equipNo Equipment tag (ZIL/GSM/PP/… or instrument tag) for lookup */
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

const Z = {
  STG: 'ZIL/GSM/PP/01',
  GEN: 'ZIL/GSM/PP/02',
  BLR150: 'ZIL/GSM/PP/03',
  HPH1: 'ZIL/GSM/PP/04',
  HPH2: 'ZIL/GSM/PP/05',
  BFP1: 'ZIL/GSM/PP/06',
  BFP2: 'ZIL/GSM/PP/07',
  BFP3: 'ZIL/GSM/PP/08',
  BFP4: 'ZIL/GSM/PP/09',
  IDF1: 'ZIL/GSM/PP/10',
  IDF2: 'ZIL/GSM/PP/11',
  FDF1: 'ZIL/GSM/PP/12',
  FDF2: 'ZIL/GSM/PP/13',
  SAF: 'ZIL/GSM/PP/14',
  BC1: 'ZIL/GSM/PP/15',
  BC2: 'ZIL/GSM/PP/16',
  BC3: 'ZIL/GSM/PP/17',
  BC4: 'ZIL/GSM/PP/18',
  BC5: 'ZIL/GSM/PP/19',
  BC6: 'ZIL/GSM/PP/20',
  BC7: 'ZIL/GSM/PP/21',
  BC8: 'ZIL/GSM/PP/22',
  BAGELEV: 'ZIL/GSM/PP/23',
  SLATCHAIN: 'ZIL/GSM/PP/24',
  MCW1: 'ZIL/GSM/PP/25',
  MCW2: 'ZIL/GSM/PP/26',
  MCW3: 'ZIL/GSM/PP/27',
  ACW1: 'ZIL/GSM/PP/28',
  ACW2: 'ZIL/GSM/PP/29',
  ACW3: 'ZIL/GSM/PP/30',
  CT_FAN: 'ZIL/GSM/PP/30',
  OIL_PUMP: 'ZIL/GSM/PP/15',
};

/** 150TPH instrument tag — equip_no and optional distinct DB name */
const inst = (tag, dbName = null) => leaf(tag, tag, dbName ?? tag);

export const POWER_PLANT_EQUIPMENT_ROOT = group('Power Plant', [
  group('150TPH BLR', [
    group('Auxiliary Equipment', [
      leaf('ID Fan -01', Z.IDF1, 'ID Fan -1'),
      leaf('ID Fan -02', Z.IDF2, 'ID Fan-2'),
      leaf('FD Fan -01', Z.FDF1, 'FD Fan-1'),
      leaf('FD Fan -02', Z.FDF2, 'FD Fan-2'),
      leaf('SA Fan -01', Z.SAF, 'SA Fan -1'),
      leaf('SA Fan -02', Z.SAF, 'SA Fan -2'),
      leaf('DA Fan -01', 'DAM-907', 'DAM-907 (DA FAN-A Suction Damper RPC))'),
      leaf('DA Fan -02', 'DAM-908', 'DAM-908 (DA FAN-B Suction Damper RPC))'),
      leaf('Air Preheater', 'APH-PC-M', 'APH-PC-M'),
      leaf('Deaerator', 'PDW-38', 'PDW-38 (Deaerator emergency make-up water line MOV)'),
      leaf('BFP -01', Z.BFP1, 'BFP-1'),
      leaf('BFP -02', Z.BFP2, 'BFP-2'),
      leaf('BFP -03', Z.BFP3, 'BFP-3'),
      leaf('BFP -04', Z.BFP4, 'BFP-4'),
      leaf('ESP', 'ESP1-PC', 'ESP1-PC'),
      leaf('HP-01', Z.HPH1, 'HP Heater -1'),
      leaf('HP-02', Z.HPH2, 'HP Heater -2'),
      leaf('LP-01'),
      leaf('LP-02'),
    ]),
    group('Pressure Parts', [
      leaf('Steam Drum', Z.BLR150, '150TPH Boiler'),
      leaf('Water Wall Tubes'),
      leaf('Riser Tubes'),
      leaf('Superheater Tubes (LTSH)', 'MS-16', 'MS-16 (LTSH inlet header drain MOV)'),
      leaf('Superheater Tubes (RSH)', 'MS-21', 'MS-21 (RSH outlet header vent MOV)'),
      leaf('Superheater Tubes (FSH)', 'MS-107', 'MS-107 (FSH outlet vent MOV)'),
      leaf('Economizer', 'PFW-133', 'PFW-133 (Economiser inlet header iso MOV)'),
      leaf('Headers', 'MS-14', 'MS-14 (Roof tube inlet drain MOV)'),
      leaf('Steam Piping', 'MS-43', 'MS-43 (Main steam line iso MOV)'),
      leaf('Attemperator-01', 'TCV-501A', 'TCV-501A (Boiler Spray Water Temp. control valve for DSH-501)'),
      leaf('Attemperator-02', 'TCV-502A', 'TCV-502A (Boiler Spray Water Temp. control valve For DSH-502)'),
      leaf('Steam Drum Safety Valves-1'),
      leaf('Steam Drum Safety Valves-2'),
      leaf('Main Steam Line Safety Valves'),
      leaf('EMRV', 'MS-27', 'MS-27 (EMRV inlet iso MOV)'),
    ]),
    group('Fuel Handling System (Phase-1)', [
      leaf('Belt Conveyor -01', Z.BC1, 'BC-1'),
      leaf('Belt Conveyor -02', Z.BC2, 'BC-2'),
      leaf('Belt Conveyor -03', Z.BC3, 'BC-3'),
      leaf('Belt Conveyor -04', Z.BC4, 'BC-4'),
      leaf('Belt Conveyor -05', Z.BC5, 'BC-5'),
      leaf('Belt Conveyor -06', Z.BC6, 'BC-6'),
      leaf('Belt Conveyor -07', Z.BC7, 'BC-7'),
      leaf('Belt Conveyor -08', Z.BC8, 'BC-8'),
      leaf('Slat Chain Carrier', Z.SLATCHAIN, 'Slat Chain'),
      leaf('Bagasse Elevator', Z.BAGELEV, 'Bagasse Elevator'),
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
      leaf('Service Air Compressor', Z.CT_FAN, 'Inst.Air Comp.-1'),
      leaf('Valves & Pipes'),
      leaf('Ash Silo'),
      leaf('Submerged Belt'),
      leaf('Bag Filters'),
      leaf('ESP', 'ESP1-PC', 'ESP1-PC'),
      leaf('Dense Phase System APH Master', 'APH-PC-M', 'APH-PC-M'),
      leaf('Dense Phase System APH Slave', 'APH-PC-S', 'APH-PC-S'),
      leaf('Dense Phase System -1'),
      leaf('Dense Phase System -2'),
      leaf('Dense Phase System -3'),
      leaf('Dense Phase System -4'),
      leaf('APH & ESP Hopper', 'APH-PC-M', 'APH-PC-M'),
    ]),
    group('Instrumentation & Control Valves', [
      inst('FCV-501A', 'FCV-501A (Boiler feed water 100% control valve-1)'),
      inst('FCV-501B', 'FCV-501B (Boiler feed water 100% control valve-2)'),
      inst('FCV-500', 'FCV-500 (Boiler feed water 30% control valve)'),
      inst('PCV-503', 'PCV-503 (Soot Blower control valve)'),
      inst('PCV-505', 'PCV-505 (Boiler Start up vent control valve)'),
      inst('LCV-501', 'LCV-501 (Boiler CBD Tank Level control valve)'),
      inst('TCV-501A', 'TCV-501A (Boiler Spray Water Temp. control valve for DSH-501)'),
      inst('TCV-501B', 'TCV-501B (Boiler Spray Water Bypass Temp. control valve for DSH-501)'),
      inst('TCV-502A', 'TCV-502A (Boiler Spray Water Temp. control valve For DSH-502)'),
      inst('TCV-502B', 'TCV-502B (Boiler Spray Water Bypass Temp. control valve for DSH-502)'),
      inst('PCV-509', 'PCV-509 (Boiler 110/3 ATA Process PRDS control valve)'),
      inst('PCV-510', 'PCV-510 (Boiler 110/3 ATA Dearator Steam Pr. control valve)'),
      inst('PCV-511A', 'PCV-511A (Boiler 110/8 ATA Auxiliary Steam Pr. control valve)'),
      inst('PCV-511B', 'PCV-511B (Boiler 110/8 ATA Auxiliary Steam Pr. Bypass control valve)'),
      inst('PRV-501', 'PRV-501 (135/67 KG/CM2 Water Pressure Reducing Valve)'),
      inst('PCV-502', 'PCV-502 (110/45 ATA Process Steam Pr. Control Valve)'),
      inst('TCV-509A'),
      inst('TCV-510A', 'TCV-510B'),
      inst('TCV-511A', 'TCV-511A/SPRAY WATER TCV FOR 110/8 ATA AUX. STEAM PRDS'),
      inst('TCV-511B', 'TCV-511B/SPRAY WATER TCV FOR 110/8 ATA AUX. STEAM PRDS'),
      inst('TCV-604A', 'TCV-604A (Spray Water Control Valve For 110/45 ATA Steam PRDS)'),
      inst('BV-01', 'BV-01 (Spray water on/off valve to DSH-502)'),
      inst('BV-02', 'BV-02 (Spray water on/off valve to DSH-501)'),
      inst('BV-03', 'BV-03 (Spray water on/off valve FOR 110/3 ATA process steam PRDS)'),
      inst('BV-04', 'BV-04 (Spray water on/off valve FOR 110/3 ATA Dearator steam PRDS)'),
      inst('BV-05', 'BV-05 (Spray water on/off valve FOR 110/8 Auxiliary steam PRDS)'),
      inst('PFW-09', 'PFW-09 (Dearator Overflow On/Off Valve)'),
      inst('BV-07'),
      inst('DAM-901', 'DAM-901 (ID FAN-A Suction Damper RPC))'),
      inst('DAM-902', 'DAM-902 (ID FAN-B Suction Damper RPC))'),
      inst('DAM-903', 'DAM-903 (SA FAN-A Suction Damper RPC))'),
      inst('DAM-904', 'DAM-904 (SA FAN-B Suction Damper RPC))'),
      inst('DAM-905', 'DAM-905 (FD FAN-A Suction Damper RPC))'),
      inst('DAM-906', 'DAM-906 (FD FAN-B Suction Damper RPC))'),
      inst('DAM-907', 'DAM-907 (DA FAN-A Suction Damper RPC))'),
      inst('DAM-908', 'DAM-908 (DA FAN-B Suction Damper RPC))'),
      inst('APH-PC-M'),
      inst('APH-PC-S'),
      inst('ESP1-PC'),
      inst('ESP2-PC'),
      inst('ESP3-PC'),
      inst('ESP4-PC'),
      inst('TCV-509A NEW', 'TCV-509A'),
      inst('TCV-511A NEW', 'TCV-511A'),
    ]),
  ], Z.BLR150),
  group('70TPH BLR', [
    group('Auxiliary Equipment', [
      leaf('ID Fan -01', Z.IDF1, 'ID Fan -1'),
      leaf('ID Fan -02', Z.IDF2, 'ID Fan-2'),
      leaf('FD Fan', Z.FDF1, 'FD Fan-1'),
      leaf('SA Fan -01', Z.SAF, 'SA Fan -1'),
      leaf('Bagasse Blower Fan -01'),
      leaf('Bagasse Blower Fan -02'),
      leaf('Bagasse Blower Fan -03'),
      leaf('Air Preheater'),
      leaf('Deaerator'),
      leaf('Feed Tank'),
      leaf('BFP -01', Z.BFP1, 'BFP-1'),
      leaf('BFP -02', Z.BFP2, 'BFP-2'),
      leaf('BFP -03', Z.BFP3, 'BFP-3'),
      leaf('HP', Z.HPH1, 'HP Heater -1'),
      leaf('LP', Z.HPH2, 'HP Heater -2'),
      leaf('Transfer Pump'),
      leaf('De-super Heating Pump -1'),
      leaf('De-super Heating Pump -2'),
      leaf('Exhaust Condensate Drain Pump-1', Z.BC1, 'CEP No.-1'),
      leaf('Exhaust Condensate Drain Pump-2', Z.BC1, 'CEP No.-2'),
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
      leaf('Bagasse Elevator', Z.BAGELEV, 'Bagasse Elevator'),
      leaf('MBC', Z.BC1, 'BC-1'),
      leaf('RBC', Z.SLATCHAIN, 'Slat Chain'),
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
      leaf('Pumps', Z.MCW1, 'MCW Pump-1'),
    ]),
    group('Turbine', [
      leaf('Gearbox', Z.STG, '30.85MW Steam Turbine'),
      leaf('Oil Cooler', Z.OIL_PUMP, 'MOP'),
      leaf('Alternator', Z.GEN, '30.85MW Generator Set'),
      leaf('Ejector', 'MOV-401', 'MOV-401 (Steam to hogger ejector MOV)'),
      leaf('GVC', 'MS-66', 'MS-66 (TG inlet iso MOV)'),
      leaf('Pumps', Z.OIL_PUMP, 'CEP No.-1'),
      leaf('Cooling Tower', Z.CT_FAN, 'CT Fan No.-1'),
      leaf('Bleed-1', 'MOV-100', 'MOV-100 (Bleed-1 MOV)'),
      leaf('Bleed-2', 'MOV-101', 'MOV-101 (Bleed-2 MOV)'),
      leaf('HP Heater-1', Z.HPH1, 'HP Heater -1'),
      leaf('HP Heater-2', Z.HPH2, 'HP Heater -2'),
      leaf('Extraction QCNRV-1'),
      leaf('Extraction QCNRV-2'),
      leaf('Dessicant Air Dryer', Z.CT_FAN, 'Inst.Air Comp.-1'),
      leaf('Barring Gear', Z.STG, '30.85MW Steam Turbine'),
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

/** Assign stable ids for React keys and navigation paths. */
export function annotateHierarchy(node, path = '0') {
  const id = path;
  const children = node.children?.map((child, i) => annotateHierarchy(child, `${path}.${i}`)) ?? [];
  const isLeaf = children.length === 0;
  return { ...node, id, children, isLeaf };
}

export const POWER_PLANT_EQUIPMENT_TREE = annotateHierarchy(POWER_PLANT_EQUIPMENT_ROOT);

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
