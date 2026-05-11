/**
 * Maps DB column keys → section heading + field label (matching data-entry forms).
 * Order follows each form layout (not INSERT column order unless same).
 */

const push = (arr, dbKey, heading, subheading) => {
  arr.push({ dbKey, heading, subheading });
};

/** Single CSV / compact header; View Data modal uses split heading rows. */
export function headerLabel({ heading, subheading }) {
  if (subheading) return `${heading} | ${subheading}`;
  return heading;
}

/**
 * VIEW DATA / CSV: show calendar dates as YYYY-MM-DD (not ISO midnight UTC strings).
 */
export function formatRecordCellForDisplay(dbKey, value) {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'string' ? value : String(value);
  /* MySQL DATE often arrives as ISO instant from APIs / older responses */
  if (dbKey === 'Date') {
    const isoMidnight = s.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?Z$/);
    if (isoMidnight) return isoMidnight[1];
    const isoDate = s.match(/^(\d{4}-\d{2}-\d{2})T/);
    if (isoDate) return isoDate[1];
    return s;
  }
  return s;
}

// ─── mill_logbook1 (EquipmentTemp) ────────────────────────────
const M1_EQUIP = [
  { key: 'CaneKeig', label: 'Cane Kicker' },
  { key: 'CardDrum1', label: 'Cardian Drum 1' },
  { key: 'CardDrum2', label: 'Cardian Drum 2' },
  { key: 'FeedDrum', label: 'Feeder Drum' },
  { key: 'CaneCar', label: 'Cane Carrier' },
  { key: 'ShredCar', label: 'Shred. Carrier' },
  { key: 'BeltConvy', label: 'Belt Convy' },
  { key: 'IRC1', label: 'IRC 1' },
  { key: 'IRC2', label: 'IRC 2' },
  { key: 'IRC3', label: 'IRC 3' },
  { key: 'IRC4', label: 'IRC 4' },
  { key: 'Mill0', label: 'Mill 0' },
  { key: 'Mill4', label: 'Mill 4' },
];
const M1_TEMPS = [
  ['MtrTemp', 'Motor Temp'],
  ['GearTempDE', 'Gear Temp (DE)'],
  ['GearTempNDE', 'Gear Temp (NDE)'],
  ['BearTempDE', 'Bearing Temp (DE)'],
  ['BearTempNDE', 'Bearing Temp (NDE)'],
];

function schemaMillLogbook1() {
  const a = [];
  push(a, 'Date', 'GSMA Mill Logbook', 'Report Date');
  push(a, 'Shift', 'GSMA Mill Logbook', 'Shift');
  push(a, 'Time', 'GSMA Mill Logbook', 'Time');
  for (const { key, label } of M1_EQUIP) {
    for (const [suf, sub] of M1_TEMPS) {
      push(a, `${key}_${suf}`, label, sub);
    }
  }
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

// ─── mill_logbook2 (ShreddarOTG) ───────────────────────────────
function schemaMillLogbook2() {
  const a = [];
  push(a, 'Date', 'GSMA Mill Logbook', 'Report Date');
  push(a, 'Shift', 'GSMA Mill Logbook', 'Shift');
  push(a, 'Time', 'GSMA Mill Logbook', 'Time');
  const sr = [
    ['shredR_MtrTemp', 'Motor Temp'],
    ['shredR_BearTempSite', 'Bearing Temp (Site)'],
    ['shredR_BearTempDCS', 'Bearing Temp (DCS)'],
    ['shredR_VibH', 'Vibrations-H'],
    ['shredR_VibV', 'Vibrations-V'],
    ['shredR_VibA', 'Vibrations-A'],
  ];
  const sl = [
    ['shredL_MtrTemp', 'Motor Temp'],
    ['shredL_BearTempSite', 'Bearing Temp (Site)'],
    ['shredL_BearTempDCS', 'Bearing Temp (DCS)'],
    ['shredL_VibH', 'Vibrations-H'],
    ['shredL_VibV', 'Vibrations-V'],
    ['shredL_VibA', 'Vibrations-A'],
  ];
  for (const [k, s] of sr) push(a, k, 'Shredder RHS', s);
  for (const [k, s] of sl) push(a, k, 'Shredder LHS', s);
  const rollers = [
    ['InpT', 'Input-T'],
    ['InpM', 'Input-M'],
    ['IntT', 'Intermediate-T'],
    ['IntM', 'Intermediate-M'],
    ['OutT', 'Output-T'],
    ['OutM', 'Output-M'],
  ];
  for (let n = 1; n <= 4; n++) {
    for (const [suf, sub] of rollers) {
      push(a, `M${n}_${suf}`, 'OTG Bearing Temperature', `Mill ${n} — ${sub}`);
    }
  }
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

// ─── mill_logbook3 (LubePressure) ──────────────────────────────
function schemaMillLogbook3() {
  const a = [];
  push(a, 'Date', 'GSMA Mill Logbook', 'Date');
  push(a, 'Shift', 'GSMA Mill Logbook', 'Shift');
  push(a, 'Time', 'GSMA Mill Logbook', 'Time');
  push(a, 'LubePressure_ACC', 'Lube Pump Pressure', 'ACC (Kg/Sq.Cm)');
  push(a, 'LubePressure_MCC', 'Lube Pump Pressure', 'MCC (Kg/Sq.Cm)');
  push(a, 'LubePressure_Shred', 'Lube Pump Pressure', 'Shredder (Kg/Sq.Cm)');
  push(a, 'LubePressure_M0', 'Lube Pump Pressure', 'Mill 0 (Kg/Sq.Cm)');
  const roller = [
    ['gsT', 'Gear Side (T)'],
    ['gsB', 'Gear Side (B)'],
    ['gsUF', 'Gear Side (U/F)'],
    ['psT', 'Pintal Side (T)'],
    ['psB', 'Pintal Side (B)'],
    ['psUF', 'Pintal Side (U/F)'],
  ];
  for (const m of ['M0', 'M1', 'M2', 'M3', 'M4']) {
    for (const [suf, sub] of roller) {
      push(a, `${m}_${suf}`, 'Mill Roller Temperature', `Mill ${m.slice(1)} — ${sub}`);
    }
  }
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

// ─── mill_stoppages ────────────────────────────────────────────
function schemaMillStoppages() {
  const a = [];
  push(a, 'Date', 'GSMA Milling — Stoppages', 'Report Date');
  push(a, 'start_time', 'GSMA Milling — Stoppages', 'From');
  push(a, 'end_time', 'GSMA Milling — Stoppages', 'To');
  push(a, 'section', 'GSMA Milling — Stoppages', 'Section');
  push(a, 'machinery', 'GSMA Milling — Stoppages', 'Machinery');
  push(a, 'remarks', 'GSMA Milling — Stoppages', 'Remark');
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

// ─── DS logbook ────────────────────────────────────────────────
const DS_POL_BRIX = [
  { key: 'PJ', label: 'Primary Juice (PJ)' },
  { key: 'MJ', label: 'Mixed Juice (MJ)' },
  { key: 'LMJ', label: 'Last Mill Juice (LMJ)' },
  { key: 'CJ', label: 'Clarified Juice (CJ)' },
  { key: 'FJ', label: 'Final Juice (FJ)' },
  { key: 'USul_Syrp', label: 'Unsulphited Syrup' },
  { key: 'Sul_Syrp', label: 'Sulphited Syrup' },
  { key: 'A_Mc', label: 'A Massecuite' },
  { key: 'B_Mc', label: 'B Massecuite' },
  { key: 'A1_Mc', label: 'A1 Massecuite' },
  { key: 'C_Mc', label: 'C Massecuite' },
  { key: 'AH_Mol', label: 'AH Molasses' },
  { key: 'AL_Mol', label: 'AL Molasses' },
  { key: 'BH_Mol', label: 'BH Molasses' },
  { key: 'CL_Mol', label: 'CL Molasses' },
  { key: 'FMol', label: 'Final Molasses' },
  { key: 'A1_Mol', label: 'A1 Molasses' },
];

function schemaDSLogbook() {
  const a = [];
  push(a, 'Date', 'Report Header', 'Date');
  push(a, 'Shift', 'Report Header', 'Shift');
  push(a, 'Sampling_time', 'Report Header', 'Sampling Time');
  push(a, 'op_mode', 'Report Header', 'Mode of Operation');
  for (const { key, label } of DS_POL_BRIX) {
    push(a, `${key}_Pol`, label, 'Pol');
    push(a, `${key}_Brix`, label, 'Brix');
  }
  push(a, 'Bag_Pol', 'Bagasse', 'Pol');
  push(a, 'Bag_Moisture', 'Bagasse', 'Moisture');
  push(a, 'FCake_Pol', 'Filter Cake', 'Filter Cake Pol');
  push(a, 'MillDrain_Pol', 'Drains', 'Mill Drain Pol');
  push(a, 'BoilHouseDrain_Pol', 'Drains', 'Boil House Drain Pol');
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

// ─── RS logbook ────────────────────────────────────────────────
function schemaRSLogbook() {
  const a = [];
  push(a, 'Date', 'Report Header', 'Date');
  push(a, 'Shift', 'Report Header', 'Shift');
  push(a, 'Sampling_time', 'Report Header', 'Sampling Time');
  push(a, 'op_mode', 'Report Header', 'Mode of Operation');
  push(a, 'CJ_Pol', 'Juices', 'CJ Pol');
  push(a, 'CJ_Brix', 'Juices', 'CJ Brix');
  push(a, 'FJ_Pol', 'Juices', 'FJ Pol');
  push(a, 'FJ_Brix', 'Juices', 'FJ Brix');
  push(a, 'UtrSyrp_Pol', 'Juices', 'Untr. Syrup Pol');
  push(a, 'UtrSyrp_Brix', 'Juices', 'Untr. Syrup Brix');
  push(a, 'RawMc_Pol', 'Massecuites', 'Raw Mc Pol');
  push(a, 'RawMc_Brix', 'Massecuites', 'Raw Mc Brix');
  push(a, 'R1Mc_Pol', 'Massecuites', 'R1 Mc Pol');
  push(a, 'R1Mc_Brix', 'Massecuites', 'R1 Mc Brix');
  push(a, 'R1Mc_IU', 'Massecuites', 'R1 Mc IU');
  push(a, 'R2Mc_Pol', 'Massecuites', 'R2 Mc Pol');
  push(a, 'R2Mc_Brix', 'Massecuites', 'R2 Mc Brix');
  push(a, 'R2Mc_IU', 'Massecuites', 'R2 Mc IU');
  push(a, 'BMc_Pol', 'Massecuites', 'B Mc Pol');
  push(a, 'BMc_Brix', 'Massecuites', 'B Mc Brix');
  push(a, 'CMc_Pol', 'Massecuites', 'C Mc Pol');
  push(a, 'CMc_Brix', 'Massecuites', 'C Mc Brix');
  push(a, 'AH_Mol_Pol', 'Molasses', 'AH Mol Pol');
  push(a, 'AH_Mol_Brix', 'Molasses', 'AH Mol Brix');
  push(a, 'AL_Mol_Pol', 'Molasses', 'AL Mol Pol');
  push(a, 'AL_Mol_Brix', 'Molasses', 'AL Mol Brix');
  push(a, 'R1_Mol_Pol', 'Molasses', 'R1 Mol Pol');
  push(a, 'R1_Mol_Brix', 'Molasses', 'R1 Mol Brix');
  push(a, 'R1Mol_IU', 'Molasses', 'R1 Mol IU');
  push(a, 'R2_Mol_Pol', 'Molasses', 'R2 Mol Pol');
  push(a, 'R2_Mol_Brix', 'Molasses', 'R2 Mol Brix');
  push(a, 'R2Mol_IU', 'Molasses', 'R2 Mol IU');
  push(a, 'BH_Mol_Pol', 'Molasses', 'BH Mol Pol');
  push(a, 'BH_Mol_Brix', 'Molasses', 'BH Mol Brix');
  push(a, 'CL_Mol_Pol', 'Molasses', 'CL Mol Pol');
  push(a, 'CL_Mol_Brix', 'Molasses', 'CL Mol Brix');
  push(a, 'FMol_Pol', 'Molasses', 'F Mol Pol');
  push(a, 'FMol_Brix', 'Molasses', 'F Mol Brix');
  push(a, 'RawMlt_Pol', 'Melt', 'Raw Melt Pol');
  push(a, 'RawMlt_Brix', 'Melt', 'Raw Melt Brix');
  push(a, 'RawMlt_IU', 'Melt', 'Raw Melt IU');
  push(a, 'ClearMlt_Pol', 'Melt', 'Clear Melt Pol');
  push(a, 'ClearMlt_Brix', 'Melt', 'Clear Melt Brix');
  push(a, 'ClearMlt_IU', 'Melt', 'Clear Melt IU');
  push(a, 'Pol_FineLiqourMelt', 'Melt', 'Fine Liquor Pol');
  push(a, 'Brix_FineLiqourMelt', 'Melt', 'Fine Liquor Brix');
  push(a, 'IU_FineLiqourMelt', 'Melt', 'Fine Liquor IU');
  push(a, 'IERInlet_IU', 'IER', 'IER Inlet IU');
  push(a, 'IERInlet_PH', 'IER', 'IER Inlet PH');
  push(a, 'IEROutlet_IU', 'IER', 'IER Outlet IU');
  push(a, 'IEROutlet_PH', 'IER', 'IER Outlet PH');
  push(a, 'FCake_Pol', 'Misc', 'Filter Cake Pol');
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

// ─── ops_logbook ───────────────────────────────────────────────
function schemaOpsLogbook() {
  const a = [];
  push(a, 'Date', 'Report Header', 'Date');
  push(a, 'Shift', 'Report Header', 'Shift');
  push(a, 'Sampling_time', 'Report Header', 'Sampling Time');
  push(a, 'yard_bal', 'General', 'Yard Balance');
  push(a, 'crush', 'General', 'Crush');
  push(a, 'imb_wtr', 'General', 'Imbibition Water');
  push(a, 'imb_temp', 'General', 'Imbibition Temp');
  push(a, 'mixj_ds', 'Mix Juice & Molasses', 'Mix Juice DS');
  push(a, 'mixj_rs', 'Mix Juice & Molasses', 'Mix Juice RS');
  push(a, 'mol_ds', 'Mix Juice & Molasses', 'Molasses DS');
  push(a, 'mol_rs', 'Mix Juice & Molasses', 'Molasses RS');
  push(a, 'fcake_ds', 'Mix Juice & Molasses', 'Filter Cake DS');
  push(a, 'fcake_rs', 'Mix Juice & Molasses', 'Filter Cake RS');
  const sugar = [
    ['dsl', 'DS Large'],
    ['dsm', 'DS Medium'],
    ['dss', 'DS Small'],
    ['rsl', 'RS Large'],
    ['rsm', 'RS Medium'],
    ['rss', 'RS Small'],
  ];
  for (const [suf, title] of sugar) {
    push(a, `qty_${suf}`, `Sugar \u2013 ${title}`, 'Qty');
    push(a, `mesh_${suf}`, `Sugar \u2013 ${title}`, 'Mesh');
    push(a, `bagtemp_${suf}`, `Sugar \u2013 ${title}`, 'Bag Temp');
  }
  const pharma = [
    ['p20', 'Pharma 20'],
    ['p30', 'Pharma 30'],
    ['p40', 'Pharma 40'],
  ];
  for (const [suf, title] of pharma) {
    push(a, `qty_${suf}`, `Sugar \u2013 ${title}`, 'Qty');
    push(a, `bagtemp_${suf}`, `Sugar \u2013 ${title}`, 'Bag Temp');
  }
  push(a, 'FBDInlet_TempDS', 'FBD – DS', 'Inlet Temp');
  push(a, 'FBDInlet_MoistDS', 'FBD – DS', 'Inlet Moist');
  push(a, 'FBDOutlet_TempDS', 'FBD – DS', 'Outlet Temp');
  push(a, 'FBDOutlet_MoistDS', 'FBD – DS', 'Outlet Moist');
  push(a, 'Hopper_TempDS', 'FBD – DS', 'Hopper Temp');
  push(a, 'Hopper_MoistDS', 'FBD – DS', 'Hopper Moist');
  push(a, 'FBDInlet_TempRS', 'FBD – RS', 'Inlet Temp');
  push(a, 'FBDInlet_MoistRS', 'FBD – RS', 'Inlet Moist');
  push(a, 'FBDOutlet_TempRS', 'FBD – RS', 'Outlet Temp');
  push(a, 'FBDOutlet_MoistRS', 'FBD – RS', 'Outlet Moist');
  push(a, 'Hopper_TempRS', 'FBD – RS', 'Hopper Temp');
  push(a, 'Hopper_MoistRS', 'FBD – RS', 'Hopper Moist');
  push(a, 'RSDInlet_Temp', 'RSD', 'Inlet Temp');
  push(a, 'RSDInlet_Moist', 'RSD', 'Inlet Moist');
  push(a, 'RSDOutlet_Temp', 'RSD', 'Outlet Temp');
  push(a, 'RSDOutlet_Moist', 'RSD', 'Outlet Moist');
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

// ─── sa_logbook ────────────────────────────────────────────────
const SA_PRODUCTS = ['DSL', 'DSM', 'DSS', 'RSL', 'RSM', 'RSS', 'Pharma20', 'Pharma30', 'Pharma40'];

function schemaSALogbook() {
  const a = [];
  push(a, 'Date', 'Report Header', 'Date');
  push(a, 'Shift', 'Report Header', 'Shift');
  push(a, 'Sampling_time', 'Report Header', 'Sampling Time');
  for (const p of SA_PRODUCTS) push(a, `retn_${p}`, 'Retention (%)', p);
  for (const p of SA_PRODUCTS) push(a, `moist_${p}`, 'Moisture (%)', p);
  for (const p of SA_PRODUCTS) push(a, `col_${p}`, 'Colour (IU)', p);
  push(a, 'col_ClrJDS', 'Colour (IU)', 'Clr Juice DS');
  push(a, 'col_RawMeltRS', 'Colour (IU)', 'Raw Melt RS');
  push(a, 'col_ClrMeltRS', 'Colour (IU)', 'Clear Melt RS');
  push(a, 'col_FineLqrRS', 'Colour (IU)', 'Fine Liquor RS');
  push(a, 'timestamp_col', 'System', 'Recorded at');
  return a;
}

// ─── syrp_logbook ──────────────────────────────────────────────
function schemaSyrpLogbook() {
  const a = [];
  push(a, 'Date', 'Report Header', 'Date');
  push(a, 'Shift', 'Report Header', 'Shift');
  push(a, 'syrp_prodDS', 'Syrup Production', 'Syrup Prod DS');
  push(a, 'syrp_prodRS', 'Syrup Production', 'Syrup Prod RS');
  push(a, 'div_mode', 'Diversion', 'Diversion Mode');
  push(a, 'syrp_div', 'Diversion', 'Syrup Diversion');
  push(a, 'MoLtoDist_DS', 'Diversion', 'Molasses to Dist DS');
  push(a, 'MoLtoDist_RS', 'Diversion', 'Molasses to Dist RS');
  push(a, 'syrp_trs', 'TRS', 'Syrup TRS');
  push(a, 'bh_trs', 'TRS', 'Boil House TRS');
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

// ─── stoppage_logbook ──────────────────────────────────────────
function schemaStoppageLogbook() {
  const a = [];
  push(a, 'Date', 'GSMA Lab — Stoppages', 'Report Date');
  push(a, 'start_time', 'GSMA Lab — Stoppages', 'From');
  push(a, 'end_time', 'GSMA Lab — Stoppages', 'To');
  push(a, 'department', 'GSMA Lab — Stoppages', 'Reason');
  push(a, 'remarks', 'GSMA Lab — Stoppages', 'Remark');
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

// ─── ph_power ──────────────────────────────────────────────────
function schemaPhPower() {
  const a = [];
  push(a, 'Date', 'GSMA Power Logbook', 'Report Date');
  push(a, 'Time', 'GSMA Power Logbook', 'Time');
  push(a, 'Crush', 'Crushing', 'Cane Crushed (Qtls)');
  push(a, 'Baggase', 'Crushing', 'Bagasse Produced (Qtls)');
  push(a, 'Hours30', 'Operating Hours', '30.85MW STG');
  push(a, 'Hours3Old', 'Operating Hours', '3MW STG (O)');
  push(a, 'Hours3New', 'Operating Hours', '3MW STG (N)');
  push(a, 'Hours4', 'Operating Hours', '4MW STG');
  push(a, 'PowerGen30', 'Power Generation', '30.85MW STG');
  push(a, 'PowerGen3Old', 'Power Generation', '3MW STG (O)');
  push(a, 'PowerGen3New', 'Power Generation', '3MW STG (N)');
  push(a, 'PowerGen4MW', 'Power Generation', '4MW STG');
  push(a, 'GenDG30', 'Power Gen by DG Set', '625KVA DG Set 1');
  push(a, 'GenDG3Old', 'Power Gen by DG Set', '625KVA DG Set 2');
  push(a, 'GenDG3New', 'Power Gen by DG Set', '625KVA DG Set 3');
  push(a, 'GenDG4', 'Power Gen by DG Set', '380KVA DG Set 4');
  push(a, 'Imp_Grid', 'Power Import', 'Grid');
  push(a, 'Imp_3MWOld', 'Power Import', '3MW Old');
  push(a, 'Imp_3MWNew', 'Power Import', '3MW New');
  push(a, 'Imp_4MW', 'Power Import', '4MW');
  push(a, 'ExportGrid30', 'Power Export to Grid', '30.85MW STG');
  push(a, 'ExportGrid3Old', 'Power Export to Grid', '3MW STG (O)');
  push(a, 'ExportGrid3New', 'Power Export to Grid', '3MW STG (N)');
  push(a, 'ExportGrid4', 'Power Export to Grid', '4MW STG');
  push(a, 'ExportSug30', 'Power to Sugar', '30.85MW STG');
  push(a, 'ExportSug3Old', 'Power to Sugar', '3MW STG (O)');
  push(a, 'ExportSug3New', 'Power to Sugar', '3MW STG (N)');
  push(a, 'ExportSug4', 'Power to Sugar', '4MW STG');
  push(a, 'PowerConMillHouse', 'Power to Sugar (Breakup)', 'Power Consumption Mill');
  push(a, 'PowerConDSHouse', 'Power to Sugar (Breakup)', 'Power Consumption DS');
  push(a, 'PowerConRaw_Ref', 'Power to Sugar (Breakup)', 'Power Consp. Raw & Ref.');
  push(a, 'PowerCon70TPH', 'Power to Sugar (Breakup)', 'Power Consumption 70TPH');
  push(a, 'PowerConETP', 'Power to Sugar (Breakup)', 'Power Consp. ETP');
  push(a, 'PowerConColony', 'Power to Sugar (Breakup)', 'Power Consp. Colony');
  push(a, 'PowerConOthers', 'Power to Sugar (Breakup)', 'Power Consp. Others');
  push(a, 'ExportCogen30', 'Power to Cogen (Aux Consp)', '30.85MW STG');
  push(a, 'ExportCogen3Old', 'Power to Cogen (Aux Consp)', '3MW STG (O)');
  push(a, 'ExportCogen3New', 'Power to Cogen (Aux Consp)', '3MW STG (N)');
  push(a, 'ExportCogen4', 'Power to Cogen (Aux Consp)', '4MW STG');
  push(a, 'ExportDist30', 'Power to Distillery from 30MW', '30.85MW STG');
  push(a, 'remark', 'Remark', 'Remark');
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

// ─── distillery_ops ────────────────────────────────────────────
function schemaDistilleryOps() {
  const a = [];
  push(a, 'Date', 'GSMA Distillery Operations', 'Operation Date');
  push(a, 'operation_mode', 'GSMA Distillery Operations', 'Operation Mode');
  push(a, 'syrup_molasses_qtls', 'Throughput & quality', 'Syrup/Molasses Used (Qtls)');
  push(a, 'wash_distilled', 'Throughput & quality', 'Wash Distilled');
  push(a, 'trs', 'Throughput & quality', 'TRS');
  push(a, 'ufs', 'Throughput & quality', 'UFS');
  push(a, 'alcohol_pct', 'Throughput & quality', 'Alcohol %');
  push(a, 'actual_ethanol_bl', 'Production', 'Actual Ethanol Production (BL)');
  push(a, 'al_bl_ratio_pct', 'Production', 'AL/BL Ratio (%)');
  push(a, 'total_bh_molasses_qtls', 'Storage', 'Total BH Molasses in Storage — Qtls');
  push(a, 'total_ch_molasses_qtls', 'Storage', 'Total CH Molasses in Storage — Qtls');
  push(a, 'ethanol_storage_bl', 'Storage', 'Ethanol in Storage (BL)');
  push(a, 'fs', 'Calculated', 'FS');
  push(a, 'fs_quantity', 'Calculated', 'FS Quantity');
  push(a, 'theoretical_yield', 'Calculated', 'Theoretical yield');
  push(a, 'alcohol_prod_fermentation', 'Calculated', 'Alcohol prod in fermentation');
  push(a, 'fe', 'Calculated', 'FE');
  push(a, 'actual_prod_al', 'Calculated', 'Actual prod. AL');
  push(a, 'de', 'Calculated', 'DE');
  push(a, 'oe', 'Calculated', 'OE');
  push(a, 'rec_bl', 'Calculated', 'REC BL');
  push(a, 'rec_al', 'Calculated', 'REC AL');
  push(a, 'trs_qty', 'Calculated', 'TRS QTY');
  push(a, 'ufs_qty', 'Calculated', 'UFS QTY');
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

// ─── ph_steam (order matches PhSteam.jsx / PHReport_Steam.html) ─────────
function schemaPhSteam() {
  const a = [];
  push(a, 'Date', 'GSMA Power Logbook', 'Report Date');
  push(a, 'Time', 'GSMA Power Logbook', 'Time');
  push(a, 'SteamGen150', '150 TPH — Stage 1', 'Steam Generation');
  push(a, 'SteamCon30MW', '150 TPH — Stage 2', 'Steam Consumption');
  push(a, 'SteamtoSugar110_3ATAPRDS', '150 TPH — Stage 2', 'Steam to Sugar through 110/3 ATA PRDS');
  push(a, 'Stmto3Old110_45ATAPRDS', '150 TPH — Stage 2', 'Steam to 3 MW TG Old through 110/45 ATA PRDS');
  push(a, 'Stmto3New110_45ATAPRDS', '150 TPH — Stage 2', 'Steam to 3 MW TG New through 110/45 ATA PRDS');
  push(a, 'StmMillTurbine110_45ATAPRDS', '150 TPH — Stage 2', 'Steam to Mill Turbine through 110/45 ATA PRDS');
  push(a, 'StmtoDistil110_45ATAPRDS_o', '150 TPH — Stage 2', 'Steam to Distillery Process through 110/45 ATA PRDS');
  push(a, 'Stm4MWTG110_45ATAPRDS', '150 TPH — Stage 2', 'Steam to 4MW TG through 110/45 ATA PRDS');
  push(a, 'ExtractionStm30MW', '150 TPH — Stage 3', 'Extraction Steam from 30MW TG');
  push(a, 'Bleed2HPH1Stm', '150 TPH — Stage 3', 'Bleed 2 to HP H1 Steam');
  push(a, 'Bleed1HPH2Stm', '150 TPH — Stage 3', 'Bleed 1 to HP H2 Steam');
  push(a, 'TotalStmtoSug150', '150 TPH — Stage 4', 'Total Steam to Sugar Process');
  push(a, 'Stmtodeareator150', '150 TPH — Stage 4', 'Steam to Deareator (150 TPH)');
  push(a, 'Firewood150', '150 TPH — Fuel Consumption', 'Firewood (MT)');
  push(a, 'Baggase150', '150 TPH — Fuel Consumption', 'Baggase (MT)');
  push(a, 'SteamGen70', '70 TPH — Stage 1', 'Steam Generation');
  push(a, 'StmCons3Old35', '70 TPH — Stage 2', 'Steam Consp. 3 MW TG Old');
  push(a, 'StmCons3New35', '70 TPH — Stage 2', 'Steam Consp. 3 MW TG New');
  push(a, 'StmDist70', '70 TPH — Stage 2', 'Steam to Distillery Process from 70 TPH');
  push(a, 'Stmto4_70TPH', '70 TPH — Stage 2', 'Steam to 4 MW Turbine from 70 TPH');
  push(a, 'TotalStmtoSug70', '70 TPH — Stage 3', 'Total Steam to Sugar');
  push(a, 'Firewood70', '70 TPH — Fuel Consumption', 'Firewood (MT)');
  push(a, 'Baggase70', '70 TPH — Fuel Consumption', 'Baggase (MT)');
  push(a, 'SteamGen35', '35 TPH — Stage 1', 'Steam Generation');
  push(a, 'StmCons4', '35 TPH — Stage 2', 'Steam Consumption 4 MW Turbine');
  push(a, 'StmCons45_55ATAPRDS', '35 TPH — Stage 2', 'Steam through 45/5.5 ATA Process PRDS');
  push(a, 'Stm45_55ATADeareatorEjectorPRDS', '35 TPH — Stage 2', 'Steam through 45/5.5 ATA Deareator & Ejector PRDS');
  push(a, 'Extractionstm4', '35 TPH — Stage 3', 'Extraction steam from 4MW TG');
  push(a, 'TotalStmdistil', '35 TPH — Stage 4', 'Total Steam to distillery process');
  push(a, 'StmtoEjector', '35 TPH — Stage 4', 'Steam to Ejector');
  push(a, 'Stm35TDeareator', '35 TPH — Stage 4', 'Steam to 35T Boiler Deareator from TG');
  push(a, 'StmtoSugDisti', '35 TPH — Stage 4', 'Steam to Sugar from Distillery');
  push(a, 'Firewood35', '35 TPH — Fuel Consumption', 'Firewood (MT)');
  push(a, 'Baggase35', '35 TPH — Fuel Consumption', 'Baggase (MT)');
  push(a, 'SlopCon', '35 TPH — Fuel Consumption', 'Slop Consumption (MT)');
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

// ─── ph_stoppage ───────────────────────────────────────────────
function schemaPhStoppage() {
  const a = [];
  push(a, 'Date', 'GSMA Power — Stoppages', 'Report Date');
  push(a, 'start_time', 'GSMA Power — Stoppages', 'From');
  push(a, 'end_Time', 'GSMA Power — Stoppages', 'To');
  push(a, 'section', 'GSMA Power — Stoppages', 'Section');
  push(a, 'sub_section', 'GSMA Power — Stoppages', 'Sub-Section');
  push(a, 'machinery', 'GSMA Power — Stoppages', 'Machinery');
  push(a, 'category', 'GSMA Power — Stoppages', 'Category');
  push(a, 'remarks', 'GSMA Power — Stoppages', 'Remark');
  push(a, 'created_at', 'System', 'Created at');
  push(a, 'timestamp', 'System', 'Recorded at');
  return a;
}

const BUILDERS = {
  mill_logbook1: schemaMillLogbook1,
  mill_logbook2: schemaMillLogbook2,
  mill_logbook3: schemaMillLogbook3,
  mill_stoppages: schemaMillStoppages,
  ds_logbook: schemaDSLogbook,
  rs_logbook: schemaRSLogbook,
  ops_logbook: schemaOpsLogbook,
  sa_logbook: schemaSALogbook,
  syrp_logbook: schemaSyrpLogbook,
  stoppage_logbook: schemaStoppageLogbook,
  ph_power: schemaPhPower,
  ph_steam: schemaPhSteam,
  ph_stoppage: schemaPhStoppage,
  distillery_ops: schemaDistilleryOps,
};

export function getColumnDescriptors(formKey) {
  const fn = BUILDERS[formKey];
  return fn ? fn() : [];
}

/** Schema order first, then any extra keys on the API row (e.g. primary key). */
export function getDisplayColumns(formKey, sampleRow) {
  const known = getColumnDescriptors(formKey);
  const seen = new Set(known.map((d) => d.dbKey));
  const extras = [];
  if (sampleRow && typeof sampleRow === 'object') {
    for (const k of Object.keys(sampleRow)) {
      if (!seen.has(k)) {
        extras.push({ dbKey: k, heading: 'Additional', subheading: k });
        seen.add(k);
      }
    }
  }
  return [...known, ...extras];
}

/** Runs of contiguous columns sharing the same heading (for merged header row). */
export function headingRuns(columns) {
  const runs = [];
  let i = 0;
  while (i < columns.length) {
    const heading = columns[i].heading;
    let j = i + 1;
    while (j < columns.length && columns[j].heading === heading) j += 1;
    runs.push({ heading, start: i, colSpan: j - i });
    i = j;
  }
  return runs;
}
