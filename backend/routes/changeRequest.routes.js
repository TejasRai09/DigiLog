const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  getMyChangeRequests,
  getChangeRequestById,
  resubmitChangeRequest,
  notifyHodChangeRequest,
} = require('../controllers/changeRequest.controller');

router.get('/my-requests', authenticate, getMyChangeRequests);
router.get('/:id', authenticate, getChangeRequestById);
router.put('/:id/resubmit', authenticate, resubmitChangeRequest);
router.post('/:id/notify-hod', authenticate, notifyHodChangeRequest);

module.exports = router;
