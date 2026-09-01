const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getPowerHouseBi } = require('../controllers/biPowerHouse.controller');

router.get('/', authenticate, getPowerHouseBi);

module.exports = router;
