const { sendServerError, MSG } = require('../utils/httpError');
const { canAccessForm } = require('./form.controller');
const growerPerformance = require('../services/purchy/growerPerformanceService');
const purchyDishonour = require('../services/purchy/purchyDishonourService');
const purchyDishonourDrilldown = require('../services/purchy/purchyDishonourDrilldownService');
const purchyStaffDrilldown = require('../services/purchy/purchyStaffDrilldownService');
const purchyFailureDate = require('../services/purchy/purchyFailureDateService');

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
    const data = await growerPerformance.getFilterOptions();
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getPurchyFilters', err, MSG.LOAD);
  }
}

async function getGrowerPerformanceSummary(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const rows = await growerPerformance.getSummary(req.query);
    res.json({ rows });
  } catch (err) {
    sendServerError(res, 'getGrowerPerformanceSummary', err, MSG.LOAD);
  }
}

async function getGrowerPerformanceDetail(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await growerPerformance.getDetail(req.query);
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getGrowerPerformanceDetail', err, MSG.LOAD);
  }
}

async function getPurchyDishonourKpis(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await purchyDishonour.getKpis(req.query);
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getPurchyDishonourKpis', err, MSG.LOAD);
  }
}

async function getPurchyDishonourDetail(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await purchyDishonour.getDetail(req.query);
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getPurchyDishonourDetail', err, MSG.LOAD);
  }
}

async function getPurchyDishonourDrilldown(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await purchyDishonourDrilldown.getDishonourDrilldown(req.query);
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getPurchyDishonourDrilldown', err, MSG.LOAD);
  }
}

async function getPurchyStaffDrilldown(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await purchyStaffDrilldown.getStaffDrilldown(req.query);
    res.json(data);
  } catch (err) {
    sendServerError(res, 'getPurchyStaffDrilldown', err, MSG.LOAD);
  }
}

async function getPurchyFailureDateDrilldown(req, res) {
  try {
    if (!(await requirePurchyAccess(req, res))) return;
    const data = await purchyFailureDate.getFailureDateDrilldown(req.query);
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
  getPurchyFailureDateDrilldown,
};
