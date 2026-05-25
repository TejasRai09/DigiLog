import fs from 'fs';

const p = new URL('../../frontend/src/pages/bi/DistilleryAnalyticsDashboard.jsx', import.meta.url);
let s = fs.readFileSync(p, 'utf8');

const startIdx = s.indexOf('<div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3 xl:grid-rows-2">');
if (startIdx < 0) {
  console.error('grid start not found');
  process.exit(1);
}

const endIdx = s.indexOf('          </div>\n        </div>\n      ) : (', startIdx);
if (endIdx < 0) {
  console.error('grid end not found');
  process.exit(1);
}

const rep = `          <DistilleryChartsGrid
            ChartTitle={ChartTitle}
            filteredData={filteredData}
            historicalData={historicalData}
            timeFilter={timeFilter}
            comparisonType={comparisonType}
            comparisonLabels={comparisonLabels}
            isDarkMode={isDarkMode}
            cardClasses={cardClasses}
            textClasses={textClasses}
            axisStyle={axisStyle}
            gridStyle={gridStyle}
            formatMetric={formatMetric}
            getChartMetric={getChartMetric}
          />`;

fs.writeFileSync(p, s.slice(0, startIdx) + rep + s.slice(endIdx));
console.log('ok', endIdx - startIdx, 'chars replaced');
