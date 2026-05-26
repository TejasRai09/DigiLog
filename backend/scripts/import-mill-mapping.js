/**
 * Refresh the mill thermal-report mapping tables from Excel files dropped into
 *   DigiLog/backend/backlog-data/mill data/
 *     - Data_Mill.xlsx            → data_mill_mapping       (variable, machine, equipment_name)
 *     - DataShredder_Names.xlsx   → data_shredder_mapping   (variable, machinery, variable_name)
 *     - DataLube_Names.xlsx       → data_lube_mapping       (variable, machinery, variable_name)
 *
 * The tables are recreated if missing (CREATE TABLE IF NOT EXISTS), then fully
 * replaced with the contents of the xlsx files. The same refresh runs
 * automatically whenever an admin re-uploads one of these files via the Data
 * Upload module (see controllers/dataUpload.controller.js). Use this script
 * for the initial seed or to re-sync from local files.
 *
 *   npm run db:mill-mapping
 */

const path = require('path');
const fs = require('fs');
const { pool } = require('../config/mysql');
const { MAPPINGS, refreshFromFile } = require('../utils/millMappingSync');

const DATA_DIR = path.join(__dirname, '..', 'backlog-data', 'mill data');

const SOURCE_FILES = [
  { cfg: MAPPINGS.data_mill, file: 'Data_Mill.xlsx' },
  { cfg: MAPPINGS.data_shredder_names, file: 'DataShredder_Names.xlsx' },
  { cfg: MAPPINGS.data_lube_names, file: 'DataLube_Names.xlsx' },
];

async function main() {
  try {
    for (const { cfg, file } of SOURCE_FILES) {
      const filePath = path.join(DATA_DIR, file);
      if (!fs.existsSync(filePath)) {
        console.warn(`[skip] ${cfg.label}: file not found at ${filePath}`);
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const result = await refreshFromFile(cfg, filePath);
      console.log(
        `${result.status === 'ok' ? '[ok]' : `[${result.status}]`} ${result.table}: ${result.rows} rows`,
      );
    }
    console.log('Mill mapping import complete.');
  } catch (err) {
    console.error('Mill mapping import failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
