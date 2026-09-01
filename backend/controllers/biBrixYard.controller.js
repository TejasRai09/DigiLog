const { pool } = require('../config/mysql');
const { getBrixThreshold } = require('../utils/biConstants');

// ─── Helper: build WHERE clause from date/deliveryPoint filters ──
async function buildWhere(query, alias = '') {
  const prefix = alias ? `${alias}.` : '';
  const conditions = [];
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
    conditions.push(`${prefix}\`Date\` >= ?`);
    params.push(effectiveFrom);
  }
  if (effectiveTo) {
    conditions.push(`${prefix}\`Date\` <= ?`);
    params.push(effectiveTo);
  }
  if (query.deliveryPoint && query.deliveryPoint !== 'All') {
    conditions.push(`${prefix}\`DeliveryPoint\` = ?`);
    params.push(query.deliveryPoint);
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
  COUNT(*)                                                          AS totalSamples,
  ROUND(AVG(\`MiddleBrix\`), 2)                                     AS avgBrix,
  SUM(\`MiddleBrix\`)                                               AS sumBrix,
  SUM(CASE WHEN \`DiseasedCane\` = 'Yes' THEN 1 ELSE 0 END)        AS countDiseased,
  ROUND(
    SUM(CASE WHEN \`DiseasedCane\` = 'Yes' THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0) * 100, 1)                                AS pctDiseased,
  SUM(CASE WHEN \`StaleCane\` = 'Yes' THEN 1 ELSE 0 END)           AS countStale,
  ROUND(
    SUM(CASE WHEN \`StaleCane\` = 'Yes' THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0) * 100, 1)                                AS pctStale,
  SUM(CASE WHEN \`DiseasedCane\` = 'Yes'
             OR \`StaleCane\`    = 'Yes' THEN 1 ELSE 0 END)        AS countAffected,
  ROUND(
    SUM(CASE WHEN \`DiseasedCane\` = 'Yes'
               OR \`StaleCane\`    = 'Yes' THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0) * 100, 1)                                AS pctAffected,
  SUM(CASE WHEN \`MiddleBrix\` > ${t} THEN 1 ELSE 0 END)           AS countBrixGt18,
  ROUND(
    SUM(CASE WHEN \`MiddleBrix\` > ${t} THEN 1 ELSE 0 END)
    / NULLIF(COUNT(*), 0) * 100, 1)                                AS pctBrixGt18
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

async function queryYardDateRange() {
  const [[rangeRes]] = await pool.query(
    `SELECT
       DATE_FORMAT(MIN(\`Date\`), '%Y-%m-%d') AS minDate,
       DATE_FORMAT(MAX(\`Date\`), '%Y-%m-%d') AS maxDate
     FROM \`brix_yard_sampling\``,
  );
  return rangeRes;
}

async function queryDeliveryPoints() {
  const [rows] = await pool.query(
    `SELECT DISTINCT \`DeliveryPoint\` AS deliveryPoint
     FROM \`brix_yard_sampling\`
     WHERE \`DeliveryPoint\` IS NOT NULL AND \`DeliveryPoint\` != ''
     ORDER BY \`DeliveryPoint\` ASC`,
  );
  return rows.map((r) => r.deliveryPoint);
}

function buildPrevWhere(query) {
  const { deliveryPoint, compSeason } = query;
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
  }

  return { prevConditions, prevParams, compareMode, pyFrom, pyTo, deliveryPoint, compSeason };
}

async function finalizePrevWhere(prevPack) {
  const { prevConditions, prevParams, compareMode, deliveryPoint, compSeason } = prevPack;
  if (compareMode === 'compSeason' && compSeason) {
    const [[mapping]] = await pool.query(
      'SELECT start_date, end_date FROM season_mapping WHERE season_label = ?',
      [compSeason],
    );
    if (mapping?.start_date) { prevConditions.push('`Date` >= ?'); prevParams.push(mapping.start_date); }
    if (mapping?.end_date) { prevConditions.push('`Date` <= ?'); prevParams.push(mapping.end_date); }
  }
  if (prevConditions.length && deliveryPoint && deliveryPoint !== 'All') {
    prevConditions.push('`DeliveryPoint` = ?');
    prevParams.push(deliveryPoint);
  }
  return prevPack;
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
      avgBrix: mk(currRow.avgBrix, prevRow?.avgBrix),
      pctDiseased: mk(currRow.pctDiseased, prevRow?.pctDiseased, { lowerBetter: true }),
      pctStale: mk(currRow.pctStale, prevRow?.pctStale, { lowerBetter: true }),
      pctAffected: mk(currRow.pctAffected, prevRow?.pctAffected, { lowerBetter: true }),
      pctBrixGt18: mk(currRow.pctBrixGt18, prevRow?.pctBrixGt18),
      brixThreshold,
    },
  };
}

async function loadYardStatsBundle(query, clause, params, effectiveFrom, effectiveTo) {
  let prevPack = buildPrevWhere(query);
  prevPack = await finalizePrevWhere(prevPack);
  const { prevConditions, prevParams, compareMode, pyFrom, pyTo, compSeason } = prevPack;

  const brixThreshold = await getBrixThreshold();
  const statsSelect = buildStatsSelect(brixThreshold);

  const currPromise = pool.query(
    `SELECT ${statsSelect} FROM \`brix_yard_sampling\` ${clause}`,
    params,
  );
  const prevPromise = prevConditions.length
    ? pool.query(
      `SELECT ${statsSelect} FROM \`brix_yard_sampling\` WHERE ${prevConditions.join(' AND ')}`,
      prevParams,
    )
    : Promise.resolve([[null]]);
  const metaPromise = Promise.all([querySeasonMeta(), queryYardDateRange()]);

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

async function queryYardTrend(clause, params) {
  const threshold = sanitizeThreshold(await getBrixThreshold());
  const [rows] = await pool.query(
    `SELECT
      \`Date\`                                                           AS date,
      COUNT(*)                                                           AS totalSamples,
      SUM(CASE WHEN \`MiddleBrix\` > ${threshold} THEN 1 ELSE 0 END)     AS countAbove18,
      ROUND(AVG(\`MiddleBrix\`), 2)                                     AS avgBrix
    FROM \`brix_yard_sampling\`
    ${clause}
    GROUP BY \`Date\`
    ORDER BY \`Date\` ASC`,
    params,
  );
  return rows;
}

async function queryYardByVehicle(clause, params) {
  const [rows] = await pool.query(
    `SELECT
      \`VehicleType\`              AS vehicleType,
      COUNT(*)                     AS samples,
      ROUND(AVG(\`MiddleBrix\`), 2) AS avgBrix
    FROM \`brix_yard_sampling\`
    ${clause}
    GROUP BY \`VehicleType\`
    ORDER BY avgBrix DESC`,
    params,
  );
  return rows;
}

async function queryYardConditionDist(clause, params) {
  const affectedClause = clause
    ? `${clause} AND \`DiseasedCane\` = 'No' AND \`StaleCane\` = 'No'`
    : `WHERE \`DiseasedCane\` = 'No' AND \`StaleCane\` = 'No'`;

  const [rows] = await pool.query(
    `SELECT
      \`ConsignmentConditions\` AS \`condition\`,
      COUNT(*)                  AS \`count\`
    FROM \`brix_yard_sampling\`
    ${affectedClause}
    GROUP BY \`ConsignmentConditions\`
    ORDER BY \`count\` DESC`,
    params,
  );
  return rows;
}

/** Resolve centre/village labels only for codes present in the result set (avoids heavy DISTINCT joins). */
async function resolveCenterNames(codes) {
  const map = Object.create(null);
  if (!codes.length) return map;

  const placeholders = codes.map(() => '?').join(',');
  const queries = [
    pool.query(
      `SELECT CAST(\`centre_code\` AS CHAR) AS code, MAX(\`centre_name\`) AS name
       FROM \`purchy_grower_summary\`
       WHERE \`centre_code\` IN (${placeholders})
         AND \`centre_name\` IS NOT NULL AND \`centre_name\` != ''
       GROUP BY \`centre_code\``,
      codes,
    ).catch(() => [[]]),
    pool.query(
      `SELECT CAST(\`purchsecentre\` AS CHAR) AS code, MAX(\`purchsecentrename\`) AS name
       FROM \`purchy_supply\`
       WHERE \`purchsecentre\` IN (${placeholders})
         AND \`purchsecentrename\` IS NOT NULL AND \`purchsecentrename\` != ''
       GROUP BY \`purchsecentre\``,
      codes,
    ).catch(() => [[]]),
    pool.query(
      `SELECT CAST(\`village_code\` AS CHAR) AS code, MAX(\`village_name\`) AS name
       FROM \`purchy_grower_summary\`
       WHERE \`village_code\` IN (${placeholders})
         AND \`village_name\` IS NOT NULL AND \`village_name\` != ''
       GROUP BY \`village_code\``,
      codes,
    ).catch(() => [[]]),
    pool.query(
      `SELECT CAST(\`villagecode\` AS CHAR) AS code, MAX(\`villagename\`) AS name
       FROM \`purchy_supply\`
       WHERE \`villagecode\` IN (${placeholders})
         AND \`villagename\` IS NOT NULL AND \`villagename\` != ''
       GROUP BY \`villagecode\``,
      codes,
    ).catch(() => [[]]),
  ];

  const results = await Promise.all(queries);
  for (const [rows] of results) {
    for (const r of rows) {
      const key = String(r.code ?? '').trim();
      if (key && r.name && !map[key]) map[key] = r.name;
    }
  }
  return map;
}

function formatCenterLabel(code, nameMap) {
  const raw = code == null ? '' : String(code).trim();
  if (!raw || raw === '0') return 'GATE';
  if (nameMap[raw]) return nameMap[raw];
  if (/^[0-9]+(\.[0-9]+)?$/.test(raw)) return `Center #${raw}`;
  return raw;
}

async function queryYardCenterWise(clause, params) {
  // 1) Aggregate only on the sampling table (date-filtered) — fast
  const [rows] = await pool.query(
    `SELECT
      y.\`VillageOrCenterCode\` AS code,
      SUM(CASE WHEN y.\`ConsignmentConditions\` = 'Clean'      THEN 1 ELSE 0 END) AS Clean,
      SUM(CASE WHEN y.\`ConsignmentConditions\` = 'Dry Leaves' THEN 1 ELSE 0 END) AS DryLeaves,
      SUM(CASE WHEN y.\`ConsignmentConditions\` = 'Muddy'      THEN 1 ELSE 0 END) AS Muddy,
      SUM(CASE WHEN y.\`ConsignmentConditions\` = 'Roots'      THEN 1 ELSE 0 END) AS Roots,
      COUNT(*) AS Total
    FROM \`brix_yard_sampling\` y
    ${clause}
    GROUP BY y.\`VillageOrCenterCode\`
    ORDER BY Total DESC`,
    params,
  );

  // 2) Resolve names for the codes we actually need
  const codes = [
    ...new Set(
      rows
        .map((r) => (r.code == null ? '' : String(r.code).trim()))
        .filter((c) => c && c !== '0'),
    ),
  ];
  const nameMap = await resolveCenterNames(codes);

  return rows.map((r) => ({
    center: formatCenterLabel(r.code, nameMap),
    Clean: r.Clean,
    DryLeaves: r.DryLeaves,
    Muddy: r.Muddy,
    Roots: r.Roots,
    Total: r.Total,
  }));
}

// ─── GET /api/bi/brix-yard/stats ────────────────────────────────
const getYardStats = async (req, res) => {
  try {
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query);
    const payload = await loadYardStatsBundle(req.query, clause, params, effectiveFrom, effectiveTo);
    res.json(payload);
  } catch (err) {
    console.error('[bi/brix-yard/stats]', err);
    res.status(500).json({ message: 'Could not load stats.' });
  }
};

// ─── GET /api/bi/brix-yard/dashboard (single round-trip) ────────
const getYardDashboard = async (req, res) => {
  try {
    const hasDates = Boolean(req.query.from || req.query.to || req.query.baseSeason);

    // Seed path: avoid full-table chart scans before From/To are known
    if (!hasDates) {
      const [dateRange, seasonMeta, deliveryPoints] = await Promise.all([
        queryYardDateRange(),
        querySeasonMeta(),
        queryDeliveryPoints(),
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
        deliveryPoints,
      });
    }

    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query);
    const [statsBundle, trend, vehicle, condition, centers, deliveryPoints] = await Promise.all([
      loadYardStatsBundle(req.query, clause, params, effectiveFrom, effectiveTo),
      queryYardTrend(clause, params),
      queryYardByVehicle(clause, params),
      queryYardConditionDist(clause, params),
      queryYardCenterWise(clause, params),
      queryDeliveryPoints(),
    ]);

    res.json({
      seedOnly: false,
      ...statsBundle,
      trend,
      vehicle,
      condition,
      centers,
      deliveryPoints,
    });
  } catch (err) {
    console.error('[bi/brix-yard/dashboard]', err);
    res.status(500).json({ message: 'Could not load yard dashboard.' });
  }
};

const getYardBrixTrend = async (req, res) => {
  try {
    const { clause, params } = await buildWhere(req.query);
    res.json(await queryYardTrend(clause, params));
  } catch (err) {
    console.error('[bi/brix-yard/brix-trend]', err);
    res.status(500).json({ message: 'Could not load trend data.' });
  }
};

const getYardByVehicle = async (req, res) => {
  try {
    const { clause, params } = await buildWhere(req.query);
    res.json(await queryYardByVehicle(clause, params));
  } catch (err) {
    console.error('[bi/brix-yard/by-vehicle]', err);
    res.status(500).json({ message: 'Could not load vehicle data.' });
  }
};

const getYardConditionDist = async (req, res) => {
  try {
    const { clause, params } = await buildWhere(req.query);
    res.json(await queryYardConditionDist(clause, params));
  } catch (err) {
    console.error('[bi/brix-yard/condition-distribution]', err);
    res.status(500).json({ message: 'Could not load condition data.' });
  }
};

const getYardCenterWise = async (req, res) => {
  try {
    const { clause, params } = await buildWhere(req.query, 'y');
    res.json(await queryYardCenterWise(clause, params));
  } catch (err) {
    console.error('[bi/brix-yard/center-wise]', err);
    res.status(500).json({ message: 'Could not load center data.' });
  }
};

const getYardDeliveryPoints = async (req, res) => {
  try {
    res.json(await queryDeliveryPoints());
  } catch (err) {
    console.error('[bi/brix-yard/delivery-points]', err);
    res.status(500).json({ message: 'Could not load delivery points.' });
  }
};

const getYardTableData = async (req, res) => {
  try {
    const { clause, params } = await buildWhere(req.query);
    const [rows] = await pool.query(
      `SELECT
        DATE_FORMAT(\`Date\`, '%Y-%m-%d') AS date,
        \`DeliveryPoint\` AS location,
        \`Name\` AS name,
        ROUND(\`MiddleBrix\`, 2) AS midBrix,
        \`VehicleType\` AS vehicleType,
        \`DiseasedCane\` AS diseased,
        \`StaleCane\` AS stale,
        \`ConsignmentConditions\` AS consignmentCondition,
        \`VarietyOfCane\` AS variety
      FROM \`brix_yard_sampling\`
      ${clause}
      ORDER BY \`timestamp\` DESC
      LIMIT 1000`,
      params,
    );
    res.json(rows);
  } catch (err) {
    console.error('[bi/brix-yard/table-data]', err);
    res.status(500).json({ message: 'Could not load yard table data.' });
  }
};

module.exports = {
  getYardStats,
  getYardDashboard,
  getYardBrixTrend,
  getYardByVehicle,
  getYardConditionDist,
  getYardCenterWise,
  getYardDeliveryPoints,
  getYardTableData,
};
