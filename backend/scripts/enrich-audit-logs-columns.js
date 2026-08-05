/**
 * Idempotent enrich of audit_logs columns (local/prod helper).
 * Usage: node scripts/enrich-audit-logs-columns.js
 */
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { getRequiredDatabaseName, getServerConnectionOptions } = require('../config/databaseName');

const COLUMNS = [
  ['user_department', 'VARCHAR(255) NULL DEFAULT NULL AFTER `user_role`'],
  ['success', 'TINYINT(1) NULL DEFAULT NULL AFTER `status_code`'],
  ['action_type', 'VARCHAR(20) NULL DEFAULT NULL AFTER `success`'],
  ['module', 'VARCHAR(100) NULL DEFAULT NULL AFTER `action_summary`'],
  ['module_key', 'VARCHAR(64) NULL DEFAULT NULL AFTER `module`'],
  ['resource_type', 'VARCHAR(64) NULL DEFAULT NULL AFTER `module_key`'],
  ['resource_id', 'VARCHAR(64) NULL DEFAULT NULL AFTER `resource_type`'],
  ['resource_name', 'VARCHAR(255) NULL DEFAULT NULL AFTER `resource_id`'],
  ['display_path', 'VARCHAR(500) NULL DEFAULT NULL AFTER `resource_name`'],
  ['screen', 'VARCHAR(100) NULL DEFAULT NULL AFTER `display_path`'],
  ['duration_ms', 'INT NULL DEFAULT NULL AFTER `screen`'],
];

const INDEXES = [
  ['audit_logs_action_type_idx', 'action_type'],
  ['audit_logs_module_key_idx', 'module_key'],
  ['audit_logs_status_code_idx', 'status_code'],
  ['audit_logs_success_idx', 'success'],
];

async function main() {
  const databaseName = getRequiredDatabaseName();
  const conn = await mysql.createConnection({
    ...getServerConnectionOptions(),
    database: databaseName,
  });

  for (const [name, def] of COLUMNS) {
    try {
      await conn.query(`ALTER TABLE audit_logs ADD COLUMN \`${name}\` ${def}`);
      console.log('added', name);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log('exists', name);
      else throw e;
    }
  }

  for (const [iname, col] of INDEXES) {
    try {
      await conn.query(`CREATE INDEX \`${iname}\` ON audit_logs (\`${col}\`)`);
      console.log('index', iname);
    } catch (e) {
      if (e.code === 'ER_DUP_KEYNAME') console.log('index exists', iname);
      else throw e;
    }
  }

  await conn.end();
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
