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

function computePowerKpis(powerRows, steamRows = []) {
  const p = powerRows || [];
  const s = steamRows || [];

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
  const Total_Internal_Con = Export_Cogen + Export_Sugar + PowerCons_Dist_CPU_4MW;
  const ExportGrid30 = sum(p, 'ExportGrid30');
  const Crush = sum(p, 'Crush');

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
    Total_Internal_Con,
    Export_Cogen,
    Export_Sugar,
    SpecSteam30: safeDiv(sum(s, 'SteamCon30MW'), PowerGen30 / 1000),
    SpecSteam3Old: safeDiv(sum(s, 'StmCons3Old70'), PowerGen3Old / 1000),
    SpecSteam3New: safeDiv(sum(s, 'StmCons3New70'), PowerGen3New / 1000),
    SpecSteam4: safeDiv(sum(s, 'StmCons4'), PowerGen4MW / 1000),
    PowerPerCane: safeDiv(Total_Power_Gen, Crush),
  };
}

function computeSteamKpis(steamRows) {
  const s = steamRows || [];
  const StmtoDistill35TPH =
    sum(s, 'TotalStmdistil') - sum(s, 'StmDist70') - sum(s, 'StmtoDistil110_45ATAPRDS_o');
  const StmConsMillTB_PRDS =
    sum(s, 'SteamGen70') - sum(s, 'StmCons3New70') - sum(s, 'StmCons3Old70');
  const sugarToProcess =
    sum(s, 'TotalStmtoSug150') + sum(s, 'TotalStmtoSug70') + sum(s, 'StmtoSugDisti');

  return {
    TotalSteamgen: sum(s, 'SteamGen150') + sum(s, 'SteamGen70') + sum(s, 'SteamGen35'),
    TotalStmtoSugar: sugarToProcess,
    StmtoBaggase150: safeDiv(sum(s, 'SteamGen150'), sum(s, 'Baggase150')),
    StmtoBaggase70: safeDiv(sum(s, 'SteamGen70'), sum(s, 'Baggase70')),
    StmtoBaggase35: safeDiv(sum(s, 'SteamGen35'), sum(s, 'Baggase35') + sum(s, 'SlopCon')),
    SteamPerCane: safeDiv(
      sum(s, 'SteamGen150') + sum(s, 'SteamGen70') + sum(s, 'SteamGen35'),
      null
    ),
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

function kpi(title, value, extras = {}) {
  return { title, value, ...extras };
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
    series = {},
  } = payload;

  const power = computePowerKpis(powerRows, steamRows);
  const steam = computeSteamKpis(steamRows);

  const crushOps = avg(opsRows, 'crush');
  const crush = power.Crush > 0 ? power.Crush : crushOps;
  const mixedJuice = sum(opsRows, 'mixj_ds') + sum(opsRows, 'mixj_rs');
  const maceration = safeDiv(avg(opsRows, 'imb_wtr'), crushOps) != null
    ? safeDiv(avg(opsRows, 'imb_wtr'), crushOps) * 100
    : null;

  const bagPol = avg(dsRows, 'Bag_Pol');
  const bagMoisture = avg(dsRows, 'Bag_Moisture');
  const bagPolCane = safeDiv(bagPol, crushOps) != null ? safeDiv(bagPol, crushOps) * 100 : null;

  const sugarDs = sugarDsFromOps(opsRows);
  const sugarRs = sugarRsFromOps(opsRows);
  const sugarTotal = sugarTotalFromOps(opsRows);
  const sugarRecovery = safeDiv(sugarTotal, crush) != null ? safeDiv(sugarTotal, crush) * 100 : null;

  const fMolPolDs = avg(dsRows, 'FMol_Pol');
  const fMolBrixDs = avg(dsRows, 'FMol_Brix');
  const fMolPurityDs = safeDiv(fMolPolDs, fMolBrixDs) != null ? safeDiv(fMolPolDs, fMolBrixDs) * 100 : null;
  const fMolPolRs = avg(rsRows, 'FMol_Pol');
  const fMolBrixRs = avg(rsRows, 'FMol_Brix');
  const fMolPurityRs = safeDiv(fMolPolRs, fMolBrixRs) != null ? safeDiv(fMolPolRs, fMolBrixRs) * 100 : null;
  const fCakePol = avg(dsRows, 'FCake_Pol');
  const molPolCane = safeDiv(fMolPolDs, crushOps) != null ? safeDiv(fMolPolDs, crushOps) * 100 : null;

  const dist = distilleryRows || [];
  const syrupMolUsed = sum(dist, 'syrup_molasses_qtls');
  const ethanolProd = sum(dist, 'actual_ethanol_bl');
  const recBl = avg(dist, 'rec_bl') || safeDiv(ethanolProd, syrupMolUsed);
  const ethStored = avg(dist, 'ethanol_storage_bl');
  const bMolStore = avg(dist, 'total_bh_molasses_qtls');
  const cMolStore = avg(dist, 'total_ch_molasses_qtls');
  const distEff = avg(dist, 'de') != null ? effPercent(avg(dist, 'de')) : null;
  const fermEff = avg(dist, 'fe') != null ? effPercent(avg(dist, 'fe')) : null;
  const trs = avg(dist, 'trs');
  const fs = avg(dist, 'fs');

  const steamPerCane = safeDiv(steam.TotalSteamgen, crush);
  const powerPerSugar = safeDiv(power.Total_Power_Gen, sugarTotal);
  const steamPerSugar = safeDiv(steam.TotalSteamgen, sugarTotal);

  return [
    {
      id: 'cane',
      title: 'Cane',
      color: 'bg-[#cce0ff]',
      icon: 'cane',
      kpis: [
        kpi('Cane Indent (Q)', caneIndent, { chart: 'line', chartColor: '#3b82f6', series: series.caneIndent }),
        kpi('Cane Purchase (Q)', canePurchase, { chart: 'bar', chartColor: '#3b82f6', series: series.canePurchase }),
        kpi('Yard Bal. (8AM)', yardBal, {
          subValues: [
            { label: 'Overrun Gate', value: overrunGatePct, unit: '%' },
            { label: 'Overrun Center', value: overrunCenterPct, unit: '%', rightVal: overrunCenterQty },
          ],
        }),
        kpi('Pol in Cane %', polInCane, { chart: 'line', chartColor: '#3b82f6', series: series.polInCane }),
        kpi('Middle Brix % Yard', brixYard, { chart: 'bar', chartColor: '#3b82f6', series: series.brixYard }),
        kpi('Middle Brix % Field', brixField, { chart: 'line', chartColor: '#3b82f6', series: series.brixField }),
      ],
    },
    {
      id: 'milling',
      title: 'Milling',
      color: 'bg-[#f5cbb3]',
      icon: 'milling',
      kpis: [
        kpi('Cane Crush (Q)', crush, { chart: 'line', chartColor: '#ea580c', series: series.crush }),
        kpi('Masceration %', maceration, { chart: 'line', chartColor: '#ea580c' }),
        kpi('Mixed Juice (Q)', mixedJuice, { chart: 'line', chartColor: '#ea580c', series: series.mixedJuice }),
        kpi('DMF %', null, { chart: 'line', chartColor: '#ea580c' }),
        kpi('Bag Pol % Cane', bagPolCane, {
          rightVal: null,
          subValues: [
            { label: 'Pol % Bagasse', value: bagPol },
            { label: 'Bagasse Moisture', value: bagMoisture },
          ],
          chart: 'line',
          chartColor: '#ea580c',
        }),
        kpi('Power/Cane (Unit/Q)', power.PowerPerCane, { chart: 'line', chartColor: '#ea580c', series: series.powerPerCane }),
        kpi('Steam/Cane (T/Q)', steamPerCane, { chart: 'line', chartColor: '#ea580c', series: series.steamPerCane }),
      ],
    },
    {
      id: 'sugar',
      title: 'Sugar',
      color: 'bg-[#fef0b3]',
      icon: 'sugar',
      kpis: [
        kpi('Cane DS (Q)', sugarDs, { chart: 'line', chartColor: '#eab308' }),
        kpi('Cane RS (Q)', sugarRs, { chart: 'line', chartColor: '#eab308' }),
        kpi('Sugar Total (Q)', sugarTotal, { chart: 'bar', chartColor: '#ca8a04', series: series.sugarTotal }),
        kpi('Sugar Recovery %', sugarRecovery, { chart: 'line', chartColor: '#eab308' }),
        kpi('Pol In F Cake', fCakePol, {
          subValues: [
            { label: 'Mol Pol % Cane', value: molPolCane },
            { label: 'F Mol Purity (DS)', value: fMolPurityDs },
            { label: 'F Mol Purity (RS)', value: fMolPurityRs },
          ],
        }),
        kpi('Power/Sugar (Units/Q)', powerPerSugar, { chart: 'line', chartColor: '#eab308' }),
        kpi('Steam/Sugar (T/Q)', steamPerSugar, { chart: 'line', chartColor: '#eab308' }),
      ],
    },
    {
      id: 'power',
      title: 'Power',
      color: 'bg-[#ccffcc]',
      icon: 'power',
      kpis: [
        kpi('Power Gen (Units)', power.Total_Power_Gen, { chart: 'line', chartColor: '#22c55e', series: series.powerGen }),
        kpi('Export (Units)', power.ExportGrid30, { chart: 'line', chartColor: '#22c55e', series: series.powerExport }),
        kpi('Inhouse Consp (Units)', power.Total_Internal_Con, { chart: 'line', chartColor: '#22c55e' }),
        kpi('Total Steam Gen (T)', steam.TotalSteamgen, { chart: 'line', chartColor: '#22c55e', series: series.steamGen }),
        kpi('Total Steam to Sugar (T)', steam.TotalStmtoSugar, { chart: 'line', chartColor: '#22c55e' }),
        kpi('Steam/Bag 150 TPH', steam.StmtoBaggase150, {
          subValues: [
            { label: 'Steam/Bag 70 TPH', value: steam.StmtoBaggase70 },
            { label: 'Steam/Bag 35 TPH', value: steam.StmtoBaggase35 },
          ],
        }),
        kpi('Sp. Steam 30MW', power.SpecSteam30, {
          subValues: [
            { label: 'Sp. Steam 3 Old', value: power.SpecSteam3Old },
            { label: 'Sp. Steam 3 New', value: power.SpecSteam3New },
            { label: 'Sp. Steam 4MW', value: power.SpecSteam4 },
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
        kpi('Syrup+Mol Used (Q)', syrupMolUsed, { chart: 'line', chartColor: '#9f1239', series: series.syrupMol }),
        kpi('Ethanol Prod. (BL)', ethanolProd, { chart: 'line', chartColor: '#9f1239', series: series.ethanol }),
        kpi('Recovery BL', recBl, { chart: 'line', chartColor: '#9f1239' }),
        kpi('Ethanol Stored (BL)', ethStored, { chart: 'line', chartColor: '#9f1239' }),
        kpi('B Mol in Store (Q)', bMolStore, { subValues: [{ label: 'C Mol in Store (Q)', value: cMolStore }] }),
        kpi('Distillation Eff.', distEff != null ? `${distEff.toFixed(2)}%` : null, {
          subValues: [{ label: 'Fermentation Eff.', value: fermEff != null ? `${fermEff.toFixed(2)}%` : null }],
        }),
        kpi('TRS & FS %', trs, { rightVal: fs, chart: 'line', chartColor: '#9f1239' }),
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
  computePowerKpis,
  computeSteamKpis,
  buildRows,
};
