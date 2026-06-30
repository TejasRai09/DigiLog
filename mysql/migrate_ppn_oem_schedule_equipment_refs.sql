-- Store multiple equipment refs per OEM schedule row (JSON array).
-- Apply: cd backend && node scripts/apply-sql-file.js ../mysql/migrate_ppn_oem_schedule_equipment_refs.sql
-- Safe to re-run: skips if column already exists.

USE __MYSQL_DATABASE__;

SET @db = DATABASE();

SET @has_refs = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ppn_oem_schedule' AND COLUMN_NAME = 'equipment_refs'
);

SET @sql = IF(
  @has_refs = 0,
  'ALTER TABLE `ppn_oem_schedule`
     ADD COLUMN `equipment_refs` JSON DEFAULT NULL AFTER `sub_section`',
  'SELECT ''ppn_oem_schedule.equipment_refs already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `ppn_oem_schedule`
SET `equipment_refs` = JSON_ARRAY(JSON_OBJECT('section', `section`, 'sub_section', `sub_section`))
WHERE `equipment_refs` IS NULL
  AND `section` IS NOT NULL
  AND `sub_section` IS NOT NULL;
