const { pool } = require('../../config/mysql');
const { buildFilterContext } = require('./purchyFilterBuilder');
const { whereAnd } = require('./purchyDrilldownUtils');
const { query2025Facts, query2025FactsGrouped, growerFactJoinSql } = require('./purchyPbiFacts');

async function queryOne(sql, params) {
  const [[row]] = await pool.query(sql, params);
  return row || {};
}

function mapTreeRow(row) {
  return {
    id: row.id,
    label: row.label,
    pct: Number(row.pct) || 0,
  };
}

async function getTreeLevel(ctx, groupCol, parentFilterSql, parentParams, limit = 100) {
  const childCtx = parentFilterSql
    ? { ...ctx, params: [...ctx.params, ...parentParams] }
    : ctx;
  const rows = await query2025FactsGrouped(childCtx, groupCol, parentFilterSql || '');
  return rows
    .filter((r) => r.indentCount > 0)
    .sort((a, b) => b.dishonourPctCount - a.dishonourPctCount)
    .slice(0, limit)
    .map((r) => mapTreeRow({ id: r.grp, label: r.grp, pct: r.dishonourPctCount }));
}

async function getDishonourDrilldown(query) {
  const ctx = buildFilterContext(query);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(query.pageSize, 10) || 25));
  const offset = (page - 1) * pageSize;

  const selectedSociety = query.selectedSociety || null;
  const selectedVillage = query.selectedVillage || null;
  const selectedGrower = query.selectedGrower || null;

  const [tx, totalsRow] = await Promise.all([
    query2025Facts(ctx),
    queryOne(
      `SELECT
        COUNT(DISTINCT gs.grower_name_key) AS growers,
        COUNT(DISTINCT gs.village_name_key) AS villages
      FROM purchy_grower_summary_v gs
      ${ctx.joins}
      ${ctx.whereSql}`,
      ctx.params,
    ),
  ]);

  const rootPct = tx.dishonourPctCount;

  const societies = await getTreeLevel(ctx, 'gs.society_name', null, []);

  let villages = [];
  if (selectedSociety) {
    villages = await getTreeLevel(ctx, 'gs.village_name_key', 'gs.society_name = ?', [selectedSociety]);
  }

  let growers = [];
  if (selectedSociety && selectedVillage) {
    growers = await getTreeLevel(
      ctx,
      'gs.grower_name_key',
      'gs.society_name = ? AND gs.village_name_key = ?',
      [selectedSociety, selectedVillage],
    );
  }

  const detailWhereParts = [];
  const detailParams = [...ctx.params];
  if (selectedGrower) {
    detailWhereParts.push('gs.grower_name_key = ?');
    detailParams.push(selectedGrower);
  } else if (selectedVillage) {
    detailWhereParts.push('gs.village_name_key = ?');
    detailParams.push(selectedVillage);
  } else if (selectedSociety) {
    detailWhereParts.push('gs.society_name = ?');
    detailParams.push(selectedSociety);
  }

  const detailWhere = detailWhereParts.length
    ? whereAnd(ctx, detailWhereParts.join(' AND '))
    : ctx.whereSql;

  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM purchy_grower_summary_v gs ${ctx.joins} ${detailWhere}`,
    detailParams,
  );

  const [detailRows] = await pool.query(
    `SELECT
      gs.grower_name_key AS growerNameKey,
      IFNULL(ind.indent_qty, 0) AS indentQty,
      IFNULL(sup.supply_qty, 0) AS supplyQty,
      IFNULL(dh.dishonour_qty, 0) AS dishonourQty,
      CASE WHEN IFNULL(ind.indent_qty, 0) > 0 THEN IFNULL(dh.dishonour_qty, 0) / ind.indent_qty ELSE 0 END AS dishonourPct
    FROM purchy_grower_summary_v gs
    ${ctx.joins}
    ${growerFactJoinSql()}
    ${detailWhere}
    ORDER BY dishonourPct DESC, dishonourQty DESC
    LIMIT ? OFFSET ?`,
    [...detailParams, pageSize, offset],
  );

  return {
    kpis: {
      growers: Number(totalsRow.growers) || 0,
      villages: Number(totalsRow.villages) || 0,
    },
    rootLabel: '2025 Dishonour % (Count)',
    rootPct,
    tree: {
      societies: societies.map((s) => ({
        ...s,
        villages: [],
        growers: [],
      })),
    },
    villages,
    growers,
    detailRows: detailRows.map((r) => ({
      growerNameKey: r.growerNameKey,
      indentQty: Number(r.indentQty) || 0,
      supplyQty: r.supplyQty === null ? null : Number(r.supplyQty),
      dishonourQty: Number(r.dishonourQty) || 0,
      dishonourPct: Number(r.dishonourPct) || 0,
    })),
    detailTotal: Number(countRow.total) || 0,
    page,
    pageSize,
    totals: {
      indentQty: tx.indentQty,
      supplyQty: tx.supplyQty,
      dishonourQty: tx.dishonourQty,
      dishonourPct: tx.dishonourPctQty,
    },
  };
}

module.exports = {
  getDishonourDrilldown,
};
