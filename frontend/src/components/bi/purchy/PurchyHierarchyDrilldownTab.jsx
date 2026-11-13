import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  MdExpandMore, MdRefresh, MdTune,
} from 'react-icons/md';
import PurchyCurvedHierarchyTree, { hierarchyTreeCsvRows } from './PurchyCurvedHierarchyTree';
import PurchyVarietyTreemap from './PurchyVarietyTreemap';
import PurchyVarietyTypeTable from './PurchyVarietyTypeTable';
import usePurchyStaffDrilldown from '../../../hooks/usePurchyStaffDrilldown';
import usePurchyVarietyType from '../../../hooks/usePurchyVarietyType';
import { purchyCacheKey } from '../../../hooks/purchyQueryCache';
import Spinner from '../../Spinner';
import ChartCardToolbar from '../ChartCardToolbar';
import BiChartExpandModal from '../BiChartExpandModal';
import { BI_DASHBOARDS } from '../../../utils/activityPath';
import { loyaltySlicerLabel, normalizeSeasonYear, seasonLabel } from '../../../utils/purchySeason';

const DEFAULT_ZONE = 'region-2';
const DEFAULT_MANAGER = 'pankaj-shrivastav';
const DEFAULT_INCHARGE = 'saurabh-pandey';
const DEFAULT_STAFF = 'uday-singh';

const TREE_COLUMNS = [
  { key: 'overall', title: 'OVERALL HEAD' },
  { key: 'head', title: 'HEAD' },
  { key: 'zone', title: 'ZONE HEAD' },
  { key: 'manager', title: 'ZONAL MANAGER' },
  { key: 'incharge', title: 'ZONAL INCHARGE' },
  { key: 'staff', title: 'VILLAGE STAFF' },
  { key: 'village', title: 'VILLAGE_NAME_KEY', toggle: true },
];

const EMPTY_SELECTION = {
  overall: null, head: null, zone: null, manager: null, incharge: null, staff: null, village: null,
};

const STATIC_SELECTION = {
  ...EMPTY_SELECTION,
  zone: DEFAULT_ZONE,
  manager: DEFAULT_MANAGER,
  incharge: DEFAULT_INCHARGE,
  staff: DEFAULT_STAFF,
};

function findNode(nodes, id) {
  return nodes?.find((n) => n.id === id) ?? null;
}

function firstSelectableId(nodes) {
  const preferred = nodes?.find((n) => n.id && n.name !== 'Unassigned');
  return preferred?.id ?? nodes?.[0]?.id ?? null;
}

function buildSelection(root, clickedLevel, clickedId, prev = EMPTY_SELECTION) {
  const selected = { ...EMPTY_SELECTION };
  let children = root?.children ?? [];
  for (let i = 0; i < TREE_COLUMNS.length; i += 1) {
    const col = TREE_COLUMNS[i];
    if (col.toggle) {
      selected[col.key] = i === clickedLevel
        ? (prev[col.key] === clickedId ? null : clickedId)
        : null;
      break;
    }
    let id = null;
    if (i < clickedLevel) {
      id = findNode(children, prev[col.key])?.id ?? firstSelectableId(children);
    } else if (i === clickedLevel) {
      id = findNode(children, clickedId)?.id ?? firstSelectableId(children);
    } else {
      id = firstSelectableId(children);
    }
    selected[col.key] = id;
    children = findNode(children, id)?.children ?? [];
  }
  return selected;
}

function buildDonutSegments(items) {
  const total = items.reduce((s, i) => s + i.pct, 0) || 1;
  const circumference = 2 * Math.PI * 36;
  let offset = 0;
  return items.map((item) => {
    const dash = (item.pct / total) * circumference;
    const seg = { ...item, dasharray: `${dash} ${circumference}`, dashoffset: -offset };
    offset += dash;
    return seg;
  });
}

function LoyaltyDonut({
  segments, items, totalGrowers, isDarkMode, titleText, muted,
}) {
  return (
    <div className="grid h-full min-h-0 grid-cols-1 items-center gap-4 sm:grid-cols-[minmax(13rem,1fr)_minmax(12rem,1.15fr)]">
      <div className="flex items-center justify-center">
        <div className="relative aspect-square w-full max-w-[20rem]">
          <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="36" fill="transparent" stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} strokeWidth="14" />
            {segments.map((seg) => (
              <circle
                key={seg.label}
                cx="50"
                cy="50"
                r="36"
                fill="transparent"
                stroke={seg.color}
                strokeWidth="14"
                strokeDasharray={seg.dasharray}
                strokeDashoffset={seg.dashoffset}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-black sm:text-4xl ${titleText}`}>{(totalGrowers / 1000).toFixed(1)}K</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Growers</span>
          </div>
        </div>
      </div>
      <div className={`flex flex-col justify-evenly gap-1 py-1 text-sm font-bold ${muted}`}>
        {items.map((l) => (
          <div key={l.label} className={`flex items-center justify-between rounded-md px-1.5 py-1.5 ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${l.tailwind}`} />
              <span className="truncate">{l.label}</span>
            </div>
            <span className={`ml-3 shrink-0 tabular-nums ${titleText}`}>{(l.count / 1000).toFixed(1)}K</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options, isDarkMode, compact = false,
}) {
  const input = isDarkMode
    ? 'border-slate-700 bg-slate-800 text-slate-100 focus:border-violet-500'
    : 'border-slate-200 bg-white text-slate-700 focus:border-violet-500';

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1.5'}>
      <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full cursor-pointer appearance-none rounded-lg border outline-none transition-all ${compact ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2.5 text-xs'} font-bold ${input}`}
        >
          <option value="All">All</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <MdExpandMore className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
    </div>
  );
}

export default function PurchyHierarchyDrilldownTab({
  isDarkMode,
  isActive = true,
  useLiveData = false,
  globalQueryParams = {},
  seasonYear,
}) {
  const [filterVillage, setFilterVillage] = useState('All');
  const [filterSociety, setFilterSociety] = useState('All');
  const [filterLoyalty, setFilterLoyalty] = useState('All');

  const queryParams = useMemo(() => {
    const p = { ...globalQueryParams };
    if (filterVillage !== 'All') p.villageName = filterVillage;
    if (filterSociety !== 'All') p.societyName = filterSociety;
    if (filterLoyalty !== 'All') p.loyaltySlicer = filterLoyalty;
    return p;
  }, [globalQueryParams, filterVillage, filterSociety, filterLoyalty]);

  const { data: liveData, loading, error, staticFallback } = usePurchyStaffDrilldown(
    queryParams,
    { enabled: useLiveData },
  );

  const data = useLiveData ? liveData : staticFallback;
  const treeRoot = data?.nestedTree;
  const sectionLoading = useLiveData && loading;

  const [selected, setSelected] = useState(useLiveData ? EMPTY_SELECTION : STATIC_SELECTION);
  const [selectedVariety, setSelectedVariety] = useState(null);
  const [expandedChart, setExpandedChart] = useState(null);

  const varietyTypeParams = useMemo(
    () => ({ ...queryParams, varietyName: selectedVariety }),
    [queryParams, selectedVariety],
  );
  const {
    data: varietyTypeData,
    loading: varietyTypeLoading,
  } = usePurchyVarietyType(varietyTypeParams, {
    enabled: useLiveData && Boolean(selectedVariety),
  });

  const treeKeyRef = useRef('');
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  useEffect(() => {
    if (!treeRoot?.children?.length) return;

    const treeKey = treeRoot.children.map((c) => c.id).join('|');
    const firstKey = TREE_COLUMNS[0].key;
    const prev = selectedRef.current;
    const selectionValid = prev[firstKey] && findNode(treeRoot.children, prev[firstKey]);
    if (treeKeyRef.current === treeKey && selectionValid) return;

    treeKeyRef.current = treeKey;
    const startId = useLiveData
      ? firstSelectableId(treeRoot.children)
      : (selectionValid ? prev[firstKey] : DEFAULT_ZONE);
    setSelected(buildSelection(treeRoot, 0, startId, EMPTY_SELECTION));
  }, [treeRoot, useLiveData]);

  const slicerKey = purchyCacheKey(queryParams);
  useEffect(() => {
    setSelectedVariety(null);
  }, [slicerKey]);

  const handleResetTree = () => {
    setFilterVillage('All');
    setFilterSociety('All');
    setFilterLoyalty('All');
    setSelectedVariety(null);
    if (treeRoot?.children?.length) {
      setSelected(buildSelection(
        treeRoot,
        0,
        useLiveData ? firstSelectableId(treeRoot.children) : DEFAULT_ZONE,
        EMPTY_SELECTION,
      ));
    }
  };

  const treeColumns = useMemo(() => {
    const toNodes = (nodes) => (nodes || []).map((n) => ({ id: n.id, name: n.name, value: n.value }));
    let children = treeRoot?.children ?? [];
    return TREE_COLUMNS.map((col, level) => {
      const nodes = toNodes(children);
      const column = {
        key: col.key,
        title: col.title,
        nodes,
        selectedId: selected[col.key],
        onSelect: (id) => setSelected(buildSelection(treeRoot, level, id, selected)),
      };
      children = findNode(children, selected[col.key])?.children ?? [];
      return column;
    });
  }, [treeRoot, selected]);

  const donutSegments = useMemo(
    () => buildDonutSegments(data?.loyaltyDonut || []),
    [data?.loyaltyDonut],
  );

  const totalGrowers = data?.growerCount || 0;
  const card = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200/80 bg-white';
  const titleText = isDarkMode ? 'text-slate-100' : 'text-slate-800';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto overflow-x-auto">
      {useLiveData && error && (
        <div className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">
          {error}
        </div>
      )}
      {useLiveData && data?.hasStaffData === false && (
        <div className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] leading-snug ${
          isDarkMode
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
            : 'border-amber-200 bg-amber-50 text-amber-800'
        }`}>
          Staff hierarchy mapping not imported — zone/manager/incharge/staff show as Unassigned. Import the staff Excel file to populate the tree.
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between">
        <h2 className={`text-sm font-extrabold tracking-tight ${titleText}`}>Staff Drilldown</h2>
        <button
          type="button"
          onClick={handleResetTree}
          className="flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:underline dark:text-violet-400"
        >
          <MdRefresh className="h-3 w-3" />
          Reset Tree
        </button>
      </div>

      <section className={`shrink-0 rounded-xl border p-2.5 shadow-sm ${card}`}>
        <div className={`mb-2 flex items-center justify-between border-b pb-1.5 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
          <div className="flex items-center gap-1">
            <MdTune className="h-3.5 w-3.5 text-violet-600" />
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Filters</span>
          </div>
          <button type="button" onClick={handleResetTree} className="text-[10px] font-bold text-violet-600 hover:underline dark:text-violet-400">
            Clear all
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <FilterSelect compact label="Village Name" value={filterVillage} onChange={setFilterVillage} options={data?.filters?.villageName || []} isDarkMode={isDarkMode} />
          <FilterSelect compact label="Society_Name" value={filterSociety} onChange={setFilterSociety} options={data?.filters?.societyName || []} isDarkMode={isDarkMode} />
          <FilterSelect compact label={loyaltySlicerLabel(seasonYear)} value={filterLoyalty} onChange={setFilterLoyalty} options={data?.filters?.loyaltySlicer || []} isDarkMode={isDarkMode} />
        </div>
      </section>

      {sectionLoading ? (
        <section className={`flex min-h-[280px] shrink-0 items-center justify-center rounded-xl border shadow-sm ${card}`}>
          <Spinner size="lg" />
        </section>
      ) : (
        <PurchyCurvedHierarchyTree
          className="min-h-[280px] shrink-0"
          isDarkMode={isDarkMode}
          rootLabel={data?.rootLabel || seasonLabel('Dishonour % (Count)', normalizeSeasonYear(seasonYear))}
          rootValue={data?.rootValue || 0}
          rootSubtext={`${(totalGrowers / 1000).toFixed(1)}K Growers`}
          columns={treeColumns}
          coordDeps={[selected, isActive]}
          onExpand={() => setExpandedChart({
            title: 'Staff hierarchy',
            definition: 'Dishonour % along the selected staff branch',
            filePrefix: 'purchy',
            dashboardLabel: BI_DASHBOARDS['/bi/purchy-analysis'],
            data: hierarchyTreeCsvRows(
              data?.rootLabel || seasonLabel('Dishonour % (Count)', normalizeSeasonYear(seasonYear)),
              data?.rootValue || 0,
              treeColumns,
            ),
            csvColumns: [
              { key: 'level', label: 'Level' },
              { key: 'name', label: 'Name' },
              { key: 'value', label: 'Value %' },
            ],
            plot: (
              <PurchyCurvedHierarchyTree
                className="h-full border-0 shadow-none"
                isDarkMode={isDarkMode}
                rootLabel={data?.rootLabel || seasonLabel('Dishonour % (Count)', normalizeSeasonYear(seasonYear))}
                rootValue={data?.rootValue || 0}
                rootSubtext={`${(totalGrowers / 1000).toFixed(1)}K Growers`}
                columns={treeColumns}
                coordDeps={[selected, isActive, 'expand']}
              />
            ),
          })}
        />
      )}

      <div className="grid shrink-0 grid-cols-1 items-stretch gap-2 lg:grid-cols-12">
        <div className={`flex min-h-[22rem] flex-col rounded-xl border p-4 shadow-sm lg:col-span-5 ${card}`}>
          <div className="mb-3 flex shrink-0 items-start justify-between gap-2">
            <div>
              <h3 className={`text-sm font-extrabold ${titleText}`}>
                Grower_Key by Loyalty_Slicer
              </h3>
              <p className={`mt-0.5 text-[10px] ${muted}`}>Volume distribution</p>
            </div>
            <ChartCardToolbar
              compact
              isDarkMode={isDarkMode}
              onExpand={() => setExpandedChart({
                title: 'Grower_Key by Loyalty_Slicer',
                definition: 'Volume distribution',
                filePrefix: 'purchy',
                dashboardLabel: BI_DASHBOARDS['/bi/purchy-analysis'],
                data: (data?.loyaltyDonut || []).map((row) => ({
                  label: row.label,
                  growers: row.count,
                  sharePct: Number((row.pct * 100).toFixed(2)),
                })),
                csvColumns: [
                  { key: 'label', label: 'Loyalty' },
                  { key: 'growers', label: 'Growers' },
                  { key: 'sharePct', label: 'Share %' },
                ],
                plot: (
                  <LoyaltyDonut
                    segments={donutSegments}
                    items={data?.loyaltyDonut || []}
                    totalGrowers={totalGrowers}
                    isDarkMode={isDarkMode}
                    titleText={titleText}
                    muted={muted}
                  />
                ),
              })}
            />
          </div>
          <div className="min-h-0 flex-1">
            {sectionLoading ? (
              <div className="flex h-full items-center justify-center">
                <Spinner size="lg" />
              </div>
            ) : (
              <LoyaltyDonut
                segments={donutSegments}
                items={data?.loyaltyDonut || []}
                totalGrowers={totalGrowers}
                isDarkMode={isDarkMode}
                titleText={titleText}
                muted={muted}
              />
            )}
          </div>
        </div>

        <div className={`flex min-h-[22rem] flex-col rounded-xl border p-4 shadow-sm lg:col-span-7 ${card}`}>
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <h3 className={`text-sm font-extrabold ${titleText}`}># Purchy by varietyname</h3>
              <p className={`mt-0.5 text-[10px] ${muted}`}>Ranked by supply purchy count</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-bold ${muted}`}>{data?.varietyTreemap?.length || 0} varieties</span>
              <ChartCardToolbar
                compact
                isDarkMode={isDarkMode}
                onExpand={() => setExpandedChart({
                  title: '# Purchy by varietyname',
                  definition: 'Ranked by supply purchy count',
                  filePrefix: 'purchy',
                  dashboardLabel: BI_DASHBOARDS['/bi/purchy-analysis'],
                  data: (data?.varietyTreemap || []).map((row) => ({
                    variety: row.name,
                    purchyCount: row.cnt,
                    sharePct: row.share,
                  })),
                  csvColumns: [
                    { key: 'variety', label: 'Variety' },
                    { key: 'purchyCount', label: 'Purchy count' },
                    { key: 'sharePct', label: 'Share %' },
                  ],
                  plot: (
                    <PurchyVarietyTreemap
                      items={data?.varietyTreemap || []}
                      isDarkMode={isDarkMode}
                      listClassName="min-h-0 flex-1"
                    />
                  ),
                })}
              />
            </div>
          </div>
          {sectionLoading ? (
            <div className="flex h-44 items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <PurchyVarietyTypeTable
                rows={selectedVariety ? (varietyTypeData?.rows || []) : []}
                totals={selectedVariety ? varietyTypeData?.totals : null}
                loading={Boolean(selectedVariety) && varietyTypeLoading}
                varietyName={selectedVariety}
                isDarkMode={isDarkMode}
              />
              <PurchyVarietyTreemap
                items={data?.varietyTreemap || []}
                isDarkMode={isDarkMode}
                selectedName={selectedVariety}
                onSelect={setSelectedVariety}
              />
            </div>
          )}
        </div>
      </div>
      <BiChartExpandModal
        config={expandedChart}
        isDarkMode={isDarkMode}
        onClose={() => setExpandedChart(null)}
      />
    </div>
  );
}
