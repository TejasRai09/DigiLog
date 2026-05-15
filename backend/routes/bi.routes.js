const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getDistilleryOperationsBi } = require('../controllers/bi.controller');

router.get('/distillery-operations', authenticate, getDistilleryOperationsBi);

module.exports = router;
