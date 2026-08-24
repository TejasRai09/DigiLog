import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarDays,
  Droplets,
  Factory,
  Filter,
  Flame,
  Gauge,
  Leaf,
  Plug,
  TimerReset,
  Zap,
} from 'lucide-react';
import {
  buildOutageStackedBySubSection,
  computeOutageKpis,
  formatCompact,
  formatNum,
  groupOutageMachinery,
  isBoilerSection,
  isTurbineSection,
} from '../../utils/powerHouseMeasures';
import {
  BandCard,
  CHART_COLORS,
  ChartTip,
  FitShell,
  KPICard,
  MetricLine,
  TG_COLORS,
  UnitNote,
  axisStroke,
  cardShadow,
} from './powerHouseUi';

function DTableCompact({ cols, rows, dm }) {
  return (
    <div className={`rounded-lg border overflow-hidden h-full ${dm ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-white'}`}>
      <div className="overflow-auto h-full">
        <table className="w-full text-xs text-left">
          <thead className={`sticky top-0 z-[1] ${dm ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'} uppercase text-[11px]`}>
            <tr>
              {cols.map((c) => (
                <th key={c.key} className="px-1.5 py-1 font-bold whitespace-nowrap">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`divide-y ${dm ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-700'}`}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-2 py-4 text-center opacity-60">
                  No rows
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className={dm ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}>
                  {cols.map((c) => (
                    <td key={c.key} className="px-1.5 py-0.5 whitespace-nowrap max-w-[14rem] truncate">
                      {c.fmt ? c.fmt(row[c.key], row) : row[c.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function gridStroke(dm) {
  return dm ? '#1e293b' : '#e2e8f0';
}

/* ═══════════════════════════════════════════════════════════════════
   GENERATION — matches PBI: OpDays header, 4 TG rows, right sidebar
   ═══════════════════════════════════════════════════════════════════ */
export function PowerGenerationView({ powerKpis, comparePowerKpis, comparisonLabel, daily, dm }) {
  const p = powerKpis || {};
  const cp = comparePowerKpis || {};
  const rows = [
    { title: 'Total 30MW', gen: p.PowerGen30, plf: p.PLF_30MW, genKey: 'PowerGen30', plfKey: 'PLF_30MW', color: TG_COLORS.g30 },
    { title: 'Total 3MW New', gen: p.PowerGen3New, plf: p.PLF_3New, genKey: 'PowerGen3New', plfKey: 'PLF_3New', color: TG_COLORS.g3n },
    { title: 'Total 3MW Old', gen: p.PowerGen3Old, plf: p.PLF_3Old, genKey: 'PowerGen3Old', plfKey: 'PLF_3Old', color: TG_COLORS.g3o },
    { title: 'Total 4MW', gen: p.PowerGen4MW, plf: p.PLF_4MW, genKey: 'PowerGen4MW', plfKey: 'PLF_4MW', color: TG_COLORS.g4 },
  ];
  const remarks = (daily || []).filter((d) => d.remark).map((d) => ({ date: d.date, remark: d.remark }));

  return (
    <FitShell>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <KPICard compact label="Operating Days · 30MW" value={p.OpDays_30MW} compareValue={cp.OpDays_30MW} compareLabel={comparisonLabel} dm={dm} color="blue" icon={Gauge} info="Days with non-zero 30 MW generation in the selected range." />
        <KPICard compact label="Operating Days · 3MW (New)" value={p.OpDays_3MW_New} compareValue={cp.OpDays_3MW_New} compareLabel={comparisonLabel} dm={dm} color="green" icon={Zap} info="Days with non-zero 3 MW New generation." />
        <KPICard compact label="Operating Days · 3MW (Old)" value={p.OpDays_3MW_Old} compareValue={cp.OpDays_3MW_Old} compareLabel={comparisonLabel} dm={dm} color="amber" icon={Zap} info="Days with non-zero 3 MW Old generation." />
        <KPICard compact label="Operating Days · 4MW" value={p.OpDays_4MW} compareValue={cp.OpDays_4MW} compareLabel={comparisonLabel} dm={dm} color="violet" icon={CalendarDays} info="Days with non-zero 4 MW generation." />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-1.5">
        <div className="lg:col-span-8 min-h-0 grid gap-1.5" style={{ gridTemplateRows: 'repeat(4, minmax(0, 1fr))' }}>
          {rows.map((r) => (
            <div key={r.title} className="min-h-0 grid grid-cols-[minmax(10.5rem,12rem)_minmax(0,1fr)] gap-1.5">
              <BandCard title={r.title} dm={dm} className="h-full overflow-visible" bodyClassName="flex flex-col justify-center gap-1 overflow-visible px-2.5 pb-2">
                <MetricLine label="PLF (%)" value={r.plf != null ? formatNum(r.plf, 1) : '—'} dm={dm} emphasize />
                <MetricLine label="Power Gen." value={r.gen} dm={dm} emphasize />
              </BandCard>
              <BandCard title={`${r.title.replace('Total ', '')} — Gen & PLF`} dm={dm} className="h-full" bodyClassName="overflow-visible">
                <ResponsiveContainer width="100%" height="100%" minHeight={56}>
                  <AreaChart data={daily} margin={{ top: 2, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(dm)} vertical={false} />
                    <XAxis dataKey="label" hide />
                    <YAxis yAxisId="l" tick={{ fontSize: 8, fill: axisStroke(dm) }} width={32} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 8, fill: axisStroke(dm) }} width={28} />
                    <Tooltip content={<ChartTip dm={dm} />} />
                    <Area yAxisId="l" type="monotone" dataKey={r.genKey} name="Gen" stroke={r.color} fill={`${r.color}33`} strokeWidth={1.5} />
                    <Line yAxisId="r" type="monotone" dataKey={r.plfKey} name="PLF %" stroke="#ef4444" dot={false} strokeWidth={1.25} />
                  </AreaChart>
                </ResponsiveContainer>
              </BandCard>
            </div>
          ))}
        </div>

        <div className="lg:col-span-4 min-h-0 grid gap-1.5" style={{ gridTemplateRows: '1.2fr auto auto 1fr' }}>
          <BandCard title="Power Generation — TG wise break-up" dm={dm} bodyClassName="overflow-visible">
            <ResponsiveContainer width="100%" height="100%" minHeight={80}>
              <AreaChart data={daily} stackOffset="expand" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(dm)} />
                <XAxis dataKey="label" tick={{ fontSize: 8, fill: axisStroke(dm) }} interval="preserveStartEnd" height={14} />
                <YAxis tick={{ fontSize: 8, fill: axisStroke(dm) }} width={28} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip content={<ChartTip dm={dm} />} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Area type="monotone" stackId="1" dataKey="PowerGen30" name="30" stroke={TG_COLORS.g30} fill={TG_COLORS.g30} />
                <Area type="monotone" stackId="1" dataKey="PowerGen3New" name="3N" stroke={TG_COLORS.g3n} fill={TG_COLORS.g3n} />
                <Area type="monotone" stackId="1" dataKey="PowerGen3Old" name="3O" stroke={TG_COLORS.g3o} fill={TG_COLORS.g3o} />
                <Area type="monotone" stackId="1" dataKey="PowerGen4MW" name="4" stroke={TG_COLORS.g4} fill={TG_COLORS.g4} />
              </AreaChart>
            </ResponsiveContainer>
          </BandCard>

          <BandCard title="DG Power Generation" dm={dm} bodyClassName="grid grid-cols-2 gap-1 p-1.5">
            {[
              ['625KVA DG1', p.GenDG30],
              ['DG 3 Old', p.GenDG3Old],
              ['DG 3 New', p.GenDG3New],
              ['DG 4', p.GenDG4],
            ].map(([lab, val]) => (
              <div key={lab} className={`rounded-md px-1.5 py-1 ${dm ? 'bg-slate-800' : 'bg-slate-50'}`}>
                <p className={`text-[8px] font-bold uppercase ${dm ? 'text-slate-400' : 'text-slate-500'}`}>{lab}</p>
                <p className="text-sm font-black tabular-nums">{formatCompact(val)}</p>
              </div>
            ))}
          </BandCard>

          <div className="grid grid-cols-2 gap-1.5">
            <KPICard compact label="Import Instances" value={p.Import_Instances} compareValue={cp.Import_Instances} compareLabel={comparisonLabel} dm={dm} color="amber" icon={Plug} info="Count of days with grid import." />
            <BandCard title="Total Import" dm={dm} bodyClassName="p-1.5 flex flex-col gap-1">
              <p className="text-lg font-black tabular-nums text-red-600">{formatCompact(p.Total_Import)}</p>
              <div className="flex-1 min-h-[36px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={daily} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <Line type="monotone" dataKey="Imp_Grid" stroke="#ef4444" dot={false} strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </BandCard>
          </div>

          <BandCard title="Remarks" dm={dm}>
            <DTableCompact
              dm={dm}
              cols={[
                { key: 'date', label: 'Date' },
                { key: 'remark', label: 'Remark' },
              ]}
              rows={remarks.slice(0, 40)}
            />
          </BandCard>
        </div>
      </div>
      <UnitNote dm={dm} />
    </FitShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CONSUMPTION — donuts left, KPI+trend rows right (PBI aligned)
   ═══════════════════════════════════════════════════════════════════ */
export function PowerConsumptionView({ powerKpis, comparePowerKpis, comparisonLabel, daily, consumptionPie, externalPie, dm }) {
  const p = powerKpis || {};
  const cp = comparePowerKpis || {};
  const trendRows = [
    { label: 'Power to Grid', value: p.ExportGrid30, key: 'ExportGrid30', color: '#3b82f6' },
    { label: 'Power to Sugar', value: p.Export_Sugar, key: 'Export_Sugar', color: '#3b82f6' },
    { label: 'Power to Distillery', value: p.PowerCons_Dist_CPU_4MW, key: 'PowerCons_Dist_CPU_4MW', color: '#64748b' },
    { label: 'Aux Consumption', value: p.Export_Cogen, key: 'Export_Cogen', color: '#0ea5e9' },
  ];

  return (
    <FitShell>
      <div className="grid grid-cols-2 gap-3 shrink-0">
        <KPICard compact label="Export to Grid" value={p.Export_Grid} compareValue={cp.Export_Grid} compareLabel={comparisonLabel} dm={dm} color="blue" icon={Zap} />
        <KPICard compact label="Internal Cons. (%)" value={p.Int_Cons_pct} compareValue={cp.Int_Cons_pct} compareLabel={comparisonLabel} unit="%" dm={dm} color="amber" icon={Factory} />
        <KPICard compact label="Export to Sugar" value={p.Export_Sugar} compareValue={cp.Export_Sugar} compareLabel={comparisonLabel} dm={dm} color="green" icon={Plug} />
        <KPICard compact label="Export to Cogen" value={p.Export_Cogen} compareValue={cp.Export_Cogen} compareLabel={comparisonLabel} dm={dm} color="violet" icon={Plug} />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-1.5">
        <div className="lg:col-span-3 min-h-0 grid gap-1.5" style={{ gridTemplateRows: '1fr 1fr' }}>
          <BandCard title="External & Internal — Breakup" dm={dm} bodyClassName="overflow-visible">
            <ResponsiveContainer width="100%" height="100%" minHeight={120}>
              <PieChart>
                <Pie data={externalPie} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="74%" paddingAngle={2}>
                  {(externalPie || []).map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCompact(v)} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
              </PieChart>
            </ResponsiveContainer>
          </BandCard>
          <BandCard title="Internal Consumption — Breakup" dm={dm} bodyClassName="overflow-visible">
            <ResponsiveContainer width="100%" height="100%" minHeight={120}>
              <PieChart>
                <Pie data={consumptionPie} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="74%" paddingAngle={2}>
                  {(consumptionPie || []).map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCompact(v)} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
              </PieChart>
            </ResponsiveContainer>
          </BandCard>
        </div>

        <div className="lg:col-span-9 min-h-0 grid gap-1.5" style={{ gridTemplateRows: 'repeat(4, minmax(0, 1fr))' }}>
          {trendRows.map((r) => (
            <div key={r.key} className="min-h-0 grid grid-cols-[9rem_minmax(0,1fr)] gap-1.5">
              <KPICard compact label={r.label} value={r.value} dm={dm} color="blue" icon={Plug} />
              <BandCard title={`${r.label} — Day wise trend`} dm={dm}>
                <ResponsiveContainer width="100%" height="100%" minHeight={48}>
                  <AreaChart data={daily} margin={{ top: 2, right: 6, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(dm)} vertical={false} />
                    <XAxis dataKey="label" hide />
                    <YAxis tick={{ fontSize: 8, fill: axisStroke(dm) }} width={32} tickFormatter={(v) => formatCompact(v, 0)} />
                    <Tooltip content={<ChartTip dm={dm} />} />
                    <Area type="monotone" dataKey={r.key} name={r.label} stroke={r.color} fill={`${r.color}33`} strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </BandCard>
            </div>
          ))}
        </div>
      </div>
      <UnitNote dm={dm} />
    </FitShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STEAM SUMMARY — 150 / 70 / 35 aligned rows (PBI)
   ═══════════════════════════════════════════════════════════════════ */
export function SteamSummaryView({ steamKpis, compareSteamKpis, comparisonLabel, daily, dm }) {
  const s = steamKpis || {};
  const cs = compareSteamKpis || {};
  const bands = [
    {
      tph: '150 TPH',
      gen: s.SteamGen150,
      bag: s.Baggase150,
      sb: s.StmtoBaggase150,
      genKey: 'SteamGen150',
      bagKey: 'Baggase150',
      tg: [
        ['30 MW', s.SteamCon30MW],
        ['4 MW', s.Stm4MWTG110_45ATAPRDS],
        ['3 MW New', s.Stmto3New110_45ATAPRDS],
        ['3 MW Old', s.Stmto3Old110_45ATAPRDS],
      ],
      tgKeys: [
        { key: 'SteamCon30MW', name: '30', color: '#3b82f6' },
        { key: 'Stm4MWTG110_45ATAPRDS', name: '4', color: '#3b82f6' },
        { key: 'Stmto3New110_45ATAPRDS', name: '3N', color: '#60a5fa' },
        { key: 'Stmto3Old110_45ATAPRDS', name: '3O', color: '#93c5fd' },
      ],
    },
    {
      tph: '70 TPH',
      gen: s.SteamGen70,
      bag: s.Baggase70,
      sb: s.StmtoBaggase70,
      genKey: 'SteamGen70',
      bagKey: 'Baggase70',
      tg: [
        ['3 MW New', s.StmCons3New70],
        ['3 MW Old', s.StmCons3Old70],
        ['4 MW', s.Stmto4_70TPH],
      ],
      tgKeys: [
        { key: 'StmCons3New70', name: '3N', color: '#60a5fa' },
        { key: 'StmCons3Old70', name: '3O', color: '#3b82f6' },
        { key: 'Stmto4_70TPH', name: '4', color: '#3b82f6' },
      ],
    },
    {
      tph: '35 TPH',
      gen: s.SteamGen35,
      bag: s.Baggase35,
      sb: s.StmtoBaggase35,
      genKey: 'SteamGen35',
      bagKey: 'Baggase35',
      tg: [['4 MW', s.StmCons4]],
      tgKeys: [{ key: 'StmCons4', name: '4 MW', color: '#3b82f6' }],
    },
  ];

  return (
    <FitShell>
      <div className="grid grid-cols-2 gap-3 shrink-0">
        <KPICard compact label="Total Steam Gen." value={s.TotalSteamgen} compareValue={cs.TotalSteamgen} compareLabel={comparisonLabel} unit="MT" dm={dm} color="blue" icon={Flame} info="Steam generated across 150 / 70 / 35 TPH boilers (MT)." />
        <KPICard compact label="Total Bagasse Con." value={s.TotalBaggase} compareValue={cs.TotalBaggase} compareLabel={comparisonLabel} unit="MT" dm={dm} color="amber" icon={Leaf} info="Bagasse consumed across boilers (MT)." />
      </div>

      <div className="flex-1 min-h-0 grid gap-1.5" style={{ gridTemplateRows: 'repeat(3, minmax(0, 1fr))' }}>
        {bands.map((b) => (
          <div key={b.tph} className="min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-1.5">
            <BandCard title={b.tph} dm={dm} className="lg:col-span-2 h-full" bodyClassName="flex flex-col justify-center gap-1">
              <MetricLine label="Steam Generation" value={b.gen} dm={dm} emphasize />
              <MetricLine label="Bagasse (MT)" value={b.bag} dm={dm} />
              <MetricLine label="Steam to Bagasse" value={b.sb != null ? formatNum(b.sb, 2) : '—'} dm={dm} />
            </BandCard>

            <BandCard title={`Steam Generation & Bagasse — ${b.tph}`} dm={dm} className="lg:col-span-5 h-full" bodyClassName="overflow-visible">
              <ResponsiveContainer width="100%" height="100%" minHeight={70}>
                <AreaChart data={daily} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(dm)} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 8, fill: axisStroke(dm) }} interval="preserveStartEnd" height={14} />
                  <YAxis tick={{ fontSize: 8, fill: axisStroke(dm) }} width={32} />
                  <Tooltip content={<ChartTip dm={dm} />} />
                  <Legend wrapperStyle={{ fontSize: 9 }} />
                  <Area type="monotone" dataKey={b.genKey} name="Steam Gen" stroke="#3b82f6" fill="#3b82f655" />
                  <Area type="monotone" dataKey={b.bagKey} name="Bagasse" stroke="#10b981" fill="#10b98144" />
                </AreaChart>
              </ResponsiveContainer>
            </BandCard>

            <div className="lg:col-span-5 min-h-0 grid grid-cols-[minmax(11.5rem,13.5rem)_minmax(0,1fr)] gap-1.5">
              <BandCard
                title={`Steam to TG — ${b.tph}`}
                titleWrap
                dm={dm}
                className="h-full"
                bodyClassName="flex flex-col justify-center gap-1 overflow-visible px-2.5 pb-2"
              >
                {b.tg.map(([lab, val]) => (
                  <MetricLine key={lab} label={lab} value={val} dm={dm} />
                ))}
              </BandCard>
              <BandCard title={`Steam to Turbine from ${b.tph}`} dm={dm} className="h-full" bodyClassName="overflow-visible">
                <ResponsiveContainer width="100%" height="100%" minHeight={70}>
                  <AreaChart data={daily} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(dm)} vertical={false} />
                    <XAxis dataKey="label" hide />
                    <YAxis tick={{ fontSize: 8, fill: axisStroke(dm) }} width={28} />
                    <Tooltip content={<ChartTip dm={dm} />} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    {b.tgKeys.map((k) => (
                      <Area key={k.key} type="monotone" dataKey={k.key} name={k.name} stroke={k.color} fill={`${k.color}44`} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </BandCard>
            </div>
          </div>
        ))}
      </div>
      <UnitNote text="*All units in MT, unless otherwise mentioned." dm={dm} />
    </FitShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STEAM CONSUMPTION — process rows 150/70/35 + right KPI grid
   ═══════════════════════════════════════════════════════════════════ */
export function SteamConsumptionView({ steamKpis, compareSteamKpis, comparisonLabel, daily, dm }) {
  const s = steamKpis || {};
  const cs = compareSteamKpis || {};
  const processRows = [
    {
      tag: '150',
      metrics: [
        ['Steam to Sugar', s.TotalStmtoSug150],
        ['Steam to Distillery', s.StmtoDistil110_45ATAPRDS_o],
        ['Steam to Mill', s.StmMillTurbine110_45ATAPRDS],
      ],
      keys: [
        { key: 'SteamToSugar150', name: 'Sugar', color: '#3b82f6' },
        { key: 'SteamToDist150', name: 'Dist', color: '#3b82f6' },
        { key: 'SteamToMill150', name: 'Mill', color: '#60a5fa' },
      ],
    },
    {
      tag: '70',
      metrics: [
        ['Steam to Sugar', s.StmtoSug70TPH],
        ['Steam to Distillery', s.StmDist70],
        ['Steam to Mill', s.StmConsMillTB_PRDS],
      ],
      keys: [
        { key: 'SteamToSugar70', name: 'Sugar', color: '#3b82f6' },
        { key: 'SteamToDist70', name: 'Dist', color: '#3b82f6' },
        { key: 'SteamToMill70', name: 'Mill', color: '#60a5fa' },
      ],
    },
    {
      tag: '35',
      metrics: [
        ['Steam to Sugar', s.StmtoSugDisti],
        ['Steam to Distillery', s.StmtoDistill35TPH],
        ['Steam to Mill', 0],
      ],
      keys: [
        { key: 'SteamToSugar35', name: 'Sugar', color: '#3b82f6' },
        { key: 'SteamToDist35', name: 'Dist', color: '#3b82f6' },
      ],
    },
  ];

  const rightKpis = [
    ['Steam through 45/5.5 ATA Deareator & Ejector PRDS', s.Stm45_55ATADeareatorEjectorPRDS],
    ['Steam through 45/5.5 ATA Process PRDS', s.StmCons45_55ATAPRDS],
    ['Steam to 35T Boiler Deareator from TG', s.Stm35TDeareator],
    ['Steam to Ejector (35TPH)', s.StmtoEjector],
    ['Steam to Deareator (150 TPH)', s.Stmtodeareator150],
    ['Steam to Turbine Condenser 4MW', s.StmtoTBCondensor],
  ];

  return (
    <FitShell>
      <div className="grid grid-cols-3 gap-3 shrink-0">
        <KPICard compact label="Steam Gen · 150 TPH" value={s.SteamGen150} compareValue={cs.SteamGen150} compareLabel={comparisonLabel} dm={dm} color="blue" icon={Flame} info="Steam generation from 150 TPH boiler (MT)." />
        <KPICard compact label="Steam Gen · 70 TPH" value={s.SteamGen70} compareValue={cs.SteamGen70} compareLabel={comparisonLabel} dm={dm} color="amber" icon={Flame} info="Steam generation from 70 TPH boiler (MT)." />
        <KPICard compact label="Steam Gen · 35 TPH" value={s.SteamGen35} compareValue={cs.SteamGen35} compareLabel={comparisonLabel} dm={dm} color="green" icon={Droplets} info="Steam generation from 35 TPH boiler (MT)." />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-1.5">
        <BandCard title="Steam to Process" tone="amber" dm={dm} className="lg:col-span-7 h-full" bodyClassName="p-1.5 flex flex-col gap-1.5 min-h-0">
          <div className="flex-1 min-h-0 grid gap-1.5" style={{ gridTemplateRows: 'repeat(3, minmax(0, 1fr))' }}>
            {processRows.map((row) => (
              <div key={row.tag} className="min-h-0 grid grid-cols-[minmax(10rem,12rem)_minmax(0,1fr)] gap-2">
                <div className={`rounded-lg border flex flex-col min-w-0 overflow-hidden ${dm ? 'border-slate-700 bg-slate-950/50' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="px-2 py-0.5 bg-gradient-to-r from-slate-800 via-blue-950 to-slate-900 text-center text-[10px] font-black text-white shrink-0">
                    {row.tag}
                  </div>
                  <div className="flex-1 min-h-0 p-2 flex flex-col justify-center gap-1">
                    {row.metrics.map(([lab, val]) => (
                      <MetricLine key={lab} label={lab} value={val} dm={dm} stacked />
                    ))}
                  </div>
                </div>
                <div className="min-h-0 min-w-0 rounded-lg border overflow-hidden" style={{ borderColor: dm ? '#334155' : '#e2e8f0' }}>
                  <ResponsiveContainer width="100%" height="100%" minHeight={56}>
                    <LineChart data={daily} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(dm)} vertical={false} />
                      <XAxis dataKey="label" hide />
                      <YAxis tick={{ fontSize: 8, fill: axisStroke(dm) }} width={36} />
                      <Tooltip content={<ChartTip dm={dm} />} />
                      <Legend wrapperStyle={{ fontSize: 9 }} />
                      {row.keys.map((k) => (
                        <Line key={k.key} type="monotone" dataKey={k.key} name={k.name} stroke={k.color} dot={false} strokeWidth={1.5} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>
        </BandCard>

        <div className="lg:col-span-5 min-h-0 flex flex-col gap-1.5">
          <BandCard title="Steam to Process Trend" dm={dm} className="flex-[1.1] min-h-0" bodyClassName="overflow-visible">
            <ResponsiveContainer width="100%" height="100%" minHeight={90}>
              <AreaChart data={daily} stackOffset="expand" margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(dm)} />
                <XAxis dataKey="label" tick={{ fontSize: 8, fill: axisStroke(dm) }} interval="preserveStartEnd" height={14} />
                <YAxis tick={{ fontSize: 8, fill: axisStroke(dm) }} width={28} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                <Tooltip content={<ChartTip dm={dm} />} />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Area type="monotone" stackId="1" dataKey="SugarShare" name="Sugar" stroke="#3b82f6" fill="#3b82f6" />
                <Area type="monotone" stackId="1" dataKey="MillShare" name="Mill" stroke="#3b82f6" fill="#3b82f6" />
                <Area type="monotone" stackId="1" dataKey="DistShare" name="Dist" stroke="#60a5fa" fill="#60a5fa" />
              </AreaChart>
            </ResponsiveContainer>
          </BandCard>

          <div className="grid grid-cols-3 gap-3 shrink-0">
            {rightKpis.map(([lab, val]) => (
              <KPICard key={lab} compact label={lab} value={val} dm={dm} color="blue" icon={Droplets} />
            ))}
          </div>

          <BandCard title="Extraction Steam 150 TPH" dm={dm} className="shrink-0" bodyClassName="p-2">
            <p className="text-xl font-black tabular-nums mb-1.5">{formatCompact(s.ExtractionStm30MW)}</p>
            <div className="grid grid-cols-3 gap-2">
              <MetricLine label="HP Heater 2" value={s.Bleed1HPH2Stm} dm={dm} />
              <MetricLine label="HP Heater 1" value={s.Bleed2HPH1Stm} dm={dm} />
              <MetricLine label="30MW Condenser" value={s.Stmto30MW_TGCondenser} dm={dm} />
            </div>
          </BandCard>
        </div>
      </div>
      <UnitNote text="*All units in MT, unless otherwise mentioned." dm={dm} />
    </FitShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   OUTAGE — PBI Outage Dashboard layout
   ═══════════════════════════════════════════════════════════════════ */
export function PowerOutageView({
  outageKpis,
  compareOutageKpis,
  comparisonLabel,
  dm,
  sections,
  categories,
  outageSection,
  outageCategory,
  setOutageSection,
  setOutageCategory,
  filteredStoppages,
  outageDaily,
  outageBySection,
}) {
  const o = outageKpis || {};
  const co = compareOutageKpis || {};
  const filteredKpis = computeOutageKpis(filteredStoppages);
  const boilerStack = buildOutageStackedBySubSection(filteredStoppages, isBoilerSection).slice(0, 8);
  const turbineStack = buildOutageStackedBySubSection(filteredStoppages, isTurbineSection).slice(0, 8);
  const boilerSeries = Array.from(
    new Set(boilerStack.flatMap((r) => Object.keys(r).filter((k) => k !== 'name' && k !== '_total'))),
  );
  const turbineSeries = Array.from(
    new Set(turbineStack.flatMap((r) => Object.keys(r).filter((k) => k !== 'name' && k !== '_total'))),
  );
  const machBoiler = groupOutageMachinery(filteredStoppages, isBoilerSection).slice(0, 30);
  const machTurbine = groupOutageMachinery(filteredStoppages, isTurbineSection).slice(0, 30);
  const remarks = (filteredStoppages || []).filter((r) => r.remarks).slice(0, 40);

  return (
    <FitShell>
      <div
        className={`flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-1.5 shrink-0 ${
          dm ? 'border-slate-800 bg-slate-900' : 'border-slate-200/80 bg-white'
        }`}
        style={{ boxShadow: cardShadow(dm) }}
      >
        <KPICard compact label="Outage Duration (Hrs)" value={filteredKpis.totalDuration} dm={dm} color="red" icon={TimerReset} info="Signed stoppage hours for the selected section/category filter." />
        <Filter className={`w-3.5 h-3.5 ${dm ? 'text-slate-400' : 'text-slate-500'}`} />
        <select
          value={outageSection}
          onChange={(e) => setOutageSection(e.target.value)}
          className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${dm ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}
        >
          {sections.map((s) => (
            <option key={`sec-${s}`} value={s}>
              {s === 'ALL' ? 'All sections' : s}
            </option>
          ))}
        </select>
        <select
          value={outageCategory}
          onChange={(e) => setOutageCategory(e.target.value)}
          className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${dm ? 'bg-slate-950 border-slate-700' : 'bg-white border-slate-200'}`}
        >
          {categories.map((c) => (
            <option key={`cat-${c}`} value={c}>
              {c === 'ALL' ? 'All categories' : c}
            </option>
          ))}
        </select>
        <span className={`text-[10px] font-semibold ml-auto ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
          {filteredStoppages.length} incidents · all {formatCompact(outageKpis.totalDuration, 1)} hrs
        </span>
      </div>

      <div
        className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-1.5"
        style={{ gridTemplateRows: 'minmax(0,1.15fr) minmax(0,1fr) minmax(0,0.95fr)' }}
      >
        <BandCard title="Outage Duration (Hrs) — Daily Trend" dm={dm} className="lg:col-span-7 min-h-0 h-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={100}>
            <LineChart data={outageDaily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(dm)} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: axisStroke(dm) }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9, fill: axisStroke(dm) }} width={36} />
              <Tooltip content={<ChartTip dm={dm} />} />
              <Line type="monotone" dataKey="duration" name="Hours" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </BandCard>
        <BandCard title="Sub-Section — Boiler" dm={dm} className="lg:col-span-5 min-h-0 h-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={100}>
            <BarChart data={boilerStack} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(dm)} />
              <XAxis type="number" tick={{ fontSize: 8, fill: axisStroke(dm) }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 8, fill: axisStroke(dm) }} />
              <Tooltip content={<ChartTip dm={dm} />} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              {boilerSeries.map((sec, i) => (
                <Bar key={sec} dataKey={sec} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </BandCard>

        <BandCard title="Total Outage (Hours) — Section Wise" dm={dm} className="lg:col-span-7 min-h-0 h-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={100}>
            <BarChart data={outageBySection} margin={{ top: 16, right: 8, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(dm)} />
              <XAxis dataKey="name" tick={{ fontSize: 8, fill: axisStroke(dm) }} interval={0} angle={-25} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 9, fill: axisStroke(dm) }} width={36} />
              <Tooltip content={<ChartTip dm={dm} />} />
              <Bar dataKey="duration" name="Hours" fill="#3b82f6" radius={[3, 3, 0, 0]}>
                <LabelList dataKey="duration" position="top" formatter={(v) => formatNum(v, 0)} style={{ fontSize: 9, fontWeight: 700 }} />
                {(outageBySection || []).map((d, i) => (
                  <Cell key={i} fill={d.duration < 0 ? '#94a3b8' : CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </BandCard>
        <BandCard title="Sub-Section — Turbine" dm={dm} className="lg:col-span-5 min-h-0 h-full">
          <ResponsiveContainer width="100%" height="100%" minHeight={100}>
            <BarChart data={turbineStack} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke(dm)} />
              <XAxis type="number" tick={{ fontSize: 8, fill: axisStroke(dm) }} />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 8, fill: axisStroke(dm) }} />
              <Tooltip content={<ChartTip dm={dm} />} />
              <Legend wrapperStyle={{ fontSize: 9 }} />
              {turbineSeries.map((sec, i) => (
                <Bar key={sec} dataKey={sec} stackId="a" fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </BandCard>

        <BandCard title="Remarks" dm={dm} className="lg:col-span-4 min-h-0 h-full">
          <DTableCompact
            dm={dm}
            cols={[
              { key: 'Date', label: 'Date' },
              { key: 'remarks', label: 'Remarks' },
            ]}
            rows={remarks}
          />
        </BandCard>
        <BandCard title="Machinery — Boilers" dm={dm} className="lg:col-span-4 min-h-0 h-full">
          <DTableCompact
            dm={dm}
            cols={[
              { key: 'machinery', label: 'Machinery' },
              { key: 'section', label: 'Section' },
              { key: 'Duration', label: 'Duration', fmt: (v) => formatNum(v, 1) },
            ]}
            rows={machBoiler}
          />
        </BandCard>
        <BandCard title="Machinery — Turbines" dm={dm} className="lg:col-span-4 min-h-0 h-full">
          <DTableCompact
            dm={dm}
            cols={[
              { key: 'machinery', label: 'Machinery' },
              { key: 'section', label: 'Section' },
              { key: 'Duration', label: 'Duration', fmt: (v) => formatNum(v, 1) },
            ]}
            rows={machTurbine}
          />
        </BandCard>
      </div>
    </FitShell>
  );
}

export function PowerDataView({ dm, dataSub, setDataSub, powerRows, steamRows, stoppageRows }) {
  return (
    <FitShell>
      <div className="flex gap-2 shrink-0">
        {[
          { id: 'power', label: 'Power' },
          { id: 'steam', label: 'Steam' },
          { id: 'outage', label: 'Outage' },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setDataSub(s.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              dataSub === s.id
                ? 'bg-blue-600 text-white'
                : dm
                  ? 'bg-slate-900 text-slate-300 border border-slate-800'
                  : 'bg-white text-slate-600 border border-slate-200'
            }`}
            style={dataSub !== s.id ? { boxShadow: cardShadow(dm) } : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0" style={{ boxShadow: cardShadow(dm) }}>
        {dataSub === 'power' && (
          <DTableCompact
            dm={dm}
            cols={[
              { key: 'Date', label: 'Date' },
              { key: 'PowerGen30', label: 'Gen 30', fmt: (v) => formatCompact(v) },
              { key: 'PowerGen3Old', label: 'Gen 3O', fmt: (v) => formatCompact(v) },
              { key: 'PowerGen3New', label: 'Gen 3N', fmt: (v) => formatCompact(v) },
              { key: 'PowerGen4MW', label: 'Gen 4', fmt: (v) => formatCompact(v) },
              { key: 'ExportGrid30', label: 'Grid', fmt: (v) => formatCompact(v) },
              { key: 'Imp_Grid', label: 'Import', fmt: (v) => formatCompact(v) },
              { key: 'Crush', label: 'Crush', fmt: (v) => formatCompact(v) },
              { key: 'remark', label: 'Remark' },
            ]}
            rows={powerRows}
          />
        )}
        {dataSub === 'steam' && (
          <DTableCompact
            dm={dm}
            cols={[
              { key: 'Date', label: 'Date' },
              { key: 'SteamGen150', label: 'Gen 150', fmt: (v) => formatCompact(v) },
              { key: 'SteamGen70', label: 'Gen 70', fmt: (v) => formatCompact(v) },
              { key: 'SteamGen35', label: 'Gen 35', fmt: (v) => formatCompact(v) },
              { key: 'Baggase150', label: 'Bag 150', fmt: (v) => formatCompact(v) },
              { key: 'SteamCon30MW', label: 'Stm 30', fmt: (v) => formatCompact(v) },
              { key: 'StmCons4', label: 'Stm 4', fmt: (v) => formatCompact(v) },
            ]}
            rows={steamRows}
          />
        )}
        {dataSub === 'outage' && (
          <DTableCompact
            dm={dm}
            cols={[
              { key: 'Date', label: 'Date' },
              { key: 'section', label: 'Section' },
              { key: 'sub_section', label: 'Sub' },
              { key: 'machinery', label: 'Machinery' },
              { key: 'category', label: 'Category' },
              { key: 'Duration', label: 'Hrs', fmt: (v) => (v != null ? formatNum(v, 2) : '—') },
              { key: 'remarks', label: 'Remarks' },
            ]}
            rows={stoppageRows}
          />
        )}
      </div>
    </FitShell>
  );
}
