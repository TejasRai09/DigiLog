-- Equipment link, photos, and documents on maintenance notes.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_maintenance_notes_attachments.sql
-- Safe to re-run: skips columns that already exist.

USE `__MYSQL_DATABASE__`;

SET @db = DATABASE();

SET @has_node = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'maintenance_note' AND COLUMN_NAME = 'equipment_node_id'
);
SET @sql_node = IF(
  @has_node = 0,
  'ALTER TABLE `maintenance_note` ADD COLUMN `equipment_node_id` INT DEFAULT NULL AFTER `equipment_id`',
  'SELECT ''maintenance_note.equipment_node_id already exists'' AS message'
);
PREPARE stmt FROM @sql_node;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_flag = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'maintenance_note' AND COLUMN_NAME = 'no_equipment'
);
SET @sql_flag = IF(
  @has_flag = 0,
  'ALTER TABLE `maintenance_note` ADD COLUMN `no_equipment` TINYINT(1) NOT NULL DEFAULT 0 AFTER `equipment_name`',
  'SELECT ''maintenance_note.no_equipment already exists'' AS message'
);
PREPARE stmt FROM @sql_flag;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_images = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'maintenance_note' AND COLUMN_NAME = 'images'
);
SET @sql_images = IF(
  @has_images = 0,
  'ALTER TABLE `maintenance_note` ADD COLUMN `images` MEDIUMTEXT DEFAULT NULL AFTER `activity_description`',
  'SELECT ''maintenance_note.images already exists'' AS message'
);
PREPARE stmt FROM @sql_images;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_docs = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'maintenance_note' AND COLUMN_NAME = 'documents'
);
SET @sql_docs = IF(
  @has_docs = 0,
  'ALTER TABLE `maintenance_note` ADD COLUMN `documents` JSON DEFAULT NULL AFTER `images`',
  'SELECT ''maintenance_note.documents already exists'' AS message'
);
PREPARE stmt FROM @sql_docs;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE `maintenance_note`
  MODIFY COLUMN `equipment_name` VARCHAR(500) DEFAULT NULL;

SET @has_type = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'maintenance_note' AND COLUMN_NAME = 'activity_type'
);
SET @sql_type = IF(
  @has_type = 0,
  'ALTER TABLE `maintenance_note` ADD COLUMN `activity_type` VARCHAR(40) DEFAULT NULL AFTER `no_equipment`',
  'SELECT ''maintenance_note.activity_type already exists'' AS message'
);
PREPARE stmt FROM @sql_type;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_details = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'maintenance_note' AND COLUMN_NAME = 'activity_details'
);
SET @sql_details = IF(
  @has_details = 0,
  'ALTER TABLE `maintenance_note` ADD COLUMN `activity_details` TEXT DEFAULT NULL AFTER `activity_description`',
  'SELECT ''maintenance_note.activity_details already exists'' AS message'
);
PREPARE stmt FROM @sql_details;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `maintenance_note`
SET `activity_details` = `activity_description`
WHERE CHAR_LENGTH(`activity_description`) > 80
  AND (`activity_details` IS NULL OR `activity_details` = '');

UPDATE `maintenance_note`
SET `activity_description` = LEFT(`activity_description`, 80)
WHERE CHAR_LENGTH(`activity_description`) > 80;

ALTER TABLE `maintenance_note`
  MODIFY COLUMN `activity_description` VARCHAR(80) NOT NULL;
