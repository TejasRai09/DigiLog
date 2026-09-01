-- Extend data_upload_files for Management Dashboard import audit
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_data_upload_import_meta.sql

SET @db = DATABASE();

-- dataset
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'data_upload_files' AND COLUMN_NAME = 'dataset'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `data_upload_files` ADD COLUMN `dataset` VARCHAR(50) NULL DEFAULT NULL AFTER `category`',
  'SELECT ''data_upload_files.dataset already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- import_status
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'data_upload_files' AND COLUMN_NAME = 'import_status'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `data_upload_files` ADD COLUMN `import_status` VARCHAR(20) NULL DEFAULT NULL AFTER `dataset`',
  'SELECT ''data_upload_files.import_status already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- rows_imported
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'data_upload_files' AND COLUMN_NAME = 'rows_imported'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `data_upload_files` ADD COLUMN `rows_imported` INT UNSIGNED NULL DEFAULT NULL AFTER `import_status`',
  'SELECT ''data_upload_files.rows_imported already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- rows_skipped
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'data_upload_files' AND COLUMN_NAME = 'rows_skipped'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `data_upload_files` ADD COLUMN `rows_skipped` INT UNSIGNED NULL DEFAULT NULL AFTER `rows_imported`',
  'SELECT ''data_upload_files.rows_skipped already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- date_min
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'data_upload_files' AND COLUMN_NAME = 'date_min'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `data_upload_files` ADD COLUMN `date_min` DATE NULL DEFAULT NULL AFTER `rows_skipped`',
  'SELECT ''data_upload_files.date_min already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- date_max
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'data_upload_files' AND COLUMN_NAME = 'date_max'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `data_upload_files` ADD COLUMN `date_max` DATE NULL DEFAULT NULL AFTER `date_min`',
  'SELECT ''data_upload_files.date_max already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- import_error
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'data_upload_files' AND COLUMN_NAME = 'import_error'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `data_upload_files` ADD COLUMN `import_error` VARCHAR(500) NULL DEFAULT NULL AFTER `date_max`',
  'SELECT ''data_upload_files.import_error already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- index on dataset
SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'data_upload_files' AND INDEX_NAME = 'idx_data_upload_dataset'
);
SET @sql = IF(
  @idx_exists = 0,
  'ALTER TABLE `data_upload_files` ADD INDEX `idx_data_upload_dataset` (`dataset`, `created_at` DESC)',
  'SELECT ''idx_data_upload_dataset already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
