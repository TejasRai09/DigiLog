-- Nullable columns so Gate Records and Center Records can list every live column.
-- Does not change columns the Cane Performance dashboard reads.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_cane_live_export_columns.sql

USE `__MYSQL_DATABASE__`;

SET @db = DATABASE();

-- g_ctc.ctc_minutes
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'g_ctc' AND COLUMN_NAME = 'ctc_minutes'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `g_ctc` ADD COLUMN `ctc_minutes` INT NULL',
  'SELECT ''g_ctc.ctc_minutes exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cnt_performance.c_code
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'cnt_performance' AND COLUMN_NAME = 'c_code'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `cnt_performance` ADD COLUMN `c_code` INT NULL',
  'SELECT ''cnt_performance.c_code exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cnt_performance.v_code
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'cnt_performance' AND COLUMN_NAME = 'v_code'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `cnt_performance` ADD COLUMN `v_code` INT NULL',
  'SELECT ''cnt_performance.v_code exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cnt_performance.g_code
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'cnt_performance' AND COLUMN_NAME = 'g_code'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `cnt_performance` ADD COLUMN `g_code` INT NULL',
  'SELECT ''cnt_performance.g_code exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cnt_performance.travel_to_center_minutes
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'cnt_performance' AND COLUMN_NAME = 'travel_to_center_minutes'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `cnt_performance` ADD COLUMN `travel_to_center_minutes` INT NULL',
  'SELECT ''cnt_performance.travel_to_center_minutes exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cnt_performance.total_ctc_minutes
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'cnt_performance' AND COLUMN_NAME = 'total_ctc_minutes'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `cnt_performance` ADD COLUMN `total_ctc_minutes` INT NULL',
  'SELECT ''cnt_performance.total_ctc_minutes exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cnt_performance.harvest_datetime
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'cnt_performance' AND COLUMN_NAME = 'harvest_datetime'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `cnt_performance` ADD COLUMN `harvest_datetime` DATETIME NULL',
  'SELECT ''cnt_performance.harvest_datetime exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
