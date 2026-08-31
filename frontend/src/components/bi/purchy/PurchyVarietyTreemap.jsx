import { useMemo } from 'react';

export default function PurchyVarietyTreemap({
  items = [],
  isDarkMode = false,
  selectedName = null,
  onSelect,
}) {
  const { rows, maxCnt, totalCnt } = useMemo(() => {
    const sorted = [...items].filter((i) => i.cnt > 0).sort((a, b) => b.cnt - a.cnt);
    const total = sorted.reduce((s, r) => s + r.cnt, 0) || 1;
    return {
      rows: sorted,
      maxCnt: Math.max(sorted[0]?.cnt || 0, 1),
      totalCnt: total,
    };
  }, [items]);

  const track = isDarkMode ? 'bg-slate-700/80' : 'bg-slate-100';
  const nameCls = isDarkMode ? 'text-slate-200' : 'text-slate-700';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  if (!items.length) {
    return (
      <div className={`flex h-40 items-center justify-center text-xs ${muted}`}>
        No supply purchys for the current filters.
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-1.5">
      <p className={`text-[10px] ${muted}`}>
        {(totalCnt / 1000).toFixed(1)}K supply purchys across {rows.length} varieties
        {onSelect ? ' · click a row to filter Varietytype' : ''}
      </p>
      <div className="max-h-48 overflow-y-auto pr-1">
        <div className="flex flex-col gap-1">
          {rows.map((item) => {
            const active = selectedName === item.name;
            return (
              <button
                key={item.name}
                type="button"
                onClick={() => onSelect?.(active ? null : item.name)}
                className={`grid grid-cols-[7.5rem_1fr_4.25rem] items-center gap-2 rounded-lg px-1.5 py-1 text-left sm:grid-cols-[9rem_1fr_4.5rem] ${
                  active
                    ? isDarkMode
                      ? 'bg-violet-500/20 ring-1 ring-violet-400/60'
                      : 'bg-violet-50 ring-1 ring-violet-300'
                    : isDarkMode
                      ? 'hover:bg-slate-700/50'
                      : 'hover:bg-slate-50'
                }`}
              >
                <span className={`truncate text-[11px] font-bold ${nameCls}`} title={item.name}>
                  {item.name}
                </span>
                <div className={`h-3.5 overflow-hidden rounded-full ${track}`}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max((item.cnt / maxCnt) * 100, 1.5)}%`,
                      background: item.color,
                    }}
                  />
                </div>
                <span className={`text-right text-[10px] font-black tabular-nums ${nameCls}`}>
                  {item.count}
                  <span className={`ml-1 font-semibold ${muted}`}>{item.share}%</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
