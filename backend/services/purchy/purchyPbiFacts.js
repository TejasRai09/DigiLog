/**
 * Power BI v9 fact-table measures for Purchy Analysis.
 *
 * Matches _Measures.tmdl:
 *   2025_Indent Count / Qty  — COUNTROWS / SUM supllymodeqty on Indent RELATED to summary
 *   2025_Supply Count / Qty  — COUNTROWS / SUM purchasemodeqty on Supply via Indent purchy no
 *   2025_Dishonour Count / Qty — Dishonour via Indent purchy no RELATED to summary
 *   2025_Dishonour % (Count/Qty) — DIVIDE(dishonour, indent, 0)
 *
 * Join note: societypurchy_no columns are VARCHAR with matching collation — join directly
 * (no CAST/COLLATE) so idx_purchy_*_purchy_no can be used.
 */
const { pool } = require('../../config/mysql');

const INDENT_PURCHY = 'i.societypurchy_no';
const SUPPLY_PURCHY = 's.societypurchy_no';
const DISHONOUR_PURCHY = 'd.society_purchy_no';

/**
 * PBI calculated column Grower_Purchywise_Supply[purchasemodeqty]:
 * VALUE(LEFT(purchasemodename, SEARCH(" ", purchasemodename) - 1))
 */
function purchaseModeQtySql(alias = 's') {
  return `CASE
    WHEN ${alias}.purchasemodename IS NOT NULL
     AND LOCATE(' ', ${alias}.purchasemodename) > 0
     AND SUBSTRING_INDEX(${alias}.purchasemodename, ' ', 1) REGEXP '^[0-9]+([.][0-9]+)?$'
    THEN CAST(SUBSTRING_INDEX(${alias}.purchasemodename, ' ', 1) AS DECIMAL(18,4))
    ELSE NULL
  END`;
}

function gsFromIndent() {
  return `INNER JOIN purchy_grower_summary_v gs
      ON i.villagecode = gs.village_code AND i.growercode = gs.grower_code`;
}

async function queryOne(sql, params) {
  const [[row]] = await pool.query(sql, params);
  return row || {};
}

/** 2025_Indent Count / 2025_Indent Qty */
function indentFactsSql(ctx) {
  return `
    SELECT
      COUNT(*) AS indent_count,
      IFNULL(SUM(i.supllymodeqty), 0) AS indent_qty
    FROM purchy_indent i
    ${gsFromIndent()}
    ${ctx.joins}
    ${ctx.whereSql}
  `;
}

/**
 * 2025_Supply Count / 2025_Supply Qty
 * Filter path: Summary → Indent (grower key) → Supply (purchy no).
 * Set-based JOIN (not correlated EXISTS) so purchy_no indexes stay usable.
 */
function supplyFactsSql(ctx) {
  return `
    SELECT
      COUNT(DISTINCT s.id) AS supply_count,
      IFNULL(SUM(${purchaseModeQtySql('s')}), 0) AS supply_qty,
      IFNULL(SUM(s.netwt), 0) AS supply_netwt
    FROM purchy_supply s
    INNER JOIN purchy_indent i ON ${SUPPLY_PURCHY} = ${INDENT_PURCHY}
    ${gsFromIndent()}
    ${ctx.joins}
    ${ctx.whereSql}
  `;
}

/** 2025_Dishonour Count / 2025_Dishonour Qty */
function dishonourFactsSql(ctx) {
  return `
    SELECT
      COUNT(*) AS dishonour_count,
      IFNULL(SUM(d.mode_qty), 0) AS dishonour_qty
    FROM purchy_dishonour d
    INNER JOIN purchy_indent i
      ON ${DISHONOUR_PURCHY} = ${INDENT_PURCHY}
    ${gsFromIndent()}
    ${ctx.joins}
    ${ctx.whereSql}
  `;
}

function toMetrics(indentRow, supplyRow, dishonourRow) {
  const indentCount = Number(indentRow.indent_count) || 0;
  const indentQty = Number(indentRow.indent_qty) || 0;
  const supplyCount = Number(supplyRow.supply_count) || 0;
  const supplyQty = Number(supplyRow.supply_qty) || 0;
  const supplyNetwt = Number(supplyRow.supply_netwt) || 0;
  const dishonourCount = Number(dishonourRow.dishonour_count) || 0;
  const dishonourQty = Number(dishonourRow.dishonour_qty) || 0;
  return {
    indentCount,
    indentQty,
    supplyCount,
    supplyQty,
    supplyNetwt,
    dishonourCount,
    dishonourQty,
    dishonourPctCount: indentCount ? dishonourCount / indentCount : 0,
    dishonourPctQty: indentQty ? dishonourQty / indentQty : 0,
  };
}

/**
 * @param {object} ctx filter context
 * @param {{ includeDishonour?: boolean }} [opts]
 */
async function query2025Facts(ctx, opts = {}) {
  const includeDishonour = opts.includeDishonour !== false;
  const params = ctx.params || [];
  const tasks = [
    queryOne(indentFactsSql(ctx), params),
    queryOne(supplyFactsSql(ctx), params),
  ];
  if (includeDishonour) {
    tasks.push(queryOne(dishonourFactsSql(ctx), params));
  }
  const [indentRow, supplyRow, dishonourRow] = await Promise.all(tasks);
  return toMetrics(indentRow, supplyRow, includeDishonour ? dishonourRow : {});
}

function extraWhere(ctx, extraSql) {
  if (ctx.whereSql) return `${ctx.whereSql} AND ${extraSql}`;
  return `WHERE ${extraSql}`;
}

/** Group fact counts by a gs / fs column (PBI measure in that column's filter context). */
async function query2025FactsGrouped(ctx, groupExpr, extraSql = '') {
  const where = extraSql ? extraWhere(ctx, extraSql) : ctx.whereSql;
  const groupedCtx = { ...ctx, whereSql: where };
  const params = groupedCtx.params || [];

  const [indentRows, supplyRows, dishonourRows] = await Promise.all([
    pool.query(
      `SELECT
        ${groupExpr} AS grp,
        COUNT(*) AS indent_count,
        IFNULL(SUM(i.supllymodeqty), 0) AS indent_qty
      FROM purchy_indent i
      ${gsFromIndent()}
      ${groupedCtx.joins}
      ${groupedCtx.whereSql}
      GROUP BY grp`,
      params,
    ),
    pool.query(
      `SELECT
        ${groupExpr} AS grp,
        COUNT(DISTINCT s.id) AS supply_count,
        IFNULL(SUM(${purchaseModeQtySql('s')}), 0) AS supply_qty,
        IFNULL(SUM(s.netwt), 0) AS supply_netwt
      FROM purchy_supply s
      INNER JOIN purchy_indent i ON ${SUPPLY_PURCHY} = ${INDENT_PURCHY}
      ${gsFromIndent()}
      ${groupedCtx.joins}
      ${groupedCtx.whereSql}
      GROUP BY grp`,
      params,
    ),
    pool.query(
      `SELECT
        ${groupExpr} AS grp,
        COUNT(*) AS dishonour_count,
        IFNULL(SUM(d.mode_qty), 0) AS dishonour_qty
      FROM purchy_dishonour d
      INNER JOIN purchy_indent i ON ${DISHONOUR_PURCHY} = ${INDENT_PURCHY}
      ${gsFromIndent()}
      ${groupedCtx.joins}
      ${groupedCtx.whereSql}
      GROUP BY grp`,
      params,
    ),
  ]);

  const byGrp = new Map();
  const ensure = (grp) => {
    const key = grp == null || grp === '' ? '—' : String(grp);
    if (!byGrp.has(key)) {
      byGrp.set(key, {
        grp: key,
        indentCount: 0,
        indentQty: 0,
        supplyCount: 0,
        supplyQty: 0,
        supplyNetwt: 0,
        dishonourCount: 0,
        dishonourQty: 0,
      });
    }
    return byGrp.get(key);
  };

  for (const r of indentRows[0]) {
    const row = ensure(r.grp);
    row.indentCount = Number(r.indent_count) || 0;
    row.indentQty = Number(r.indent_qty) || 0;
  }
  for (const r of supplyRows[0]) {
    const row = ensure(r.grp);
    row.supplyCount = Number(r.supply_count) || 0;
    row.supplyQty = Number(r.supply_qty) || 0;
    row.supplyNetwt = Number(r.supply_netwt) || 0;
  }
  for (const r of dishonourRows[0]) {
    const row = ensure(r.grp);
    row.dishonourCount = Number(r.dishonour_count) || 0;
    row.dishonourQty = Number(r.dishonour_qty) || 0;
  }

  return [...byGrp.values()].map((row) => ({
    ...row,
    dishonourPctCount: row.indentCount ? row.dishonourCount / row.indentCount : 0,
    dishonourPctQty: row.indentQty ? row.dishonourQty / row.indentQty : 0,
  }));
}

/**
 * Per-grower 2025 fact measures (row context in PBI detail tables).
 * Keys: village_code, grower_code.
 */
function growerFactJoinSql() {
  return `
    LEFT JOIN (
      SELECT villagecode, growercode,
        COUNT(*) AS indent_count,
        IFNULL(SUM(supllymodeqty), 0) AS indent_qty
      FROM purchy_indent
      GROUP BY villagecode, growercode
    ) ind ON ind.villagecode = gs.village_code AND ind.growercode = gs.grower_code
    LEFT JOIN (
      SELECT i.villagecode, i.growercode,
        COUNT(DISTINCT s.id) AS supply_count,
        IFNULL(SUM(${purchaseModeQtySql('s')}), 0) AS supply_qty,
        IFNULL(SUM(s.netwt), 0) AS supply_netwt
      FROM purchy_supply s
      INNER JOIN purchy_indent i ON ${SUPPLY_PURCHY} = ${INDENT_PURCHY}
      GROUP BY i.villagecode, i.growercode
    ) sup ON sup.villagecode = gs.village_code AND sup.growercode = gs.grower_code
    LEFT JOIN (
      SELECT i.villagecode, i.growercode,
        COUNT(*) AS dishonour_count,
        IFNULL(SUM(d.mode_qty), 0) AS dishonour_qty
      FROM purchy_dishonour d
      INNER JOIN purchy_indent i ON ${DISHONOUR_PURCHY} = ${INDENT_PURCHY}
      GROUP BY i.villagecode, i.growercode
    ) dh ON dh.villagecode = gs.village_code AND dh.growercode = gs.grower_code
  `;
}

module.exports = {
  query2025Facts,
  query2025FactsGrouped,
  growerFactJoinSql,
  indentFactsSql,
  supplyFactsSql,
  dishonourFactsSql,
  gsFromIndent,
  extraWhere,
  purchaseModeQtySql,
  INDENT_PURCHY,
  SUPPLY_PURCHY,
  DISHONOUR_PURCHY,
};
