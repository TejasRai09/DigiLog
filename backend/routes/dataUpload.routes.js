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
} = require('../controllers/dataUpload.controller');

router.get('/access', authenticate, getMyAccess);

router.use(authenticate, requireDataUploadAccess);

router.get('/files', listFiles);
router.get('/purchy-slots', getPurchySlots);
router.get('/purchy-import/:jobId', getPurchyImportStatus);
router.post('/purchy', uploadDataFileMiddleware, uploadPurchySlot);
router.post('/', uploadDataFileMiddleware, uploadFile);
router.get('/files/:id/download', downloadFile);
router.delete('/files/:id', deleteFile);

module.exports = router;
