/**
 * Run Purchy BI measures with no slicer filters and print values for Power BI parity checks.
 * Usage: cd backend && node scripts/validate-purchy-measures.js
 */
require('dotenv').config();
const { pool } = require('../config/mysql');
const growerPerformance = require('../services/purchy/growerPerformanceService');
const purchyDishonour = require('../services/purchy/purchyDishonourService');

async function tableCounts() {
  const tables = [
    'purchy_grower_summary',
    'purchy_indent',
    'purchy_supply',
    'purchy_dishonour',
    'purchy_field_staff',
  ];
  const counts = {};
  for (const t of tables) {
    // eslint-disable-next-line no-await-in-loop
    const [[row]] = await pool.query(`SELECT COUNT(*) AS n FROM ${t}`);
    counts[t] = Number(row.n);
  }
  return counts;
}

function fmt(n, pct = false) {
  if (n === null || n === undefined) return '—';
  if (pct) return `${(Number(n) * 100).toFixed(2)}%`;
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

async function main() {
  console.log('=== Purchy measure validation (no filters) ===\n');

  const counts = await tableCounts();
  console.log('Table row counts:');
  Object.entries(counts).forEach(([t, n]) => console.log(`  ${t}: ${n.toLocaleString()}`));
  console.log('');

  const summary = await growerPerformance.getSummary({});
  console.log('Page 1 — Grower Performance summary (years 2021–2025):');
  summary.forEach((row) => {
    console.log(`\n  Year ${row.year}:`);
    console.log(`    Ttl_Growers with Bond:     ${fmt(row.ttlGrowersWithBond)}`);
    console.log(`    # of Growers with Indent:  ${fmt(row.growersWithIndent)}`);
    console.log(`    # of Growers Supplied:     ${fmt(row.growersSupplied)}`);
    console.log(`    Ttl_Bond:                  ${fmt(row.ttlBond)}`);
    console.log(`    Supply Qty by Year:        ${fmt(row.supplyQtyByYear)}`);
    console.log(`    Supply vs Bond %:          ${fmt(row.supplyVsBondPct, true)}`);
    console.log(`    Issued Purchy (cnt):       ${fmt(row.issuedPurchyCnt)}`);
    console.log(`    Weighted Purchy (cnt):     ${fmt(row.weightedPurchyCnt)}`);
    console.log(`    Purchy Dishonour (cnt) %:  ${fmt(row.purchyDishonourCntPct, true)}`);
  });

  const kpis = await purchyDishonour.getKpis({});
  console.log('\nPage 2 — Purchy Dishonour KPIs:');
  console.log(`  Bonded_Growers:           ${fmt(kpis.bondedGrowers)}`);
  console.log(`  2025_Indent Count:        ${fmt(kpis.indentCount)}`);
  console.log(`  2025_Indent Qty:          ${fmt(kpis.indentQty)}`);
  console.log(`  2025_Supply Count:        ${fmt(kpis.supplyCount)}`);
  console.log(`  2025_Supply Qty:          ${fmt(kpis.supplyQty)}`);
  console.log(`  2025_Dishonour Count:     ${fmt(kpis.dishonourCount)}`);
  console.log(`  2025_Dishonour % (Count): ${fmt(kpis.dishonourPctCount, true)}`);
  console.log(`  2025_Dishonour Qty:       ${fmt(kpis.dishonourQty)}`);
  console.log(`  2025_Dishonour % (Qty):   ${fmt(kpis.dishonourPctQty, true)}`);

  console.log('\nCompare the above against Power BI screenshots (default slicers = All).');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
