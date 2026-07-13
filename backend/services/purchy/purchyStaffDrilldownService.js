const { pool } = require('../../config/mysql');
const { buildFilterContext } = require('./purchyFilterBuilder');
const { whereAnd, slugId, pctRatio, LOYALTY_COLORS, VARIETY_COLORS } = require('./purchyDrilldownUtils');

const HIERARCHY_COLS = [
  { key: 'zone', col: 'zone_head', title: 'ZONE HEAD' },
  { key: 'manager', col: 'zonal_manager', title: 'ZONAL MANAGER' },
  { key: 'incharge', col: 'zonal_incharge', title: 'ZONAL INCHARGE' },
  { key: 'staff', col: 'village_staff', title: 'VILLAGE STAFF' },
  { key: 'village', col: 'village_name_key', title: 'VILLAGE_NAME_KEY' },
];

async function queryOne(sql, params) {
  const [[row]] = await pool.query(sql, params);
  return row || {};
}

function ensureStaffJoin(ctx) {
  if (ctx.needsStaff) return ctx;
  return {
    ...ctx,
    joins: `${ctx.joins ? `${ctx.joins}\n` : ''}LEFT JOIN purchy_field_staff fs ON fs.village_code = gs.village_code`,
    needsStaff: true,
  };
}

function nestHierarchyRows(rows) {
  const root = {
    id: 'root',
    name: '2025 Dishonour % (Count)',
    indentCnt: 0,
    dishonourCnt: 0,
    growerCount: 0,
    children: [],
  };

  const levelKeys = HIERARCHY_COLS.map((h) => h.col);

  rows.forEach((row) => {
    let parentChildren = root.children;
    let parentNode = root;

    levelKeys.forEach((col) => {
      const label = row[col] || 'Unassigned';
      const id = slugId(`${col}-${label}`);
      let node = parentChildren.find((n) => n.id === id);
      if (!node) {
        node = {
          id,
          name: label,
          indentCnt: 0,
          dishonourCnt: 0,
          growerCount: 0,
          children: [],
        };
        parentChildren.push(node);
      }
      node.indentCnt += Number(row.indent_cnt) || 0;
      node.dishonourCnt += Number(row.dishonour_cnt) || 0;
      node.growerCount += Number(row.grower_count) || 0;
      parentNode = node;
      parentChildren = node.children;
    });
  });

  function finalize(node) {
    node.value = Number((pctRatio(node.dishonourCnt, node.indentCnt) * 100).toFixed(2));
    node.children.sort((a, b) => b.value - a.value);
    node.children.forEach(finalize);
  }

  root.indentCnt = rows.reduce((s, r) => s + (Number(r.indent_cnt) || 0), 0);
  root.dishonourCnt = rows.reduce((s, r) => s + (Number(r.dishonour_cnt) || 0), 0);
  root.growerCount = rows.reduce((s, r) => s + (Number(r.grower_count) || 0), 0);
  root.children.forEach(finalize);

  return root;
}

async function getStaffDrilldown(query) {
  const ctx = ensureStaffJoin(buildFilterContext(query));

  const flatSql = `
    SELECT
      COALESCE(NULLIF(TRIM(fs.zone_head), ''), 'Unassigned') AS zone_head,
      COALESCE(NULLIF(TRIM(fs.zonal_manager), ''), 'Unassigned') AS zonal_manager,
      COALESCE(NULLIF(TRIM(fs.zonal_incharge), ''), 'Unassigned') AS zonal_incharge,
      COALESCE(NULLIF(TRIM(fs.village_staff), ''), 'Unassigned') AS village_staff,
      gs.village_name_key,
      COUNT(*) AS grower_count,
      IFNULL(SUM(gs.no_of_purchy_indent), 0) AS indent_cnt,
      IFNULL(SUM(gs.no_of_indent_failer_purchy), 0) AS dishonour_cnt
    FROM purchy_grower_summary_v gs
    ${ctx.joins}
    ${ctx.whereSql}
    GROUP BY zone_head, zonal_manager, zonal_incharge, village_staff, gs.village_name_key
  `;

  const [flatRows] = await pool.query(flatSql, ctx.params);
  const nestedTree = nestHierarchyRows(flatRows);

  const [loyaltyRows] = await pool.query(
    `SELECT gs.loyalty_slicer AS label, COUNT(*) AS count
     FROM purchy_grower_summary_v gs
     ${ctx.joins}
     ${ctx.whereSql}
     GROUP BY gs.loyalty_slicer
     ORDER BY count DESC`,
    ctx.params,
  );

  const loyaltyTotal = loyaltyRows.reduce((s, r) => s + Number(r.count), 0) || 1;
  const loyaltyDonut = loyaltyRows.map((r) => {
    const meta = LOYALTY_COLORS[r.label] || { color: '#64748b', tailwind: 'bg-slate-500' };
    return {
      label: r.label,
      count: Number(r.count) || 0,
      pct: Number(r.count) / loyaltyTotal,
      color: meta.color,
      tailwind: meta.tailwind,
    };
  });

  const [varietyRows] = await pool.query(
    `SELECT
      COALESCE(NULLIF(TRIM(s.varietyname), ''), 'Unknown') AS name,
      COUNT(*) AS cnt
    FROM purchy_supply s
    INNER JOIN purchy_grower_summary_v gs
      ON s.villagecode = gs.village_code AND s.growercode = gs.grower_code
    ${ctx.joins}
    ${ctx.whereSql}
    GROUP BY name
    ORDER BY cnt DESC
    LIMIT 5`,
    ctx.params,
  );

  const varietyTotal = varietyRows.reduce((s, r) => s + Number(r.cnt), 0) || 1;
  const varietyTreemap = varietyRows.map((r, idx) => ({
    name: r.name,
    share: Math.round((Number(r.cnt) / varietyTotal) * 100),
    color: VARIETY_COLORS[idx % VARIETY_COLORS.length],
    count: `${(Number(r.cnt) / 1000).toFixed(1)}K`,
  }));

  const [villageOpts] = await pool.query(
    `SELECT DISTINCT gs.village_name_key AS value
     FROM purchy_grower_summary_v gs ${ctx.joins} ${ctx.whereSql}
     ORDER BY value LIMIT 500`,
    ctx.params,
  );

  const [societyOpts] = await pool.query(
    `SELECT DISTINCT gs.society_name AS value
     FROM purchy_grower_summary_v gs ${ctx.joins} ${ctx.whereSql}
     ORDER BY value`,
    ctx.params,
  );

  const rootValue = nestedTree.value;
  const rootPct = pctRatio(nestedTree.dishonourCnt, nestedTree.indentCnt);

  return {
    rootPct,
    rootValue,
    rootLabel: '2025 Dishonour % (Count)',
    growerCount: nestedTree.growerCount,
    nestedTree,
    loyaltyDonut,
    varietyTreemap,
    filters: {
      villageName: villageOpts.map((r) => r.value).filter(Boolean),
      societyName: societyOpts.map((r) => r.value).filter(Boolean),
      loyaltySlicer: loyaltyRows.map((r) => r.label),
    },
    hasStaffData: flatRows.some((r) => (
      r.zone_head !== 'Unassigned'
      || r.zonal_manager !== 'Unassigned'
      || r.zonal_incharge !== 'Unassigned'
      || r.village_staff !== 'Unassigned'
    )),
  };
}

module.exports = {
  getStaffDrilldown,
  HIERARCHY_COLS,
};
