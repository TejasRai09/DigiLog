-- loyalty_slicer follows the imported grower file.
-- 2025-26 counts Supply 2020-2024. 2026-27 counts supply 2021-2025.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_purchy_loyalty_by_season.sql

USE `__MYSQL_DATABASE__`;

SET @db = DATABASE();

SET @loyalty_generated = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchy_grower_summary'
    AND COLUMN_NAME = 'loyalty_slicer' AND EXTRA LIKE '%GENERATED%'
);

SET @sql = IF(
  @loyalty_generated = 1,
  'DROP VIEW IF EXISTS `purchy_grower_summary_v`',
  'SELECT ''loyalty_slicer is already stored'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  @loyalty_generated = 1,
  'ALTER TABLE `purchy_grower_summary` DROP COLUMN `loyalty_slicer`',
  'SELECT ''skip drop loyalty_slicer'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @years_col = (
  SELECT COLUMN_NAME FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchy_grower_summary'
    AND COLUMN_NAME IN ('years_supplied_2021_2025', 'years_supplied_2020_2024')
  LIMIT 1
);
SET @sql = IF(
  @years_col IS NOT NULL,
  CONCAT('ALTER TABLE `purchy_grower_summary` DROP COLUMN `', @years_col, '`'),
  'SELECT ''no generated years_supplied column'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @loyalty_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchy_grower_summary' AND COLUMN_NAME = 'loyalty_slicer'
);
SET @sql = IF(
  @loyalty_exists = 0,
  'ALTER TABLE `purchy_grower_summary` ADD COLUMN `loyalty_slicer` VARCHAR(32) NULL',
  'SELECT ''loyalty_slicer column exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchy_grower_summary' AND INDEX_NAME = 'idx_purchy_gs_loyalty'
);
SET @sql = IF(
  @idx_exists = 0,
  'ALTER TABLE `purchy_grower_summary` ADD INDEX `idx_purchy_gs_loyalty` (`loyalty_slicer`)',
  'SELECT ''idx_purchy_gs_loyalty exists'' AS message'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE OR REPLACE VIEW `purchy_grower_summary_v` AS
SELECT g.* FROM `purchy_grower_summary` g;

SET @is_2026 = (
  SELECT IF(SUM(CASE WHEN IFNULL(supply_2025, 0) <> 0 OR IFNULL(issue25, 0) <> 0 THEN 1 ELSE 0 END) > 0, 1, 0)
  FROM purchy_grower_summary
);

UPDATE purchy_grower_summary
SET loyalty_slicer = CASE
  WHEN @is_2026 = 1 THEN
    CASE (
      IF(IFNULL(supply_2021, 0) > 0, 1, 0) + IF(IFNULL(supply_2022, 0) > 0, 1, 0) +
      IF(IFNULL(supply_2023, 0) > 0, 1, 0) + IF(IFNULL(supply_2024, 0) > 0, 1, 0) +
      IF(IFNULL(supply_2025, 0) > 0, 1, 0)
    )
      WHEN 5 THEN '5. Supplied 5 years'
      WHEN 4 THEN '4. Supplied 4 years'
      WHEN 3 THEN '3. Supplied 3 years'
      WHEN 2 THEN '2. Supplied 2 years'
      WHEN 1 THEN '1. Supplied 1 year'
      ELSE '0. Never supplied'
    END
  ELSE
    CASE (
      IF(IFNULL(supply_2020, 0) > 0, 1, 0) + IF(IFNULL(supply_2021, 0) > 0, 1, 0) +
      IF(IFNULL(supply_2022, 0) > 0, 1, 0) + IF(IFNULL(supply_2023, 0) > 0, 1, 0) +
      IF(IFNULL(supply_2024, 0) > 0, 1, 0)
    )
      WHEN 5 THEN '5. Supplied 5 years'
      WHEN 4 THEN '4. Supplied 4 years'
      WHEN 3 THEN '3. Supplied 3 years'
      WHEN 2 THEN '2. Supplied 2 years'
      WHEN 1 THEN '1. Supplied 1 year'
      ELSE '0. Never supplied'
    END
END;

INSERT INTO portal_settings (setting_key, setting_value)
VALUES ('purchy_current_season_year', IF(@is_2026 = 1, '2026', '2025'))
ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
