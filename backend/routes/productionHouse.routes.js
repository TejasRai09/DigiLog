const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { rejectIfFormsHubViewOnly } = require('../utils/formsHubViewOnly');
const ctrl = require('../controllers/productionHouse.controller');

router.get('/houses', authenticate, ctrl.listHouses);
router.get('/', authenticate, ctrl.listEquipment);
router.get('/:id', authenticate, ctrl.getEquipment);
router.put('/:id', authenticate, rejectIfFormsHubViewOnly, ctrl.updateEquipment);
router.delete('/:id', authenticate, rejectIfFormsHubViewOnly, ctrl.deleteEquipment);
router.put('/:id/specs', authenticate, rejectIfFormsHubViewOnly, ctrl.updateSpecs);
router.get('/:id/history', authenticate, ctrl.getHistory);
router.post('/:id/history', authenticate, rejectIfFormsHubViewOnly, ctrl.addHistory);
router.put('/:id/history/:hid', authenticate, rejectIfFormsHubViewOnly, ctrl.updateHistory);
router.delete('/:id/history/:hid', authenticate, requireRole('admin'), rejectIfFormsHubViewOnly, ctrl.deleteHistory);
router.post('/:id/history/:hid/documents', authenticate, rejectIfFormsHubViewOnly, ctrl.uploadHistoryDocumentMiddleware, ctrl.uploadHistoryDocument);
router.post('/:id/history-approval/:requestId/documents', authenticate, rejectIfFormsHubViewOnly, ctrl.uploadApprovalDocumentMiddleware, ctrl.uploadApprovalDocument);
router.delete('/:id/history-approval/:requestId/documents/:fileName', authenticate, rejectIfFormsHubViewOnly, ctrl.deleteApprovalDocument);
router.get('/:id/history/:hid/documents/:fileName', authenticate, ctrl.downloadHistoryDocument);

module.exports = router;
