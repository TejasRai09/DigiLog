const { pool } = require('../../config/mysql');
const { buildFilterContext, filteredGrowersCte } = require('./purchyFilterBuilder');

const SUMMARY_YEARS = ['2021', '2022', '2023', '2024', '2025'];

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

function build2025YearRow(row) {
  const issuedN = Number(row.issued_2025) || 0;
  const weightedN = Number(row.weighted_2025) || 0;
  const ttlBondN = Number(row.ttl_bond_2025) || 0;
  const supplyN = Number(row.supply_qty_2025) || 0;

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
  const fg = filteredGrowersCte(ctx);
  const params = ctx.params;

  const indentSql = `
    SELECT
      COUNT(*) AS indent_count,
      IFNULL(SUM(i.supllymodeqty), 0) AS indent_qty
    FROM purchy_indent i
    INNER JOIN (${fg}) fg
      ON fg.village_code = i.villagecode AND fg.grower_code = i.growercode`;

  const supplySql = `
    SELECT
      COUNT(*) AS supply_count,
      IFNULL(SUM(s.purchasemodeqty), 0) AS supply_qty
    FROM purchy_supply s
    INNER JOIN (${fg}) fg
      ON fg.village_code = s.villagecode AND fg.grower_code = s.growercode`;

  const dishonourSql = `
    SELECT
      COUNT(*) AS dishonour_count,
      IFNULL(SUM(d.mode_qty), 0) AS dishonour_qty
    FROM purchy_dishonour d
    INNER JOIN purchy_indent i
      ON CAST(d.society_purchy_no AS CHAR) COLLATE utf8mb4_0900_ai_ci = i.societypurchy_no
    INNER JOIN (${fg}) fg
      ON fg.village_code = i.villagecode AND fg.grower_code = i.growercode`;

  const [indentRow, supplyRow, dishonourRow] = await Promise.all([
    queryOne(indentSql, params),
    queryOne(supplySql, params),
    queryOne(dishonourSql, params),
  ]);

  return {
    indentCount: Number(indentRow.indent_count) || 0,
    indentQty: Number(indentRow.indent_qty) || 0,
    supplyCount: Number(supplyRow.supply_count) || 0,
    supplyQty: Number(supplyRow.supply_qty) || 0,
    dishonourCount: Number(dishonourRow.dishonour_count) || 0,
    dishonourQty: Number(dishonourRow.dishonour_qty) || 0,
  };
}

async function getSummary(query) {
  const ctx = buildFilterContext(query);
  const aggRow = await queryOne(buildGrowerSummaryAggregateSql(ctx), ctx.params);

  const rows = ['2021', '2022', '2023', '2024'].map((year) => buildHistoricalYearRow(year, aggRow));
  rows.push(build2025YearRow(aggRow));
  return rows;
}

async function getDetail(query) {
  const ctx = buildFilterContext(query);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(query.pageSize, 10) || 100));
  const offset = (page - 1) * pageSize;

  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM purchy_grower_summary_v gs ${ctx.joins} ${ctx.whereSql}`,
    ctx.params,
  );

  const [rows] = await pool.query(
    `SELECT
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
    ORDER BY gs.society_name, gs.village_name, gs.grower_name
    LIMIT ? OFFSET ?`,
    [...ctx.params, pageSize, offset],
  );

  return {
    total: Number(countRow.total) || 0,
    page,
    pageSize,
    rows,
  };
}

async function getFilterOptions() {
  const [societies] = await pool.query(
    'SELECT DISTINCT society_name AS value FROM purchy_grower_summary_v WHERE society_name IS NOT NULL ORDER BY society_name',
  );
  const [loyalty] = await pool.query(
    'SELECT DISTINCT loyalty_slicer AS value FROM purchy_grower_summary_v ORDER BY loyalty_slicer',
  );
  const [buckets] = await pool.query(
    'SELECT DISTINCT dishonour_bucket AS value FROM purchy_grower_summary_v ORDER BY dishonour_bucket',
  );
  const [zoneHeads] = await pool.query(
    'SELECT DISTINCT zone_head AS value FROM purchy_field_staff WHERE zone_head IS NOT NULL ORDER BY zone_head',
  );
  const [zonalManagers] = await pool.query(
    'SELECT DISTINCT zonal_manager AS value FROM purchy_field_staff WHERE zonal_manager IS NOT NULL ORDER BY zonal_manager',
  );
  const [zonalIncharges] = await pool.query(
    'SELECT DISTINCT zonal_incharge AS value FROM purchy_field_staff WHERE zonal_incharge IS NOT NULL ORDER BY zonal_incharge',
  );
  const [villageStaff] = await pool.query(
    'SELECT DISTINCT village_staff AS value FROM purchy_field_staff WHERE village_staff IS NOT NULL ORDER BY village_staff',
  );

  const [villageNames] = await pool.query(
    'SELECT DISTINCT village_name_key AS value FROM purchy_grower_summary_v WHERE village_name_key IS NOT NULL ORDER BY village_name_key LIMIT 1000',
  );

  return {
    societyName: societies.map((r) => r.value),
    loyaltySlicer: loyalty.map((r) => r.value),
    dishonourBucket: buckets.map((r) => r.value),
    villageName: villageNames.map((r) => r.value),
    zoneHead: zoneHeads.map((r) => r.value),
    zonalManager: zonalManagers.map((r) => r.value),
    zonalIncharge: zonalIncharges.map((r) => r.value),
    villageStaff: villageStaff.map((r) => r.value),
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
