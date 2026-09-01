const fs = require('fs');
let code = fs.readFileSync('controllers/canePerformanceController.js', 'utf8');

const promises = [
  'kpiPromise',
  'truckHoldPromise',
  'waCaneHoldPromise',
  'gateYardPromise',
  'gateMillPromise',
  'overrunPromise',
  'cntOverrunPromise'
];

let i = 0;
code = code.replace(/const\s+=\s*pool\.request\(\)/g, (match) => {
  return `const ${promises[i++]} = pool.request()`;
});

fs.writeFileSync('controllers/canePerformanceController.js', code);
console.log('Fixed syntax!');
