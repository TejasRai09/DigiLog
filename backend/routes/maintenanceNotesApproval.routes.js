const router = require('express').Router();
const {
  inboxByToken,
  reviewByToken,
  reviewByTokenJson,
  acceptByTokenJson,
  rejectByTokenJson,
  bulkAcceptByTokenJson,
  documentByToken,
} = require('../controllers/maintenanceNotesApproval.controller');

router.get('/inbox', inboxByToken);
router.get('/document', documentByToken);
router.post('/bulk-accept', bulkAcceptByTokenJson);
router.get('/review', reviewByToken);
router.post('/review', reviewByTokenJson);
router.post('/accept', acceptByTokenJson);
router.post('/reject', rejectByTokenJson);

module.exports = router;
