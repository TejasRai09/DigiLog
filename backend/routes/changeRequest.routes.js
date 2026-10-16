const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { rejectIfFormsHubViewOnly } = require('../utils/formsHubViewOnly');
const {
  getMyChangeRequests,
  getChangeRequestById,
  resubmitChangeRequest,
  updateDraftChangeRequest,
  submitDraftChangeRequest,
  cancelDraftChangeRequest,
  submitDraftChangeRequests,
  notifyHodChangeRequest,
} = require('../controllers/changeRequest.controller');

router.get('/my-requests', authenticate, getMyChangeRequests);
router.post('/submit-drafts', authenticate, rejectIfFormsHubViewOnly, submitDraftChangeRequests);
router.get('/:id', authenticate, getChangeRequestById);
router.put('/:id/draft', authenticate, rejectIfFormsHubViewOnly, updateDraftChangeRequest);
router.delete('/:id/draft', authenticate, rejectIfFormsHubViewOnly, cancelDraftChangeRequest);
router.post('/:id/submit', authenticate, rejectIfFormsHubViewOnly, submitDraftChangeRequest);
router.put('/:id/resubmit', authenticate, rejectIfFormsHubViewOnly, resubmitChangeRequest);
router.post('/:id/notify-hod', authenticate, notifyHodChangeRequest);

module.exports = router;
