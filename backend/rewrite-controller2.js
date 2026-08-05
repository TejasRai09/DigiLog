const fs = require('fs');
let code = fs.readFileSync('controllers/canePerformanceController.js', 'utf8');

// Find the start of the block
const startIndex = code.indexOf('const request = pool.request();');
const endIndex = code.indexOf('res.json({');

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find block');
  process.exit(1);
}

let block = code.substring(startIndex, endIndex);

// Replace the setup
block = block.replace(/const request = pool\.request\(\);\s*\/\/\s*Default dates[^]*?\/\/ 1\. Fetch Mode-wise split/, 
`const queryDB = (q) => {
        const req = pool.request();
        req.input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'));
        req.input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'));
        return req.query(q);
      };

      // 1. Fetch Mode-wise split`);

// Replace all query calls to use queryDB and change variables from Result to Promise
block = block.replace(/const (\w+)Result = await request\.query\(/g, 'const $1Promise = queryDB(');
block = block.replace(/const (\w+)Result = await pool\.request\(\)[\s\n]*\.input\('[^]+?'\)[\s\n]*\.input\('[^]+?'\)[\s\n]*\.query\(/g, 'const $1Promise = queryDB(');

// Now we need to add the Promise.all resolution at the end of the block
const promiseResolution = `
      const [
        modePieResult, trendResult, kpiResult, truckHoldResult, waCaneHoldResult,
        gateYardResult, gateMillResult, sidebarResult, overrunResult, cntOverrunResult,
        procFlowResult, topCentersResult, bottomCentersResult, dbRowsResult
      ] = await Promise.all([
        modePiePromise, trendPromise, kpiPromise, truckHoldPromise, waCaneHoldPromise,
        gateYardPromise, gateMillPromise, sidebarPromise, overrunPromise, cntOverrunPromise,
        procFlowPromise, topCentersPromise, bottomCentersPromise, dbRowsPromise
      ]);

      `;

block = block + promiseResolution;

let newCode = code.substring(0, startIndex) + block + code.substring(endIndex);

fs.writeFileSync('controllers/canePerformanceController.js', newCode);
console.log('Done!');
