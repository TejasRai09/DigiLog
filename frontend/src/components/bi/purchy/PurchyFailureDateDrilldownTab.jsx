import { useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import PurchyFilterBar from './PurchyFilterBar';
import PurchyTablePagination from './PurchyTablePagination';
import usePurchyFailureDate from '../../../hooks/usePurchyFailureDate';
import { purchyFiltersToParams } from '../../../hooks/usePurchyFilters';
import Spinner from '../../Spinner';


const SLICERS = [
  { key: 'societyName', label: 'Society_Name', optionKey: 'societyName' },
];

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

function DrilldownTable({ title, rows, totals, isDarkMode, loading, fillHeight = false }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    setPage(1);
  }, [rows, pageSize]);

  const pagedRows = useMemo(() => {
    const offset = (page - 1) * pageSize;
    return rows.slice(offset, offset + pageSize);
  }, [rows, page, pageSize]);

  const card = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white';
  const head = isDarkMode ? 'bg-slate-900/90 text-slate-400' : 'bg-slate-100/90 text-slate-500';
  const text = isDarkMode ? 'text-slate-200' : 'text-slate-800';
  const zebra = isDarkMode ? 'even:bg-slate-800/50' : 'even:bg-slate-50';

  const fmt = (v, pct = false) => {
    if (v === null || v === undefined) return '—';
    if (pct) return `${(Number(v) * 100).toFixed(2)}%`;
    return Number(v).toLocaleString();
  };

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-xl border shadow-sm ${card} ${fillHeight ? 'min-h-[200px] flex-1' : ''}`}>
      <div className={`shrink-0 border-b px-3 py-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
        <h3 className={`text-xs font-bold ${text}`}>{title}</h3>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : (
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className={`sticky top-0 text-[10px] uppercase ${head}`}>
              <tr>
                <th className="px-2 py-1.5 font-bold">Name</th>
                <th className="px-2 py-1.5 text-right font-bold">Total Purchy</th>
                <th className="px-2 py-1.5 text-right font-bold">Dishonour Purchy</th>
                <th className="px-2 py-1.5 text-right font-bold">Dishonour %</th>
                <th className="px-2 py-1.5 text-right font-bold">Dishonour Qty</th>
                <th className="px-2 py-1.5 text-right font-bold">Total Bond</th>
                <th className="px-2 py-1.5 text-right font-bold">Total Supply</th>
              </tr>
            </thead>
            <tbody className={text}>
              {pagedRows.map((r) => (
                <tr key={r.name} className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} ${zebra}`}>
                  <td className="whitespace-nowrap px-2 py-1 font-medium">{r.name}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(r.totalPurchy)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(r.dishonourPurchy)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(r.dishonourPct, true)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(r.dishonourQty)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(r.totalBond)}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{fmt(r.totalSupply)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {!loading && (
        <div className={`shrink-0 overflow-x-auto border-t px-2 py-1 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <table className="w-full min-w-[640px] text-xs">
            <tbody className={text}>
              <tr className={`font-bold ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                <td className="px-2 py-1">Total</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmt(totals.totalPurchy)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmt(totals.dishonourPurchy)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmt(totals.dishonourPct, true)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmt(totals.dishonourQty)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmt(totals.totalBond)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{fmt(totals.totalSupply)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {!loading && rows.length > 0 && (
        <PurchyTablePagination
          compact
          page={page}
          pageSize={pageSize}
          total={rows.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}

export default function PurchyFailureDateDrilldownTab({
  isDarkMode,
  useLiveData = false,
  globalQueryParams = {},
  filterOptions = {},
}) {
  const [filters, setFilters] = useState({ societyName: [] });
  const [dateFrom, setDateFrom] = useState('2025-10-24');
  const [dateTo, setDateTo] = useState('2026-03-06');

  const mergedParams = useMemo(
    () => ({ ...globalQueryParams, ...purchyFiltersToParams(filters) }),
    [globalQueryParams, filters],
  );

  const { data: liveData, loading, error, staticFallback } = usePurchyFailureDate(
    mergedParams,
    {
      enabled: useLiveData,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    },
  );

  const data = useLiveData ? (liveData || staticFallback) : staticFallback;

  const chartData = useMemo(() => {
    const from = dateFrom || data.dateFrom;
    const to = dateTo || data.dateTo;
    return (data.failureByDate || [])
      .filter((d) => !from || !to || (d.date >= from && d.date <= to))
      .map((d) => ({
        date: fmtDate(d.date),
        pct: Number((d.pct * 100).toFixed(2)),
        pctRaw: d.pct,
      }));
  }, [data.failureByDate, dateFrom, dateTo, data.dateFrom, data.dateTo]);

  const societyOptions = useMemo(() => {
    if (filterOptions?.societyName?.length) return filterOptions.societyName;
    return data.filters?.societyName || staticFallback.filters?.societyName || [];
  }, [filterOptions, data.filters, staticFallback]);

  const card = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white';
  const title = isDarkMode ? 'text-slate-200' : 'text-slate-800';
  const input = isDarkMode
    ? 'border-slate-600 bg-slate-700 text-slate-200'
    : 'border-slate-200 bg-white text-slate-800';

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto overflow-x-hidden">
      {useLiveData && loading && (
        <div className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] ${isDarkMode ? 'border-slate-600 bg-slate-800 text-slate-300' : 'border-slate-200 bg-white text-slate-600'}`}>
          Loading failure by date…
        </div>
      )}
      {useLiveData && error && (
        <div className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">
          {error}
        </div>
      )}

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h2 className={`text-sm font-black ${title}`}>Failure by Date</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-0.5">
            <span className={`text-[9px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>From</span>
            <input type="date" value={dateFrom || ''} onChange={(e) => setDateFrom(e.target.value)} className={`rounded-lg border px-2 py-1 text-xs ${input}`} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className={`text-[9px] font-bold uppercase ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>To</span>
            <input type="date" value={dateTo || ''} onChange={(e) => setDateTo(e.target.value)} className={`rounded-lg border px-2 py-1 text-xs ${input}`} />
          </label>
        </div>
      </div>

      <PurchyFilterBar
        compact
        slicers={SLICERS}
        options={{ societyName: societyOptions }}
        filters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => setFilters({ societyName: [] })}
        isDarkMode={isDarkMode}
        loading={useLiveData && loading}
      />

      <div className={`shrink-0 rounded-xl border p-2 shadow-sm ${card}`}>
        <h3 className={`mb-1 text-xs font-bold ${title}`}>Failure % by Date</h3>
        {useLiveData && loading ? (
          <div className="flex h-[140px] items-center justify-center">
            <Spinner size="md" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#334155' : '#e2e8f0'} />
              <XAxis dataKey="date" angle={-45} textAnchor="end" height={48} tick={{ fontSize: 9 }} />
              <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9 }} domain={[0, 'auto']} width={36} />
              <Tooltip formatter={(v) => [`${v}%`, 'Failure %']} />
              <Line type="monotone" dataKey="pct" stroke="#1e40af" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid min-h-[280px] shrink-0 grid-cols-1 gap-2 lg:grid-cols-2">
        <DrilldownTable
          fillHeight
          title="By Supplycentrename"
          rows={data.supplyCenterRows || []}
          totals={data.totals || {}}
          isDarkMode={isDarkMode}
          loading={useLiveData && loading}
        />
        <DrilldownTable
          fillHeight
          title="By Villagename"
          rows={data.villageRows || []}
          totals={data.totals || {}}
          isDarkMode={isDarkMode}
          loading={useLiveData && loading}
        />
      </div>
    </div>
  );
}
