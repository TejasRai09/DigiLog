const { pool } = require('../../config/mysql');
const { buildFilterContext } = require('./purchyFilterBuilder');
const { pctRatio } = require('./purchyDrilldownUtils');
const {
  gsFromIndent,
  extraWhere,
  INDENT_PURCHY,
  SUPPLY_PURCHY,
  DISHONOUR_PURCHY,
} = require('./purchyPbiFacts');

/** Power BI Date-wise Dishonour slicer (visual 9fda8088ac348ce976a2). */
const PBI_DEFAULT_DATE_FROM = '2025-10-24';
const PBI_DEFAULT_DATE_TO = '2026-03-06';

async function queryOne(sql, params) {
  const [[row]] = await pool.query(sql, params);
  return row || {};
}

function isoDate(v) {
  return v ? String(v).slice(0, 10) : null;
}

function eachDateInclusive(from, to) {
  if (!from || !to) return [];
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  const out = [];
  for (let t = start; t <= end; t += 86400000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function indentDateWhere() {
  return 'i.supplydate IS NOT NULL AND DATE(i.supplydate) BETWEEN ? AND ?';
}

function failDateWhere() {
  return 'd.purchase_date IS NOT NULL AND DATE(d.purchase_date) BETWEEN ? AND ?';
}

async function getFailureDateDrilldown(query) {
  const ctx = buildFilterContext(query);
  const dateFrom = query.dateFrom || PBI_DEFAULT_DATE_FROM;
  const dateTo = query.dateTo || PBI_DEFAULT_DATE_TO;
  const dateParams = [...ctx.params, dateFrom, dateTo];

  const [indentRows, failRows] = await Promise.all([
    pool.query(
      `SELECT
        DATE(i.supplydate) AS date,
        COUNT(*) AS indent_cnt
      FROM purchy_indent i
      ${gsFromIndent()}
      ${ctx.joins}
      ${extraWhere(ctx, indentDateWhere())}
      GROUP BY DATE(i.supplydate)
      ORDER BY date`,
      dateParams,
    ),
    pool.query(
      `SELECT
        DATE(d.purchase_date) AS date,
        COUNT(*) AS dishonour_cnt,
        IFNULL(SUM(d.mode_qty), 0) AS dishonour_qty
      FROM purchy_dishonour d
      INNER JOIN purchy_indent i ON ${DISHONOUR_PURCHY} = ${INDENT_PURCHY}
      ${gsFromIndent()}
      ${ctx.joins}
      ${extraWhere(ctx, failDateWhere())}
      GROUP BY DATE(d.purchase_date)
      ORDER BY date`,
      dateParams,
    ),
  ]);

  const indentByDate = Object.fromEntries(
    indentRows[0].map((r) => [isoDate(r.date), r]),
  );
  const failByDate = Object.fromEntries(
    failRows[0].map((r) => [isoDate(r.date), r]),
  );

  const failureByDate = eachDateInclusive(dateFrom, dateTo).map((key) => {
    const indentCnt = Number(indentByDate[key]?.indent_cnt) || 0;
    const dishonourCnt = Number(failByDate[key]?.dishonour_cnt) || 0;
    return {
      date: key,
      pct: pctRatio(dishonourCnt, indentCnt),
      dishonourCnt,
      dishonourQty: Number(failByDate[key]?.dishonour_qty) || 0,
      indentCnt,
    };
  });

  const indentByCenterSql = `
    SELECT i.supplycentrename AS name, COUNT(*) AS total_purchy
    FROM purchy_indent i
    ${gsFromIndent()}
    ${ctx.joins}
    ${extraWhere(ctx, indentDateWhere())}
    GROUP BY i.supplycentrename`;

  const indentByVillageSql = `
    SELECT i.villagename AS name, COUNT(*) AS total_purchy
    FROM purchy_indent i
    ${gsFromIndent()}
    ${ctx.joins}
    ${extraWhere(ctx, indentDateWhere())}
    GROUP BY i.villagename`;

  const failByCenterSql = `
    SELECT i.supplycentrename AS name,
      COUNT(*) AS dishonour_purchy,
      IFNULL(SUM(d.mode_qty), 0) AS dishonour_qty
    FROM purchy_dishonour d
    INNER JOIN purchy_indent i ON ${DISHONOUR_PURCHY} = ${INDENT_PURCHY}
    ${gsFromIndent()}
    ${ctx.joins}
    ${extraWhere(ctx, failDateWhere())}
    GROUP BY i.supplycentrename`;

  const failByVillageSql = `
    SELECT i.villagename AS name,
      COUNT(*) AS dishonour_purchy,
      IFNULL(SUM(d.mode_qty), 0) AS dishonour_qty
    FROM purchy_dishonour d
    INNER JOIN purchy_indent i ON ${DISHONOUR_PURCHY} = ${INDENT_PURCHY}
    ${gsFromIndent()}
    ${ctx.joins}
    ${extraWhere(ctx, failDateWhere())}
    GROUP BY i.villagename`;

  const bondGrowersCte = `
    SELECT DISTINCT i.villagecode, i.growercode, i.supplycentrename, i.villagename
    FROM purchy_indent i
    ${gsFromIndent()}
    ${ctx.joins}
    ${extraWhere(ctx, indentDateWhere())}`;

  const bondByCenterSql = `
    SELECT ix.supplycentrename AS name, IFNULL(SUM(gs.total_bond), 0) AS total_bond
    FROM (${bondGrowersCte}) ix
    INNER JOIN purchy_grower_summary_v gs
      ON ix.villagecode = gs.village_code AND ix.growercode = gs.grower_code
    GROUP BY ix.supplycentrename`;

  const bondByVillageSql = `
    SELECT ix.villagename AS name, IFNULL(SUM(gs.total_bond), 0) AS total_bond
    FROM (${bondGrowersCte}) ix
    INNER JOIN purchy_grower_summary_v gs
      ON ix.villagecode = gs.village_code AND ix.growercode = gs.grower_code
    GROUP BY ix.villagename`;

  const supplyByCenterSql = `
    SELECT i.supplycentrename AS name, IFNULL(SUM(s.netwt), 0) AS total_supply
    FROM purchy_supply s
    INNER JOIN purchy_indent i ON ${SUPPLY_PURCHY} = ${INDENT_PURCHY}
    ${gsFromIndent()}
    ${ctx.joins}
    ${extraWhere(ctx, indentDateWhere())}
    GROUP BY i.supplycentrename`;

  const supplyByVillageSql = `
    SELECT i.villagename AS name, IFNULL(SUM(s.netwt), 0) AS total_supply
    FROM purchy_supply s
    INNER JOIN purchy_indent i ON ${SUPPLY_PURCHY} = ${INDENT_PURCHY}
    ${gsFromIndent()}
    ${ctx.joins}
    ${extraWhere(ctx, indentDateWhere())}
    GROUP BY i.villagename`;

  const [
    centerBondRows,
    villageBondRows,
    centerIndentRows,
    villageIndentRows,
    centerFailRows,
    villageFailRows,
    centerSupplyRows,
    villageSupplyRows,
    overallBond,
    overallSupply,
  ] = await Promise.all([
    pool.query(bondByCenterSql, dateParams).then(([rows]) => rows),
    pool.query(bondByVillageSql, dateParams).then(([rows]) => rows),
    pool.query(indentByCenterSql, dateParams).then(([rows]) => rows),
    pool.query(indentByVillageSql, dateParams).then(([rows]) => rows),
    pool.query(failByCenterSql, dateParams).then(([rows]) => rows),
    pool.query(failByVillageSql, dateParams).then(([rows]) => rows),
    pool.query(supplyByCenterSql, dateParams).then(([rows]) => rows),
    pool.query(supplyByVillageSql, dateParams).then(([rows]) => rows),
    queryOne(
      `SELECT IFNULL(SUM(gs.total_bond), 0) AS total_bond
       FROM purchy_grower_summary_v gs
       ${ctx.joins}
       ${extraWhere(ctx, `EXISTS (
         SELECT 1 FROM purchy_indent i
         WHERE i.villagecode = gs.village_code AND i.growercode = gs.grower_code
           AND i.supplydate IS NOT NULL AND DATE(i.supplydate) BETWEEN ? AND ?
       )`)}`,
      dateParams,
    ),
    queryOne(
      `SELECT IFNULL(SUM(s.netwt), 0) AS total_supply
       FROM purchy_supply s
       INNER JOIN purchy_indent i ON ${SUPPLY_PURCHY} = ${INDENT_PURCHY}
       ${gsFromIndent()}
       ${ctx.joins}
       ${extraWhere(ctx, indentDateWhere())}`,
      dateParams,
    ),
  ]);

  const mergeAgg = (bondRows, indentRows, failRows, supplyRows) => {
    const map = new Map();
    const ensure = (name) => {
      const key = name || '—';
      if (!map.has(key)) {
        map.set(key, {
          name: key,
          totalPurchy: 0,
          dishonourPurchy: 0,
          dishonourQty: 0,
          totalBond: 0,
          totalSupply: 0,
        });
      }
      return map.get(key);
    };
    for (const r of bondRows) ensure(r.name).totalBond = Number(r.total_bond) || 0;
    for (const r of indentRows) ensure(r.name).totalPurchy = Number(r.total_purchy) || 0;
    for (const r of failRows) {
      const row = ensure(r.name);
      row.dishonourPurchy = Number(r.dishonour_purchy) || 0;
      row.dishonourQty = Number(r.dishonour_qty) || 0;
    }
    for (const r of supplyRows) ensure(r.name).totalSupply = Number(r.total_supply) || 0;

    return [...map.values()]
      .map((r) => ({
        ...r,
        dishonourPct: pctRatio(r.dishonourPurchy, r.totalPurchy),
        indentQty: 0,
      }))
      .filter((r) => r.totalPurchy > 0 || r.dishonourPurchy > 0)
      .sort((a, b) => b.dishonourPct - a.dishonourPct);
  };

  const supplyMapped = mergeAgg(centerBondRows, centerIndentRows, centerFailRows, centerSupplyRows);
  const villageMapped = mergeAgg(villageBondRows, villageIndentRows, villageFailRows, villageSupplyRows);

  const totalPurchy = failureByDate.reduce((s, r) => s + r.indentCnt, 0);
  const dishonourPurchy = failureByDate.reduce((s, r) => s + r.dishonourCnt, 0);
  const dishonourQty = failureByDate.reduce((s, r) => s + r.dishonourQty, 0);

  const totals = {
    totalPurchy,
    dishonourPurchy,
    dishonourQty,
    totalBond: Number(overallBond.total_bond) || 0,
    totalSupply: Number(overallSupply.total_supply) || 0,
    dishonourPct: pctRatio(dishonourPurchy, totalPurchy),
  };

  return {
    dateFrom,
    dateTo,
    failureByDate,
    supplyCenterRows: supplyMapped,
    villageRows: villageMapped,
    totals,
  };
}

module.exports = {
  getFailureDateDrilldown,
  PBI_DEFAULT_DATE_FROM,
  PBI_DEFAULT_DATE_TO,
};
