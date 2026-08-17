function formatTooltipValue(v, unit) {
  if (!Number.isFinite(v)) return '—';
  if (unit === '%') return `${v.toFixed(2)}%`;
  return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
}

/** Recharts tooltip for KPI sparkline hover (shared with Distillery-style dashboards). */
export default function KpiSparklineTooltip({ active, payload, isDarkMode, unit, seriesKeys }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const dateLabel = row.dateFull || row.date || '';

  const entries = seriesKeys?.length
    ? seriesKeys
        .map((s) => {
          const match = payload.find((p) => p.dataKey === s.key);
          const v = match ? Number(match.value) : Number(row[s.key]);
          if (!Number.isFinite(v)) return null;
          return { label: s.label, value: v, color: match?.color || match?.stroke || match?.fill };
        })
        .filter(Boolean)
    : payload
        .map((p) => ({
          label: p.name || 'Value',
          value: Number(p.value),
          color: p.color || p.stroke || p.fill,
        }))
        .filter((e) => Number.isFinite(e.value));

  if (!entries.length) return null;

  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold shadow-lg ${
        isDarkMode ? 'border-slate-600 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
      }`}
    >
      <div className={`mb-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{dateLabel}</div>
      {entries.length === 1 ? (
        <div className="tabular-nums">{formatTooltipValue(entries[0].value, unit)}</div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {entries.map((e) => (
            <div key={e.label} className="flex items-center justify-between gap-3 tabular-nums">
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>{e.label}</span>
              <span>{formatTooltipValue(e.value, unit)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
