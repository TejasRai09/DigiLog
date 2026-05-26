/**
 * Shared "refresh mill mapping tables from an xlsx file" logic.
 *
 * Used by:
 *   - scripts/import-mill-mapping.js      (bulk seed from backend/backlog-data/mill data/)
 *   - controllers/dataUpload.controller.js (auto-sync when admin uploads a fresh reference file)
 *
 * Each mapping is keyed by the *original* filename (case-insensitive, stem only)
 * so users renaming a file to e.g. `data_mill.xlsx` or `DATA_MILL.xlsx` still works.
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { pool } = require('../config/mysql');

const MAPPINGS = {
  data_mill: {
    label: 'Data_Mill',
    matchStems: ['data_mill', 'datamill'],
    table: 'data_mill_mapping',
    headerAliases: {
      variable: ['variable', 'variables', 'var'],
      machine: ['machine', 'machinery'],
      label: ['equipment name', 'equipment_name', 'variable name', 'variabe name'],
    },
    insertColumns: ['variable', 'machine', 'equipment_name', 'sort_order'],
    createSql: `
      CREATE TABLE IF NOT EXISTS \`data_mill_mapping\` (
        \`variable\`        VARCHAR(80)  NOT NULL,
        \`machine\`         VARCHAR(100) NOT NULL,
        \`equipment_name\`  VARCHAR(150) NOT NULL,
        \`sort_order\`      INT          NOT NULL DEFAULT 0,
        \`updated_at\`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`variable\`),
        KEY \`idx_data_mill_machine\` (\`machine\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `,
  },
  data_shredder_names: {
    label: 'DataShredder_Names',
    matchStems: ['datashredder_names', 'data_shredder_names', 'datashreddernames', 'shredder_names'],
    table: 'data_shredder_mapping',
    headerAliases: {
      variable: ['variable', 'variables', 'var'],
      machine: ['machinery', 'machine'],
      label: ['variable name', 'variabe name', 'equipment name', 'equipment_name'],
    },
    insertColumns: ['variable', 'machinery', 'variable_name', 'sort_order'],
    createSql: `
      CREATE TABLE IF NOT EXISTS \`data_shredder_mapping\` (
        \`variable\`       VARCHAR(80)  NOT NULL,
        \`machinery\`      VARCHAR(100) NOT NULL,
        \`variable_name\`  VARCHAR(150) NOT NULL,
        \`sort_order\`     INT          NOT NULL DEFAULT 0,
        \`updated_at\`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`variable\`),
        KEY \`idx_data_shredder_machinery\` (\`machinery\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `,
  },
  data_lube_names: {
    label: 'DataLube_Names',
    matchStems: ['datalube_names', 'data_lube_names', 'datalubenames', 'lube_names'],
    table: 'data_lube_mapping',
    headerAliases: {
      variable: ['variable', 'variables', 'var'],
      machine: ['machinery', 'machine'],
      label: ['variable name', 'variabe name', 'equipment name', 'equipment_name'],
    },
    insertColumns: ['variable', 'machinery', 'variable_name', 'sort_order'],
    createSql: `
      CREATE TABLE IF NOT EXISTS \`data_lube_mapping\` (
        \`variable\`       VARCHAR(80)  NOT NULL,
        \`machinery\`      VARCHAR(100) NOT NULL,
        \`variable_name\`  VARCHAR(150) NOT NULL,
        \`sort_order\`     INT          NOT NULL DEFAULT 0,
        \`updated_at\`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`variable\`),
        KEY \`idx_data_lube_machinery\` (\`machinery\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `,
  },
};

function norm(v) {
  return (v == null ? '' : String(v)).trim();
}

function indexHeader(headerRow, aliases) {
  const lowered = headerRow.map((h) => norm(h).toLowerCase());
  const out = {};
  for (const [key, candidates] of Object.entries(aliases)) {
    out[key] = -1;
    for (const c of candidates) {
      const i = lowered.indexOf(c.toLowerCase());
      if (i !== -1) {
        out[key] = i;
        break;
      }
    }
  }
  return out;
}

function readSheet(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: '',
    raw: false,
  });
}

/**
 * Identify which mill mapping a filename refers to. Returns the config or null.
 * Matches on the stem of the filename (without extension), case-insensitive,
 * stripping common separators so all of these resolve to the same target:
 *   "Data_Mill.xlsx", "data_mill.xlsx", "DataMill.xlsx", "data-mill.xlsx".
 */
function findMappingForFilename(filename) {
  if (!filename) return null;
  const ext = path.extname(filename).toLowerCase();
  if (ext !== '.xlsx' && ext !== '.xls') return null;
  const stem = path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[\s\-]+/g, '_');
  for (const cfg of Object.values(MAPPINGS)) {
    if (cfg.matchStems.includes(stem)) return cfg;
  }
  return null;
}

/**
 * Refresh a single mill mapping table from the given xlsx file path.
 * Returns `{ table, rows, status }` describing the outcome.
 */
async function refreshFromFile(cfg, filePath) {
  if (!fs.existsSync(filePath)) {
    return { table: cfg.table, status: 'missing-file', rows: 0 };
  }

  const rows = readSheet(filePath);
  if (rows.length < 2) {
    return { table: cfg.table, status: 'empty', rows: 0 };
  }

  const idx = indexHeader(rows[0], cfg.headerAliases);
  const missing = Object.entries(idx)
    .filter(([, i]) => i < 0)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `[${cfg.label}] missing required column(s): ${missing.join(', ')} — header was ${JSON.stringify(rows[0])}`,
    );
  }

  const seen = new Set();
  const inserts = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i] || [];
    const variable = norm(r[idx.variable]);
    const machine = norm(r[idx.machine]);
    const label = norm(r[idx.label]);
    if (!variable || !machine || !label) continue;
    if (seen.has(variable)) continue;
    seen.add(variable);
    inserts.push([variable, machine, label, inserts.length + 1]);
  }

  await pool.query(cfg.createSql);
  await pool.query(`TRUNCATE TABLE \`${cfg.table}\``);

  if (inserts.length === 0) {
    return { table: cfg.table, status: 'truncated-empty', rows: 0 };
  }

  const colList = cfg.insertColumns.map((c) => `\`${c}\``).join(', ');
  await pool.query(`INSERT INTO \`${cfg.table}\` (${colList}) VALUES ?`, [inserts]);

  return { table: cfg.table, status: 'ok', rows: inserts.length };
}

/**
 * Convenience: detect the mapping from `originalFilename` and refresh using the
 * file at `absolutePath`. Returns the same shape as `refreshFromFile`, or null
 * when the filename is not a mill mapping reference file (caller should skip).
 */
async function syncIfMillMappingFile(originalFilename, absolutePath) {
  const cfg = findMappingForFilename(originalFilename);
  if (!cfg) return null;
  return refreshFromFile(cfg, absolutePath);
}

module.exports = {
  MAPPINGS,
  findMappingForFilename,
  refreshFromFile,
  syncIfMillMappingFile,
};
