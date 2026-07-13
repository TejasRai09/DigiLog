/**
 * Static data for Purchy drilldown tabs (from Power BI screenshots).
 */

export const DISHONOUR_DRILLDOWN = {
  kpis: { growers: 5296, villages: 322 },
  rootPct: 0.5293,
  rootLabel: '2025 Dishonour % (Qty)',
  filters: {
    dishonourBucket: ['41-60% Failure', '21-40% Failure', '1-20% Failure', '61-80% Failure', '81-99% Failure', '100% Failure'],
    loyaltySlicer: [
      '0. Never supplied', '1. Supplied 1 year', '2. Supplied 2 years',
      '3. Supplied 3 years', '4. Supplied 4 years', '5. Supplied 5 years',
    ],
  },
  tree: {
    societies: [
      {
        id: 'BELRAYAN', label: 'BELRAYAN', pct: 0.589,
        villages: [
          {
            id: '2207-SUJAANPUR', label: '2207-SUJAANPUR', pct: 0.55, growers: [
              { id: '2207-12-RAM', label: '2207-12-RAM', pct: 0.62 },
              { id: '2207-45-SHYAM', label: '2207-45-SHYAM', pct: 0.48 },
            ],
          },
          {
            id: '2196-NOWAPURSANI', label: '2196-NOWAPURSANI', pct: 0.5294, growers: [
              { id: '2196-82-RAMSEWAK', label: '2196-82-RAMSEWAK', pct: 0.5714 },
              { id: '2196-124-RAJ KUMAR', label: '2196-124-RAJ KUMAR', pct: 0.5 },
              { id: '2196-178-CHEDDU', label: '2196-178-CHEDDU', pct: 0.5 },
              { id: '2196-224-MAYA DEVI', label: '2196-224-MAYA DEVI', pct: 0.5 },
            ],
          },
          { id: '2224-CHANDAIYAPUR', label: '2224-CHANDAIYAPUR', pct: 0.5385, growers: [] },
          { id: '2216-BOKARIYA', label: '2216-BOKARIYA', pct: 0.5238, growers: [] },
        ],
      },
      { id: 'AIRA', label: 'AIRA', pct: 0.5296, villages: [] },
      { id: 'HARGAON', label: 'HARGAON', pct: 0.5295, villages: [] },
      { id: 'MAHMOODABAD', label: 'MAHMOODABAD', pct: 0.5287, villages: [] },
    ],
  },
  detailRows: [
    { growerNameKey: '100-32-BRAJ MOHAN', indentQty: 36, supplyQty: null, dishonourQty: 36, dishonourPct: 1 },
    { growerNameKey: '10-125-DORELAL', indentQty: 36, supplyQty: null, dishonourQty: 36, dishonourPct: 1 },
    { growerNameKey: '10-155-CHANDRIKA PRASAD', indentQty: 36, supplyQty: null, dishonourQty: 36, dishonourPct: 1 },
    { growerNameKey: '102-17-OM PRAKASH', indentQty: 72, supplyQty: null, dishonourQty: 72, dishonourPct: 1 },
    { growerNameKey: '10-241-JAGDISH KUMAR', indentQty: 36, supplyQty: null, dishonourQty: 36, dishonourPct: 1 },
    { growerNameKey: '10-253-RANJEET KUMAR', indentQty: 36, supplyQty: null, dishonourQty: 36, dishonourPct: 1 },
    { growerNameKey: '10-301-RAMRANI', indentQty: 36, supplyQty: null, dishonourQty: 36, dishonourPct: 1 },
    { growerNameKey: '107-253-PHOOL KISHOR', indentQty: 90, supplyQty: null, dishonourQty: 90, dishonourPct: 1 },
    { growerNameKey: '107-40-RADHEYSHYAM', indentQty: 36, supplyQty: null, dishonourQty: 36, dishonourPct: 1 },
    { growerNameKey: '108-66-SHIVPYARI', indentQty: 36, supplyQty: null, dishonourQty: 36, dishonourPct: 1 },
    { growerNameKey: '2196-82-RAMSEWAK', indentQty: 42, supplyQty: 18, dishonourQty: 24, dishonourPct: 0.5714 },
    { growerNameKey: '2196-124-RAJ KUMAR', indentQty: 36, supplyQty: 18, dishonourQty: 18, dishonourPct: 0.5 },
    { growerNameKey: '2196-178-CHEDDU', indentQty: 36, supplyQty: 18, dishonourQty: 18, dishonourPct: 0.5 },
    { growerNameKey: '2196-224-MAYA DEVI', indentQty: 36, supplyQty: 18, dishonourQty: 18, dishonourPct: 0.5 },
    { growerNameKey: '2207-12-RAM', indentQty: 48, supplyQty: 18, dishonourQty: 30, dishonourPct: 0.625 },
  ],
  totals: {
    indentQty: 629388,
    supplyQty: 123156,
    dishonourQty: 329022,
    dishonourPct: 0.5228,
  },
};

export const HIERARCHY_DRILLDOWN = {
  rootPct: 0.1358,
  rootValue: 13.58,
  rootLabel: '2025 Dishonour % (Count)',
  growerCount: 82510,
  filters: {
    villageName: ['504-PAIRUWA', '506-MAJHRA', '496-JALIM NAGAR', '507-BAKHTAWAR GAURI', '102-KOTWA', '105-CHANDPUR'],
    societyName: ['BELRAYAN', 'AIRA', 'HARGAON', 'MAHMOODABAD', 'BELTUA', 'AKATHI'],
    loyaltySlicer: [
      '5. Supplied 5 years', '4. Supplied 4 years', '3. Supplied 3 years',
      '2. Supplied 2 years', '1. Supplied 1 year', '0. Never supplied',
    ],
  },
  /** Nested hierarchy for Staff Drilldown decomposition tree */
  nestedTree: {
    id: 'root',
    name: '2025_Dishonour % (Count)',
    value: 13.58,
    growerCount: 82510,
    children: [
      {
        id: 'region-2',
        name: 'Region-2, Ajeet Verma',
        value: 14.90,
        growerCount: 45200,
        children: [
          {
            id: 'yp-rao',
            name: 'Y.P. Rao',
            value: 15.19,
            growerCount: 20100,
            children: [],
          },
          {
            id: 'pankaj-shrivastav',
            name: 'Pankaj Shrivastav',
            value: 14.57,
            growerCount: 25100,
            children: [
              { id: 'anil-dixit', name: 'Anil Dixit', value: 15.73, growerCount: 8200, children: [] },
              { id: 'awanish-singh', name: 'Awanish Singh', value: 15.53, growerCount: 7900, children: [] },
              {
                id: 'saurabh-pandey',
                name: 'Saurabh Pandey',
                value: 11.36,
                growerCount: 9000,
                children: [
                  { id: 'satish-kumar', name: 'Satish Kumar', value: 14.81, growerCount: 4100, children: [] },
                  {
                    id: 'uday-singh',
                    name: 'Uday Singh',
                    value: 9.47,
                    growerCount: 4900,
                    children: [
                      { id: 'v-504', name: '504-PAIRUWA', value: 29.71, growerCount: 1450, children: [] },
                      { id: 'v-506', name: '506-MAJHRA', value: 12.37, growerCount: 1210, children: [] },
                      { id: 'v-496', name: '496-JALIM NAGAR', value: 9.77, growerCount: 1140, children: [] },
                      { id: 'v-507', name: '507-BAKHTAWAR GAURI', value: 9.52, growerCount: 1100, children: [] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: 'region-1',
        name: 'Region-1, Ajeet Verma',
        value: 12.21,
        growerCount: 37310,
        children: [
          {
            id: 'r1-mgr1',
            name: 'Sanjay Tripathi',
            value: 12.80,
            growerCount: 18200,
            children: [
              {
                id: 'r1-inch1',
                name: 'Aalok Mishra',
                value: 13.10,
                growerCount: 9100,
                children: [
                  {
                    id: 'r1-staff1',
                    name: 'Prabhat Singh',
                    value: 12.20,
                    growerCount: 4500,
                    children: [
                      { id: 'v-r1-1', name: '102-KOTWA', value: 18.25, growerCount: 2200, children: [] },
                      { id: 'v-r1-2', name: '105-CHANDPUR', value: 11.40, growerCount: 2300, children: [] },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  loyaltyDonut: [
    { label: '5. Supplied 5 years', count: 33080, pct: 0.4012, color: '#059669', tailwind: 'bg-emerald-600' },
    { label: '4. Supplied 4 years', count: 11830, pct: 0.1435, color: '#2563eb', tailwind: 'bg-blue-500' },
    { label: '3. Supplied 3 years', count: 10070, pct: 0.1221, color: '#0d9488', tailwind: 'bg-teal-500' },
    { label: '0. Never supplied', count: 10360, pct: 0.1256, color: '#334155', tailwind: 'bg-slate-700' },
    { label: '2. Supplied 2 years', count: 9150, pct: 0.1109, color: '#38bdf8', tailwind: 'bg-sky-400' },
    { label: '1. Supplied 1 year', count: 7980, pct: 0.0967, color: '#818cf8', tailwind: 'bg-indigo-400' },
  ],
  varietyTreemap: [
    { name: 'CO 0118', share: 42, color: 'bg-[#1d2d50]', count: '15.4K' },
    { name: 'CO 0238', share: 24, color: 'bg-[#2563eb]', count: '8.8K' },
    { name: 'COLK 94184', share: 14, color: 'bg-[#0d8276]', count: '5.1K' },
    { name: 'CO 98014', share: 10, color: 'bg-[#64748b]', count: '3.7K' },
    { name: 'COLK 14201', share: 10, color: 'bg-[#14b8a6]', count: '3.5K' },
  ],
  /** @deprecated legacy flat tree — use nestedTree */
  tree: {
    zoneHeads: [],
  },
};

export const FAILURE_DATE_DRILLDOWN = {
  dateFrom: '2025-10-24',
  dateTo: '2026-03-06',
  filters: {
    societyName: ['All', 'BELRAYAN', 'AIRA', 'HARGAON', 'MAHMOODABAD', 'BELTUA', 'AKATHI', 'RATANGANJ II'],
  },
  failureByDate: [
    { date: '2025-10-25', pct: 0.0008 },
    { date: '2025-10-26', pct: 0.1949 },
    { date: '2025-10-27', pct: 0.2121 },
    { date: '2025-10-28', pct: 0.1850 },
    { date: '2025-10-29', pct: 0.1620 },
    { date: '2025-10-30', pct: 0.1480 },
    { date: '2025-11-01', pct: 0.1350 },
    { date: '2025-11-05', pct: 0.1520 },
    { date: '2025-11-10', pct: 0.1680 },
    { date: '2025-11-15', pct: 0.1410 },
    { date: '2025-11-20', pct: 0.1290 },
    { date: '2025-12-01', pct: 0.1380 },
    { date: '2025-12-15', pct: 0.1450 },
    { date: '2026-01-01', pct: 0.1320 },
    { date: '2026-01-15', pct: 0.1280 },
    { date: '2026-02-01', pct: 0.1358 },
    { date: '2026-02-15', pct: 0.1310 },
    { date: '2026-03-01', pct: 0.1270 },
    { date: '2026-03-06', pct: 0.1358 },
  ],
  supplyCenterRows: [
    { name: 'BELTUA', totalPurchy: 1511, dishonourPurchy: 494, dishonourPct: 0.3269, dishonourQty: 12450, totalBond: 54200, totalSupply: 36757 },
    { name: 'AKATHI', totalPurchy: 1350, dishonourPurchy: 340, dishonourPct: 0.2519, dishonourQty: 9850, totalBond: 48100, totalSupply: 32159 },
    { name: 'RATANGANJ II', totalPurchy: 856, dishonourPurchy: 213, dishonourPct: 0.2488, dishonourQty: 6120, totalBond: 35800, totalSupply: 23909 },
    { name: 'BELRAYAN', totalPurchy: 1240, dishonourPurchy: 298, dishonourPct: 0.2403, dishonourQty: 8920, totalBond: 42100, totalSupply: 28450 },
    { name: 'HARGAON', totalPurchy: 980, dishonourPurchy: 225, dishonourPct: 0.2296, dishonourQty: 7340, totalBond: 38500, totalSupply: 25100 },
    { name: 'MAHMOODABAD', totalPurchy: 875, dishonourPurchy: 198, dishonourPct: 0.2263, dishonourQty: 6510, totalBond: 34200, totalSupply: 22800 },
    { name: 'AIRA', totalPurchy: 720, dishonourPurchy: 162, dishonourPct: 0.2250, dishonourQty: 5280, totalBond: 29800, totalSupply: 19500 },
    { name: 'KALYANPUR', totalPurchy: 650, dishonourPurchy: 140, dishonourPct: 0.2154, dishonourQty: 4650, totalBond: 26500, totalSupply: 17200 },
  ],
  villageRows: [
    { name: 'BHAUWAPURWA', totalPurchy: 69, dishonourPurchy: 52, dishonourPct: 0.7536, dishonourQty: 890, totalBond: 2100, totalSupply: 613 },
    { name: 'PHULPUR (SAMAISA)', totalPurchy: 3, dishonourPurchy: 2, dishonourPct: 0.6667, dishonourQty: 72, totalBond: 108, totalSupply: null },
    { name: 'ISHAPUR', totalPurchy: 36, dishonourPurchy: 18, dishonourPct: 0.5, dishonourQty: 540, totalBond: 1296, totalSupply: 1183 },
    { name: '2196-NOWAPURSANI', totalPurchy: 48, dishonourPurchy: 24, dishonourPct: 0.5294, dishonourQty: 720, totalBond: 1728, totalSupply: 980 },
    { name: '504-PAIRUWA', totalPurchy: 42, dishonourPurchy: 20, dishonourPct: 0.2971, dishonourQty: 630, totalBond: 1512, totalSupply: 890 },
    { name: '2207-SUJAANPUR', totalPurchy: 55, dishonourPurchy: 26, dishonourPct: 0.55, dishonourQty: 825, totalBond: 1980, totalSupply: 1120 },
    { name: '506-MAJHRA', totalPurchy: 38, dishonourPurchy: 14, dishonourPct: 0.1237, dishonourQty: 570, totalBond: 1368, totalSupply: 920 },
    { name: '496-JALIM NAGAR', totalPurchy: 45, dishonourPurchy: 12, dishonourPct: 0.0977, dishonourQty: 675, totalBond: 1620, totalSupply: 1050 },
  ],
  totals: {
    totalPurchy: 82470,
    dishonourPurchy: 11200,
    dishonourPct: 0.1358,
    dishonourQty: 112450,
    totalBond: 425000,
    totalSupply: 298500,
  },
};
