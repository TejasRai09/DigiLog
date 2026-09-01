const { totalCaneRow, sugarOutputRow, sugarProdRow } = require('./dmrDailyMeasures');

/** KPI assembly for Management Dashboard (executive summary).
 *
 * Phase 2 — PBI → MySQL table/column mapping (Management Dashboard-v1.SemanticModel):
 *
 * | PBI table      | MySQL / DigiLog source              | Date join column        |
 * |----------------|-------------------------------------|-------------------------|
 * | DMR_SS24       | ops_logbook + ds_logbook + rs_logbook (needs dmr_daily import) | Date |
 * | power          | ph_power                            | Date                    |
 * | steam          | ph_steam                            | Date                    |
 * | Cane Indent    | centre_indent_data                  | indent_date             |
 * | Cane Purchase  | centre_purchase_data                | purchase_date           |
 * | YardBrix       | brix_yard_sampling                  | Date                    |
 * | FieldBrix      | brix_field_sampling                 | Date                    |
 * | Distillery     | distillery_operations               | Date                    |
 * | Outage         | (not imported)                      | Date                    |
 *
 * Key DMR columns to map: Total Cane, MACERATION, Mixed Juice Cal, DMF, Plant POL IN CANE DS,
 * YARD BAL 8 AM, CANE CRUSHED [DS/REF], Total Sugar Production, bagasse pol/moisture, mol purity.
 *
 * 7DMA pattern (mirror DAX): rolling agg over 7 days ending PREVIOUSDAY(LASTDATE(Date)).
 * Date calendar: ALL 7DMA measures use DMR_SS24[Date] in DATESINPERIOD — even when the
 * metric value comes from Cane Indent, Distillery, power, steam, YardBrix, or FieldBrix.
 * Join fact date columns per relationships.tmdl (see frontend catalog dateJoin fields).
 * Frontend catalog: frontend/src/data/managementDashboardMeta.js
 */

function n(v) {
  if (v == null || v === '') return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function nullableNum(v) {
  if (v == null || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function sum(rows, key) {
  let t = 0;
  for (const r of rows || []) t += n(r[key]);
  return t;
}

function avg(rows, key) {
  const vals = (rows || []).map((r) => nullableNum(r[key])).filter((v) => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function safeDiv(a, b) {
  if (b == null || b === 0 || !Number.isFinite(b)) return null;
  if (!Number.isFinite(a)) return null;
  return a / b;
}

function countNonZero(rows, key) {
  let c = 0;
  for (const r of rows || []) {
    if (n(r[key]) !== 0) c += 1;
  }
  return c;
}

function effPercent(v) {
  const x = n(v);
  if (x === 0) return 0;
  if (Math.abs(x) <= 1) return x * 100;
  return x;
}

/** Average efficiency after normalizing each row (fraction or percent). */
function avgEffPercent(rows, key) {
  let sum = 0;
  let count = 0;
  for (const r of rows || []) {
    if (r[key] == null || r[key] === '') continue;
    const pct = effPercent(r[key]);
    if (!Number.isFinite(pct)) continue;
    sum += pct;
    count += 1;
  }
  return count ? sum / count : null;
}

function dateKeyRow(r) {
  if (!r || r.Date == null) return null;
  return String(r.Date).slice(0, 10);
}

function avgDailyRatio(rows, getNum, getDen, scale = 1) {
  let total = 0;
  let count = 0;
  for (const r of rows || []) {
    const den = getDen(r);
    const num = getNum(r);
    if (den == null || den === 0 || !Number.isFinite(den) || num == null || !Number.isFinite(num)) continue;
    total += (num * scale) / den;
    count += 1;
  }
  return count ? total / count : null;
}

function computePowerKpis(powerRows, steamRows = [], extras = {}) {
  const p = powerRows || [];
  const s = steamRows || [];
  const crushDen = extras.crush > 0 ? extras.crush : sum(p, 'Crush');
  const sugarDen = extras.sugar > 0 ? extras.sugar : null;

  const PowerGen30 = sum(p, 'PowerGen30');
  const PowerGen3Old = sum(p, 'PowerGen3Old');
  const PowerGen3New = sum(p, 'PowerGen3New');
  const PowerGen4MW = sum(p, 'PowerGen4MW');
  const Hours30 = sum(p, 'Hours30');
  const Hours3Old = sum(p, 'Hours3Old');
  const Hours3New = sum(p, 'Hours3New');
  const Hours4 = sum(p, 'Hours4');

  const PowerCons_Dist_CPU_4MW =
    PowerGen4MW + sum(p, 'ExportDist30') - sum(p, 'Imp_4MW') - sum(p, 'ExportCogen4');

  const Export_Cogen =
    sum(p, 'ExportCogen30') +
    sum(p, 'ExportCogen3New') +
    sum(p, 'ExportCogen3Old') +
    sum(p, 'ExportCogen4');

  const Export_Sugar =
    sum(p, 'ExportSug30') +
    sum(p, 'ExportSug3New') +
    sum(p, 'ExportSug3Old') +
    sum(p, 'ExportSug4');

  const Total_Power_Gen = PowerGen30 + PowerGen3New + PowerGen3Old + PowerGen4MW;
  const ExportGrid30 = sum(p, 'ExportGrid30');
  const Crush = sum(p, 'Crush');
  const millHouse = sum(p, 'PowerConMillHouse');
  const sugarHouse = sum(p, 'PowerConRaw_Ref') + sum(p, 'PowerConDSHouse');

  const dmrByDate = new Map();
  for (const r of extras.dmrRows || []) {
    const k = dateKeyRow(r);
    if (k) dmrByDate.set(k, r);
  }
  const crushOf = (r) => {
    const fromPower = n(r.Crush);
    if (fromPower) return fromPower;
    const d = dmrByDate.get(dateKeyRow(r));
    return d ? totalCaneRow(d) : 0;
  };
  const sugarOf = (r) => {
    const d = dmrByDate.get(dateKeyRow(r));
    if (!d) return 0;
    return sugarOutputRow(d) || sugarProdRow(d);
  };

  return {
    PowerGen30,
    PowerGen3Old,
    PowerGen3New,
    PowerGen4MW,
    Hours30,
    Hours3Old,
    Hours3New,
    Hours4,
    Crush,
    ExportGrid30,
    Total_Power_Gen,
    Total_Internal_Con: Total_Power_Gen - ExportGrid30,
    Export_Cogen,
    Export_Sugar,
    PowerCons_Dist_CPU_4MW,
    SpecSteam30: safeDiv(sum(s, 'SteamCon30MW'), PowerGen30 / 1000),
    SpecSteam3ON: safeDiv(sum(s, 'StmCons3Old70') + sum(s, 'StmCons3New70'), (PowerGen3Old + PowerGen3New) / 1000),
    SpecSteam4: safeDiv(sum(s, 'StmCons4'), PowerGen4MW / 1000),
    PowerPerCane: avgDailyRatio(p, (r) => n(r.PowerConMillHouse), crushOf) || safeDiv(millHouse, crushDen),
    PowerPerSugar: avgDailyRatio(p, (r) => n(r.PowerConRaw_Ref) + n(r.PowerConDSHouse), sugarOf) || safeDiv(sugarHouse, sugarDen),
  };
}

function computeSteamKpis(steamRows, extras = {}) {
  const s = steamRows || [];
  const crushDen = extras.crush > 0 ? extras.crush : null;
  const sugarDen = extras.sugar > 0 ? extras.sugar : null;

  const stmMillTurbine = sum(s, 'StmMillTurbine110_45ATAPRDS');
  const stmConsMillPrds =
    sum(s, 'SteamGen70') - sum(s, 'StmCons3New70') - sum(s, 'StmCons3Old70');
  const steamToSug15070 = sum(s, 'TotalStmtoSug150') + sum(s, 'TotalStmtoSug70');

  const dmrByDate = new Map();
  for (const r of extras.dmrRows || []) {
    const k = dateKeyRow(r);
    if (k) dmrByDate.set(k, r);
  }
  const crushOf = (r) => {
    const d = dmrByDate.get(dateKeyRow(r));
    return d ? totalCaneRow(d) : 0;
  };
  const sugarOf = (r) => {
    const d = dmrByDate.get(dateKeyRow(r));
    if (!d) return 0;
    return sugarOutputRow(d) || sugarProdRow(d);
  };
  const millSteam = (r) =>
    n(r.StmMillTurbine110_45ATAPRDS) + n(r.SteamGen70) - n(r.StmCons3New70) - n(r.StmCons3Old70);
  const steamSug = (r) => n(r.TotalStmtoSug150) + n(r.TotalStmtoSug70);

  return {
    TotalSteamgen: sum(s, 'SteamGen150') + sum(s, 'SteamGen70') + sum(s, 'SteamGen35'),
    TotalStmtoSugar: steamToSug15070,
    StmtoBaggase150: safeDiv(sum(s, 'SteamGen150'), sum(s, 'Baggase150')),
    StmtoBaggase70: safeDiv(sum(s, 'SteamGen70'), sum(s, 'Baggase70')),
    StmtoBaggase35: safeDiv(sum(s, 'SteamGen35'), sum(s, 'Baggase35') + sum(s, 'SlopCon')),
    SteamPerCane: avgDailyRatio(s, millSteam, crushOf, 1000) || safeDiv((stmMillTurbine + stmConsMillPrds) * 1000, crushDen),
    SteamPerSugar: avgDailyRatio(s, steamSug, sugarOf, 1000) || safeDiv(steamToSug15070 * 1000, sugarDen),
  };
}

function sugarTotalFromOps(rows) {
  const keys = [
    'qty_dsl', 'qty_dsm', 'qty_dss',
    'qty_rsl', 'qty_rsm', 'qty_rss',
    'qty_p20', 'qty_p30', 'qty_p40',
  ];
  let t = 0;
  for (const r of rows || []) {
    for (const k of keys) t += n(r[k]);
  }
  return t;
}

function sugarDsFromOps(rows) {
  return sum(rows, 'qty_dsl') + sum(rows, 'qty_dsm') + sum(rows, 'qty_dss');
}

function sugarRsFromOps(rows) {
  return sum(rows, 'qty_rsl') + sum(rows, 'qty_rsm') + sum(rows, 'qty_rss');
}

/** Maps API KPI titles to frontend catalog ids (managementDashboardMeta.js). */
const KPI_TITLE_TO_ID = {
  'Cane Indent (Q)': 'cane_indent',
  'Cane Purchase (Q)': 'cane_purchase',
  'Yard Bal. (8AM)': 'yard_bal',
  'Pol in Cane %': 'pol_in_cane',
  'Middle Brix % Yard': 'brix_yard',
  'Middle Brix % Field': 'brix_field',
  'Cane Crush (Q)': 'cane_crush',
  'Masceration %': 'maceration',
  'Mixed Juice (Q)': 'mixed_juice',
  'DMF %': 'dmf',
  'Bag Pol % Cane': 'bag_pol_cane',
  'Power/Cane (Unit/Q)': 'power_per_cane',
  'Power/Cane (KWH/Q)': 'power_per_cane',
  'Steam/Cane (T/Q)': 'steam_per_cane',
  'Steam/Cane (KG/Q)': 'steam_per_cane',
  'Cane DS (Q)': 'cane_ds',
  'Cane RS (Q)': 'cane_rs',
  'Sugar Total (Q)': 'sugar_total',
  'Sugar Recovery %': 'sugar_recovery',
  'Pol In F Cake': 'pol_f_cake',
  'Power/Sugar (Units/Q)': 'power_per_sugar',
  'Power/Sugar (KWH/Q)': 'power_per_sugar',
  'Steam/Sugar (T/Q)': 'steam_per_sugar',
  'Steam/Sugar (KG/Q)': 'steam_per_sugar',
  'Power Gen (Units)': 'power_gen',
  'Export (Units)': 'power_export',
  'Inhouse Consp (Units)': 'inhouse_consp',
  'Total Steam Gen (T)': 'steam_gen',
  'Total Steam to Sugar (T)': 'steam_to_sugar',
  'Steam/Bag 150 TPH': 'steam_bag',
  'Sp. Steam 30MW': 'spec_steam',
  'Syrup+Mol Used (Q)': 'syrup_mol',
  'Ethanol Prod. (BL)': 'ethanol_prod',
  'Recovery BL': 'recovery_bl',
  'Ethanol Stored (BL)': 'ethanol_store',
  'B Mol in Store (Q)': 'b_mol_store',
  'Distillation Eff.': 'dist_eff',
  'TRS & FS %': 'trs_fs',
};

function kpi(title, value, extras = {}) {
  const id = KPI_TITLE_TO_ID[title] || extras.id;
  return { id, title, value, ...extras };
}

function buildRows(payload) {
  const {
    caneIndent,
    canePurchase,
    yardBal,
    polInCane,
    brixYard,
    brixField,
    overrunGatePct,
    overrunCenterPct,
    overrunCenterQty,
    opsRows,
    dsRows,
    rsRows,
    powerRows,
    steamRows,
    distilleryRows,
    dmrRows,
    dmrKpis = null,
    series = {},
    rightVal7dma = {},
  } = payload;

  const rv = (key) => (rightVal7dma[key] != null ? rightVal7dma[key] : null);
  const dmr = dmrKpis || {};

  const crushOps = avg(opsRows, 'crush');
  const crush = dmr.crush > 0 ? dmr.crush : crushOps;
  const sugarTotal = dmr.sugarTotal > 0 ? dmr.sugarTotal : sugarTotalFromOps(opsRows);
  const sugarForRatio = dmr.sugarOutput > 0 ? dmr.sugarOutput : sugarTotal;

  const power = computePowerKpis(powerRows, steamRows, { crush, sugar: sugarForRatio, dmrRows });
  const steam = computeSteamKpis(steamRows, { crush, sugar: sugarForRatio, dmrRows });

  const mixedJuice =
    dmr.mixedJuice > 0 ? dmr.mixedJuice : sum(opsRows, 'mixj_ds') + sum(opsRows, 'mixj_rs');
  const maceration =
    dmr.maceration != null
      ? dmr.maceration
      : safeDiv(avg(opsRows, 'imb_wtr'), crushOps) != null
        ? safeDiv(avg(opsRows, 'imb_wtr'), crushOps) * 100
        : null;

  const bagPol = dmr.bagPol != null ? dmr.bagPol : avg(dsRows, 'Bag_Pol');
  const bagMoisture = dmr.bagMoisture != null ? dmr.bagMoisture : avg(dsRows, 'Bag_Moisture');
  const bagPolCane =
    dmr.bagPolCane != null
      ? dmr.bagPolCane
      : safeDiv(bagPol, crushOps) != null
        ? safeDiv(bagPol, crushOps) * 100
        : null;

  const caneDsQty = dmr.caneDs > 0 ? dmr.caneDs : sugarDsFromOps(opsRows);
  const caneRsQty = dmr.caneRs > 0 ? dmr.caneRs : sugarRsFromOps(opsRows);
  const sugarRecovery =
    dmr.sugarRecovery != null
      ? dmr.sugarRecovery
      : safeDiv(sugarTotal, crush) != null
        ? safeDiv(sugarTotal, crush) * 100
        : null;

  const fMolPurityDs =
    dmr.fMolPurityDs != null
      ? dmr.fMolPurityDs
      : safeDiv(avg(dsRows, 'FMol_Pol'), avg(dsRows, 'FMol_Brix')) != null
        ? safeDiv(avg(dsRows, 'FMol_Pol'), avg(dsRows, 'FMol_Brix')) * 100
        : null;
  const fMolPurityRs =
    dmr.fMolPurityRs != null
      ? dmr.fMolPurityRs
      : safeDiv(avg(rsRows, 'FMol_Pol'), avg(rsRows, 'FMol_Brix')) != null
        ? safeDiv(avg(rsRows, 'FMol_Pol'), avg(rsRows, 'FMol_Brix')) * 100
        : null;
  const fCakePol = dmr.fCakePol != null ? dmr.fCakePol : avg(dsRows, 'FCake_Pol');
  const molPolCane =
    dmr.molPolCane != null
      ? dmr.molPolCane
      : safeDiv(avg(dsRows, 'FMol_Pol'), crush) != null
        ? safeDiv(avg(dsRows, 'FMol_Pol'), crush) * 100
        : null;

  const dist = distilleryRows || [];
  const syrupMolUsed = sum(dist, 'syrup_molasses_qtls');
  const ethanolProd = sum(dist, 'actual_ethanol_bl');
  const recBl = avg(dist, 'rec_bl') || safeDiv(ethanolProd, syrupMolUsed);
  const ethStored = avg(dist, 'ethanol_storage_bl');
  const bMolStore = avg(dist, 'total_bh_molasses_qtls');
  const cMolStore = avg(dist, 'total_ch_molasses_qtls');
  const distEff = avgEffPercent(dist, 'de');
  const fermEff = avgEffPercent(dist, 'fe');
  const trs = avg(dist, 'trs');
  const fs = avg(dist, 'fs');

  const steamPerCane = steam.SteamPerCane;
  const powerPerCane = power.PowerPerCane;
  const powerPerSugar = power.PowerPerSugar;
  const steamPerSugar = steam.SteamPerSugar;

  return [
    {
      id: 'cane',
      title: 'Cane',
      color: 'bg-[#cce0ff]',
      icon: 'cane',
      kpis: [
        kpi('Cane Indent (Q)', caneIndent, {
          rightVal: rv('caneIndent'),
          chart: 'line',
          chartColor: '#3b82f6',
          series: series.caneIndent,
        }),
        kpi('Cane Purchase (Q)', canePurchase, {
          rightVal: rv('canePurchase'),
          chart: 'bar',
          chartColor: '#3b82f6',
          series: series.canePurchase,
        }),
        kpi('Yard Bal. (8AM)', dmr.yardBal != null ? dmr.yardBal : yardBal, {
          rightVal: rv('yardBal'),
          subValues: [
            { label: 'Overrun Gate', value: overrunGatePct, unit: '%' },
            { label: 'Overrun Center', value: overrunCenterPct, unit: '%', rightVal: overrunCenterQty },
          ],
        }),
        kpi('Pol in Cane %', dmr.polInCane != null ? dmr.polInCane : polInCane, {
          rightVal: rv('polInCane'),
          chart: 'line',
          chartColor: '#3b82f6',
          series: series.polInCane,
        }),
        kpi('Middle Brix % Yard', brixYard, {
          rightVal: rv('brixYard'),
          chart: 'bar',
          chartColor: '#3b82f6',
          series: series.brixYard,
        }),
        kpi('Middle Brix % Field', brixField, {
          rightVal: rv('brixField'),
          chart: 'line',
          chartColor: '#3b82f6',
          series: series.brixField,
        }),
      ],
    },
    {
      id: 'milling',
      title: 'Milling',
      color: 'bg-[#f5cbb3]',
      icon: 'milling',
      kpis: [
        kpi('Cane Crush (Q)', crush, {
          rightVal: rv('crush'),
          chart: 'line',
          chartColor: '#ea580c',
          series: series.crush,
        }),
        kpi('Masceration %', maceration, {
          chart: 'line',
          chartColor: '#ea580c',
          series: series.maceration,
          rightVal: rv('maceration'),
        }),
        kpi('Mixed Juice (Q)', mixedJuice, {
          rightVal: rv('mixedJuice'),
          chart: 'line',
          chartColor: '#ea580c',
          series: series.mixedJuice,
        }),
        kpi('DMF %', dmr.dmf != null ? dmr.dmf : null, {
          chart: 'line',
          chartColor: '#ea580c',
          series: series.dmf,
          rightVal: rv('dmf'),
        }),
        kpi('Bag Pol % Cane', bagPolCane, {
          rightVal: rv('bagPolCane'),
          subValues: [
            { label: 'Pol % Bagasse', value: bagPol, rightVal: rv('bagPol') },
            { label: 'Bagasse Moisture', value: bagMoisture, rightVal: rv('bagMoisture') },
          ],
          chart: 'line',
          chartColor: '#ea580c',
          series: series.bagPol,
        }),
        kpi('Power/Cane (KWH/Q)', powerPerCane, {
          chart: 'line',
          chartColor: '#ea580c',
          series: series.powerPerCane,
          rightVal: rv('powerPerCane'),
        }),
        kpi('Steam/Cane (KG/Q)', steamPerCane, {
          chart: 'line',
          chartColor: '#ea580c',
          series: series.steamPerCane,
          rightVal: rv('steamPerCane'),
        }),
      ],
    },
    {
      id: 'sugar',
      title: 'Sugar',
      color: 'bg-[#fef0b3]',
      icon: 'sugar',
      kpis: [
        kpi('Cane DS (Q)', caneDsQty, {
          chart: 'line',
          chartColor: '#eab308',
          series: series.caneDs,
          rightVal: rv('caneDs'),
        }),
        kpi('Cane RS (Q)', caneRsQty, {
          chart: 'line',
          chartColor: '#eab308',
          series: series.caneRs,
          rightVal: rv('caneRs'),
        }),
        kpi('Sugar Total (Q)', sugarTotal, {
          chart: 'bar',
          chartColor: '#ca8a04',
          series: series.sugarTotal,
          rightVal: rv('sugarTotal'),
        }),
        kpi('Sugar Recovery %', sugarRecovery, {
          chart: 'line',
          chartColor: '#eab308',
          series: series.sugarRecovery,
          rightVal: rv('sugarRecovery'),
        }),
        kpi('Pol In F Cake', fCakePol, {
          rightVal: rv('fCakePol'),
          subValues: [
            { label: 'Mol Pol % Cane', value: molPolCane, rightVal: rv('molPolCane') },
            { label: 'F Mol Purity (DS)', value: fMolPurityDs, rightVal: rv('fMolPurityDs') },
            { label: 'F Mol Purity (RS)', value: fMolPurityRs, rightVal: rv('fMolPurityRs') },
          ],
        }),
        kpi('Power/Sugar (KWH/Q)', powerPerSugar, {
          chart: 'line',
          chartColor: '#eab308',
          series: series.powerPerSugar,
          rightVal: rv('powerPerSugar'),
        }),
        kpi('Steam/Sugar (KG/Q)', steamPerSugar, {
          chart: 'line',
          chartColor: '#eab308',
          series: series.steamPerSugar,
          rightVal: rv('steamPerSugar'),
        }),
      ],
    },
    {
      id: 'power',
      title: 'Power',
      color: 'bg-[#ccffcc]',
      icon: 'power',
      kpis: [
        kpi('Power Gen (Units)', power.Total_Power_Gen, {
          rightVal: rv('powerGen'),
          chart: 'line',
          chartColor: '#22c55e',
          series: series.powerGen,
        }),
        kpi('Export (Units)', power.ExportGrid30, {
          rightVal: rv('powerExport'),
          chart: 'line',
          chartColor: '#22c55e',
          series: series.powerExport,
        }),
        kpi('Inhouse Consp (Units)', power.Total_Internal_Con, {
          chart: 'line',
          chartColor: '#22c55e',
          series: series.inhouse,
          rightVal: rv('inhouse'),
        }),
        kpi('Total Steam Gen (T)', steam.TotalSteamgen, {
          rightVal: rv('steamGen'),
          chart: 'line',
          chartColor: '#22c55e',
          series: series.steamGen,
        }),
        kpi('Total Steam to Sugar (T)', steam.TotalStmtoSugar, {
          chart: 'line',
          chartColor: '#22c55e',
          series: series.steamToSugar,
          rightVal: rv('steamToSugar'),
        }),
        kpi('Steam/Bag 150 TPH', steam.StmtoBaggase150, {
          rightVal: rv('steamBag150'),
          subValues: [
            { label: 'Steam/Bag 70 TPH', value: steam.StmtoBaggase70, rightVal: rv('steamBag70') },
            { label: 'Steam/Bag 35 TPH', value: steam.StmtoBaggase35, rightVal: rv('steamBag35') },
          ],
        }),
        kpi('Sp. Steam 30MW', power.SpecSteam30, {
          rightVal: rv('specSteam30'),
          subValues: [
            { label: 'Sp. Steam 3(O+N)', value: power.SpecSteam3ON, rightVal: rv('specSteam3ON') },
            { label: 'Sp. Steam 4MW', value: power.SpecSteam4, rightVal: rv('specSteam4') },
          ],
        }),
      ],
    },
    {
      id: 'distillery',
      title: 'Distillery',
      color: 'bg-[#f5c2d6]',
      icon: 'distillery',
      kpis: [
        kpi('Syrup+Mol Used (Q)', syrupMolUsed, {
          rightVal: rv('syrupMol'),
          chart: 'line',
          chartColor: '#9f1239',
          series: series.syrupMol,
        }),
        kpi('Ethanol Prod. (BL)', ethanolProd, {
          rightVal: rv('ethanol'),
          chart: 'line',
          chartColor: '#9f1239',
          series: series.ethanol,
        }),
        kpi('Recovery BL', recBl, {
          chart: 'line',
          chartColor: '#9f1239',
          series: series.recoveryBl,
          rightVal: rv('recoveryBl'),
        }),
        kpi('Ethanol Stored (BL)', ethStored, {
          chart: 'line',
          chartColor: '#9f1239',
          series: series.ethanolStored,
          rightVal: rv('ethanolStored'),
        }),
        kpi('B Mol in Store (Q)', bMolStore, {
          rightVal: rv('bMolStore'),
          subValues: [{ label: 'C Mol in Store (Q)', value: cMolStore, rightVal: rv('cMolStore') }],
        }),
        kpi('Distillation Eff.', distEff != null ? `${distEff.toFixed(2)}%` : null, {
          rightVal: rv('distEff'),
          subValues: [
            { label: 'Fermentation Eff.', value: fermEff != null ? `${fermEff.toFixed(2)}%` : null, rightVal: rv('fermEff') },
          ],
        }),
        kpi('TRS & FS %', trs, {
          stackedLabel: 'TRS %',
          rightVal: rv('trs'),
          chart: 'none',
          subValues: [{ label: 'FS %', value: fs, unit: '%', rightVal: rv('fs') }],
        }),
      ],
    },
  ];
}

module.exports = {
  n,
  nullableNum,
  sum,
  avg,
  safeDiv,
  effPercent,
  avgEffPercent,
  computePowerKpis,
  computeSteamKpis,
  buildRows,
  KPI_TITLE_TO_ID,
};
