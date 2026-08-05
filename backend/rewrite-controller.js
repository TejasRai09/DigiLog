const fs = require('fs');
let code = fs.readFileSync('controllers/canePerformanceController.js', 'utf8');

// Replace the sequential awaits with Promise.all
let newCode = code.replace(
  /const request = pool\.request\(\);\s*\/\/\s*Default dates[^]*?\/\/ 1\. Fetch Mode-wise split/m,
  `const queryDB = (q) => {
        const req = pool.request();
        req.input('fromDate', sql.Date, from ? new Date(from) : new Date('2000-01-01'));
        req.input('toDate', sql.Date, to ? new Date(to) : new Date('2100-01-01'));
        return req.query(q);
      };
      
      // 1. Fetch Mode-wise split`
);

// We need to replace all `await request.query` and `await pool.request().input(...).input(...).query` with `queryDB`
newCode = newCode.replace(/await request\.query\(/g, 'queryDB(');

// Replace `await pool.request().input(...).input(...).query(` with `queryDB(`
newCode = newCode.replace(/await pool\.request\(\)[\s\n]*\.input\('[^]+?'\)[\s\n]*\.input\('[^]+?'\)[\s\n]*\.query\(/g, 'queryDB(');

// Now all those `const somethingResult = queryDB(` are returning promises. We need to await them!
// Actually, it's easier to just let them be promises, and then await them all at once.
// Wait, in JS, `const modePieResult = queryDB(...)` assigns a Promise.
// But further down we do `modePieResult.recordset`. That will fail if it's a promise!
// So we should do:
// const [modePieResult, trendResult, kpiResult, ...] = await Promise.all([
//   queryDB(...), queryDB(...)
// ]);
// This is getting complicated to regex.

fs.writeFileSync('controllers/canePerformanceController2.js', newCode);
