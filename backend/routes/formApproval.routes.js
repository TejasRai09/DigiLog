const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  getPendingFormApprovals,
  approveFormRequest,
  sendFormForModification,
  bulkApproveFormRequests,
} = require('../controllers/formApproval.controller');

router.get('/pending', authenticate, getPendingFormApprovals);
router.post('/bulk-approve', authenticate, bulkApproveFormRequests);
router.post('/:id/approve', authenticate, approveFormRequest);
router.post('/:id/send-for-modification', authenticate, sendFormForModification);

module.exports = router;
