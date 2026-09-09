const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const ctrl = require('../controllers/productionHouse.controller');

router.get('/houses', authenticate, ctrl.listHouses);
router.get('/', authenticate, ctrl.listEquipment);
router.get('/:id', authenticate, ctrl.getEquipment);
router.put('/:id', authenticate, ctrl.updateEquipment);
router.delete('/:id', authenticate, ctrl.deleteEquipment);
router.put('/:id/specs', authenticate, ctrl.updateSpecs);
router.get('/:id/history', authenticate, ctrl.getHistory);
router.post('/:id/history', authenticate, ctrl.addHistory);
router.put('/:id/history/:hid', authenticate, ctrl.updateHistory);
router.delete('/:id/history/:hid', authenticate, requireRole('admin'), ctrl.deleteHistory);
router.post('/:id/history/:hid/documents', authenticate, ctrl.uploadHistoryDocumentMiddleware, ctrl.uploadHistoryDocument);
router.post('/:id/history-approval/:requestId/documents', authenticate, ctrl.uploadApprovalDocumentMiddleware, ctrl.uploadApprovalDocument);
router.delete('/:id/history-approval/:requestId/documents/:fileName', authenticate, ctrl.deleteApprovalDocument);
router.get('/:id/history/:hid/documents/:fileName', authenticate, ctrl.downloadHistoryDocument);

module.exports = router;
