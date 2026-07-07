-- Add Sugar CPU to Power Details breakup (ph_power)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_ph_power_sugar_cpu.sql

USE `__MYSQL_DATABASE__`;

SET @db = DATABASE();

SET @has_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ph_power' AND COLUMN_NAME = 'PowerConSugarCPU'
);
SET @sql_add = IF(
  @has_col = 0,
  'ALTER TABLE `ph_power` ADD COLUMN `PowerConSugarCPU` DOUBLE NULL DEFAULT NULL AFTER `PowerConColony`',
  'SELECT ''ph_power.PowerConSugarCPU already exists'' AS message'
);
PREPARE stmt FROM @sql_add;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
