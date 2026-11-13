-- Grower Intelligence staff hierarchy: Overall Head and Head (above Zone Head).
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_purchy_staff_head_levels.sql

USE `__MYSQL_DATABASE__`;

SET @db = DATABASE();

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchy_field_staff' AND COLUMN_NAME = 'overall_head'
);
SET @sql = IF(
  @col_exists = 0,
  "ALTER TABLE `purchy_field_staff` ADD COLUMN `overall_head` VARCHAR(255) NULL AFTER `village_name`",
  "SELECT 'overall_head already exists' AS message"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchy_field_staff' AND COLUMN_NAME = 'head'
);
SET @sql = IF(
  @col_exists = 0,
  "ALTER TABLE `purchy_field_staff` ADD COLUMN `head` VARCHAR(255) NULL AFTER `overall_head`",
  "SELECT 'head already exists' AS message"
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
