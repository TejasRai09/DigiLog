import { formatDistilleryDerivedNumber } from '../utils/distilleryCalculations';
import {
  displayValue,
  fieldsFromDefs,
  formatDate,
  hasValue,
  labSummary,
  millSummary,
  reviewMeta,
  EMPTY,
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
  { suffix: 'MtrTemp', label: 'Motor Temp (DE)' },
  { suffix: 'GearTempDE', label: 'Gear Box BRG Temp (DE)' },
  { suffix: 'GearTempNDE', label: 'Gear Box BRG Temp (NDE)' },
  { suffix: 'BearTempDE', label: 'PB BRG Temp (DE)' },
  { suffix: 'BearTempNDE', label: 'PB BRG Temp (NDE)' },
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
  }));

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
    { key: 'DecanterMud_Pol', label: 'Decanter Mud Pol' },
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

const SHREDDER_OTG_LABELS = {
  shredR_MtrTemp: 'Motor BRG Temp [RHS]',
  shredR_BearTempSite: 'Bearing Temp (DCS) [RHS]',
  shredR_BearTempDCS: 'Bearing Temp (Site) [RHS]',
  shredR_VibH: 'Vibrations-H [RHS]',
  shredR_VibV: 'Vibrations-V [RHS]',
  shredR_VibA: 'Vibrations-A [RHS]',
  shredL_MtrTemp: 'Motor BRG Temp [LHS]',
  shredL_BearTempSite: 'Bearing Temp (DCS) [LHS]',
  shredL_BearTempDCS: 'Bearing Temp (Site) [LHS]',
  shredL_VibH: 'Vibrations-H [LHS]',
  shredL_VibV: 'Vibrations-V [LHS]',
  shredL_VibA: 'Vibrations-A [LHS]',
};

const OTG_ROLLER_LABELS = {
  InpM: 'Input - Mill Side',
  InpT: 'Input - Turbine Side',
  IntM: 'Intermediate - Mill Side',
  IntT: 'Intermediate - Turbine Side',
  OutM: 'Output - Mill Side',
  OutT: 'Output - Turbine Side',
};

function shredderOtgFieldLabel(key) {
  if (SHREDDER_OTG_LABELS[key]) return SHREDDER_OTG_LABELS[key];
  const m = key.match(/^M([1-4])_(InpT|InpM|IntT|IntM|OutT|OutM)$/);
  if (m) return `Mill ${m[1]} — ${OTG_ROLLER_LABELS[m[2]]}`;
  return key.replace(/_/g, ' ');
}

export function buildShredderOTGReview(form) {
  const defs = Object.keys(form)
    .filter((k) => !['date', 'shift', 'time'].includes(k))
    .map((key) => ({ key, label: shredderOtgFieldLabel(key) }));
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
    .map((key) => ({
      key,
      label: key === 'remark' ? 'General remarks' : key.replace(/_/g, ' '),
    }));
  return reviewMeta('Review Power Details', [
    { label: 'Report Date', value: formatDate(form.date) },
  ], [section('Power Details', fieldsFromDefs(form, defs))]);
}

export function buildPhSteamReview(form) {
  const defs = Object.keys(form)
    .filter((k) => !['date', 'time'].includes(k))
    .map((key) => ({ key, label: key.replace(/_/g, ' ') }));
  return reviewMeta('Review Steam Details', [
    { label: 'Report Date', value: formatDate(form.date) },
  ], [section('Steam Details', fieldsFromDefs(form, defs))]);
}

export function buildPhStoppageReview(form) {
  const detailFields = [
    { key: 'startTime', label: 'From', dateTime: true },
    { key: 'endTime', label: 'To', dateTime: true },
    { key: 'section', label: 'Section' },
    ...(form.section === 'Others' ? [{ key: 'section_specify', label: 'Please specify Section' }] : []),
    { key: 'sub_section', label: 'Sub-Section' },
    ...(form.sub_section === 'OTHERS' ? [{ key: 'sub_section_specify', label: 'Please specify Sub-Section' }] : []),
    { key: 'machinery', label: 'Machinery' },
    ...(form.machinery === 'Others' ? [{ key: 'machinery_specify', label: 'Please specify Machinery' }] : []),
    { key: 'category', label: 'Category' },
    ...(form.category === 'Other' ? [{ key: 'category_specify', label: 'Please specify Category' }] : []),
    { key: 'remarks', label: 'General remarks' },
  ];

  return reviewMeta('Review Power Stoppages', [{ label: 'Report Date', value: formatDate(form.date) }], [
    section('Stoppage Details', fieldsFromDefs(form, detailFields, { onlyFilled: false })),
    section('Photos', [
      {
        label: 'Stoppage Photos',
        value: form.photos?.length
          ? `${form.photos.length} photo(s) attached`
          : EMPTY,
      },
    ]),
  ]);
}

function ehsDateSummary(form) {
  const items = [{ label: 'Report Date', value: formatDate(form.date) }];
  if (hasValue(form.time)) items.push({ label: 'Time', value: form.time });
  return items;
}

function prodDateSummary(form, extra = []) {
  const items = [{ label: 'Report Date', value: formatDate(form.date) }];
  if (hasValue(form.season)) items.push({ label: 'Season', value: form.season });
  if (hasValue(form.crop_day)) items.push({ label: 'Crop Day', value: form.crop_day });
  return [...items, ...extra];
}

function compactRowSummary(row, skipKeys = ['time_slot']) {
  const parts = Object.entries(row)
    .filter(([k, v]) => !skipKeys.includes(k) && hasValue(v))
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
  return parts.length ? parts.join('; ') : EMPTY;
}

function hourlyEntriesSection(hours, title = 'Hourly Entries') {
  const fields = hours
    .filter((r) => Object.entries(r).some(([k, v]) => k !== 'time_slot' && hasValue(v)))
    .map((r) => ({
      label: r.time_slot || 'Row',
      value: compactRowSummary(r),
    }));
  return section(title, fields.length ? fields : [{ label: 'Rows', value: 'No data entered' }]);
}

export function buildEhsAccidentReview(form) {
  return reviewMeta('Review Accident Register', ehsDateSummary(form), [
    section('Incident Details', fieldsFromDefs(form, [
      { key: 'injured_person', label: 'Injured Person' },
      { key: 'department', label: 'Department' },
      { key: 'location', label: 'Location' },
      { key: 'type_of_accident', label: 'Type of Accident', badge: true },
      { key: 'description', label: 'Description' },
    ], { onlyFilled: false })),
  ]);
}

export function buildEhsNearMissReview(form) {
  return reviewMeta('Review Near Miss / Incident Report', ehsDateSummary(form), [
    section('Person Involved', fieldsFromDefs(form, [
      { key: 'name', label: 'Name' },
      { key: 'contact_no', label: 'Contact No.' },
      { key: 'department', label: 'Department / Section' },
      { key: 'person_type', label: 'Person Type' },
      { key: 'person_type_other', label: 'Other Person Type' },
    ])),
    section('Incident Details', fieldsFromDefs(form, [
      { key: 'location', label: 'Location' },
      { key: 'severity', label: 'Severity', badge: true },
      { key: 'description', label: 'Description / Cause' },
    ], { onlyFilled: false })),
    section('Treatment', fieldsFromDefs(form, [
      { key: 'treatment', label: 'Treatment Given' },
      { key: 'treatment_given', label: 'Treatment Details' },
      { key: 'treatment_by', label: 'By Whom' },
    ])),
    section('Follow-up & HOD Sign-off', [
      ...fieldsFromDefs(form, [
        { key: 'hazard_identified', label: 'Significant Hazard Identified?' },
      ]),
      {
        label: 'HOD Sign-off Document',
        value: form.hod_signoff_file
          ? (form.hod_signoff_file_name || 'File attached')
          : EMPTY,
      },
    ]),
  ]);
}

export function buildEhsWaterCpuReview(form) {
  return reviewMeta('Review CPU Water Recycle', ehsDateSummary(form), [
    section('Cane Crush', fieldsFromDefs(form, [
      { key: 'cane_crush_ondate', label: 'On Date (TCD)' },
      { key: 'cane_crush_todate', label: 'To Date (TCD)' },
    ])),
    section('CPU Inlet / Outlet', fieldsFromDefs(form, [
      { key: 'cpu_inlet_ondate', label: 'CPU Inlet — On Date (KL)' },
      { key: 'cpu_inlet_todate', label: 'CPU Inlet — To Date (KL)' },
      { key: 'cpu_outlet_ondate', label: 'CPU Outlet — On Date (KL)' },
      { key: 'cpu_outlet_todate', label: 'CPU Outlet — To Date (KL)' },
      { key: 'effluent_200ltcd_ondate', label: 'Effluent 200 L/TCD — On Date' },
      { key: 'effluent_200ltcd_todate', label: 'Effluent 200 L/TCD — To Date' },
    ])),
    section('Quality Parameters', fieldsFromDefs(form, [
      { key: 'inlet_ph_a', label: 'Inlet pH — A Shift' },
      { key: 'inlet_ph_b', label: 'Inlet pH — B Shift' },
      { key: 'inlet_ph_c', label: 'Inlet pH — C Shift' },
      { key: 'outlet_ph', label: 'Outlet pH' },
      { key: 'outlet_tss', label: 'TSS' },
      { key: 'outlet_cod', label: 'COD' },
      { key: 'outlet_bod', label: 'BOD' },
      { key: 'outlet_tds', label: 'TDS' },
      { key: 'oil_grease', label: 'Oil & Grease' },
      { key: 'transmittance', label: 'Transmittance' },
      { key: 'remarks', label: 'Remarks' },
    ])),
  ]);
}

export function buildEhsWaterEtpReview(form) {
  return reviewMeta('Review ETP Working', ehsDateSummary(form), [
    section('Cane Crush', fieldsFromDefs(form, [
      { key: 'cane_crush_ondate', label: 'On Date (TCD)' },
      { key: 'cane_crush_todate', label: 'To Date (TCD)' },
    ])),
    section('ETP Flow', fieldsFromDefs(form, [
      { key: 'etp_inlet_meter', label: 'ETP Inlet — Meter Reading' },
      { key: 'etp_inlet_kl', label: 'ETP Inlet — Extracted (KL)' },
      { key: 'etp_outlet_meter', label: 'ETP Outlet — Meter Reading' },
      { key: 'etp_outlet_kl', label: 'ETP Outlet — Extracted (KL)' },
      { key: 'effluent_200ltcd', label: 'Total Effluent 200 L/TCD' },
      { key: 'ondate_kld', label: 'On Date (KLD)' },
    ])),
    section('Quality Parameters', fieldsFromDefs(form, [
      { key: 'ph_g_shift', label: 'pH (G Shift)' },
      { key: 'tss', label: 'TSS' },
      { key: 'cod', label: 'COD' },
      { key: 'bod', label: 'BOD' },
      { key: 'tds', label: 'TDS' },
      { key: 'oil_grease', label: 'Oil & Grease' },
      { key: 'remarks', label: 'Remarks' },
    ])),
  ]);
}

export function buildEhsToolboxTalkReview(form) {
  const summary = [
    { label: 'Report Date', value: formatDate(form.date) },
    { label: 'Shift', value: hasValue(form.shift) ? form.shift : EMPTY, badge: true },
  ];
  if (hasValue(form.start_time) || hasValue(form.end_time)) {
    summary.push({
      label: 'Time',
      value: `${form.start_time || EMPTY} to ${form.end_time || EMPTY}`,
    });
  }
  return reviewMeta('Review Daily Safety Toolbox Talk', summary, [
    section('Report', fieldsFromDefs(form, [
      { key: 'report_prepared_by', label: 'Report Prepared By' },
      { key: 'topic_discussed', label: 'Topic Discussed' },
      { key: 'no_of_attendees', label: 'No. of Attendees' },
    ], { onlyFilled: false })),
    section('Photos', [
      { label: 'Attendance Sheet', value: form.attendance_sheet_photo ? 'Photo attached' : EMPTY },
      { label: 'Session Photo 1', value: form.session_photo ? 'Photo attached' : EMPTY },
      { label: 'Session Photo 2', value: form.session_photo_2 ? 'Photo attached' : EMPTY },
    ]),
  ]);
}

export function buildEhsWaterGwaReview(form) {
  return reviewMeta('Review Ground Water Abstraction', ehsDateSummary(form), [
    section('Bore Well Extraction', fieldsFromDefs(form, [
      { key: 'gw_pump1_meter', label: 'Pump 1 — Meter Reading' },
      { key: 'gw_pump1_ext_kl', label: 'Pump 1 — Extracted (KL)' },
      { key: 'gw_pump2_meter', label: 'Pump 2 — Meter Reading' },
      { key: 'gw_pump2_ext_kl', label: 'Pump 2 — Extracted (KL)' },
      { key: 'total_ext_kl', label: 'Total Extracted (KL)' },
    ])),
    section('Domestic Uses', fieldsFromDefs(form, [
      { key: 'dom_colony', label: 'Colony (KL)' },
      { key: 'dom_fire', label: 'Fire & Labour (KL)' },
    ])),
    section('Industrial Uses', fieldsFromDefs(form, [
      { key: 'ind_distillery', label: 'Distillery (KL)' },
      { key: 'ind_power_plant', label: 'Power Plant (KL)' },
      { key: 'ind_refinery', label: 'Refinery + DS + Mill (KL)' },
      { key: 'total_industrial', label: 'Total Industrial (KL)' },
    ])),
    section('Cane Crush & Water per Tonne', fieldsFromDefs(form, [
      { key: 'cane_crush_ondate', label: 'Cane Crush — On Date' },
      { key: 'cane_crush_todate', label: 'Cane Crush — To Date' },
      { key: 'sugar_total_lt', label: 'Sugar + Dist (L/T)' },
      { key: 'industrial_lt', label: 'Industrial (L/T)' },
      { key: 'total_ext_sugar_lt', label: 'Total Sugar Ext (L/T)' },
      { key: 'remarks', label: 'Remarks' },
    ])),
  ]);
}

const PAN_STRIKE_DEFS = [
  { key: 'strike_no', label: 'Strike No.' },
  { key: 'pan_no', label: 'Pan No.' },
  { key: 'start_time', label: 'Starting Time' },
  { key: 'drop_time', label: 'Dropping Time' },
  { key: 'boil_time', label: 'Boiling Time (Hrs)' },
  { key: 'down_time', label: 'Down Time (Mins)' },
  { key: 'qty', label: 'Massecuite Qty' },
  { key: 'cry_no', label: 'Dropping Cry No.' },
  { key: 'sample_purity', label: 'Key Sample Purity (%)' },
  { key: 'brix', label: 'Massecuite Brix (%)' },
  { key: 'purity', label: 'Massecuite Purity (%)' },
  { key: 'remarks', label: 'Remarks' },
];

export function buildProdPanLogbookReview(form) {
  const sections = (form.strikes || [])
    .filter((s) => PAN_STRIKE_DEFS.some((d) => hasValue(s[d.key])))
    .map((s) => section(`${s.grade} — Parameters`, fieldsFromDefs(s, PAN_STRIKE_DEFS, { onlyFilled: true })));
  return reviewMeta(
    'Review Pan Log Book',
    prodDateSummary(form),
    sections.length ? sections : [section('Massecuite Grades', [{ label: 'Entries', value: 'No grade data entered' }])],
  );
}

const SHIFT_CHEMIST_KEYS = [
  { key: 'shift8_4', label: 'Shift 8–4 (Morning)' },
  { key: 'shift4_12', label: 'Shift 4–12 (Evening)' },
  { key: 'shift12_8', label: 'Shift 12–8 (Night)' },
];

export function buildProdShiftChemistReview(form) {
  const sections = SHIFT_CHEMIST_KEYS.map(({ key, label }) =>
    section(label, fieldsFromDefs(form[key] || {}, [
      { key: 'jobs_done', label: 'Jobs Done' },
      { key: 'jobs_todo', label: 'Jobs To Be Done' },
      { key: 'sign', label: 'Sign-off' },
    ], { onlyFilled: true })),
  );
  sections.push(section('Instructions', fieldsFromDefs(form, [
    { key: 'instructions', label: 'Instructions / Remarks' },
  ])));
  return reviewMeta('Review Shift Chemist Log Book', prodDateSummary(form), sections);
}

export function buildProdCentrifugalReview(form) {
  const machineSections = ['m1', 'm2', 'm3', 'm4']
    .filter((key) => form[key])
    .map((key) => {
      const m = form[key];
      return section(m.name || key, [
        { label: 'Basket Cleaning', value: m.basket_cleaning ? 'Yes' : 'No' },
        { label: 'Screen Condition', value: displayValue(m.screen_condition) },
        { label: 'From', value: displayValue(m.from) },
        { label: 'To', value: displayValue(m.to) },
        { label: 'Duration', value: displayValue(m.duration) },
        { label: 'Reasons for Stoppage', value: displayValue(m.reasons) },
        { label: 'Separator Changing', value: m.separator ? 'Yes' : 'No' },
        { label: 'Remarks', value: displayValue(m.remarks) },
      ].filter((f) => f.value !== EMPTY));
    });
  return reviewMeta('Review Centrifugal Stoppage Log', prodDateSummary(form, [
    { label: 'Active Shift', value: displayValue(form.shift), badge: true },
  ]), [
    ...machineSections,
    section('Process Parameters', fieldsFromDefs(form, [
      { key: 'shw_temp', label: 'S.H.W. Temp (°C)' },
      { key: 'shw_pressure', label: 'S.H.W. Pressure (Kg/cm²)' },
      { key: 'air_pressure', label: 'Air Pressure (Kg/cm²)' },
    ])),
    section('Sign-offs', fieldsFromDefs(form, [
      { key: 'operator_sign', label: 'Operator' },
      { key: 'chemist_sign', label: 'Shift Chemist' },
      { key: 'section_head_sign', label: 'Section Head' },
    ])),
  ]);
}

export function buildProdClarificationReview(form) {
  const filledCount = (form.hours || []).filter((r) =>
    Object.entries(r).some(([k, v]) => k !== 'time_slot' && hasValue(v)),
  ).length;
  return reviewMeta('Review Clarification Log Book', prodDateSummary(form), [
    section('Instructions', fieldsFromDefs(form, [
      { key: 'inst_hod', label: 'HOD' },
      { key: 'inst_dy_hod', label: 'Dy HOD' },
      { key: 'inst_sectional_head', label: 'Sectional Head' },
    ])),
    section('Submission Summary', [
      { label: 'Hourly rows with data', value: String(filledCount) },
    ]),
    hourlyEntriesSection(form.hours || []),
  ]);
}

export function buildProdDecanterReview(form) {
  const filledCount = (form.hours || []).filter((r) =>
    Object.entries(r).some(([k, v]) => k !== 'time_slot' && hasValue(v)),
  ).length;
  return reviewMeta('Review Decanter Log Book', prodDateSummary(form), [
    section('Submission Summary', [
      { label: 'Hourly rows with data', value: String(filledCount) },
    ]),
    hourlyEntriesSection(form.hours || []),
  ]);
}

/** Equipment / power plant maintenance history record (Add Record flow). */
export function buildEquipmentHistoryReview(data, { mode = 'add', equipmentName, equipNo } = {}) {
  const title = mode === 'add' ? 'Review Maintenance Record' : 'Review Record Changes';
  const summary = [
    ...(equipmentName ? [{ label: 'Equipment', value: equipmentName }] : []),
    ...(equipNo ? [{ label: 'Equipment No.', value: equipNo }] : []),
    { label: 'Season', value: displayValue(data.season), badge: Boolean(data.season) },
    { label: 'Year', value: displayValue(data.year) },
  ];

  return reviewMeta(title, summary, [
    section('Maintenance Details', [
      { label: 'Date of Start', value: displayValue(data.date_start, { date: true }) },
      { label: 'Date of Finish', value: displayValue(data.date_finish, { date: true }) },
      { label: 'Outage / Observation', value: displayValue(data.obs) },
      { label: 'Action Taken', value: displayValue(data.act) },
      { label: 'Repair Cost (Rs.)', value: displayValue(data.cost) },
      { label: 'Service', value: displayValue(data.svc) },
      { label: 'Responsible', value: displayValue(data.resp) },
      { label: 'Remarks', value: displayValue(data.rem) },
      { label: 'Before Service Photo', value: data.img_before ? 'Attached' : EMPTY },
      { label: 'After Service Photo', value: data.img_after ? 'Attached' : EMPTY },
    ]),
  ]);
}
