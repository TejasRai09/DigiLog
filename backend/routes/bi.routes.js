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
const {
  getYardStats,
  getYardBrixTrend,
  getYardByVehicle,
  getYardConditionDist,
  getYardCenterWise,
  getYardDeliveryPoints,
  getYardTableData,
} = require('../controllers/biBrixYard.controller');
const {
  getFieldStats,
  getFieldBrixTrend,
  getFieldConditionTrend,
  getFieldCropCondition,
  getFieldBySoilType,
  getFieldByLandType,
  getFieldByVariety,
  getFieldTestTypes,
  getFieldTableData,
} = require('../controllers/biBrixField.controller');


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

// ─── Brix Yard Sampling BI ───────────────────────────────────────
router.get('/brix-yard/stats',                 authenticate, getYardStats);
router.get('/brix-yard/brix-trend',            authenticate, getYardBrixTrend);
router.get('/brix-yard/by-vehicle',            authenticate, getYardByVehicle);
router.get('/brix-yard/condition-distribution',authenticate, getYardConditionDist);
router.get('/brix-yard/center-wise',           authenticate, getYardCenterWise);
router.get('/brix-yard/delivery-points',       authenticate, getYardDeliveryPoints);
router.get('/brix-yard/table-data',            authenticate, getYardTableData);

// ─── Brix Field Sampling BI ──────────────────────────────────────
router.get('/brix-field/stats',                 authenticate, getFieldStats);
router.get('/brix-field/brix-trend',            authenticate, getFieldBrixTrend);
router.get('/brix-field/field-condition-trend',  authenticate, getFieldConditionTrend);
router.get('/brix-field/crop-condition',        authenticate, getFieldCropCondition);
router.get('/brix-field/by-soil-type',          authenticate, getFieldBySoilType);
router.get('/brix-field/by-land-type',          authenticate, getFieldByLandType);
router.get('/brix-field/by-variety',            authenticate, getFieldByVariety);
router.get('/brix-field/test-types',            authenticate, getFieldTestTypes);
router.get('/brix-field/table-data',            authenticate, getFieldTableData);

const { getCentreMaturityBiData } = require('../controllers/biCentreMaturity.controller');

// ─── Centre Maturity BI ───────────────────────────────────────────
router.get('/centre-maturity/data', authenticate, getCentreMaturityBiData);

module.exports = router;
