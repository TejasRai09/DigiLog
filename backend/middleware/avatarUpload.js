const fs = require('fs');
const path = require('path');
const multer = require('multer');

const AVATAR_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const MAX_BYTES = 450_000;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = file.mimetype === 'image/png' ? '.png' : '.jpg';
    cb(null, `${req.user.id}-${Date.now()}${ext}`);
  },
});

function fileFilter(_req, file, cb) {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    cb(new Error('Only PNG and JPEG are allowed.'));
  }
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES },
  fileFilter,
});

function uploadAvatarMiddleware(req, res, next) {
  upload.single('avatar')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image is too large. Try a smaller photo.' });
      }
      return res.status(400).json({ message: err.message || 'Upload failed.' });
    }
    return res.status(400).json({ message: err.message || 'Invalid upload.' });
  });
}

module.exports = {
  uploadAvatarMiddleware,
  AVATAR_DIR,
};
