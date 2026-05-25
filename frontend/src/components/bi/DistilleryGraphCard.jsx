import ChartCardToolbar from './ChartCardToolbar';

/** One analytics graph card with expand action. */
export default function DistilleryGraphCard({
  chartId,
  onExpand,
  cardClasses,
  isDarkMode,
  titleRow,
  metrics,
  children,
}) {
  return (
    <div
      className={`flex h-full min-h-0 min-w-0 max-md:min-h-[220px] flex-col overflow-hidden rounded-2xl border p-3 md:min-h-0 lg:p-3.5 ${cardClasses}`}
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">{titleRow}</div>
        <ChartCardToolbar onExpand={() => onExpand(chartId)} isDarkMode={isDarkMode} />
      </div>
      {metrics}
      <div className="relative mt-2 min-h-0 flex-1">
        <div className="absolute inset-0">{children}</div>
      </div>
    </div>
  );
}
