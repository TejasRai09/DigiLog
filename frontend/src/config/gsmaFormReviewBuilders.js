import { formatDistilleryDerivedNumber } from '../utils/distilleryCalculations';
import {
  displayValue,
  fieldsFromDefs,
  formatDate,
  labSummary,
  millSummary,
  reviewMeta,
} from '../utils/formReviewHelpers';

const DS_POL_BRIX = [
  { key: 'PJ', label: 'Primary Juice' },
  { key: 'MJ', label: 'Mixed Juice' },
  { key: 'LMJ', label: 'Last Mill Juice' },
  { key: 'CJ', label: 'Clear Juice' },
  { key: 'FJ', label: 'Filterate Juice' },
  { key: 'USul_Syrp', label: 'Unsulphured Syrup' },
  { key: 'Sul_Syrp', label: 'Sulphured Syrup' },
  { key: 'A_Mc', label: 'A M/C' },
  { key: 'B_Mc', label: 'B M/C' },
  { key: 'A1_Mc', label: 'A1 M/C' },
  { key: 'C_Mc', label: 'C M/C' },
  { key: 'A1_Mol', label: 'A1 Molasses' },
  { key: 'AH_Mol', label: 'A-Hy Molasses' },
  { key: 'AL_Mol', label: 'A-Light Molasses' },
  { key: 'BH_Mol', label: 'B-Hy Molasses' },
  { key: 'CL_Mol', label: 'C-Light Molasses' },
  { key: 'FMol', label: 'Final Molasses' },
];

function polBrixDefs(pairs) {
  return pairs.flatMap(({ key, label }) => [
    { key: `${key}_Pol`, label: `${label} — Pol` },
    { key: `${key}_Brix`, label: `${label} — Brix` },
  ]);
}

const DISTILLERY_PRODUCTION = [
  { key: 'syrup_molasses_qtls', label: 'Syrup/Mol. Used (Qtls)' },
  { key: 'wash_distilled', label: 'Wash Distilled' },
  { key: 'trs', label: 'TRS (%)', percent: true },
  { key: 'ufs', label: 'UFS (%)', percent: true },
  { key: 'alcohol_pct', label: 'Alcohol %', percent: true },
  { key: 'actual_ethanol_bl', label: 'Actual Ethanol Production (BL)' },
  { key: 'al_bl_ratio_pct', label: 'AL/BL Ratio (%)', percent: true },
  { key: 'total_bh_molasses_qtls', label: 'Total BH Molasses in Storage (Qtls)' },
  { key: 'total_ch_molasses_qtls', label: 'Total CH Molasses in Storage (Qtls)' },
  { key: 'ethanol_storage_bl', label: 'Ethanol in Storage (BL)' },
];

const DISTILLERY_DERIVED = [
  { key: 'fs', label: 'FS' },
  { key: 'FS%', label: 'FS%' },
  { key: 'fs_quantity', label: 'FS Quantity' },
  { key: 'theoretical_yield', label: 'Theoretical Yield' },
  { key: 'alcohol_prod_fermentation', label: 'Alcohol Prod in Fermentation' },
  { key: 'fe', label: 'FE' },
  { key: 'actual_prod_al', label: 'Actual Prod. AL' },
  { key: 'de', label: 'DE', percent: true },
  { key: 'oe', label: 'OE' },
  { key: 'rec_bl', label: 'REC BL' },
  { key: 'rec_al', label: 'REC AL' },
  { key: 'trs_qty', label: 'TRS QTY' },
  { key: 'ufs_qty', label: 'UFS QTY' },
  { key: 'total_mol_in_store_qtls', label: 'Total Mol in Store (Qtls)' },
];

const EQUIP_LIST = [
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

const TEMP_SUFFIXES = [
  { suffix: 'MtrTemp', label: 'Motor Temp' },
  { suffix: 'GearTempDE', label: 'Gear Temp (DE)' },
  { suffix: 'GearTempNDE', label: 'Gear Temp (NDE)' },
  { suffix: 'BearTempDE', label: 'Bearing Temp (DE)' },
  { suffix: 'BearTempNDE', label: 'Bearing Temp (NDE)' },
];

function equipmentTempFields(form) {
  const defs = [];
  EQUIP_LIST.forEach(({ key, label }) => {
    TEMP_SUFFIXES.forEach(({ suffix, label: sl }) => {
      defs.push({ key: `${key}_${suffix}`, label: `${label} — ${sl}` });
    });
  });
  return fieldsFromDefs(form, defs);
}

function section(title, fields, opts = {}) {
  return { title, fields, ...opts };
}

export function buildDistilleryReview(form, derived) {
  const derivedFields = DISTILLERY_DERIVED.map((d) => ({
    label: d.label,
    value: displayValue(formatDistilleryDerivedNumber(derived[d.key]), { percent: d.percent }),
  })).filter((f) => f.value !== '—');

  return reviewMeta(
    'Review Distillery Operations',
    [
      { label: 'Operation Date', value: formatDate(form.date) },
      {
        label: 'Operation Mode',
        value: displayValue(form.operation_mode),
        badge: true,
      },
    ],
    [
      section('Production Readings', fieldsFromDefs(form, DISTILLERY_PRODUCTION, { onlyFilled: false }), {
        titleTone: 'teal',
      }),
      section('Calculated Fields', derivedFields, {
        titleTone: 'navy',
        variant: 'highlight',
      }),
    ],
  );
}

export function buildDSLogbookReview(form) {
  const defs = [
    ...polBrixDefs(DS_POL_BRIX),
    { key: 'Bag_Pol', label: 'Bagasse — Pol' },
    { key: 'Bag_Moisture', label: 'Bagasse — Moisture' },
    { key: 'FCake_Pol', label: 'Filter Cake — Pol' },
    { key: 'MillDrain_Pol', label: 'Mill House Drain — Pol' },
    { key: 'BoilHouseDrain_Pol', label: 'Boiling House Drain — Pol' },
  ];
  return reviewMeta('Review DS Logbook', labSummary(form), [
    section('Logbook Entries', fieldsFromDefs(form, defs)),
  ]);
}

export function buildRSLogbookReview(form) {
  const keys = Object.keys(form).filter(
    (k) => !['date', 'shift', 'samplingTime', 'op_mode'].includes(k),
  );
  const defs = keys.map((key) => ({ key, label: key.replace(/_/g, ' ') }));
  return reviewMeta('Review RS Logbook', labSummary(form), [
    section('Logbook Entries', fieldsFromDefs(form, defs)),
  ]);
}

export function buildOpsLogbookReview(form) {
  const defs = Object.keys(form)
    .filter((k) => !['date', 'shift', 'samplingTime'].includes(k))
    .map((key) => ({ key, label: key.replace(/_/g, ' ') }));
  return reviewMeta('Review Operations Logbook', labSummary(form), [
    section('Logbook Entries', fieldsFromDefs(form, defs)),
  ]);
}

export function buildSALogbookReview(form) {
  const defs = Object.keys(form)
    .filter((k) => !['date', 'shift', 'samplingTime'].includes(k))
    .map((key) => ({ key, label: key.replace(/_/g, ' ') }));
  return reviewMeta('Review Special Analysis Logbook', labSummary(form), [
    section('Analysis Entries', fieldsFromDefs(form, defs)),
  ]);
}

export function buildSyrupLogbookReview(form) {
  return reviewMeta('Review Syrup Logbook', labSummary(form, [
    { label: 'Diversion From', value: displayValue(form.div_mode), badge: true },
  ]), [
    section('Logbook Entries', fieldsFromDefs(form, [
      { key: 'syrp_prodDS', label: 'Syrup Production (DS)' },
      { key: 'syrp_prodRS', label: 'Syrup Production (RS)' },
      { key: 'syrp_div', label: 'Syrup Diversion (Qtls)' },
      { key: 'MoLtoDist_DS', label: 'Molasses to Distillery (DS)' },
      { key: 'MoLtoDist_RS', label: 'Molasses to Distillery (RS)' },
      { key: 'syrp_trs', label: 'Avg Syrup TRS' },
      { key: 'bh_trs', label: 'Avg B-Heavy TRS' },
    ])),
  ]);
}

export function buildLabStoppageReview(form) {
  return reviewMeta('Review Lab Stoppages', [{ label: 'Report Date', value: formatDate(form.date) }], [
    section('Stoppage Details', fieldsFromDefs(form, [
      { key: 'startTime', label: 'From', dateTime: true },
      { key: 'endTime', label: 'To', dateTime: true },
      { key: 'department', label: 'Reason' },
      { key: 'remarks', label: 'Remark' },
    ], { onlyFilled: false })),
  ]);
}

export function buildMillStoppageReview(form) {
  return reviewMeta('Review Mill Stoppages', [{ label: 'Report Date', value: formatDate(form.date) }], [
    section('Stoppage Details', fieldsFromDefs(form, [
      { key: 'startTime', label: 'From', dateTime: true },
      { key: 'endTime', label: 'To', dateTime: true },
      { key: 'section', label: 'Section' },
      { key: 'machinery', label: 'Machinery' },
      { key: 'remarks', label: 'Remark' },
    ], { onlyFilled: false })),
  ]);
}

export function buildEquipmentTempReview(form) {
  return reviewMeta('Review Equipment Temperature', millSummary(form), [
    section('Equipment Readings', equipmentTempFields(form)),
  ]);
}

export function buildShredderOTGReview(form) {
  const defs = Object.keys(form)
    .filter((k) => !['date', 'shift', 'time'].includes(k))
    .map((key) => ({ key, label: key.replace(/_/g, ' ') }));
  return reviewMeta('Review Shredder and OTG', millSummary(form), [
    section('Readings', fieldsFromDefs(form, defs)),
  ]);
}

export function buildLubePressureReview(form) {
  const defs = Object.keys(form)
    .filter((k) => !['date', 'shift', 'time'].includes(k))
    .map((key) => ({ key, label: key.replace(/_/g, ' ') }));
  return reviewMeta('Review Lube Pressure & Roller Temp', millSummary(form), [
    section('Readings', fieldsFromDefs(form, defs)),
  ]);
}

export function buildPhPowerReview(form) {
  const defs = Object.keys(form)
    .filter((k) => !['date', 'time'].includes(k))
    .map((key) => ({ key, label: key.replace(/_/g, ' ') }));
  return reviewMeta('Review Power Details', [
    { label: 'Report Date', value: formatDate(form.date) },
    { label: 'Time', value: displayValue(form.time) },
  ], [section('Power Details', fieldsFromDefs(form, defs))]);
}

export function buildPhSteamReview(form) {
  const defs = Object.keys(form)
    .filter((k) => !['date', 'time'].includes(k))
    .map((key) => ({ key, label: key.replace(/_/g, ' ') }));
  return reviewMeta('Review Steam Details', [
    { label: 'Report Date', value: formatDate(form.date) },
    { label: 'Time', value: displayValue(form.time) },
  ], [section('Steam Details', fieldsFromDefs(form, defs))]);
}

export function buildPhStoppageReview(form) {
  return reviewMeta('Review Power Stoppages', [{ label: 'Report Date', value: formatDate(form.date) }], [
    section('Stoppage Details', fieldsFromDefs(form, [
      { key: 'startTime', label: 'From', dateTime: true },
      { key: 'endTime', label: 'To', dateTime: true },
      { key: 'section', label: 'Section' },
      { key: 'sub_section', label: 'Sub-Section' },
      { key: 'machinery', label: 'Machinery' },
      { key: 'category', label: 'Category' },
      { key: 'remarks', label: 'Remark' },
    ], { onlyFilled: false })),
  ]);
}
