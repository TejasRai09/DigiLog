const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { uploadDataFileMiddleware } = require('../middleware/dataUploadMulter');
const {
  getMyAccess,
  requireDataUploadAccess,
  requireDataUploadSection,
  listFiles,
  uploadFile,
  getPurchySlots,
  uploadPurchySlot,
  downloadFile,
  deleteFile,
  getPurchyImportStatus,
  getManagementDashboardImportStatus,
  listManagementDashboardFiles,
  uploadManagementDashboardSlot,
} = require('../controllers/dataUpload.controller');

router.get('/access', authenticate, getMyAccess);

router.use(authenticate, requireDataUploadAccess);

router.get('/files/:id/download', downloadFile);
router.delete('/files/:id', deleteFile);

router.get('/purchy-slots', requireDataUploadSection('purchy'), getPurchySlots);
router.get('/purchy-import/:jobId', requireDataUploadSection('purchy'), getPurchyImportStatus);
router.post('/purchy', requireDataUploadSection('purchy'), uploadDataFileMiddleware, uploadPurchySlot);

router.get(
  '/management-dashboard-import/:jobId',
  requireDataUploadSection('management'),
  getManagementDashboardImportStatus,
);
router.get(
  '/management-dashboard/files',
  requireDataUploadSection('management'),
  listManagementDashboardFiles,
);
router.post(
  '/management-dashboard/:slot',
  requireDataUploadSection('management'),
  uploadDataFileMiddleware,
  uploadManagementDashboardSlot,
);

router.get('/files', requireDataUploadSection('milling'), listFiles);
router.post('/', requireDataUploadSection('milling'), uploadDataFileMiddleware, uploadFile);

module.exports = router;
