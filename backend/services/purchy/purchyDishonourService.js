const { pool } = require('../../config/mysql');
const { buildFilterContext } = require('./purchyFilterBuilder');
const { query2025Facts, growerFactJoinSql, extraWhere } = require('./purchyPbiFacts');

/** PBI page filter: No of Indent Failer purchy is not null. */
function withDishonourPageFilter(ctx) {
  return {
    ...ctx,
    whereSql: extraWhere(ctx, 'gs.no_of_indent_failer_purchy IS NOT NULL'),
  };
}

async function queryOne(sql, params) {
  const [[row]] = await pool.query(sql, params);
  return row || {};
}

function staffJoins(ctx) {
  return ctx.needsStaff
    ? ctx.joins
    : 'LEFT JOIN purchy_field_staff fs ON fs.village_code = gs.village_code';
}

async function getKpis(query) {
  const ctx = withDishonourPageFilter(buildFilterContext(query));

  const [bondedRow, tx] = await Promise.all([
    queryOne(
      `SELECT COUNT(*) AS bonded_growers
       FROM purchy_grower_summary_v gs
       ${ctx.joins}
       ${ctx.whereSql}`,
      ctx.params,
    ),
    query2025Facts(ctx),
  ]);

  return {
    bondedGrowers: Number(bondedRow.bonded_growers) || 0,
    indentCount: tx.indentCount,
    indentQty: tx.indentQty,
    supplyCount: tx.supplyCount,
    supplyQty: tx.supplyQty,
    dishonourCount: tx.dishonourCount,
    dishonourPctCount: tx.dishonourPctCount,
    dishonourQty: tx.dishonourQty,
    dishonourPctQty: tx.dishonourPctQty,
  };
}

async function getDetail(query) {
  const ctx = withDishonourPageFilter(buildFilterContext(query));
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(query.pageSize, 10) || 100));
  const offset = (page - 1) * pageSize;
  const joins = staffJoins(ctx);
  const dishonourWhere = ctx.whereSql;

  const countRow = await queryOne(
    `SELECT
      COUNT(*) AS total,
      IFNULL(SUM(gs.no_of_purchy_indent), 0) AS no_of_purchy_indent,
      IFNULL(SUM(gs.no_of_indent_failer_purchy), 0) AS no_of_indent_failer_purchy,
      IFNULL(SUM(ind.indent_qty), 0) AS indent_qty,
      IFNULL(SUM(sup.supply_count), 0) AS supply_count_2025,
      IFNULL(SUM(sup.supply_qty), 0) AS supply_qty_2025,
      IFNULL(SUM(dh.dishonour_qty), 0) AS dishonour_qty_2025
     FROM purchy_grower_summary_v gs
     ${joins}
     ${growerFactJoinSql()}
     ${dishonourWhere}`,
    ctx.params,
  );

  const [rows] = await pool.query(
    `SELECT
      gs.society_name,
      gs.village_name_key,
      gs.grower_name_key,
      fs.village_staff,
      gs.no_of_purchy_indent,
      gs.no_of_indent_failer_purchy,
      IFNULL(ind.indent_qty, 0) AS indent_qty,
      IFNULL(sup.supply_count, 0) AS supply_count_2025,
      IFNULL(sup.supply_qty, 0) AS supply_qty_2025,
      IFNULL(dh.dishonour_qty, 0) AS dishonour_qty_2025
    FROM purchy_grower_summary_v gs
    ${joins}
    ${growerFactJoinSql()}
    ${dishonourWhere}
    ORDER BY
      CASE WHEN IFNULL(ind.indent_qty, 0) > 0 THEN IFNULL(dh.dishonour_qty, 0) / ind.indent_qty ELSE 0 END DESC,
      IFNULL(dh.dishonour_qty, 0) DESC
    LIMIT ? OFFSET ?`,
    [...ctx.params, pageSize, offset],
  );

  const mapped = rows.map((r) => {
    const indentQty = Number(r.indent_qty) || 0;
    const dishonourQty = Number(r.dishonour_qty_2025) || 0;
    return {
      societyName: r.society_name,
      villageNameKey: r.village_name_key,
      growerNameKey: r.grower_name_key,
      villageStaff: r.village_staff,
      noOfPurchyIndent: Number(r.no_of_purchy_indent) || 0,
      noOfIndentFailerPurchy: Number(r.no_of_indent_failer_purchy) || 0,
      supplyCount2025: Number(r.supply_count_2025) || 0,
      indentQty2025: indentQty,
      supplyQty2025: Number(r.supply_qty_2025) || 0,
      dishonourQty2025: dishonourQty,
      dishonourPctQty: indentQty ? dishonourQty / indentQty : 0,
    };
  });

  const indentQtyTotal = Number(countRow.indent_qty) || 0;
  const dishonourQtyTotal = Number(countRow.dishonour_qty_2025) || 0;

  return {
    total: Number(countRow.total) || 0,
    page,
    pageSize,
    rows: mapped,
    totals: {
      noOfPurchyIndent: Number(countRow.no_of_purchy_indent) || 0,
      noOfIndentFailerPurchy: Number(countRow.no_of_indent_failer_purchy) || 0,
      supplyCount2025: Number(countRow.supply_count_2025) || 0,
      indentQty2025: indentQtyTotal,
      supplyQty2025: Number(countRow.supply_qty_2025) || 0,
      dishonourQty2025: dishonourQtyTotal,
      dishonourPctQty: indentQtyTotal ? dishonourQtyTotal / indentQtyTotal : 0,
    },
  };
}

module.exports = {
  getKpis,
  getDetail,
};
