/**
 * Detect Purchy grower/staff workbooks uploaded via Data Ingestion Center
 * and schedule background import (mirrors millMappingSync pattern).
 */
const path = require('path');
const { randomUUID } = require('crypto');
const { runPurchyGrowerImport } = require('../services/purchy/purchyGrowerImportService');
const { PURCHY_SLOTS } = require('./purchyUploadSlots');

const jobs = new Map();
const MAX_LOG_LINES = 300;

function normalizeStem(filename) {
  return path
    .basename(filename || '', path.extname(filename || ''))
    .toLowerCase()
    .replace(/[\s\-]+/g, '_');
}

/**
 * @returns {'grower'|'staff'|null}
 */
function detectPurchyUploadType(originalFilename) {
  if (!originalFilename) return null;
  const ext = path.extname(originalFilename).toLowerCase();
  if (ext !== '.xlsx' && ext !== '.xls') return null;

  const stem = normalizeStem(originalFilename);

  if (
    stem.includes('grower_details_season')
    || stem.includes('grower_details')
    || (stem.includes('grower') && stem.includes('season'))
  ) {
    return 'grower';
  }

  if (
    stem.includes('staff_wise')
    || stem.includes('field_staff')
    || stem.includes('bonding_target')
    || (stem.includes('staff') && stem.includes('bonding'))
  ) {
    return 'staff';
  }

  return null;
}

function getJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  return {
    jobId: job.id,
    type: job.type,
    status: job.status,
    originalFilename: job.originalFilename,
    error: job.error,
    totals: job.totals,
    logs: job.logs.slice(-80),
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

function pushLog(job, stage, message, detail = {}) {
  job.logs.push({
    at: new Date().toISOString(),
    stage,
    message,
    detail,
  });
  if (job.logs.length > MAX_LOG_LINES) {
    job.logs.splice(0, job.logs.length - MAX_LOG_LINES);
  }
}

async function executeJob(job) {
  job.status = 'running';
  job.startedAt = new Date().toISOString();
  pushLog(job, 'start', job.type === 'staff' ? 'Starting staff import…' : 'Starting grower import…');

  try {
    const result = await runPurchyGrowerImport({
      filePath: job.type === 'grower' ? job.filePath : undefined,
      staffFilePath: job.type === 'staff' ? job.filePath : undefined,
      staffOnly: job.type === 'staff',
      onProgress: (stage, detail, message) => {
        pushLog(job, stage, message, detail);
      },
    });
    job.totals = result.totals;
    job.status = 'completed';
    pushLog(job, 'complete', 'Import completed successfully.', { totals: result.totals });
  } catch (err) {
    job.status = 'failed';
    job.error = err.message || 'Import failed.';
    pushLog(job, 'error', job.error);
    console.error('Purchy auto-import failed:', err);
  } finally {
    job.finishedAt = new Date().toISOString();
  }
}

/**
 * Queue background import for a Purchy upload slot (grower | staff).
 * @returns {{ jobId: string, type: string, status: string }}
 */
function schedulePurchyImportBySlot(slot, absolutePath, originalFilename) {
  const meta = PURCHY_SLOTS[slot];
  if (!meta) throw new Error(`Unknown Purchy slot: ${slot}`);

  const jobId = randomUUID();
  const job = {
    id: jobId,
    type: slot,
    status: 'queued',
    originalFilename,
    filePath: absolutePath,
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
      console.error('Purchy import job crashed:', err);
    });
  });

  console.log(`Purchy import queued (${slot}): ${originalFilename} (job ${jobId})`);
  return { jobId, type: slot, status: 'queued' };
}

/**
 * If filename matches a Purchy workbook, queue background import.
 * @returns {{ jobId: string, type: string, status: string } | null}
 */
function schedulePurchyImportIfMatch(originalFilename, absolutePath) {
  const type = detectPurchyUploadType(originalFilename);
  if (!type) return null;
  return schedulePurchyImportBySlot(type, absolutePath, originalFilename);
}

module.exports = {
  detectPurchyUploadType,
  schedulePurchyImportIfMatch,
  schedulePurchyImportBySlot,
  getPurchyImportJob: getJob,
};
