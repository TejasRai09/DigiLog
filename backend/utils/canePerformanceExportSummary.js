/**
 * Season summary tables for the Cane Performance export.
 * Each builder reads one tab's API payload (getMysqlCanePerformanceData) and returns
 * stacked sections: { title, headers, rows }. Every numeric header carries its unit.
 */

const CANE_EXPORT_TABS = [
  { id: 'procurement', label: 'Procurement Summary' },
  { id: 'gate1', label: 'Gate 1' },
  { id: 'gate2', label: 'Gate 2' },
  { id: 'center-purchase', label: 'Center Purchase' },
  { id: 'vehicle-handling', label: 'Vehicle Handling' },
  { id: 'vehicle-holding', label: 'Vehicle Holding' },
  { id: 'vehicle-holding2', label: 'Vehicle Holding 2' },
  { id: 'truck-transit', label: 'Truck Transit' },
  { id: 'truck-holding', label: 'Truck Holding' },
];

const MODE_ORDER = ['18 QCART', '36 QTROLLY', '45 QTROLLY', '63 QTROLLY', '99 QTROLLY', '99 QTRUCK'];
const QTLS = '(Qtls)';
const HRS = '(Hrs)';
const NOS = '(Nos.)';

function num(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Integers stay integers, other values keep 4 decimal places; blanks stay null. */
function cellNum(v) {
  if (v == null || v === '') return null;
  const x = Number(v);
  if (!Number.isFinite(x)) return null;
  if (Number.isInteger(x)) return x;
  return Math.round(x * 10000) / 10000;
}

function isoDate(v) {
  if (!v) return '';
  const s = String(v);
  const match = s.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : s.slice(0, 10);
}

function orderModes(modes) {
  const set = new Set([...(modes || [])].filter(Boolean));
  const known = MODE_ORDER.filter((mode) => set.has(mode));
  const rest = [...set].filter((mode) => !MODE_ORDER.includes(mode)).sort();
  return [...known, ...rest];
}

function byMode(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    if (row?.mode) map.set(row.mode, row);
  });
  return map;
}

function sumOf(rows, key) {
  return (rows || []).reduce((sum, row) => sum + num(row?.[key]), 0);
}

function weightedAvg(rows, valueKey, weightKey) {
  const weight = sumOf(rows, weightKey);
  if (!weight) return 0;
  const total = (rows || []).reduce((sum, row) => sum + num(row?.[valueKey]) * num(row?.[weightKey]), 0);
  return total / weight;
}

function meanPositive(values) {
  const list = (values || []).map(num).filter((v) => v > 0);
  if (!list.length) return null;
  return list.reduce((sum, v) => sum + v, 0) / list.length;
}

function meanAll(values) {
  const list = (values || []).filter((v) => v != null && v !== '').map(num);
  if (!list.length) return null;
  return list.reduce((sum, v) => sum + v, 0) / list.length;
}

function meanOverrun(list) {
  if (!list?.length) return null;
  return list.reduce((sum, row) => sum + num(row.avgOverrun), 0) / list.length;
}

function section(title, headers, rows) {
  return { title, headers, rows };
}

/** One row with a column per KPI, so each KPI header carries its own unit. */
function kpiSection(metrics) {
  const row = {};
  metrics.forEach((metric) => {
    row[metric.label] = cellNum(metric.value);
  });
  return section('KPIs', metrics.map((metric) => metric.label), [row]);
}

/** One row per date, one column per mode present in the data. */
function pivotDaily(rows, valueKey, unit) {
  const modes = orderModes((rows || []).map((row) => row.mode));
  const byDate = new Map();
  (rows || []).forEach((row) => {
    const date = isoDate(row.date);
    if (!date) return;
    if (!byDate.has(date)) byDate.set(date, { Date: date });
    byDate.get(date)[`${row.mode || 'Unknown'} ${unit}`] = cellNum(row[valueKey]);
  });
  const dataRows = [...byDate.values()].sort((a, b) => String(a.Date).localeCompare(String(b.Date)));
  return { headers: ['Date', ...modes.map((mode) => `${mode} ${unit}`)], rows: dataRows };
}

function dailyTotal(rows, label) {
  const out = (rows || [])
    .map((row) => ({ Date: isoDate(row.date), [label]: cellNum(row.qty) }))
    .filter((row) => row.Date)
    .sort((a, b) => a.Date.localeCompare(b.Date));
  return { headers: ['Date', label], rows: out };
}

/** `columns`: [header, valueFn(mode)] pairs after the leading Mode column. */
function modeTable(title, modes, columns) {
  const headers = ['Mode', ...columns.map(([header]) => header)];
  const rows = modes.map((mode) => {
    const row = { Mode: mode };
    columns.forEach(([header, value]) => {
      row[header] = value(mode);
    });
    return row;
  });
  return section(title, headers, rows);
}

function buildProcurement(data) {
  const kpis = data?.kpis || {};
  const gate = data?.gateYard || [];
  const center = (data?.procurementFlow || []).filter((row) => num(row.isCenter) === 1);
  const mill = data?.gateMill || [];

  const gateModes = [...orderModes(gate.map((row) => row.mode)), 'Total'];
  const centerModes = [...orderModes(center.map((row) => row.mode)), 'Total'];
  const millModes = [...orderModes(mill.map((row) => row.mode)), 'Total'];

  const gateMap = new Map([...byMode(gate), ['Total', {
    vehicles: sumOf(gate, 'vehicles'),
    cane: sumOf(gate, 'cane'),
    avgYardHrs: weightedAvg(gate, 'avgYardHrs', 'vehicles'),
    devOver8H: sumOf(gate, 'devOver8H'),
  }]]);
  const centerMap = new Map([...byMode(center), ['Total', {
    trips: sumOf(center, 'trips'),
    cane: sumOf(center, 'cane'),
    avgCenterWait: weightedAvg(center, 'avgCenterWait', 'trips'),
  }]]);
  const millMap = new Map([...byMode(mill), ['Total', {
    avgDongaHrs: weightedAvg(mill, 'avgDongaHrs', 'vehicles'),
    devOver05H: sumOf(mill, 'devOver05H'),
  }]]);
  const from = (map, key) => (mode) => cellNum(map.get(mode)?.[key]);

  return [
    kpiSection([
      { label: `Total Trips ${NOS}`, value: kpis.totalChallan },
      { label: `Avg Transit Time ${HRS}`, value: kpis.truckTransit },
      { label: `Truck Holding ${HRS}`, value: kpis.truckHolding },
      { label: `Waiting Time ${HRS}`, value: kpis.yardWaiting },
      { label: `Cane Holding Time ${HRS}`, value: kpis.caneHolding },
      { label: `Time at Donga ${HRS}`, value: kpis.waCane },
    ]),
    modeTable('Gate Vehicles', gateModes, [
      [`Vehicles ${NOS}`, from(gateMap, 'vehicles')],
      [`Cane ${QTLS}`, from(gateMap, 'cane')],
      [`Time ${HRS}`, from(gateMap, 'avgYardHrs')],
    ]),
    modeTable('Center Vehicles', centerModes, [
      [`Vehicles ${NOS}`, from(centerMap, 'trips')],
      [`Cane ${QTLS}`, from(centerMap, 'cane')],
      [`Time ${HRS}`, from(centerMap, 'avgCenterWait')],
    ]),
    modeTable('Yard', gateModes, [
      [`Avg Time ${HRS}`, from(gateMap, 'avgYardHrs')],
      [`Dev. >8 Hrs ${NOS}`, from(gateMap, 'devOver8H')],
    ]),
    modeTable('Mill Premise', millModes, [
      [`Avg Time ${HRS}`, from(millMap, 'avgDongaHrs')],
      [`Dev. >0.5 Hrs ${NOS}`, from(millMap, 'devOver05H')],
    ]),
    modeTable('Center Holding', centerModes, [
      [`Holding Time ${HRS}`, from(centerMap, 'avgCenterWait')],
    ]),
  ];
}

function overrunByModeTable(rows) {
  const current = byMode(rows);
  const modes = orderModes((rows || []).map((row) => row.mode));
  return modeTable('Overrun by Mode', modes, [
    [`Avg Overrun ${QTLS}`, (mode) => cellNum(current.get(mode)?.avgOverrun)],
  ]);
}

function buildGate1(data) {
  const sidebar = data?.sidebar || {};
  const purchase = dailyTotal(data?.trendData, `Cane Purchased ${QTLS}`);
  const overrun = pivotDaily(data?.overrunTrend, 'avgOverrun', QTLS);

  return [
    kpiSection([
      { label: `Total Cane Purchased ${QTLS}`, value: sidebar.totalCanePurchased },
      { label: `No. of Parchy ${NOS}`, value: sidebar.noOfPurchy },
      { label: `Avg Parchy Size ${QTLS}`, value: sidebar.avgPurchySize },
      { label: `Avg Parchy Overrun ${QTLS}`, value: meanOverrun(data?.overruns) },
    ]),
    section(
      'Purchase Split - Modewise',
      ['Mode', `Cane Qty ${QTLS}`, `No. of Parchy ${NOS}`],
      (data?.modeData || []).map((row) => ({
        Mode: row.mode,
        [`Cane Qty ${QTLS}`]: cellNum(row.caneQty),
        [`No. of Parchy ${NOS}`]: cellNum(row.purchy),
      })),
    ),
    section('Cane Purchase Trend', purchase.headers, purchase.rows),
    section('Parchi Overrun Trend', overrun.headers, overrun.rows),
    overrunByModeTable(data?.overruns),
  ];
}

function buildGate2(data) {
  const gate = data?.gateYard || [];
  const current = byMode(gate);
  const modes = orderModes(gate.map((row) => row.mode));
  const holding = pivotDaily(data?.yardHoldingTrend, 'holdingHrs', HRS);
  const exceedTrend = pivotDaily(data?.yardExceedTrend, 'exceedCount', NOS);
  const from = (key) => (mode) => cellNum(current.get(mode)?.[key]);

  return [
    kpiSection([
      { label: `Total Vehicles ${NOS}`, value: sumOf(gate, 'vehicles') },
      { label: `Avg Yard Holding ${HRS}`, value: meanPositive(gate.map((row) => row.avgYardHrs)) },
      {
        label: `Max Yard Holding ${HRS}`,
        value: gate.length ? Math.max(...gate.map((row) => num(row.maxYardHrs))) : null,
      },
      { label: `Vehicles Exceeding >8 Hrs ${NOS}`, value: sumOf(gate, 'devOver8H') },
    ]),
    modeTable('Yard Holding by Mode', modes, [
      [`Vehicles ${NOS}`, from('vehicles')],
      [`Min Yard Holding ${HRS}`, from('minYardHrs')],
      [`Avg Yard Holding ${HRS}`, from('avgYardHrs')],
      [`Max Yard Holding ${HRS}`, from('maxYardHrs')],
      [`Vehicles Exceeding >8 Hrs ${NOS}`, from('devOver8H')],
    ]),
    section('Average Yard Holding Time', holding.headers, holding.rows),
    section('Vehicles Exceeding Standard Holding Time', exceedTrend.headers, exceedTrend.rows),
  ];
}

function buildCenterPurchase(data) {
  const sidebar = data?.centerSidebar || {};
  const purchase = dailyTotal(data?.centerPurchaseTrend, `Cane Purchased ${QTLS}`);
  const overrun = pivotDaily(data?.centerOverrunTrend, 'avgOverrun', QTLS);
  const centerHeaders = ['Center', `Trips ${NOS}`, `Cane Purchased ${QTLS}`, `Avg Parchi Size ${QTLS}`];
  const centerRows = (rows) => (rows || []).map((row) => ({
    Center: row.c,
    [centerHeaders[1]]: cellNum(row.trips),
    [centerHeaders[2]]: cellNum(row.cane),
    [centerHeaders[3]]: cellNum(row.avgParchi),
  }));

  return [
    kpiSection([
      { label: `Cane Purchased ${QTLS}`, value: sidebar.totalCanePurchased },
      { label: `No. of Purchy ${NOS}`, value: sidebar.noOfPurchy },
      { label: `Avg Parchi Size ${QTLS}`, value: sidebar.avgParchiSize },
      { label: `Trips C to G ${NOS}`, value: sidebar.trips },
      { label: `Avg Parchi Overrun ${QTLS}`, value: meanOverrun(data?.cntOverruns) },
    ]),
    overrunByModeTable(data?.cntOverruns),
    section(
      'Purchase Split - Modewise',
      ['Mode', `Cane Qty ${QTLS}`, `No. of Purchy ${NOS}`],
      (data?.centerModePie || []).map((row) => ({
        Mode: row.mode,
        [`Cane Qty ${QTLS}`]: cellNum(row.caneQty),
        [`No. of Purchy ${NOS}`]: cellNum(row.purchy),
      })),
    ),
    section('Cane Purchase Trend', purchase.headers, purchase.rows),
    section('Parchi Overrun Trend', overrun.headers, overrun.rows),
    section('Top 10 Centers - Cane Purchase', centerHeaders, centerRows(data?.topCenters)),
    section('Bottom 10 Centers - Cane Purchase', centerHeaders, centerRows(data?.bottomCenters)),
  ];
}

function buildVehicleHandling(data) {
  const trend = pivotDaily(data?.vehicleHandlingTrend, 'vehicles', NOS);
  const modeColumns = [
    ['18 QCART', 'm18'],
    ['36 QTROLLY', 'm36'],
    ['45 QTROLLY', 'm45'],
    ['63 QTROLLY', 'm63'],
    ['Total', 'total'],
  ].map(([label, key]) => [`${label} ${NOS}`, key]);
  const centerHeaders = ['Center', ...modeColumns.map(([header]) => header)];
  const centerRows = (rows) => (rows || []).map((row) => {
    const out = { Center: row.c };
    modeColumns.forEach(([header, key]) => {
      out[header] = cellNum(row[key]);
    });
    return out;
  });

  return [
    kpiSection([
      { label: `Vehicles Handled ${NOS}`, value: data?.centerSidebar?.noOfPurchy },
    ]),
    section(
      'Vehicles by Mode',
      ['Mode', `Vehicles ${NOS}`],
      (data?.centerVehiclesByMode || []).map((row) => ({ Mode: row.mode, [`Vehicles ${NOS}`]: cellNum(row.vehicles) })),
    ),
    section('Vehicle Handling Trend (Mode wise)', trend.headers, trend.rows),
    section('Centers with Most Vehicle Handled (Top 10)', centerHeaders, centerRows(data?.topCentersVehicles)),
    section('Centers with Least Vehicle Handled (Top 10)', centerHeaders, centerRows(data?.bottomCentersVehicles)),
  ];
}

function buildVehicleHolding(data) {
  const flow = (data?.procurementFlow || []).filter((row) => row?.mode);
  const current = byMode(flow);
  const modes = orderModes(flow.map((row) => row.mode));
  const trend = pivotDaily(data?.holdingTrend, 'holdingHrs', HRS);
  const scatterHeaders = ['Center', 'Mode', `Holding Time ${HRS}`, `Vehicles ${NOS}`];
  const scatter = [...(data?.scatterData || [])]
    .map((row) => ({
      Center: row.center,
      Mode: row.mode,
      [scatterHeaders[2]]: cellNum(row.h),
      [scatterHeaders[3]]: cellNum(row.v),
    }))
    .sort((a, b) => String(a.Center).localeCompare(String(b.Center)) || String(a.Mode).localeCompare(String(b.Mode)));

  return [
    kpiSection([
      { label: `Avg Holding Time ${HRS}`, value: meanAll(flow.map((row) => row.avgCenterWait)) },
    ]),
    modeTable('Holding by Mode', modes, [
      [`Holding Time ${HRS}`, (mode) => cellNum(current.get(mode)?.avgCenterWait)],
      [`Trips ${NOS}`, (mode) => cellNum(current.get(mode)?.trips)],
    ]),
    section('Avg Holding Time at Centers - Trend', trend.headers, trend.rows),
    section('Vehicle vs Center Holding Time', scatterHeaders, scatter),
  ];
}

function buildLogistics(title, rows, columns) {
  const list = (rows || [])
    .map((row) => ({
      name: row.center || '',
      time: num(row.time),
      volume: num(row.volume),
      trips: num(row.trips),
    }))
    .filter((row) => row.name)
    .sort((a, b) => a.time - b.time || String(a.name).localeCompare(String(b.name)));
  const avg = list.length ? list.reduce((sum, row) => sum + row.time, 0) / list.length : null;
  const volume = list.reduce((sum, row) => sum + row.volume, 0);
  const headers = ['Rank', 'Center', columns.time, columns.volume];
  if (columns.trips) headers.push(columns.trips);
  const ranked = list.map((row, index) => {
    const out = {
      Rank: index + 1,
      Center: row.name,
      [columns.time]: cellNum(row.time),
      [columns.volume]: cellNum(row.volume),
    };
    if (columns.trips) out[columns.trips] = cellNum(row.trips);
    return out;
  });

  return [
    kpiSection([
      { label: columns.countLabel, value: list.length },
      { label: columns.avgLabel, value: avg },
      { label: columns.volumeLabel, value: volume },
    ]),
    section(title, headers, ranked),
  ];
}

function buildTabSections(tabId, data) {
  switch (tabId) {
    case 'procurement':
      return buildProcurement(data);
    case 'gate1':
      return buildGate1(data);
    case 'gate2':
      return buildGate2(data);
    case 'center-purchase':
      return buildCenterPurchase(data);
    case 'vehicle-handling':
      return buildVehicleHandling(data);
    case 'vehicle-holding':
      return buildVehicleHolding(data);
    case 'vehicle-holding2':
      return buildLogistics(
        'Centers by Holding Time',
        (data?.holdingByCenter || []).map((row) => ({ center: row.center, time: row.holdingHrs, volume: row.vehicles })),
        {
          time: `Holding Time ${HRS}`,
          volume: `Vehicles ${NOS}`,
          countLabel: `Total Active Centers ${NOS}`,
          avgLabel: `Avg Turnaround Time ${HRS}`,
          volumeLabel: `Total Fleet Processed ${NOS}`,
        },
      );
    case 'truck-transit':
      return buildLogistics(
        'Centers by Transit Time',
        (data?.transitByCenter || []).map((row) => ({
          center: row.center,
          time: row.transitHrs,
          volume: row.challanQty,
          trips: row.trips,
        })),
        {
          time: `Transit Time ${HRS}`,
          volume: `Challan Qty ${QTLS}`,
          trips: `Trips ${NOS}`,
          countLabel: `Total Centers ${NOS}`,
          avgLabel: `Avg Transit Duration ${HRS}`,
          volumeLabel: `Total Challan Volume ${QTLS}`,
        },
      );
    case 'truck-holding':
      return buildLogistics(
        'Centers by Truck Holding',
        (data?.truckHoldByCenter || []).map((row) => ({ center: row.center, time: row.holdingHrs, volume: row.challanQty })),
        {
          time: `Holding Time ${HRS}`,
          volume: `Challan Qty ${QTLS}`,
          countLabel: `Active Holding Yards ${NOS}`,
          avgLabel: `Avg Truck Holding Time ${HRS}`,
          volumeLabel: `Total Volume On Hold ${QTLS}`,
        },
      );
    default:
      return [];
  }
}

module.exports = { CANE_EXPORT_TABS, buildTabSections };
