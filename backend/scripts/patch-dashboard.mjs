import fs from 'fs';

const file = 'c:/vivek/PLANT/DigiLog/frontend/src/pages/bi/DistilleryAnalyticsDashboard.jsx';
const raw = fs.readFileSync(file, 'utf8');
const hadCrlf = raw.includes('\r\n');
const lines = raw.replace(/\r\n/g, '\n').split('\n');

const TOOLBAR_START = 754; // line 755
const TOOLBAR_END = 800; // line 800 inclusive -> slice end 800

const toolbarReplacement = [
  '            <div className={`flex flex-wrap items-center gap-2 rounded-xl border p-1.5 sm:gap-3 ${cardClasses}`}>',
  '              <MdCalendarMonth className={`ml-1 h-4 w-4 shrink-0 sm:ml-2 ${textClasses.muted}`} />',
  '              <motionless className="flex flex-wrap gap-1">',
].join('\n').replace(/motionless/g, 'div');

// Build full replacement as array of lines to avoid template issues
const newToolbarLines = `            <div className={\`flex flex-wrap items-center gap-2 rounded-xl border p-1.5 sm:gap-3 \${cardClasses}\`}>
              <MdCalendarMonth className={\`ml-1 h-4 w-4 shrink-0 sm:ml-2 \${textClasses.muted}\`} />
              <div className="flex flex-wrap gap-1">
                {['MTD', 'QTD', 'YTD'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => applyRangePreset(preset)}
                    className={\`rounded-lg px-3 py-1.5 text-[11px] font-black transition-all \${
                      rangePreset === preset
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                        : \`text-slate-500 hover:text-slate-700 \${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}\`
                    }\`}
                  >
                    {preset}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={selectCustomPreset}
                  className={\`rounded-lg px-3 py-1.5 text-[11px] font-black transition-all \${
                    rangePreset === 'Custom'
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                      : \`text-slate-500 hover:text-slate-700 \${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}\`
                  }\`}
                >
                  Custom
                </button>
              </div>
            </div>

            <div className={\`mx-1 hidden h-6 w-px sm:block \${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}\`} />

            <div className="flex flex-wrap items-end gap-2 sm:gap-3">
              <div className="flex flex-col gap-0.5">
                <span className={\`text-[9px] font-bold uppercase tracking-wide \${textClasses.muted}\`}>From</span>
                <input
                  type="date"
                  value={fromDate}
                  min={dataBounds.min || undefined}
                  max={toDate}
                  onChange={handleFromDateChange}
                  className={\`rounded-lg border px-2 py-1.5 text-[11px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 \${
                    isDarkMode
                      ? 'border-slate-600 bg-slate-900 text-slate-100'
                      : 'border-slate-200 bg-white text-slate-800'
                  }\`}
                />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className={\`text-[9px] font-bold uppercase tracking-wide \${textClasses.muted}\`}>To</span>
                <input
                  type="date"
                  value={toDate}
                  min={fromDate}
                  max={dataBounds.max || undefined}
                  onChange={handleToDateChange}
                  className={\`rounded-lg border px-2 py-1.5 text-[11px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 \${
                    isDarkMode
                      ? 'border-slate-600 bg-slate-900 text-slate-100'
                      : 'border-slate-200 bg-white text-slate-800'
                  }\`}
                />
              </div>
            </div>

            {activeTab === 'dashboard' && (
              <>
                <div className={\`mx-1 h-6 w-px \${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}\`} />
                <div className="flex items-center gap-2 pr-2">
                  <span className={\`text-[10px] font-bold uppercase tracking-widest \${textClasses.muted}\`}>Compare:</span>
                  <div className={\`flex flex-wrap gap-1 rounded-lg border p-1 \${cardClasses}\`}>
                    {[
                      { id: 'PP', label: dynamicPPLabel },
                      { id: 'PY', label: '2024-2025' },
                      { id: 'P2Y', label: '2023-2024' },
                    ].map((comp) => (
                      <button
                        key={comp.id}
                        type="button"
                        onClick={() => setComparisonType(comp.id)}
                        className={\`rounded px-3 py-1 text-[10px] font-black transition-all whitespace-nowrap \${
                          comparisonType === comp.id
                            ? isDarkMode
                              ? 'bg-slate-700 text-slate-100 shadow-sm'
                              : 'bg-slate-800 text-white shadow-sm'
                            : \`text-slate-500 \${isDarkMode ? 'hover:bg-slate-700/50 hover:text-slate-300' : 'hover:bg-slate-100 hover:text-slate-700'}\`
                        }\`}
                      >
                        {comp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}`.split('\n');

let out = [...lines.slice(0, TOOLBAR_START), ...newToolbarLines, ...lines.slice(TOOLBAR_END)];
let s = out.join('\n');

s = s.replaceAll('timeFilter={timeFilter}', 'timeFilter={periodLabel}');
s = s.replaceAll('comparisonLabel={comparisonLabels[comparisonType]}', 'comparisonLabel={comparisonLabel}');
s = s.replaceAll('| vs {comparisonLabels[comparisonType]}:', '| vs {comparisonLabel}:');
s = s.replace('({timeFilter} View)', '({periodLabel} View)');

const gridStart = s.indexOf(
  '          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3 xl:grid-rows-2">',
);
const gridEnd = s.indexOf(
  '\n        </motionless>\n      ) : (\n        <motionless className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm ${cardClasses}`}>'.replace(
    /motionless/g,
    'div',
  ),
  gridStart,
);
if (gridStart === -1 || gridEnd === -1) {
  console.error('grid not found', gridStart, gridEnd);
  process.exit(1);
}
const gridEndFinal = gridEnd;

const grid = `          <DistilleryChartsGrid
            ChartTitle={ChartTitle}
            filteredData={filteredData}
            historicalData={historicalData}
            periodLabel={periodLabel}
            comparisonLabel={comparisonLabel}
            isDarkMode={isDarkMode}
            cardClasses={cardClasses}
            textClasses={textClasses}
            axisStyle={axisStyle}
            gridStyle={gridStyle}
            formatMetric={formatMetric}
            getChartMetric={getChartMetric}
          />
`;

s = s.slice(0, gridStart) + grid + s.slice(gridEndFinal);

s = s.replace(
  "{activeTab === 'dashboard' ? (\n        <div className=\"flex min-h-0 flex-1 flex-col gap-3\">",
  "{activeTab === 'dashboard' ? (\n        <div className=\"flex min-h-0 min-w-0 flex-1 flex-col gap-2 md:gap-2 md:overflow-hidden\">",
);
s = s.replace(
  '<div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">',
  '<div className="grid min-w-0 shrink-0 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2 xl:grid-cols-4 xl:gap-2">',
);

if (!s.includes('md:overflow-y-hidden')) {
  s = s.replace(
    '      </div>\n\n      {activeTab === \'dashboard\' ? (',
    '      </div>\n\n      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto max-md:pb-1 md:flex md:flex-col md:overflow-y-hidden">\n      {activeTab === \'dashboard\' ? (',
  );
  s = s.replace('\n      )}\n    </div>\n  );\n}\n', '\n      )}\n      </div>\n    </div>\n  );\n}\n');
}

const syncMarker = '  }, [rawData]);\n\n  const filteredData = useMemo(() => {';
if (s.includes(syncMarker) && !s.includes('[dataBounds.max, rangePreset]')) {
  s = s.replace(
    syncMarker,
    `  }, [rawData]);

  useEffect(() => {
    if (!dataBounds.max) return;
    const ref = new Date(\`\${dataBounds.max}T12:00:00\`);
    if (rangePreset !== 'Custom') {
      const { from, to } = getPresetDateRange(rangePreset, ref);
      setFromDate(from);
      setToDate(to);
    }
  }, [dataBounds.max, rangePreset]);

  const filteredData = useMemo(() => {`,
  );
}

fs.writeFileSync(file, hadCrlf ? s.replace(/\n/g, '\r\n') : s);
console.log('dashboard patched successfully');
