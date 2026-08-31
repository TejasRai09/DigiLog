import { useCallback, useEffect, useMemo, useState } from 'react';
import { MdRefresh } from 'react-icons/md';
import PurchyFilterBar from './PurchyFilterBar';
import PurchyDetailTable from './PurchyDetailTable';
import PurchyCurvedHierarchyTree from './PurchyCurvedHierarchyTree';
import usePurchyDishonourDrilldown from '../../../hooks/usePurchyDishonourDrilldown';
import { purchyFiltersToParams } from '../../../hooks/usePurchyFilters';
import { DISHONOUR_DRILLDOWN } from '../../../data/purchyDrilldownStaticData';

const DETAIL_COLS = [
  { key: 'growerNameKey', label: 'Grower_name_Key', kind: 'text' },
  { key: 'indentQty', label: '2025_Indent Qty', kind: 'int' },
  { key: 'supplyQty', label: '2025_Supply Qty', kind: 'num' },
  { key: 'dishonourQty', label: '2025_Dishonour Qty', kind: 'num' },
  { key: 'dishonourPct', label: 'Dishonour % (Qty)', kind: 'pct' },
];

const SLICERS = [
  { key: 'dishonourBucket', label: 'Dishonour_Bucket', optionKey: 'dishonourBucket' },
  { key: 'loyaltySlicer', label: "Loyalty_Slicer ('20-'24)", optionKey: 'loyaltySlicer' },
];

function pctToDisplay(pct) {
  return Number((Number(pct) * 100).toFixed(2));
}

function toTreeNode(item) {
  return {
    id: item.id,
    name: item.label,
    value: pctToDisplay(item.pct),
  };
}

export default function PurchyDishonourDrilldownTab({
  isDarkMode,
  isActive = true,
  useLiveData = false,
  globalQueryParams = {},
  filterOptions = {},
}) {
  const [filters, setFilters] = useState({ dishonourBucket: [], loyaltySlicer: [] });
  const [selSociety, setSelSociety] = useState(null);
  const [selVillage, setSelVillage] = useState(null);
  const [selGrower, setSelGrower] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [allowAutoSelect, setAllowAutoSelect] = useState(true);

  const mergedParams = useMemo(
    () => ({ ...globalQueryParams, ...purchyFiltersToParams(filters) }),
    [globalQueryParams, filters],
  );

  const { data: liveData, loading, error, staticFallback } = usePurchyDishonourDrilldown(
    mergedParams,
    {
      enabled: useLiveData,
      selectedSociety: selSociety,
      selectedVillage: selVillage,
      selectedGrower: selGrower,
      autoSelect: useLiveData && allowAutoSelect && !selSociety,
      page,
      pageSize,
    },
  );

  const data = useLiveData ? (liveData || staticFallback) : staticFallback;
  const societies = useLiveData ? (liveData?.tree?.societies || data.tree?.societies || []) : data.tree.societies;

  const activeSociety = societies.find((s) => s.id === selSociety) || societies[0];
  const villages = useLiveData
    ? (liveData?.villages || [])
    : (activeSociety?.villages || []);
  const activeVillage = villages.find((v) => v.id === selVillage) || villages[0];
  const growers = useLiveData
    ? (liveData?.growers || [])
    : (activeVillage?.growers || []);

  useEffect(() => {
    if (!useLiveData || !liveData) return;
    if (!allowAutoSelect) return;
    if (liveData.selectedSociety) {
      setSelSociety(liveData.selectedSociety);
      if (liveData.selectedVillage) setSelVillage(liveData.selectedVillage);
      setAllowAutoSelect(false);
    }
  }, [useLiveData, liveData, allowAutoSelect]);

  useEffect(() => {
    if (!useLiveData || allowAutoSelect) return;
    if (!societies.length) return;
    if (selSociety && !societies.some((s) => s.id === selSociety)) {
      setSelSociety(societies[0].id);
      setSelVillage(null);
      setSelGrower(null);
    }
  }, [useLiveData, societies, selSociety, allowAutoSelect]);

  useEffect(() => {
    if (!useLiveData || allowAutoSelect) return;
    if (!villages.length) {
      setSelVillage(null);
      return;
    }
    if (!selVillage || !villages.some((v) => v.id === selVillage)) {
      setSelVillage(villages[0].id);
    }
  }, [useLiveData, villages, selVillage, allowAutoSelect]);

  useEffect(() => {
    setPage(1);
  }, [selSociety, selVillage, selGrower, filters, pageSize, mergedParams]);

  const selectSociety = useCallback((id) => {
    setSelSociety(id);
    setSelVillage(null);
    setSelGrower(null);
  }, []);

  const selectVillage = useCallback((id) => {
    setSelVillage(id);
    setSelGrower(null);
  }, []);

  const selectGrower = useCallback((id) => {
    setSelGrower((prev) => (prev === id ? null : id));
  }, []);

  const handleResetTree = () => {
    setSelSociety(societies[0]?.id || null);
    setSelVillage(null);
    setSelGrower(null);
  };

  const treeColumns = useMemo(() => {
    const cols = [
      {
        key: 'society',
        title: 'Society_Name',
        nodes: societies.map(toTreeNode),
        selectedId: selSociety,
        onSelect: selectSociety,
        onClear: () => { setSelSociety(null); setSelVillage(null); setSelGrower(null); },
      },
    ];

    if (villages.length) {
      cols.push({
        key: 'village',
        title: 'Village_name_Key',
        nodes: villages.map(toTreeNode),
        selectedId: selVillage,
        onSelect: selectVillage,
        onClear: () => { setSelVillage(null); setSelGrower(null); },
      });
    }

    if (growers.length) {
      cols.push({
        key: 'grower',
        title: 'Grower_name_Key',
        nodes: growers.map(toTreeNode),
        selectedId: selGrower,
        onSelect: selectGrower,
        onClear: () => setSelGrower(null),
      });
    }

    return cols;
  }, [societies, villages, growers, selSociety, selVillage, selGrower, selectSociety, selectVillage, selectGrower]);

  const staticDetail = useMemo(() => {
    if (useLiveData) return { rows: [], total: 0 };
    let rows = data.detailRows.map((r) => ({
      growerNameKey: r.growerNameKey,
      indentQty: r.indentQty,
      supplyQty: r.supplyQty,
      dishonourQty: r.dishonourQty,
      dishonourPct: r.dishonourPct,
    }));
    if (selGrower) {
      rows = rows.filter((r) => r.growerNameKey === selGrower);
    } else if (selVillage) {
      rows = rows.filter((r) => r.growerNameKey.startsWith(selVillage.split('-')[0]));
    }
    if (filters.dishonourBucket?.length) {
      rows = rows.filter((r) => r.dishonourPct >= 0.4);
    }
    const offset = (page - 1) * pageSize;
    return { rows: rows.slice(offset, offset + pageSize), total: rows.length };
  }, [useLiveData, data.detailRows, selGrower, selVillage, filters.dishonourBucket, page, pageSize]);

  const pagedDetailRows = useLiveData && liveData ? liveData.detailRows : staticDetail.rows;
  const detailTotal = useLiveData && liveData ? liveData.detailTotal : staticDetail.total;

  const slicerOptions = useLiveData
    ? {
      dishonourBucket: filterOptions.dishonourBucket || [],
      loyaltySlicer: filterOptions.loyaltySlicer || [],
    }
    : data.filters;

  const card = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white';
  const kpiText = isDarkMode ? 'text-slate-100' : 'text-slate-800';
  const kpiLabel = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <h2 className={`text-sm font-black ${kpiText}`}>Purchy Dishonour Drilldown</h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <div className={`rounded-lg border px-3 py-1.5 shadow-sm ${card}`}>
              <div className={`text-[9px] font-bold uppercase ${kpiLabel}`}># Growers</div>
              <div className={`text-lg font-black tabular-nums ${kpiText}`}>{data.kpis.growers.toLocaleString()}</div>
            </div>
            <div className={`rounded-lg border px-3 py-1.5 shadow-sm ${card}`}>
              <div className={`text-[9px] font-bold uppercase ${kpiLabel}`}># Villages</div>
              <div className={`text-lg font-black tabular-nums ${kpiText}`}>{data.kpis.villages.toLocaleString()}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetTree}
            className="flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:underline dark:text-violet-400"
          >
            <MdRefresh className="h-3 w-3" />
            Reset Tree
          </button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <PurchyFilterBar
        compact
        slicers={SLICERS}
        options={slicerOptions}
        filters={filters}
        onFilterChange={(k, v) => setFilters((f) => ({ ...f, [k]: v }))}
        onClear={() => setFilters({ dishonourBucket: [], loyaltySlicer: [] })}
        isDarkMode={isDarkMode}
        loading={false}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <PurchyCurvedHierarchyTree
        className="min-h-[220px] flex-1"
        isDarkMode={isDarkMode}
        rootLabel={data.rootLabel}
        rootValue={pctToDisplay(data.rootPct)}
        rootSubtext={`${(data.kpis.growers / 1000).toFixed(1)}K Growers`}
        columns={treeColumns}
        coordDeps={[selSociety, selVillage, selGrower, isActive]}
      />

      <PurchyDetailTable
        fillHeight
        compact
        className="min-h-[200px] flex-1"
        title="Grower Detail"
        columns={DETAIL_COLS}
        rows={pagedDetailRows}
        loading={useLiveData && loading}
        total={detailTotal}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        isDarkMode={isDarkMode}
        footer={(
          <div className={`shrink-0 overflow-x-auto border-t px-2 py-1 text-xs ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <table className="w-full min-w-[480px]">
              <tbody className={kpiText}>
                <tr className={`font-bold ${isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'}`}>
                  <td className="px-2 py-1">Total</td>
                  <td className="px-2 py-1 text-right tabular-nums">{data.totals.indentQty.toLocaleString()}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{data.totals.supplyQty.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{data.totals.dishonourQty.toLocaleString()}</td>
                  <td className="px-2 py-1 text-right tabular-nums">{(data.totals.dishonourPct * 100).toFixed(2)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      />
      </div>
    </div>
  );
}
