const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { clientErrorMessage, MSG } = require('../utils/httpError');
const {
  MAX_HISTORY_DOCUMENT_BYTES,
  MAX_HISTORY_DOCUMENTS,
  extensionForUpload,
  isAllowedHistoryDocument,
  HISTORY_DOCUMENTS_ROOT,
} = require('../utils/historyDocuments');
const { approvalStagingDir, listStagedDocuments } = require('../services/maintenanceHistoryApproval.service');

fs.mkdirSync(HISTORY_DOCUMENTS_ROOT, { recursive: true });

function createApprovalDocumentUploadMiddleware() {
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const { requestId } = req.params;
      const dir = approvalStagingDir(requestId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = extensionForUpload(file.mimetype, file.originalname) || '.bin';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });

  function fileFilter(_req, file, cb) {
    if (isAllowedHistoryDocument(file.mimetype, file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Allowed file types: PDF, Word, text, and Excel.'));
    }
  }

  const upload = multer({
    storage,
    limits: { fileSize: MAX_HISTORY_DOCUMENT_BYTES },
    fileFilter,
  });

  return function uploadApprovalDocumentMiddleware(req, res, next) {
    upload.single('document')(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'Document is too large (max 10 MB).' });
        }
        return res.status(400).json({ message: clientErrorMessage(err, MSG.UPLOAD) });
      }
      return res.status(400).json({ message: clientErrorMessage(err, MSG.UPLOAD) });
    });
  };
}

module.exports = {
  createApprovalDocumentUploadMiddleware,
  MAX_HISTORY_DOCUMENTS,
  listStagedDocuments,
};
