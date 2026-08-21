const { pool } = require('../../config/mysql');
const { buildFilterContext } = require('./purchyFilterBuilder');
const { slugId, pctRatio, LOYALTY_COLORS, VARIETY_COLORS } = require('./purchyDrilldownUtils');
const {
  gsFromIndent,
} = require('./purchyPbiFacts');

const HIERARCHY_COLS = [
  { key: 'zone', col: 'zone_head', title: 'ZONE HEAD' },
  { key: 'manager', col: 'zonal_manager', title: 'ZONAL MANAGER' },
  { key: 'incharge', col: 'zonal_incharge', title: 'ZONAL INCHARGE' },
  { key: 'staff', col: 'village_staff', title: 'VILLAGE STAFF' },
  { key: 'village', col: 'village_name_key', title: 'VILLAGE_NAME_KEY' },
];

function staffLabel(value) {
  const s = value == null ? '' : String(value).trim();
  return s || 'Unassigned';
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
    const path = [];

    levelKeys.forEach((col) => {
      const label = row[col] || 'Unassigned';
      path.push(`${col}:${label}`);
      const id = slugId(path.join('|'));
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
      parentChildren = node.children;
    });
  });

  function finalize(node) {
    node.value = Number((pctRatio(node.dishonourCnt, node.indentCnt) * 100).toFixed(2));
    node.children.forEach(finalize);
    node.children.sort((a, b) => {
      const aUn = a.name === 'Unassigned' ? 1 : 0;
      const bUn = b.name === 'Unassigned' ? 1 : 0;
      if (aUn !== bUn) return aUn - bUn;
      return b.value - a.value;
    });
  }

  root.indentCnt = rows.reduce((s, r) => s + (Number(r.indent_cnt) || 0), 0);
  root.dishonourCnt = rows.reduce((s, r) => s + (Number(r.dishonour_cnt) || 0), 0);
  root.growerCount = rows.reduce((s, r) => s + (Number(r.grower_count) || 0), 0);
  finalize(root);

  return root;
}

async function loadStaffByVillage() {
  const [rows] = await pool.query(`
    SELECT village_code, zone_head, zonal_manager, zonal_incharge, village_staff, village_name
    FROM purchy_field_staff
  `);
  const map = new Map();
  for (const r of rows) {
    if (r.village_code == null || map.has(r.village_code)) continue;
    map.set(r.village_code, r);
  }
  return map;
}

async function getStaffDrilldown(query) {
  const ctx = buildFilterContext(query);
  const factCtx = ctx.needsStaff ? ensureStaffJoin(ctx) : ctx;

  const unfiltered = !factCtx.whereSql && !factCtx.joins;

  const indentSql = unfiltered
    ? `SELECT gs.village_code AS village_code,
        SUM(gs.no_of_purchy_indent) AS indent_cnt,
        COUNT(DISTINCT gs.grower_code) AS grower_count
       FROM purchy_grower_summary gs
       GROUP BY gs.village_code`
    : `SELECT
        gs.village_code,
        MAX(gs.village_name_key) AS village_name_key,
        SUM(gs.no_of_purchy_indent) AS indent_cnt,
        COUNT(DISTINCT gs.grower_code) AS grower_count
      FROM purchy_grower_summary_v gs
      ${factCtx.joins}
      ${factCtx.whereSql}
      GROUP BY gs.village_code`;

  const dishonourSql = unfiltered
    ? `SELECT gs.village_code AS village_code, SUM(gs.no_of_indent_failer_purchy) AS dishonour_cnt
       FROM purchy_grower_summary gs
       GROUP BY gs.village_code`
    : `SELECT
        gs.village_code,
        SUM(gs.no_of_indent_failer_purchy) AS dishonour_cnt
      FROM purchy_grower_summary_v gs
      ${factCtx.joins}
      ${factCtx.whereSql}
      GROUP BY gs.village_code`;

  const [indentRows, dishonourRows, staffByVillage] = await Promise.all([
    pool.query(indentSql, factCtx.params).then(([rows]) => rows),
    pool.query(dishonourSql, factCtx.params).then(([rows]) => rows),
    loadStaffByVillage(),
  ]);

  const dhByVillage = new Map();
  for (const r of dishonourRows) {
    dhByVillage.set(Number(r.village_code), Number(r.dishonour_cnt) || 0);
  }

  const flatRows = indentRows.map((r) => {
    const villageCode = Number(r.village_code);
    const staff = staffByVillage.get(villageCode);
    const villageNameKey = staff
      ? `${staff.village_code}-${staff.village_name || ''}`.replace(/-$/, '') || r.village_name_key
      : r.village_name_key;
    return {
      zone_head: staffLabel(staff?.zone_head),
      zonal_manager: staffLabel(staff?.zonal_manager),
      zonal_incharge: staffLabel(staff?.zonal_incharge),
      village_staff: staffLabel(staff?.village_staff),
      village_name_key: villageNameKey || 'Unassigned',
      grower_count: Number(r.grower_count) || 0,
      indent_cnt: Number(r.indent_cnt) || 0,
      dishonour_cnt: dhByVillage.get(villageCode) || 0,
    };
  });

  const nestedTree = nestHierarchyRows(flatRows);

  const chartCtx = factCtx;

  const [loyaltyRows, varietyRows, villageOpts, societyOpts] = await Promise.all([
    pool.query(
      `SELECT gs.loyalty_slicer AS label, COUNT(*) AS count
       FROM purchy_grower_summary_v gs
       ${chartCtx.joins}
       ${chartCtx.whereSql}
       GROUP BY gs.loyalty_slicer
       ORDER BY count DESC`,
      chartCtx.params,
    ).then(([rows]) => rows),
    pool.query(
      unfiltered
        ? `SELECT COALESCE(NULLIF(TRIM(varietyname), ''), 'Unknown') AS name, COUNT(*) AS cnt
           FROM purchy_supply
           GROUP BY name
           ORDER BY cnt DESC
           LIMIT 5`
        : `SELECT
            COALESCE(NULLIF(TRIM(s.varietyname), ''), 'Unknown') AS name,
            COUNT(*) AS cnt
          FROM purchy_supply s
          INNER JOIN purchy_grower_summary_v gs
            ON s.villagecode = gs.village_code AND s.growercode = gs.grower_code
          ${chartCtx.joins}
          ${chartCtx.whereSql}
          GROUP BY name
          ORDER BY cnt DESC
          LIMIT 5`,
      chartCtx.params,
    ).then(([rows]) => rows),
    pool.query(
      `SELECT DISTINCT gs.village_name_key AS value
       FROM purchy_grower_summary_v gs ${chartCtx.joins} ${chartCtx.whereSql}
       ORDER BY value LIMIT 500`,
      chartCtx.params,
    ).then(([rows]) => rows),
    pool.query(
      `SELECT DISTINCT gs.society_name AS value
       FROM purchy_grower_summary_v gs ${chartCtx.joins} ${chartCtx.whereSql}
       ORDER BY value`,
      chartCtx.params,
    ).then(([rows]) => rows),
  ]);

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

  const varietyTotal = varietyRows.reduce((s, r) => s + Number(r.cnt), 0) || 1;
  const varietyTreemap = varietyRows.map((r, idx) => ({
    name: r.name,
    share: Math.round((Number(r.cnt) / varietyTotal) * 100),
    color: VARIETY_COLORS[idx % VARIETY_COLORS.length],
    count: `${(Number(r.cnt) / 1000).toFixed(1)}K`,
  }));

  return {
    rootPct: pctRatio(nestedTree.dishonourCnt, nestedTree.indentCnt),
    rootValue: nestedTree.value,
    rootLabel: '2025 Dishonour % (Count)',
    growerCount: loyaltyTotal,
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
