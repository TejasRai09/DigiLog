/**
 * Sample Purchy BI data for UI preview when backend is empty or unavailable.
 */

export const PURCHY_STATIC_FILTER_OPTIONS = {
  societyName: [
    'RAMPUR CHINI MILLS LTD',
    'SARAYA SUGAR MILLS',
    'BALRAMPUR CHINI MILLS LTD',
    'DHAMPUR SUGAR MILLS',
    'BAJRANG SUGAR MILLS',
    'KESHI RAM CHINI MILLS',
    'TITAWI SUGAR MILLS',
    'SITAPUR CHINI MILLS',
    'BISWAN SUGAR MILLS',
    'HARDOI CHINI MILLS',
    'LAKHIMPUR KHERI MILLS',
    'SHAHJAHANPUR CO-OP',
    'PILIBHIT SUGAR COMPLEX',
    'BAREILLY CANE UNION',
    'MORADABAD SUGAR LTD',
  ],
  loyaltySlicer: [
    '0. Never supplied',
    '1. Supplied 1 year',
    '2. Supplied 2 years',
    '3. Supplied 3 years',
    '4. Supplied 4 years',
    '5. Supplied 5 years',
  ],
  dishonourBucket: [
    'No Indent',
    '0% - No Failure',
    '1-20% Failure',
    '21-40% Failure',
    '41-60% Failure',
    '61-80% Failure',
    '81-99% Failure',
    '100% Failure',
  ],
  zoneHead: [
    'North Zone',
    'South Zone',
    'East Zone',
    'West Zone',
    'Central Zone',
    'Rampur Region',
    'Bareilly Region',
    'Sitapur Region',
  ],
  zonalManager: [
    'Manager A — R.K. Sharma',
    'Manager B — S. Yadav',
    'Manager C — A. Patel',
    'Manager D — V. Singh',
    'Manager E — P. Gupta',
    'Manager F — M. Tiwari',
    'Manager G — D. Verma',
  ],
  zonalIncharge: [
    'Incharge 1 — Block A',
    'Incharge 2 — Block B',
    'Incharge 3 — Block C',
    'Incharge 4 — Block D',
    'Incharge 5 — Block E',
    'Incharge 6 — Block F',
  ],
  villageStaff: [
    'Staff Kumar',
    'Staff Singh',
    'Staff Patel',
    'Staff Yadav',
    'Staff Sharma',
    'Staff Verma',
    'Staff Mishra',
    'Staff Tiwari',
    'Staff Gupta',
    'Staff Rai',
    'Staff Pandey',
    'Staff Chauhan',
  ],
};

export const PURCHY_STATIC_SUMMARY = [
  {
    year: '2021',
    ttlGrowersWithBond: 42150,
    growersWithIndent: 38520,
    growersSupplied: 36210,
    ttlBond: 8450000,
    supplyQtyByYear: 6120000,
    supplyVsBondPct: 0.7243,
    issuedPurchyCnt: 412000,
    weightedPurchyCnt: 398500,
    purchyDishonourCntPct: 0.0328,
  },
  {
    year: '2022',
    ttlGrowersWithBond: 43800,
    growersWithIndent: 40100,
    growersSupplied: 37850,
    ttlBond: 8720000,
    supplyQtyByYear: 6345000,
    supplyVsBondPct: 0.7276,
    issuedPurchyCnt: 428000,
    weightedPurchyCnt: 412300,
    purchyDishonourCntPct: 0.0367,
  },
  {
    year: '2023',
    ttlGrowersWithBond: 45200,
    growersWithIndent: 41800,
    growersSupplied: 39200,
    ttlBond: 9010000,
    supplyQtyByYear: 6580000,
    supplyVsBondPct: 0.7303,
    issuedPurchyCnt: 445500,
    weightedPurchyCnt: 429800,
    purchyDishonourCntPct: 0.0352,
  },
  {
    year: '2024',
    ttlGrowersWithBond: 46800,
    growersWithIndent: 43200,
    growersSupplied: 40500,
    ttlBond: 9285000,
    supplyQtyByYear: 6812000,
    supplyVsBondPct: 0.7337,
    issuedPurchyCnt: 462000,
    weightedPurchyCnt: 445600,
    purchyDishonourCntPct: 0.0355,
  },
  {
    year: '2025',
    ttlGrowersWithBond: 48770,
    growersWithIndent: 45120,
    growersSupplied: 42180,
    ttlBond: 9650000,
    supplyQtyByYear: 7125000,
    supplyVsBondPct: 0.7383,
    issuedPurchyCnt: 478320,
    weightedPurchyCnt: 461050,
    purchyDishonourCntPct: 0.0361,
  },
];

const GROWER_NAMES = [
  'RAM KUMAR', 'SURESH YADAV', 'AMIT PATEL', 'VIKAS SHARMA', 'RAJESH VERMA',
  'PANKAJ GUPTA', 'MOHAN TIWARI', 'SANJAY MISHRA', 'RAVI SINGH', 'DEEPAK RAI',
  'ANIL PANDEY', 'SUNIL CHAUHAN', 'MANOJ AGARWAL', 'ASHOK MAURYA', 'RAMESH KUSHWAHA',
  'DINESH PAL', 'GOVIND TRIPATHI', 'HARISH SAXENA', 'JITENDRA DWIVEDI', 'KAMLESH BAXI',
  'LALIT SRIVASTAVA', 'MAHESH GUPTA', 'NARESH YADAV', 'OM PRAKASH', 'PRADEEP KUMAR',
  'RAGHUVEER SINGH', 'SATYENDRA PAL', 'TARUN SHARMA', 'UDAY SINGH', 'VINOD KUMAR',
  'YOGESH PATEL', 'ZAKIR HUSSAIN', 'ARUN KUMAR', 'BRIJESH SINGH', 'CHANDRA SHEKHAR',
  'DEVENDRA SINGH', 'FIRDOUS AHMAD', 'GIRISH CHAND', 'HEMANT KUMAR', 'IMRAN KHAN',
];

const VILLAGES = [
  'RAMPUR', 'BIJNOR', 'MEERUT', 'MORADABAD', 'BAREILLY', 'SHAHJAHANPUR', 'PILIBHIT',
  'LAKHIMPUR', 'SITAPUR', 'HARDOI', 'BISWAN', 'TITAWI', 'FATEHPUR', 'MILAK', 'SWAR',
  'BILASPUR', 'KANTH', 'THAKURDWARA', 'BILARI', 'CHANDAUSI', 'SAMBHAL', 'AMROHA',
  'NAJIBABAD', 'DHAMPUR', 'NAGINA', 'BUDHANPUR', 'KICHHA', 'BAHERI', 'FARIDPUR', 'AONLA',
];

const SOCIETIES = PURCHY_STATIC_FILTER_OPTIONS.societyName;
const LOYALTY = PURCHY_STATIC_FILTER_OPTIONS.loyaltySlicer;
const BUCKETS = PURCHY_STATIC_FILTER_OPTIONS.dishonourBucket.filter((b) => b !== 'No Indent' && b !== '0% - No Failure');
const ZONE_HEADS = PURCHY_STATIC_FILTER_OPTIONS.zoneHead;
const MANAGERS = PURCHY_STATIC_FILTER_OPTIONS.zonalManager;
const INCHARGES = PURCHY_STATIC_FILTER_OPTIONS.zonalIncharge;
const STAFF = PURCHY_STATIC_FILTER_OPTIONS.villageStaff;

function pick(arr, i) {
  return arr[i % arr.length];
}

function buildGrowerRow(i) {
  const villageCode = 100 + (i % 30);
  const growerCode = 2000 + i * 37;
  const village = pick(VILLAGES, i);
  const name = pick(GROWER_NAMES, i);
  const bond = 70 + (i * 13) % 90;
  const indent = bond - (i % 8);
  const weight = indent - (i % 12);
  const failer = i % 5 === 0 ? 0 : Math.round((indent - weight) * 10) / 10;
  const loyalty = pick(LOYALTY, i);
  const bucket = failer <= 0
    ? (indent <= 0 ? 'No Indent' : '0% - No Failure')
    : pick(BUCKETS, i);

  return {
    grower_name_key: `${villageCode}-${growerCode}-${name}`,
    village_name_key: `${villageCode}-${village}`,
    society_name: pick(SOCIETIES, i + 3),
    total_bond: bond,
    indent_qty: Math.max(indent, 0),
    weight_qty_2025: Math.max(weight, 0),
    indent_failer_qty: failer,
    loyalty_slicer: loyalty,
    zone_head: pick(ZONE_HEADS, i),
    zonal_manager: pick(MANAGERS, i),
    zonal_incharge: pick(INCHARGES, i),
    village_staff: pick(STAFF, i),
    dishonour_bucket: bucket,
  };
}

export const PURCHY_STATIC_GROWER_DETAIL = Array.from({ length: 45 }, (_, i) => buildGrowerRow(i));

export const PURCHY_STATIC_KPIS = {
  bondedGrowers: 48770,
  indentCount: 478320,
  indentQty: 9650000,
  supplyCount: 461050,
  supplyQty: 7125000,
  dishonourCount: 17270,
  dishonourPctCount: 0.0361,
  dishonourQty: 252500,
  dishonourPctQty: 0.0262,
};

export const PURCHY_STATIC_DISHONOUR_DETAIL = PURCHY_STATIC_GROWER_DETAIL
  .filter((r) => r.indent_failer_qty > 0)
  .map((r) => {
    const indentQty = r.indent_qty;
    const dishonourQty = r.indent_failer_qty;
    const supplyQty = r.weight_qty_2025;
    return {
      societyName: r.society_name,
      villageNameKey: r.village_name_key,
      growerNameKey: r.grower_name_key,
      villageStaff: r.village_staff,
      noOfPurchyIndent: Math.max(1, Math.round(indentQty / 10)),
      noOfIndentFailerPurchy: Math.max(1, Math.round(dishonourQty / 5)),
      supplyCount2025: Math.max(1, Math.round(supplyQty / 8)),
      indentQty2025: indentQty,
      supplyQty2025: supplyQty,
      dishonourQty2025: dishonourQty,
      dishonourPctQty: indentQty ? dishonourQty / indentQty : 0,
      zone_head: r.zone_head,
      zonal_manager: r.zonal_manager,
      zonal_incharge: r.zonal_incharge,
      loyalty_slicer: r.loyalty_slicer,
      dishonour_bucket: r.dishonour_bucket,
    };
  })
  .sort((a, b) => b.dishonourPctQty - a.dishonourPctQty);
