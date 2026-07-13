const { pool } = require('../../config/mysql');
const { buildFilterContext } = require('./purchyFilterBuilder');
const { whereAnd, pctRatio } = require('./purchyDrilldownUtils');

const DISHONOUR_GROWER_FILTER = 'gs.no_of_indent_failer_purchy > 0';

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
  const [rows] = await pool.query(
    `SELECT
      ${groupCol} AS id,
      ${groupCol} AS label,
      CASE WHEN SUM(gs.indent_qty) > 0
        THEN SUM(gs.indent_failer_qty) / SUM(gs.indent_qty)
        ELSE 0 END AS pct
    FROM purchy_grower_summary_v gs
    ${ctx.joins}
    ${whereAnd(ctx, `${DISHONOUR_GROWER_FILTER}${parentFilterSql ? ` AND ${parentFilterSql}` : ''}`)}
    GROUP BY ${groupCol}
    HAVING SUM(gs.indent_qty) > 0
    ORDER BY pct DESC
    LIMIT ?`,
    [...ctx.params, ...parentParams, limit],
  );
  return rows.map(mapTreeRow);
}

async function getDishonourDrilldown(query) {
  const ctx = buildFilterContext(query);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(query.pageSize, 10) || 25));
  const offset = (page - 1) * pageSize;

  const selectedSociety = query.selectedSociety || null;
  const selectedVillage = query.selectedVillage || null;
  const selectedGrower = query.selectedGrower || null;

  const totalsRow = await queryOne(
    `SELECT
      COUNT(DISTINCT gs.grower_name_key) AS growers,
      COUNT(DISTINCT gs.village_name_key) AS villages,
      IFNULL(SUM(gs.indent_qty), 0) AS indent_qty,
      IFNULL(SUM(gs.weight_qty_2025), 0) AS supply_qty,
      IFNULL(SUM(gs.indent_failer_qty), 0) AS dishonour_qty
    FROM purchy_grower_summary_v gs
    ${ctx.joins}
    ${whereAnd(ctx, DISHONOUR_GROWER_FILTER)}`,
    ctx.params,
  );

  const rootPct = pctRatio(totalsRow.dishonour_qty, totalsRow.indent_qty);

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

  const detailWhereParts = [DISHONOUR_GROWER_FILTER];
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

  const detailWhere = whereAnd(ctx, detailWhereParts.join(' AND '));

  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM purchy_grower_summary_v gs ${ctx.joins} ${detailWhere}`,
    detailParams,
  );

  const [detailRows] = await pool.query(
    `SELECT
      gs.grower_name_key AS growerNameKey,
      gs.indent_qty AS indentQty,
      gs.weight_qty_2025 AS supplyQty,
      gs.indent_failer_qty AS dishonourQty,
      CASE WHEN gs.indent_qty > 0 THEN gs.indent_failer_qty / gs.indent_qty ELSE 0 END AS dishonourPct
    FROM purchy_grower_summary_v gs
    ${ctx.joins}
    ${detailWhere}
    ORDER BY dishonourPct DESC, gs.indent_failer_qty DESC
    LIMIT ? OFFSET ?`,
    [...detailParams, pageSize, offset],
  );

  return {
    kpis: {
      growers: Number(totalsRow.growers) || 0,
      villages: Number(totalsRow.villages) || 0,
    },
    rootLabel: '2025 Dishonour % (Qty)',
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
      indentQty: Number(totalsRow.indent_qty) || 0,
      supplyQty: Number(totalsRow.supply_qty) || 0,
      dishonourQty: Number(totalsRow.dishonour_qty) || 0,
      dishonourPct: rootPct,
    },
  };
}

module.exports = {
  getDishonourDrilldown,
};
