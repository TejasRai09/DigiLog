import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { formatCompact } from '../../utils/powerHouseMeasures';
import MillComparePct from './MillComparePct';

/** Match Cane Performance card elevation */
export function cardShadow(dm) {
  return dm
    ? '0 6px 14px -4px rgba(0,0,0,.55), 0 22px 48px -14px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.05)'
    : '0 6px 14px -4px rgba(15,23,42,.12), 0 22px 48px -14px rgba(15,23,42,.28), 0 2px 6px rgba(15,23,42,.06)';
}

export function axisStroke(dm) {
  return dm ? '#64748b' : '#94a3b8';
}

/** Fills the area below tabs (parent main is flex-1). */
export function FitShell({ children, className = '' }) {
  return (
    <div className={`flex flex-col gap-3 overflow-hidden w-full h-full min-h-0 ${className}`}>
      {children}
    </div>
  );
}

const HEADER_TONES = {
  blue: 'from-slate-800 via-blue-950 to-slate-900',
  emerald: 'from-slate-800 via-emerald-950 to-slate-900',
  amber: 'from-slate-800 via-amber-950 to-slate-900',
  rose: 'from-slate-800 via-rose-950 to-slate-900',
  violet: 'from-slate-800 via-violet-950 to-slate-900',
};

const ICON_TONES = {
  blue: { bg: '#dbeafe', color: '#2563eb' },
  green: { bg: '#d1fae5', color: '#059669' },
  amber: { bg: '#fef3c7', color: '#d97706' },
  red: { bg: '#fee2e2', color: '#dc2626' },
  violet: { bg: '#ede9fe', color: '#7c3aed' },
  cyan: { bg: '#cffafe', color: '#0891b2' },
  slate: { bg: '#e2e8f0', color: '#475569' },
};

export function InfoTip({ text, dm }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  if (!text) return null;
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label="Section information"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
          dm
            ? 'border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-slate-100'
            : 'border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700'
        }`}
      >
        <Info className="w-3 h-3" strokeWidth={2.5} />
      </button>
      {open && (
        <div
          role="tooltip"
          className={`absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border p-2.5 text-[11px] leading-relaxed font-medium shadow-lg ${
            dm ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-600'
          }`}
        >
          {text}
        </div>
      )}
    </div>
  );
}

/** Cane-style chart/section card: rounded-2xl, shadow, muted title (optional gradient header) */
export function BandCard({ title, children, dm, className = '', bodyClassName = '', right = null, tone = null, titleWrap = false }) {
  const bodyOverflow = /\boverflow-/.test(bodyClassName) ? '' : 'overflow-hidden';
  const titleCls = titleWrap ? 'whitespace-normal break-words leading-snug' : 'truncate';
  return (
    <div
      className={`relative rounded-2xl border flex flex-col min-h-0 transition-all duration-200 hover:-translate-y-0.5 ${
        dm ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'
      } ${className}`}
      style={{ boxShadow: cardShadow(dm) }}
    >
      {title ? (
        tone ? (
          <div className={`shrink-0 px-3 py-1.5 flex items-center justify-between gap-2 rounded-t-2xl min-w-0 bg-gradient-to-r ${HEADER_TONES[tone] || HEADER_TONES.blue}`}>
            <h3 className={`text-xs font-black uppercase tracking-[0.14em] text-white ${titleCls}`}>{title}</h3>
            {right}
          </div>
        ) : (
          <div className="shrink-0 px-3 pt-2.5 pb-1 flex items-center justify-between gap-2 min-w-0">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${titleCls} ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
              {title}
            </p>
            {right}
          </div>
        )
      ) : null}
      <div className={`flex-1 min-h-0 ${bodyOverflow} ${title && !tone ? 'px-3 pb-2.5' : 'p-2'} ${bodyClassName}`}>{children}</div>
    </div>
  );
}

/** Cane Gate-1 KPI: circular pastel icon, label, bold value, info tip */
export function KPICard({ label, value, compareValue, compareLabel, inverseGood = false, unit = '', color = 'blue', dm, compact = false, icon: Icon, info }) {
  const tone = ICON_TONES[color] || ICON_TONES.blue;
  const iconBg = dm ? `${tone.color}22` : tone.bg;
  const display =
    typeof value === 'number' ? formatCompact(value, Math.abs(value) >= 1000 ? 1 : 2) : value ?? '—';
  
  let pctDiff = null;
  if (typeof value === 'number' && typeof compareValue === 'number' && compareValue !== 0) {
    pctDiff = ((value - compareValue) / compareValue) * 100;
  }

  return (
    <div
      className={`relative rounded-2xl border flex items-center gap-3 overflow-hidden transition-all duration-200 hover:-translate-y-1 ${
        compact ? 'px-3 py-2.5' : 'px-4 py-3.5'
      } ${dm ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
      style={{ boxShadow: cardShadow(dm) }}
    >
      <div className="absolute top-2.5 right-2.5 z-10">
        <InfoTip text={info || label} dm={dm} />
      </div>
      {Icon ? (
        <span
          className={`${compact ? 'w-9 h-9' : 'w-11 h-11'} rounded-full flex items-center justify-center shrink-0`}
          style={{
            background: iconBg,
            boxShadow: `0 8px 18px -4px ${tone.color}59, 0 2px 6px ${tone.color}33`,
          }}
        >
          <Icon className={compact ? 'w-4 h-4' : 'w-5 h-5'} style={{ color: tone.color }} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1 pr-5">
        <p className={`text-sm font-semibold leading-tight break-words ${dm ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
        <p className={`${compact ? 'text-xl' : 'text-3xl'} font-black tracking-tight tabular-nums mt-0.5 break-words leading-tight ${dm ? 'text-slate-50' : 'text-slate-900'}`}>
          {display}
          {unit ? (
            <span className={`ml-1 text-xs font-semibold ${dm ? 'text-slate-400' : 'text-slate-500'}`}>{unit}</span>
          ) : null}
        </p>
        {pctDiff !== null && Number.isFinite(pctDiff) && (
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 ${dm ? 'bg-slate-800' : 'bg-slate-100'}`}>
              <MillComparePct pct={pctDiff} inverseGood={inverseGood} isDarkMode={dm} />
            </span>
            {compareLabel && (
              <span className={`text-xs font-semibold tracking-wide ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                vs {compareLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChartCard({ title, children, dm, className = '', bodyClassName = '' }) {
  return (
    <BandCard title={title} dm={dm} className={className} bodyClassName={bodyClassName}>
      {children}
    </BandCard>
  );
}

export function SectionPanel({ title, tone = 'blue', dm, children, className = '' }) {
  return (
    <BandCard title={title} tone={tone} dm={dm} className={className} bodyClassName="flex flex-col gap-1.5 p-2">
      {children}
    </BandCard>
  );
}

export function UnitNote({ text = '*All units in KWH, unless otherwise mentioned.', dm }) {
  return (
    <p className={`shrink-0 text-[10px] font-semibold ${dm ? 'text-slate-500' : 'text-slate-400'}`}>{text}</p>
  );
}

export function ChartTip({ active, payload, label, dm, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={`rounded-xl border p-2.5 text-[11px] font-semibold shadow-lg z-50 ${
        dm ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
      }`}
    >
      <p className="mb-1 opacity-70">{label}</p>
      {payload.map((e) => (
        <div key={e.dataKey} className="flex justify-between gap-3">
          <span style={{ color: e.color }}>{e.name}</span>
          <span className="tabular-nums">
            {typeof e.value === 'number' ? formatCompact(e.value, 2) : e.value}
            {suffix}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Cane Performance series palette */
export const TG_COLORS = {
  g30: '#3b82f6',
  g3o: '#f59e0b',
  g3n: '#10b981',
  g4: '#8b5cf6',
};

export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

export function MetricLine({ label, value, dm, emphasize = false, stacked = false }) {
  const display =
    typeof value === 'number' ? formatCompact(value, Math.abs(value) >= 100 ? 1 : 2) : value ?? '—';
  const labelCls = `text-xs font-bold uppercase tracking-wide ${dm ? 'text-slate-400' : 'text-slate-500'}`;
  const valueCls = `tabular-nums font-black ${emphasize ? 'text-lg' : 'text-base'} ${dm ? 'text-slate-100' : 'text-slate-900'}`;

  if (stacked) {
    return (
      <div className={`min-w-0 ${emphasize ? 'py-0.5' : ''}`}>
        <p className={`${labelCls} truncate leading-tight`}>{label}</p>
        <p className={`${valueCls} leading-tight`}>{display}</p>
      </div>
    );
  }

  return (
    <div className={`flex items-baseline justify-between gap-1.5 min-w-0 ${emphasize ? 'py-0.5' : ''}`}>
      <span className={`${labelCls} min-w-0 flex-1 truncate`}>{label}</span>
      <span className={`${valueCls} shrink-0`}>{display}</span>
    </div>
  );
}
