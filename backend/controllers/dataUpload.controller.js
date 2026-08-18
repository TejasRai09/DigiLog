const fs = require('fs');
const path = require('path');
const { pool } = require('../config/mysql');
const {
  absolutePathForStored,
  unlinkStoredFile,
} = require('../utils/dataUploadFile');
const { syncIfMillMappingFile } = require('../utils/millMappingSync');
const {
  schedulePurchyImportBySlot,
  getPurchyImportJob,
} = require('../utils/purchyUploadSync');
const {
  scheduleManagementDashboardImport,
  getManagementDashboardImportJob,
} = require('../utils/managementDashboardUploadSync');
const {
  PURCHY_SLOTS,
  purchySlotFromCategory,
  isPurchyCategory,
} = require('../utils/purchyUploadSlots');
const {
  MD_ALLOWED_DATASETS,
  resolveMdSlot,
  isManagementDashboardCategory,
} = require('../utils/managementDashboardUploadSlots');
const { sendServerError, MSG, logServerError } = require('../utils/httpError');

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
    dataset: r.dataset || null,
    purchySlot: purchySlotFromCategory(r.category),
    originalFilename: r.original_filename,
    storedFilename: r.stored_filename,
    mimeType: r.mime_type,
    fileSizeBytes: Number(r.file_size_bytes),
    createdAt: r.created_at,
    uploadedByName: r.u_name,
    uploadedByEmail: r.u_email,
    importStatus: r.import_status || null,
    rowsImported: r.rows_imported != null ? Number(r.rows_imported) : null,
    rowsSkipped: r.rows_skipped != null ? Number(r.rows_skipped) : null,
    dateMin: r.date_min ? String(r.date_min).slice(0, 10) : null,
    dateMax: r.date_max ? String(r.date_max).slice(0, 10) : null,
    importError: r.import_error || null,
  };
}

async function replacePurchySlotRecords(category) {
  const [rows] = await pool.query(
    'SELECT id, stored_filename FROM data_upload_files WHERE category = ?',
    [category],
  );
  for (const row of rows) {
    await pool.query('DELETE FROM data_upload_files WHERE id = ?', [row.id]);
    unlinkStoredFile(row.stored_filename);
  }
  return rows.length;
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
  try {
    const enabled = await hasDataUploadAccess(req.user);
    res.json({ enabled });
  } catch (err) {
    sendServerError(res, 'getMyAccess', err, MSG.LOAD);
  }
}

/** Middleware: require data upload access */
async function requireDataUploadAccess(req, res, next) {
  try {
    if (await hasDataUploadAccess(req.user)) return next();
    return res.status(403).json({ message: 'You do not have access to Data Upload.' });
  } catch (err) {
    logServerError('requireDataUploadAccess', err);
    return res.status(500).json({ message: MSG.SERVER });
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
    sendServerError(res, 'listFiles', err, MSG.LOAD);
  }
}

/** POST /api/data-upload — multipart: file, category */
async function uploadFile(req, res) {
  const parsed = validateCategory(req.body?.category);
  if (!parsed.ok) return res.status(400).json({ message: parsed.message });
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

  const storedFilename = req.file.filename;
  const originalFilename = path.basename(req.file.originalname || 'upload');

  if (isPurchyCategory(parsed.value)) {
    unlinkStoredFile(storedFilename);
    return res.status(400).json({
      message: 'Use the Purchy Analysis section to upload grower or staff files.',
    });
  }

  if (isManagementDashboardCategory(parsed.value)) {
    unlinkStoredFile(storedFilename);
    return res.status(400).json({
      message: 'Use the Management Dashboard section to upload indent+purchase or DMR files.',
    });
  }

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

    // Auto-sync mill thermal-report reference tables when the uploaded file is
    // one of the recognized mapping spreadsheets (Data_Mill, DataShredder_Names,
    // DataLube_Names). Best-effort: a sync failure must not fail the upload.
    let millMappingSync = null;
    try {
      const abs = absolutePathForStored(storedFilename);
      millMappingSync = await syncIfMillMappingFile(originalFilename, abs);
      if (millMappingSync) {
        console.log(
          `Mill mapping auto-sync: ${millMappingSync.table} → ${millMappingSync.status} (${millMappingSync.rows} rows)`,
        );
      }
    } catch (syncErr) {
      console.error('Mill mapping auto-sync failed:', syncErr.message);
    }

    res.status(201).json({ file: mapFileRow(row), millMappingSync });
  } catch (err) {
    unlinkStoredFile(storedFilename);
    sendServerError(res, 'uploadFile', err, MSG.UPLOAD);
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
    sendServerError(res, 'downloadFile', err, MSG.LOAD);
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
    sendServerError(res, 'deleteFile', err, MSG.DELETE);
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
    sendServerError(res, 'getAdminDataUploadAccess', err, MSG.LOAD);
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
    sendServerError(res, 'upsertAdminDataUploadAccess', err, MSG.SAVE);
  }
}

/** GET /api/data-upload/purchy-slots */
async function getPurchySlots(req, res) {
  try {
    const categories = Object.values(PURCHY_SLOTS).map((s) => s.category);
    const [rows] = await pool.query(
      `SELECT f.*, u.name AS u_name, u.email AS u_email
       FROM data_upload_files f
       JOIN users u ON u.id = f.user_id
       WHERE f.category IN (?)
       ORDER BY f.created_at DESC`,
      [categories],
    );

    const slots = { grower: null, staff: null };
    for (const row of rows) {
      const mapped = mapFileRow(row);
      const slot = mapped.purchySlot;
      if (slot && !slots[slot]) slots[slot] = mapped;
    }

    res.json({
      slots,
      meta: Object.values(PURCHY_SLOTS).map(({ slot, label, hint, category }) => ({
        slot, label, hint, category,
      })),
    });
  } catch (err) {
    sendServerError(res, 'getPurchySlots', err, MSG.LOAD);
  }
}

/** POST /api/data-upload/purchy — multipart: slot (grower|staff), file */
async function uploadPurchySlot(req, res) {
  const slot = String(req.body?.slot || '').trim().toLowerCase();
  const meta = PURCHY_SLOTS[slot];
  if (!meta) {
    return res.status(400).json({ message: 'slot must be "grower" or "staff".' });
  }
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  if (ext !== '.xlsx' && ext !== '.xls') {
    unlinkStoredFile(req.file.filename);
    return res.status(400).json({ message: 'Purchy files must be Excel (.xlsx or .xls).' });
  }

  const storedFilename = req.file.filename;
  const originalFilename = path.basename(req.file.originalname || 'upload');

  try {
    const replaced = await replacePurchySlotRecords(meta.category);

    const [result] = await pool.query(
      `INSERT INTO data_upload_files
        (user_id, category, original_filename, stored_filename, mime_type, file_size_bytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.id,
        meta.category,
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

    const abs = absolutePathForStored(storedFilename);
    const purchyImport = schedulePurchyImportBySlot(slot, abs, originalFilename);

    res.status(201).json({
      file: mapFileRow(row),
      replaced,
      purchyImport,
      message: replaced
        ? `Replaced previous ${meta.label} file and started re-import.`
        : `Uploaded ${meta.label} and started import.`,
    });
  } catch (err) {
    unlinkStoredFile(storedFilename);
    sendServerError(res, 'uploadPurchySlot', err, MSG.UPLOAD);
  }
}

/** GET /api/data-upload/management-dashboard-import/:jobId */
async function getManagementDashboardImportStatus(req, res) {
  const { jobId } = req.params;
  if (!jobId) return res.status(400).json({ message: 'jobId is required.' });

  try {
    const job = getManagementDashboardImportJob(jobId);
    if (!job) return res.status(404).json({ message: 'Import job not found.' });
    res.json(job);
  } catch (err) {
    sendServerError(res, 'getManagementDashboardImportStatus', err, MSG.LOAD);
  }
}

/** GET /api/data-upload/management-dashboard/files?dataset=centre_indent_purchase|dmr_workbook|centre_indent|centre_purchase */
async function listManagementDashboardFiles(req, res) {
  const dataset = String(req.query.dataset || '').trim();
  if (!MD_ALLOWED_DATASETS.has(dataset)) {
    return res.status(400).json({ message: 'dataset query param required (centre_indent_purchase, dmr_workbook).' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT f.*, u.name AS u_name, u.email AS u_email
       FROM data_upload_files f
       JOIN users u ON u.id = f.user_id
       WHERE f.dataset = ?
       ORDER BY f.created_at DESC`,
      [dataset],
    );
    res.json({ files: rows.map(mapFileRow) });
  } catch (err) {
    sendServerError(res, 'listManagementDashboardFiles', err, MSG.LOAD);
  }
}

/** POST /api/data-upload/management-dashboard/:slot — multipart: file (slot = indent-purchase|dmr) */
async function uploadManagementDashboardSlot(req, res) {
  const slot = String(req.params.slot || '').trim().toLowerCase();
  const meta = resolveMdSlot(slot);
  if (!meta) {
    return res.status(400).json({ message: 'slot must be "indent-purchase" or "dmr".' });
  }
  if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

  const ext = path.extname(req.file.originalname || '').toLowerCase();
  if (ext !== '.xlsx' && ext !== '.xls') {
    unlinkStoredFile(req.file.filename);
    return res.status(400).json({ message: 'Management dashboard files must be Excel (.xlsx or .xls).' });
  }

  const storedFilename = req.file.filename;
  const originalFilename = path.basename(req.file.originalname || 'upload');

  try {
    const [result] = await pool.query(
      `INSERT INTO data_upload_files
        (user_id, category, dataset, original_filename, stored_filename, mime_type, file_size_bytes, import_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        req.user.id,
        meta.category,
        meta.dataset,
        originalFilename,
        storedFilename,
        req.file.mimetype || null,
        req.file.size || 0,
      ],
    );

    const fileUploadId = result.insertId;

    const [[row]] = await pool.query(
      `SELECT f.*, u.name AS u_name, u.email AS u_email
       FROM data_upload_files f
       JOIN users u ON u.id = f.user_id
       WHERE f.id = ?`,
      [fileUploadId],
    );

    const abs = absolutePathForStored(storedFilename);
    const mdImport = scheduleManagementDashboardImport(slot, abs, originalFilename, fileUploadId);

    res.status(201).json({
      file: mapFileRow(row),
      importJob: mdImport,
      message: `Uploaded ${meta.label} and started import (append-by-date, skip existing dates).`,
    });
  } catch (err) {
    unlinkStoredFile(storedFilename);
    sendServerError(res, 'uploadManagementDashboardSlot', err, MSG.UPLOAD);
  }
}

/** GET /api/data-upload/purchy-import/:jobId */
async function getPurchyImportStatus(req, res) {
  const { jobId } = req.params;
  if (!jobId) return res.status(400).json({ message: 'jobId is required.' });

  try {
    const job = getPurchyImportJob(jobId);
    if (!job) return res.status(404).json({ message: 'Import job not found.' });
    res.json(job);
  } catch (err) {
    sendServerError(res, 'getPurchyImportStatus', err, MSG.LOAD);
  }
}

module.exports = {
  hasDataUploadAccess,
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
  getAdminDataUploadAccess,
  upsertAdminDataUploadAccess,
};
