const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  recordActivity,
  exitActivityEvent,
} = require('../controllers/sessionActivity.controller');

router.post('/page-view', authenticate, recordActivity);
router.post('/event', authenticate, recordActivity);
router.patch('/:id/exit', authenticate, exitActivityEvent);

module.exports = router;
