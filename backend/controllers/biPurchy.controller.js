const { sendServerError, MSG } = require('../utils/httpError');
const { canAccessForm } = require('./form.controller');
const growerPerformance = require('../services/purchy/growerPerformanceService');
const purchyDishonour = require('../services/purchy/purchyDishonourService');
const purchyDishonourDrilldown = require('../services/purchy/purchyDishonourDrilldownService');
const purchyStaffDrilldown = require('../services/purchy/purchyStaffDrilldownService');
const purchyFailureDate = require('../services/purchy/purchyFailureDateService');
const { withPurchyCache } = require('../services/purchy/purchyResponseCache');

const FORM_KEY = 'bi_purchy_analysis';

async function requirePurchyAccess(req, res) {
  const ok = await canAccessForm(req.user, FORM_KEY);
  if (!ok) {
    res.status(403).json({ message: 'You do not have access to this dashboard.' });
    return false;
  }
  return true;
}

async function getPurchyFilters(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await withPurchyCache('filters', {}, () => growerPerformance.getFilterOptions());
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getPurchyFilters', err, MSG.LOAD);
  }
}

async function getGrowerPerformanceSummary(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const rows = await withPurchyCache('grower-summary', req.query, () => growerPerformance.getSummary(req.query));
    res.json({ rows });
  } catch (err) {
    sendServerError(res, 'getGrowerPerformanceSummary', err, MSG.LOAD);
  }
}

async function getGrowerPerformanceDetail(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await withPurchyCache('grower-detail', req.query, () => growerPerformance.getDetail(req.query));
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getGrowerPerformanceDetail', err, MSG.LOAD);
  }
}

async function getPurchyDishonourKpis(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await withPurchyCache('dishonour-kpis', req.query, () => purchyDishonour.getKpis(req.query));
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getPurchyDishonourKpis', err, MSG.LOAD);
  }
}

async function getPurchyDishonourDetail(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await withPurchyCache('dishonour-detail', req.query, () => purchyDishonour.getDetail(req.query));
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getPurchyDishonourDetail', err, MSG.LOAD);
  }
}

async function getPurchyDishonourDrilldown(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await withPurchyCache('dishonour-drilldown', req.query, () => purchyDishonourDrilldown.getDishonourDrilldown(req.query));
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getPurchyDishonourDrilldown', err, MSG.LOAD);
  }
}

async function getPurchyStaffDrilldown(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await withPurchyCache('staff-drilldown', req.query, () => purchyStaffDrilldown.getStaffDrilldown(req.query));
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getPurchyStaffDrilldown', err, MSG.LOAD);
  }
}

async function getPurchyStaffVarietyType(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await withPurchyCache('staff-variety-type', req.query, () => purchyStaffDrilldown.getVarietyTypeBreakdown(req.query));
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getPurchyStaffVarietyType', err, MSG.LOAD);
  }
}

async function getPurchyFailureDateDrilldown(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await withPurchyCache('failure-date', req.query, () => purchyFailureDate.getFailureDateDrilldown(req.query));
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getPurchyFailureDateDrilldown', err, MSG.LOAD);
  }
}

module.exports = {
  getPurchyFilters,
  getGrowerPerformanceSummary,
  getGrowerPerformanceDetail,
  getPurchyDishonourKpis,
  getPurchyDishonourDetail,
  getPurchyDishonourDrilldown,
  getPurchyStaffDrilldown,
  getPurchyStaffVarietyType,
  getPurchyFailureDateDrilldown,
};
