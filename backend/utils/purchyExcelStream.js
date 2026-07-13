/**
 * Stream Purchy grower/staff workbooks — one sheet at a time, batch callbacks.
 * Avoids loading entire 100MB+ xlsx into memory.
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const ExcelJS = require('exceljs');
const {
  SHEET_NAMES,
  isStaffSheetName,
  SHEET_KEY_BY_NAME,
  cellRaw,
  mapGrowerSummaryRow,
  mapIndentRow,
  mapSupplyRow,
  mapDishonourRow,
  mapFieldStaffRow,
} = require('./purchyExcelImport');

function noopProgress() {}

const CSV_CANDIDATES = {
  summary: ['grower-summary.csv', 'Grower  Wise summary .csv', 'Grower Wise summary.csv'],
  indent: ['indent.csv', 'Grower Purchy wise Indent.csv'],
  supply: ['supply.csv', 'Grower Indent Purchy wise suppl.csv'],
  dishonour: ['dishonour.csv', 'Grower Purchy wise Indent Faile.csv'],
  staff: ['staff.csv', 'Main.csv'],
};

const ROW_MAPPER = {
  summary: (r, ctx) => mapGrowerSummaryRow(r, ctx.summarySeen),
  indent: (r) => mapIndentRow(r),
  supply: (r) => mapSupplyRow(r),
  dishonour: (r) => mapDishonourRow(r),
  staff: (r) => mapFieldStaffRow(r),
};

const SHEET_LABEL = {
  summary: 'Grower summary',
  indent: 'Indent',
  supply: 'Supply',
  dishonour: 'Dishonour',
  staff: 'Staff Main',
};

function resolveCsvFile(dir, sheetKey) {
  const candidates = CSV_CANDIDATES[sheetKey] || [];
  for (const name of candidates) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function buildRowObject(headers, rowValues) {
  const obj = {};
  headers.forEach((header, i) => {
    if (!header) return;
    obj[header] = cellRaw(rowValues[i + 1] ?? null);
  });
  return obj;
}

function extractHeaders(row) {
  const headers = [];
  const maxCol = row.cellCount || (row.values ? row.values.length - 1 : 0);
  for (let c = 1; c <= maxCol; c += 1) {
    const raw = row.getCell(c).value;
    headers.push(raw === null || raw === undefined ? '' : String(cellRaw(raw)).trim());
  }
  while (headers.length && headers[headers.length - 1] === '') headers.pop();
  return headers;
}

async function pushRow(sheetKey, ctx, mapped) {
  ctx.processed[sheetKey] += 1;
  if (!mapped) return;

  ctx.kept[sheetKey] += 1;
  ctx.buffer[sheetKey].push(mapped);

  if (ctx.buffer[sheetKey].length >= ctx.batchSize) {
    const chunk = ctx.buffer[sheetKey].splice(0, ctx.buffer[sheetKey].length);
    ctx.counts[sheetKey] = (ctx.counts[sheetKey] || 0) + chunk.length;
    // eslint-disable-next-line no-await-in-loop
    await ctx.onBatch(sheetKey, chunk);
  }

  const n = ctx.processed[sheetKey];
  if (n % 10000 === 0) {
    ctx.onProgress('parse_progress', {
      sheet: SHEET_LABEL[sheetKey],
      processed: n,
      kept: ctx.kept[sheetKey],
    });
  }
}

async function flushSheetBuffer(sheetKey, ctx) {
  if (!ctx.buffer[sheetKey]?.length) return;
  const chunk = ctx.buffer[sheetKey].splice(0, ctx.buffer[sheetKey].length);
  ctx.counts[sheetKey] = (ctx.counts[sheetKey] || 0) + chunk.length;
  await ctx.onBatch(sheetKey, chunk);
}

async function streamXlsxSheet(worksheetReader, sheetKey, ctx) {
  const { onProgress } = ctx;
  onProgress('sheet_read', { sheet: worksheetReader.name });
  onProgress('parse_start', { sheet: SHEET_LABEL[sheetKey] });

  let headers = null;
  ctx.processed[sheetKey] = 0;
  ctx.kept[sheetKey] = 0;
  ctx.buffer[sheetKey] = [];

  const mapper = ROW_MAPPER[sheetKey];
  /** Staff sheet: Power Query drops the final totals row. */
  let pendingStaffRow = null;

  // eslint-disable-next-line no-restricted-syntax
  for await (const row of worksheetReader) {
    if (row.number === 1) {
      headers = extractHeaders(row);
      continue;
    }
    if (!headers || !headers.some(Boolean)) continue;
    const record = buildRowObject(headers, row.values);
    const mapped = mapper(record, ctx);
    ctx.processed[sheetKey] += 1;

    if (sheetKey === 'staff') {
      if (pendingStaffRow) {
        ctx.kept[sheetKey] += 1;
        ctx.buffer[sheetKey].push(pendingStaffRow);
        if (ctx.buffer[sheetKey].length >= ctx.batchSize) {
          const chunk = ctx.buffer[sheetKey].splice(0, ctx.buffer[sheetKey].length);
          ctx.counts[sheetKey] = (ctx.counts[sheetKey] || 0) + chunk.length;
          // eslint-disable-next-line no-await-in-loop
          await ctx.onBatch(sheetKey, chunk);
        }
      }
      pendingStaffRow = mapped;
      continue;
    }

    // eslint-disable-next-line no-await-in-loop
    await pushRow(sheetKey, ctx, mapped);
  }

  await flushSheetBuffer(sheetKey, ctx);

  onProgress('parse_done', {
    sheet: SHEET_LABEL[sheetKey],
    rows: ctx.counts[sheetKey] || 0,
  });
  onProgress('sheet_read_done', {
    sheet: worksheetReader.name,
    rows: ctx.processed[sheetKey],
  });
}

async function streamGrowerWorkbook(filePath, options = {}) {
  const {
    batchSize = 500,
    onProgress = noopProgress,
    onBatch,
    sheets = ['summary', 'indent', 'supply', 'dishonour'],
  } = options;

  if (typeof onBatch !== 'function') {
    throw new Error('streamGrowerWorkbook requires onBatch(sheetKey, rows) callback');
  }

  const stat = fs.statSync(filePath);
  onProgress('file_start', {
    path: filePath,
    sizeMb: (stat.size / (1024 * 1024)).toFixed(1),
    mode: 'xlsx-stream',
  });
  onProgress('workbook_read_start', {});

  const ctx = {
    batchSize,
    onBatch,
    onProgress,
    summarySeen: new Set(),
    buffer: {},
    counts: {},
    processed: {},
    kept: {},
  };

  const wanted = new Set(sheets);
  const sheetNamesFound = [];

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    worksheets: 'emit',
    styles: 'ignore',
  });

  // eslint-disable-next-line no-restricted-syntax
  for await (const worksheetReader of reader) {
    sheetNamesFound.push(worksheetReader.name);
    const sheetKey = SHEET_KEY_BY_NAME[worksheetReader.name];

    if (sheetKey && wanted.has(sheetKey)) {
      // eslint-disable-next-line no-await-in-loop
      await streamXlsxSheet(worksheetReader, sheetKey, ctx);
    } else {
      // eslint-disable-next-line no-restricted-syntax, no-empty
      for await (const _row of worksheetReader) { /* drain unneeded sheet */ }
    }
  }

  onProgress('workbook_read_done', { sheets: sheetNamesFound.length, names: sheetNamesFound });
  onProgress('workbook_parse_done', {
    summary: ctx.counts.summary || 0,
    indent: ctx.counts.indent || 0,
    supply: ctx.counts.supply || 0,
    dishonour: ctx.counts.dishonour || 0,
  });

  return { counts: ctx.counts };
}

async function streamCsvFile(filePath, sheetKey, ctx) {
  const { onProgress } = ctx;
  onProgress('sheet_read', { sheet: path.basename(filePath) });
  onProgress('parse_start', { sheet: SHEET_LABEL[sheetKey] });

  ctx.processed[sheetKey] = 0;
  ctx.kept[sheetKey] = 0;
  ctx.buffer[sheetKey] = [];

  const mapper = ROW_MAPPER[sheetKey];
  const parser = fs.createReadStream(filePath).pipe(parse({
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }));

  // eslint-disable-next-line no-restricted-syntax
  for await (const record of parser) {
    // eslint-disable-next-line no-await-in-loop
    await pushRow(sheetKey, ctx, mapper(record, ctx));
  }

  await flushSheetBuffer(sheetKey, ctx);

  onProgress('parse_done', {
    sheet: SHEET_LABEL[sheetKey],
    rows: ctx.counts[sheetKey] || 0,
  });
  onProgress('sheet_read_done', {
    sheet: path.basename(filePath),
    rows: ctx.processed[sheetKey],
  });
}

async function streamGrowerCsvDir(csvDir, options = {}) {
  const {
    batchSize = 500,
    onProgress = noopProgress,
    onBatch,
    sheets = ['summary', 'indent', 'supply', 'dishonour'],
  } = options;

  if (typeof onBatch !== 'function') {
    throw new Error('streamGrowerCsvDir requires onBatch(sheetKey, rows) callback');
  }

  const dir = path.resolve(csvDir);
  if (!fs.existsSync(dir)) throw new Error(`CSV directory not found: ${dir}`);

  onProgress('file_start', { path: dir, mode: 'csv-dir' });

  const ctx = {
    batchSize,
    onBatch,
    onProgress,
    summarySeen: new Set(),
    buffer: {},
    counts: {},
    processed: {},
    kept: {},
  };

  // eslint-disable-next-line no-restricted-syntax
  for (const sheetKey of sheets) {
    const csvPath = resolveCsvFile(dir, sheetKey);
    if (!csvPath) {
      throw new Error(
        `Missing CSV for "${sheetKey}" in ${dir}. Expected one of: ${CSV_CANDIDATES[sheetKey].join(', ')}`,
      );
    }
    // eslint-disable-next-line no-await-in-loop
    await streamCsvFile(csvPath, sheetKey, ctx);
  }

  onProgress('workbook_parse_done', {
    summary: ctx.counts.summary || 0,
    indent: ctx.counts.indent || 0,
    supply: ctx.counts.supply || 0,
    dishonour: ctx.counts.dishonour || 0,
  });

  return { counts: ctx.counts };
}

async function streamStaffWorkbook(filePath, options = {}) {
  const { batchSize = 500, onProgress = noopProgress, onBatch } = options;
  if (typeof onBatch !== 'function') throw new Error('streamStaffWorkbook requires onBatch callback');

  const stat = fs.statSync(filePath);
  onProgress('file_start', {
    path: filePath,
    sizeMb: (stat.size / (1024 * 1024)).toFixed(1),
    mode: 'xlsx-stream-staff',
  });

  const ctx = {
    batchSize,
    onBatch,
    onProgress,
    summarySeen: new Set(),
    buffer: {},
    counts: {},
    processed: {},
    kept: {},
  };

  const reader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    sharedStrings: 'cache',
    hyperlinks: 'ignore',
    worksheets: 'emit',
    styles: 'ignore',
  });

  let found = false;
  let matchedSheet = null;
  // eslint-disable-next-line no-restricted-syntax
  for await (const worksheetReader of reader) {
    if (!found && (worksheetReader.name === SHEET_NAMES.staff || isStaffSheetName(worksheetReader.name))) {
      found = true;
      matchedSheet = worksheetReader.name;
      // eslint-disable-next-line no-await-in-loop
      await streamXlsxSheet(worksheetReader, 'staff', ctx);
    } else {
      // eslint-disable-next-line no-restricted-syntax, no-empty
      for await (const _row of worksheetReader) { /* skip */ }
    }
  }

  if (!found) {
    throw new Error(
      `Staff sheet not found. Expected "${SHEET_NAMES.staff}" or a sheet named Sheet1 / Field Staff.`,
    );
  }
  onProgress('staff_sheet_matched', { sheet: matchedSheet });
  return { counts: ctx.counts };
}

async function streamStaffCsv(csvPath, options = {}) {
  const { batchSize = 500, onProgress = noopProgress, onBatch } = options;
  const ctx = {
    batchSize,
    onBatch,
    onProgress,
    summarySeen: new Set(),
    buffer: {},
    counts: {},
    processed: {},
    kept: {},
  };
  onProgress('file_start', { path: csvPath, mode: 'csv-staff' });
  await streamCsvFile(csvPath, 'staff', ctx);
  return { counts: ctx.counts };
}

module.exports = {
  CSV_CANDIDATES,
  resolveCsvFile,
  streamGrowerWorkbook,
  streamGrowerCsvDir,
  streamStaffWorkbook,
  streamStaffCsv,
};
