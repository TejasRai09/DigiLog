const { pool } = require('../config/mysql');

// ─── Helper: build WHERE clause from date/deliveryPoint filters ──
async function buildWhere(query, alias = '') {
  const prefix = alias ? `${alias}.` : '';
  const conditions = [];
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
    effectiveTo
  };
}

// ─── GET /api/bi/brix-yard/stats ────────────────────────────────
// Returns all KPI card values in one call.
// Power BI measures implemented:
//   Total Samples      = COUNTROWS(YardBrix)
//   Avg Middle Brix %  = AVERAGE(YardBrix[Middle Brix %])
//   Count Diseased     = COUNTROWS(FILTER(YardBrix, DiseasedCane="Yes"))
//   % Diseased         = DIVIDE([Count Diseased], [Total Samples]) * 100
//   Count Stale        = COUNTROWS(FILTER(YardBrix, StaleCane="Yes"))
//   % Stale            = DIVIDE([Count Stale], [Total Samples]) * 100
//   Count Affected     = COUNTROWS(FILTER(YardBrix, DiseasedCane="Yes" OR StaleCane="Yes"))
//   % Affected         = DIVIDE([Count Affected], [Total Samples]) * 100
//   MidBrix>18         = COUNTROWS(FILTER(YardBrix, MiddleBrix > 18))
//   % Brix>18          = DIVIDE([MidBrix>18], [Total Samples]) * 100
const getYardStats = async (req, res) => {
  try {
    const { baseSeason, compSeason, deliveryPoint } = req.query;
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query);

    // Current Stats Query
    const [[currRow]] = await pool.query(
      `SELECT
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
        SUM(CASE WHEN \`MiddleBrix\` > 18 THEN 1 ELSE 0 END)             AS countBrixGt18,
        ROUND(
          SUM(CASE WHEN \`MiddleBrix\` > 18 THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0) * 100, 1)                                AS pctBrixGt18
      FROM \`brix_yard_sampling\`
      ${clause}`,
      params,
    );

    // Previous Stats Query — full comparison season window (Season vs Season)
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
      if (deliveryPoint && deliveryPoint !== 'All') {
        prevConditions.push('`DeliveryPoint` = ?');
        prevParams.push(deliveryPoint);
      }

      if (prevConditions.length) {
        const [[pRow]] = await pool.query(
          `SELECT
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
            SUM(CASE WHEN \`MiddleBrix\` > 18 THEN 1 ELSE 0 END)             AS countBrixGt18,
            ROUND(
              SUM(CASE WHEN \`MiddleBrix\` > 18 THEN 1 ELSE 0 END)
              / NULLIF(COUNT(*), 0) * 100, 1)                                AS pctBrixGt18
          FROM \`brix_yard_sampling\`
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
      avgBrix: mk(currRow.avgBrix, prevRow?.avgBrix),
      pctDiseased: mk(currRow.pctDiseased, prevRow?.pctDiseased, { lowerBetter: true }),
      pctStale: mk(currRow.pctStale, prevRow?.pctStale, { lowerBetter: true }),
      pctAffected: mk(currRow.pctAffected, prevRow?.pctAffected, { lowerBetter: true }),
      pctBrixGt18: mk(currRow.pctBrixGt18, prevRow?.pctBrixGt18),
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

    const [[maxDateRes]] = await pool.query(`SELECT MAX(\`Date\`) AS maxDate FROM \`brix_yard_sampling\``);

    res.json({
      stats,
      hasCompare,
      compSeason: compSeason || null,
      availableSeasons,
      seasonMapping,
      dateRange: { maxDate: maxDateRes.maxDate }
    });
  } catch (err) {
    console.error('[bi/brix-yard/stats]', err);
    res.status(500).json({ message: 'Could not load stats.' });
  }
};

// ─── GET /api/bi/brix-yard/brix-trend ───────────────────────────
// Daily grouped data for the combo chart.
// Power BI visuals:
//   Bars  = MidBrix>18 (count per day)
//   Line  = AVERAGE(MiddleBrix) per day  (secondary Y-axis, min 16)
const getYardBrixTrend = async (req, res) => {
  try {
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query);

    const [rows] = await pool.query(
      `SELECT
        \`Date\`                                                           AS date,
        COUNT(*)                                                           AS totalSamples,
        SUM(CASE WHEN \`MiddleBrix\` > 18 THEN 1 ELSE 0 END)             AS countAbove18,
        ROUND(AVG(\`MiddleBrix\`), 2)                                     AS avgBrix
      FROM \`brix_yard_sampling\`
      ${clause}
      GROUP BY \`Date\`
      ORDER BY \`Date\` ASC`,
      params,
    );

    res.json(rows);
  } catch (err) {
    console.error('[bi/brix-yard/brix-trend]', err);
    res.status(500).json({ message: 'Could not load trend data.' });
  }
};

// ─── GET /api/bi/brix-yard/by-vehicle ───────────────────────────
// Average Middle Brix % by Vehicle Type (Bar Chart).
// Power BI: Category=VehicleType, Y=AVERAGE(MiddleBrix), sorted descending
const getYardByVehicle = async (req, res) => {
  try {
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query);

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

    res.json(rows);
  } catch (err) {
    console.error('[bi/brix-yard/by-vehicle]', err);
    res.status(500).json({ message: 'Could not load vehicle data.' });
  }
};

// ─── GET /api/bi/brix-yard/condition-distribution ───────────────
// Consignment Condition distribution (Pie Chart).
// Power BI filter: WHERE Affected = 'No'  (DiseasedCane='No' AND StaleCane='No')
// Power BI: Category=Condition, Values=COUNT(Condition)
const getYardConditionDist = async (req, res) => {
  try {
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query);

    // Merge existing WHERE with the "exclude affected" filter
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

    res.json(rows);
  } catch (err) {
    console.error('[bi/brix-yard/condition-distribution]', err);
    res.status(500).json({ message: 'Could not load condition data.' });
  }
};

// ─── GET /api/bi/brix-yard/center-wise ──────────────────────────
// Pivot Table: Center (Center/Village Name) × ConsignmentConditions count.
// Power BI: Rows=Centers.CenterName, Cols=Condition, Values=COUNT(Condition)
const getYardCenterWise = async (req, res) => {
  try {
    const { clause, params, effectiveFrom, effectiveTo } = await buildWhere(req.query, 'y');

    const [rows] = await pool.query(
      `SELECT
        COALESCE(
          MAX(p1.centre_name),
          MAX(p2.purchsecentrename),
          MAX(p3.village_name),
          MAX(p4.villagename),
          CASE
            WHEN y.\`VillageOrCenterCode\` IS NULL OR TRIM(y.\`VillageOrCenterCode\`) = '' OR y.\`VillageOrCenterCode\` = '0' THEN 'GATE'
            WHEN y.\`VillageOrCenterCode\` REGEXP '^[0-9]+(\\\\.[0-9]+)?$' THEN CONCAT('Center #', TRIM(y.\`VillageOrCenterCode\`))
            ELSE TRIM(y.\`VillageOrCenterCode\`)
          END
        )                                                                 AS center,
        SUM(CASE WHEN y.\`ConsignmentConditions\` = 'Clean'      THEN 1 ELSE 0 END) AS Clean,
        SUM(CASE WHEN y.\`ConsignmentConditions\` = 'Dry Leaves' THEN 1 ELSE 0 END) AS DryLeaves,
        SUM(CASE WHEN y.\`ConsignmentConditions\` = 'Muddy'      THEN 1 ELSE 0 END) AS Muddy,
        SUM(CASE WHEN y.\`ConsignmentConditions\` = 'Roots'      THEN 1 ELSE 0 END) AS Roots,
        COUNT(*)                                                         AS Total
      FROM \`brix_yard_sampling\` y
      LEFT JOIN (
        SELECT DISTINCT \`centre_code\`, \`centre_name\`
        FROM \`purchy_grower_summary\`
        WHERE \`centre_name\` IS NOT NULL AND \`centre_name\` != ''
      ) p1 ON y.\`VillageOrCenterCode\` = p1.\`centre_code\`
      LEFT JOIN (
        SELECT DISTINCT \`purchsecentre\`, \`purchsecentrename\`
        FROM \`purchy_supply\`
        WHERE \`purchsecentrename\` IS NOT NULL AND \`purchsecentrename\` != ''
      ) p2 ON y.\`VillageOrCenterCode\` = p2.\`purchsecentre\`
      LEFT JOIN (
        SELECT DISTINCT \`village_code\`, \`village_name\`
        FROM \`purchy_grower_summary\`
        WHERE \`village_name\` IS NOT NULL AND \`village_name\` != ''
      ) p3 ON y.\`VillageOrCenterCode\` = p3.\`village_code\`
      LEFT JOIN (
        SELECT DISTINCT \`villagecode\`, \`villagename\`
        FROM \`purchy_supply\`
        WHERE \`villagename\` IS NOT NULL AND \`villagename\` != ''
      ) p4 ON y.\`VillageOrCenterCode\` = p4.\`villagecode\`
      ${clause}
      GROUP BY y.\`VillageOrCenterCode\`
      ORDER BY Total DESC`,
      params,
    );

    res.json(rows);
  } catch (err) {
    console.error('[bi/brix-yard/center-wise]', err);
    res.status(500).json({ message: 'Could not load center data.' });
  }
};

// ─── GET /api/bi/brix-yard/delivery-points ──────────────────────
// List of distinct delivery points for the slicer filter
const getYardDeliveryPoints = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT DISTINCT \`DeliveryPoint\` AS deliveryPoint
       FROM \`brix_yard_sampling\`
       WHERE \`DeliveryPoint\` IS NOT NULL AND \`DeliveryPoint\` != ''
       ORDER BY \`DeliveryPoint\` ASC`,
    );
    res.json(rows.map((r) => r.deliveryPoint));
  } catch (err) {
    console.error('[bi/brix-yard/delivery-points]', err);
    res.status(500).json({ message: 'Could not load delivery points.' });
  }
};

// ─── GET /api/bi/brix-yard/table-data ──────────────────────────
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
      ORDER BY \`Date\` DESC
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
  getYardBrixTrend,
  getYardByVehicle,
  getYardConditionDist,
  getYardCenterWise,
  getYardDeliveryPoints,
  getYardTableData,
};
