const { pool } = require('../../config/mysql');
const { buildFilterContext } = require('./purchyFilterBuilder');
const { whereAnd, pctRatio } = require('./purchyDrilldownUtils');

const DISHONOUR_GROWER_FILTER = 'gs.no_of_indent_failer_purchy > 0';

async function queryOne(sql, params) {
  const [[row]] = await pool.query(sql, params);
  return row || {};
}

async function getFailureDateDrilldown(query) {
  const ctx = buildFilterContext(query);

  const rangeRow = await queryOne(
    `SELECT
      MIN(d.issue_date) AS min_date,
      MAX(d.issue_date) AS max_date
    FROM purchy_dishonour d
    INNER JOIN purchy_indent i
      ON CAST(d.society_purchy_no AS CHAR) COLLATE utf8mb4_0900_ai_ci = i.societypurchy_no
    INNER JOIN purchy_grower_summary_v gs
      ON i.villagecode = gs.village_code AND i.growercode = gs.grower_code
    ${ctx.joins}
    ${whereAnd(ctx, 'd.issue_date IS NOT NULL')}`,
    ctx.params,
  );

  const dateFrom = query.dateFrom || rangeRow.min_date;
  const dateTo = query.dateTo || rangeRow.max_date;

  const [failureRows] = await pool.query(
    `SELECT
      DATE(d.issue_date) AS date,
      COUNT(*) AS dishonour_cnt,
      IFNULL(SUM(d.mode_qty), 0) AS dishonour_qty
    FROM purchy_dishonour d
    INNER JOIN purchy_indent i
      ON CAST(d.society_purchy_no AS CHAR) COLLATE utf8mb4_0900_ai_ci = i.societypurchy_no
    INNER JOIN purchy_grower_summary_v gs
      ON i.villagecode = gs.village_code AND i.growercode = gs.grower_code
    ${ctx.joins}
    ${whereAnd(ctx, 'd.issue_date IS NOT NULL AND d.issue_date BETWEEN ? AND ?')}
    GROUP BY DATE(d.issue_date)
    ORDER BY date`,
    [...ctx.params, dateFrom, dateTo],
  );

  const [indentRows] = await pool.query(
    `SELECT
      DATE(i.issuedate) AS date,
      COUNT(*) AS indent_cnt,
      IFNULL(SUM(i.supllymodeqty), 0) AS indent_qty
    FROM purchy_indent i
    INNER JOIN purchy_grower_summary_v gs
      ON i.villagecode = gs.village_code AND i.growercode = gs.grower_code
    ${ctx.joins}
    ${whereAnd(ctx, 'i.issuedate IS NOT NULL AND i.issuedate BETWEEN ? AND ?')}
    GROUP BY DATE(i.issuedate)
    ORDER BY date`,
    [...ctx.params, dateFrom, dateTo],
  );

  const indentByDate = Object.fromEntries(
    indentRows.map((r) => [String(r.date).slice(0, 10), r]),
  );

  const failureByDate = failureRows.map((r) => {
    const key = String(r.date).slice(0, 10);
    const indent = indentByDate[key];
    const indentCnt = Number(indent?.indent_cnt) || 0;
    const dishonourCnt = Number(r.dishonour_cnt) || 0;
    return {
      date: key,
      pct: pctRatio(dishonourCnt, indentCnt),
      dishonourCnt,
      dishonourQty: Number(r.dishonour_qty) || 0,
      indentCnt,
    };
  });

  const aggregateSql = (groupCol, labelCol) => `
    SELECT
      ${labelCol} AS name,
      IFNULL(SUM(gs.no_of_purchy_indent), 0) AS total_purchy,
      IFNULL(SUM(gs.no_of_indent_failer_purchy), 0) AS dishonour_purchy,
      IFNULL(SUM(gs.indent_failer_qty), 0) AS dishonour_qty,
      IFNULL(SUM(gs.total_bond), 0) AS total_bond,
      IFNULL(SUM(gs.weight_qty_2025), 0) AS total_supply,
      IFNULL(SUM(gs.indent_qty), 0) AS indent_qty
    FROM purchy_grower_summary_v gs
    ${ctx.joins}
    ${whereAnd(ctx, DISHONOUR_GROWER_FILTER)}
    GROUP BY ${groupCol}
    HAVING total_purchy > 0
    ORDER BY dishonour_qty DESC
  `;

  const [supplyCenterRows] = await pool.query(
    aggregateSql('gs.supply_centre_name', 'gs.supply_centre_name'),
    ctx.params,
  );

  const [villageRows] = await pool.query(
    aggregateSql('gs.village_name_key', 'gs.village_name_key'),
    ctx.params,
  );

  const mapAggRow = (r) => {
    const totalPurchy = Number(r.total_purchy) || 0;
    const dishonourPurchy = Number(r.dishonour_purchy) || 0;
    const indentQty = Number(r.indent_qty) || 0;
    const dishonourQty = Number(r.dishonour_qty) || 0;
    return {
      name: r.name || '—',
      totalPurchy,
      dishonourPurchy,
      dishonourPct: pctRatio(dishonourPurchy, totalPurchy),
      dishonourQty,
      totalBond: Number(r.total_bond) || 0,
      totalSupply: r.total_supply === null ? null : Number(r.total_supply),
      indentQty,
    };
  };

  const supplyMapped = supplyCenterRows.map(mapAggRow);
  const villageMapped = villageRows.map(mapAggRow);

  const totals = supplyMapped.reduce((acc, r) => ({
    totalPurchy: acc.totalPurchy + r.totalPurchy,
    dishonourPurchy: acc.dishonourPurchy + r.dishonourPurchy,
    dishonourQty: acc.dishonourQty + r.dishonourQty,
    totalBond: acc.totalBond + r.totalBond,
    totalSupply: acc.totalSupply + (r.totalSupply || 0),
  }), {
    totalPurchy: 0, dishonourPurchy: 0, dishonourQty: 0, totalBond: 0, totalSupply: 0,
  });

  totals.dishonourPct = pctRatio(totals.dishonourPurchy, totals.totalPurchy);

  return {
    dateFrom: dateFrom ? String(dateFrom).slice(0, 10) : null,
    dateTo: dateTo ? String(dateTo).slice(0, 10) : null,
    failureByDate,
    supplyCenterRows: supplyMapped,
    villageRows: villageMapped,
    totals,
  };
}

module.exports = {
  getFailureDateDrilldown,
};
