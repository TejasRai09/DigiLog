const { pool } = require('../config/mysql');

/**
 * Power BI parity:
 * Purchase Qty only counts rows whose Unique ID also exists in indent.
 * Orphan purchase rows (no matching indent Unique ID) are excluded from
 * Purchase Qty and Maturity % — matching Centre Maturity PBI measures.
 */
const LINKED_PURCHASE_EXISTS =
  `EXISTS (SELECT 1 FROM centre_indent_data i WHERE i.unique_id = p.unique_id)`;

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

/**
 * GET /api/bi/centre-maturity/data
 * Returns:
 * 1. centerMaturity: list of centers with indent_qty, purchase_qty, maturity_pct
 * 2. seasonKpi: base season indent, purchase, and YoY growth %
 * 3. seasons: list of available seasons
 * 4. minDate, maxDate: available date range
 */
const getCentreMaturityBiData = async (req, res) => {
  try {
    const { from, to, season, compSeason: queryCompSeason } = req.query;

    // Default filters or conditional WHERE clauses
    let indentWhere = [];
    let purchaseWhere = [];
    let paramsIndent = [];
    let paramsPurchase = [];

    // Align center table with KPI season when provided
    if (season) {
      indentWhere.push('season_label = ?');
      purchaseWhere.push('p.season_label = ?');
      paramsIndent.push(season);
      paramsPurchase.push(season);
    }

    if (from) {
      indentWhere.push('indent_date >= ?');
      purchaseWhere.push('p.purchase_date >= ?');
      paramsIndent.push(from);
      paramsPurchase.push(from);
    }

    if (to) {
      indentWhere.push('indent_date <= ?');
      purchaseWhere.push('p.purchase_date <= ?');
      paramsIndent.push(to);
      paramsPurchase.push(to);
    }

    const indentWhereSql = indentWhere.length ? 'WHERE ' + indentWhere.join(' AND ') : '';
    const purchaseWhereSql = purchaseWhere.length
      ? `WHERE ${purchaseWhere.join(' AND ')} AND ${LINKED_PURCHASE_EXISTS}`
      : `WHERE ${LINKED_PURCHASE_EXISTS}`;

    // 1. Fetch aggregated Indent Qty by Center
    const [indentRows] = await pool.query(
      `SELECT center_name, SUM(indent_qty) AS indent_qty 
       FROM centre_indent_data 
       ${indentWhereSql} 
       GROUP BY center_name`,
      paramsIndent
    );

    // 2. Fetch aggregated Purchase Qty by Center (indent-linked Unique IDs only)
    const [purchaseRows] = await pool.query(
      `SELECT p.center_name, SUM(p.purchase_qty) AS purchase_qty 
       FROM centre_purchase_data p
       ${purchaseWhereSql} 
       GROUP BY p.center_name`,
      paramsPurchase
    );

    // Combine Indent & Purchase by center
    const purchaseMap = new Map();
    purchaseRows.forEach(r => {
      purchaseMap.set(r.center_name, parseFloat(r.purchase_qty) || 0);
    });

    const combinedCenters = indentRows.map(r => {
      const cName = r.center_name;
      const indentQty = parseFloat(r.indent_qty) || 0;
      const purchaseQty = purchaseMap.get(cName) || 0;
      const maturity = indentQty > 0 ? (purchaseQty / indentQty) : 0; // ratio 0..1+

      return {
        center: cName,
        indent: Math.round(indentQty),
        purchase: Math.round(purchaseQty),
        maturity: parseFloat(maturity.toFixed(4)),
      };
    });

    // Sort by Maturity DESC (Power BI Center Maturity layout)
    combinedCenters.sort((a, b) => b.maturity - a.maturity || a.center.localeCompare(b.center));

    // 3. KPI Season VS Season calculation
    const [seasonsRes] = await pool.query(
      `SELECT season_label, start_date, end_date FROM season_mapping ORDER BY start_date DESC`
    );
    const allSeasonLabels = seasonsRes.map(s => s.season_label);

    const [visRows] = await pool.query(
      'SELECT setting_key, setting_value FROM portal_settings WHERE setting_key IN (?, ?)',
      ['bi_dashboard_seasons', 'bi_visible_seasons']
    );
    const visMap = {};
    visRows.forEach(r => { visMap[r.setting_key] = r.setting_value; });

    let visibleSeasons = [];
    if (visMap['bi_dashboard_seasons']) {
      try {
        const parsed = JSON.parse(visMap['bi_dashboard_seasons']);
        visibleSeasons = parsed.centre_maturity || [];
      } catch (_) {}
    }
    if (visibleSeasons.length === 0 && visMap['bi_visible_seasons']) {
      try { visibleSeasons = JSON.parse(visMap['bi_visible_seasons']); } catch (_) {}
    }

    // Base dropdown: admin-visible seasons (fallback = all mapped seasons)
    let availableSeasons = allSeasonLabels;
    if (Array.isArray(visibleSeasons) && visibleSeasons.length > 0) {
      availableSeasons = allSeasonLabels.filter(s => visibleSeasons.includes(s));
      if (availableSeasons.length === 0) availableSeasons = allSeasonLabels;
    }

    const baseSeason = season || availableSeasons[0] || allSeasonLabels[0] || '2023-2024';

    // Seasons that actually have indent rows (needed for a meaningful YoY %)
    const [indentSeasonRows] = await pool.query(
      `SELECT DISTINCT season_label FROM centre_indent_data WHERE season_label IS NOT NULL AND season_label <> ''`
    );
    const seasonsWithIndent = new Set(indentSeasonRows.map(r => r.season_label));

    // Comp dropdown / auto-pick: older seasons than base that have indent data.
    // Do NOT limit to admin-visible list — otherwise YoY is always 0% when only
    // the current season is marked visible (current portal setting).
    const baseIdxAll = allSeasonLabels.indexOf(baseSeason);
    const priorCandidates = (baseIdxAll >= 0 ? allSeasonLabels.slice(baseIdxAll + 1) : allSeasonLabels.slice(1))
      .filter(s => seasonsWithIndent.has(s));

    let compSeason = queryCompSeason || null;
    if (compSeason && !allSeasonLabels.includes(compSeason)) {
      compSeason = null;
    }
    if (!compSeason) {
      compSeason = priorCandidates[0] || null;
    }

    // Current Season Totals
    let currIndentWhere = ['season_label = ?'];
    let currPurchaseWhere = ['p.season_label = ?', LINKED_PURCHASE_EXISTS];
    let currIndentParams = [baseSeason];
    let currPurchaseParams = [baseSeason];

    if (from) {
      currIndentWhere.push('indent_date >= ?');
      currPurchaseWhere.push('p.purchase_date >= ?');
      currIndentParams.push(from);
      currPurchaseParams.push(from);
    }
    if (to) {
      currIndentWhere.push('indent_date <= ?');
      currPurchaseWhere.push('p.purchase_date <= ?');
      currIndentParams.push(to);
      currPurchaseParams.push(to);
    }

    const [[currIndent]] = await pool.query(
      `SELECT SUM(indent_qty) AS total FROM centre_indent_data WHERE ${currIndentWhere.join(' AND ')}`,
      currIndentParams
    );
    const [[currPurchase]] = await pool.query(
      `SELECT SUM(p.purchase_qty) AS total FROM centre_purchase_data p WHERE ${currPurchaseWhere.join(' AND ')}`,
      currPurchaseParams
    );

    // Season mapping for UI quick filters + Season vs Season comparison range.
    // Power BI Season VS Season compares base (selected from/to) against the
    // comparison season's own date window (season_mapping start→end), NOT the
    // base from/to shifted back by years.
    const mappingDict = {};
    seasonsRes.forEach(m => {
      if (
        availableSeasons.includes(m.season_label) ||
        priorCandidates.includes(m.season_label) ||
        m.season_label === baseSeason ||
        m.season_label === compSeason
      ) {
        mappingDict[m.season_label] = {
          startDate: toIsoDate(m.start_date),
          endDate: toIsoDate(m.end_date),
        };
      }
    });

    // Previous Season Totals:
    // Power BI Season VS Season uses the comparison season's own window
    // (independent of base from/to). We take the full comparison season by
    // season_label so totals match PBI when the comparison slicer covers the
    // whole season. Mapped start/end are returned for UI context only.
    let prevIndentVal = 0;
    let prevPurchaseVal = 0;
    let compFrom = null;
    let compTo = null;
    if (compSeason) {
      const compMap = mappingDict[compSeason] || seasonsRes.find(s => s.season_label === compSeason);
      compFrom = toIsoDate(compMap?.startDate || compMap?.start_date);
      compTo = toIsoDate(compMap?.endDate || compMap?.end_date);

      const [[prevIndent]] = await pool.query(
        `SELECT SUM(indent_qty) AS total FROM centre_indent_data WHERE season_label = ?`,
        [compSeason]
      );
      const [[prevPurchase]] = await pool.query(
        `SELECT SUM(p.purchase_qty) AS total FROM centre_purchase_data p
         WHERE p.season_label = ? AND ${LINKED_PURCHASE_EXISTS}`,
        [compSeason]
      );
      prevIndentVal = parseFloat(prevIndent?.total) || 0;
      prevPurchaseVal = parseFloat(prevPurchase?.total) || 0;
    }

    const currIndentVal = parseFloat(currIndent?.total) || 0;
    const currPurchaseVal = parseFloat(currPurchase?.total) || 0;
    const hasCompare = Boolean(compSeason) && (prevIndentVal > 0 || prevPurchaseVal > 0);

    const indentVariance = hasCompare ? (currIndentVal - prevIndentVal) : 0;
    const purchaseVariance = hasCompare ? (currPurchaseVal - prevPurchaseVal) : 0;
    const indentChangePct = prevIndentVal > 0 ? (indentVariance / prevIndentVal) * 100 : 0;
    const purchaseChangePct = prevPurchaseVal > 0 ? (purchaseVariance / prevPurchaseVal) * 100 : 0;

    // Maturity KPI Calcs
    const baseMaturity = currIndentVal > 0 ? (currPurchaseVal / currIndentVal) * 100 : 0;
    const compMaturity = prevIndentVal > 0 ? (prevPurchaseVal / prevIndentVal) * 100 : 0;
    const maturityVariance = hasCompare ? (baseMaturity - compMaturity) : 0;
    const maturityChangePct = compMaturity > 0 ? (maturityVariance / compMaturity) * 100 : 0;

    // Get min/max date range
    const [[dateRange]] = await pool.query(
      `SELECT MIN(indent_date) AS minDate, MAX(indent_date) AS maxDate FROM centre_indent_data`
    );

    return res.json({
      centers: combinedCenters,
      seasonKpi: {
        baseSeason,
        compSeason,
        hasCompare,
        compFrom,
        compTo,
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
        }
      },
      availableSeasons,
      compSeasons: priorCandidates,
      seasonMapping: mappingDict,
      dateRange: {
        minDate: dateRange?.minDate || null,
        maxDate: dateRange?.maxDate || null,
      },
    });
  } catch (error) {
    console.error('Error fetching Centre Maturity BI data:', error);
    return res.status(500).json({ error: 'Failed to fetch Centre Maturity data' });
  }
};

module.exports = {
  getCentreMaturityBiData,
};
