const XLSX = require('xlsx');
const path = require('path');

const sourceFile = 'c:\\vivek\\PLANT\\Turbine & Instrument Equipment life histroy 20-06-2026 - new.xlsx';
const wb = XLSX.readFile(sourceFile);

const itemsToFind = [
  "MILL UPS 1",
  "RAW HOUSE UPS 1",
  "REFINERY HOUSE UPS 1",
  "MILL UPS 2",
  "RAW HOUSE UPS 2",
  "REFINERY HOUSE UPS 2",
  "RAW PAN N.1 & CONDENSER",
  "REFINERY PAN 1 & PAN CONDENSER",
  "SEMI KESTNER-2500 M2",
  "MILL NO 2 STEAM TURBINE",
  "MILL NO 3 STEAM TURBINE"
];

console.log(`Searching across ${wb.SheetNames.length} sheets in ${path.basename(sourceFile)}:\n`);

itemsToFind.forEach((item) => {
  const matches = [];
  wb.SheetNames.forEach((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    rows.forEach((row, rowIdx) => {
      const rowStr = row.join(' ');
      if (rowStr.toLowerCase().includes(item.toLowerCase())) {
        matches.push({ sheetName, rowIdx: rowIdx + 1, snippet: rowStr.slice(0, 130) });
      }
    });
  });

  if (matches.length > 0) {
    console.log(`✅ '${item}' FOUND (${matches.length} matches):`);
    matches.slice(0, 3).forEach(m => {
      console.log(`   - Sheet '${m.sheetName}' Row ${m.rowIdx}: ${m.snippet}`);
    });
  } else {
    console.log(`❌ '${item}' NOT FOUND`);
  }
  console.log('----------------------------------------------------');
});
