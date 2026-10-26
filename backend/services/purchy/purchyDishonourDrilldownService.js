const { pool } = require('../../config/mysql');
const { buildFilterContext } = require('./purchyFilterBuilder');
const { whereAnd } = require('./purchyDrilldownUtils');
const {
  query2025Facts,
  query2025FactsGrouped,
  growerFactJoinSql,
  ensureGrowerFacts,
} = require('./purchyPbiFacts');
const { withPurchyCache } = require('./purchyResponseCache');

const SLICER_KEYS = [
  'societyName', 'loyaltySlicer', 'dishonourBucket', 'zoneHead',
  'zonalManager', 'zonalIncharge', 'villageStaff', 'villageName',
];

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

function slicerQuery(query) {
  const out = {};
  SLICER_KEYS.forEach((k) => {
    if (query[k] !== undefined) out[k] = query[k];
  });
  return out;
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

/** Root measures + society level depend only on slicers, not on the tree selection or page. */
function getRoot(slicers, ctx) {
  return withPurchyCache('dishonour-drilldown:root', slicers, async () => {
    const [tx, totalsRow, societies] = await Promise.all([
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
      getTreeLevel(ctx, 'gs.society_name', null, []),
    ]);
    return { tx, totalsRow, societies };
  });
}

function getVillages(slicers, ctx, society) {
  return withPurchyCache('dishonour-drilldown:villages', { ...slicers, society }, () => getTreeLevel(
    ctx,
    'gs.village_name_key',
    'gs.society_name = ?',
    [society],
  ));
}

function getGrowers(slicers, ctx, society, village) {
  return withPurchyCache('dishonour-drilldown:growers', { ...slicers, society, village }, () => getTreeLevel(
    ctx,
    'gs.grower_name_key',
    'gs.society_name = ? AND gs.village_name_key = ?',
    [society, village],
  ));
}

async function getDetailPage(ctx, { selectedSociety, selectedVillage, selectedGrower }, pageSize, offset) {
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

  await ensureGrowerFacts();
  const [countRow, [detailRows]] = await Promise.all([
    queryOne(
      `SELECT COUNT(*) AS total FROM purchy_grower_summary_v gs ${ctx.joins} ${detailWhere}`,
      detailParams,
    ),
    pool.query(
      `SELECT
        gs.grower_name_key AS growerNameKey,
        IFNULL(f.indent_qty, 0) AS indentQty,
        IFNULL(f.supply_qty, 0) AS supplyQty,
        IFNULL(f.dishonour_qty, 0) AS dishonourQty,
        CASE WHEN IFNULL(f.indent_qty, 0) > 0 THEN IFNULL(f.dishonour_qty, 0) / f.indent_qty ELSE 0 END AS dishonourPct
      FROM purchy_grower_summary_v gs
      ${ctx.joins}
      ${growerFactJoinSql()}
      ${detailWhere}
      ORDER BY dishonourPct DESC, dishonourQty DESC
      LIMIT ? OFFSET ?`,
      [...detailParams, pageSize, offset],
    ),
  ]);

  return { countRow, detailRows };
}

async function getDishonourDrilldown(query) {
  const ctx = buildFilterContext(query);
  const slicers = slicerQuery(query);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(query.pageSize, 10) || 25));
  const offset = (page - 1) * pageSize;

  const autoSelect = query.autoSelect === '1' || query.autoSelect === true;
  let selectedSociety = query.selectedSociety || null;
  let selectedVillage = query.selectedVillage || null;
  const selectedGrower = query.selectedGrower || null;

  const { tx, totalsRow, societies } = await getRoot(slicers, ctx);

  if (autoSelect && !selectedSociety && societies.length) {
    selectedSociety = societies[0].id;
  }

  const villages = selectedSociety ? await getVillages(slicers, ctx, selectedSociety) : [];

  if (autoSelect && selectedSociety && !selectedVillage && !selectedGrower && villages.length) {
    selectedVillage = villages[0].id;
  }

  const [growers, { countRow, detailRows }] = await Promise.all([
    selectedSociety && selectedVillage
      ? getGrowers(slicers, ctx, selectedSociety, selectedVillage)
      : [],
    getDetailPage(ctx, { selectedSociety, selectedVillage, selectedGrower }, pageSize, offset),
  ]);

  return {
    kpis: {
      growers: Number(totalsRow.growers) || 0,
      villages: Number(totalsRow.villages) || 0,
    },
    rootLabel: '2025 Dishonour % (Count)',
    rootPct: tx.dishonourPctCount,
    tree: {
      societies: societies.map((s) => ({
        ...s,
        villages: [],
        growers: [],
      })),
    },
    villages,
    growers,
    selectedSociety,
    selectedVillage,
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
