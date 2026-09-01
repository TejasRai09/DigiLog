-- Link OEM schedule rows to equipment specification sub-group cards.
-- Apply: cd backend && node scripts/apply-sql-file.js ../mysql/migrate_ppn_oem_schedule_equipment.sql
-- Safe to re-run: skips if columns already exist.

USE __MYSQL_DATABASE__;

SET @db = DATABASE();

SET @has_section = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ppn_oem_schedule' AND COLUMN_NAME = 'section'
);

SET @sql = IF(
  @has_section = 0,
  'ALTER TABLE `ppn_oem_schedule`
     ADD COLUMN `section` VARCHAR(32) DEFAULT NULL AFTER `equip_id`,
     ADD COLUMN `sub_section` VARCHAR(200) DEFAULT NULL AFTER `section`,
     ADD INDEX idx_ppn_oem_schedule_equipment (equip_id, section, sub_section)',
  'SELECT ''ppn_oem_schedule section/sub_section columns already exist'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
