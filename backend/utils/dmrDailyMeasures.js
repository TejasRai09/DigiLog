/** KPI helpers from flat dmr_daily rows — formulas from Management Dashboard-v1 DMR_SS24.tmdl */

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

function totalCaneRow(r) {
  const ds = n(r['CANE CRUSHED [DS]']);
  const rs = n(r['CANE CRUSHED [REF]']);
  const total = ds + rs;
  return total || n(r['Total Cane']);
}

function caneToSugarRow(r) {
  return totalCaneRow(r) - n(r['FOR SYRUP(CANE QTY)']);
}

function mixedJuiceCalRow(r) {
  const av = nullableNum(r['MIXED JUICE [AV]']);
  const cane = totalCaneRow(r);
  if (av != null && cane) return (av / 100) * cane;
  return nullableNum(r['MIXED JUICE']);
}

function sugarOutputRow(r) {
  return n(r['SUGAR OUTPUT[DS]']) + n(r['SUGAR OUTPUT [REF]']);
}

function sugarProdRow(r) {
  return (
    n(r['Total SUGAR PRODUCTION [DS]']) +
    n(r['Total SUGAR PRODUCTION [DS] ']) +
    n(r['Total SUGAR PRODUCTION [REF]']) +
    n(r['Total SUGAR PRODUCTION [REF] '])
  );
}

/** PBI: DIVIDE(SUMX(value * weight), SUM(weight)) */
function wavg(rows, getValue, getWeight) {
  let num = 0;
  let den = 0;
  for (const r of rows || []) {
    const v = nullableNum(typeof getValue === 'function' ? getValue(r) : r[getValue]);
    const w = getWeight(r);
    if (v == null || w == null || !Number.isFinite(w) || w === 0) continue;
    num += v * w;
    den += w;
  }
  return den ? num / den : null;
}

function computeDmrKpis(dmrRows) {
  const rows = dmrRows || [];
  const caneDs = sum(rows, 'CANE CRUSHED [DS]');
  const caneRs = sum(rows, 'CANE CRUSHED [REF]');
  const crush = caneDs + caneRs || sum(rows, 'Total Cane');

  let mixedJuice = 0;
  let sugarProd = 0;
  let sugarOut = 0;
  for (const r of rows) {
    mixedJuice += n(mixedJuiceCalRow(r));
    sugarProd += sugarProdRow(r);
    sugarOut += sugarOutputRow(r);
  }
  if (!sugarProd) sugarProd = sugarOut;

  const wtSugar = caneToSugarRow;

  return {
    yardBal: avg(rows, 'YARD BAL  8 AM'),
    polInCane: wavg(rows, 'Plant POL IN CANE DS', wtSugar) ?? avg(rows, 'Plant POL IN CANE DS'),
    maceration: wavg(rows, 'MACERATION', wtSugar) ?? avg(rows, 'MACERATION'),
    dmf: wavg(rows, 'DMF', wtSugar) ?? avg(rows, 'DMF'),
    mixedJuice,
    crush,
    caneDs,
    caneRs,
    sugarTotal: sugarProd,
    sugarOutput: sugarOut || sugarProd,
    sugarRecovery: wavg(rows, 'AV. RECOVERY%', wtSugar) ?? avg(rows, 'AV. RECOVERY%'),
    bagPolCane: wavg(rows, 'Plant POL IN BAGASSE DS', wtSugar) ?? avg(rows, 'Plant POL IN BAGASSE DS'),
    bagPol: wavg(rows, 'BAGASSE POL', wtSugar) ?? avg(rows, 'BAGASSE POL'),
    bagMoisture: wavg(rows, 'BAGASSE MOISTURE', wtSugar) ?? avg(rows, 'BAGASSE MOISTURE'),
    fCakePol: wavg(rows, 'Plant POL IN F CAKE DS', wtSugar) ?? avg(rows, 'Plant POL IN F CAKE DS'),
    molPolCane: wavg(rows, 'Plant POL IN F MOL DS', wtSugar) ?? avg(rows, 'Plant POL IN F MOL DS'),
    fMolPurityDs:
      wavg(rows, 'Purity B HEAVY Mol DS', (r) => n(r['CANE CRUSHED [DS]'])) ??
      avg(rows, 'Purity B HEAVY Mol DS'),
    fMolPurityRs:
      wavg(rows, 'Purity C HEAVY MOL. Ref', (r) => n(r['CANE CRUSHED [REF]'])) ??
      avg(rows, 'Purity C HEAVY MOL. Ref'),
  };
}

module.exports = {
  computeDmrKpis,
  sum,
  avg,
  n,
  nullableNum,
  totalCaneRow,
  caneToSugarRow,
  mixedJuiceCalRow,
  sugarOutputRow,
  sugarProdRow,
  wavg,
};
