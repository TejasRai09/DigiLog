import * as XLSX from 'xlsx';

function isPlaceholderValue(val) {
  const v = String(val || '').trim().toLowerCase();
  return v === '' || v.includes('[empty') || v.includes('[enter') || v.includes('double click');
}

export function downloadSpecTemplate(filename = 'Equipment_Specification_Asset_Template.xlsx') {
  const wb = XLSX.utils.book_new();

  const introData = [
    ['EQUIPMENT SPECIFICATION BLUEPRINT TEMPLATE - INSTRUCTIONS'],
    [],
    ['HOW TO FILL THIS SPREADSHEET:'],
    ['1. Use the Specifications sheet to edit your data rows.'],
    ['2. Column Discipline must match exactly: mechanical, civil, instrument, electrical'],
    ['3. Maximum 6 unique sub-groups per discipline.'],
    ['4. Specification Parameter and Value must both be filled to import a row.'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(introData), 'Instructions');

  const specHeaders = ['Discipline', 'Sub-group', 'Specification Parameter', 'Value'];
  const dummySpecs = [
    ['mechanical', 'Rotor & Frame', 'Frame Type', '400 Heavy Cast-Iron'],
    ['mechanical', 'Bearings', 'Rotor Bearing Assembly', 'DE- 6326C3 / NDE- 6326 M'],
    ['civil', 'Foundation Base', 'Concrete Grade', 'M30 Reinforced Concrete'],
    ['instrument', 'Cables & Signals', 'Control Cable', 'Armoured Copper Cable 4CX1.5 mm2'],
    ['electrical', 'Motor Ratings', 'Baseline Power Output', '500KW'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([specHeaders, ...dummySpecs]), 'Specifications');

  XLSX.writeFile(wb, filename);
}

/** @returns {{ specs: Array, subSections: Record<string, string[]> } | { error: string }} */
export function parseSpecWorkbook(arrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const sheetName = workbook.SheetNames.find((n) => n.toLowerCase() === 'specifications') || workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
  if (rows.length <= 1) return { error: 'The uploaded file does not contain valid data rows.' };

  const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const disciplineIdx = headers.indexOf('discipline');
  const subGroupIdx = headers.indexOf('sub-group');
  const parameterIdx = headers.indexOf('specification parameter');
  const valueIdx = headers.indexOf('value');

  if (disciplineIdx === -1 || subGroupIdx === -1 || parameterIdx === -1 || valueIdx === -1) {
    return { error: 'Spreadsheet headers do not match specification templates.' };
  }

  const validDisciplines = ['mechanical', 'civil', 'instrument', 'electrical'];
  const parsedSpecs = [];
  const parsedSubSections = { mechanical: [], civil: [], instrument: [], electrical: [] };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row?.length) continue;

    const dVal = String(row[disciplineIdx] || '').trim().toLowerCase();
    const sVal = String(row[subGroupIdx] || '').trim();
    const pVal = String(row[parameterIdx] || '').trim();
    const vVal = String(row[valueIdx] || '').trim();

    if (!dVal) continue;
    if (isPlaceholderValue(sVal) || isPlaceholderValue(pVal) || isPlaceholderValue(vVal)) continue;
    if (!validDisciplines.includes(dVal)) continue;

    if (!parsedSubSections[dVal].includes(sVal)) {
      if (parsedSubSections[dVal].length >= 6) continue;
      parsedSubSections[dVal].push(sVal);
    }

    parsedSpecs.push({
      id: `uploaded-${Date.now()}-${i}`,
      section: dVal,
      subSection: sVal,
      label: pVal,
      value: vVal,
    });
  }

  if (parsedSpecs.length === 0) {
    return { error: 'No valid specifications were found in the uploaded file.' };
  }

  return { specs: parsedSpecs, subSections: parsedSubSections };
}
