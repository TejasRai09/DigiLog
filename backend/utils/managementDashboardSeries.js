/**
 * 7DMA and daily series for Management Dashboard (PBI-style: window ends PREVIOUSDAY(endDate)).
 */
const { effPercent } = require('./managementDashboardMeasures');

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateKey(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return String(d).slice(0, 10);
}

function buildDateRange(from, to) {
  const out = [];
  let cur = from;
  while (cur && to && cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function finiteNum(v) {
  if (v == null || v === '') return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

function pickNum(row, keys) {
  for (const k of keys) {
    const x = finiteNum(row[k]);
    if (x != null) return x;
  }
  return null;
}

function sumByDate(rows, dateField, valueField, agg = 'sum') {
  return mapByDate(rows, dateField, (r) => finiteNum(r[valueField]), agg);
}

function mapByDate(rows, dateField, getValue, agg = 'sum') {
  const map = new Map();
  for (const r of rows || []) {
    const k = dateKey(r[dateField]);
    if (!k) continue;
    const v = getValue(r);
    if (v == null) continue;
    if (agg === 'avg') {
      const prev = map.get(k) || { sum: 0, count: 0 };
      prev.sum += v;
      prev.count += 1;
      map.set(k, prev);
    } else {
      map.set(k, (map.get(k) || 0) + v);
    }
  }
  if (agg === 'avg') {
    const avgMap = new Map();
    for (const [k, { sum, count }] of map.entries()) {
      avgMap.set(k, count ? sum / count : null);
    }
    return avgMap;
  }
  return map;
}

function mapByDatePick(rows, keys, agg = 'sum') {
  return mapByDate(rows, 'Date', (r) => pickNum(r, keys), agg);
}

function mapByDateSumKeys(rows, keys) {
  return mapByDate(rows, 'Date', (r) => {
    let total = 0;
    let any = false;
    for (const k of keys) {
      const x = finiteNum(r[k]);
      if (x == null) continue;
      total += x;
      any = true;
    }
    return any ? total : null;
  }, 'sum');
}

/** Overlay values win when present; keep base for dates overlay does not cover. */
function overlayMap(base, overlay) {
  const out = new Map(base || []);
  for (const [k, v] of overlay || []) {
    if (v != null && Number.isFinite(v)) out.set(k, v);
  }
  return out;
}

function ratioMaps(numMap, denMap, scale = 1) {
  const out = new Map();
  for (const [k, den] of denMap || []) {
    if (den == null || den === 0 || !Number.isFinite(den)) continue;
    const num = numMap.get(k);
    if (num == null || !Number.isFinite(num)) continue;
    out.set(k, (num / den) * scale);
  }
  return out;
}

function compute7dmaFromDailyMap(dailyMap, endDate, window = 7) {
  if (!endDate || !dailyMap.size) return null;
  const anchor = addDays(endDate, -1);
  let total = 0;
  let days = 0;
  for (let i = 0; i < window; i += 1) {
    const d = addDays(anchor, -i);
    if (dailyMap.has(d)) {
      const v = dailyMap.get(d);
      if (v == null || !Number.isFinite(v)) continue;
      total += v;
      days += 1;
    }
  }
  if (days === 0) return null;
  return total / window;
}

function seriesFromDailyMap(dailyMap, from, to) {
  return buildDateRange(from, to)
    .filter((d) => dailyMap.has(d) && dailyMap.get(d) != null && Number.isFinite(dailyMap.get(d)))
    .map((d) => ({ date: d, dateFull: d, value: dailyMap.get(d) }));
}

function seriesFromKeyedMaps(from, to, keyedMaps) {
  const dates = buildDateRange(from, to);
  return dates
    .map((d) => {
      const row = { date: d, dateFull: d };
      let any = false;
      for (const [key, dailyMap] of Object.entries(keyedMaps)) {
        const v = dailyMap?.get(d);
        if (v == null || !Number.isFinite(v)) continue;
        row[key] = v;
        any = true;
      }
      return any ? row : null;
    })
    .filter(Boolean);
}

function dmrCrushDaily(dmrRows) {
  const totalCane = mapByDatePick(dmrRows, ['Total Cane']);
  if (totalCane.size) return totalCane;
  return mapByDateSumKeys(dmrRows, ['CANE CRUSHED [DS]', 'CANE CRUSHED [REF]']);
}

function dmrMixedJuiceDaily(dmrRows) {
  return mapByDate(dmrRows, 'Date', (r) => {
    const av = finiteNum(r['MIXED JUICE [AV]']);
    const cane =
      (finiteNum(r['CANE CRUSHED [DS]']) || 0) + (finiteNum(r['CANE CRUSHED [REF]']) || 0);
    if (av != null && cane) return (av / 100) * cane;
    return finiteNum(r['MIXED JUICE']);
  });
}

function dmrSugarOutputDaily(dmrRows) {
  return mapByDateSumKeys(dmrRows, ['SUGAR OUTPUT[DS]', 'SUGAR OUTPUT [REF]']);
}

function dmrSugarDaily(dmrRows) {
  const prod = mapByDateSumKeys(dmrRows, [
    'Total SUGAR PRODUCTION [DS]',
    'Total SUGAR PRODUCTION [DS] ',
    'Total SUGAR PRODUCTION [REF]',
    'Total SUGAR PRODUCTION [REF] ',
  ]);
  const output = mapByDateSumKeys(dmrRows, ['SUGAR OUTPUT[DS]', 'SUGAR OUTPUT [REF]', 'SUGAR BAG PLANT']);
  return overlayMap(output, prod);
}

function buildManagementSeries(payload, from, to, dma = 7) {
  const {
    indentRows = [],
    purchaseRows = [],
    opsRows = [],
    dsRows = [],
    powerRows = [],
    steamRows = [],
    distilleryRows = [],
    brixYardRows = [],
    brixFieldRows = [],
    dmrRows = [],
  } = payload;

  const indentDaily = sumByDate(indentRows, 'indent_date', 'indent_qty');
  const purchaseDaily = sumByDate(purchaseRows, 'purchase_date', 'purchase_qty');

  const opsCrushDaily = sumByDate(opsRows, 'Date', 'crush');
  const opsMixjDaily = mapByDate(
    opsRows,
    'Date',
    (r) => {
      const ds = finiteNum(r.mixj_ds) || 0;
      const rs = finiteNum(r.mixj_rs) || 0;
      return ds + rs;
    },
  );

  const crushDaily = overlayMap(opsCrushDaily, dmrCrushDaily(dmrRows));
  const mixjDaily = overlayMap(opsMixjDaily, dmrMixedJuiceDaily(dmrRows));
  const caneDsDaily = overlayMap(
    sumByDate(opsRows, 'Date', 'qty_dsl'),
    mapByDatePick(dmrRows, ['CANE CRUSHED [DS]']),
  );
  const caneRsDaily = overlayMap(
    sumByDate(opsRows, 'Date', 'qty_rsl'),
    mapByDatePick(dmrRows, ['CANE CRUSHED [REF]']),
  );
  const sugarTotalDaily = overlayMap(
    mapByDate(opsRows, 'Date', (r) => {
      const keys = ['qty_dsl', 'qty_dsm', 'qty_dss', 'qty_rsl', 'qty_rsm', 'qty_rss', 'qty_p20', 'qty_p30', 'qty_p40'];
      let t = 0;
      let any = false;
      for (const k of keys) {
        const x = finiteNum(r[k]);
        if (x == null) continue;
        t += x;
        any = true;
      }
      return any ? t : null;
    }),
    dmrSugarDaily(dmrRows),
  );
  const sugarDsDaily = overlayMap(
    mapByDate(opsRows, 'Date', (r) => {
      const keys = ['qty_dsl', 'qty_dsm', 'qty_dss'];
      let t = 0;
      let any = false;
      for (const k of keys) {
        const x = finiteNum(r[k]);
        if (x == null) continue;
        t += x;
        any = true;
      }
      return any ? t : null;
    }),
    overlayMap(
      mapByDatePick(dmrRows, ['SUGAR OUTPUT[DS]']),
      mapByDatePick(dmrRows, ['Total SUGAR PRODUCTION [DS]', 'Total SUGAR PRODUCTION [DS] ']),
    ),
  );
  const sugarRsDaily = overlayMap(
    mapByDate(opsRows, 'Date', (r) => {
      const keys = ['qty_rsl', 'qty_rsm', 'qty_rss'];
      let t = 0;
      let any = false;
      for (const k of keys) {
        const x = finiteNum(r[k]);
        if (x == null) continue;
        t += x;
        any = true;
      }
      return any ? t : null;
    }),
    overlayMap(
      mapByDatePick(dmrRows, ['SUGAR OUTPUT [REF]']),
      mapByDatePick(dmrRows, ['Total SUGAR PRODUCTION [REF]', 'Total SUGAR PRODUCTION [REF] ']),
    ),
  );

  const polDaily = overlayMap(
    sumByDate(dsRows, 'Date', 'PJ_Pol', 'avg'),
    mapByDatePick(dmrRows, ['Plant POL IN CANE DS'], 'avg'),
  );
  const macerationDaily = overlayMap(
    mapByDate(opsRows, 'Date', (r) => {
      const crush = finiteNum(r.crush);
      const imb = finiteNum(r.imb_wtr);
      if (crush == null || crush === 0 || imb == null) return null;
      return (imb / crush) * 100;
    }),
    mapByDatePick(dmrRows, ['MACERATION'], 'avg'),
  );
  const dmfDaily = mapByDatePick(dmrRows, ['DMF'], 'avg');
  const bagPolCaneDaily = mapByDatePick(dmrRows, ['Plant POL IN BAGASSE DS'], 'avg');
  const sugarRecoveryDaily = mapByDatePick(dmrRows, ['AV. RECOVERY%', 'RECOVERY [DS] %'], 'avg');
  const bagPolDaily = mapByDatePick(dmrRows, ['BAGASSE POL'], 'avg');
  const bagMoistureDaily = mapByDatePick(dmrRows, ['BAGASSE MOISTURE'], 'avg');
  const fCakePolDaily = mapByDatePick(dmrRows, ['Plant POL IN F CAKE DS'], 'avg');
  const molPolCaneDaily = mapByDatePick(dmrRows, ['Plant POL IN F MOL DS'], 'avg');
  const fMolPurityDsDaily = mapByDatePick(dmrRows, ['Purity B HEAVY Mol DS'], 'avg');
  const fMolPurityRsDaily = mapByDatePick(dmrRows, ['Purity C HEAVY MOL. Ref'], 'avg');
  const yardBalDaily = mapByDatePick(dmrRows, ['YARD BAL  8 AM'], 'avg');

  const brixYardDaily = sumByDate(brixYardRows, 'Date', 'MiddleBrix', 'avg');
  const brixFieldDaily = sumByDate(brixFieldRows, 'Date', 'MiddleBrix', 'avg');

  const powerGenDaily = mapByDate(powerRows, 'Date', (r) => {
    const v =
      (finiteNum(r.PowerGen30) || 0) +
      (finiteNum(r.PowerGen3New) || 0) +
      (finiteNum(r.PowerGen3Old) || 0) +
      (finiteNum(r.PowerGen4MW) || 0);
    return v;
  });
  const exportDaily = sumByDate(powerRows, 'Date', 'ExportGrid30');
  const inhouseDaily = mapByDate(powerRows, 'Date', (r) => {
    const gen =
      (finiteNum(r.PowerGen30) || 0) +
      (finiteNum(r.PowerGen3New) || 0) +
      (finiteNum(r.PowerGen3Old) || 0) +
      (finiteNum(r.PowerGen4MW) || 0);
    const exp = finiteNum(r.ExportGrid30) || 0;
    return gen - exp;
  });

  const steamGenDaily = mapByDate(steamRows, 'Date', (r) => {
    return (finiteNum(r.SteamGen150) || 0) + (finiteNum(r.SteamGen70) || 0) + (finiteNum(r.SteamGen35) || 0);
  });
  const steamToSugarDaily = mapByDate(steamRows, 'Date', (r) => {
    return (finiteNum(r.TotalStmtoSug150) || 0) + (finiteNum(r.TotalStmtoSug70) || 0);
  });

  const ethanolDaily = sumByDate(distilleryRows, 'Date', 'actual_ethanol_bl');
  const syrupDaily = sumByDate(distilleryRows, 'Date', 'syrup_molasses_qtls');
  const recoveryBlDaily = ratioMaps(ethanolDaily, syrupDaily);
  const ethanolStoredDaily = sumByDate(distilleryRows, 'Date', 'ethanol_storage_bl', 'avg');
  const trsDaily = sumByDate(distilleryRows, 'Date', 'trs', 'avg');
  const fsDaily = sumByDate(distilleryRows, 'Date', 'fs', 'avg');

  const sugarOutputDaily = overlayMap(sugarTotalDaily, dmrSugarOutputDaily(dmrRows));

  const millHouseDaily = sumByDate(powerRows, 'Date', 'PowerConMillHouse');
  const crushPowerDaily = sumByDate(powerRows, 'Date', 'Crush');
  const crushForRatio = overlayMap(crushDaily, crushPowerDaily);
  const sugarHouseDaily = mapByDate(powerRows, 'Date', (r) => {
    const raw = finiteNum(r.PowerConRaw_Ref) || 0;
    const ds = finiteNum(r.PowerConDSHouse) || 0;
    return raw + ds;
  });
  const millSteamKgDaily = mapByDate(steamRows, 'Date', (r) => {
    const mill = finiteNum(r.StmMillTurbine110_45ATAPRDS) || 0;
    const prds =
      (finiteNum(r.SteamGen70) || 0) -
      (finiteNum(r.StmCons3New70) || 0) -
      (finiteNum(r.StmCons3Old70) || 0);
    return (mill + prds) * 1000;
  });
  const steamSugKgDaily = mapByDate(steamRows, 'Date', (r) => {
    return ((finiteNum(r.TotalStmtoSug150) || 0) + (finiteNum(r.TotalStmtoSug70) || 0)) * 1000;
  });
  const steamBag150Daily = ratioMaps(sumByDate(steamRows, 'Date', 'SteamGen150'), sumByDate(steamRows, 'Date', 'Baggase150'));
  const steamBag70Daily = ratioMaps(sumByDate(steamRows, 'Date', 'SteamGen70'), sumByDate(steamRows, 'Date', 'Baggase70'));
  const steamBag35Daily = ratioMaps(
    sumByDate(steamRows, 'Date', 'SteamGen35'),
    mapByDate(steamRows, 'Date', (r) => (finiteNum(r.Baggase35) || 0) + (finiteNum(r.SlopCon) || 0)),
  );
  const specSteam30Daily = ratioMaps(sumByDate(steamRows, 'Date', 'SteamCon30MW'), sumByDate(powerRows, 'Date', 'PowerGen30'), 1000);
  const specSteam3ONDaily = ratioMaps(
    mapByDate(steamRows, 'Date', (r) => (finiteNum(r.StmCons3Old70) || 0) + (finiteNum(r.StmCons3New70) || 0)),
    mapByDate(powerRows, 'Date', (r) => (finiteNum(r.PowerGen3Old) || 0) + (finiteNum(r.PowerGen3New) || 0)),
    1000,
  );
  const specSteam4Daily = ratioMaps(sumByDate(steamRows, 'Date', 'StmCons4'), sumByDate(powerRows, 'Date', 'PowerGen4MW'), 1000);

  const powerPerCaneDaily = ratioMaps(millHouseDaily, crushForRatio);
  const steamPerCaneDaily = ratioMaps(millSteamKgDaily, crushForRatio);
  const powerPerSugarDaily = ratioMaps(sugarHouseDaily, sugarOutputDaily);
  const steamPerSugarDaily = ratioMaps(steamSugKgDaily, sugarOutputDaily);
  const bMolStoreDaily = sumByDate(distilleryRows, 'Date', 'total_bh_molasses_qtls', 'avg');
  const cMolStoreDaily = sumByDate(distilleryRows, 'Date', 'total_ch_molasses_qtls', 'avg');
  const distEffDaily = mapByDate(distilleryRows, 'Date', (r) => {
    if (r.de == null || r.de === '') return null;
    return effPercent(r.de);
  }, 'avg');
  const fermEffDaily = mapByDate(distilleryRows, 'Date', (r) => {
    if (r.fe == null || r.fe === '') return null;
    return effPercent(r.fe);
  }, 'avg');

  const endDate = to;
  const maps = {
    caneIndent: indentDaily,
    canePurchase: purchaseDaily,
    polInCane: polDaily,
    yardBal: yardBalDaily,
    brixYard: brixYardDaily,
    brixField: brixFieldDaily,
    crush: crushDaily,
    mixedJuice: mixjDaily,
    maceration: macerationDaily,
    dmf: dmfDaily,
    bagPolCane: bagPolCaneDaily,
    bagPol: bagPolDaily,
    bagMoisture: bagMoistureDaily,
    caneDs: caneDsDaily,
    caneRs: caneRsDaily,
    sugarTotal: sugarTotalDaily,
    sugarRecovery: sugarRecoveryDaily,
    fCakePol: fCakePolDaily,
    molPolCane: molPolCaneDaily,
    fMolPurityDs: fMolPurityDsDaily,
    fMolPurityRs: fMolPurityRsDaily,
    powerGen: powerGenDaily,
    powerExport: exportDaily,
    inhouse: inhouseDaily,
    steamGen: steamGenDaily,
    steamToSugar: steamToSugarDaily,
    steamBag150: steamBag150Daily,
    steamBag70: steamBag70Daily,
    steamBag35: steamBag35Daily,
    specSteam30: specSteam30Daily,
    specSteam3ON: specSteam3ONDaily,
    specSteam4: specSteam4Daily,
    ethanol: ethanolDaily,
    syrupMol: syrupDaily,
    recoveryBl: recoveryBlDaily,
    ethanolStored: ethanolStoredDaily,
    bMolStore: bMolStoreDaily,
    cMolStore: cMolStoreDaily,
    distEff: distEffDaily,
    fermEff: fermEffDaily,
    trs: trsDaily,
    fs: fsDaily,
    powerPerCane: powerPerCaneDaily,
    steamPerCane: steamPerCaneDaily,
    powerPerSugar: powerPerSugarDaily,
    steamPerSugar: steamPerSugarDaily,
  };

  const series = {};
  const rightVal7dma = {};
  for (const [key, dailyMap] of Object.entries(maps)) {
    series[key] = seriesFromDailyMap(dailyMap, from, to);
    rightVal7dma[key] = compute7dmaFromDailyMap(dailyMap, endDate, dma);
  }

  series.sugarTotal = seriesFromKeyedMaps(from, to, {
    value: sugarTotalDaily,
    valueDs: sugarDsDaily,
    valueRs: sugarRsDaily,
  });

  return { series, rightVal7dma };
}

module.exports = {
  addDays,
  dateKey,
  buildDateRange,
  sumByDate,
  compute7dmaFromDailyMap,
  seriesFromDailyMap,
  buildManagementSeries,
};
