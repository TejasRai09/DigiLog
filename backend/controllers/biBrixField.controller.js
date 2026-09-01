const { pool } = require('../config/mysql');
const { getBrixThreshold } = require('../utils/biConstants');

// ─── Helper: build WHERE clause from query params ────────────────
async function buildWhere(query, extraConditions = []) {
  const conditions = [...extraConditions];
  const params = [];

  let effectiveFrom = query.from;
  let effectiveTo = query.to;

  if (query.baseSeason && (!effectiveFrom && !effectiveTo)) {
    const [[mapping]] = await pool.query(
      'SELECT start_date, end_date FROM season_mapping WHERE season_label = ?',
      [query.baseSeason],
    );
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
    effectiveTo,
  };
}

function toYmd(v) {
  if (!v) return null;
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date && !isNaN(v)) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(v).slice(0, 10);
}

/** Sanitize an admin-configured Brix threshold before splicing it into raw SQL (no bind params, numeric-only). */
function sanitizeThreshold(threshold) {
  const t = Number(threshold);
  return Number.isFinite(t) && t > 0 ? t : 18;
}

function buildStatsSelect(threshold) {
  const t = sanitizeThreshold(threshold);
  return `
  COUNT(*)                                                             AS totalSamples,
  ROUND(AVG(\`MiddleBrix\`), 2)                                        AS avgMidBrix,
  ROUND(AVG(\`TopBrix\`), 2)                                           AS avgTopBrix,
  ROUND(AVG(\`BottomBrix\`), 2)                                        AS avgBottomBrix,
  ROUND(
    AVG(
      CASE WHEN \`BottomBrix\` > 0
           THEN \`TopBrix\` / \`BottomBrix\`
           ELSE NULL END
    ), 2)                                                              AS avgMaturity,
  SUM(CASE WHEN \`BottomBrix\` < ${t} THEN 1 ELSE 0 END)               AS countBottomBrixLt18,
  ROUND(
    SUM(CASE WHEN \`BottomBrix\` < ${t} THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0) * 100, 1)                                   AS pctBottomBrixLt18
`;
}

async function querySeasonMeta() {
  const [seasonsRes] = await pool.query(
    'SELECT season_label, start_date, end_date FROM season_mapping ORDER BY start_date DESC',
  );

  const availableSeasons = seasonsRes.map((s) => s.season_label);
  const seasonMapping = {};
  seasonsRes.forEach((s) => {
    seasonMapping[s.season_label] = { startDate: s.start_date, endDate: s.end_date };
  });
  return { availableSeasons, seasonMapping };
}

async function queryFieldDateRange() {
  const [[rangeRes]] = await pool.query(
    `SELECT
       DATE_FORMAT(MIN(\`Date\`), '%Y-%m-%d') AS minDate,
       DATE_FORMAT(MAX(\`Date\`), '%Y-%m-%d') AS maxDate
     FROM \`brix_field_sampling\``,
  );
  return rangeRes;
}

async function queryTestTypes() {
  const [rows] = await pool.query(
    `SELECT DISTINCT \`TestType\` AS testType
     FROM \`brix_field_sampling\`
     WHERE \`TestType\` IS NOT NULL AND \`TestType\` != ''
     ORDER BY \`TestType\` ASC`,
  );
  return rows.map((r) => r.testType);
}

function mkStats(currRow, prevRow, brixThreshold) {
  const hasCompare = Boolean(prevRow) && (Number(prevRow.totalSamples) || 0) > 0;
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
  const mk = (curr, prev, { lowerBetter = false } = {}) => {
    const change = hasCompare ? calcChange(curr, prev) : null;
    const variance = hasCompare ? calcVar(curr, prev) : null;
    const isUp = lowerBetter
      ? (variance == null ? true : variance <= 0)
      : (change == null ? true : change >= 0);
    return { value: curr || 0, change, variance, isUp };
  };

  return {
    hasCompare,
    stats: {
      totalSamples: mk(currRow.totalSamples, prevRow?.totalSamples),
      avgMidBrix: mk(currRow.avgMidBrix, prevRow?.avgMidBrix),
      avgMaturity: mk(currRow.avgMaturity, prevRow?.avgMaturity),
      pctBottomBrixLt18: mk(currRow.pctBottomBrixLt18, prevRow?.pctBottomBrixLt18, { lowerBetter: true }),
      brixThreshold,
    },
  };
}

async function loadFieldStatsBundle(query, clause, params, effectiveFrom, effectiveTo) {
  const { testType, compSeason } = query;
  const prevConditions = [];
  const prevParams = [];
  let compareMode = null;
  const pyFrom = query.pyFrom ? String(query.pyFrom).slice(0, 10) : null;
  const pyTo = query.pyTo ? String(query.pyTo).slice(0, 10) : null;

  if (pyFrom || pyTo) {
    compareMode = 'priorYear';
    if (pyFrom) { prevConditions.push('`Date` >= ?'); prevParams.push(pyFrom); }
    if (pyTo) { prevConditions.push('`Date` <= ?'); prevParams.push(pyTo); }
  } else if (compSeason) {
    compareMode = 'compSeason';
    const [[mapping]] = await pool.query(
      'SELECT start_date, end_date FROM season_mapping WHERE season_label = ?',
      [compSeason],
    );
    if (mapping?.start_date) { prevConditions.push('`Date` >= ?'); prevParams.push(mapping.start_date); }
    if (mapping?.end_date) { prevConditions.push('`Date` <= ?'); prevParams.push(mapping.end_date); }
  }

  if (prevConditions.length && testType && testType !== 'All' && testType !== 'All Operations') {
    prevConditions.push('`TestType` = ?');
    prevParams.push(testType);
  }

  const brixThreshold = await getBrixThreshold();
  const statsSelect = buildStatsSelect(brixThreshold);

  const currPromise = pool.query(
    `SELECT ${statsSelect} FROM \`brix_field_sampling\` ${clause}`,
    params,
  );
  const prevPromise = prevConditions.length
    ? pool.query(
      `SELECT ${statsSelect} FROM \`brix_field_sampling\` WHERE ${prevConditions.join(' AND ')}`,
      prevParams,
    )
    : Promise.resolve([[null]]);
  const metaPromise = Promise.all([querySeasonMeta(), queryFieldDateRange()]);

  const [[[currRow]], [[prevRow]], [seasonMeta, rangeRes]] = await Promise.all([
    currPromise,
    prevPromise,
    metaPromise,
  ]);

  const { hasCompare, stats } = mkStats(currRow, prevRow, brixThreshold);

  return {
    stats,
    hasCompare,
    compareMode: hasCompare ? compareMode : null,
    compSeason: compareMode === 'compSeason' ? (compSeason || null) : null,
    pyFrom: compareMode === 'priorYear' ? pyFrom : null,
    pyTo: compareMode === 'priorYear' ? pyTo : null,
    availableSeasons: seasonMeta.availableSeasons,
    seasonMapping: seasonMeta.seasonMapping,
    dateRange: {
      minDate: rangeRes.minDate,
      maxDate: rangeRes.maxDate,
      effectiveFrom: toYmd(effectiveFrom) || rangeRes.minDate,
      effectiveTo: toYmd(effectiveTo) || rangeRes.maxDate,
    },
  };
}

async function queryFieldBrixTrend(clause, params) {
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
  return rows;
}

async function queryFieldCropCondition(clause, params) {
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
  return rows;
}

async function queryFieldBySoilType(query) {
  const { clause, params } = await buildWhere(query, ["`SoilType` IS NOT NULL", "`SoilType` != ''"]);
  const [rows] = await pool.query(
    `SELECT
      \`SoilType\`                                                     AS soil,
      COUNT(*)                                                         AS samples,
      ROUND(
        AVG(
          CASE WHEN \`BottomBrix\` > 0
               THEN \`TopBrix\` / \`BottomBrix\`
               ELSE NULL END
        ), 3)                                                          AS maturity
    FROM \`brix_field_sampling\`
    ${clause}
    GROUP BY \`SoilType\`
    ORDER BY samples DESC`,
    params,
  );
  return rows;
}

async function queryFieldByLandType(query) {
  const { clause, params } = await buildWhere(query, ["`LandType` IS NOT NULL", "`LandType` != ''"]);
  const [rows] = await pool.query(
    `SELECT
      \`LandType\`                                                     AS name,
      COUNT(*)                                                         AS samples,
      ROUND(
        AVG(
          CASE WHEN \`BottomBrix\` > 0
               THEN \`TopBrix\` / \`BottomBrix\`
               ELSE NULL END
        ), 2)                                                          AS maturity
    FROM \`brix_field_sampling\`
    ${clause}
    GROUP BY \`LandType\`
    ORDER BY samples DESC`,
    params,
  );
  return rows;
}

async function queryFieldByVariety(query) {
  const { clause, params } = await buildWhere(query, ["`Variety` IS NOT NULL", "`Variety` != ''"]);
  const [rows] = await pool.query(
    `SELECT
      \`Variety\`                                                      AS variety,
      COUNT(*)                                                         AS samples,
      ROUND(
        AVG(
          CASE WHEN \`BottomBrix\` > 0
               THEN \`TopBrix\` / \`BottomBrix\`
               ELSE NULL END
        ), 2)                                                          AS maturity
    FROM \`brix_field_sampling\`
    ${clause}
    GROUP BY \`Variety\`
    ORDER BY samples DESC`,
    params,
  );
  return rows;
}

async function queryFieldConditionTrend(query) {
  const { clause, params } = await buildWhere(query, ["`FieldCondition` IS NOT NULL", "`FieldCondition` != ''"]);
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
  return rows;
}

// ─── GET /api/bi/brix-field/stats ────────────────────────────────
const getFieldStats = async (req, res) => {
  try {
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query);
    const payload = await loadFieldStatsBundle(req.query, clause, params, effectiveFrom, effectiveTo);
    res.json(payload);
  } catch (err) {
    console.error('[bi/brix-field/stats]', err);
    res.status(500).json({ message: 'Could not load field stats.' });
  }
};

// ─── GET /api/bi/brix-field/dashboard (single round-trip) ────────
const getFieldDashboard = async (req, res) => {
  try {
    const hasDates = Boolean(req.query.from || req.query.to || req.query.baseSeason);

    if (!hasDates) {
      const [dateRange, seasonMeta, testTypes] = await Promise.all([
        queryFieldDateRange(),
        querySeasonMeta(),
        queryTestTypes(),
      ]);
      return res.json({
        seedOnly: true,
        dateRange: {
          minDate: dateRange.minDate,
          maxDate: dateRange.maxDate,
          effectiveFrom: dateRange.minDate,
          effectiveTo: dateRange.maxDate,
        },
        availableSeasons: seasonMeta.availableSeasons,
        seasonMapping: seasonMeta.seasonMapping,
        testTypes,
      });
    }

    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query);
    const [
      statsBundle,
      trend,
      conditionTrend,
      cropCondition,
      soilType,
      landType,
      variety,
      testTypes,
    ] = await Promise.all([
      loadFieldStatsBundle(req.query, clause, params, effectiveFrom, effectiveTo),
      queryFieldBrixTrend(clause, params),
      queryFieldConditionTrend(req.query),
      queryFieldCropCondition(clause, params),
      queryFieldBySoilType(req.query),
      queryFieldByLandType(req.query),
      queryFieldByVariety(req.query),
      queryTestTypes(),
    ]);

    res.json({
      seedOnly: false,
      ...statsBundle,
      trend,
      conditionTrend,
      cropCondition,
      soilType,
      landType,
      variety,
      testTypes,
    });
  } catch (err) {
    console.error('[bi/brix-field/dashboard]', err);
    res.status(500).json({ message: 'Could not load field dashboard.' });
  }
};

const getFieldBrixTrend = async (req, res) => {
  try {
    const { clause, params } = await buildWhere(req.query);
    res.json(await queryFieldBrixTrend(clause, params));
  } catch (err) {
    console.error('[bi/brix-field/brix-trend]', err);
    res.status(500).json({ message: 'Could not load field trend data.' });
  }
};

const getFieldCropCondition = async (req, res) => {
  try {
    const { clause, params } = await buildWhere(req.query);
    res.json(await queryFieldCropCondition(clause, params));
  } catch (err) {
    console.error('[bi/brix-field/crop-condition]', err);
    res.status(500).json({ message: 'Could not load crop condition data.' });
  }
};

const getFieldBySoilType = async (req, res) => {
  try {
    res.json(await queryFieldBySoilType(req.query));
  } catch (err) {
    console.error('[bi/brix-field/by-soil-type]', err);
    res.status(500).json({ message: 'Could not load soil type data.' });
  }
};

const getFieldByLandType = async (req, res) => {
  try {
    res.json(await queryFieldByLandType(req.query));
  } catch (err) {
    console.error('[bi/brix-field/by-land-type]', err);
    res.status(500).json({ message: 'Could not load land type data.' });
  }
};

const getFieldByVariety = async (req, res) => {
  try {
    res.json(await queryFieldByVariety(req.query));
  } catch (err) {
    console.error('[bi/brix-field/by-variety]', err);
    res.status(500).json({ message: 'Could not load variety data.' });
  }
};

const getFieldConditionTrend = async (req, res) => {
  try {
    res.json(await queryFieldConditionTrend(req.query));
  } catch (err) {
    console.error('[bi/brix-field/field-condition-trend]', err);
    res.status(500).json({ message: 'Could not load field condition trend data.' });
  }
};

const getFieldTestTypes = async (req, res) => {
  try {
    res.json(await queryTestTypes());
  } catch (err) {
    console.error('[bi/brix-field/test-types]', err);
    res.status(500).json({ message: 'Could not load test types.' });
  }
};

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
               THEN \`TopBrix\` / \`BottomBrix\`
               ELSE NULL END, 3
        ) AS maturity
      FROM \`brix_field_sampling\`
      ${clause}
      ORDER BY \`timestamp\` DESC
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
  getFieldDashboard,
  getFieldBrixTrend,
  getFieldConditionTrend,
  getFieldCropCondition,
  getFieldBySoilType,
  getFieldByLandType,
  getFieldByVariety,
  getFieldTestTypes,
  getFieldTableData,
};
