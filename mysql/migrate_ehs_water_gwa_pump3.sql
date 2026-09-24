-- EHS Water Dashboard — Ground Water Abstraction: Pump 3 (Admin)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_ehs_water_gwa_pump3.sql

USE `__MYSQL_DATABASE__`;

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_water_gwa' AND COLUMN_NAME = 'gw_pump3_meter'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `ehs_water_gwa` ADD COLUMN `gw_pump3_meter` DECIMAL(12,2) DEFAULT NULL AFTER `gw_pump2_ext_kl`',
  'SELECT ''ehs_water_gwa.gw_pump3_meter already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_water_gwa' AND COLUMN_NAME = 'gw_pump3_ext_kl'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `ehs_water_gwa` ADD COLUMN `gw_pump3_ext_kl` DECIMAL(10,2) DEFAULT NULL AFTER `gw_pump3_meter`',
  'SELECT ''ehs_water_gwa.gw_pump3_ext_kl already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
