const { pool } = require('../../config/mysql');
const { buildFilterContext } = require('./purchyFilterBuilder');
const { query2025Facts } = require('./purchyPbiFacts');

const SUMMARY_YEARS = ['2021', '2022', '2023', '2024', '2025'];

/** Known loyalty / dishonour slicer labels (avoid DISTINCT on computed view columns). */
const STATIC_LOYALTY_SLICERS = [
  '0. Never supplied',
  '1. Supplied 1 year',
  '2. Supplied 2 years',
  '3. Supplied 3 years',
  '4. Supplied 4 years',
  '5. Supplied 5 years',
];

const STATIC_DISHONOUR_BUCKETS = [
  'No Indent',
  '0% - No Failure',
  '1-20% Failure',
  '21-40% Failure',
  '41-60% Failure',
  '61-80% Failure',
  '81-99% Failure',
  '100% Failure',
];

const HISTORICAL_YEAR_COLS = {
  2021: {
    bond: 'bond2021', issue: 'issue21', wt: 'wt21', supply: 'supply_2021', indentGrower: 'issue21',
  },
  2022: {
    bond: 'bond2022', issue: 'issue22', wt: 'wt22', supply: 'supply_2022', indentGrower: 'issue22',
  },
  2023: {
    bond: 'bond2023', issue: 'issue23', wt: 'wt23', supply: 'supply_2023', indentGrower: 'issue23',
  },
  2024: {
    bond: 'bond2024', issue: 'issue24', wt: 'wt24', supply: 'supply_2024', indentGrower: 'issue24',
  },
};

async function queryOne(sql, params) {
  const [[row]] = await pool.query(sql, params);
  return row || {};
}

function buildGrowerSummaryAggregateSql(ctx) {
  const yearExprs = Object.entries(HISTORICAL_YEAR_COLS).map(([year, cols]) => `
    SUM(CASE WHEN IFNULL(gs.${cols.bond}, 0) > 0 THEN 1 ELSE 0 END) AS bonded_${year},
    SUM(CASE WHEN IFNULL(gs.${cols.indentGrower}, 0) > 0 THEN 1 ELSE 0 END) AS indent_growers_${year},
    SUM(CASE WHEN IFNULL(gs.${cols.supply}, 0) > 0 THEN 1 ELSE 0 END) AS supplied_${year},
    IFNULL(SUM(gs.${cols.bond}), 0) AS ttl_bond_${year},
    IFNULL(SUM(gs.${cols.supply}), 0) AS supply_qty_${year},
    IFNULL(SUM(gs.${cols.issue}), 0) AS issued_${year},
    IFNULL(SUM(gs.${cols.wt}), 0) AS weighted_${year}`).join(',\n');

  return `
    SELECT
      ${yearExprs},
      SUM(CASE WHEN IFNULL(gs.total_bond, 0) > 0 THEN 1 ELSE 0 END) AS bonded_2025,
      SUM(CASE WHEN IFNULL(gs.no_of_purchy_indent, 0) > 0 THEN 1 ELSE 0 END) AS indent_growers_2025,
      SUM(CASE WHEN IFNULL(gs.weight_qty_2025, 0) > 0 THEN 1 ELSE 0 END) AS supplied_2025,
      IFNULL(SUM(gs.total_bond), 0) AS ttl_bond_2025,
      IFNULL(SUM(gs.no_of_purchy_indent), 0) AS issued_2025,
      IFNULL(SUM(gs.no_of_weight_purchy), 0) AS weighted_2025,
      IFNULL(SUM(gs.weight_qty_2025), 0) AS supply_qty_2025
    FROM purchy_grower_summary_v gs
    ${ctx.joins}
    ${ctx.whereSql}
  `;
}

function buildHistoricalYearRow(year, row) {
  const issuedN = Number(row[`issued_${year}`]) || 0;
  const weightedN = Number(row[`weighted_${year}`]) || 0;
  const ttlBondN = Number(row[`ttl_bond_${year}`]) || 0;
  const supplyN = Number(row[`supply_qty_${year}`]) || 0;

  return {
    year,
    ttlGrowersWithBond: Number(row[`bonded_${year}`]) || 0,
    growersWithIndent: Number(row[`indent_growers_${year}`]) || 0,
    growersSupplied: Number(row[`supplied_${year}`]) || 0,
    ttlBond: ttlBondN,
    supplyQtyByYear: supplyN,
    supplyVsBondPct: ttlBondN ? supplyN / ttlBondN : null,
    issuedPurchyCnt: issuedN,
    weightedPurchyCnt: weightedN,
    purchyDishonourCntPct: issuedN ? (issuedN - weightedN) / issuedN : null,
  };
}

function build2025YearRow(row, tx) {
  const issuedN = tx.indentCount;
  const weightedN = tx.supplyCount;
  const ttlBondN = Number(row.ttl_bond_2025) || 0;
  const supplyN = tx.supplyQty;

  return {
    year: '2025',
    ttlGrowersWithBond: Number(row.bonded_2025) || 0,
    growersWithIndent: Number(row.indent_growers_2025) || 0,
    growersSupplied: Number(row.supplied_2025) || 0,
    ttlBond: ttlBondN,
    supplyQtyByYear: supplyN,
    supplyVsBondPct: ttlBondN ? supplyN / ttlBondN : null,
    issuedPurchyCnt: issuedN,
    weightedPurchyCnt: weightedN,
    purchyDishonourCntPct: issuedN ? (issuedN - weightedN) / issuedN : null,
  };
}

async function get2025TransactionMetrics(ctx) {
  return query2025Facts(ctx);
}

async function getSummary(query) {
  const ctx = buildFilterContext(query);
  // Grower summary only needs indent + supply counts; skip unused dishonour fact scan.
  const [aggRow, tx] = await Promise.all([
    queryOne(buildGrowerSummaryAggregateSql(ctx), ctx.params),
    query2025Facts(ctx, { includeDishonour: false }),
  ]);

  const rows = ['2021', '2022', '2023', '2024'].map((year) => buildHistoricalYearRow(year, aggRow));
  rows.push(build2025YearRow(aggRow, tx));
  return rows;
}

async function getDetail(query) {
  const ctx = buildFilterContext(query);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(query.pageSize, 10) || 100));
  const offset = (page - 1) * pageSize;

  const countSql = `SELECT
      COUNT(*) AS total,
      IFNULL(SUM(gs.total_bond), 0) AS total_bond,
      IFNULL(SUM(gs.indent_qty), 0) AS indent_qty,
      IFNULL(SUM(gs.weight_qty_2025), 0) AS weight_qty_2025,
      IFNULL(SUM(gs.indent_failer_qty), 0) AS indent_failer_qty
     FROM purchy_grower_summary_v gs ${ctx.joins} ${ctx.whereSql}`;

  const pageSql = `SELECT
      gs.grower_name_key,
      gs.village_name_key,
      gs.society_name,
      gs.total_bond,
      gs.indent_qty,
      gs.weight_qty_2025,
      gs.indent_failer_qty,
      gs.loyalty_slicer
    FROM purchy_grower_summary_v gs
    ${ctx.joins}
    ${ctx.whereSql}
    ORDER BY IFNULL(gs.weight_qty_2025, 0) ASC, gs.society_name, gs.village_name, gs.grower_name
    LIMIT ? OFFSET ?`;

  const [countRow, pageResult] = await Promise.all([
    queryOne(countSql, ctx.params),
    pool.query(pageSql, [...ctx.params, pageSize, offset]),
  ]);
  const rows = pageResult[0];

  return {
    total: Number(countRow.total) || 0,
    page,
    pageSize,
    rows,
    totals: {
      total_bond: Number(countRow.total_bond) || 0,
      indent_qty: Number(countRow.indent_qty) || 0,
      weight_qty_2025: Number(countRow.weight_qty_2025) || 0,
      indent_failer_qty: Number(countRow.indent_failer_qty) || 0,
    },
  };
}

async function getFilterOptions() {
  // Loyalty / dishonour buckets are fixed labels — skip DISTINCT over the computed view.
  // Society + staff + villages load in parallel from indexed base tables where possible.
  const [
    societiesRes,
    zoneHeadsRes,
    zonalManagersRes,
    zonalInchargesRes,
    villageStaffRes,
    villageNamesRes,
  ] = await Promise.all([
    pool.query(
      'SELECT DISTINCT society_name AS value FROM purchy_grower_summary WHERE society_name IS NOT NULL AND society_name <> \'\' ORDER BY society_name',
    ),
    pool.query(
      'SELECT DISTINCT zone_head AS value FROM purchy_field_staff WHERE zone_head IS NOT NULL AND zone_head <> \'\' ORDER BY zone_head',
    ),
    pool.query(
      'SELECT DISTINCT zonal_manager AS value FROM purchy_field_staff WHERE zonal_manager IS NOT NULL AND zonal_manager <> \'\' ORDER BY zonal_manager',
    ),
    pool.query(
      'SELECT DISTINCT zonal_incharge AS value FROM purchy_field_staff WHERE zonal_incharge IS NOT NULL AND zonal_incharge <> \'\' ORDER BY zonal_incharge',
    ),
    pool.query(
      'SELECT DISTINCT village_staff AS value FROM purchy_field_staff WHERE village_staff IS NOT NULL AND village_staff <> \'\' ORDER BY village_staff',
    ),
    pool.query(
      `SELECT DISTINCT
         CONCAT(IFNULL(village_code, ''), '-', IFNULL(village_name, '')) AS value
       FROM purchy_grower_summary
       WHERE village_name IS NOT NULL AND village_name <> ''
       ORDER BY value
       LIMIT 1000`,
    ),
  ]);

  return {
    societyName: societiesRes[0].map((r) => r.value),
    loyaltySlicer: STATIC_LOYALTY_SLICERS,
    dishonourBucket: STATIC_DISHONOUR_BUCKETS,
    villageName: villageNamesRes[0].map((r) => r.value),
    zoneHead: zoneHeadsRes[0].map((r) => r.value),
    zonalManager: zonalManagersRes[0].map((r) => r.value),
    zonalIncharge: zonalInchargesRes[0].map((r) => r.value),
    villageStaff: villageStaffRes[0].map((r) => r.value),
  };
}

module.exports = {
  getSummary,
  getDetail,
  getFilterOptions,
  get2025TransactionMetrics,
  buildFilterContext,
  SUMMARY_YEARS,
};
