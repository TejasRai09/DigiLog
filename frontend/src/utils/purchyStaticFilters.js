import {
  PURCHY_STATIC_DISHONOUR_DETAIL,
  PURCHY_STATIC_GROWER_DETAIL,
  PURCHY_STATIC_FILTER_OPTIONS,
} from '../data/purchyStaticData';

/** Use API values when present; fill empty keys from sample data. */
export function resolveFilterOptions(apiOptions, { preferStatic = false } = {}) {
  if (preferStatic) return PURCHY_STATIC_FILTER_OPTIONS;
  if (!apiOptions) return PURCHY_STATIC_FILTER_OPTIONS;

  const merged = { ...PURCHY_STATIC_FILTER_OPTIONS };
  let hasAnyApi = false;
  Object.keys(merged).forEach((key) => {
    const apiVals = apiOptions[key];
    if (Array.isArray(apiVals) && apiVals.length > 0) {
      merged[key] = apiVals;
      hasAnyApi = true;
    }
  });
  return hasAnyApi ? merged : PURCHY_STATIC_FILTER_OPTIONS;
}

/** Distinct filter values derived from sample rows (keeps options in sync with data). */
export function getStaticFilterOptionsFromData() {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
  return {
    societyName: uniq(PURCHY_STATIC_GROWER_DETAIL.map((r) => r.society_name)),
    loyaltySlicer: uniq(PURCHY_STATIC_GROWER_DETAIL.map((r) => r.loyalty_slicer)),
    dishonourBucket: uniq(PURCHY_STATIC_GROWER_DETAIL.map((r) => r.dishonour_bucket)),
    zoneHead: uniq(PURCHY_STATIC_GROWER_DETAIL.map((r) => r.zone_head)),
    zonalManager: uniq(PURCHY_STATIC_GROWER_DETAIL.map((r) => r.zonal_manager)),
    zonalIncharge: uniq(PURCHY_STATIC_GROWER_DETAIL.map((r) => r.zonal_incharge)),
    villageStaff: uniq(PURCHY_STATIC_GROWER_DETAIL.map((r) => r.village_staff)),
  };
}

function matchList(field, selected) {
  if (!selected?.length) return true;
  return selected.includes(field);
}

function filterGrowerRows(rows, filters) {
  return rows.filter((r) => (
    matchList(r.society_name, filters.societyName)
    && matchList(r.loyalty_slicer, filters.loyaltySlicer)
    && matchList(r.dishonour_bucket, filters.dishonourBucket)
    && matchList(r.zone_head, filters.zoneHead)
    && matchList(r.zonal_manager, filters.zonalManager)
    && matchList(r.zonal_incharge, filters.zonalIncharge)
    && matchList(r.village_staff, filters.villageStaff)
  ));
}

function filterDishonourRows(rows, filters) {
  return rows.filter((r) => (
    matchList(r.societyName, filters.societyName)
    && matchList(r.loyalty_slicer, filters.loyaltySlicer)
    && matchList(r.dishonour_bucket, filters.dishonourBucket)
    && matchList(r.zone_head, filters.zoneHead)
    && matchList(r.zonal_manager, filters.zonalManager)
    && matchList(r.zonal_incharge, filters.zonalIncharge)
    && matchList(r.villageStaff, filters.villageStaff)
  ));
}

function paginate(rows, page, pageSize, totals) {
  const total = rows.length;
  const offset = (page - 1) * pageSize;
  return {
    total,
    page,
    pageSize,
    rows: rows.slice(offset, offset + pageSize),
    totals,
  };
}

function sumField(rows, key) {
  return rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

export function getStaticGrowerDetail(filters, page = 1, pageSize = 50) {
  const filtered = filterGrowerRows(PURCHY_STATIC_GROWER_DETAIL, filters);
  return paginate(filtered, page, pageSize, {
    total_bond: sumField(filtered, 'total_bond'),
    indent_qty: sumField(filtered, 'indent_qty'),
    weight_qty_2025: sumField(filtered, 'weight_qty_2025'),
    indent_failer_qty: sumField(filtered, 'indent_failer_qty'),
  });
}

export function getStaticDishonourDetail(filters, page = 1, pageSize = 50) {
  const filtered = filterDishonourRows(PURCHY_STATIC_DISHONOUR_DETAIL, filters);
  const indentQty = sumField(filtered, 'indentQty2025');
  const dishonourQty = sumField(filtered, 'dishonourQty2025');
  return paginate(filtered, page, pageSize, {
    noOfPurchyIndent: sumField(filtered, 'noOfPurchyIndent'),
    noOfIndentFailerPurchy: sumField(filtered, 'noOfIndentFailerPurchy'),
    supplyCount2025: sumField(filtered, 'supplyCount2025'),
    indentQty2025: indentQty,
    supplyQty2025: sumField(filtered, 'supplyQty2025'),
    dishonourQty2025: dishonourQty,
    dishonourPctQty: indentQty ? dishonourQty / indentQty : 0,
  });
}

export function hasActiveFilters(filters) {
  return Object.values(filters).some((v) => Array.isArray(v) && v.length > 0);
}

export function isBackendDataEmpty({ summary, growerDetail, kpis, dishonourDetail }) {
  const summaryEmpty = !summary?.length || summary.every((r) => (
    !r.ttlGrowersWithBond && !r.ttlBond && !r.issuedPurchyCnt
  ));
  const growerEmpty = !growerDetail?.total;
  const kpiEmpty = !kpis || !kpis.bondedGrowers;
  const dishonourEmpty = !dishonourDetail?.total;
  return summaryEmpty && growerEmpty && kpiEmpty && dishonourEmpty;
}
