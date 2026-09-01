import { useState } from 'react';
import DistilleryGraphCard from './DistilleryGraphCard';
import DistilleryChartExpandModal from './DistilleryChartExpandModal';
import {
  DISTILLERY_CHART_META,
  EthanolVolChart,
  FermSugarChart,
  OverallEfficiencyChart,
  WashDistilledChart,
  MolassesStockChart,
  EthanolStockChart,
} from './distilleryBiChartPlots';
export default function DistilleryChartsGrid({
  ChartTitle,
  filteredData,
  comparisonData,
  periodLabel,
  comparisonLabel,
  isDarkMode,
  cardClasses,
  textClasses,
  axisStyle,
  gridStyle,
  formatMetric,
  getChartMetric,
}) {
  const [expandedChartId, setExpandedChartId] = useState(null);
  const [expandedMetrics, setExpandedMetrics] = useState(null);
  const operatingDays = (filteredData || []).filter((row) => Number(row.totalProd) > 0).length;
  const periodBadgeLabel = `${operatingDays} Operating Days (${periodLabel})`;
  const chartPlotProps = { data: filteredData, isDarkMode, axisStyle, gridStyle };

  const openExpand = (chartId, metrics) => {
    setExpandedChartId(chartId);
    setExpandedMetrics(metrics);
  };

  const chartTitleProps = (meta) => ({
    title: meta.title,
    definition: meta.definition,
    dataKey: meta.dataKey,
    data: filteredData,
    pyData: comparisonData,
    timeFilter: periodLabel,
    isDarkMode,
    comparisonLabel,
    ...(meta.higherIsBetter === false ? { higherIsBetter: false } : {}),
  });

  const vs = (key, isSum = false, asPercent = true) => (
    <span className="text-[8px] font-semibold text-slate-400">
      | vs {comparisonLabel}: {formatMetric(getChartMetric(key, isSum, comparisonData), { asPercent })}
    </span>
  );

  const meta = DISTILLERY_CHART_META;

  const ethanolMetrics = (
    <div className="mb-2 flex flex-wrap gap-4">
      <div className="flex flex-col">
        <span className={`text-[9px] font-bold ${textClasses.muted}`}>
          Total Vol: <span className={textClasses.title}>{formatMetric(getChartMetric('totalProd', true), { asPercent: false })}</span>
        </span>
        {vs('totalProd', true, false)}
      </div>
      <div className="flex flex-col">
        <span className={`text-[9px] font-bold ${textClasses.muted}`}>
          Avg REC BL: <span className={textClasses.title}>{formatMetric(getChartMetric('recovery', false), { asPercent: false })}</span>
        </span>
        {vs('recovery', false, false)}
      </div>
    </div>
  );

  const fermSugarMetrics = (
    <div className="mb-2 flex flex-wrap gap-4">
      <div className="flex flex-col">
        <span className={`text-[9px] font-bold ${textClasses.muted}`}>
          Avg Ferm. Sugar: <span className={textClasses.title}>{formatMetric(getChartMetric('fermSugar', false))}</span>
        </span>
        {vs('fermSugar', false)}
      </div>
      <div className="flex flex-col">
        <span className={`text-[9px] font-bold ${textClasses.muted}`}>
          Avg Alcohol: <span className={textClasses.title}>{formatMetric(getChartMetric('alcohol', false))}</span>
        </span>
        {vs('alcohol', false)}
      </div>
    </div>
  );

  const efficiencyMetrics = (
    <div className="mb-2 flex flex-wrap gap-4">
      <div className="flex flex-col">
        <span className={`text-[9px] font-bold ${textClasses.muted}`}>
          Avg FE: <span className={textClasses.title}>{formatMetric(getChartMetric('fermEff', false))}</span>
        </span>
        {vs('fermEff', false)}
      </div>
      <div className="flex flex-col">
        <span className={`text-[9px] font-bold ${textClasses.muted}`}>
          Avg DE: <span className={textClasses.title}>{formatMetric(getChartMetric('distEff', false))}</span>
        </span>
        {vs('distEff', false)}
      </div>
      <div className="flex flex-col">
        <span className={`text-[9px] font-bold ${textClasses.muted}`}>
          Avg OE: <span className={textClasses.title}>{formatMetric(getChartMetric('overallEff', false))}</span>
        </span>
        {vs('overallEff', false)}
      </div>
    </div>
  );

  const washMetrics = (
    <div className="mb-2 flex flex-wrap gap-4">
      <div className="flex flex-col">
        <span className={`text-[9px] font-bold ${textClasses.muted}`}>
          Total Wash: <span className={textClasses.title}>{formatMetric(getChartMetric('totalWash', true), { asPercent: false })}</span>
        </span>
        {vs('totalWash', true, false)}
      </div>
    </div>
  );

  const molMetrics = (
    <div className="mb-2 flex flex-wrap gap-4">
      <div className="flex flex-col">
        <span className={`text-[9px] font-bold ${textClasses.muted}`}>
          Avg Stock: <span className={textClasses.title}>{formatMetric(getChartMetric('molInStore', false), { asPercent: false })}</span>
        </span>
        {vs('molInStore', false, false)}
      </div>
    </div>
  );

  const ethStockMetrics = (
    <div className="mb-2 flex flex-wrap gap-4">
      <div className="flex flex-col">
        <span className={`text-[9px] font-bold ${textClasses.muted}`}>
          Avg Stock: <span className={textClasses.title}>{formatMetric(getChartMetric('ethInStore', false), { asPercent: false })}</span>
        </span>
        {vs('ethInStore', false, false)}
      </div>
    </div>
  );

  return (
    <>
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-2 max-md:auto-rows-min md:grid-cols-2 md:grid-rows-3 md:gap-2 md:[grid-template-rows:minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-3 xl:grid-rows-2 xl:gap-2 xl:[grid-template-rows:minmax(0,1fr)_minmax(0,1fr)]">
        <DistilleryGraphCard
          chartId="ethanol-vol"
          onExpand={(id) => openExpand(id, ethanolMetrics)}
          cardClasses={cardClasses}
          isDarkMode={isDarkMode}
          titleRow={<ChartTitle {...chartTitleProps(meta['ethanol-vol'])} />}
          metrics={ethanolMetrics}
        >
          <EthanolVolChart {...chartPlotProps} idPrefix="-ethanol-vol" />
        </DistilleryGraphCard>

        <DistilleryGraphCard
          chartId="ferm-sugar"
          onExpand={(id) => openExpand(id, fermSugarMetrics)}
          cardClasses={cardClasses}
          isDarkMode={isDarkMode}
          titleRow={<ChartTitle {...chartTitleProps(meta['ferm-sugar'])} />}
          metrics={fermSugarMetrics}
        >
          <FermSugarChart {...chartPlotProps} />
        </DistilleryGraphCard>

        <DistilleryGraphCard
          chartId="overall-efficiency"
          onExpand={(id) => openExpand(id, efficiencyMetrics)}
          cardClasses={cardClasses}
          isDarkMode={isDarkMode}
          titleRow={<ChartTitle {...chartTitleProps(meta['overall-efficiency'])} />}
          metrics={efficiencyMetrics}
        >
          <OverallEfficiencyChart {...chartPlotProps} />
        </DistilleryGraphCard>

        <DistilleryGraphCard
          chartId="wash-distilled"
          onExpand={(id) => openExpand(id, washMetrics)}
          cardClasses={cardClasses}
          isDarkMode={isDarkMode}
          titleRow={<ChartTitle {...chartTitleProps(meta['wash-distilled'])} />}
          metrics={washMetrics}
        >
          <WashDistilledChart {...chartPlotProps} idPrefix="-wash" />
        </DistilleryGraphCard>

        <DistilleryGraphCard
          chartId="molasses-stock"
          onExpand={(id) => openExpand(id, molMetrics)}
          cardClasses={cardClasses}
          isDarkMode={isDarkMode}
          titleRow={<ChartTitle {...chartTitleProps(meta['molasses-stock'])} />}
          metrics={molMetrics}
        >
          <MolassesStockChart {...chartPlotProps} idPrefix="-mol" />
        </DistilleryGraphCard>

        <DistilleryGraphCard
          chartId="ethanol-stock"
          onExpand={(id) => openExpand(id, ethStockMetrics)}
          cardClasses={cardClasses}
          isDarkMode={isDarkMode}
          titleRow={<ChartTitle {...chartTitleProps(meta['ethanol-stock'])} />}
          metrics={ethStockMetrics}
        >
          <EthanolStockChart {...chartPlotProps} idPrefix="-eth" />
        </DistilleryGraphCard>
      </div>

      <DistilleryChartExpandModal
        chartId={expandedChartId}
        title={expandedChartId ? DISTILLERY_CHART_META[expandedChartId]?.title : ''}
        definition={expandedChartId ? DISTILLERY_CHART_META[expandedChartId]?.definition : ''}
        periodBadge={periodBadgeLabel}
        metricsRow={expandedMetrics}
        data={filteredData}
        isDarkMode={isDarkMode}
        axisStyle={axisStyle}
        gridStyle={gridStyle}
        onClose={() => {
          setExpandedChartId(null);
          setExpandedMetrics(null);
        }}
      />
    </>
  );
}
