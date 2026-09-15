import { useCallback, useEffect, useRef, useState } from 'react';
import { MdClose, MdDownload, MdImage } from 'react-icons/md';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
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
import { downloadChartCsv, downloadContainerChartPng } from '../../utils/chartExport';
import { trackChartDownloadCsv } from '../../utils/trackActivity';
import { BI_DASHBOARDS } from '../../utils/activityPath';
import { formatCompact } from '../../utils/powerHouseMeasures';
import { ChartTip, CHART_COLORS, axisStroke } from './powerHouseUi';

function slugify(title) {
  return String(title || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ExpandedPlot({ config, dm }) {
  const {
    kind = 'line',
    data = [],
    series = [],
    xKey = 'label',
    yPercent = false,
    domain,
    suffix = '',
  } = config;
  const stroke = dm ? '#334155' : '#cbd5e1';
  const tick = { fontSize: 11, fill: axisStroke(dm) };
  const grid = { strokeDasharray: '3 3', stroke: dm ? '#1e293b' : '#e2e8f0' };
  const yFmt = yPercent ? (v) => `${Math.round(Number(v) * (Number(v) <= 1 ? 100 : 1))}%` : (v) => formatCompact(v, 0);
  const margin = { top: 12, right: 20, left: 4, bottom: 8 };

  if (kind === 'pie') {
    const pieData = data || [];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="46%" outerRadius="72%" paddingAngle={2} label={({ name, percent }) => `${name} ${Math.round((percent || 0) * 100)}%`}>
            {pieData.map((d, i) => (
              <Cell key={d.name || i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatCompact(v)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (kind === 'bar-h') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ ...margin, left: 8 }}>
          <CartesianGrid {...grid} />
          <XAxis type="number" tick={tick} stroke={stroke} />
          <YAxis type="category" dataKey={xKey} width={140} tick={tick} stroke={stroke} />
          <Tooltip content={<ChartTip dm={dm} suffix={suffix} />} />
          <Legend />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name || s.key} stackId={config.stacked ? 'a' : undefined} fill={s.color || CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (kind === 'bar') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={margin}>
          <CartesianGrid {...grid} vertical={false} />
          <XAxis dataKey={xKey} tick={tick} stroke={stroke} interval={0} angle={data.length > 6 ? -25 : 0} textAnchor={data.length > 6 ? 'end' : 'middle'} height={data.length > 6 ? 48 : 28} />
          <YAxis tick={tick} stroke={stroke} tickFormatter={yFmt} />
          <Tooltip content={<ChartTip dm={dm} suffix={suffix} />} />
          <Legend />
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.name || s.key} fill={s.color || CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (kind === 'composed') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={margin}>
          <CartesianGrid {...grid} vertical={false} />
          <XAxis dataKey={xKey} tick={tick} stroke={stroke} interval="preserveStartEnd" />
          <YAxis yAxisId="l" tick={tick} stroke={stroke} tickFormatter={(v) => formatCompact(v, 0)} />
          <YAxis yAxisId="r" orientation="right" tick={tick} stroke={stroke} />
          <Tooltip content={<ChartTip dm={dm} suffix={suffix} />} />
          <Legend />
          {series.map((s) => (
            s.type === 'line' ? (
              <Line key={s.key} yAxisId={s.yAxisId || 'r'} type="monotone" dataKey={s.key} name={s.name || s.key} stroke={s.color} dot={false} strokeWidth={2} />
            ) : (
              <Area key={s.key} yAxisId={s.yAxisId || 'l'} type="monotone" dataKey={s.key} name={s.name || s.key} stroke={s.color} fill={`${s.color}33`} strokeWidth={2} />
            )
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    );
  }

  const Chart = kind === 'line' ? LineChart : AreaChart;
  const stacked = kind === 'area-stack' || kind === 'area-percent';
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Chart data={data} stackOffset={kind === 'area-percent' ? 'expand' : undefined} margin={margin}>
        <CartesianGrid {...grid} vertical={false} />
        <XAxis dataKey={xKey} tick={tick} stroke={stroke} interval="preserveStartEnd" />
        <YAxis tick={tick} stroke={stroke} domain={domain} tickFormatter={kind === 'area-percent' ? (v) => `${Math.round(v * 100)}%` : yFmt} />
        <Tooltip content={<ChartTip dm={dm} suffix={suffix} />} />
        <Legend />
        {series.map((s) => (
          kind === 'line' ? (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name || s.key} stroke={s.color} dot={false} strokeWidth={2.25} />
          ) : (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name || s.key}
              stroke={s.color}
              fill={`${s.color}${stacked ? 'ff' : '44'}`}
              stackId={stacked ? '1' : undefined}
              strokeWidth={2}
            />
          )
        ))}
      </Chart>
    </ResponsiveContainer>
  );
}

export default function PowerChartExpandModal({ config, dm, onClose }) {
  const chartRef = useRef(null);
  const [chartReady, setChartReady] = useState(false);
  const title = config?.title || '';

  useEffect(() => {
    if (!config) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [config, onClose]);

  useEffect(() => {
    setChartReady(false);
    const id = requestAnimationFrame(() => setChartReady(true));
    return () => cancelAnimationFrame(id);
  }, [title]);

  const handleCsv = useCallback(() => {
    if (!config) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const slug = slugify(title);
    const rows = config.data || [];
    const columns = config.kind === 'pie'
      ? [{ key: 'name', label: 'Name' }, { key: 'value', label: 'Value' }]
      : [
          { key: config.xKey || 'label', label: 'Date' },
          ...(config.series || []).map((s) => ({ key: s.key, label: s.name || s.key })),
        ];
    downloadChartCsv(`power-${slug}-${stamp}`, rows, columns);
    trackChartDownloadCsv({
      dashboardLabel: BI_DASHBOARDS['/bi/power-house'],
      chartId: slug,
      chartTitle: title,
    });
  }, [config, title]);

  const handlePng = useCallback(async () => {
    if (!chartRef.current) return;
    await new Promise((r) => requestAnimationFrame(r));
    const stamp = new Date().toISOString().slice(0, 10);
    await downloadContainerChartPng(chartRef.current, `power-${slugify(title)}-${stamp}`, {
      background: dm ? '#0f172a' : '#ffffff',
    });
  }, [dm, title]);

  if (!config?.title) return null;

  const panel = dm ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900';
  const border = dm ? 'border-slate-700' : 'border-slate-200';
  const btn = dm
    ? 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50';

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="power-chart-expand-title">
      <button type="button" className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" aria-label="Close expanded chart" onClick={onClose} />
      <div className={`relative flex max-h-[min(92vh,900px)] w-full max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-t-2xl border shadow-2xl sm:max-w-6xl sm:rounded-2xl ${panel} ${border}`}>
        <div className={`flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 ${border}`}>
          <h2 id="power-chart-expand-title" className="text-lg font-black tracking-tight">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={handleCsv} className={`rounded-lg border p-2 transition-colors ${btn}`} title="Download CSV" aria-label="Download chart data as CSV">
              <MdDownload className="h-5 w-5" />
            </button>
            <button type="button" onClick={handlePng} className={`rounded-lg border p-2 transition-colors ${btn}`} title="Download PNG" aria-label="Download chart as PNG">
              <MdImage className="h-5 w-5" />
            </button>
            <button type="button" onClick={onClose} className={`rounded-full border p-2 transition-colors ${btn}`} title="Close" aria-label="Close">
              <MdClose className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 px-4 py-5 sm:px-6">
          <div ref={chartRef} className="h-[420px] w-full">
            {chartReady && (config.data?.length > 0) ? (
              <ExpandedPlot config={config} dm={dm} />
            ) : (
              <div className={`flex h-full items-center justify-center rounded-xl border border-dashed text-sm font-semibold ${dm ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                {chartReady ? 'No data available' : 'Loading chart…'}
              </div>
            )}
          </div>
        </div>
        <p className={`shrink-0 border-t px-5 py-2.5 text-center text-[9px] font-bold uppercase tracking-widest ${dm ? 'border-slate-700 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
          Press Esc to close
        </p>
      </div>
    </div>
  );
}
