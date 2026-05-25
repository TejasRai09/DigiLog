const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getMyHomepageCards } = require('../controllers/homepageCards.controller');

router.get('/', authenticate, getMyHomepageCards);

module.exports = router;
