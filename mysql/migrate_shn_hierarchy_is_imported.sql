-- Mark Excel-imported sugar house hierarchy nodes (read-only in UI)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_shn_hierarchy_is_imported.sql

USE __MYSQL_DATABASE__;

SET @db = DATABASE();

SET @exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'shn_hierarchy_node'
    AND COLUMN_NAME = 'is_imported'
);

SET @sql = IF(
  @exists = 0,
  'ALTER TABLE `shn_hierarchy_node` ADD COLUMN `is_imported` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`',
  'SELECT ''shn_hierarchy_node.is_imported already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Existing rows were loaded from Excel import
UPDATE `shn_hierarchy_node` SET `is_imported` = 1 WHERE `is_imported` = 0;
