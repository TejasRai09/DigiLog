import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Leaf, Sprout } from 'lucide-react';
import { formatCompact, formatNum, formatPct } from '../../utils/powerHouseMeasures';
import { KPICard, TG_COLORS, axisStroke, cardShadow } from './powerHouseUi';

const TG = TG_COLORS;

function clampPct(v, lo = 0, hi = 120) {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.min(hi, Math.max(lo, v));
}

function ChartTip({ active, payload, label, dm, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold shadow-lg z-50 ${
        dm ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
      }`}
    >
      <p className="mb-1 opacity-70">{label}</p>
      {payload.map((e) => (
        <div key={e.dataKey} className="flex justify-between gap-4">
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

/**
 * Single-screen Power Summary with clear Generation | Consumption columns.
 */
export default function PowerSummaryView({ powerKpis, comparePowerKpis, comparisonLabel, daily, dm }) {
  const p = powerKpis || {};
  const cp = comparePowerKpis || {};
  const chartDaily = (daily || []).map((d) => ({
    ...d,
    Export_pct: clampPct(d.Export_pct),
    Int_Cons_pct: clampPct(d.Int_Cons_pct),
  }));

  const card = dm ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80';
  const muted = dm ? 'text-slate-400' : 'text-slate-500';
  const ink = dm ? 'text-slate-100' : 'text-slate-900';
  const soft = dm ? 'bg-slate-800/80' : 'bg-slate-50';
  const shadow = { boxShadow: cardShadow(dm) };

  return (
    <div className="flex flex-col gap-2 overflow-hidden w-full h-full min-h-0">
      {/* Shared context KPIs */}
      <div className="grid grid-cols-2 gap-3 shrink-0">
        <KPICard
          compact
          label="Bagasse Produced"
          value={p.Baggase}
          compareValue={cp.Baggase}
          compareLabel={comparisonLabel}
          unit="Qtls"
          dm={dm}
          color="amber"
          icon={Leaf}
          info="Bagasse produced from power logbook in the selected range (Qtls)."
        />
        <KPICard
          compact
          label="Cane Crushed"
          value={p.Crush}
          compareValue={cp.Crush}
          compareLabel={comparisonLabel}
          unit="Qtls"
          dm={dm}
          color="green"
          icon={Sprout}
          info="Cane crushed recorded on power logbook in the selected range (Qtls)."
        />
      </div>

      {/* Two separated sections */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 flex-1 min-h-0">
        {/* ══════════ Power Generation ══════════ */}
        <section className={`rounded-2xl border flex flex-col min-h-0 ${card}`} style={shadow}>
          <div className="shrink-0 px-3 py-1.5 rounded-t-2xl bg-gradient-to-r from-slate-800 via-blue-950 to-slate-900">
            <h2 className="text-[12px] font-black uppercase tracking-[0.14em] text-white">Power Generation</h2>
          </div>

          <div
            className="flex-1 min-h-0 p-2 grid gap-2 overflow-visible"
            style={{ gridTemplateRows: 'auto minmax(0, 1.2fr) auto minmax(0, 1fr)' }}
          >
            {/* Total gen hero */}
            <div className={`rounded-lg px-3 py-2 ${soft}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>Total Power Generation</p>
              <p className="text-2xl font-black tabular-nums text-blue-500 leading-tight">
                {formatCompact(p.Total_Power_Gen, 1)}
                <span className={`ml-1.5 text-xs font-semibold ${muted}`}>kWh</span>
              </p>
            </div>

            {/* Day-wise chart */}
            <div className={`rounded-lg border p-2 min-h-0 flex flex-col ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 shrink-0 ${muted}`}>
                Day-wise Power Generation
              </p>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDaily} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="phGenSep" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={dm ? '#1e293b' : '#e2e8f0'} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke(dm) }} axisLine={false} tickLine={false} minTickGap={28} height={18} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke(dm) }} axisLine={false} tickLine={false} width={40} tickFormatter={(v) => formatCompact(v, 0)} />
                    <Tooltip content={<ChartTip dm={dm} />} />
                    <Area type="monotone" dataKey="TotalGen" name="Total Gen" stroke="#2563eb" fill="url(#phGenSep)" strokeWidth={2.25} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* TG Mn tiles */}
            <div className="grid grid-cols-4 gap-1.5 shrink-0">
              {[
                { label: '30 MW', mn: p['PowerGen30(Mn)'], plf: p.PLF_30MW, color: TG.g30 },
                { label: '3 MW Old', mn: p.PowerGen3Old_Mn, plf: p.PLF_3Old, color: TG.g3o },
                { label: '3 MW New', mn: p.PowerGen3_New, plf: p.PLF_3New, color: TG.g3n },
                { label: '4 MW', mn: p.PowerGen4Mn, plf: p.PLF_4MW, color: TG.g4 },
              ].map((t) => (
                <div key={t.label} className={`rounded-lg px-2 py-1.5 ${soft}`}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                    <span className={`text-[10px] font-bold ${muted}`}>{t.label}</span>
                  </div>
                  <p className={`text-base font-black tabular-nums ${ink}`}>
                    {t.mn != null ? formatNum(t.mn, 2) : '—'}
                    <span className={`ml-0.5 text-[9px] font-semibold ${muted}`}>Mn</span>
                  </p>
                  <p className="text-[11px] font-bold tabular-nums" style={{ color: t.color }}>
                    PLF {t.plf != null ? formatNum(t.plf, 1) : '—'}%
                  </p>
                </div>
              ))}
            </div>

            {/* PLF trend */}
            <div className={`rounded-lg border p-2 min-h-0 flex flex-col ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 shrink-0 ${muted}`}>
                Plant Load Factor (%)
              </p>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartDaily} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dm ? '#1e293b' : '#e2e8f0'} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke(dm) }} axisLine={false} tickLine={false} minTickGap={28} height={18} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke(dm) }} axisLine={false} tickLine={false} width={28} domain={[0, 120]} />
                    <Tooltip content={<ChartTip dm={dm} suffix="%" />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                    <Line type="monotone" dataKey="PLF_30MW" name="30 MW" stroke={TG.g30} dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="PLF_3Old" name="3 Old" stroke={TG.g3o} dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="PLF_3New" name="3 New" stroke={TG.g3n} dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="PLF_4MW" name="4 MW" stroke={TG.g4} dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* ══════════ Power Consumption ══════════ */}
        <section className={`rounded-2xl border flex flex-col min-h-0 ${card}`} style={shadow}>
          <div className="shrink-0 px-3 py-1.5 rounded-t-2xl bg-gradient-to-r from-slate-800 via-emerald-950 to-slate-900">
            <h2 className="text-[12px] font-black uppercase tracking-[0.14em] text-white">Power Consumption</h2>
          </div>

          <div
            className="flex-1 min-h-0 p-2 grid gap-2 overflow-visible"
            style={{ gridTemplateRows: 'auto minmax(0, 1.15fr) minmax(0, 1.2fr) auto' }}
          >
            {/* Grid + Inhouse */}
            <div className="grid grid-cols-2 gap-1.5 shrink-0">
              <div className={`rounded-lg px-3 py-2 ${soft}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>Power to Grid</p>
                <p className="text-2xl font-black tabular-nums text-blue-500 leading-tight">
                  {formatCompact(p.ExportGrid30, 1)}
                </p>
                <p className={`text-[11px] font-semibold ${muted}`}>kWh · Export {formatPct(p['Export%'])}</p>
              </div>
              <div className={`rounded-lg px-3 py-2 ${soft}`}>
                <p className={`text-[10px] font-bold uppercase tracking-wide ${muted}`}>Inhouse Consumption</p>
                <p className="text-2xl font-black tabular-nums text-amber-500 leading-tight">
                  {formatCompact(p.Total_Internal_Con, 1)}
                </p>
                <p className={`text-[11px] font-semibold ${muted}`}>kWh · Share {formatPct(p['Int_Cons%'])}</p>
              </div>
            </div>

            {/* Export vs Inhouse */}
            <div className={`rounded-lg border p-2 min-h-0 flex flex-col ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 shrink-0 ${muted}`}>
                Export vs Inhouse (% of Generation)
              </p>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDaily} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="phExpSep" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="phIntSep" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={dm ? '#1e293b' : '#e2e8f0'} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke(dm) }} axisLine={false} tickLine={false} minTickGap={28} height={18} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke(dm) }} axisLine={false} tickLine={false} width={28} domain={[0, 120]} />
                    <Tooltip content={<ChartTip dm={dm} suffix="%" />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                    <Area type="monotone" dataKey="Export_pct" name="Export %" stroke="#2563eb" fill="url(#phExpSep)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Int_Cons_pct" name="Inhouse %" stroke="#f59e0b" fill="url(#phIntSep)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Inhouse breakup */}
            <div className={`rounded-lg border p-2 min-h-0 flex flex-col ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 shrink-0 ${muted}`}>
                Inhouse Consumption — Breakup
              </p>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartDaily} stackOffset="expand" margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={dm ? '#1e293b' : '#e2e8f0'} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisStroke(dm) }} axisLine={false} tickLine={false} minTickGap={28} height={18} />
                    <YAxis tick={{ fontSize: 10, fill: axisStroke(dm) }} axisLine={false} tickLine={false} width={32} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                    <Tooltip content={<ChartTip dm={dm} />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                    <Area type="monotone" stackId="1" dataKey="Export_Sugar" name="Power to Sugar" stroke="#94a3b8" fill="#94a3b8" />
                    <Area type="monotone" stackId="1" dataKey="PowerCons_Dist_CPU_4MW" name="Power to Distillery" stroke="#0ea5e9" fill="#0ea5e9" />
                    <Area type="monotone" stackId="1" dataKey="Export_Cogen" name="Aux Consumption" stroke="#1d4ed8" fill="#1d4ed8" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Breakup totals */}
            <div className="grid grid-cols-3 gap-1.5 shrink-0">
              {[
                { label: 'Sugar', value: p.Export_Sugar, color: '#94a3b8' },
                { label: 'Dist + CPU', value: p.PowerCons_Dist_CPU_4MW, color: '#0ea5e9' },
                { label: 'Aux / Cogen', value: p.Export_Cogen, color: '#1d4ed8' },
              ].map((item) => (
                <div key={item.label} className={`rounded-lg px-2 py-1.5 ${soft}`}>
                  <p className={`text-[10px] font-bold uppercase ${muted}`}>{item.label}</p>
                  <p className="text-base font-black tabular-nums" style={{ color: item.color }}>
                    {formatCompact(item.value, 1)}
                    <span className={`ml-1 text-[9px] font-semibold ${muted}`}>kWh</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
