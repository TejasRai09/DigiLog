const { pool } = require('../config/mysql');

// ─── Helper: build WHERE clause from query params ────────────────
async function buildWhere(query, extraConditions = []) {
  const conditions = [...extraConditions];
  const params = [];

  let effectiveFrom = query.from;
  let effectiveTo = query.to;

  if (query.baseSeason && (!effectiveFrom && !effectiveTo)) {
    const [[mapping]] = await pool.query('SELECT start_date, end_date FROM season_mapping WHERE season_label = ?', [query.baseSeason]);
    if (mapping) {
      effectiveFrom = mapping.start_date;
      effectiveTo = mapping.end_date;
    }
  }

  if (effectiveFrom) {
    conditions.push('`Date` >= ?');
    params.push(effectiveFrom);
  }
  if (effectiveTo) {
    conditions.push('`Date` <= ?');
    params.push(effectiveTo);
  }
  if (query.testType && query.testType !== 'All' && query.testType !== 'All Operations') {
    conditions.push('`TestType` = ?');
    params.push(query.testType);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
    effectiveFrom,
    effectiveTo
  };
}

// ─── GET /api/bi/brix-field/stats ────────────────────────────────
// Power BI Measures implemented:
//   Total Field Samples      = COUNTROWS(Table2)
//   Avg Mid Brix %           = AVERAGE(Table2[Middle Brix %])
//   Average Maturity         = AVERAGE(Table2[Maturity])  -- Maturity = MiddleBrix / NULLIF(BottomBrix, 0)
//   Bottom Brix < 18 (Count) = COUNTROWS(FILTER(Table2, Table2[Bottom Brix %] < 18))
//   Bottom Brix < 18 (%)     = DIVIDE([BottomBrix<18], [Total Samples]) * 100
const getFieldStats = async (req, res) => {
  try {
    const { baseSeason, compSeason, testType } = req.query;
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query);

    // Current Stats Query
    const [[currRow]] = await pool.query(
      `SELECT
        COUNT(*)                                                             AS totalSamples,
        ROUND(AVG(\`MiddleBrix\`), 2)                                        AS avgMidBrix,
        ROUND(AVG(\`TopBrix\`), 2)                                           AS avgTopBrix,
        ROUND(AVG(\`BottomBrix\`), 2)                                        AS avgBottomBrix,
        ROUND(
          AVG(
            CASE WHEN \`BottomBrix\` > 0
                 THEN \`MiddleBrix\` / \`BottomBrix\`
                 ELSE NULL END
          ), 2)                                                              AS avgMaturity,
        SUM(CASE WHEN \`BottomBrix\` < 18 THEN 1 ELSE 0 END)                 AS countBottomBrixLt18,
        ROUND(
          SUM(CASE WHEN \`BottomBrix\` < 18 THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0) * 100, 1)                                   AS pctBottomBrixLt18
      FROM \`brix_field_sampling\`
      ${clause}`,
      params,
    );

    // Previous Stats Query:
    // Season vs Season style — use the comparison season's full mapping
    // window, not the base from/to shifted by years.
    let prevRow = null;
    if (compSeason) {
      const prevConditions = [];
      const prevParams = [];
      const [[mapping]] = await pool.query(
        'SELECT start_date, end_date FROM season_mapping WHERE season_label = ?',
        [compSeason]
      );
      if (mapping?.start_date) {
        prevConditions.push('`Date` >= ?');
        prevParams.push(mapping.start_date);
      }
      if (mapping?.end_date) {
        prevConditions.push('`Date` <= ?');
        prevParams.push(mapping.end_date);
      }
      if (testType && testType !== 'All' && testType !== 'All Operations') {
        prevConditions.push('`TestType` = ?');
        prevParams.push(testType);
      }

      if (prevConditions.length) {
        const [[pRow]] = await pool.query(
          `SELECT
            COUNT(*)                                                             AS totalSamples,
            ROUND(AVG(\`MiddleBrix\`), 2)                                        AS avgMidBrix,
            ROUND(AVG(\`TopBrix\`), 2)                                           AS avgTopBrix,
            ROUND(AVG(\`BottomBrix\`), 2)                                        AS avgBottomBrix,
            ROUND(
              AVG(
                CASE WHEN \`BottomBrix\` > 0
                     THEN \`MiddleBrix\` / \`BottomBrix\`
                     ELSE NULL END
              ), 2)                                                              AS avgMaturity,
            SUM(CASE WHEN \`BottomBrix\` < 18 THEN 1 ELSE 0 END)                 AS countBottomBrixLt18,
            ROUND(
              SUM(CASE WHEN \`BottomBrix\` < 18 THEN 1 ELSE 0 END)
              / NULLIF(COUNT(*), 0) * 100, 1)                                   AS pctBottomBrixLt18
          FROM \`brix_field_sampling\`
          WHERE ${prevConditions.join(' AND ')}`,
          prevParams,
        );
        prevRow = pRow;
      }
    }

    const calcChange = (curr, prev) => {
      const c = parseFloat(curr) || 0;
      const p = parseFloat(prev) || 0;
      if (p === 0) return c > 0 ? 100 : null;
      return parseFloat((((c - p) / p) * 100).toFixed(2));
    };
    const calcVar = (curr, prev) => {
      if (!prevRow) return null;
      return parseFloat(((parseFloat(curr) || 0) - (parseFloat(prev) || 0)).toFixed(2));
    };
    const hasCompare = Boolean(prevRow) && (Number(prevRow.totalSamples) || 0) > 0;

    const mk = (curr, prev, { lowerBetter = false } = {}) => {
      const change = hasCompare ? calcChange(curr, prev) : null;
      const variance = hasCompare ? calcVar(curr, prev) : null;
      const isUp = lowerBetter
        ? (variance == null ? true : variance <= 0)
        : (change == null ? true : change >= 0);
      return { value: curr || 0, change, variance, isUp };
    };

    const stats = {
      totalSamples: mk(currRow.totalSamples, prevRow?.totalSamples),
      avgMidBrix: mk(currRow.avgMidBrix, prevRow?.avgMidBrix),
      avgMaturity: mk(currRow.avgMaturity, prevRow?.avgMaturity),
      pctBottomBrixLt18: mk(currRow.pctBottomBrixLt18, prevRow?.pctBottomBrixLt18, { lowerBetter: true }),
    };

    // Metadata: Season Mapping & Dates
    const [seasonsRes] = await pool.query(`SELECT season_label, start_date, end_date FROM season_mapping ORDER BY start_date DESC`);
    
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
        visibleSeasons = parsed.brix_sampling || [];
      } catch (_) {}
    }
    if (visibleSeasons.length === 0 && visMap['bi_visible_seasons']) {
      try { visibleSeasons = JSON.parse(visMap['bi_visible_seasons']); } catch (_) {}
    }

    let filteredSeasonsRes = seasonsRes;
    if (Array.isArray(visibleSeasons) && visibleSeasons.length > 0) {
      filteredSeasonsRes = seasonsRes.filter(s => visibleSeasons.includes(s.season_label));
    }

    const availableSeasons = filteredSeasonsRes.map(s => s.season_label);
    const seasonMapping = {};
    filteredSeasonsRes.forEach(s => {
      seasonMapping[s.season_label] = {
        startDate: s.start_date,
        endDate: s.end_date
      };
    });

    const [[maxDateRes]] = await pool.query(`SELECT MAX(\`Date\`) AS maxDate FROM \`brix_field_sampling\``);

    res.json({
      stats,
      hasCompare,
      compSeason: compSeason || null,
      availableSeasons,
      seasonMapping,
      dateRange: { maxDate: maxDateRes.maxDate }
    });
  } catch (err) {
    console.error('[bi/brix-field/stats]', err);
    res.status(500).json({ message: 'Could not load field stats.' });
  }
};

// ─── GET /api/bi/brix-field/brix-trend ──────────────────────────
// Line chart: Top, Middle, and Bottom Brix % over time.
// Power BI visual: Category=Date, Y=TopBrix (Avg), MiddleBrix (Avg), BottomBrix (Avg)
const getFieldBrixTrend = async (req, res) => {
  try {
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query);

    const [rows] = await pool.query(
      `SELECT
        DATE_FORMAT(\`Date\`, '%Y-%m-%d') AS date,
        COUNT(*)                         AS totalSamples,
        ROUND(AVG(\`TopBrix\`), 2)        AS topBrix,
        ROUND(AVG(\`MiddleBrix\`), 2)     AS midBrix,
        ROUND(AVG(\`BottomBrix\`), 2)     AS bottomBrix
      FROM \`brix_field_sampling\`
      ${clause}
      GROUP BY \`Date\`
      ORDER BY \`Date\` ASC`,
      params,
    );

    res.json(rows);
  } catch (err) {
    console.error('[bi/brix-field/brix-trend]', err);
    res.status(500).json({ message: 'Could not load field trend data.' });
  }
};

// ─── GET /api/bi/brix-field/crop-condition ──────────────────────
// Pie chart: Crop Condition distribution (Good / Diseased / etc.)
// Power BI visual: Category=CropCondition, Values=COUNT(*)
const getFieldCropCondition = async (req, res) => {
  try {
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query);

    const [rows] = await pool.query(
      `SELECT
        COALESCE(\`CropCondition\`, 'Good') AS \`condition\`,
        COUNT(*)                             AS \`count\`
      FROM \`brix_field_sampling\`
      ${clause}
      GROUP BY \`condition\`
      ORDER BY \`count\` DESC`,
      params,
    );

    res.json(rows);
  } catch (err) {
    console.error('[bi/brix-field/crop-condition]', err);
    res.status(500).json({ message: 'Could not load crop condition data.' });
  }
};

// ─── GET /api/bi/brix-field/by-soil-type ────────────────────────
// Combo Chart: Soil Type vs Samples & Average Maturity
// Power BI visual: Category=SoilType, Bars=COUNT(*), Line=AVG(Maturity)
const getFieldBySoilType = async (req, res) => {
  try {
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query, ["`SoilType` IS NOT NULL", "`SoilType` != ''"]);

    const [rows] = await pool.query(
      `SELECT
        \`SoilType\`                                                     AS soil,
        COUNT(*)                                                         AS samples,
        ROUND(
          AVG(
            CASE WHEN \`BottomBrix\` > 0
                 THEN \`MiddleBrix\` / \`BottomBrix\`
                 ELSE NULL END
          ), 3)                                                          AS maturity
      FROM \`brix_field_sampling\`
      ${clause}
      GROUP BY \`SoilType\`
      ORDER BY samples DESC`,
      params,
    );

    res.json(rows);
  } catch (err) {
    console.error('[bi/brix-field/by-soil-type]', err);
    res.status(500).json({ message: 'Could not load soil type data.' });
  }
};

// ─── GET /api/bi/brix-field/by-land-type ────────────────────────
// Pie Chart: Land Type Area Share & Maturity
// Power BI visual: Category=LandType, Values=COUNT(*), Line=AVG(Maturity)
const getFieldByLandType = async (req, res) => {
  try {
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query, ["`LandType` IS NOT NULL", "`LandType` != ''"]);

    const [rows] = await pool.query(
      `SELECT
        \`LandType\`                                                     AS name,
        COUNT(*)                                                         AS samples,
        ROUND(
          AVG(
            CASE WHEN \`BottomBrix\` > 0
                 THEN \`MiddleBrix\` / \`BottomBrix\`
                 ELSE NULL END
          ), 2)                                                          AS maturity
      FROM \`brix_field_sampling\`
      ${clause}
      GROUP BY \`LandType\`
      ORDER BY samples DESC`,
      params,
    );

    res.json(rows);
  } catch (err) {
    console.error('[bi/brix-field/by-land-type]', err);
    res.status(500).json({ message: 'Could not load land type data.' });
  }
};

// ─── GET /api/bi/brix-field/by-variety ──────────────────────────
// Combo Chart: Crop Variety vs Samples & Average Maturity
// Power BI visual: Category=Variety, Bars=COUNT(*), Line=AVG(Maturity)
const getFieldByVariety = async (req, res) => {
  try {
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query, ["`Variety` IS NOT NULL", "`Variety` != ''"]);

    const [rows] = await pool.query(
      `SELECT
        \`Variety\`                                                      AS variety,
        COUNT(*)                                                         AS samples,
        ROUND(
          AVG(
            CASE WHEN \`BottomBrix\` > 0
                 THEN \`MiddleBrix\` / \`BottomBrix\`
                 ELSE NULL END
          ), 2)                                                          AS maturity
      FROM \`brix_field_sampling\`
      ${clause}
      GROUP BY \`Variety\`
      ORDER BY samples DESC`,
      params,
    );

    res.json(rows);
  } catch (err) {
    console.error('[bi/brix-field/by-variety]', err);
    res.status(500).json({ message: 'Could not load variety data.' });
  }
};

// ─── GET /api/bi/brix-field/field-condition-trend ───────────────
// Line Chart: Brix Trend by Field Condition over time.
// Power BI visual: Visual 13 (lineChart) - Category=Date, Series=FieldCondition, Y=AVERAGE(MiddleBrix)
const getFieldConditionTrend = async (req, res) => {
  try {
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query, ["`FieldCondition` IS NOT NULL", "`FieldCondition` != ''"]);

    const [rows] = await pool.query(
      `SELECT
        DATE_FORMAT(\`Date\`, '%Y-%m-%d') AS date,
        ROUND(AVG(CASE WHEN \`FieldCondition\` = 'Waterlogged' THEN \`MiddleBrix\` ELSE NULL END), 2) AS waterlogged,
        ROUND(AVG(CASE WHEN \`FieldCondition\` = 'No Water'    THEN \`MiddleBrix\` ELSE NULL END), 2) AS noWater,
        ROUND(AVG(\`MiddleBrix\`), 2)                                                                AS overallAvg
      FROM \`brix_field_sampling\`
      ${clause}
      GROUP BY \`Date\`
      ORDER BY \`Date\` ASC`,
      params,
    );

    res.json(rows);
  } catch (err) {
    console.error('[bi/brix-field/field-condition-trend]', err);
    res.status(500).json({ message: 'Could not load field condition trend data.' });
  }
};

// ─── GET /api/bi/brix-field/test-types ──────────────────────────
// Slicer options for Test Type dropdown
const getFieldTestTypes = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT \`TestType\` AS testType
       FROM \`brix_field_sampling\`
       WHERE \`TestType\` IS NOT NULL AND \`TestType\` != ''
       ORDER BY \`TestType\` ASC`,
    );
    res.json(rows.map(r => r.testType));
  } catch (err) {
    console.error('[bi/brix-field/test-types]', err);
    res.status(500).json({ message: 'Could not load test types.' });
  }
};

// ─── GET /api/bi/brix-field/table-data ──────────────────────────
const getFieldTableData = async (req, res) => {
  try {
    const { clause, params } = await buildWhere(req.query);

    const [rows] = await pool.query(
      `SELECT
        DATE_FORMAT(\`Date\`, '%Y-%m-%d') AS date,
        \`Name\` AS location,
        ROUND(\`TopBrix\`, 2) AS topBrix,
        ROUND(\`MiddleBrix\`, 2) AS midBrix,
        ROUND(\`BottomBrix\`, 2) AS bottomBrix,
        ROUND(
          CASE WHEN \`BottomBrix\` > 0
               THEN \`MiddleBrix\` / \`BottomBrix\`
               ELSE NULL END, 3
        ) AS maturity
      FROM \`brix_field_sampling\`
      ${clause}
      ORDER BY \`Date\` DESC
      LIMIT 1000`,
      params,
    );

    res.json(rows);
  } catch (err) {
    console.error('[bi/brix-field/table-data]', err);
    res.status(500).json({ message: 'Could not load field table data.' });
  }
};

module.exports = {
  getFieldStats,
  getFieldBrixTrend,
  getFieldConditionTrend,
  getFieldCropCondition,
  getFieldBySoilType,
  getFieldByLandType,
  getFieldByVariety,
  getFieldTestTypes,
  getFieldTableData,
};
