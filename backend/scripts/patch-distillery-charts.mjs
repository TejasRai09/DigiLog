import fs from 'fs';

const filePath = new URL('../../frontend/src/pages/bi/DistilleryAnalyticsDashboard.jsx', import.meta.url);
let s = fs.readFileSync(filePath, 'utf8');

const fermBroken = `              <div className="relative mt-2 min-h-0 flex-1">
                <div className="absolute inset-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <FermSugarChart {...chartPlotProps} />
                </div>
              </motionless>`;

const fermFixed = `              <div className="relative mt-2 min-h-0 flex-1">
                <div
                  className="absolute inset-0"
                  ref={(el) => {
                    chartAreaRefs.current['ferm-sugar'] = el;
                  }}
                >
                  <FermSugarChart {...chartPlotProps} />
                </div>
              </motionless>`;

if (s.includes(fermBroken.replace(/motionless/g, 'div'))) {
  s = s.replace(fermBroken.replace(/motionless/g, 'motionless').replace(/motionless/g, 'div'), fermFixed.replace(/motionless/g, 'motionless').replace(/motionless/g, 'motionless').replace(/motionless/g, 'div'));
}

// Simpler ferm fix
s = s.replace(
  /<div className="relative mt-2 min-h-0 flex-1">\s*<div className="absolute inset-0">\s*<ResponsiveContainer[^>]*>\s*<FermSugarChart \{\.\.\.chartPlotProps\} \/>\s*<\/div>\s*<\/div>/,
  `<div className="relative mt-2 min-h-0 flex-1">
                <motionless
                  className="absolute inset-0"
                  ref={(el) => {
                    chartAreaRefs.current['ferm-sugar'] = el;
                  }}
                >
                  <FermSugarChart {...chartPlotProps} />
                </motionless>
              </motionless>`.replace(/motionless/g, 'div'),
);

const overallBlock = s.match(
  /<LineChart data=\{filteredData\} margin=\{\{ top: 10, right: 0, left: -20, bottom: 0 \}\}>[\s\S]*?dataKey="distEff"[\s\S]*?<\/LineChart>\s*<\/ResponsiveContainer>/,
);
if (overallBlock) s = s.replace(overallBlock[0], '<OverallEfficiencyChart {...chartPlotProps} />');

for (const [pattern, replacement] of [
  [/<AreaChart[^>]*>[\s\S]*?id="colorWash"[\s\S]*?<\/AreaChart>\s*<\/ResponsiveContainer>/, '<WashDistilledChart {...chartPlotProps} idPrefix="-wash" />'],
  [/<AreaChart[^>]*>[\s\S]*?id="colorMol"[\s\S]*?<\/AreaChart>\s*<\/ResponsiveContainer>/, '<MolassesStockChart {...chartPlotProps} idPrefix="-mol" />'],
  [/<AreaChart[^>]*>[\s\S]*?id="colorEth"[\s\S]*?<\/AreaChart>\s*<\/ResponsiveContainer>/, '<EthanolStockChart {...chartPlotProps} idPrefix="-eth" />'],
]) {
  const m = s.match(pattern);
  if (m) s = s.replace(m[0], replacement);
}

function wrapChartTitle(chartId, title, definition, dataKey, extra = '') {
  const old = `<ChartTitle
                title="${title}"
                definition="${definition}"
                dataKey="${dataKey}"
                data={filteredData}
                pyData={historicalData}
                timeFilter={periodLabel}
                isDarkMode={isDarkMode}
                comparisonLabel={comparisonLabels[comparisonType]}
              />`;
  if (!s.includes(old) || s.includes(`setExpandedChartId('${chartId}')`)) return;
  s = s.replace(
    old,
    `<div className="mb-1 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <ChartTitle
                    title="${title}"
                    definition="${definition}"
                    dataKey="${dataKey}"
                    data={filteredData}
                    pyData={historicalData}
                    timeFilter={periodLabel}
                    isDarkMode={isDarkMode}
                    comparisonLabel={comparisonLabels[comparisonType]}
                    ${extra}
                  />
                </div>
                <ChartCardToolbar
                  onExpand={() => setExpandedChartId('${chartId}')}
                  onDownloadCsv={() => downloadChartDataCsv('${chartId}')}
                  onDownloadPng={() => downloadChartDataPng('${chartId}')}
                  isDarkMode={isDarkMode}
                />
              </div>`,
  );
}

wrapChartTitle('overall-efficiency', 'Overall Efficiency', 'Side-by-side comparison of Fermentation Efficiency (yield based on sugar) and Distillation Efficiency (alcohol recovery).', 'fermEff');
wrapChartTitle('wash-distilled', 'Wash Distilled', 'Total volume of wash processed through the distillation system during the selected time period.', 'totalWash');
wrapChartTitle('molasses-stock', 'Molasses Stock', 'Current inventory levels of Molasses raw material holding in storage tanks.', 'molInStore', 'higherIsBetter={false}');
wrapChartTitle('ethanol-stock', 'Ethanol Stock', 'Current inventory levels of finished Ethanol product holding in storage tanks awaiting dispatch.', 'ethInStore', 'higherIsBetter={false}');

for (const [tag, id] of [
  ['<OverallEfficiencyChart', 'overall-efficiency'],
  ['<WashDistilledChart', 'wash-distilled'],
  ['<MolassesStockChart', 'molasses-stock'],
  ['<EthanolStockChart', 'ethanol-stock'],
]) {
  if (s.includes(`chartAreaRefs.current['${id}']`)) continue;
  s = s.replace(
    `<div className="absolute inset-0">\n                  ${tag}`,
    `<div
                  className="absolute inset-0"
                  ref={(el) => {
                    chartAreaRefs.current['${id}'] = el;
                  }}
                >
                  ${tag}`,
  );
}

if (!s.includes('<DistilleryChartExpandModal')) {
  s = s.replace(
    /\n    <\/motionless>\n  \);\n}\s*$/m,
    `
      <DistilleryChartExpandModal
        chartId={expandedChartId}
        title={expandedChartId ? DISTILLERY_CHART_META[expandedChartId]?.title : ''}
        definition={expandedChartId ? DISTILLERY_CHART_META[expandedChartId]?.definition : ''}
        periodBadge={periodBadgeLabel}
        data={filteredData}
        isDarkMode={isDarkMode}
        axisStyle={axisStyle}
        gridStyle={gridStyle}
        onClose={() => setExpandedChartId(null)}
      />
    </motionless>
  );\n}\n`.replace(/motionless/g, 'motionless').replace(/motionless/g, 'div'),
  );
}

fs.writeFileSync(filePath, s);
console.log('patched');
