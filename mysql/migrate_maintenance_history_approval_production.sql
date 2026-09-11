-- Production House HOD maintenance history approval
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval_production.sql

USE `__MYSQL_DATABASE__`;

-- Expand domain enum to include production
ALTER TABLE `maintenance_history_approval_request`
  MODIFY COLUMN `domain` ENUM('sugar', 'power', 'production') NOT NULL;

-- Portal settings for Production House
INSERT INTO `portal_settings` (`setting_key`, `setting_value`)
VALUES
  ('mh_approval_production_enabled', '0'),
  ('mh_approval_production_hod_user_id', ''),
  ('mh_approval_production_digest_time', '22:00'),
  ('mh_approval_production_digest_last_sent_date', '')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;

SET @db := DATABASE();

-- phn_history.version (optimistic concurrency for conflict detection)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'phn_history' AND COLUMN_NAME = 'version'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `phn_history` ADD COLUMN `version` INT NOT NULL DEFAULT 1 AFTER `img_after`',
  'SELECT ''phn_history.version already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- phn_history.documents (parity with sugar/power apply path)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'phn_history' AND COLUMN_NAME = 'documents'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `phn_history` ADD COLUMN `documents` JSON DEFAULT NULL AFTER `version`',
  'SELECT ''phn_history.documents already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- phn_history.equipment_refs (parity with sugar/power apply path)
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'phn_history' AND COLUMN_NAME = 'equipment_refs'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `phn_history` ADD COLUMN `equipment_refs` JSON DEFAULT NULL AFTER `sub_section`',
  'SELECT ''phn_history.equipment_refs already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
