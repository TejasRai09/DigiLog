-- Add file_upload_id tracking to Management Dashboard tables for undo support
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_data_upload_undo_support.sql

SET @db = DATABASE();

-- 1. centre_indent_data.file_upload_id
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'centre_indent_data' AND COLUMN_NAME = 'file_upload_id'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `centre_indent_data` ADD COLUMN `file_upload_id` INT NULL DEFAULT NULL AFTER `season_label`, ADD INDEX `idx_cid_file_upload_id` (`file_upload_id`)',
  'SELECT ''centre_indent_data.file_upload_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. centre_purchase_data.file_upload_id
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'centre_purchase_data' AND COLUMN_NAME = 'file_upload_id'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `centre_purchase_data` ADD COLUMN `file_upload_id` INT NULL DEFAULT NULL AFTER `season_label`, ADD INDEX `idx_cpd_file_upload_id` (`file_upload_id`)',
  'SELECT ''centre_purchase_data.file_upload_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. dmr_daily.file_upload_id
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dmr_daily' AND COLUMN_NAME = 'file_upload_id'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `dmr_daily` ADD COLUMN `file_upload_id` INT NULL DEFAULT NULL AFTER `SYRUP QTY ONDATE`, ADD INDEX `idx_dmr_file_upload_id` (`file_upload_id`)',
  'SELECT ''dmr_daily.file_upload_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

