const { pool } = require('../../config/mysql');
const { buildFilterContext } = require('./purchyFilterBuilder');
const { slugId, pctRatio, LOYALTY_COLORS, VARIETY_HEX } = require('./purchyDrilldownUtils');
const { query2025FactsGrouped } = require('./purchyPbiFacts');

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
    const code = Number(r.village_code);
    if (!Number.isFinite(code) || map.has(code)) continue;
    map.set(code, r);
  }
  return map;
}

async function getStaffDrilldown(query) {
  const ctx = buildFilterContext(query);
  const factCtx = ctx.needsStaff ? ensureStaffJoin(ctx) : ctx;

  /**
   * Tree uses PBI measures from _Measures.tmdl:
   *   2025_Indent Count     = COUNTROWS(Indent RELATED to Grower_Summary_Sheet)
   *   2025_Dishonour Count  = COUNTROWS(Dishonour RELATED to Indent AND Summary)
   *   2025_Dishonour % (Count) = DIVIDE(dishonour, indent)
   * Visual-level filter on the PBI tree: Zone Head is not blank.
   */
  const [villageFacts, staffByVillage] = await Promise.all([
    query2025FactsGrouped(factCtx, 'gs.village_code'),
    loadStaffByVillage(),
  ]);

  const flatRows = villageFacts.map((r) => {
    const villageCode = Number(r.grp);
    const staff = Number.isFinite(villageCode) ? staffByVillage.get(villageCode) : undefined;
    const villageNameKey = staff
      ? `${staff.village_code}-${staff.village_name || ''}`.replace(/-$/, '')
      : null;
    return {
      zone_head: staffLabel(staff?.zone_head),
      zonal_manager: staffLabel(staff?.zonal_manager),
      zonal_incharge: staffLabel(staff?.zonal_incharge),
      village_staff: staffLabel(staff?.village_staff),
      village_name_key: villageNameKey || 'Unassigned',
      grower_count: 0,
      indent_cnt: r.indentCount,
      dishonour_cnt: r.dishonourCount,
    };
  }).filter((r) => r.zone_head !== 'Unassigned');

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
      /**
       * PBI treemap: CountNonNull(Grower_Purchywise_Supply[SocietyPurchyNo]) by varietyname.
       * Relationship is Indent (text purchy no) → Supply (text). Summary is applied only
       * when slicers are on, matching filter flow Summary → Indent → Supply.
       */
      chartCtx.whereSql || chartCtx.joins
        ? `SELECT
            COALESCE(NULLIF(TRIM(s.varietyname), ''), 'Unknown') AS name,
            COUNT(s.societypurchy_no) AS cnt
          FROM purchy_supply s
          INNER JOIN purchy_indent i ON s.societypurchy_no = i.societypurchy_no
          INNER JOIN purchy_grower_summary_v gs
            ON i.villagecode = gs.village_code AND i.growercode = gs.grower_code
          ${chartCtx.joins}
          ${chartCtx.whereSql}
          GROUP BY name
          ORDER BY cnt DESC`
        : `SELECT
            COALESCE(NULLIF(TRIM(s.varietyname), ''), 'Unknown') AS name,
            COUNT(s.societypurchy_no) AS cnt
          FROM purchy_supply s
          INNER JOIN purchy_indent i ON s.societypurchy_no = i.societypurchy_no
          GROUP BY name
          ORDER BY cnt DESC`,
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
  const varietyTreemap = varietyRows.map((r, idx) => {
    const cnt = Number(r.cnt) || 0;
    return {
      name: r.name,
      share: Number(((cnt / varietyTotal) * 100).toFixed(2)),
      color: VARIETY_HEX[idx % VARIETY_HEX.length],
      count: cnt >= 1000 ? `${(cnt / 1000).toFixed(1)}K` : String(cnt),
      cnt,
    };
  });

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
    hasStaffData: flatRows.length > 0,
  };
}

/**
 * PBI table above the variety treemap:
 * Varietytype + 2025_Indent / Supply / Dishonour Count / % / Qty.
 * Clicking a varietyname tile filters Supply → Indent (same as this extraSql).
 */
async function getVarietyTypeBreakdown(query) {
  const ctx = buildFilterContext(query);
  const factCtx = ctx.needsStaff ? ensureStaffJoin(ctx) : ctx;
  const varietyName = String(query.varietyName || '').trim();
  const hasVariety = varietyName && varietyName !== 'All';

  const groupedCtx = hasVariety
    ? { ...factCtx, params: [...(factCtx.params || []), varietyName] }
    : factCtx;
  const extraSql = hasVariety
    ? `EXISTS (
         SELECT 1 FROM purchy_supply sv
         WHERE sv.societypurchy_no = i.societypurchy_no
           AND TRIM(sv.varietyname) = ?
       )`
    : '';

  const rows = await query2025FactsGrouped(
    groupedCtx,
    `COALESCE(NULLIF(TRIM(i.varietytype), ''), 'Unknown')`,
    extraSql,
  );

  const mapped = rows
    .filter((r) => r.indentCount > 0 || r.supplyCount > 0 || r.dishonourCount > 0)
    .sort((a, b) => b.indentCount - a.indentCount)
    .map((r) => ({
      varietyType: r.grp,
      indentCount: r.indentCount,
      supplyCount: r.supplyCount,
      dishonourCount: r.dishonourCount,
      dishonourPctCount: r.dishonourPctCount,
      dishonourQty: r.dishonourQty,
    }));

  const totals = mapped.reduce(
    (acc, r) => {
      acc.indentCount += r.indentCount;
      acc.supplyCount += r.supplyCount;
      acc.dishonourCount += r.dishonourCount;
      acc.dishonourQty += r.dishonourQty;
      return acc;
    },
    { indentCount: 0, supplyCount: 0, dishonourCount: 0, dishonourQty: 0 },
  );
  totals.dishonourPctCount = totals.indentCount ? totals.dishonourCount / totals.indentCount : 0;

  return { varietyName: hasVariety ? varietyName : null, rows: mapped, totals };
}

module.exports = {
  getStaffDrilldown,
  getVarietyTypeBreakdown,
  HIERARCHY_COLS,
};
