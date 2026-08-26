/**
 * Power BI Management Dashboard — visual layer sources per KPI cell.
 * Page 1 = bold main + red 7DMA cards; Duplicate of Page 1 = daily trend chart.
 */

const NO_7DMA = new Set([
  'Cane DS (Q)',
  'Cane RS (Q)',
  'Syrup+Mol Used (Q)',
]);

/** KPIs that use multiRowCard on Page 1 (stacked bold metrics). */
const MULTIROW = {
  'Yard Bal. (8AM) + Overrun Gate + Overrun Center': {
    layout: 'Multi-row (3 metrics) + red 7DMA on row 1 only — no chart',
    layer1: `① BIG BOLD (multiRowCard — Page 1)
• Yard Bal. (8AM): AVG(DMR_SS24[YARD BAL  8 AM]) | Table: DMR_SS24
• Overrun Gate: Overrun_Gate measure | Tables: Cane Purchase + Cane Indent (Gate category)
• Overrun Center: Overrun_Center measure | Tables: Cane Purchase + Cane Indent (Center category)`,
    layer2: `② RED ITALIC 7DMA (small card — Page 1)
• Yard Bal only: Yard Balance 7DMA | Tables: DMR_SS24 + DMR_SS24[Date]
• Overrun Gate / Center: no 7DMA overlay in PBI`,
    layer3: '③ GRAPH: none (multiRowCard cell — no sparkline in PBI)',
  },
  'Bag Pol % Cane + Pol % Bagasse + Bagasse Moisture': {
    layout: 'Multi-row (3 metrics) — each row has bold + red 7DMA — no chart',
    layer1: `① BIG BOLD (multiRowCard — Page 1)
• Bag Pol % Cane: WAvgBaggPol/Cane | Table: DMR_SS24 (weighted by Total Cane to Sugar)
• Pol % Bagasse: WAvgBaggPol | Table: DMR_SS24
• Bagasse Moisture: WAvgBagMoist | Table: DMR_SS24`,
    layer2: `② RED ITALIC 7DMA (one small card per row — Page 1)
• WAvgBaggPol/Cane_7DMA
• WAvgBaggPol_7DMA
• WAvgBagMoist_7DMA
Date calendar: DMR_SS24[Date]`,
    layer3: '③ GRAPH: none',
  },
  'Pol in F Cake + Mol Pol % Cane + F Mol Purity DS + F Mol Purity RS': {
    layout: 'Multi-row (4 metrics) — each row has bold + red 7DMA — no chart',
    layer1: `① BIG BOLD (multiRowCard — Page 1)
• Pol in F Cake: WAvgFCakePol | DMR_SS24
• Mol Pol % Cane: WAvgFMolPol | DMR_SS24
• F Mol Purity DS: WAvgPurityMolDS | DMR_SS24 (weighted by CANE CRUSHED [DS])
• F Mol Purity RS: WAvgPurityMolRS | DMR_SS24 (weighted by CANE CRUSHED [REF])`,
    layer2: `② RED ITALIC 7DMA
• WAvgFCakePol_7DMA
• WAvgFMolPol_7DMA
• WAvgPurityMolDS_7DMA
• WAvgPurityMolRS_7DMA
Date calendar: DMR_SS24[Date]`,
    layer3: '③ GRAPH: none',
  },
  'Steam/Bag 150 + 70 + 35 TPH': {
    layout: 'Multi-row (3 metrics) — each row bold + red 7DMA — no chart',
    layer1: `① BIG BOLD (multiRowCard — Page 1)
• Steam/Bag 150 TPH: AVG(steam[StmtoBaggase150]) | Table: steam
• Steam/Bag 70 TPH: AVG(steam[StmtoBaggase70]) | Table: steam
• Steam/Bag 35 TPH: AVG(steam[StmtoBaggase35]) | Table: steam`,
    layer2: `② RED ITALIC 7DMA
• StmtoBaggase150_7DMA
• StmtoBaggase70_7DMA
• StmtoBaggase35_7DMA
Date calendar: DMR_SS24[Date] via steam[Date]`,
    layer3: '③ GRAPH: none',
  },
  'Sp. Steam 30MW + 3(O+N) + 4MW': {
    layout: 'Multi-row (3 metrics) — each row bold + red 7DMA — no chart',
    layer1: `① BIG BOLD (multiRowCard — Page 1)
• Sp. Steam 30MW: AVG(power[SpecSteam30]) | Table: power
• Sp. Steam 3(O+N): AVG(power[SpecSteam3(O+N)]) | Table: power
• Sp. Steam 4MW: AVG(power[SpecSteam4]) | Table: power`,
    layer2: `② RED ITALIC 7DMA
• SpecSteam30MW_7DMA
• SpecSteam3(O+N)_7DMA
• SpecSteam4MW_7DMA
Date calendar: DMR_SS24[Date] via power[Date]`,
    layer3: '③ GRAPH: none',
  },
  'Sugar Prod DS (Q) + Sugar Prod RS (Q)  /  Sugar Total': {
    layout: 'Multi-row (2 metrics) + column chart — no red 7DMA on this cell',
    layer1: `① BIG BOLD (multiRowCard — Page 1)
• Sugar Prod DS (Q): SUM(DMR_SS24[SUGAR OUTPUT[DS]]) | Table: DMR_SS24
• Sugar Prod RS (Q): SUM(DMR_SS24[SUGAR OUTPUT [REF]]) | Table: DMR_SS24`,
    layer2: '② RED ITALIC 7DMA: not used on Sugar Total cell in PBI',
    layer3: `③ GRAPH — column chart (Duplicate of Page 1)
Chart: Grouped column
X-axis: DMR_SS24[Date]
Y-axis series 1: SUM(DMR_SS24[SUGAR OUTPUT[DS]]) — Sugar Prod DS (Q)
Y-axis series 2: SUM(DMR_SS24[SUGAR OUTPUT [REF]]) — Sugar Prod RS (Q)
Tables: DMR_SS24`,
  },
  'B Mol in Store + C Mol in Store': {
    layout: 'Multi-row (2 metrics) — each row bold + red 7DMA — no chart',
    layer1: `① BIG BOLD (multiRowCard — Page 1)
• B Mol in Store: AVG(Distillery[Total BH Molasses in Storage …]) | Table: Distillery
• C Mol in Store: AVG(Distillery[Total CH Molasses in Storage …]) | Table: Distillery`,
    layer2: `② RED ITALIC 7DMA
• BMol Store 7DMA
• CMol Store 7DMA
Date calendar: DMR_SS24[Date] via Distillery[Operation Date]`,
    layer3: '③ GRAPH: none',
  },
  'Distillation Eff. + Fermentation Eff.': {
    layout: 'Multi-row (2 metrics) — each row bold + red 7DMA — no chart',
    layer1: `① BIG BOLD (multiRowCard — Page 1)
• Distillation Eff.: AVG(Distillery[DE]) | Table: Distillery
• Fermentation Eff.: AVG(Distillery[FE]) | Table: Distillery`,
    layer2: `② RED ITALIC 7DMA
• DE 7DMA
• FE 7DMA
Date calendar: DMR_SS24[Date] via Distillery[Operation Date]`,
    layer3: '③ GRAPH: none',
  },
  'TRS % + FS %': {
    layout: 'Multi-row (2 metrics) + 2 red 7DMA cards + dual-line chart',
    layer1: `① BIG BOLD (multiRowCard — Page 1)
• TRS %: AVG(Distillery[TRS]) | Table: Distillery
• FS %: AVG(Distillery[FS]) | Table: Distillery`,
    layer2: `② RED ITALIC 7DMA (separate small cards — Page 1)
• TRS 7DMA | Tables: Distillery + DMR_SS24[Date]
• FS 7DMA | Tables: Distillery + DMR_SS24[Date]`,
    layer3: `③ GRAPH — dual line chart (Duplicate of Page 1)
Chart: Line (2 series)
X-axis: DMR_SS24[Date]
Y-axis series 1: AVG(Distillery[TRS]) by day
Y-axis series 2: AVG(Distillery[FS]) by day
Tables: Distillery + DMR_SS24`,
  },
};

function firstLine(text) {
  return String(text || '').split('\n').find((l) => l.trim()) || '';
}

function primaryColumn(columns) {
  return String(columns || '').split(/[,;]/)[0].trim();
}

function primaryTable(pbiTable) {
  return String(pbiTable || '').split(' + ')[0].trim();
}

/** Standard 3-part cell (bold + red 7DMA + chart). */
function standardLayers(row) {
  const has7dma = !NO_7DMA.has(row.kpi);
  const hasChart = row.chart !== 'None (multiRowCard)';

  const layer1 = [
    '① BIG BOLD NUMBER — main card (Page 1, large font)',
    `Tables: ${primaryTable(row.pbiTable)}`,
    `Columns: ${primaryColumn(row.columns)}`,
    `DAX: ${firstLine(row.cardDax)}`,
    `Aggregation: ${row.agg}`,
    'Filtered by: selected period (date slicer on DMR_SS24[Date])',
  ].join('\n');

  const layer2 = has7dma
    ? [
        '② RED ITALIC NUMBER — 7DMA overlay (Page 1, small red card)',
        `Tables: ${row.pbiTable}`,
        `Date calendar: DMR_SS24[Date]`,
        `Date join: ${row.dateJoin || '—'}`,
        'Measure / DAX: see column "7DMA + extra DAX"',
      ].join('\n')
    : '② RED ITALIC 7DMA: not shown on this cell in Power BI';

  const layer3 = hasChart
    ? [
        '③ GRAPH — daily trend (Duplicate of Page 1 sparkline / expand chart)',
        `Chart type: ${row.chart}`,
        'X-axis: DMR_SS24[Date]',
        `Y-axis: daily ${row.agg} of ${primaryColumn(row.columns)}`,
        `Tables: ${row.pbiTable}`,
      ].join('\n')
    : '③ GRAPH: none';

  const layout = hasChart && has7dma
    ? '3-part: ① bold main + ② red 7DMA + ③ chart'
    : hasChart
      ? '2-part: ① bold main + ③ chart (no red 7DMA)'
      : 'Multi-row card only';

  return {
    cellLayout: layout,
    layer1Main: layer1,
    layer2Red7dma: layer2,
    layer3Graph: layer3,
  };
}

function enrichVisualLayers(row) {
  const custom = MULTIROW[row.kpi];
  if (custom) {
    row.cellLayout = custom.layout;
    row.layer1Main = custom.layer1;
    row.layer2Red7dma = custom.layer2;
    row.layer3Graph = custom.layer3;
    return row;
  }

  const std = standardLayers(row);
  row.cellLayout = std.cellLayout;
  row.layer1Main = std.layer1Main;
  row.layer2Red7dma = std.layer2Red7dma;
  row.layer3Graph = std.layer3Graph;
  return row;
}

module.exports = {
  NO_7DMA,
  MULTIROW,
  enrichVisualLayers,
};
