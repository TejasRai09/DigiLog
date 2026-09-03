const router = require('express').Router();
const {
  acceptByToken,
  rejectByToken,
  acceptByTokenJson,
  rejectByTokenJson,
  reviewByToken,
  reviewByTokenJson,
  inboxByToken,
} = require('../controllers/maintenanceApproval.controller');

router.get('/inbox', inboxByToken);
router.get('/review', reviewByToken);
router.post('/review', reviewByTokenJson);
router.get('/accept', acceptByToken);
router.get('/reject', rejectByToken);
router.post('/accept', acceptByTokenJson);
router.post('/reject', rejectByTokenJson);

module.exports = router;
