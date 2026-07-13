const { pool } = require('../../config/mysql');
const { buildFilterContext } = require('./purchyFilterBuilder');

function whereAnd(ctx, extra) {
  if (ctx.whereSql) return `${ctx.whereSql} AND ${extra}`;
  return `WHERE ${extra}`;
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
  const ctx = buildFilterContext(query);

  const row = await queryOne(
    `SELECT
      COUNT(*) AS bonded_growers,
      IFNULL(SUM(gs.no_of_purchy_indent), 0) AS indent_count,
      IFNULL(SUM(gs.indent_qty), 0) AS indent_qty,
      IFNULL(SUM(gs.no_of_weight_purchy), 0) AS supply_count,
      IFNULL(SUM(gs.weight_qty_2025), 0) AS supply_qty,
      IFNULL(SUM(gs.no_of_indent_failer_purchy), 0) AS dishonour_count,
      IFNULL(SUM(gs.indent_failer_qty), 0) AS dishonour_qty
    FROM purchy_grower_summary_v gs
    ${ctx.joins}
    ${ctx.whereSql}`,
    ctx.params,
  );

  const indentCount = Number(row.indent_count) || 0;
  const indentQty = Number(row.indent_qty) || 0;
  const dishonourCount = Number(row.dishonour_count) || 0;
  const dishonourQty = Number(row.dishonour_qty) || 0;

  return {
    bondedGrowers: Number(row.bonded_growers) || 0,
    indentCount,
    indentQty,
    supplyCount: Number(row.supply_count) || 0,
    supplyQty: Number(row.supply_qty) || 0,
    dishonourCount,
    dishonourPctCount: indentCount ? dishonourCount / indentCount : 0,
    dishonourQty,
    dishonourPctQty: indentQty ? dishonourQty / indentQty : 0,
  };
}

async function getDetail(query) {
  const ctx = buildFilterContext(query);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(query.pageSize, 10) || 100));
  const offset = (page - 1) * pageSize;
  const joins = staffJoins(ctx);
  const dishonourWhere = whereAnd(ctx, 'gs.no_of_indent_failer_purchy > 0');

  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM purchy_grower_summary_v gs ${joins} ${dishonourWhere}`,
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
      gs.indent_qty,
      gs.no_of_weight_purchy AS supply_count_2025,
      gs.weight_qty_2025 AS supply_qty_2025,
      gs.indent_failer_qty AS dishonour_qty_2025
    FROM purchy_grower_summary_v gs
    ${joins}
    ${dishonourWhere}
    ORDER BY
      CASE WHEN gs.indent_qty > 0 THEN gs.indent_failer_qty / gs.indent_qty ELSE 0 END DESC,
      gs.indent_failer_qty DESC
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

  return {
    total: Number(countRow.total) || 0,
    page,
    pageSize,
    rows: mapped,
  };
}

module.exports = {
  getKpis,
  getDetail,
};
