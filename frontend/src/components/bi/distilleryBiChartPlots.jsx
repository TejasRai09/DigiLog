import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  AreaChart,
  Line,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';

export const CHART_LEGEND_WRAPPER_STYLE = {
  fontSize: '10px',
  fontWeight: 'bold',
  paddingTop: '10px',
  zIndex: 0,
};

export const CHART_TOOLTIP_WRAPPER_STYLE = { zIndex: 50 };

export function DistilleryChartTooltip({ active, payload, label, isDarkMode }) {
  if (!active || !payload?.length) return null;
  const fmt = (v, name) => {
    if (typeof v !== 'number') return String(v);
    const n = String(name || '');
    const isPct = n.includes('%') || n.includes('Eff') || n.includes('Sugar') || n.includes('Alcohol');
    const isRecBl = n.includes('REC BL') || n === 'Recovery';
    const body = Math.abs(v) >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v.toFixed(2);
    if (isRecBl) return body;
    return `${body}${isPct ? '%' : ''}`;
  };
  return (
    <div
      className={`rounded-xl border p-3 text-xs font-bold shadow-xl backdrop-blur-sm ${
        isDarkMode ? 'border-slate-700 bg-slate-800/95 text-slate-200' : 'border-slate-200 bg-white/95 text-slate-700'
      }`}
    >
      <p
        className={`mb-2 border-b pb-2 ${isDarkMode ? 'border-slate-700 text-slate-400' : 'border-slate-100 text-slate-500'}`}
      >
        {label}
      </p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className={isDarkMode ? 'text-slate-300' : 'text-slate-600'}>{entry.name}:</span>
            </div>
            <span className="font-mono">{fmt(entry.value, entry.name)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function plotShell({ data, isDarkMode, axisStyle, gridStyle, height = '100%', children }) {
  if (!data?.length) {
    return (
      <div className="flex h-full min-h-[12rem] items-center justify-center text-sm font-semibold text-slate-400">
        No data for selected filters
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
}

export function EthanolVolChart({ data, isDarkMode, axisStyle, gridStyle, idPrefix = '', height }) {
  return plotShell({ data, isDarkMode, axisStyle, gridStyle, height, children: (
    <ComposedChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
      <CartesianGrid {...gridStyle} vertical={false} />
      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axisStyle} dy={10} minTickGap={30} />
      <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `${v / 1000}k`} />
      <YAxis
        yAxisId="right"
        orientation="right"
        axisLine={false}
        tickLine={false}
        tick={axisStyle}
        domain={['auto', 'auto']}
        tickFormatter={(v) => `${Number(v).toFixed(0)}`}
      />
      <RechartsTooltip wrapperStyle={CHART_TOOLTIP_WRAPPER_STYLE} content={<DistilleryChartTooltip isDarkMode={isDarkMode} />} />
      <Legend wrapperStyle={CHART_LEGEND_WRAPPER_STYLE} iconType="circle" />
      <Bar yAxisId="left" dataKey="bHeavyProd" stackId="a" name="B Heavy (BL)" fill="#60a5fa" />
      <Bar yAxisId="left" dataKey="cHeavyProd" stackId="a" name="C Heavy (BL)" fill="#34d399" />
      <Bar yAxisId="left" dataKey="syrupProd" stackId="a" name="Syrup (BL)" fill="#6366f1" />
      <Bar yAxisId="left" dataKey="mixedProd" stackId="a" name="Mixed (BL)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
      <Line yAxisId="right" type="monotone" dataKey="recovery" name="REC BL" stroke="#22c55e" strokeWidth={2.5} dot={false} />
    </ComposedChart>
  ) });
}

export function FermSugarChart({ data, isDarkMode, axisStyle, gridStyle, idPrefix = '', height }) {
  return plotShell({ data, isDarkMode, axisStyle, gridStyle, height, children: (
    <LineChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
      <CartesianGrid {...gridStyle} vertical={false} />
      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axisStyle} dy={10} minTickGap={30} />
      <YAxis axisLine={false} tickLine={false} tick={axisStyle} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v) => `${v.toFixed(2)}%`} />
      <RechartsTooltip wrapperStyle={CHART_TOOLTIP_WRAPPER_STYLE} content={<DistilleryChartTooltip isDarkMode={isDarkMode} />} />
      <Legend wrapperStyle={CHART_LEGEND_WRAPPER_STYLE} iconType="circle" />
      <Line type="monotone" dataKey="fermSugar" name="Ferm. Sugar %" stroke="#a855f7" strokeWidth={2.5} dot={false} />
      <Line type="monotone" dataKey="alcohol" name="Alcohol %" stroke="#d97706" strokeWidth={2.5} strokeDasharray="4 4" dot={{ r: 2, fill: '#d97706' }} />
    </LineChart>
  ) });
}

export function OverallEfficiencyChart({ data, isDarkMode, axisStyle, gridStyle, idPrefix = '', height }) {
  return plotShell({ data, isDarkMode, axisStyle, gridStyle, height, children: (
    <LineChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
      <CartesianGrid {...gridStyle} vertical={false} />
      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axisStyle} dy={10} minTickGap={30} />
      <YAxis domain={['dataMin - 2', 100]} axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `${v.toFixed(0)}%`} />
      <RechartsTooltip wrapperStyle={CHART_TOOLTIP_WRAPPER_STYLE} content={<DistilleryChartTooltip isDarkMode={isDarkMode} />} />
      <Legend wrapperStyle={CHART_LEGEND_WRAPPER_STYLE} iconType="circle" />
      <Line type="monotone" dataKey="fermEff" name="Ferm. Efficiency" stroke="#eab308" strokeWidth={2.5} dot={false} />
      <Line type="monotone" dataKey="distEff" name="Dist. Efficiency" stroke="#22c55e" strokeWidth={2.5} dot={false} />
      <Line type="monotone" dataKey="overallEff" name="Overall Eff (OE)" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 3" dot={false} />
    </LineChart>
  ) });
}

export function WashDistilledChart({ data, isDarkMode, axisStyle, gridStyle, idPrefix = '', height }) {
  const gradId = `colorWash${idPrefix}`;
  return plotShell({ data, isDarkMode, axisStyle, gridStyle, height, children: (
    <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid {...gridStyle} vertical={false} />
      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axisStyle} dy={10} minTickGap={30} />
      <YAxis axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
      <RechartsTooltip wrapperStyle={CHART_TOOLTIP_WRAPPER_STYLE} content={<DistilleryChartTooltip isDarkMode={isDarkMode} />} />
      <Area type="monotone" dataKey="totalWash" name="Wash Volume" stroke="#ea580c" strokeWidth={2} fillOpacity={1} fill={`url(#${gradId})`} />
    </AreaChart>
  ) });
}

export function MolassesStockChart({ data, isDarkMode, axisStyle, gridStyle, idPrefix = '', height }) {
  const gradId = `colorMol${idPrefix}`;
  return plotShell({ data, isDarkMode, axisStyle, gridStyle, height, children: (
    <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid {...gridStyle} vertical={false} />
      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axisStyle} dy={10} minTickGap={30} />
      <YAxis axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
      <RechartsTooltip wrapperStyle={CHART_TOOLTIP_WRAPPER_STYLE} content={<DistilleryChartTooltip isDarkMode={isDarkMode} />} />
      <Area type="monotone" dataKey="molInStore" name="Molasses Stock" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill={`url(#${gradId})`} />
    </AreaChart>
  ) });
}

export function EthanolStockChart({ data, isDarkMode, axisStyle, gridStyle, idPrefix = '', height }) {
  const gradId = `colorEth${idPrefix}`;
  return plotShell({ data, isDarkMode, axisStyle, gridStyle, height, children: (
    <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid {...gridStyle} vertical={false} />
      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={axisStyle} dy={10} minTickGap={30} />
      <YAxis axisLine={false} tickLine={false} tick={axisStyle} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
      <RechartsTooltip wrapperStyle={CHART_TOOLTIP_WRAPPER_STYLE} content={<DistilleryChartTooltip isDarkMode={isDarkMode} />} />
      <Area type="monotone" dataKey="ethInStore" name="Ethanol Stock" stroke="#dc2626" strokeWidth={2} fillOpacity={1} fill={`url(#${gradId})`} />
    </AreaChart>
  ) });
}

export const DISTILLERY_CHART_META = {
  'ethanol-vol': {
    title: 'Ethanol Vol',
    definition:
      'Daily ethanol produced by operation mode (B Heavy / C Heavy / Syrup / Mixed), with PBI REC BL (BL per quintal feed).',
    dataKey: 'totalProd',
    higherIsBetter: true,
  },
  'ferm-sugar': {
    title: 'Ferm. Sugar',
    definition:
      'Tracks fermentable sugar as FS/TRS × 100 (PBI FS %) against wash alcohol %.',
    dataKey: 'fermSugar',
    higherIsBetter: true,
  },
  'overall-efficiency': {
    title: 'Overall Efficiency',
    definition:
      'Fermentation Efficiency (FE), Distillation Efficiency (DE), and Overall Efficiency OE = FE×DE.',
    dataKey: 'fermEff',
    higherIsBetter: true,
  },
  'wash-distilled': {
    title: 'Wash Distilled',
    definition: 'Total volume of wash processed through the distillation system during the selected time period.',
    dataKey: 'totalWash',
    higherIsBetter: true,
  },
  'molasses-stock': {
    title: 'Molasses Stock',
    definition: 'BH + CH molasses inventory (PBI Total Mol in Store).',
    dataKey: 'molInStore',
    higherIsBetter: false,
  },
  'ethanol-stock': {
    title: 'Ethanol Stock',
    definition:
      'Finished ethanol inventory (PBI Ethanol in Storage).',
    dataKey: 'ethInStore',
    higherIsBetter: false,
  },
};

/** @type {Record<string, { slug: string; csvColumns: { key: string; label: string }[]; Plot: React.ComponentType }>} */
export const DISTILLERY_CHART_PLOTS = {
  'ethanol-vol': {
    slug: 'ethanol-vol',
    csvColumns: [
      { key: 'dateFull', label: 'Date' },
      { key: 'date', label: 'Date label' },
      { key: 'bHeavyProd', label: 'B Heavy (BL)' },
      { key: 'cHeavyProd', label: 'C Heavy (BL)' },
      { key: 'syrupProd', label: 'Syrup (BL)' },
      { key: 'mixedProd', label: 'Mixed (BL)' },
      { key: 'totalProd', label: 'Total ethanol (BL)' },
      { key: 'recovery', label: 'REC BL' },
      { key: 'alBlRatioPct', label: 'AL to BL Ratio (%)' },
    ],
    Plot: EthanolVolChart,
  },
  'ferm-sugar': {
    slug: 'ferm-sugar',
    csvColumns: [
      { key: 'dateFull', label: 'Date' },
      { key: 'date', label: 'Date label' },
      { key: 'fermSugar', label: 'Ferm. Sugar % (FS/TRS)' },
      { key: 'alcohol', label: 'Alcohol %' },
    ],
    Plot: FermSugarChart,
  },
  'overall-efficiency': {
    slug: 'overall-efficiency',
    csvColumns: [
      { key: 'dateFull', label: 'Date' },
      { key: 'date', label: 'Date label' },
      { key: 'fermEff', label: 'Ferm. Efficiency %' },
      { key: 'distEff', label: 'Dist. Efficiency %' },
      { key: 'overallEff', label: 'Overall Eff % (OE)' },
    ],
    Plot: OverallEfficiencyChart,
  },
  'wash-distilled': {
    slug: 'wash-distilled',
    csvColumns: [
      { key: 'dateFull', label: 'Date' },
      { key: 'date', label: 'Date label' },
      { key: 'totalWash', label: 'Wash distilled' },
    ],
    Plot: WashDistilledChart,
  },
  'molasses-stock': {
    slug: 'molasses-stock',
    csvColumns: [
      { key: 'dateFull', label: 'Date' },
      { key: 'date', label: 'Date label' },
      { key: 'molInStore', label: 'Molasses stock' },
    ],
    Plot: MolassesStockChart,
  },
  'ethanol-stock': {
    slug: 'ethanol-stock',
    csvColumns: [
      { key: 'dateFull', label: 'Date' },
      { key: 'date', label: 'Date label' },
      { key: 'ethInStore', label: 'Ethanol stock (BL)' },
    ],
    Plot: EthanolStockChart,
  },
};

