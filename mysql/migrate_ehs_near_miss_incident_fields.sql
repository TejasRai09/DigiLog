-- Accident Report / Near Miss: incident category, extra documents, incident photos.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_ehs_near_miss_incident_fields.sql

USE `__MYSQL_DATABASE__`;

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_near_miss' AND COLUMN_NAME = 'incident_category'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `ehs_near_miss` ADD COLUMN `incident_category` VARCHAR(80) DEFAULT NULL AFTER `Time`',
  'SELECT ''ehs_near_miss.incident_category already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_near_miss' AND COLUMN_NAME = 'documents'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `ehs_near_miss` ADD COLUMN `documents` MEDIUMTEXT DEFAULT NULL AFTER `hod_signoff_file_name`',
  'SELECT ''ehs_near_miss.documents already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_near_miss' AND COLUMN_NAME = 'incident_photos'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `ehs_near_miss` ADD COLUMN `incident_photos` MEDIUMTEXT DEFAULT NULL AFTER `documents`',
  'SELECT ''ehs_near_miss.incident_photos already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `forms`
SET `name` = 'Accident Report / Near Miss Report',
    `description` = 'Log workplace accidents and near misses for investigation'
WHERE `form_key` = 'ehs_near_miss';
