const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const { clientErrorMessage, MSG } = require('../utils/httpError');
const {
  MAX_NOTE_DOCUMENT_BYTES,
  NOTE_DOCUMENTS_ROOT,
  extensionForUpload,
  isAllowedNoteDocument,
  noteDocumentDir,
} = require('../utils/noteDocuments');

fs.mkdirSync(NOTE_DOCUMENTS_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = noteDocumentDir(req.params.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = extensionForUpload(file.mimetype, file.originalname) || '.bin';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (isAllowedNoteDocument(file.mimetype, file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Allowed file types: PDF and Word.'));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_NOTE_DOCUMENT_BYTES },
  fileFilter,
});

function uploadNoteDocumentMiddleware(req, res, next) {
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
}

module.exports = { uploadNoteDocumentMiddleware };
