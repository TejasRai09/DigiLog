import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pairMillCompareTooltipEntries } from '../../utils/millingBiComparison';

/**
 * Shared Recharts Tooltip props.
 * Content self-portals to document.body with fixed coords (see MillPairedChartTooltip).
 */
export const MILL_CHART_TOOLTIP_PROPS = {
  allowEscapeViewBox: { x: true, y: true },
  wrapperStyle: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    overflow: 'visible',
    pointerEvents: 'none',
    zIndex: 1,
  },
};

/** Per-chart anchor so multi-grid tooltips attach to the hovered panel, not another card. */
const MillTooltipAnchorContext = createContext(null);

export function MillTooltipAnchor({ children, className }) {
  const ref = useRef(null);
  return (
    <MillTooltipAnchorContext.Provider value={ref}>
      <div ref={ref} className={className}>
        {children}
      </div>
    </MillTooltipAnchorContext.Provider>
  );
}

function fmt(n, valueFormat) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (valueFormat === 'degree') return `${n.toFixed(1)}°`;
  return n.toFixed(2);
}

function resolveChartRect(anchorRef) {
  const node = anchorRef?.current;
  if (!node || typeof node.getBoundingClientRect !== 'function') return null;
  const wrapper = node.querySelector?.('.recharts-wrapper');
  if (wrapper) {
    const r = wrapper.getBoundingClientRect();
    if (r.width > 20 && r.height > 20) return r;
  }
  const r = node.getBoundingClientRect();
  return r.width > 20 && r.height > 20 ? r : null;
}

/**
 * Opaque paired Actual | Cmp tooltip — fixed to the viewport.
 * Must be rendered under a MillTooltipAnchor (or pass anchorRef) so position
 * matches the chart being hovered in multi-chart grids.
 */
export default function MillPairedChartTooltip({
  active,
  payload,
  label,
  coordinate,
  lines = [],
  isDarkMode,
  valueFormat = 'plain',
  anchorRef: anchorRefProp,
}) {
  const anchorFromCtx = useContext(MillTooltipAnchorContext);
  const anchorRef = anchorRefProp || anchorFromCtx;
  const boxRef = useRef(null);
  const [pos, setPos] = useState(null);

  let pairs = active && payload?.length ? pairMillCompareTooltipEntries(payload, lines) : [];
  if (active && payload?.length && !pairs.length) {
    pairs = payload
      .filter((p) => p?.value != null && Number.isFinite(Number(p.value)))
      .map((p, i) => ({
        key: String(p.dataKey ?? i),
        label: p.name || String(p.dataKey || 'Series'),
        color: p.color || '#64748b',
        actual: Number(p.value),
        compare: null,
      }));
  }

  useLayoutEffect(() => {
    if (!active || !pairs.length || !coordinate || typeof document === 'undefined') {
      setPos(null);
      return undefined;
    }

    const place = () => {
      const el = boxRef.current;
      if (!el) return;
      const chartRect = resolveChartRect(anchorRef);
      if (!chartRect) return;

      const pad = 14;
      const w = el.offsetWidth || 240;
      const h = el.offsetHeight || 160;
      const cursorX = chartRect.left + Number(coordinate.x || 0);
      const cursorY = chartRect.top + Number(coordinate.y || 0);

      let left = cursorX + pad;
      let top = cursorY + pad;

      if (left + w > window.innerWidth - 8) left = cursorX - w - pad;
      if (left < 8) left = 8;

      if (top + h > window.innerHeight - 8) top = cursorY - h - pad;
      if (top < 8) top = 8;

      setPos({ left, top, maxHeight: Math.max(120, window.innerHeight - top - 8) });
    };

    place();
    const id = requestAnimationFrame(place);
    return () => cancelAnimationFrame(id);
  }, [active, anchorRef, coordinate?.x, coordinate?.y, label, pairs.length, payload]);

  if (!active || !pairs.length || typeof document === 'undefined') return null;

  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return createPortal(
    <div
      ref={boxRef}
      className={`pointer-events-none fixed z-[10000] min-w-[200px] max-w-[280px] rounded-xl border p-2.5 text-[10px] font-bold shadow-2xl ${
        isDarkMode
          ? 'border-slate-600 bg-slate-900 text-slate-100'
          : 'border-slate-200 bg-white text-slate-800'
      }`}
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        maxHeight: pos?.maxHeight,
        overflowY: pos?.maxHeight ? 'auto' : undefined,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <p className={`mb-1.5 border-b pb-1.5 ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
        {label}
      </p>
      <div className="space-y-1.5">
        {pairs.map((e) => (
          <div key={e.key} className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
              <span className="truncate text-[11px]">{e.label}</span>
            </div>
            <div className="ml-4 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px] tabular-nums">
              <span>
                <span className={`mr-1 font-sans text-[9px] font-bold uppercase tracking-wide ${muted}`}>Actual</span>
                {fmt(e.actual, valueFormat)}
              </span>
              <span>
                <span className={`mr-1 font-sans text-[9px] font-bold uppercase tracking-wide ${muted}`}>Cmp</span>
                {fmt(e.compare, valueFormat)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body,
  );
}
