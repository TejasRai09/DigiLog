-- Add maintenance_type to equipment maintenance history tables.
-- Apply: cd backend && node scripts/apply-sql-file.js ../mysql/migrate_history_maintenance_type.sql
-- Safe to re-run: skips tables/columns that already exist.

USE __MYSQL_DATABASE__;

SET @db = DATABASE();

-- ppn_history
SET @has_ppn = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ppn_history' AND COLUMN_NAME = 'maintenance_type'
);
SET @sql_ppn = IF(
  @has_ppn = 0,
  'ALTER TABLE `ppn_history` ADD COLUMN `maintenance_type` VARCHAR(20) DEFAULT NULL AFTER `svc`',
  'SELECT ''ppn_history.maintenance_type already exists'' AS message'
);
PREPARE stmt FROM @sql_ppn;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- mh_history
SET @has_mh = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'mh_history' AND COLUMN_NAME = 'maintenance_type'
);
SET @sql_mh = IF(
  @has_mh = 0,
  'ALTER TABLE `mh_history` ADD COLUMN `maintenance_type` VARCHAR(20) DEFAULT NULL AFTER `svc`',
  'SELECT ''mh_history.maintenance_type already exists'' AS message'
);
PREPARE stmt FROM @sql_mh;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- pp_history (legacy power plant)
SET @has_pp = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'pp_history' AND COLUMN_NAME = 'maintenance_type'
);
SET @sql_pp = IF(
  @has_pp = 0,
  'ALTER TABLE `pp_history` ADD COLUMN `maintenance_type` VARCHAR(20) DEFAULT NULL AFTER `svc`',
  'SELECT ''pp_history.maintenance_type already exists'' AS message'
);
PREPARE stmt FROM @sql_pp;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
