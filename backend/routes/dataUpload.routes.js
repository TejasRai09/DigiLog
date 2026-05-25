const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { uploadDataFileMiddleware } = require('../middleware/dataUploadMulter');
const {
  getMyAccess,
  requireDataUploadAccess,
  listFiles,
  uploadFile,
  downloadFile,
  deleteFile,
} = require('../controllers/dataUpload.controller');

router.get('/access', authenticate, getMyAccess);

router.use(authenticate, requireDataUploadAccess);

router.get('/files', listFiles);
router.post('/', uploadDataFileMiddleware, uploadFile);
router.get('/files/:id/download', downloadFile);
router.delete('/files/:id', deleteFile);

module.exports = router;
