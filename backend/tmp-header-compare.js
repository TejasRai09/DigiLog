const ExcelJS = require('exceljs');

const FILES = [
  { label: 'FY25-26', path: 'C:/vivek/PLANT/FY 25-26/Grower Details Season 2025-2026.xlsx' },
  { label: 'FY26-27', path: 'C:/vivek/PLANT/FY 26-27/Grower Details Season 2026-2027.xlsx' },
];

function cellStr(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.result != null) return String(v.result);
    if (v.text != null) return String(v.text);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
  }
  return String(v);
}

(async () => {
  const byFile = {};
  for (const f of FILES) {
    const sheets = [];
    const reader = new ExcelJS.stream.xlsx.WorkbookReader(f.path, {
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      worksheets: 'emit',
      styles: 'ignore',
    });
    for await (const ws of reader) {
      let headers = [];
      let n = 0;
      for await (const row of ws) {
        n += 1;
        if (n === 1) {
          const maxCol = row.cellCount || (row.values ? row.values.length - 1 : 0);
          for (let c = 1; c <= maxCol; c += 1) {
            const raw = row.getCell(c).value;
            headers.push(cellStr(raw).trim());
          }
          while (headers.length && headers[headers.length - 1] === '') headers.pop();
        }
        if (n >= 1) break;
      }
      sheets.push({ name: ws.name, headers });
    }
    byFile[f.label] = sheets;
    console.log('\n====', f.label, '====');
    for (const s of sheets) {
      console.log('\nSHEET:', JSON.stringify(s.name), 'cols:', s.headers.length);
      console.log(s.headers.join(' | '));
    }
  }

  const a = byFile['FY25-26'];
  const b = byFile['FY26-27'];
  console.log('\n==== DIFF BY SHEET NAME ====');
  const namesA = a.map((s) => s.name);
  const namesB = b.map((s) => s.name);
  console.log('25-26 sheets', namesA);
  console.log('26-27 sheets', namesB);

  for (const sA of a) {
    const sB = b.find((s) => s.name === sA.name);
    if (!sB) {
      console.log('\nMISSING IN 26-27:', JSON.stringify(sA.name));
      continue;
    }
    const setA = new Set(sA.headers);
    const setB = new Set(sB.headers);
    const onlyA = sA.headers.filter((h) => !setB.has(h));
    const onlyB = sB.headers.filter((h) => !setA.has(h));
    console.log('\nSHEET', JSON.stringify(sA.name));
    console.log('  only in 25-26:', onlyA);
    console.log('  only in 26-27:', onlyB);
    console.log('  same count', sA.headers.filter((h) => setB.has(h)).length);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
