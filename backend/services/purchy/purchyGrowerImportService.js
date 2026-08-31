/**
 * Purchy grower/staff Excel import — callable from CLI script or data-upload auto-sync.
 * Does NOT call pool.end() (safe for long-lived API server).
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../../config/mysql');
const {
  streamGrowerWorkbook,
  streamStaffWorkbook,
} = require('../../utils/purchyExcelStream');

const BATCH = 500;

const TABLE_MAP = {
  summary: { table: 'purchy_grower_summary', label: 'Grower summary' },
  indent: { table: 'purchy_indent', label: 'Indent' },
  supply: { table: 'purchy_supply', label: 'Supply' },
  dishonour: { table: 'purchy_dishonour', label: 'Dishonour' },
  staff: { table: 'purchy_field_staff', label: 'Staff' },
};

const SUMMARY_COLS = [
  'village_code', 'grower_code', 'grower_name', 'grower_father_name', 'village_name',
  'centre_code', 'centre_name', 'supply_centre_code', 'supply_centre_name',
  'society_code', 'society_name', 'cul_area', 'survey_area', 'bond_area',
  'basic_quota', 'bonding', 'ad_bonding', 'total_bond', 'no_of_purchy_indent',
  'indent_qty', 'no_of_weight_purchy', 'weight_qty_2025',
  'supply_2024', 'supply_2023', 'supply_2022', 'supply_2021', 'supply_2020',
  'no_of_balance_purchy', 'balance_indent_qty', 'no_of_indent_failer_purchy', 'indent_failer_qty',
  'issue24', 'indqty24', 'wt24', 'supp2024', 'bquota2024', 'bond2024',
  'issue23', 'indqty23', 'wt23', 'supp2023', 'bquota2023', 'bond2023',
  'issue22', 'indqty22', 'wt22', 'supp2022', 'bquota2022', 'bond2022',
  'issue21', 'indqty21', 'wt21', 'supp2021', 'bquota2021', 'bond2021', 'standing_bond',
];

const INDENT_COLS = [
  'villagecode', 'growercode', 'growername', 'growerfather', 'villagename', 'societyname',
  'supplycentre', 'supplycentrename', 'societypurchy_no', 'issuedate', 'supplydate',
  'varietytype', 'supllymodeqty', 'supplymodecode', 'supplymodename',
];

const SUPPLY_COLS = [
  'villagecode', 'growercode', 'growername', 'growerfather', 'villagename',
  'purchsecentre', 'purchsecentrename', 'supplycentrecode', 'supplycentrename',
  'societypurchy_no', 'supplydate', 'millpurchy_no', 'purchasedate',
  'purchasemodecode', 'purchasemodename', 'varietytype', 'varietycode', 'varietyname',
  'grossweight', 'tareweight', 'joonaweight', 'netwt', 'societycode', 'societyname', 'purchasemodeqty',
];

const DISHONOUR_COLS = [
  'sl_no', 'village_code', 'grower_code', 'grower_name', 'grower_father_name',
  'society_name', 'center_name', 'village_name', 'mobile_no', 'issue_date', 'purchase_date',
  'society_purchy_no', 'mode_qty', 'purchasemodecode', 'purchasemodename', 'remarks',
];

const STAFF_COLS = [
  'village_code', 'village_name', 'village_staff', 'zonal_incharge', 'zonal_manager',
  'region', 'zone_head', 'sum_of_survey_area', 'bonding_area', 'basic_quota',
  'bonding', 'additinalbond', 'yield_per_ha', 'drwal_per_ha', 'target_estimated_cane_availbility',
];

const COLS_BY_KEY = {
  summary: SUMMARY_COLS,
  indent: INDENT_COLS,
  supply: SUPPLY_COLS,
  dishonour: DISHONOUR_COLS,
  staff: STAFF_COLS,
};

function formatProgressMessage(stage, detail = {}) {
  switch (stage) {
    case 'file_start':
      return `Reading ${path.basename(detail.path || 'file')}${detail.sizeMb ? ` (${detail.sizeMb} MB)` : ''}`;
    case 'workbook_read_start':
      return 'Opening workbook…';
    case 'workbook_read_done':
      return `Found ${detail.sheets || 0} sheet(s): ${(detail.names || []).join(', ')}`;
    case 'sheet_read':
      return `Reading sheet "${detail.sheet}"…`;
    case 'sheet_read_done':
      return `Sheet "${detail.sheet}" — ${Number(detail.rows || 0).toLocaleString()} rows scanned`;
    case 'parse_start':
      return `Importing ${detail.sheet}…`;
    case 'parse_progress':
      return `${detail.sheet}: ${Number(detail.processed || 0).toLocaleString()} rows scanned, ${Number(detail.kept || 0).toLocaleString()} kept`;
    case 'parse_done':
      return `${detail.sheet} complete — ${Number(detail.rows || 0).toLocaleString()} rows imported`;
    case 'workbook_parse_done':
      return `Parse complete — summary ${detail.summary}, indent ${detail.indent}, supply ${detail.supply}, dishonour ${detail.dishonour}`;
    case 'truncate_start':
      return detail.staffOnly ? 'Clearing staff table…' : 'Clearing Purchy tables…';
    case 'truncate_done':
      return 'Tables cleared.';
    case 'batch_insert':
      return `${detail.label}: ${Number(detail.total || 0).toLocaleString()} rows inserted`;
    case 'complete':
      return 'Import finished successfully.';
    case 'error':
      return detail.message || 'Import failed.';
    default:
      return stage;
  }
}

async function truncateStaffTable(conn) {
  await conn.query('TRUNCATE TABLE purchy_field_staff');
}

async function truncateGrowerTables(conn) {
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  await conn.query('TRUNCATE TABLE purchy_grower_summary');
  await conn.query('TRUNCATE TABLE purchy_indent');
  await conn.query('TRUNCATE TABLE purchy_supply');
  await conn.query('TRUNCATE TABLE purchy_dishonour');
  await conn.query('TRUNCATE TABLE purchy_field_staff');
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
}

async function insertChunk(conn, table, columns, rows) {
  if (!rows.length) return 0;
  const placeholders = rows.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${placeholders}`;
  const params = rows.flatMap((row) => columns.map((c) => row[c] ?? null));
  const [result] = await conn.query(sql, params);
  return result.affectedRows;
}

/**
 * @param {object} opts
 * @param {string} [opts.filePath] — grower workbook
 * @param {string} [opts.staffFilePath] — staff workbook
 * @param {boolean} [opts.staffOnly]
 * @param {number} [opts.batchSize]
 * @param {Function} [opts.onProgress] — (stage, detail, message) => void
 */
async function runPurchyGrowerImport(opts = {}) {
  const {
    filePath,
    staffFilePath,
    staffOnly = false,
    batchSize = BATCH,
    onProgress = () => {},
  } = opts;

  const emit = (stage, detail = {}) => {
    onProgress(stage, detail, formatProgressMessage(stage, detail));
  };

  if (staffOnly) {
    if (!staffFilePath || !fs.existsSync(staffFilePath)) {
      throw new Error('Staff file not found.');
    }
  } else if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Grower file not found.');
  }

  const totals = {};
  const batchCounters = {};
  const conn = await pool.getConnection();

  try {
    emit('truncate_start', { staffOnly });
    if (staffOnly) {
      await truncateStaffTable(conn);
    } else {
      await truncateGrowerTables(conn);
    }
    emit('truncate_done');

    const onBatch = async (sheetKey, rows) => {
      if (!rows.length) return;
      const meta = TABLE_MAP[sheetKey];
      const columns = COLS_BY_KEY[sheetKey];
      if (!meta || !columns) throw new Error(`Unknown sheet key: ${sheetKey}`);

      const inserted = await insertChunk(conn, meta.table, columns, rows);
      totals[sheetKey] = (totals[sheetKey] || 0) + inserted;
      batchCounters[sheetKey] = (batchCounters[sheetKey] || 0) + 1;
      emit('batch_insert', {
        sheetKey,
        label: meta.label,
        total: totals[sheetKey],
        batch: batchCounters[sheetKey],
      });
    };

    const streamOpts = {
      batchSize,
      onProgress: (stage, detail) => emit(stage, detail),
      onBatch,
    };

    if (!staffOnly) {
      const stat = fs.statSync(filePath);
      emit('file_start', {
        path: filePath,
        sizeMb: (stat.size / (1024 * 1024)).toFixed(1),
        mode: 'grower',
      });
      await streamGrowerWorkbook(path.resolve(filePath), streamOpts);
    }

    if (staffFilePath) {
      const stat = fs.statSync(staffFilePath);
      emit('file_start', {
        path: staffFilePath,
        sizeMb: (stat.size / (1024 * 1024)).toFixed(1),
        mode: 'staff',
      });
      await streamStaffWorkbook(path.resolve(staffFilePath), streamOpts);
    }

    emit('workbook_parse_done', {
      summary: (totals.summary || 0).toLocaleString(),
      indent: (totals.indent || 0).toLocaleString(),
      supply: (totals.supply || 0).toLocaleString(),
      dishonour: (totals.dishonour || 0).toLocaleString(),
      staff: (totals.staff || 0).toLocaleString(),
    });
    emit('complete', { totals });

    try {
      const { clearPurchyCache } = require('./purchyResponseCache');
      clearPurchyCache();
    } catch (cacheErr) {
      console.warn('Purchy cache clear after import failed:', cacheErr.message);
    }

    return {
      totals: {
        summary: totals.summary || 0,
        indent: totals.indent || 0,
        supply: totals.supply || 0,
        dishonour: totals.dishonour || 0,
        staff: totals.staff || 0,
      },
    };
  } finally {
    conn.release();
  }
}

module.exports = {
  runPurchyGrowerImport,
  formatProgressMessage,
  TABLE_MAP,
};
