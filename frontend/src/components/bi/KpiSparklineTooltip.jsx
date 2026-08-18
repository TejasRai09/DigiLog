import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

function formatTooltipValue(v, unit) {
  if (!Number.isFinite(v)) return '—';
  if (unit === '%') return `${v.toFixed(2)}%`;
  return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`;
}

let lastPointer = { x: 0, y: 0 };
if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e) => {
    lastPointer = { x: e.clientX, y: e.clientY };
  });
}

function usePointerPosition(active) {
  const [pos, setPos] = useState(lastPointer);

  useEffect(() => {
    if (!active) return undefined;
    setPos(lastPointer);
    const onMove = (e) => {
      lastPointer = { x: e.clientX, y: e.clientY };
      setPos(lastPointer);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [active]);

  return pos;
}

/** Recharts tooltip for KPI sparkline hover. Portaled so overflow:hidden cards cannot clip it. */
export default function KpiSparklineTooltip({ active, payload, isDarkMode, unit, seriesKeys }) {
  const mouse = usePointerPosition(active);

  if (!active || !payload?.length || typeof document === 'undefined') return null;
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

  const offset = 14;
  const approxWidth = 200;
  const approxHeight = entries.length > 1 ? 28 + entries.length * 16 : 44;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.max(8, Math.min(mouse.x + offset, vw - approxWidth - 8));
  const placeAbove = mouse.y - approxHeight - 8 > 0;
  const top = placeAbove
    ? mouse.y - offset
    : Math.min(mouse.y + offset, vh - approxHeight - 8);

  return createPortal(
    <div
      role="tooltip"
      className={`pointer-events-none fixed rounded-lg border px-2.5 py-1.5 text-[10px] font-bold shadow-lg ${
        isDarkMode ? 'border-slate-600 bg-slate-800 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
      }`}
      style={{
        zIndex: 9999,
        left,
        top,
        transform: placeAbove ? 'translateY(-100%)' : 'none',
      }}
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
    </div>,
    document.body,
  );
}
