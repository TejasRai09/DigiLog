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
  PURCHY_CATEGORY_SET,
  purchySlotFromCategory,
  isPurchyCategory,
  categoriesForPurchySlot,
} = require('../utils/purchyUploadSlots');
const {
  MD_ALLOWED_DATASETS,
  resolveMdSlot,
  isManagementDashboardCategory,
} = require('../utils/managementDashboardUploadSlots');
const {
  DATA_UPLOAD_SECTIONS,
  DATA_UPLOAD_SECTION_KEYS,
  normalizeSectionKeys,
  getUserDataUploadSections,
} = require('../utils/dataUploadSections');
const { sendServerError, MSG, logServerError } = require('../utils/httpError');

async function hasDataUploadAccess(user) {
  const sections = await getUserDataUploadSections(user);
  return sections.length > 0;
}

async function hasDataUploadSection(user, sectionKey) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const key = String(sectionKey || '').trim().toLowerCase();
  if (!DATA_UPLOAD_SECTION_KEYS.includes(key)) return false;
  const userId = user.id ?? user._id;
  if (userId == null) return false;
  const [[row]] = await pool.query(
    'SELECT user_id FROM user_data_upload_access WHERE user_id = ? AND section_key = ? LIMIT 1',
    [userId, key],
  );
  return !!row;
}

function requireDataUploadSection(sectionKey) {
  return async (req, res, next) => {
    try {
      if (await hasDataUploadSection(req.user, sectionKey)) return next();
      return res.status(403).json({ message: 'You do not have access to this Data Upload section.' });
    } catch (err) {
      logServerError('requireDataUploadSection', err);
      return res.status(500).json({ message: MSG.SERVER });
    }
  };
}

let schemaEnsured = false;
async function ensureDataUploadFilesSchema() {
  if (schemaEnsured) return;
  try {
    const [[col]] = await pool.query(
      `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'data_upload_files' AND COLUMN_NAME = 'sheet_details'`
    );
    if (!Number(col?.n)) {
      await pool.query('ALTER TABLE `data_upload_files` ADD COLUMN `sheet_details` JSON NULL DEFAULT NULL');
      console.log('[dataUpload] added data_upload_files.sheet_details column');
    }
    schemaEnsured = true;
  } catch (err) {
    console.warn('[dataUpload] ensureDataUploadFilesSchema:', err.message);
  }
}
ensureDataUploadFilesSchema();

function mapFileRow(r) {
  let sheetDetails = null;
  if (r.sheet_details) {
    try {
      sheetDetails = typeof r.sheet_details === 'string' ? JSON.parse(r.sheet_details) : r.sheet_details;
    } catch (_) {}
  }

  return {
    id: r.id,
    userId: r.user_id,
    category: r.category,
    dataset: r.dataset || null,
    purchySlot: purchySlotFromCategory(r.category) || (r.dataset === 'grower' || r.dataset === 'staff' ? r.dataset : null),
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
    sheetDetails,
  };
}

async function attachSheetDetails(fileRows) {
  if (!Array.isArray(fileRows) || !fileRows.length) return fileRows;

  const targetFiles = fileRows.filter(
    (f) =>
      f &&
      (f.dataset === 'centre_indent_purchase' ||
        f.dataset === 'centre_indent' ||
        f.dataset === 'centre_purchase' ||
        (f.category && f.category.includes('Centre Indent & Purchase')))
  );

  if (!targetFiles.length) return fileRows;

  try {
    const [indentStats] = await pool.query(
      `SELECT 
         file_upload_id, 
         COUNT(*) as rows_count, 
         MIN(indent_date) as min_date, 
         MAX(indent_date) as max_date 
       FROM centre_indent_data 
       GROUP BY file_upload_id`
    );

    const [purchaseStats] = await pool.query(
      `SELECT 
         file_upload_id, 
         COUNT(*) as rows_count, 
         MIN(purchase_date) as min_date, 
         MAX(purchase_date) as max_date 
       FROM centre_purchase_data 
       GROUP BY file_upload_id`
    );

    const indentMap = new Map();
    let indentNull = null;
    for (const s of indentStats) {
      const data = {
        sheetName: 'Indent',
        rows: Number(s.rows_count) || 0,
        dateMin: s.min_date ? String(s.min_date).slice(0, 10) : null,
        dateMax: s.max_date ? String(s.max_date).slice(0, 10) : null,
      };
      if (s.file_upload_id != null) {
        indentMap.set(Number(s.file_upload_id), data);
      } else {
        indentNull = data;
      }
    }

    const purchaseMap = new Map();
    let purchaseNull = null;
    for (const s of purchaseStats) {
      const data = {
        sheetName: 'Purchase',
        rows: Number(s.rows_count) || 0,
        dateMin: s.min_date ? String(s.min_date).slice(0, 10) : null,
        dateMax: s.max_date ? String(s.max_date).slice(0, 10) : null,
      };
      if (s.file_upload_id != null) {
        purchaseMap.set(Number(s.file_upload_id), data);
      } else {
        purchaseNull = data;
      }
    }

    for (const f of targetFiles) {
      if (f.sheetDetails && f.sheetDetails.indent && f.sheetDetails.purchase) continue;

      let indent = indentMap.get(Number(f.id));
      let purchase = purchaseMap.get(Number(f.id));

      if ((!indent || indent.rows === 0) && indentNull && targetFiles.length === 1) {
        indent = indentNull;
      }
      if ((!purchase || purchase.rows === 0) && purchaseNull && targetFiles.length === 1) {
        purchase = purchaseNull;
      }

      if (indent || purchase) {
        f.sheetDetails = {
          indent: indent || { sheetName: 'Indent', rows: 0, dateMin: null, dateMax: null },
          purchase: purchase || { sheetName: 'Purchase', rows: 0, dateMin: null, dateMax: null },
        };
      }
    }
  } catch (err) {
    console.error('attachSheetDetails error:', err.message);
  }

  return fileRows;
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
    const sections = await getUserDataUploadSections(req.user);
    res.json({
      enabled: sections.length > 0,
      sections,
      sectionMeta: DATA_UPLOAD_SECTIONS,
    });
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

/** GET /api/data-upload/files?section=milling|purchy|management */
async function listFiles(req, res) {
  const section = String(req.query.section || '').trim().toLowerCase();
  let where = '';
  let params = [];

  if (section === 'purchy') {
    where = 'WHERE f.category IN (?) OR f.dataset IN ("grower", "staff")';
    params.push([...PURCHY_CATEGORY_SET]);
  } else if (section === 'management') {
    where = 'WHERE f.dataset IN ("centre_indent_purchase", "dmr_workbook", "centre_indent", "centre_purchase") OR f.category LIKE "%Management Dashboard%"';
  } else if (section === 'milling') {
    where = 'WHERE f.dataset = "milling" OR (f.category NOT IN (?) AND f.category NOT LIKE "%Management Dashboard%" AND (f.dataset IS NULL OR f.dataset = "milling"))';
    params.push([...PURCHY_CATEGORY_SET]);
  }

  try {
    const [rows] = await pool.query(
      `SELECT f.*, u.name AS u_name, u.email AS u_email
       FROM data_upload_files f
       JOIN users u ON u.id = f.user_id
       ${where}
       ORDER BY f.created_at DESC`,
      params,
    );
    const mapped = rows.map(mapFileRow);
    await attachSheetDetails(mapped);
    res.json({ files: mapped });
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
      message: 'Use the Grower Intelligence section to upload grower or staff files.',
    });
  }

  if (isManagementDashboardCategory(parsed.value)) {
    unlinkStoredFile(storedFilename);
    return res.status(400).json({
      message: 'Use the Management Dashboard section to upload indent+purchase or DMR files.',
    });
  }

  try {
    const isMilling = parsed.value.toLowerCase().includes('mill') || originalFilename.toLowerCase().includes('data_mill') || originalFilename.toLowerCase().includes('shredder') || originalFilename.toLowerCase().includes('lube');
    const dataset = isMilling ? 'milling' : null;

    const [result] = await pool.query(
      `INSERT INTO data_upload_files
        (user_id, category, dataset, original_filename, stored_filename, mime_type, file_size_bytes, import_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'done')`,
      [
        req.user.id,
        parsed.value,
        dataset,
        originalFilename,
        storedFilename,
        req.file.mimetype || null,
        req.file.size || 0,
      ],
    );

    const fileUploadId = result.insertId;

    // Auto-sync mill thermal-report reference tables when the uploaded file is
    // one of the recognized mapping spreadsheets (Data_Mill, DataShredder_Names,
    // DataLube_Names).
    let millMappingSync = null;
    try {
      const abs = absolutePathForStored(storedFilename);
      millMappingSync = await syncIfMillMappingFile(originalFilename, abs);
      if (millMappingSync) {
        console.log(
          `Mill mapping auto-sync: ${millMappingSync.table} → ${millMappingSync.status} (${millMappingSync.rows} rows)`,
        );
        await pool.query(
          'UPDATE data_upload_files SET rows_imported = ?, import_status = ? WHERE id = ?',
          [millMappingSync.rows, millMappingSync.status === 'ok' ? 'done' : 'failed', fileUploadId],
        );
      }
    } catch (syncErr) {
      console.error('Mill mapping auto-sync failed:', syncErr.message);
      await pool.query(
        'UPDATE data_upload_files SET import_status = "failed", import_error = ? WHERE id = ?',
        [syncErr.message.slice(0, 500), fileUploadId],
      );
    }

    const [[row]] = await pool.query(
      `SELECT f.*, u.name AS u_name, u.email AS u_email
       FROM data_upload_files f
       JOIN users u ON u.id = f.user_id
       WHERE f.id = ?`,
      [fileUploadId],
    );

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

/** DELETE /api/data-upload/files/:id — owner or admin + UNDO IMPORT CHANGES */
async function deleteFile(req, res) {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ message: 'Invalid file id.' });

  try {
    const [[file]] = await pool.query('SELECT * FROM data_upload_files WHERE id = ?', [id]);
    if (!file) return res.status(404).json({ message: 'File not found.' });
    if (file.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only delete files you uploaded.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let undoSummary = '';

      // Legacy fallback (files uploaded before file_upload_id tagging) is only safe when
      // this file actually inserted rows; otherwise a date-range sweep would delete rows
      // belonging to other uploads that cover the same dates.
      const canLegacySweep = Number(file.rows_imported) > 0 && file.date_min && file.date_max;

      // 1a. Management Dashboard — DMR workbook (must be checked BEFORE the generic
      // Management Dashboard category check, since the DMR category also matches it)
      if (file.dataset === 'dmr_workbook' || file.category === 'Management Dashboard — DMR Workbook') {
        const [rDmr] = await conn.query('DELETE FROM dmr_daily WHERE file_upload_id = ?', [id]);
        let totalDmrDeleted = rDmr.affectedRows || 0;

        if (totalDmrDeleted === 0 && canLegacySweep) {
          const [rLegacyDmr] = await conn.query(
            'DELETE FROM dmr_daily WHERE file_upload_id IS NULL AND `Date` BETWEEN ? AND ?',
            [file.date_min, file.date_max],
          );
          totalDmrDeleted += rLegacyDmr.affectedRows || 0;
        }
        undoSummary = `Undid import: removed ${totalDmrDeleted} DMR row(s) from database.`;
      }

      // 1b. Management Dashboard — Centre Indent & Purchase
      else if (
        file.dataset === 'centre_indent_purchase'
        || file.dataset === 'centre_indent'
        || file.dataset === 'centre_purchase'
        || isManagementDashboardCategory(file.category)
      ) {
        const [rIndent] = await conn.query('DELETE FROM centre_indent_data WHERE file_upload_id = ?', [id]);
        const [rPurchase] = await conn.query('DELETE FROM centre_purchase_data WHERE file_upload_id = ?', [id]);
        let totalDeleted = (rIndent.affectedRows || 0) + (rPurchase.affectedRows || 0);

        if (totalDeleted === 0 && canLegacySweep) {
          const [rLegacyInd] = await conn.query(
            'DELETE FROM centre_indent_data WHERE file_upload_id IS NULL AND indent_date BETWEEN ? AND ?',
            [file.date_min, file.date_max],
          );
          const [rLegacyPur] = await conn.query(
            'DELETE FROM centre_purchase_data WHERE file_upload_id IS NULL AND purchase_date BETWEEN ? AND ?',
            [file.date_min, file.date_max],
          );
          totalDeleted += (rLegacyInd.affectedRows || 0) + (rLegacyPur.affectedRows || 0);
        }

        undoSummary = `Undid import: removed ${totalDeleted} indent/purchase row(s) from database.`;
      }

      // 2. Grower Intelligence Undo
      else if (isPurchyCategory(file.category) || file.dataset === 'grower' || file.dataset === 'staff') {
        const slot = purchySlotFromCategory(file.category) || file.dataset;
        if (slot === 'grower') {
          await conn.query('TRUNCATE TABLE purchy_grower_summary');
          await conn.query('TRUNCATE TABLE purchy_indent');
          await conn.query('TRUNCATE TABLE purchy_supply');
          await conn.query('TRUNCATE TABLE purchy_dishonour');
          await conn.query('TRUNCATE TABLE purchy_grower_facts');
          const { clearPurchyCache } = require('../services/purchy/purchyResponseCache');
          clearPurchyCache();
          undoSummary = 'Undid import: wiped grower data tables and recalculated facts.';
        } else if (slot === 'staff') {
          await conn.query('TRUNCATE TABLE purchy_field_staff');
          const { rebuildGrowerFacts } = require('../services/purchy/purchyGrowerFacts');
          await rebuildGrowerFacts(conn);
          const { clearPurchyCache } = require('../services/purchy/purchyResponseCache');
          clearPurchyCache();
          undoSummary = 'Undid import: cleared field staff mapping and recalculated facts.';
        }
      }

      // 3. Milling Operations Mapping Undo
      else {
        const origLower = (file.original_filename || '').toLowerCase();
        if (origLower.includes('data_mill') || origLower.includes('datamill')) {
          await conn.query('TRUNCATE TABLE data_mill_mapping');
          undoSummary = 'Undid import: cleared data_mill_mapping table.';
        } else if (origLower.includes('shredder_names') || origLower.includes('datashredder')) {
          await conn.query('TRUNCATE TABLE data_shredder_mapping');
          undoSummary = 'Undid import: cleared data_shredder_mapping table.';
        } else if (origLower.includes('lube_names') || origLower.includes('datalube')) {
          await conn.query('TRUNCATE TABLE data_lube_mapping');
          undoSummary = 'Undid import: cleared data_lube_mapping table.';
        }
      }

      // Delete the file metadata record
      await conn.query('DELETE FROM data_upload_files WHERE id = ?', [id]);

      await conn.commit();

      // Delete physical file from disk
      unlinkStoredFile(file.stored_filename);

      res.json({
        message: `File removed and all imported changes undone successfully. ${undoSummary}`,
        undoSummary,
      });
    } catch (dbErr) {
      await conn.rollback();
      throw dbErr;
    } finally {
      conn.release();
    }
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
    const [grants] = await pool.query(
      'SELECT user_id, section_key, granted_by, created_at FROM user_data_upload_access',
    );
    const sectionsByUser = new Map();
    for (const g of grants) {
      const uid = Number(g.user_id);
      const list = sectionsByUser.get(uid) || [];
      list.push(g.section_key);
      sectionsByUser.set(uid, list);
    }

    res.json({
      sections: DATA_UPLOAD_SECTIONS,
      assignments: users.map((u) => {
        const sections = normalizeSectionKeys(sectionsByUser.get(Number(u.id)) || []);
        return {
          user: { _id: u.id, id: u.id, name: u.name, email: u.email },
          sections,
          enabled: sections.length > 0,
        };
      }),
    });
  } catch (err) {
    sendServerError(res, 'getAdminDataUploadAccess', err, MSG.LOAD);
  }
}

/** PUT /api/admin/data-upload-access — { userId, sections: string[] } */
async function upsertAdminDataUploadAccess(req, res) {
  const userId = Number(req.body?.userId);
  if (!Number.isFinite(userId) || userId <= 0) {
    return res.status(400).json({ message: 'userId is required.' });
  }

  let sections;
  if (Array.isArray(req.body?.sections)) {
    sections = normalizeSectionKeys(req.body.sections);
  } else if (typeof req.body?.enabled === 'boolean') {
    sections = req.body.enabled ? [...DATA_UPLOAD_SECTION_KEYS] : [];
  } else {
    return res.status(400).json({ message: 'sections must be an array of section keys.' });
  }

  try {
    const [[target]] = await pool.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.role === 'admin') {
      return res.status(400).json({ message: 'Data upload access applies to employees only.' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM user_data_upload_access WHERE user_id = ?', [userId]);
      for (const sectionKey of sections) {
        await conn.query(
          `INSERT INTO user_data_upload_access (user_id, section_key, granted_by)
           VALUES (?, ?, ?)`,
          [userId, sectionKey, req.user.id],
        );
      }
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    res.json({
      message: 'Data upload access saved.',
      enabled: sections.length > 0,
      sections,
    });
  } catch (err) {
    sendServerError(res, 'upsertAdminDataUploadAccess', err, MSG.SAVE);
  }
}

/** GET /api/data-upload/purchy-slots */
async function getPurchySlots(req, res) {
  try {
    const categories = [...PURCHY_CATEGORY_SET];
    const [rows] = await pool.query(
      `SELECT f.*, u.name AS u_name, u.email AS u_email
       FROM data_upload_files f
       JOIN users u ON u.id = f.user_id
       WHERE f.category IN (?) OR f.dataset IN ('grower', 'staff')
       ORDER BY f.created_at DESC`,
      [categories],
    );

    const slots = { grower: null, staff: null };
    for (const row of rows) {
      const mapped = mapFileRow(row);
      const slot = mapped.purchySlot || mapped.dataset;
      if (slot && !slots[slot]) slots[slot] = mapped;
    }

    res.json({
      slots,
      files: rows.map(mapFileRow),
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
    const [result] = await pool.query(
      `INSERT INTO data_upload_files
        (user_id, category, dataset, original_filename, stored_filename, mime_type, file_size_bytes, import_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        req.user.id,
        meta.category,
        slot,
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
    const purchyImport = schedulePurchyImportBySlot(slot, abs, originalFilename, fileUploadId);

    res.status(201).json({
      file: mapFileRow(row),
      purchyImport,
      message: `Uploaded ${meta.label} and started background import.`,
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

/** GET /api/data-upload/management-dashboard/files?dataset=centre_indent_purchase|dmr_workbook|all */
async function listManagementDashboardFiles(req, res) {
  const dataset = String(req.query.dataset || '').trim();
  let where = 'WHERE f.dataset = ?';
  let params = [dataset];
  if (!dataset || dataset === 'all') {
    where = 'WHERE f.dataset IN ("centre_indent_purchase", "dmr_workbook", "centre_indent", "centre_purchase") OR f.category LIKE "%Management Dashboard%"';
    params = [];
  } else if (!MD_ALLOWED_DATASETS.has(dataset)) {
    return res.status(400).json({ message: 'dataset query param required (centre_indent_purchase, dmr_workbook).' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT f.*, u.name AS u_name, u.email AS u_email
       FROM data_upload_files f
       JOIN users u ON u.id = f.user_id
       ${where}
       ORDER BY f.created_at DESC`,
      params,
    );
    const mapped = rows.map(mapFileRow);
    await attachSheetDetails(mapped);
    res.json({ files: mapped });
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

    const [mappedFile] = await attachSheetDetails([mapFileRow(row)]);

    res.status(201).json({
      file: mappedFile,
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
  getAdminDataUploadAccess,
  upsertAdminDataUploadAccess,
};
