const router = require('express').Router();
const {
  acceptByToken,
  rejectByToken,
  acceptByTokenJson,
  rejectByTokenJson,
} = require('../controllers/maintenanceApproval.controller');

router.get('/accept', acceptByToken);
router.get('/reject', rejectByToken);
router.post('/accept', acceptByTokenJson);
router.post('/reject', rejectByTokenJson);

module.exports = router;
