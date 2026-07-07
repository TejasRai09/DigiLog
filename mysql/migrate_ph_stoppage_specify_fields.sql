-- Optional "Please specify" text when Section/Machinery/Category = Others or Sub-Section = OTHERS
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_ph_stoppage_specify_fields.sql

USE `__MYSQL_DATABASE__`;

SET @db = DATABASE();

SET @has = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ph_stoppage' AND COLUMN_NAME = 'section_specify'
);
SET @sql = IF(
  @has = 0,
  'ALTER TABLE `ph_stoppage`
     ADD COLUMN `section_specify` VARCHAR(100) DEFAULT NULL AFTER `section`,
     ADD COLUMN `sub_section_specify` VARCHAR(100) DEFAULT NULL AFTER `sub_section`,
     ADD COLUMN `machinery_specify` VARCHAR(100) DEFAULT NULL AFTER `machinery`,
     ADD COLUMN `category_specify` VARCHAR(100) DEFAULT NULL AFTER `category`',
  'SELECT ''ph_stoppage specify columns already exist'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
