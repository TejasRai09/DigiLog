-- Per-employee Forms Hub view-only flag.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_users_forms_hub_view_only.sql

USE `__MYSQL_DATABASE__`;

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'users' AND COLUMN_NAME = 'forms_hub_view_only'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `users` ADD COLUMN `forms_hub_view_only` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_active`',
  'SELECT ''users.forms_hub_view_only already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
