/**
 * One business formula workbook per dashboard, in the same layout as
 * Cane-Performance-Dashboard-Formulas.xlsx.
 *
 * Does not rewrite the cane workbook.
 *
 * Usage (from DigiLog/backend):
 *   node scripts/generate-per-dashboard-formula-workbooks.js
 */
const path = require('path');
const { writeFormulaWorkbook } = require('./formula-sheets/writeWorkbook');

const specs = [
  require('./formula-sheets/managementDashboard'),
  require('./formula-sheets/brix'),
  require('./formula-sheets/centreMaturity'),
  require('./formula-sheets/milling'),
  require('./formula-sheets/power'),
  require('./formula-sheets/distillery'),
  require('./formula-sheets/purchy'),
];

const OUT_DIR = path.resolve(__dirname, '../../docs/bi');

async function main() {
  for (const spec of specs) {
    const outPath = path.join(OUT_DIR, spec.file);
    const counts = await writeFormulaWorkbook({ ...spec, outPath });
    const n = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(spec.file, n, 'metric rows', counts);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
