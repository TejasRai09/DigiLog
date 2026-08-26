const XLSX = require('xlsx');
const path = require('path');
const wb = XLSX.readFile(path.join(__dirname, '../backlog-data/mill data/migration files-24-08-26/yellow-instrument-turbine-equipment-history-260826.xlsx'));

const life = XLSX.utils.sheet_to_json(wb.Sheets['EQUIPMENT LIFE HISTORY CARD'], { defval: '' });
console.log('LIFE rows:', life.length);
console.log('Sample life row keys:', Object.keys(life[0] || {}));
const deptCounts = {};
life.forEach((r) => {
  const d = String(r.Department || '').trim().toUpperCase();
  deptCounts[d] = (deptCounts[d] || 0) + 1;
});
console.log('Department counts (life cards):', deptCounts);

const specs = XLSX.utils.sheet_to_json(wb.Sheets['EQUIPMENT SPECIFICATION'], { defval: '' });
console.log('\nSPEC rows:', specs.length);
console.log('Sample spec row keys:', Object.keys(specs[0] || {}));
const secCounts = {};
specs.forEach((r) => {
  const s = String(r.section || '').trim().toLowerCase();
  secCounts[s] = (secCounts[s] || 0) + 1;
});
console.log('section counts (specs):', secCounts);

// Show specs for the 5 turbine tags
const turbineTags = ['ZIL/SUG/01', 'ZIL/SUG/02', 'ZIL/SUG/03', 'ZIL/SUG/04', 'ZIL/SUG/05'];
turbineTags.forEach((tag) => {
  const rows = specs.filter((r) => String(r['EQUIPMENT TAG NO'] || '').trim() === tag);
  console.log(`\n${tag}: ${rows.length} spec rows`);
  rows.slice(0, 5).forEach((r) => console.log('  ', r.section, '|', r.sub_section, '|', r['Parameter label']));
});

// Show a sample non-turbine instrument card's specs
const instTag = life.find((r) => String(r.Department || '').toUpperCase() === 'INSTRUMENT')?.['EQUIPMENT TAG NO'];
console.log('\nSample instrument tag:', instTag);
const instSpecs = specs.filter((r) => String(r['EQUIPMENT TAG NO'] || '').trim() === instTag);
instSpecs.slice(0, 5).forEach((r) => console.log('  ', r.section, '|', r.sub_section, '|', r['Parameter label']));
