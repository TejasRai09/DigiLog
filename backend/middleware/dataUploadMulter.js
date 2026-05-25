const path = require('path');
const multer = require('multer');
const {
  DATA_INGESTION_DIR,
  buildStoredFilename,
  isAllowedUpload,
} = require('../utils/dataUploadFile');

const MAX_BYTES = parseInt(process.env.DATA_UPLOAD_MAX_BYTES || '26214400', 10) || 26214400;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, DATA_INGESTION_DIR),
  filename: (req, file, cb) => {
    const category = (req.body && req.body.category) || 'upload';
    try {
      cb(null, buildStoredFilename(req.user.id, category, file.originalname));
    } catch (err) {
      cb(err);
    }
  },
});

function fileFilter(_req, file, cb) {
  if (isAllowedUpload(file)) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV and Excel files (.csv, .xlsx, .xls) are allowed.'));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter,
});

function uploadDataFileMiddleware(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File is too large.' });
      }
      return res.status(400).json({ message: err.message || 'Upload failed.' });
    }
    return res.status(400).json({ message: err.message || 'Invalid upload.' });
  });
}

module.exports = {
  uploadDataFileMiddleware,
  DATA_INGESTION_DIR,
  MAX_BYTES,
};
