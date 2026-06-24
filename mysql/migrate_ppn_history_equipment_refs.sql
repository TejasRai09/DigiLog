-- Multiselect equipment mapping for ppn_history (JSON array of section + sub_section).
-- Apply: cd backend && node scripts/apply-sql-file.js ../mysql/migrate_ppn_history_equipment_refs.sql

USE __MYSQL_DATABASE__;

SET @db = DATABASE();

SET @has_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ppn_history' AND COLUMN_NAME = 'equipment_refs'
);

SET @sql = IF(
  @has_col = 0,
  'ALTER TABLE `ppn_history` ADD COLUMN `equipment_refs` JSON DEFAULT NULL AFTER `sub_section`',
  'SELECT ''ppn_history.equipment_refs already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Backfill single mappings into JSON array
UPDATE `ppn_history`
SET `equipment_refs` = JSON_ARRAY(JSON_OBJECT('section', `section`, 'sub_section', `sub_section`))
WHERE `equipment_refs` IS NULL
  AND `section` IS NOT NULL
  AND `sub_section` IS NOT NULL;
