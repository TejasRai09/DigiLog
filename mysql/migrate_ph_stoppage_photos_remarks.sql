-- Power stoppage: optional photos (max 2 stored as JSON) + remarks VARCHAR(150)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_ph_stoppage_photos_remarks.sql
-- Safe to re-run (checks column existence).

USE `__MYSQL_DATABASE__`;

SET @db = DATABASE();

SET @has_photos = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ph_stoppage' AND COLUMN_NAME = 'stoppage_photos'
);
SET @sql_photos = IF(
  @has_photos = 0,
  'ALTER TABLE `ph_stoppage` ADD COLUMN `stoppage_photos` MEDIUMTEXT DEFAULT NULL AFTER `remarks`',
  'SELECT ''ph_stoppage.stoppage_photos already exists'' AS message'
);
PREPARE stmt FROM @sql_photos;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `ph_stoppage`
SET `remarks` = LEFT(`remarks`, 150)
WHERE `remarks` IS NOT NULL AND CHAR_LENGTH(`remarks`) > 150;

ALTER TABLE `ph_stoppage`
  MODIFY COLUMN `remarks` VARCHAR(150) DEFAULT NULL;
