const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { rejectIfFormsHubViewOnly } = require('../utils/formsHubViewOnly');
const { uploadNoteDocumentMiddleware } = require('../middleware/noteDocumentUpload');
const ctrl = require('../controllers/maintenanceNotes.controller');

router.get('/plants', authenticate, ctrl.getPlants);
router.get('/equipment-tree', authenticate, ctrl.equipmentTree);
router.get('/access', authenticate, ctrl.getAccess);
router.get('/', authenticate, ctrl.list);
router.get('/hod', authenticate, ctrl.listHod);
router.get('/:id', authenticate, ctrl.getOne);
router.get('/:id/documents/:fileName', authenticate, ctrl.downloadDocument);
router.post('/', authenticate, rejectIfFormsHubViewOnly, ctrl.create);
router.put('/:id', authenticate, rejectIfFormsHubViewOnly, ctrl.update);
router.post('/:id/documents', authenticate, rejectIfFormsHubViewOnly, uploadNoteDocumentMiddleware, ctrl.uploadDocument);
router.post('/:id/submit', authenticate, rejectIfFormsHubViewOnly, ctrl.submit);
router.post('/:id/approve', authenticate, ctrl.approve);
router.post('/:id/reject', authenticate, ctrl.reject);

module.exports = router;
