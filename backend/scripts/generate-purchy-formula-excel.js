/**
 * Generate Purchy BI Formula Reference Excel from SemanticModel + Report TMDL/JSON.
 *
 * Usage:
 *   cd backend
 *   node scripts/generate-purchy-formula-excel.js
 *   node scripts/generate-purchy-formula-excel.js --out ../docs/purchy-bi/Purchy-BI-Formulas-Reference.xlsx
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SEMANTIC = path.join(ROOT, 'Purchy Analysis Dashboard_v9.SemanticModel', 'definition');
const REPORT = path.join(ROOT, 'Purchy Analysis Dashboard_v9.Report', 'definition');

/** Hand-crafted DAX → Excel for core Purchy measures (verified against TMDL). */
const EXCEL_MEASURE_MAP = {
  Bonded_Growers: "COUNTA('Grower Summary'!A:A)-1  /* or COUNTIFS on grower key */",
  '2025_Indent Count': "COUNTIFS('Purchy Indent'!A:A,\"<>\")  /* rows linked to summary grower_key */",
  '2025_Indent Qty': "SUM('Purchy Indent'!M:M)  /* supllymodeqty */",
  '2025_Supply Count': "COUNTA('Purchy Supply'!A:A)-1",
  '2025_Supply Qty': "SUM('Purchy Supply'!Y:Y)  /* purchasemodeqty */",
  '2025_Dishonour Count': "COUNTA('Purchy Dishonour'!A:A)-1  /* via indent join */",
  '2025_Dishonour Qty': "SUM('Purchy Dishonour'!N:N)  /* mode_qty */",
  '2025_Dishonour % (Count)': "=IF(H2=0,\"\",G2/H2)  /* dishonour count / indent count */",
  '2025_Dishonour % (Qty)': "=IF(J2=0,\"\",I2/J2)  /* dishonour qty / indent qty */",
  Ttl_Bond: "See Year Matrix sheet — SUM of year-specific bond column",
  'Supply Qty by Year': "See Year Matrix — SUM supply column or 2025_Supply Qty",
  'Supply vs Bond %': "=IF(Ttl_Bond=0,\"\",Supply_Qty/Ttl_Bond)",
  'Issued Purchy (cnt)': "See Year Matrix — SUM issue## or 2025_Indent Count",
  'Weighted Purchy (cnt)': "See Year Matrix — SUM wt## or 2025_Supply Count",
  'Purchy Dishonour (cnt) %': "=(Issued-Weighted)/Issued",
  'Ttl_Growers with Bond': "COUNTIFS(bond_col,\">0\") per year",
  '# of Growers with Indent': "COUNTIFS(indent_col,\">0\") per year",
  '# of Growers Supplied': "COUNTIFS(supply_col,\">0\") per year",
  'Failure % by Date': "=IF(Total_Purchy=0,0,Failed_Purchy/Total_Purchy)",
  'Dishonour % (Qty)': "=IF(Indent_Qty=0,0,Dishonour_Qty/Indent_Qty)",
};

const CALC_COLUMN_EXCEL = [
  {
    table: 'Grower_Summary_Sheet',
    column: 'Grower_Key',
    dax: '[Village Code] & "-" & [Grower Code]',
    excel: "=A2&\"-\"&B2",
    note: 'Col A=Village Code, B=Grower Code',
  },
  {
    table: 'Grower_Summary_Sheet',
    column: 'Grower_name_Key',
    dax: '[Village Code] & "-" & [Grower Code] & "-" & [Grower Name]',
    excel: '=A2&"-"&B2&"-"&C2',
    note: 'C=Grower Name',
  },
  {
    table: 'Grower_Summary_Sheet',
    column: 'Village_name_Key',
    dax: '[Village Code] & "-" & [Village Name]',
    excel: '=A2&"-"&E2',
    note: 'E=Village Name',
  },
  {
    table: 'Grower_Summary_Sheet',
    column: "Loyalty_Slicer ('20-'24)",
    dax: 'Years supplied 2020-2024 → bucket 0-5',
    excel: '=IF(SUM((W2>0)*1,(X2>0)*1,(Y2>0)*1,(Z2>0)*1,(AA2>0)*1)=5,"5. Supplied 5 years",IF(...))',
    note: 'W-AA = Supply 2020..2024; use nested IF or lookup table on Loyalty Lookup sheet',
  },
  {
    table: 'Grower_Summary_Sheet',
    column: 'Dishonour_Bucket',
    dax: 'Indent Failer QTY / Indent QTY bands',
    excel: '=IF(R2=0,"No Indent",IF(S2/R2=0,"0% - No Failure",IF(S2/R2<=0.2,"1-20% Failure",IF(S2/R2<=0.4,"21-40% Failure",IF(S2/R2<=0.6,"41-60% Failure",IF(S2/R2<=0.8,"61-80% Failure",IF(S2/R2<1,"81-99% Failure","100% Failure")))))))',
    note: 'R=Indent QTY, S=Indent Failer QTY',
  },
  {
    table: 'Grower_Summary_Sheet',
    column: 'Last_Year_Performance',
    dax: 'Supply 2024 / bond2024 ratio bands',
    excel: '=IF(AH2=0,"No Bonding",IF(AA2/AH2>=0.8,"Good (>=80%)",IF(AA2/AH2>=0.5,"Average (50-79%)",IF(AA2/AH2>0,"Poor (<50%)","No Supply"))))',
    note: 'AA=Supply 2024, AH=bond2024',
  },
  {
    table: 'Grower_Summary_Sheet',
    column: 'This_Year_Performance',
    dax: 'Indent failure % bands',
    excel: '=IF(R2=0,"No Indent",IF(S2/R2=0,"Good (0% Failure)",IF(S2/R2<=0.2,"Average (1-20% Failure)","Poor (>20% Failure)")))',
  },
  {
    table: 'Grower_Summary_Sheet',
    column: 'YoY_Trend',
    dax: 'Last year good vs this year good',
    excel: 'Complex — see DAX in Calc Columns sheet',
  },
  {
    table: 'Grower_Purchywise_Indent',
    column: 'Grower_Key',
    dax: 'Villagecode & "-" & Growercode',
    excel: '=A2&"-"&B2',
  },
  {
    table: 'Years',
    column: 'Year',
    dax: 'DATATABLE 2020-2025',
    excel: 'Static list on Years sheet',
  },
];

function readText(p) {
  return fs.readFileSync(p, 'utf8');
}

function parseMeasuresFromTmdl(content) {
  const measures = [];
  const lines = content.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^\tmeasure '([^']+)'\s*=\s*(.*)$/);
    const m2 = lines[i].match(/^\tmeasure ([^\s=]+)\s*=\s*(.*)$/);
    const hit = m || m2;
    if (hit) {
      const name = hit[1];
      let dax = hit[2].trim();
      if (dax === '```') {
        i += 1;
        const parts = [];
        while (i < lines.length && !lines[i].includes('```')) {
          parts.push(lines[i]);
          i += 1;
        }
        dax = parts.join('\n').trim();
      }
      measures.push({ name, dax, table: '_Measures' });
    }
    i += 1;
  }
  return measures;
}

function parseCalcColumnsFromTmdl(content, tableName) {
  const cols = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\tcolumn ([^\t\n=]+)\s*=\s*(.+)$/);
    if (m && !m[1].includes('dataType') && m[2].trim() && !m[2].startsWith('lineageTag')) {
      const name = m[1].trim();
      let dax = m[2].trim();
      if (dax.startsWith('```')) continue;
      if (dax.includes('sourceColumn:')) continue;
      cols.push({ table: tableName, column: name, dax });
    }
  }
  return cols;
}

function parseRelationships(content) {
  const rels = [];
  const blocks = content.split(/^relationship /m).slice(1);
  blocks.forEach((block) => {
    const fromM = block.match(/fromColumn:\s*(.+)/);
    const toM = block.match(/toColumn:\s*(.+)/);
    const crossM = block.match(/crossFilteringBehavior:\s*(.+)/);
    if (fromM && toM) {
      rels.push({
        from: fromM[1].trim(),
        to: toM[1].trim(),
        crossFilter: crossM ? crossM[1].trim() : 'single',
      });
    }
  });
  return rels;
}

function loadReportPages() {
  const pagesDir = path.join(REPORT, 'pages');
  if (!fs.existsSync(pagesDir)) return [];
  return fs.readdirSync(pagesDir)
    .map((id) => {
      const pj = path.join(pagesDir, id, 'page.json');
      if (!fs.existsSync(pj)) return null;
      try {
        const j = JSON.parse(readText(pj));
        return { id, name: j.displayName || j.name || id };
      } catch {
        return { id, name: id };
      }
    })
    .filter(Boolean);
}

function extractFieldFromProjection(proj) {
  const f = proj.field;
  if (!f) return proj.queryRef || proj.nativeQueryRef || '';
  if (f.Measure) {
    const ent = f.Measure.Expression?.SourceRef?.Entity || '_Measures';
    const prop = f.Measure.Property || '';
    return `[Measure] ${ent}.${prop}`;
  }
  if (f.Column) {
    const ent = f.Column.Expression?.SourceRef?.Entity || '';
    const prop = f.Column.Property || '';
    return `[Column] ${ent}.${prop}`;
  }
  if (f.Aggregation) {
    const col = f.Aggregation.Expression?.Column;
    const ent = col?.Expression?.SourceRef?.Entity || '';
    const prop = col?.Property || '';
    const fn = f.Aggregation.Function === 0 ? 'SUM' : f.Aggregation.Function === 5 ? 'COUNT' : 'AGG';
    return `[${fn}] ${ent}.${prop}`;
  }
  if (f.HierarchyLevel) {
    const ent = f.HierarchyLevel.Expression?.Hierarchy?.Expression?.SourceRef?.Entity || '';
    const prop = f.HierarchyLevel.Property || '';
    return `[Hierarchy] ${ent}.${prop}`;
  }
  return proj.displayName || proj.queryRef || proj.nativeQueryRef || JSON.stringify(f).slice(0, 80);
}

function loadReportVisuals(pageMap) {
  const pagesDir = path.join(REPORT, 'pages');
  if (!fs.existsSync(pagesDir)) return [];
  const rows = [];
  fs.readdirSync(pagesDir).forEach((pageId) => {
    const pageName = pageMap.get(pageId) || pageId;
    const visualsDir = path.join(pagesDir, pageId, 'visuals');
    if (!fs.existsSync(visualsDir)) return;
    fs.readdirSync(visualsDir).forEach((vid) => {
      const vj = path.join(visualsDir, vid, 'visual.json');
      if (!fs.existsSync(vj)) return;
      try {
        const j = JSON.parse(readText(vj));
        const vType = j.visual?.visualType || 'unknown';
        const qs = j.visual?.query?.queryState || {};
        const fields = [];
        Object.keys(qs).forEach((role) => {
          (qs[role].projections || []).forEach((p) => {
            fields.push(`${role}: ${extractFieldFromProjection(p)}`);
          });
        });
        if (fields.length === 0 && vType !== 'textbox' && vType !== 'actionButton') {
          fields.push('(no query fields — static or button)');
        }
        rows.push({
          Page: pageName,
          'Visual Type': vType,
          'Visual ID': j.name || vid,
          Fields: fields.join(' | ') || '(static text / decoration)',
        });
      } catch {
        rows.push({ Page: pageName, 'Visual Type': 'parse-error', 'Visual ID': vid, Fields: '' });
      }
    });
  });
  return rows;
}

function daxToExcelHint(name, dax) {
  if (EXCEL_MEASURE_MAP[name]) return EXCEL_MEASURE_MAP[name];
  const d = dax.replace(/\s+/g, ' ').trim();
  if (/^SUM\(/i.test(d)) return `=SUM(...) /* ${d.slice(0, 80)} */`;
  if (/^COUNTROWS\(/i.test(d)) return `=COUNTA(...) or COUNTIFS(...) /* filter logic in DAX */`;
  if (/^DIVIDE\(/i.test(d)) {
    const inner = d.match(/DIVIDE\s*\(\s*\[([^\]]+)\]\s*,\s*\[([^\]]+)\]/i);
    if (inner) return `=IF(${inner[2]}=0,BLANK(),${inner[1]}/${inner[2]})`;
    return '=IF(denominator=0,0,numerator/denominator)';
  }
  if (/SELECTEDVALUE\s*\(\s*Years\[Year\]/i.test(d)) return 'Uses year slicer — see Year Matrix sheet row for each year';
  if (/SWITCH/i.test(d) && /Years\[Year\]/i.test(d)) return 'Year-dependent SWITCH — map each year to column on Year Matrix sheet';
  if (/FILTER/i.test(d)) return 'Use COUNTIFS/SUMIFS with filter criteria matching DAX FILTER';
  if (/CALCULATE/i.test(d)) return 'Apply filters via SUMIFS/COUNTIFS criteria ranges';
  if (/RELATED/i.test(d)) return 'Requires VLOOKUP/XLOOKUP on relationship key (grower_key / societypurchy_no)';
  if (/RANKX/i.test(d)) return '=RANK.EQ(value, range, 0) with DENSE option approximated';
  return 'See DAX column — complex measure; replicate with pivot tables or Power Query';
}

function sheetFromRows(name, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  return { name, ws };
}

function buildYearMatrixSheet() {
  const headers = [
    'Year', 'YearOrder', 'Bond Column', 'Ttl_Bond Formula', 'Supply Column', 'Supply Qty Formula',
    'Issue Column', 'Issued Purchy Formula', 'Wt Column', 'Weighted Purchy Formula',
    'Bond>0 Column', 'Ttl Growers w Bond', 'Indent Grower Col', 'Growers w Indent',
    'Supplied Col', 'Growers Supplied', 'Supply vs Bond %', 'Purchy Dishonour cnt %',
  ];
  const data = [
    ['2020', 1, '—', 'N/A (hidden in report)', 'Supply 2020', "=SUM('Grower Summary'!W:W)", '—', '—', '—', '—', 'Supply 2020', "=COUNTIFS('Grower Summary'!W:W,\">0\")", '—', '—', 'Supply 2020', "=COUNTIFS('Grower Summary'!W:W,\">0\")", '', ''],
    ['2021', 2, 'bond2021', "=SUM('Grower Summary'!AI:AI)", 'Supply 2021', "=SUM('Grower Summary'!X:X)", 'issue21', "=SUM('Grower Summary'!AJ:AJ)", 'wt21', "=SUM('Grower Summary'!AM:AM)", 'bond2021', "=COUNTIFS('Grower Summary'!AI:AI,\">0\")", 'issue21', "=COUNTIFS('Grower Summary'!AJ:AJ,\">0\")", 'Supply 2021', "=COUNTIFS('Grower Summary'!X:X,\">0\")", '=IF(D2=0,"",F2/D2)', '=(H2-J2)/H2'],
    ['2022', 3, 'bond2022', "=SUM('Grower Summary'!AF:AF)", 'Supply 2022', "=SUM('Grower Summary'!Y:Y)", 'issue22', "=SUM('Grower Summary'!AG:AG)", 'wt22', "=SUM('Grower Summary'!AJ:AJ)", 'bond2022', "=COUNTIFS('Grower Summary'!AF:AF,\">0\")", 'issue22', "=COUNTIFS('Grower Summary'!AG:AG,\">0\")", 'Supply 2022', "=COUNTIFS('Grower Summary'!Y:Y,\">0\")", '=IF(D3=0,"",F3/D3)', '=(H3-J3)/H3'],
    ['2023', 4, 'bond2023', "=SUM('Grower Summary'!AC:AC)", 'Supply 2023', "=SUM('Grower Summary'!Z:Z)", 'issue23', "=SUM('Grower Summary'!AD:AD)", 'wt23', "=SUM('Grower Summary'!AG:AG)", 'bond2023', "=COUNTIFS('Grower Summary'!AC:AC,\">0\")", 'issue23', "=COUNTIFS('Grower Summary'!AD:AD,\">0\")", 'Supply 2023', "=COUNTIFS('Grower Summary'!Z:Z,\">0\")", '=IF(D4=0,"",F4/D4)', '=(H4-J4)/H4'],
    ['2024', 5, 'bond2024', "=SUM('Grower Summary'!AH:AH)", 'Supply 2024', "=SUM('Grower Summary'!AA:AA)", 'issue24', "=SUM('Grower Summary'!AK:AK)", 'wt24', "=SUM('Grower Summary'!AN:AN)", 'bond2024', "=COUNTIFS('Grower Summary'!AH:AH,\">0\")", 'issue24', "=COUNTIFS('Grower Summary'!AK:AK,\">0\")", 'Supply 2024', "=COUNTIFS('Grower Summary'!AA:AA,\">0\")", '=IF(D5=0,"",F5/D5)', '=(H5-J5)/H5'],
    ['2025', 6, 'Total Bond', "=SUM('Grower Summary'!P:P)", '2025 Supply Qty', "='KPI Calculator'!C5", '2025 Indent Count', "='KPI Calculator'!B4", '2025 Supply Count', "='KPI Calculator'!C4", 'Total Bond', "=COUNTIFS('Grower Summary'!P:P,\">0\")", 'No of Purchy Indent', "=COUNTIFS('Grower Summary'!Q:Q,\">0\")", 'Weight Qty 2025', "=COUNTIFS('Grower Summary'!T:T,\">0\")", '=IF(D6=0,"",F6/D6)', '=(H6-J6)/H6'],
  ];
  const aoa = [headers, ...data];
  return XLSX.utils.aoa_to_sheet(aoa);
}

function buildKpiCalculatorSheet() {
  const rows = [
    ['Purchy Dishonour KPIs (2025)', '', ''],
    ['Measure', 'DAX (summary)', 'Excel Formula'],
    ['Bonded_Growers', 'COUNTROWS(Grower_Summary_Sheet)', "=COUNTA('Grower Summary'!A:A)-1"],
    ['2025_Indent Count', 'COUNTROWS(FILTER(Indent, RELATED summary))', "=COUNTIFS('Purchy Indent'!A:A,\"<>\")"],
    ['2025_Indent Qty', 'SUM(Indent[supllymodeqty]) filtered', "=SUM('Purchy Indent'!M:M)"],
    ['2025_Supply Count', 'COUNTROWS(Supply) filtered', "=COUNTA('Purchy Supply'!A:A)-1"],
    ['2025_Supply Qty', 'SUM(Supply[purchasemodeqty])', "=SUM('Purchy Supply'!Y:Y)"],
    ['2025_Dishonour Count', 'COUNTROWS(Dishonour) via Indent join', "=COUNTA('Purchy Dishonour'!A:A)-1"],
    ['2025_Dishonour % (Count)', 'Dishonour Count / Indent Count', '=IF(B4=0,"",B8/B4)'],
    ['2025_Dishonour Qty', 'SUM(Dishonour[Mode QTY])', "=SUM('Purchy Dishonour'!N:N)"],
    ['2025_Dishonour % (Qty)', 'Dishonour Qty / Indent Qty', '=IF(B5=0,"",B10/B5)'],
    ['', '', ''],
    ['Note: Link sheets to your source workbook tabs:', '', ''],
    ['Grower Summary', '= Grower  Wise summary ', ''],
    ['Purchy Indent', '= Grower Purchy wise Indent', ''],
    ['Purchy Supply', '= Grower Indent Purchy wise suppl', ''],
    ['Purchy Dishonour', '= Grower Purchy wise Indent Faile', ''],
  ];
  return XLSX.utils.aoa_to_sheet(rows);
}

function buildGrowerCalcTemplate() {
  const headers = [
    'Village Code', 'Grower Code', 'Grower Name', 'Village Name', 'Indent QTY', 'Indent Failer QTY',
    'Supply 2020', 'Supply 2021', 'Supply 2022', 'Supply 2023', 'Supply 2024', 'bond2024',
    'Grower_Key', 'Grower_name_Key', 'Village_name_Key', 'Loyalty_Slicer', 'Dishonour_Bucket',
  ];
  const formulas = [
    '', '', '', '', '', '',
    '', '', '', '', '', '',
    '=A2&"-"&B2',
    '=A2&"-"&B2&"-"&C2',
    '=A2&"-"&D2',
    '=IF(SUM((G2>0)*1,(H2>0)*1,(I2>0)*1,(J2>0)*1,(K2>0)*1)=5,"5. Supplied 5 years",IF(SUM((G2>0)*1,(H2>0)*1,(I2>0)*1,(J2>0)*1,(K2>0)*1)=4,"4. Supplied 4 years",IF(SUM((G2>0)*1,(H2>0)*1,(I2>0)*1,(J2>0)*1,(K2>0)*1)=3,"3. Supplied 3 years",IF(SUM((G2>0)*1,(H2>0)*1,(I2>0)*1,(J2>0)*1,(K2>0)*1)=2,"2. Supplied 2 years",IF(SUM((G2>0)*1,(H2>0)*1,(I2>0)*1,(J2>0)*1,(K2>0)*1)=1,"1. Supplied 1 year","0. Never supplied")))))',
    '=IF(E2=0,"No Indent",IF(F2/E2=0,"0% - No Failure",IF(F2/E2<=0.2,"1-20% Failure",IF(F2/E2<=0.4,"21-40% Failure",IF(F2/E2<=0.6,"41-60% Failure",IF(F2/E2<=0.8,"61-80% Failure",IF(F2/E2<1,"81-99% Failure","100% Failure")))))))',
  ];
  return XLSX.utils.aoa_to_sheet([headers, formulas]);
}

function main() {
  const outArg = process.argv.indexOf('--out');
  const outPath = outArg >= 0
    ? path.resolve(process.argv[outArg + 1])
    : path.resolve(__dirname, '..', '..', 'docs', 'purchy-bi', 'Purchy-BI-Formulas-Reference.xlsx');

  const measuresTmdl = readText(path.join(SEMANTIC, 'tables', '_Measures.tmdl'));
  const measures = parseMeasuresFromTmdl(measuresTmdl);

  const tablesDir = path.join(SEMANTIC, 'tables');
  const calcCols = [];
  fs.readdirSync(tablesDir).forEach((f) => {
    if (!f.endsWith('.tmdl')) return;
    const tableName = f.replace('.tmdl', '');
    const content = readText(path.join(tablesDir, f));
    calcCols.push(...parseCalcColumnsFromTmdl(content, tableName));
  });

  const rels = parseRelationships(readText(path.join(SEMANTIC, 'relationships.tmdl')));
  const pages = loadReportPages();
  const pageMap = new Map(pages.map((p) => [p.id, p.name]));
  const visualRows = loadReportVisuals(pageMap);

  const measureRows = measures.map((m) => ({
    Measure: m.name,
    Table: m.table,
    DAX: m.dax,
    'Excel Formula / Hint': daxToExcelHint(m.name, m.dax),
    Category: m.name.includes('2025') ? '2025 Transaction'
      : m.name.includes('Insight') || m.name.includes('Gap') ? 'Supply Gap Insights'
        : m.name.includes('Plot') || m.name.includes('Survey') ? 'Plot Survey'
          : m.name.includes('Bond') || m.name.includes('Supply') || m.name.includes('Purchy') || m.name.includes('Grower') ? 'Purchy / Grower'
            : 'Other',
  }));

  const calcColRows = CALC_COLUMN_EXCEL.concat(
    calcCols
      .filter((c) => !CALC_COLUMN_EXCEL.some((x) => x.table === c.table && x.column === c.column))
      .map((c) => ({
        table: c.table,
        column: c.column,
        dax: c.dax,
        excel: daxToExcelHint(c.column, c.dax),
        note: '',
      })),
  ).map((c) => ({
    Table: c.table,
    Column: c.column,
    DAX: c.dax,
    'Excel Row Formula': c.excel || '',
    Notes: c.note || '',
  }));

  const relRows = rels.map((r) => ({
    From: r.from,
    To: r.to,
    CrossFilter: r.crossFilter,
    'Join Key (Excel)': r.from.includes('Grower_Key') || r.from.includes('grower')
      ? 'VLOOKUP/XLOOKUP on grower_key or societypurchy_no'
      : 'Match codes between tables',
  }));

  const pageRows = pages.map((p) => ({
    'Page ID': p.id,
    'Page Name': p.name,
    'DigiLog Tab': p.name.includes('Year-wise') ? 'Grower Performance'
      : p.name.includes('Dishonour') && !p.name.includes('Drill') ? 'Purchy Dishonour'
        : p.name.includes('Drilldown') ? 'Drilldown tabs'
          : 'Other / out of scope v1',
  }));

  const readme = XLSX.utils.aoa_to_sheet([
    ['Purchy Analysis Dashboard — Formula Reference'],
    ['Generated from Purchy Analysis Dashboard_v9.SemanticModel + Report'],
    [''],
    ['Sheets:'],
    ['1. README — this sheet'],
    ['2. Measures — all DAX measures with Excel equivalents'],
    ['3. Calc Columns — calculated column DAX + Excel row formulas'],
    ['4. Relationships — model joins'],
    ['5. Report Pages — PBI pages mapped to DigiLog'],
    ['6. Report Visuals — each visual and its fields/measures'],
    ['7. Year Matrix — year-wise measure Excel formulas (Page 1 matrix)'],
    ['8. KPI Calculator — Page 2 dishonour KPIs'],
    ['9. Grower Calc Template — copy formulas down on grower data'],
    [''],
    ['To use with your data:'],
    ['• Rename/link sheets to match: Grower Summary, Purchy Indent, Purchy Supply, Purchy Dishonour'],
    ['• Or use Excel External References to your Grower Details Season 2025-2026.xlsx tabs'],
    ['• Adjust column letters if your layout differs from standard import columns'],
  ]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, readme, 'README');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(measureRows), 'Measures');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(calcColRows), 'Calc Columns');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(relRows), 'Relationships');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pageRows), 'Report Pages');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(visualRows), 'Report Visuals');
  XLSX.utils.book_append_sheet(wb, buildYearMatrixSheet(), 'Year Matrix');
  XLSX.utils.book_append_sheet(wb, buildKpiCalculatorSheet(), 'KPI Calculator');
  XLSX.utils.book_append_sheet(wb, buildGrowerCalcTemplate(), 'Grower Calc Template');

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  XLSX.writeFile(wb, outPath);

  console.log(`Generated: ${outPath}`);
  console.log(`  Measures: ${measureRows.length}`);
  console.log(`  Calc columns: ${calcColRows.length}`);
  console.log(`  Relationships: ${relRows.length}`);
  console.log(`  Report pages: ${pageRows.length}`);
  console.log(`  Report visuals: ${visualRows.length}`);
}

main();
