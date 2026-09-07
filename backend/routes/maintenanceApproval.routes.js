const router = require('express').Router();
const {
  acceptByToken,
  rejectByToken,
  acceptByTokenJson,
  rejectByTokenJson,
  reviewByToken,
  reviewByTokenJson,
  inboxByToken,
  documentByToken,
  bulkAcceptByTokenJson,
} = require('../controllers/maintenanceApproval.controller');

router.get('/inbox', inboxByToken);
router.get('/document', documentByToken);
router.post('/bulk-accept', bulkAcceptByTokenJson);
router.get('/review', reviewByToken);
router.post('/review', reviewByTokenJson);
router.get('/accept', acceptByToken);
router.get('/reject', rejectByToken);
router.post('/accept', acceptByTokenJson);
router.post('/reject', (req, res) => {
  const type = String(req.headers['content-type'] || '');
  const accept = String(req.headers.accept || '');
  if (type.includes('application/json') || accept.includes('application/json')) {
    return rejectByTokenJson(req, res);
  }
  return rejectByToken(req, res);
});

module.exports = router;
