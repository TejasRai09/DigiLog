const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { rejectIfFormsHubViewOnly } = require('../utils/formsHubViewOnly');
const {
  getMyChangeRequests,
  getChangeRequestById,
  resubmitChangeRequest,
  notifyHodChangeRequest,
} = require('../controllers/changeRequest.controller');

router.get('/my-requests', authenticate, getMyChangeRequests);
router.get('/:id', authenticate, getChangeRequestById);
router.put('/:id/resubmit', authenticate, rejectIfFormsHubViewOnly, resubmitChangeRequest);
router.post('/:id/notify-hod', authenticate, notifyHodChangeRequest);

module.exports = router;
