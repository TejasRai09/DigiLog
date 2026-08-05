const fs = require('fs');
let code = fs.readFileSync('controllers/canePerformanceController.js', 'utf8');

code = code.replace(/CAST\(\[Weighment Date \(Purchy\)\] AS DATE\) >= @fromDate/g, "[Weighment Date (Purchy)] >= @fromDate");
code = code.replace(/CAST\(\[Weighment Date \(Purchy\)\] AS DATE\) <= @toDate/g, "[Weighment Date (Purchy)] < DATEADD(day, 1, @toDate)");

code = code.replace(/CAST\(m_date AS DATE\) >= @fromDate/g, "m_date >= @fromDate");
code = code.replace(/CAST\(m_date AS DATE\) <= @toDate/g, "m_date < DATEADD(day, 1, @toDate)");

fs.writeFileSync('controllers/canePerformanceController.js', code);
console.log('Queries made sargable');
