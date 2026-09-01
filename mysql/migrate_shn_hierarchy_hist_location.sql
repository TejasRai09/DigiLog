-- Add Inst. History card Location to sugar house hierarchy leaves
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_shn_hierarchy_hist_location.sql

USE __MYSQL_DATABASE__;

SET @db = DATABASE();

SET @exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'shn_hierarchy_node'
    AND COLUMN_NAME = 'hist_location'
);

SET @sql = IF(
  @exists = 0,
  'ALTER TABLE `shn_hierarchy_node` ADD COLUMN `hist_location` VARCHAR(300) DEFAULT NULL AFTER `lookup_name`',
  'SELECT ''shn_hierarchy_node.hist_location already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
