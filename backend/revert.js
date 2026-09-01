const fs = require('fs');
let code = fs.readFileSync('controllers/canePerformanceController.js', 'utf8');

const promises = [
  'modePie', 'trend', 'kpi', 'truckHold', 'waCaneHold', 'gateYard', 'gateMill', 'sidebar',
  'overrun', 'cntOverrun', 'procFlow', 'topCenters', 'bottomCenters', 'dbRows'
];

let i = 0;
code = code.replace(/const\s+=\s*await queryDB/g, () => {
  return `const ${promises[i++]}Result = await queryDB`;
});

// For any remaining `const  = await pool.request()`, if any (wait, I already replaced those earlier with fix-syntax.js and they became `kpiPromise` etc.)
// Oh wait, in the previous broken script `code.replace(/const (\w+)Promise = pool\.request\(\)/g, 'const $1Result = await pool.request()');` 
// I replaced `const xyzPromise = pool.request()` with `const  = await pool.request()`.

const poolPromises = [
  'kpi',
  'truckHold',
  'waCaneHold',
  'gateYard',
  'gateMill',
  'overrun',
  'cntOverrun'
];
let j = 0;
code = code.replace(/const\s+=\s*await pool\.request\(\)/g, () => {
  return `const ${poolPromises[j++]}Result = await pool.request()`;
});

// Since I broke the code, it's safer to just revert to the git version if it was tracked.
// But it's NOT tracked.
// Let me just restore the file completely from the backend's earlier state by doing this manually, or downloading a working backup.
fs.writeFileSync('controllers/canePerformanceController.js', code);
console.log('Fixed syntax again');
