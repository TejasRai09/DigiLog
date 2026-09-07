const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const {
  getApprovalAccess,
  getPendingApprovals,
  approveChangeRequest,
  sendChangeForModification,
  bulkApproveChangeRequests,
  resolveChangeConflict,
} = require('../controllers/changeRequest.controller');

router.get('/access', authenticate, getApprovalAccess);
router.get('/pending', authenticate, getPendingApprovals);
router.post('/bulk-approve', authenticate, bulkApproveChangeRequests);
router.post('/:id/approve', authenticate, approveChangeRequest);
router.post('/:id/send-for-modification', authenticate, sendChangeForModification);
router.post('/:id/resolve-conflict', authenticate, resolveChangeConflict);

module.exports = router;
