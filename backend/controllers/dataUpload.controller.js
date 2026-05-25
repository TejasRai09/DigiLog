const fs = require('fs');
const path = require('path');
const { pool } = require('../config/mysql');
const {
  absolutePathForStored,
  unlinkStoredFile,
} = require('../utils/dataUploadFile');

async function hasDataUploadAccess(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const [[row]] = await pool.query(
    'SELECT user_id FROM user_data_upload_access WHERE user_id = ? LIMIT 1',
    [user.id],
  );
  return !!row;
}

function mapFileRow(r) {
  return {
    id: r.id,
    userId: r.user_id,
    category: r.category,
    originalFilename: r.original_filename,
    storedFilename: r.stored_filename,
    mimeType: r.mime_type,
    fileSizeBytes: Number(r.file_size_bytes),
    createdAt: r.created_at,
    uploadedByName: r.u_name,
    uploadedByEmail: r.u_email,
  };
}

function validateCategory(category) {
  const c = String(category || '').trim();
  if (c.length < 3 || c.length > 200) {
    return { ok: false, message: 'Category name must be between 3 and 200 characters.' };
  }
  return { ok: true, value: c };
}

/** GET /api/data-upload/access */
async function getMyAccess(req, res) {
  const enabled = await hasDataUploadAccess(req.user);
  res.json({ enabled });
}

/** Middleware: require data upload access */
async function requireDataUploadAccess(req, res, next) {
  try {
    if (await hasDataUploadAccess(req.user)) return next();
    return res.status(403).json({ message: 'You do not have access to Data Upload.' });
  } catch (err) {
    console.error('requireDataUploadAccess:', err.message);
    return res.status(500).json({ message: 'Server error.' });
  }
}

/** GET /api/data-upload/files */
async function listFiles(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT f.*, u.name AS u_name, u.email AS u_email
       FROM data_upload_files f
       JOIN users u ON u.id = f.user_id
       ORDER BY f.created_at DESC`,
    );
    res.json({ files: rows.map(mapFileRow) });
  } catch (err) {
    console.error('listFiles:', err.message);
    res.status(500).json({ message: 'Failed to load uploads.' });
  }
}

/** POST /api/data-upload — multipart: file, category */
async function uploadFile(req, res) {
  const parsed = validateCategory(req.body?.category);
  if (!parsed.ok) return res.status(400).json({ message: parsed.message });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

  const storedFilename = req.file.filename;
  const originalFilename = path.basename(req.file.originalname || 'upload');

  try {
    const [result] = await pool.query(
      `INSERT INTO data_upload_files
        (user_id, category, original_filename, stored_filename, mime_type, file_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        parsed.value,
        originalFilename,
        storedFilename,
        req.file.mimetype || null,
        req.file.size || 0,
      ],
    );

    const [[row]] = await pool.query(
      `SELECT f.*, u.name AS u_name, u.email AS u_email
       FROM data_upload_files f
       JOIN users u ON u.id = f.user_id
       WHERE f.id = ?`,
      [result.insertId],
    );

    res.status(201).json({ file: mapFileRow(row) });
  } catch (err) {
    unlinkStoredFile(storedFilename);
    console.error('uploadFile:', err.message);
    res.status(500).json({ message: 'Failed to save upload metadata.' });
  }
}

/** GET /api/data-upload/files/:id/download */
async function downloadFile(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid file id.' });

  try {
    const [[row]] = await pool.query('SELECT * FROM data_upload_files WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ message: 'File not found.' });

    const abs = absolutePathForStored(row.stored_filename);
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ message: 'File missing on server.' });
    }

    res.download(abs, row.original_filename);
  } catch (err) {
    console.error('downloadFile:', err.message);
    res.status(500).json({ message: 'Download failed.' });
  }
}

/** DELETE /api/data-upload/files/:id — owner only */
async function deleteFile(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid file id.' });

  try {
    const [[row]] = await pool.query('SELECT * FROM data_upload_files WHERE id = ?', [id]);
    if (!row) return res.status(404).json({ message: 'File not found.' });
    if (row.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete files you uploaded.' });
    }

    await pool.query('DELETE FROM data_upload_files WHERE id = ?', [id]);
    unlinkStoredFile(row.stored_filename);
    res.json({ message: 'File deleted.' });
  } catch (err) {
    console.error('deleteFile:', err.message);
    res.status(500).json({ message: 'Delete failed.' });
  }
}

/** GET /api/admin/data-upload-access */
async function getAdminDataUploadAccess(req, res) {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.name, u.email
       FROM users u
       WHERE u.role = 'employee'
       ORDER BY u.name`,
    );
    const [grants] = await pool.query('SELECT user_id, granted_by, created_at FROM user_data_upload_access');
    const grantByUser = new Map(grants.map((g) => [g.user_id, g]));

    res.json({
      assignments: users.map((u) => {
        const g = grantByUser.get(u.id);
        return {
          user: { _id: u.id, id: u.id, name: u.name, email: u.email },
          enabled: !!g,
          grantedBy: g?.granted_by ?? null,
          grantedAt: g?.created_at ?? null,
        };
      }),
    });
  } catch (err) {
    console.error('getAdminDataUploadAccess:', err.message);
    res.status(500).json({ message: 'Failed to load data upload access.' });
  }
}

/** PUT /api/admin/data-upload-access — { userId, enabled } */
async function upsertAdminDataUploadAccess(req, res) {
  const { userId, enabled } = req.body;
  if (!userId) return res.status(400).json({ message: 'userId is required.' });
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ message: 'enabled must be a boolean.' });
  }

  try {
    const [[target]] = await pool.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.role === 'admin') {
      return res.status(400).json({ message: 'Data upload access applies to employees only.' });
    }

    if (enabled) {
      await pool.query(
        `INSERT INTO user_data_upload_access (user_id, granted_by)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE granted_by = VALUES(granted_by)`,
        [userId, req.user.id],
      );
    } else {
      await pool.query('DELETE FROM user_data_upload_access WHERE user_id = ?', [userId]);
    }

    res.json({ message: 'Data upload access saved.', enabled });
  } catch (err) {
    console.error('upsertAdminDataUploadAccess:', err.message);
    res.status(500).json({ message: 'Failed to save data upload access.' });
  }
}

module.exports = {
  hasDataUploadAccess,
  getMyAccess,
  requireDataUploadAccess,
  listFiles,
  uploadFile,
  downloadFile,
  deleteFile,
  getAdminDataUploadAccess,
  upsertAdminDataUploadAccess,
};
