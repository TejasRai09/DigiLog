const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  getDistilleryOperationsBi,
  getMillingStoppagesBi,
  getMillingEquipmentTempBi,
  getMillingShredderBi,
  getMillingLubeRollerBi,
} = require('../controllers/bi.controller');
const { getBiSettings } = require('../controllers/biSettings.controller');
const {
  getPurchyFilters,
  getGrowerPerformanceSummary,
  getGrowerPerformanceDetail,
  getPurchyDishonourKpis,
  getPurchyDishonourDetail,
  getPurchyDishonourDrilldown,
  getPurchyStaffDrilldown,
  getPurchyFailureDateDrilldown,
} = require('../controllers/biPurchy.controller');

router.get('/settings', authenticate, getBiSettings);
router.get('/purchy/filters', authenticate, getPurchyFilters);
router.get('/purchy/grower-performance/summary', authenticate, getGrowerPerformanceSummary);
router.get('/purchy/grower-performance/detail', authenticate, getGrowerPerformanceDetail);
router.get('/purchy/dishonour/kpis', authenticate, getPurchyDishonourKpis);
router.get('/purchy/dishonour/detail', authenticate, getPurchyDishonourDetail);
router.get('/purchy/dishonour-drilldown', authenticate, getPurchyDishonourDrilldown);
router.get('/purchy/staff-drilldown', authenticate, getPurchyStaffDrilldown);
router.get('/purchy/failure-by-date', authenticate, getPurchyFailureDateDrilldown);
router.get('/distillery-operations', authenticate, getDistilleryOperationsBi);
router.get('/milling-operations', authenticate, getMillingStoppagesBi);
router.get('/milling-equipment-temp', authenticate, getMillingEquipmentTempBi);
router.get('/milling-shredder', authenticate, getMillingShredderBi);
router.get('/milling-lube-roller', authenticate, getMillingLubeRollerBi);

module.exports = router;
