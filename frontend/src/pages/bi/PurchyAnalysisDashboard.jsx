import { useEffect, useMemo, useState } from 'react';
import { MdArrowBack, MdDarkMode, MdLightMode, MdDashboard, MdCloud, MdScience, MdShoppingCart } from 'react-icons/md';
import BiDashboardHeader from '../../components/bi/BiDashboardHeader';
import { BiKeyMetricBox, BiFilterBarLayout } from '../../components/bi/BiLayoutElements';
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
  { key: 'grower_name_key', label: 'Grower_name_Key', kind: 'text' },
  { key: 'village_name_key', label: 'Village_name_Key', kind: 'text' },
  { key: 'society_name', label: 'Society Name', kind: 'text' },
  { key: 'total_bond', label: 'Total Bond_2025', kind: 'int' },
  { key: 'indent_qty', label: 'Indent Qty_2025', kind: 'int' },
  { key: 'weight_qty_2025', label: 'Weight Qty 2025', kind: 'num' },
  { key: 'indent_failer_qty', label: 'Indent Failer Qty', kind: 'int' },
  { key: 'loyalty_slicer', label: "Loyalty_Slicer ('20-'24)", kind: 'text' },
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
  } = usePurchyFilters({ enabled: needsFilterData });

  const [debouncedParams, setDebouncedParams] = useState(queryParams);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedParams(queryParams), 300);
    return () => clearTimeout(t);
  }, [queryParams]);

  const grower = usePurchyGrowerPerformance(debouncedParams, { enabled: needsGrowerData });
  const dishonour = usePurchyDishonour(debouncedParams, { enabled: needsDishonourData });

  const filterOptions = useMemo(
    () => resolveFilterOptions(options, { preferStatic: false }),
    [options],
  );

  const summaryRows = useMemo(() => {
    const rows = grower.summary || [];
    return rows.filter((r) => r.year !== '2020');
  }, [grower.summary]);

  const growerDetail = grower.detail;
  const dishonourKpis = dishonour.kpis;
  const dishonourDetail = dishonour.detail;

  const pageBg = isDarkMode ? 'bg-slate-900' : 'bg-slate-100';
  const headerText = isDarkMode ? 'text-slate-100' : 'text-slate-900';
  const activeSlicers = activeTab === 'grower' ? GROWER_SLICERS : DISHONOUR_SLICERS;

  const loadError = filtersError || grower.error || dishonour.error;

  const summaryLoading = grower.loadingSummary;
  const growerDetailLoading = grower.loadingDetail;
  const kpiLoading = dishonour.loadingKpis;
  const dishonourDetailLoading = dishonour.loadingDetail;

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
              loading={filtersLoading}
            />
            <PurchySummaryTable compact rows={summaryRows} loading={summaryLoading} isDarkMode={isDarkMode} />
            <PurchyDetailTable
              fillHeight
              compact
              className="min-h-[240px] flex-1"
              title="Current Sugar Season Data"
              columns={GROWER_DETAIL_COLUMNS}
              rows={growerDetail?.rows || []}
              loading={growerDetailLoading}
              total={growerDetail?.total}
              totals={growerDetail?.totals}
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
              loading={filtersLoading}
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
              totals={dishonourDetail?.totals}
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
              useLiveData={true}
              globalQueryParams={debouncedParams}
              filterOptions={filterOptions}
            />
          </div>
        )}

        {activeTab === 'hierarchy-drill' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <PurchyHierarchyDrilldownTab
              isDarkMode={isDarkMode}
              useLiveData={true}
              globalQueryParams={debouncedParams}
            />
          </div>
        )}

        {activeTab === 'failure-date' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <PurchyFailureDateDrilldownTab
              isDarkMode={isDarkMode}
              useLiveData={true}
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
