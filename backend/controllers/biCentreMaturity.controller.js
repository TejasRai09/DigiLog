const { pool } = require('../config/mysql');

/** Normalize MySQL DATE / ISO string to YYYY-MM-DD. */
function toIsoDate(v) {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function dateFilters(from, to) {
  const indentWhere = [];
  const purchaseWhere = [];
  const indentParams = [];
  const purchaseParams = [];

  if (from) {
    indentWhere.push('indent_date >= ?');
    purchaseWhere.push('purchase_date >= ?');
    indentParams.push(from);
    purchaseParams.push(from);
  }
  if (to) {
    indentWhere.push('indent_date <= ?');
    purchaseWhere.push('purchase_date <= ?');
    indentParams.push(to);
    purchaseParams.push(to);
  }

  return { indentWhere, purchaseWhere, indentParams, purchaseParams };
}

async function sumWindow(from, to) {
  const { indentWhere, purchaseWhere, indentParams, purchaseParams } = dateFilters(from, to);
  const indentWhereSql = indentWhere.length ? `WHERE ${indentWhere.join(' AND ')}` : '';
  const purchaseWhereSql = purchaseWhere.length ? `WHERE ${purchaseWhere.join(' AND ')}` : '';

  const [indentRows] = await pool.query(
    `SELECT center_name, SUM(indent_qty) AS indent_qty
     FROM centre_indent_data
     ${indentWhereSql}
     GROUP BY center_name`,
    indentParams,
  );
  const [purchaseRows] = await pool.query(
    `SELECT center_name, SUM(purchase_qty) AS purchase_qty
     FROM centre_purchase_data
     ${purchaseWhereSql}
     GROUP BY center_name`,
    purchaseParams,
  );
  const [[indentTotalRow]] = await pool.query(
    `SELECT SUM(indent_qty) AS total FROM centre_indent_data ${indentWhereSql}`,
    indentParams,
  );
  const [[purchaseTotalRow]] = await pool.query(
    `SELECT SUM(purchase_qty) AS total FROM centre_purchase_data ${purchaseWhereSql}`,
    purchaseParams,
  );

  return {
    indentRows,
    purchaseRows,
    indentTotal: parseFloat(indentTotalRow?.total) || 0,
    purchaseTotal: parseFloat(purchaseTotalRow?.total) || 0,
  };
}

/**
 * GET /api/bi/centre-maturity/data
 * Same indent/purchase tables as Management Dashboard.
 * Current window: from/to. Compare window: pyFrom/pyTo (milling-style toggle).
 */
const getCentreMaturityBiData = async (req, res) => {
  try {
    const { from, to, pyFrom, pyTo, compareLabel, meta } = req.query;

    const [seasonsRes] = await pool.query(
      `SELECT season_label, start_date, end_date FROM season_mapping ORDER BY start_date DESC`,
    );
    const mappingDict = {};
    seasonsRes.forEach((m) => {
      mappingDict[m.season_label] = {
        startDate: toIsoDate(m.start_date),
        endDate: toIsoDate(m.end_date),
      };
    });
    const [[dateRange]] = await pool.query(
      `SELECT MIN(indent_date) AS minDate, MAX(indent_date) AS maxDate FROM centre_indent_data`,
    );
    const metaPayload = {
      availableSeasons: seasonsRes.map((s) => s.season_label),
      seasonMapping: mappingDict,
      dateRange: {
        minDate: dateRange?.minDate || null,
        maxDate: dateRange?.maxDate || null,
      },
    };

    // First-load bounds only — do not aggregate all-time rows as if they were MTD.
    if (meta === '1' || (!from && !to)) {
      return res.json({
        centers: [],
        seasonKpi: {
          hasCompare: false,
          indentQty: { value: '0', change: null, variance: null, isUp: true },
          purchaseQty: { value: '0', change: null, variance: null, isUp: true },
          maturity: { value: 0, variance: null, change: null, isUp: true },
        },
        ...metaPayload,
      });
    }

    const current = await sumWindow(from, to);

    const purchaseMap = new Map();
    current.purchaseRows.forEach((r) => {
      purchaseMap.set(r.center_name, parseFloat(r.purchase_qty) || 0);
    });

    const combinedCenters = current.indentRows.map((r) => {
      const indentQty = parseFloat(r.indent_qty) || 0;
      const purchaseQty = purchaseMap.get(r.center_name) || 0;
      const maturity = indentQty > 0 ? purchaseQty / indentQty : 0;
      return {
        center: r.center_name,
        indent: Math.round(indentQty),
        purchase: Math.round(purchaseQty),
        maturity: parseFloat(maturity.toFixed(4)),
      };
    });
    combinedCenters.sort((a, b) => b.maturity - a.maturity || a.center.localeCompare(b.center));

    const currIndentVal = current.indentTotal;
    const currPurchaseVal = current.purchaseTotal;

    let prevIndentVal = 0;
    let prevPurchaseVal = 0;
    if (pyFrom && pyTo) {
      const prior = await sumWindow(pyFrom, pyTo);
      prevIndentVal = prior.indentTotal;
      prevPurchaseVal = prior.purchaseTotal;
    }

    const hasCompare = Boolean(pyFrom && pyTo) && (prevIndentVal > 0 || prevPurchaseVal > 0);
    const indentVariance = hasCompare ? currIndentVal - prevIndentVal : 0;
    const purchaseVariance = hasCompare ? currPurchaseVal - prevPurchaseVal : 0;
    const indentChangePct = prevIndentVal > 0 ? (indentVariance / prevIndentVal) * 100 : 0;
    const purchaseChangePct = prevPurchaseVal > 0 ? (purchaseVariance / prevPurchaseVal) * 100 : 0;

    const baseMaturity = currIndentVal > 0 ? (currPurchaseVal / currIndentVal) * 100 : 0;
    const compMaturity = prevIndentVal > 0 ? (prevPurchaseVal / prevIndentVal) * 100 : 0;
    const maturityVariance = hasCompare ? baseMaturity - compMaturity : 0;
    const maturityChangePct = compMaturity > 0 ? (maturityVariance / compMaturity) * 100 : 0;

    const displayCompare = compareLabel || (pyFrom && pyTo ? `${pyFrom} – ${pyTo}` : '');

    return res.json({
      centers: combinedCenters,
      seasonKpi: {
        hasCompare,
        compFrom: pyFrom || null,
        compTo: pyTo || null,
        compareLabel: displayCompare || null,
        indentQty: {
          value: Math.round(currIndentVal).toLocaleString('en-IN'),
          variance: hasCompare ? parseFloat(indentVariance.toFixed(2)) : null,
          change: hasCompare && prevIndentVal > 0 ? parseFloat(indentChangePct.toFixed(2)) : null,
          isUp: indentChangePct >= 0,
        },
        purchaseQty: {
          value: Math.round(currPurchaseVal).toLocaleString('en-IN'),
          variance: hasCompare ? parseFloat(purchaseVariance.toFixed(2)) : null,
          change: hasCompare && prevPurchaseVal > 0 ? parseFloat(purchaseChangePct.toFixed(2)) : null,
          isUp: purchaseChangePct >= 0,
        },
        maturity: {
          value: parseFloat(baseMaturity.toFixed(2)),
          variance: hasCompare ? parseFloat(maturityVariance.toFixed(2)) : null,
          change: hasCompare && compMaturity > 0 ? parseFloat(maturityChangePct.toFixed(2)) : null,
          isUp: maturityChangePct >= 0,
        },
      },
      ...metaPayload,
    });
  } catch (error) {
    console.error('Error fetching Centre Maturity BI data:', error);
    return res.status(500).json({ error: 'Failed to fetch Centre Maturity data' });
  }
};

module.exports = {
  getCentreMaturityBiData,
};
