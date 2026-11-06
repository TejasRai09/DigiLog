-- Outcome text the user saw, plus the technical error for IT.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_audit_outcome.sql

USE `__MYSQL_DATABASE__`;

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'outcome_message'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `audit_logs` ADD COLUMN `outcome_message` VARCHAR(500) NULL DEFAULT NULL AFTER `action_summary`',
  'SELECT ''audit_logs.outcome_message already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = 'error_detail'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `audit_logs` ADD COLUMN `error_detail` VARCHAR(1000) NULL DEFAULT NULL AFTER `outcome_message`',
  'SELECT ''audit_logs.error_detail already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
