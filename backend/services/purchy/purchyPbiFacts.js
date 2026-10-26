/**
 * Power BI v9 fact-table measures for Grower Intelligence.
 *
 * Matches _Measures.tmdl:
 *   2025_Indent Count / Qty  — COUNTROWS / SUM supllymodeqty on Indent RELATED to summary
 *   2025_Supply Count / Qty  — COUNTROWS / SUM purchasemodeqty on Supply via Indent purchy no
 *   2025_Dishonour Count / Qty — Dishonour via Indent purchy no RELATED to summary
 *   2025_Dishonour % (Count/Qty) — DIVIDE(dishonour, indent, 0)
 *
 * Every slicer filters purchy_grower_summary (gs), so the measures are additive per grower and
 * read from the pre-aggregated purchy_grower_facts_2025 (see purchyGrowerFacts.js).
 * The *Raw variants scan the fact tables and are only needed when grouping or filtering on
 * Indent / Supply columns (e.g. variety type).
 *
 * Join note: societypurchy_no columns are VARCHAR with matching collation — join directly
 * (no CAST/COLLATE) so idx_purchy_*_purchy_no can be used.
 */
const { pool } = require('../../config/mysql');
const { FACTS_TABLE, purchaseModeQtySql, ensureGrowerFacts } = require('./purchyGrowerFacts');

const INDENT_PURCHY = 'i.societypurchy_no';
const SUPPLY_PURCHY = 's.societypurchy_no';
const DISHONOUR_PURCHY = 'd.society_purchy_no';

function gsFromIndent() {
  return `INNER JOIN purchy_grower_summary_v gs
      ON i.villagecode = gs.village_code AND i.growercode = gs.grower_code`;
}

/** Growers without any 2025 indent have no facts row and are excluded, as with the Indent join. */
function factsInnerJoinSql() {
  return `INNER JOIN ${FACTS_TABLE} f
      ON f.village_code = gs.village_code AND f.grower_code = gs.grower_code`;
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

function toMetrics(row) {
  const indentCount = Number(row.indent_count) || 0;
  const indentQty = Number(row.indent_qty) || 0;
  const supplyCount = Number(row.supply_count) || 0;
  const supplyQty = Number(row.supply_qty) || 0;
  const supplyNetwt = Number(row.supply_netwt) || 0;
  const dishonourCount = Number(row.dishonour_count) || 0;
  const dishonourQty = Number(row.dishonour_qty) || 0;
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

const FACT_SUMS_SQL = `
      IFNULL(SUM(f.indent_count), 0) AS indent_count,
      IFNULL(SUM(f.indent_qty), 0) AS indent_qty,
      IFNULL(SUM(f.supply_count), 0) AS supply_count,
      IFNULL(SUM(f.supply_qty), 0) AS supply_qty,
      IFNULL(SUM(f.supply_netwt), 0) AS supply_netwt,
      IFNULL(SUM(f.dishonour_count), 0) AS dishonour_count,
      IFNULL(SUM(f.dishonour_qty), 0) AS dishonour_qty`;

/** @param {object} ctx filter context */
async function query2025Facts(ctx) {
  await ensureGrowerFacts();
  const row = await queryOne(
    `SELECT ${FACT_SUMS_SQL}
    FROM purchy_grower_summary_v gs
    ${factsInnerJoinSql()}
    ${ctx.joins}
    ${ctx.whereSql}`,
    ctx.params || [],
  );
  return toMetrics(row);
}

/** Same measures computed from the raw fact tables. */
async function query2025FactsRaw(ctx) {
  const params = ctx.params || [];
  const [indentRow, supplyRow, dishonourRow] = await Promise.all([
    queryOne(indentFactsSql(ctx), params),
    queryOne(supplyFactsSql(ctx), params),
    queryOne(dishonourFactsSql(ctx), params),
  ]);
  return toMetrics({ ...indentRow, ...supplyRow, ...dishonourRow });
}

function extraWhere(ctx, extraSql) {
  if (ctx.whereSql) return `${ctx.whereSql} AND ${extraSql}`;
  return `WHERE ${extraSql}`;
}

const FACT_COLS = [
  'indent_count', 'indent_qty', 'supply_count', 'supply_qty',
  'supply_netwt', 'dishonour_count', 'dishonour_qty',
];

/** Merge rows by group label (NULL and '' both become '—') and derive the PBI measures. */
function groupedMetrics(rows) {
  const byGrp = new Map();
  for (const r of rows) {
    const key = r.grp == null || r.grp === '' ? '—' : String(r.grp);
    if (!byGrp.has(key)) byGrp.set(key, { grp: key });
    const acc = byGrp.get(key);
    FACT_COLS.forEach((col) => {
      if (r[col] !== undefined) acc[col] = (Number(acc[col]) || 0) + (Number(r[col]) || 0);
    });
  }
  return [...byGrp.values()].map((r) => ({ grp: r.grp, ...toMetrics(r) }));
}

/**
 * Group fact measures by a gs / fs column (PBI measure in that column's filter context).
 * `groupExpr` and `extraSql` may only reference gs / fs columns; use query2025FactsGroupedRaw
 * for Indent / Supply columns.
 */
async function query2025FactsGrouped(ctx, groupExpr, extraSql = '') {
  await ensureGrowerFacts();
  const where = extraSql ? extraWhere(ctx, extraSql) : ctx.whereSql;
  const [rows] = await pool.query(
    `SELECT ${groupExpr} AS grp, ${FACT_SUMS_SQL}
    FROM purchy_grower_summary_v gs
    ${factsInnerJoinSql()}
    ${ctx.joins}
    ${where}
    GROUP BY grp`,
    ctx.params || [],
  );
  return groupedMetrics(rows);
}

/** Group fact counts by any column, including Indent (i.*) columns. */
async function query2025FactsGroupedRaw(ctx, groupExpr, extraSql = '') {
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

  return groupedMetrics([...indentRows[0], ...supplyRows[0], ...dishonourRows[0]]);
}

/**
 * Per-grower 2025 fact measures (row context in PBI detail tables), aliased `f`.
 * Callers must `await ensureGrowerFacts()` first.
 */
function growerFactJoinSql() {
  return `LEFT JOIN ${FACTS_TABLE} f
      ON f.village_code = gs.village_code AND f.grower_code = gs.grower_code`;
}

module.exports = {
  query2025Facts,
  query2025FactsRaw,
  query2025FactsGrouped,
  query2025FactsGroupedRaw,
  growerFactJoinSql,
  ensureGrowerFacts,
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
