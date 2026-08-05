const { pool: mysqlPool } = require('../config/mysql');

const VALID_MODE = `sup_mod IN ('18 QCART','36 QTROLLY','45 QTROLLY','63 QTROLLY','99 QTROLLY','99 QTRUCK')`;
const GATE = `${VALID_MODE} AND v_code IS NOT NULL`;
const CENTER = `center IS NOT NULL AND center != ''`;

const GATE_OVERRUN = `CASE
  WHEN sup_mod = '18 QCART' THEN 18 WHEN sup_mod = '36 QTROLLY' THEN 36
  WHEN sup_mod = '45 QTROLLY' THEN 45 WHEN sup_mod = '63 QTROLLY' THEN 63
  WHEN sup_mod IN ('99 QTROLLY','99 QTRUCK') THEN 99 ELSE NULL END`;

const CNT_OVERRUN = `CASE
  WHEN transport_mode = '18 QCART' THEN 18 WHEN transport_mode = '36 QTROLLY' THEN 36
  WHEN transport_mode = '45 QTROLLY' THEN 45 WHEN transport_mode = '63 QTROLLY' THEN 63
  ELSE NULL END`;

/** In-memory cache: identical filter+tab responses reuse for CACHE_TTL_MS */
const CACHE_TTL_MS = 120_000;
const cache = new Map();
const filterCache = new Map();
const FILTER_TTL_MS = 300_000;

function norm(v) {
  if (v == null || v === '' || v === 'All' || v === 'all') return null;
  return String(v);
}

function gateWhere(filters) {
  const parts = [`m_date >= ?`, `m_date <= ?`, GATE];
  const params = [filters.fromDate, filters.toDate];
  if (filters.mode) {
    if (filters.mode === '99 QTROLLY' || filters.mode === '99 QTRUCK') {
      parts.push(`sup_mod IN ('99 QTROLLY','99 QTRUCK')`);
    } else {
      parts.push(`sup_mod = ?`);
      params.push(filters.mode);
    }
  }
  return { sql: parts.join(' AND '), params };
}

function cntWhere(filters, { requireCenter = true } = {}) {
  const parts = [`report_date >= ?`, `report_date <= ?`];
  const params = [filters.fromDate, filters.toDate];
  if (requireCenter) parts.push(CENTER);
  if (filters.mode) {
    if (filters.mode === '99 QTROLLY' || filters.mode === '99 QTRUCK') {
      parts.push(`transport_mode IN ('99 QTROLLY','99 QTRUCK')`);
    } else {
      parts.push(`transport_mode = ?`);
      params.push(filters.mode);
    }
  }
  if (filters.center) {
    parts.push(`center = ?`);
    params.push(filters.center);
  }
  if (filters.challan) {
    parts.push(`challan_no = ?`);
    params.push(filters.challan);
  }
  return { sql: parts.join(' AND '), params };
}

/** Which query packs each DigiLog tab needs */
const TAB_PACKS = {
  procurement: ['filters', 'kpis', 'procFlow', 'gateYard', 'gateMill'],
  gate1: ['filters', 'gateSidebar', 'gateCharts'],
  gate2: ['filters', 'gateYard'],
  'center-purchase': ['filters', 'centerSidebar', 'centerPurchase'],
  'vehicle-handling': ['filters', 'vehicleHandling'],
  'vehicle-holding': ['filters', 'vehicleHolding'],
  'vehicle-holding2': ['filters', 'holdingByCenter'],
  'truck-transit': ['filters', 'transit'],
  'truck-holding': ['filters', 'truckHold'],
  database: ['filters', 'dbRows'],
};

function packsForTab(tab) {
  if (!tab || tab === 'all') {
    return [
      'filters', 'kpis', 'procFlow', 'gateYard', 'gateMill', 'gateSidebar', 'gateCharts',
      'centerSidebar', 'centerPurchase', 'vehicleHandling', 'vehicleHolding',
      'holdingByCenter', 'transit', 'truckHold', 'dbRows',
    ];
  }
  return TAB_PACKS[tab] || TAB_PACKS.procurement;
}

async function runPack(name, ctx) {
  const { g, c, cAll, dateOnlyGate, dateOnlyCnt } = ctx;
  switch (name) {
    case 'filters': {
      const fKey = `${dateOnlyGate.params.join('|')}`;
      const fHit = filterCache.get(fKey);
      if (fHit && Date.now() - fHit.at < FILTER_TTL_MS) {
        return { filterOptions: fHit.data };
      }
      const [[modes], [centers]] = await Promise.all([
        mysqlPool.execute(
          `SELECT DISTINCT IFNULL(sup_mod,'Unknown') as mode FROM g_ctc WHERE ${dateOnlyGate.sql} ORDER BY mode`,
          dateOnlyGate.params
        ),
        mysqlPool.execute(
          `SELECT DISTINCT center FROM cnt_performance
           WHERE ${dateOnlyCnt.sql} AND center IS NOT NULL AND center != ''
           ORDER BY center`,
          dateOnlyCnt.params
        ),
      ]);
      const filterOptions = {
        modes: (modes || []).map((r) => r.mode).filter(Boolean),
        centers: (centers || []).map((r) => r.center).filter(Boolean),
      };
      filterCache.set(fKey, { at: Date.now(), data: filterOptions });
      return { filterOptions };
    }
    case 'kpis': {
      const [rows] = await mysqlPool.execute(
        `SELECT
          COUNT(DISTINCT challan_no) as totalChallan,
          IFNULL(AVG(yard_waiting_time), 0) as yardWaiting,
          IFNULL(AVG(unloading_time), 0) as dongaWait,
          IFNULL(AVG(truck_transit_time), 0) as truckTransit,
          IFNULL(AVG(truck_holding_time_center), 0) as truckHolding,
          IFNULL(AVG(holding_time_center), 0) as avgCenterWait,
          IFNULL(
            SUM(CASE WHEN cane_holding_time IS NOT NULL THEN cane_holding_time * cane_qty_qtls END)
            / NULLIF(SUM(CASE WHEN cane_holding_time IS NOT NULL THEN cane_qty_qtls END), 0)
          , 0) as caneHolding
        FROM cnt_performance WHERE ${c.sql}`,
        c.params
      );
      const r = rows[0] || {};
      return {
        kpis: {
          totalChallan: r.totalChallan || 0,
          yardWaiting: Number(r.yardWaiting || 0),
          waCane: Number(r.dongaWait || 0),
          truckTransit: Number(r.truckTransit || 0),
          truckHolding: Number(r.truckHolding || 0),
          caneHolding: Number(r.caneHolding || 0),
          avgCenterWait: Number(r.avgCenterWait || 0),
        },
      };
    }
    case 'procFlow': {
      const [rows] = await mysqlPool.execute(
        `SELECT IFNULL(transport_mode,'Unknown') as mode, 1 as isCenter,
          COUNT(purchy_no) as trips, COUNT(DISTINCT challan_no) as challans,
          SUM(cane_qty_qtls) as cane,
          IFNULL(AVG(holding_time_center),0) as avgCenterWait,
          IFNULL(AVG(truck_transit_time),0) as avgTravelToYard,
          IFNULL(AVG(yard_waiting_time),0) as avgYardWait,
          IFNULL(MIN(yard_waiting_time),0) as minYardWait,
          IFNULL(MAX(yard_waiting_time),0) as maxYardWait,
          IFNULL(AVG(unloading_time),0) as avgDongaWait,
          0 as devGateYard, 0 as devCenterYard, 0 as devMill
        FROM cnt_performance WHERE ${c.sql}
        GROUP BY transport_mode`,
        c.params
      );
      return { procurementFlow: rows };
    }
    case 'gateYard': {
      const [rows] = await mysqlPool.execute(
        `SELECT IFNULL(sup_mod,'Unknown') as mode, COUNT(purchyno) as vehicles,
          SUM(purchase_qtl) as cane,
          AVG(yard_holding_time) as avgYardHrs,
          MIN(yard_holding_time) as minYardHrs,
          MAX(yard_holding_time) as maxYardHrs,
          SUM(CASE WHEN yard_holding_time > 8 THEN 1 ELSE 0 END) as devOver8H
        FROM g_ctc WHERE ${g.sql}
        GROUP BY sup_mod ORDER BY vehicles DESC`,
        g.params
      );
      return {
        gateYard: rows,
        vehiclesByMode: rows.map((r) => ({ mode: r.mode, vehicles: r.vehicles })),
      };
    }
    case 'gateMill': {
      const [rows] = await mysqlPool.execute(
        `SELECT IFNULL(sup_mod,'Unknown') as mode, COUNT(purchyno) as vehicles,
          AVG(unloading_time) as avgDongaHrs,
          SUM(CASE WHEN unloading_time > 0.5 THEN 1 ELSE 0 END) as devOver05H
        FROM g_ctc WHERE ${g.sql}
        GROUP BY sup_mod ORDER BY mode`,
        g.params
      );
      return { gateMill: rows };
    }
    case 'gateSidebar': {
      const [[sidebar], [overruns]] = await Promise.all([
        mysqlPool.execute(
          `SELECT SUM(purchase_qtl) as totalCanePurchased, COUNT(purchyno) as noOfPurchy,
            IFNULL(SUM(purchase_qtl)/NULLIF(COUNT(purchyno),0),0) as avgPurchySize
          FROM g_ctc WHERE ${g.sql}`,
          g.params
        ),
        mysqlPool.execute(
          `SELECT IFNULL(sup_mod,'Unknown') as mode,
            AVG(purchase_qtl) - ${GATE_OVERRUN} as avgOverrun
          FROM g_ctc WHERE purchase_qtl > 0 AND ${g.sql}
          GROUP BY sup_mod`,
          g.params
        ),
      ]);
      return {
        sidebar: {
          totalCanePurchased: Number(sidebar[0]?.totalCanePurchased || 0),
          noOfPurchy: sidebar[0]?.noOfPurchy || 0,
          avgPurchySize: Number(sidebar[0]?.avgPurchySize || 0),
        },
        overruns,
      };
    }
    case 'gateCharts': {
      const [[modeData], [trendData], [overrunTrend]] = await Promise.all([
        mysqlPool.execute(
          `SELECT IFNULL(sup_mod,'Unknown') as mode, COUNT(purchyno) as purchy, SUM(purchase_qtl) as caneQty
          FROM g_ctc WHERE ${g.sql} GROUP BY sup_mod`,
          g.params
        ),
        mysqlPool.execute(
          `SELECT m_date as date, SUM(purchase_qtl) as qty
          FROM g_ctc WHERE m_date IS NOT NULL AND ${g.sql}
          GROUP BY m_date ORDER BY date`,
          g.params
        ),
        mysqlPool.execute(
          `SELECT m_date as date, IFNULL(sup_mod,'Unknown') as mode,
            AVG(purchase_qtl) - ${GATE_OVERRUN} as avgOverrun
          FROM g_ctc WHERE purchase_qtl > 0 AND ${g.sql}
          GROUP BY m_date, sup_mod ORDER BY date`,
          g.params
        ),
      ]);
      return { modeData, trendData, overrunTrend };
    }
    case 'centerSidebar': {
      const [[sidebar], [overruns]] = await Promise.all([
        mysqlPool.execute(
          `SELECT
            SUM(cane_qty_qtls) as totalCanePurchased,
            COUNT(purchy_no) as noOfPurchy,
            IFNULL(SUM(cane_qty_qtls)/NULLIF(COUNT(purchy_no),0),0) as avgParchiSize,
            COUNT(DISTINCT challan_no) as trips
          FROM cnt_performance WHERE ${c.sql}`,
          c.params
        ),
        mysqlPool.execute(
          `SELECT IFNULL(transport_mode,'Unknown') as mode,
            AVG(cane_qty_qtls) - ${CNT_OVERRUN} as avgOverrun
          FROM cnt_performance
          WHERE cane_qty_qtls > 0 AND transport_mode IS NOT NULL AND ${c.sql}
          GROUP BY transport_mode`,
          c.params
        ),
      ]);
      return {
        centerSidebar: {
          totalCanePurchased: Number(sidebar[0]?.totalCanePurchased || 0),
          noOfPurchy: sidebar[0]?.noOfPurchy || 0,
          avgParchiSize: Number(sidebar[0]?.avgParchiSize || 0),
          trips: sidebar[0]?.trips || 0,
        },
        cntOverruns: overruns,
      };
    }
    case 'centerPurchase': {
      const [[topCenters], [bottomCenters], [centerPurchaseTrend], [centerModePie], [centerOverrunTrend]] =
        await Promise.all([
          mysqlPool.execute(
            `SELECT IFNULL(center,'Unknown') as c, COUNT(purchy_no) as trips, SUM(cane_qty_qtls) as cane,
              IFNULL(SUM(cane_qty_qtls)/NULLIF(COUNT(purchy_no),0),0) as avgParchi
            FROM cnt_performance WHERE ${c.sql}
            GROUP BY center ORDER BY cane DESC LIMIT 10`,
            c.params
          ),
          mysqlPool.execute(
            `SELECT IFNULL(center,'Unknown') as c, COUNT(purchy_no) as trips, SUM(cane_qty_qtls) as cane,
              IFNULL(SUM(cane_qty_qtls)/NULLIF(COUNT(purchy_no),0),0) as avgParchi
            FROM cnt_performance WHERE ${c.sql}
            GROUP BY center ORDER BY cane ASC LIMIT 10`,
            c.params
          ),
          mysqlPool.execute(
            `SELECT report_date as date, SUM(cane_qty_qtls) as qty
            FROM cnt_performance WHERE ${c.sql}
            GROUP BY report_date ORDER BY date`,
            c.params
          ),
          mysqlPool.execute(
            `SELECT IFNULL(transport_mode,'Unknown') as mode,
              COUNT(purchy_no) as purchy, SUM(cane_qty_qtls) as caneQty
            FROM cnt_performance WHERE ${c.sql}
            GROUP BY transport_mode`,
            c.params
          ),
          mysqlPool.execute(
            `SELECT report_date as date, IFNULL(transport_mode,'Unknown') as mode,
              AVG(cane_qty_qtls) - ${CNT_OVERRUN} as avgOverrun
            FROM cnt_performance
            WHERE cane_qty_qtls > 0 AND transport_mode IS NOT NULL AND ${c.sql}
            GROUP BY report_date, transport_mode ORDER BY date`,
            c.params
          ),
        ]);
      return { topCenters, bottomCenters, centerPurchaseTrend, centerModePie, centerOverrunTrend };
    }
    case 'vehicleHandling': {
      const [[centerSidebar], [centerVehiclesByMode], [vehicleHandlingTrend], [topCentersVehicles], [bottomCentersVehicles]] =
        await Promise.all([
          mysqlPool.execute(
            `SELECT COUNT(purchy_no) as noOfPurchy FROM cnt_performance WHERE ${c.sql}`,
            c.params
          ),
          mysqlPool.execute(
            `SELECT IFNULL(transport_mode,'Unknown') as mode, COUNT(purchy_no) as vehicles
            FROM cnt_performance WHERE ${c.sql}
            GROUP BY transport_mode ORDER BY vehicles DESC`,
            c.params
          ),
          mysqlPool.execute(
            `SELECT report_date as date, IFNULL(transport_mode,'Unknown') as mode,
              COUNT(purchy_no) as vehicles
            FROM cnt_performance WHERE ${c.sql}
            GROUP BY report_date, transport_mode ORDER BY date`,
            c.params
          ),
          mysqlPool.execute(
            `SELECT IFNULL(center,'Unknown') as c,
              SUM(CASE WHEN transport_mode='18 QCART' THEN 1 ELSE 0 END) as m18,
              SUM(CASE WHEN transport_mode='36 QTROLLY' THEN 1 ELSE 0 END) as m36,
              SUM(CASE WHEN transport_mode='45 QTROLLY' THEN 1 ELSE 0 END) as m45,
              SUM(CASE WHEN transport_mode='63 QTROLLY' THEN 1 ELSE 0 END) as m63,
              COUNT(purchy_no) as total
            FROM cnt_performance WHERE ${c.sql}
            GROUP BY center ORDER BY total DESC LIMIT 10`,
            c.params
          ),
          mysqlPool.execute(
            `SELECT IFNULL(center,'Unknown') as c,
              SUM(CASE WHEN transport_mode='18 QCART' THEN 1 ELSE 0 END) as m18,
              SUM(CASE WHEN transport_mode='36 QTROLLY' THEN 1 ELSE 0 END) as m36,
              SUM(CASE WHEN transport_mode='45 QTROLLY' THEN 1 ELSE 0 END) as m45,
              SUM(CASE WHEN transport_mode='63 QTROLLY' THEN 1 ELSE 0 END) as m63,
              COUNT(purchy_no) as total
            FROM cnt_performance WHERE ${c.sql}
            GROUP BY center ORDER BY total ASC LIMIT 10`,
            c.params
          ),
        ]);
      return {
        centerSidebar: {
          noOfPurchy: centerSidebar[0]?.noOfPurchy || 0,
          totalCanePurchased: 0,
          avgParchiSize: 0,
          trips: 0,
        },
        centerVehiclesByMode,
        vehicleHandlingTrend,
        topCentersVehicles,
        bottomCentersVehicles,
      };
    }
    case 'vehicleHolding': {
      const [[procurementFlow], [holdingTrend], [scatterData]] = await Promise.all([
        mysqlPool.execute(
          `SELECT IFNULL(transport_mode,'Unknown') as mode, 1 as isCenter,
            COUNT(purchy_no) as trips,
            IFNULL(AVG(holding_time_center),0) as avgCenterWait
          FROM cnt_performance WHERE ${c.sql}
          GROUP BY transport_mode`,
          c.params
        ),
        mysqlPool.execute(
          `SELECT report_date as date, IFNULL(transport_mode,'Unknown') as mode,
            AVG(holding_time_center) as holdingHrs
          FROM cnt_performance WHERE ${c.sql}
          GROUP BY report_date, transport_mode ORDER BY date`,
          c.params
        ),
        mysqlPool.execute(
          `SELECT IFNULL(center,'Unknown') as center, IFNULL(transport_mode,'Unknown') as mode,
            AVG(holding_time_center) as h, COUNT(purchy_no) as v
          FROM cnt_performance WHERE ${c.sql}
          GROUP BY center, transport_mode`,
          c.params
        ),
      ]);
      return { procurementFlow, holdingTrend, scatterData };
    }
    case 'holdingByCenter': {
      const [rows] = await mysqlPool.execute(
        `SELECT IFNULL(center,'Unknown') as center,
          AVG(holding_time_center) as holdingHrs, COUNT(purchy_no) as vehicles
        FROM cnt_performance WHERE ${c.sql}
        GROUP BY center ORDER BY center`,
        c.params
      );
      return { holdingByCenter: rows };
    }
    case 'transit': {
      const [rows] = await mysqlPool.execute(
        `SELECT IFNULL(center,'Unknown') as center,
          AVG(truck_transit_time) as transitHrs,
          0 as dist,
          COUNT(DISTINCT challan_no) as trips,
          SUM(cane_qty_qtls) as challanQty
        FROM cnt_performance WHERE ${c.sql}
        GROUP BY center ORDER BY transitHrs DESC`,
        c.params
      );
      return { transitByCenter: rows };
    }
    case 'truckHold': {
      const [rows] = await mysqlPool.execute(
        `SELECT IFNULL(center,'Unknown') as center,
          AVG(truck_holding_time_center) as holdingHrs,
          COUNT(DISTINCT challan_no) as trips,
          SUM(cane_qty_qtls) as challanQty
        FROM cnt_performance WHERE ${c.sql}
        GROUP BY center ORDER BY holdingHrs DESC`,
        c.params
      );
      return { truckHoldByCenter: rows };
    }
    case 'dbRows': {
      const [rows] = await mysqlPool.execute(
        `SELECT purchy_no as purchyNo, IFNULL(center,'Gate') as center, grower, v_name as vehicle,
          cane_qty_qtls as caneQty, challan_no as challanNo, transport_mode as mode,
          report_date as arrival, yard_waiting_time as holding, unloading_time as truckH
        FROM cnt_performance WHERE ${cAll.sql}
        ORDER BY report_date DESC LIMIT 500`,
        cAll.params
      );
      return { dbRows: rows };
    }
    default:
      return {};
  }
}

const EMPTY = {
  filterOptions: { modes: [], centers: [] },
  modeData: [],
  trendData: [],
  kpis: {
    totalChallan: 0,
    yardWaiting: 0,
    waCane: 0,
    truckTransit: 0,
    truckHolding: 0,
    caneHolding: 0,
    avgCenterWait: 0,
  },
  sidebar: { totalCanePurchased: 0, noOfPurchy: 0, avgPurchySize: 0 },
  centerSidebar: { totalCanePurchased: 0, noOfPurchy: 0, avgParchiSize: 0, trips: 0 },
  overruns: [],
  cntOverruns: [],
  procurementFlow: [],
  gateYard: [],
  gateMill: [],
  topCenters: [],
  bottomCenters: [],
  topCentersVehicles: [],
  bottomCentersVehicles: [],
  dbRows: [],
  vehiclesByMode: [],
  overrunTrend: [],
  centerPurchaseTrend: [],
  centerModePie: [],
  centerOverrunTrend: [],
  vehicleHandlingTrend: [],
  centerVehiclesByMode: [],
  holdingByCenter: [],
  holdingTrend: [],
  scatterData: [],
  transitByCenter: [],
  truckHoldByCenter: [],
};

/**
 * MySQL queries aligned to Power BI.
 * opts.tab — DigiLog tab id; only runs needed query packs (much faster).
 * opts.tab = 'all' — full payload (legacy / verification).
 */
async function getMysqlCanePerformanceData(from, to, opts = {}) {
  const filters = {
    fromDate: from || '2000-01-01',
    toDate: to || '2100-01-01',
    mode: norm(opts.mode),
    center: norm(opts.center),
    challan: norm(opts.challan),
  };
  const tab = opts.tab || 'procurement';
  const pyFrom = norm(opts.pyFrom);
  const pyTo = norm(opts.pyTo);
  const cacheKey = JSON.stringify({ ...filters, tab, pyFrom, pyTo });

  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { ...hit.data, _cached: true };
  }

  const g = gateWhere(filters);
  const c = cntWhere(filters);
  const cAll = cntWhere(filters, { requireCenter: false });
  const dateOnlyGate = gateWhere({ ...filters, mode: null });
  const dateOnlyCnt = cntWhere({ ...filters, mode: null, center: null, challan: null });
  const ctx = { g, c, cAll, dateOnlyGate, dateOnlyCnt };

  const packs = packsForTab(tab);
  const t0 = Date.now();
  const parts = await Promise.all(packs.map((p) => runPack(p, ctx)));
  const data = { ...EMPTY };
  for (const part of parts) Object.assign(data, part);

  // Previous-year window (same MTD/QTD/YTD shifted −1 year) for % change badges
  if (pyFrom && pyTo) {
    const pyFilters = { ...filters, fromDate: pyFrom, toDate: pyTo };
    const pyG = gateWhere(pyFilters);
    const pyC = cntWhere(pyFilters);
    const pyCAll = cntWhere(pyFilters, { requireCenter: false });
    const pyDateOnlyGate = gateWhere({ ...pyFilters, mode: null });
    const pyDateOnlyCnt = cntWhere({ ...pyFilters, mode: null, center: null, challan: null });
    const pyCtx = {
      g: pyG,
      c: pyC,
      cAll: pyCAll,
      dateOnlyGate: pyDateOnlyGate,
      dateOnlyCnt: pyDateOnlyCnt,
    };
    // Skip expensive filter DISTINCT for prior — reuse current filterOptions
    const pyPacks = packs.filter((p) => p !== 'filters');
    const pyParts = await Promise.all(pyPacks.map((p) => runPack(p, pyCtx)));
    const prior = {};
    for (const part of pyParts) Object.assign(prior, part);
    data.prior = {
      from: pyFrom,
      to: pyTo,
      kpis: prior.kpis || EMPTY.kpis,
      sidebar: prior.sidebar || EMPTY.sidebar,
      centerSidebar: prior.centerSidebar || EMPTY.centerSidebar,
      overruns: prior.overruns || [],
      cntOverruns: prior.cntOverruns || [],
      procurementFlow: prior.procurementFlow || [],
    };
  }

  cache.set(cacheKey, { at: Date.now(), data });
  if (cache.size > 50) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now - v.at > CACHE_TTL_MS) cache.delete(k);
    }
  }

  console.log(`[cane-perf] tab=${tab} packs=${packs.length}${pyFrom ? '+py' : ''} ${Date.now() - t0}ms`);
  return data;
}

module.exports = { getMysqlCanePerformanceData, packsForTab };
