const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { uploadDataFileMiddleware } = require('../middleware/dataUploadMulter');
const {
  getMyAccess,
  requireDataUploadAccess,
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

router.get('/files', listFiles);
router.get('/purchy-slots', getPurchySlots);
router.get('/purchy-import/:jobId', getPurchyImportStatus);
router.get('/management-dashboard-import/:jobId', getManagementDashboardImportStatus);
router.get('/management-dashboard/files', listManagementDashboardFiles);
router.post('/management-dashboard/:slot', uploadDataFileMiddleware, uploadManagementDashboardSlot);
router.post('/purchy', uploadDataFileMiddleware, uploadPurchySlot);
router.post('/', uploadDataFileMiddleware, uploadFile);
router.get('/files/:id/download', downloadFile);
router.delete('/files/:id', deleteFile);

module.exports = router;
