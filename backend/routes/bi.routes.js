const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getDistilleryOperationsBi } = require('../controllers/bi.controller');
const { getBiSettings } = require('../controllers/biSettings.controller');

router.get('/settings', authenticate, getBiSettings);
router.get('/distillery-operations', authenticate, getDistilleryOperationsBi);

module.exports = router;
