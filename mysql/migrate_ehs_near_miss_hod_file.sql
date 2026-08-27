-- Accident Report (ehs_near_miss): replace HOD text sign-off fields with a file upload.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_ehs_near_miss_hod_file.sql
-- Safe to re-run.

USE `__MYSQL_DATABASE__`;

SET @db = DATABASE();

-- Add hod_signoff_file (data-URL of signed document)
SET @has_file = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_near_miss' AND COLUMN_NAME = 'hod_signoff_file'
);
SET @sql_add_file = IF(
  @has_file = 0,
  'ALTER TABLE `ehs_near_miss` ADD COLUMN `hod_signoff_file` MEDIUMTEXT DEFAULT NULL AFTER `hazard_identified`',
  'SELECT ''ehs_near_miss.hod_signoff_file already exists'' AS message'
);
PREPARE stmt FROM @sql_add_file;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add original filename
SET @has_name = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_near_miss' AND COLUMN_NAME = 'hod_signoff_file_name'
);
SET @sql_add_name = IF(
  @has_name = 0,
  'ALTER TABLE `ehs_near_miss` ADD COLUMN `hod_signoff_file_name` VARCHAR(255) DEFAULT NULL AFTER `hod_signoff_file`',
  'SELECT ''ehs_near_miss.hod_signoff_file_name already exists'' AS message'
);
PREPARE stmt FROM @sql_add_name;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop old free-text HOD sign-off columns
SET @has_comments = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_near_miss' AND COLUMN_NAME = 'hod_comments'
);
SET @sql_drop_comments = IF(
  @has_comments > 0,
  'ALTER TABLE `ehs_near_miss` DROP COLUMN `hod_comments`',
  'SELECT ''ehs_near_miss.hod_comments already dropped'' AS message'
);
PREPARE stmt FROM @sql_drop_comments;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_signed = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_near_miss' AND COLUMN_NAME = 'hod_signed'
);
SET @sql_drop_signed = IF(
  @has_signed > 0,
  'ALTER TABLE `ehs_near_miss` DROP COLUMN `hod_signed`',
  'SELECT ''ehs_near_miss.hod_signed already dropped'' AS message'
);
PREPARE stmt FROM @sql_drop_signed;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_position = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_near_miss' AND COLUMN_NAME = 'hod_position'
);
SET @sql_drop_position = IF(
  @has_position > 0,
  'ALTER TABLE `ehs_near_miss` DROP COLUMN `hod_position`',
  'SELECT ''ehs_near_miss.hod_position already dropped'' AS message'
);
PREPARE stmt FROM @sql_drop_position;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_date = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_near_miss' AND COLUMN_NAME = 'hod_date'
);
SET @sql_drop_date = IF(
  @has_date > 0,
  'ALTER TABLE `ehs_near_miss` DROP COLUMN `hod_date`',
  'SELECT ''ehs_near_miss.hod_date already dropped'' AS message'
);
PREPARE stmt FROM @sql_drop_date;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
