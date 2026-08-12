-- Add documents JSON column to Sugar House and Power House maintenance history.
-- Apply: cd backend && node scripts/apply-sql-file.js ../mysql/migrate_history_documents.sql
-- Safe to re-run: skips columns that already exist.

USE __MYSQL_DATABASE__;

SET @db = DATABASE();

-- shn_history
SET @has_shn = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'shn_history' AND COLUMN_NAME = 'documents'
);
SET @sql_shn = IF(
  @has_shn = 0,
  'ALTER TABLE `shn_history` ADD COLUMN `documents` JSON DEFAULT NULL AFTER `img_after`',
  'SELECT ''shn_history.documents already exists'' AS message'
);
PREPARE stmt FROM @sql_shn;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ppn_history
SET @has_ppn = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ppn_history' AND COLUMN_NAME = 'documents'
);
SET @sql_ppn = IF(
  @has_ppn = 0,
  'ALTER TABLE `ppn_history` ADD COLUMN `documents` JSON DEFAULT NULL AFTER `img_after`',
  'SELECT ''ppn_history.documents already exists'' AS message'
);
PREPARE stmt FROM @sql_ppn;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
