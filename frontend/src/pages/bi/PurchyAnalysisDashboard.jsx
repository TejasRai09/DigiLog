import { useEffect, useMemo, useState } from 'react';
import { MdArrowBack, MdDarkMode, MdLightMode, MdDashboard, MdCloud, MdScience, MdShoppingCart } from 'react-icons/md';
import BiDashboardHeader from '../../components/bi/BiDashboardHeader';
import { BiKeyMetricBox, BiFilterBarLayout, BiViewTabs } from '../../components/bi/BiLayoutElements';
import usePurchyFilters from '../../hooks/usePurchyFilters';
import usePurchyGrowerPerformance from '../../hooks/usePurchyGrowerPerformance';
import usePurchyDishonour from '../../hooks/usePurchyDishonour';
import PurchyFilterBar from '../../components/bi/purchy/PurchyFilterBar';
import PurchySummaryTable from '../../components/bi/purchy/PurchySummaryTable';
import PurchyDetailTable from '../../components/bi/purchy/PurchyDetailTable';
import PurchyKpiGrid from '../../components/bi/purchy/PurchyKpiGrid';
import PurchyDishonourDrilldownTab from '../../components/bi/purchy/PurchyDishonourDrilldownTab';
import PurchyHierarchyDrilldownTab from '../../components/bi/purchy/PurchyHierarchyDrilldownTab';
import PurchyFailureDateDrilldownTab from '../../components/bi/purchy/PurchyFailureDateDrilldownTab';
import {
  PURCHY_STATIC_KPIS,
  PURCHY_STATIC_SUMMARY,
} from '../../data/purchyStaticData';
import {
  getStaticDishonourDetail,
  getStaticGrowerDetail,
  getStaticFilterOptionsFromData,
  isBackendDataEmpty,
  resolveFilterOptions,
} from '../../utils/purchyStaticFilters';

const TABS = [
  { id: 'grower', label: 'Grower Performance' },
  { id: 'dishonour', label: 'Purchy Dishonour' },
  { id: 'dishonour-drill', label: 'Dishonour Drilldown' },
  { id: 'hierarchy-drill', label: 'Staff Drilldown' },
  { id: 'failure-date', label: 'Failure by Date' },
];

const GROWER_SLICERS = [
  { key: 'societyName', label: 'Society', optionKey: 'societyName' },
  { key: 'loyaltySlicer', label: 'Loyalty', optionKey: 'loyaltySlicer' },
];

const DISHONOUR_SLICERS = [
  { key: 'zoneHead', label: 'Zone Head', optionKey: 'zoneHead' },
  { key: 'zonalManager', label: 'Zonal Manager', optionKey: 'zonalManager' },
  { key: 'zonalIncharge', label: 'Zonal Incharge', optionKey: 'zonalIncharge' },
  { key: 'villageStaff', label: 'Village Staff', optionKey: 'villageStaff' },
  { key: 'dishonourBucket', label: 'Dishonour Bucket', optionKey: 'dishonourBucket' },
  { key: 'loyaltySlicer', label: 'Loyalty', optionKey: 'loyaltySlicer' },
];

const GROWER_DETAIL_COLUMNS = [
  { key: 'grower_name_key', label: 'Grower', kind: 'text' },
  { key: 'village_name_key', label: 'Village', kind: 'text' },
  { key: 'society_name', label: 'Society', kind: 'text' },
  { key: 'total_bond', label: 'Total Bond', kind: 'num' },
  { key: 'indent_qty', label: 'Indent QTY', kind: 'num' },
  { key: 'weight_qty_2025', label: 'Weight Qty 2025', kind: 'num' },
  { key: 'indent_failer_qty', label: 'Indent Failer QTY', kind: 'num' },
  { key: 'loyalty_slicer', label: 'Loyalty', kind: 'text' },
];

const DISHONOUR_DETAIL_COLUMNS = [
  { key: 'societyName', label: 'Society', kind: 'text' },
  { key: 'villageNameKey', label: 'Village', kind: 'text' },
  { key: 'growerNameKey', label: 'Grower', kind: 'text' },
  { key: 'villageStaff', label: 'Village Staff', kind: 'text' },
  { key: 'noOfPurchyIndent', label: 'No of Purchy Indent', kind: 'int' },
  { key: 'noOfIndentFailerPurchy', label: 'No of Indent Failer purchy', kind: 'int' },
  { key: 'supplyCount2025', label: '2025 Supply Count', kind: 'int' },
  { key: 'indentQty2025', label: '2025 Indent Qty', kind: 'num' },
  { key: 'supplyQty2025', label: '2025 Supply Qty', kind: 'num' },
  { key: 'dishonourQty2025', label: '2025 Dishonour Qty', kind: 'num' },
  { key: 'dishonourPctQty', label: '2025 Dishonour % (Qty)', kind: 'pct' },
];

export default function PurchyAnalysisDashboard() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('grower');
  const [useStaticData, setUseStaticData] = useState(false);
  const [autoFallback, setAutoFallback] = useState(false);

  const useLiveData = !useStaticData;
  const needsGrowerData = activeTab === 'grower';
  const needsDishonourData = activeTab === 'dishonour';
  const needsDrilldownData = ['dishonour-drill', 'hierarchy-drill', 'failure-date'].includes(activeTab);
  const needsFilterData = needsGrowerData || needsDishonourData || needsDrilldownData;

  const {
    options,
    filters,
    setFilter,
    clearFilters,
    queryParams,
    loading: filtersLoading,
    error: filtersError,
  } = usePurchyFilters({ enabled: useLiveData && needsFilterData });

  const [debouncedParams, setDebouncedParams] = useState(queryParams);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedParams(queryParams), 300);
    return () => clearTimeout(t);
  }, [queryParams]);

  const grower = usePurchyGrowerPerformance(debouncedParams, { enabled: useLiveData && needsGrowerData });
  const dishonour = usePurchyDishonour(debouncedParams, { enabled: useLiveData && needsDishonourData });

  const backendEmpty = useMemo(() => {
    if (!useLiveData) return false;
    const growerLoading = needsGrowerData && (grower.loadingSummary || grower.loadingDetail);
    const dishonourLoading = needsDishonourData && (dishonour.loadingKpis || dishonour.loadingDetail);
    if (growerLoading || dishonourLoading) return false;

    const growerEmpty = needsGrowerData && !(grower.summary?.length) && !(grower.detail?.rows?.length);
    const dishonourEmpty = needsDishonourData && !dishonour.kpis && !(dishonour.detail?.rows?.length);
    if (!needsGrowerData && !needsDishonourData) return false;
    if (needsGrowerData && needsDishonourData) {
      return isBackendDataEmpty({
        summary: grower.summary,
        growerDetail: grower.detail,
        kpis: dishonour.kpis,
        dishonourDetail: dishonour.detail,
      });
    }
    return growerEmpty || dishonourEmpty;
  }, [useLiveData, needsGrowerData, needsDishonourData, grower, dishonour]);

  useEffect(() => {
    if (useLiveData && (backendEmpty || grower.error || dishonour.error || filtersError)) {
      setAutoFallback(true);
    } else if (useLiveData && !backendEmpty && !grower.error && !dishonour.error) {
      setAutoFallback(false);
    }
  }, [useLiveData, backendEmpty, grower.error, dishonour.error, filtersError]);

  const showingStatic = useStaticData || (useLiveData && autoFallback);

  const filterOptions = useMemo(
    () => (showingStatic
      ? getStaticFilterOptionsFromData()
      : resolveFilterOptions(options, { preferStatic: false })),
    [showingStatic, options],
  );

  const staticGrowerDetail = useMemo(
    () => getStaticGrowerDetail(filters, grower.page, grower.pageSize),
    [filters, grower.page, grower.pageSize],
  );

  const staticDishonourDetail = useMemo(
    () => getStaticDishonourDetail(filters, dishonour.page, dishonour.pageSize),
    [filters, dishonour.page, dishonour.pageSize],
  );

  const summaryRows = useMemo(() => {
    const rows = showingStatic
      ? PURCHY_STATIC_SUMMARY
      : (grower.summary || []);
    return rows.filter((r) => r.year !== '2020');
  }, [showingStatic, grower.summary]);

  const growerDetail = showingStatic ? staticGrowerDetail : grower.detail;
  const dishonourKpis = showingStatic ? PURCHY_STATIC_KPIS : dishonour.kpis;
  const dishonourDetail = showingStatic ? staticDishonourDetail : dishonour.detail;

  const pageBg = isDarkMode ? 'bg-slate-900' : 'bg-slate-100';
  const headerText = isDarkMode ? 'text-slate-100' : 'text-slate-900';
  const activeSlicers = activeTab === 'grower' ? GROWER_SLICERS : DISHONOUR_SLICERS;

  const loadError = useLiveData && !showingStatic
    ? (filtersError || grower.error || dishonour.error)
    : null;

  const summaryLoading = useLiveData && !showingStatic && grower.loadingSummary;
  const growerDetailLoading = useLiveData && !showingStatic && grower.loadingDetail;
  const kpiLoading = useLiveData && !showingStatic && dishonour.loadingKpis;
  const dishonourDetailLoading = useLiveData && !showingStatic && dishonour.loadingDetail;

  return (
    <div className={`flex h-[calc(100dvh-3.75rem)] min-h-0 flex-col overflow-hidden ${pageBg}`}>
      <div className="mb-2 flex shrink-0 flex-col gap-2 p-2 sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BiDashboardHeader
            title="Purchy Analysis"
            subtitle="Grower Performance & Dishonour Intelligence"
            icon={MdShoppingCart}
            iconColor="#7c3aed"
            isDarkMode={isDarkMode}
          />
          <div className="flex min-w-0 shrink items-center gap-4">
            <BiKeyMetricBox
              value={growerDetail?.total ?? 0}
              title="Total Growers"
              subtitle="All"
              isDarkMode={isDarkMode}
            />
          </div>
        </div>

        <BiFilterBarLayout isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}>
          <div className={`flex min-w-0 w-full basis-full flex-wrap items-center gap-0.5 rounded-xl border p-0.5 sm:w-auto sm:basis-auto sm:flex-nowrap ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : `text-slate-500 hover:text-slate-700 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className={`mx-0.5 hidden h-6 w-px shrink-0 sm:block ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />

          <div className={`flex items-center gap-1 rounded-xl border p-1 sm:gap-2 sm:p-1.5 ${
            isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
          }`}>
            <button
              type="button"
              onClick={() => setUseStaticData(false)}
              className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                !useStaticData
                  ? 'bg-violet-600 text-white shadow-sm'
                  : `text-slate-500 hover:text-slate-700 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
              }`}
            >
              <MdCloud className="h-3.5 w-3.5" /> Live
            </button>
            <button
              type="button"
              onClick={() => setUseStaticData(true)}
              className={`shrink-0 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                useStaticData
                  ? 'bg-amber-500 text-white shadow-sm'
                  : `text-slate-500 hover:text-slate-700 ${isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
              }`}
            >
              <MdScience className="h-3.5 w-3.5" /> Sample
            </button>
          </div>
        </BiFilterBarLayout>
      </div>

      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-3 py-2 sm:px-4">

        {loadError && (
          <div className="shrink-0 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {loadError}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {activeTab === 'grower' && (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <PurchyFilterBar
              compact
              slicers={activeSlicers}
              options={filterOptions}
              filters={filters}
              onFilterChange={setFilter}
              onClear={clearFilters}
              isDarkMode={isDarkMode}
              loading={!showingStatic && filtersLoading}
            />
            <PurchySummaryTable compact rows={summaryRows} loading={summaryLoading} isDarkMode={isDarkMode} />
            <PurchyDetailTable
              fillHeight
              compact
              className="min-h-[240px] flex-1"
              title="Grower Detail"
              columns={GROWER_DETAIL_COLUMNS}
              rows={growerDetail?.rows || []}
              loading={growerDetailLoading}
              total={growerDetail?.total}
              page={grower.page}
              pageSize={grower.pageSize}
              onPageChange={grower.setPage}
              onPageSizeChange={grower.setPageSize}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        {activeTab === 'dishonour' && (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <PurchyKpiGrid compact kpis={dishonourKpis} loading={kpiLoading} isDarkMode={isDarkMode} />
            <PurchyFilterBar
              compact
              slicers={activeSlicers}
              options={filterOptions}
              filters={filters}
              onFilterChange={setFilter}
              onClear={clearFilters}
              isDarkMode={isDarkMode}
              loading={!showingStatic && filtersLoading}
            />
            <PurchyDetailTable
              fillHeight
              compact
              className="min-h-[240px] flex-1"
              title="Dishonour Detail"
              columns={DISHONOUR_DETAIL_COLUMNS}
              rows={dishonourDetail?.rows || []}
              loading={dishonourDetailLoading}
              total={dishonourDetail?.total}
              page={dishonour.page}
              pageSize={dishonour.pageSize}
              onPageChange={dishonour.setPage}
              onPageSizeChange={dishonour.setPageSize}
              isDarkMode={isDarkMode}
              emptyMessage="No growers with indent failures for the selected filters."
            />
            <p className={`shrink-0 text-center text-[10px] italic leading-tight ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
              Note: Indent − Supply ≠ Failure — some purchys are within the 5-day window.
            </p>
          </div>
        )}

        {activeTab === 'dishonour-drill' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <PurchyDishonourDrilldownTab
              isDarkMode={isDarkMode}
              useLiveData={useLiveData && !showingStatic}
              globalQueryParams={debouncedParams}
              filterOptions={filterOptions}
            />
          </div>
        )}

        {activeTab === 'hierarchy-drill' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <PurchyHierarchyDrilldownTab
              isDarkMode={isDarkMode}
              useLiveData={useLiveData && !showingStatic}
              globalQueryParams={debouncedParams}
            />
          </div>
        )}

        {activeTab === 'failure-date' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <PurchyFailureDateDrilldownTab
              isDarkMode={isDarkMode}
              useLiveData={useLiveData && !showingStatic}
              globalQueryParams={debouncedParams}
              filterOptions={filterOptions}
            />
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
