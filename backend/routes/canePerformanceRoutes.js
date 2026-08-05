const express = require('express');
const router = express.Router();
const caneController = require('../controllers/canePerformanceController');

router.get('/gate1', caneController.getGate1Data);
router.get('/procurement', caneController.getGate1Data);
router.get('/gate2', caneController.getGate1Data);
router.get('/center-purchase', caneController.getGate1Data);
router.get('/vehicle-handling', caneController.getGate1Data);
router.get('/vehicle-holding', caneController.getGate1Data);
router.get('/vehicle-holding2', caneController.getGate1Data);
router.get('/truck-transit', caneController.getGate1Data);
router.get('/truck-holding', caneController.getGate1Data);
router.get('/database', caneController.getGate1Data);
router.get('/mill-performance', caneController.getGate1Data);
router.get('/brix-sampling', caneController.getBrixSamplingData);

module.exports = router;
