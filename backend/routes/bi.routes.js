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

router.get('/settings', authenticate, getBiSettings);
router.get('/distillery-operations', authenticate, getDistilleryOperationsBi);
router.get('/milling-operations', authenticate, getMillingStoppagesBi);
router.get('/milling-equipment-temp', authenticate, getMillingEquipmentTempBi);
router.get('/milling-shredder', authenticate, getMillingShredderBi);
router.get('/milling-lube-roller', authenticate, getMillingLubeRollerBi);

module.exports = router;
