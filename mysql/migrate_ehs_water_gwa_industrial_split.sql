-- EHS Water Dashboard — Ground Water Abstraction: split Refinery / DS / Mill
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_ehs_water_gwa_industrial_split.sql

USE `__MYSQL_DATABASE__`;

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_water_gwa' AND COLUMN_NAME = 'ind_ds'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `ehs_water_gwa` ADD COLUMN `ind_ds` DECIMAL(10,2) DEFAULT NULL AFTER `ind_refinery`',
  'SELECT ''ehs_water_gwa.ind_ds already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_water_gwa' AND COLUMN_NAME = 'ind_mill'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `ehs_water_gwa` ADD COLUMN `ind_mill` DECIMAL(10,2) DEFAULT NULL AFTER `ind_ds`',
  'SELECT ''ehs_water_gwa.ind_mill already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
