/**
 * Maps slicer query params to SQL WHERE fragments for purchy_grower_summary_v (gs).
 */

const PURCHY_COLLATE = 'utf8mb4_0900_ai_ci';

function growerKeyExpr(alias, villageCol, growerCol) {
  return `CONCAT(${alias}.${villageCol}, '-', ${alias}.${growerCol}) COLLATE ${PURCHY_COLLATE}`;
}

function parseListParam(val) {
  if (val === undefined || val === null || val === '') return null;
  if (Array.isArray(val)) {
    const list = val.map((v) => String(v).trim()).filter(Boolean);
    return list.length ? list : null;
  }
  const list = String(val).split(',').map((s) => s.trim()).filter((s) => s && s !== 'All');
  return list.length ? list : null;
}

function addInFilter(parts, params, column, values) {
  if (!values || !values.length) return;
  parts.push(`${column} IN (${values.map(() => '?').join(',')})`);
  params.push(...values);
}

function buildFilterContext(query = {}) {
  const params = [];
  const joins = [];
  const whereParts = [];

  const societyName = parseListParam(query.societyName);
  const loyaltySlicer = parseListParam(query.loyaltySlicer);
  const dishonourBucket = parseListParam(query.dishonourBucket);
  const zoneHead = parseListParam(query.zoneHead);
  const zonalManager = parseListParam(query.zonalManager);
  const zonalIncharge = parseListParam(query.zonalIncharge);
  const villageStaff = parseListParam(query.villageStaff);
  const villageName = parseListParam(query.villageName);

  const needsStaff = !!(zoneHead || zonalManager || zonalIncharge || villageStaff);
  if (needsStaff) {
    joins.push('LEFT JOIN purchy_field_staff fs ON fs.village_code = gs.village_code');
  }

  addInFilter(whereParts, params, 'gs.society_name', societyName);
  addInFilter(whereParts, params, 'gs.loyalty_slicer', loyaltySlicer);
  addInFilter(whereParts, params, 'gs.dishonour_bucket', dishonourBucket);
  addInFilter(whereParts, params, 'gs.village_name_key', villageName);

  if (needsStaff) {
    addInFilter(whereParts, params, 'fs.zone_head', zoneHead);
    addInFilter(whereParts, params, 'fs.zonal_manager', zonalManager);
    addInFilter(whereParts, params, 'fs.zonal_incharge', zonalIncharge);
    addInFilter(whereParts, params, 'fs.village_staff', villageStaff);
  }

  return {
    joins: joins.join('\n'),
    whereSql: whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '',
    params,
    needsStaff,
  };
}

function filteredGrowersSubquery(ctx) {
  return `
    SELECT DISTINCT ${growerKeyExpr('gs', 'village_code', 'grower_code')}
    FROM purchy_grower_summary_v gs
    ${ctx.joins}
    ${ctx.whereSql}
  `;
}

function filteredGrowersCte(ctx) {
  return `
    SELECT DISTINCT gs.village_code, gs.grower_code
    FROM purchy_grower_summary_v gs
    ${ctx.joins}
    ${ctx.whereSql}
  `;
}

module.exports = {
  parseListParam,
  buildFilterContext,
  filteredGrowersSubquery,
  filteredGrowersCte,
  growerKeyExpr,
  PURCHY_COLLATE,
};
