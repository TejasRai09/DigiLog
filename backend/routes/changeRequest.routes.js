const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  getMyChangeRequests,
  getChangeRequestById,
  resubmitChangeRequest,
} = require('../controllers/changeRequest.controller');

router.get('/my-requests', authenticate, getMyChangeRequests);
router.get('/:id', authenticate, getChangeRequestById);
router.put('/:id/resubmit', authenticate, resubmitChangeRequest);

module.exports = router;
