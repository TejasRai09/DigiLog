import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  MdExpandMore, MdHelpOutline, MdRefresh, MdTune,
} from 'react-icons/md';
import PurchyCurvedHierarchyTree from './PurchyCurvedHierarchyTree';
import PurchyVarietyTreemap from './PurchyVarietyTreemap';
import PurchyVarietyTypeTable from './PurchyVarietyTypeTable';
import usePurchyStaffDrilldown from '../../../hooks/usePurchyStaffDrilldown';
import usePurchyVarietyType from '../../../hooks/usePurchyVarietyType';
import { purchyCacheKey } from '../../../hooks/purchyQueryCache';
import Spinner from '../../Spinner';

const DEFAULT_ZONE = 'region-2';
const DEFAULT_MANAGER = 'pankaj-shrivastav';
const DEFAULT_INCHARGE = 'saurabh-pandey';
const DEFAULT_STAFF = 'uday-singh';

function findNode(nodes, id) {
  return nodes?.find((n) => n.id === id) ?? null;
}

function firstChildId(node) {
  return node?.children?.[0]?.id ?? null;
}

function firstSelectableId(nodes) {
  const preferred = nodes?.find((n) => n.id && n.name !== 'Unassigned');
  return preferred?.id ?? nodes?.[0]?.id ?? null;
}

function applySelection(zoneId, root, setters) {
  const zone = findNode(root.children, zoneId) || findNode(root.children, firstSelectableId(root.children));
  const mgrId = firstChildId(zone);
  const mgr = findNode(zone?.children, mgrId);
  const inchId = firstChildId(mgr);
  const inch = findNode(mgr?.children, inchId);
  const staffId = firstChildId(inch);
  setters.setSelectedZone(zone?.id ?? zoneId);
  setters.setSelectedManager(mgrId);
  setters.setSelectedIncharge(inchId);
  setters.setSelectedStaff(staffId);
  setters.setSelectedVillage(null);
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

  const [selectedZone, setSelectedZone] = useState(useLiveData ? null : DEFAULT_ZONE);
  const [selectedManager, setSelectedManager] = useState(useLiveData ? null : DEFAULT_MANAGER);
  const [selectedIncharge, setSelectedIncharge] = useState(useLiveData ? null : DEFAULT_INCHARGE);
  const [selectedStaff, setSelectedStaff] = useState(useLiveData ? null : DEFAULT_STAFF);
  const [selectedVillage, setSelectedVillage] = useState(null);
  const [selectedVariety, setSelectedVariety] = useState(null);

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
  useEffect(() => {
    if (!treeRoot?.children?.length) return;

    const treeKey = treeRoot.children.map((c) => c.id).join('|');
    const selectionValid = selectedZone && findNode(treeRoot.children, selectedZone);
    if (treeKeyRef.current === treeKey && selectionValid) return;

    treeKeyRef.current = treeKey;
    const startId = firstSelectableId(treeRoot.children);
    applySelection(useLiveData ? startId : (selectionValid ? selectedZone : DEFAULT_ZONE), treeRoot, {
      setSelectedZone, setSelectedManager, setSelectedIncharge, setSelectedStaff, setSelectedVillage,
    });
  }, [treeRoot, useLiveData, selectedZone]);

  const selectZoneNode = (zoneId) => {
    applySelection(zoneId, treeRoot, {
      setSelectedZone, setSelectedManager, setSelectedIncharge, setSelectedStaff, setSelectedVillage,
    });
  };

  const selectManagerNode = (mgrId) => {
    setSelectedManager(mgrId);
    const zone = findNode(treeRoot.children, selectedZone);
    const mgr = findNode(zone?.children, mgrId);
    const inchId = firstChildId(mgr);
    setSelectedIncharge(inchId);
    const inch = findNode(mgr?.children, inchId);
    setSelectedStaff(firstChildId(inch));
    setSelectedVillage(null);
  };

  const selectInchargeNode = (inchId) => {
    setSelectedIncharge(inchId);
    const zone = findNode(treeRoot.children, selectedZone);
    const mgr = findNode(zone?.children, selectedManager);
    const inch = findNode(mgr?.children, inchId);
    setSelectedStaff(firstChildId(inch));
    setSelectedVillage(null);
  };

  const selectStaffNode = (staffId) => {
    setSelectedStaff(staffId);
    setSelectedVillage(null);
  };

  const selectVillageNode = (vId) => {
    setSelectedVillage((prev) => (prev === vId ? null : vId));
  };

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
      applySelection(useLiveData ? firstSelectableId(treeRoot.children) : DEFAULT_ZONE, treeRoot, {
        setSelectedZone, setSelectedManager, setSelectedIncharge, setSelectedStaff, setSelectedVillage,
      });
    }
  };

  const treeColumns = useMemo(() => {
    const col1 = treeRoot?.children ?? [];
    const activeZoneNode = findNode(col1, selectedZone);
    const col2 = activeZoneNode?.children ?? [];
    const activeManagerNode = findNode(col2, selectedManager);
    const col3 = activeManagerNode?.children ?? [];
    const activeInchargeNode = findNode(col3, selectedIncharge);
    const col4 = activeInchargeNode?.children ?? [];
    const activeStaffNode = findNode(col4, selectedStaff);
    const col5 = activeStaffNode?.children ?? [];

    const toNodes = (nodes) => nodes.map((n) => ({ id: n.id, name: n.name, value: n.value }));

    return [
      {
        key: 'zone', title: 'ZONE HEAD', nodes: toNodes(col1), selectedId: selectedZone, onSelect: selectZoneNode,
      },
      {
        key: 'manager', title: 'ZONAL MANAGER', nodes: toNodes(col2), selectedId: selectedManager, onSelect: selectManagerNode,
      },
      {
        key: 'incharge', title: 'ZONAL INCHARGE', nodes: toNodes(col3), selectedId: selectedIncharge, onSelect: selectInchargeNode,
      },
      {
        key: 'staff', title: 'VILLAGE STAFF', nodes: toNodes(col4), selectedId: selectedStaff, onSelect: selectStaffNode,
      },
      {
        key: 'village', title: 'VILLAGE_NAME_KEY', nodes: toNodes(col5), selectedId: selectedVillage, onSelect: selectVillageNode,
      },
    ];
  }, [treeRoot, selectedZone, selectedManager, selectedIncharge, selectedStaff, selectedVillage]);

  const donutSegments = useMemo(
    () => buildDonutSegments(data?.loyaltyDonut || []),
    [data?.loyaltyDonut],
  );

  const totalGrowers = data?.growerCount || 0;
  const card = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200/80 bg-white';
  const titleText = isDarkMode ? 'text-slate-100' : 'text-slate-800';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto overflow-x-hidden">
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
          <FilterSelect compact label="Loyalty_Slicer ('20-'24)" value={filterLoyalty} onChange={setFilterLoyalty} options={data?.filters?.loyaltySlicer || []} isDarkMode={isDarkMode} />
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
          rootLabel={data?.rootLabel || '2025 Dishonour % (Count)'}
          rootValue={data?.rootValue || 0}
          rootSubtext={`${(totalGrowers / 1000).toFixed(1)}K Growers`}
          columns={treeColumns}
          coordDeps={[selectedZone, selectedManager, selectedIncharge, selectedStaff, selectedVillage, isActive]}
        />
      )}

      <div className="grid shrink-0 grid-cols-1 items-stretch gap-2 lg:grid-cols-12">
        <div className={`flex min-h-[22rem] flex-col rounded-xl border p-4 shadow-sm lg:col-span-5 ${card}`}>
          <div className="mb-3 flex shrink-0 items-start justify-between">
            <div>
              <h3 className={`text-sm font-extrabold ${titleText}`}>
                Grower_Key by Loyalty_Slicer
              </h3>
              <p className={`mt-0.5 text-[10px] ${muted}`}>Volume distribution</p>
            </div>
            <MdHelpOutline className={`h-4 w-4 cursor-pointer ${muted} hover:text-violet-600`} />
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 sm:grid-cols-[minmax(13rem,1fr)_minmax(12rem,1.15fr)]">
            {sectionLoading ? (
              <div className="flex items-center justify-center sm:col-span-2">
                <Spinner size="lg" />
              </div>
            ) : (
              <>
            <div className="flex items-center justify-center">
              <div className="relative aspect-square w-full max-w-[20rem]">
                <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="36" fill="transparent" stroke={isDarkMode ? '#1e293b' : '#f1f5f9'} strokeWidth="14" />
                  {donutSegments.map((seg) => (
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
                      className="transition-all hover:stroke-[16]"
                    />
                  ))}
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-3xl font-black sm:text-4xl ${titleText}`}>{(totalGrowers / 1000).toFixed(1)}K</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Growers</span>
                </div>
              </div>
            </div>
            <div className={`flex flex-col justify-evenly py-1 text-sm font-bold ${muted}`}>
              {(data?.loyaltyDonut || []).map((l) => (
                <div key={l.label} className={`flex items-center justify-between rounded-md px-1.5 py-1.5 ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}`}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${l.tailwind}`} />
                    <span className="truncate">{l.label}</span>
                  </div>
                  <span className={`ml-3 shrink-0 tabular-nums ${titleText}`}>{(l.count / 1000).toFixed(1)}K</span>
                </div>
              ))}
            </div>
              </>
            )}
          </div>
        </div>

        <div className={`flex min-h-[22rem] flex-col rounded-xl border p-4 shadow-sm lg:col-span-7 ${card}`}>
          <div className="mb-3 flex items-start justify-between">
            <div>
              <h3 className={`text-sm font-extrabold ${titleText}`}># Purchy by varietyname</h3>
              <p className={`mt-0.5 text-[10px] ${muted}`}>Ranked by supply purchy count</p>
            </div>
            <span className={`text-[10px] font-bold ${muted}`}>{data?.varietyTreemap?.length || 0} varieties</span>
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
    </div>
  );
}
