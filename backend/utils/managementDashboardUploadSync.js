const { randomUUID } = require('crypto');
const { pool } = require('../config/mysql');
const { runCentreIndentImport } = require('../services/managementDashboard/centreIndentImportService');
const { runCentrePurchaseImport } = require('../services/managementDashboard/centrePurchaseImportService');
const { runDmrLogbookImport } = require('../services/managementDashboard/dmrLogbookImportService');
const { MD_DATASETS } = require('./managementDashboardUploadSlots');

const jobs = new Map();
const MAX_LOG_LINES = 300;

function getJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  return {
    jobId: job.id,
    type: job.type,
    status: job.status,
    originalFilename: job.originalFilename,
    fileUploadId: job.fileUploadId,
    error: job.error,
    totals: job.totals,
    logs: job.logs.slice(-80),
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

function pushLog(job, stage, message, detail = {}) {
  job.logs.push({ at: new Date().toISOString(), stage, message, detail });
  if (job.logs.length > MAX_LOG_LINES) job.logs.splice(0, job.logs.length - MAX_LOG_LINES);
}

async function updateFileImportMeta(fileUploadId, fields) {
  const sets = [];
  const params = [];
  for (const [k, v] of Object.entries(fields)) {
    sets.push(`${k} = ?`);
    params.push(v);
  }
  params.push(fileUploadId);
  await pool.query(`UPDATE data_upload_files SET ${sets.join(', ')} WHERE id = ?`, params);
}

async function executeJob(job) {
  job.status = 'running';
  job.startedAt = new Date().toISOString();
  pushLog(job, 'start', `Starting ${job.type} import…`);

  await updateFileImportMeta(job.fileUploadId, { import_status: 'running' });

  const onProgress = (stage, detail, message) => {
    pushLog(job, stage, message, detail);
  };

  try {
    let result;
    if (job.type === 'indent') {
      result = await runCentreIndentImport({ filePath: job.filePath, onProgress });
    } else if (job.type === 'purchase') {
      result = await runCentrePurchaseImport({ filePath: job.filePath, onProgress });
    } else if (job.type === 'dmr') {
      result = await runDmrLogbookImport({ filePath: job.filePath, onProgress });
    } else {
      throw new Error(`Unknown import type: ${job.type}`);
    }

    job.totals = result;
    job.status = 'completed';
    pushLog(job, 'complete', 'Import completed.', { totals: result });

    await updateFileImportMeta(job.fileUploadId, {
      import_status: 'done',
      rows_imported: result.imported,
      rows_skipped: result.skipped,
      date_min: result.dateMin,
      date_max: result.dateMax,
      import_error: null,
    });
  } catch (err) {
    job.status = 'failed';
    job.error = err.message || 'Import failed.';
    pushLog(job, 'error', job.error);
    await updateFileImportMeta(job.fileUploadId, {
      import_status: 'failed',
      import_error: job.error.slice(0, 500),
    });
    console.error('Management dashboard import failed:', err);
  } finally {
    job.finishedAt = new Date().toISOString();
  }
}

function scheduleManagementDashboardImport(slot, absolutePath, originalFilename, fileUploadId) {
  const meta = MD_DATASETS[slot];
  if (!meta) throw new Error(`Unknown management dashboard slot: ${slot}`);

  const jobId = randomUUID();
  const job = {
    id: jobId,
    type: slot,
    status: 'queued',
    originalFilename,
    filePath: absolutePath,
    fileUploadId,
    logs: [],
    totals: null,
    error: null,
    startedAt: null,
    finishedAt: null,
  };
  jobs.set(jobId, job);

  setImmediate(() => {
    executeJob(job).catch((err) => {
      job.status = 'failed';
      job.error = err.message || 'Import failed.';
      job.finishedAt = new Date().toISOString();
      console.error('Management dashboard import job crashed:', err);
    });
  });

  return { jobId, type: slot, status: 'queued' };
}

module.exports = {
  scheduleManagementDashboardImport,
  getManagementDashboardImportJob: getJob,
};
