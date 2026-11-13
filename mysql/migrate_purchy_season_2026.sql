-- Grower Intelligence 2026-27 season columns and loyalty window (2021-2025).
-- Does not rewrite existing supply values. Re-import the 2026-27 workbook after applying.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_purchy_season_2026.sql

USE `__MYSQL_DATABASE__`;

SET @db = DATABASE();

INSERT IGNORE INTO `purchy_years` (`year`, `year_order`) VALUES ('2026', 7);

-- The summary view freezes its column list. Drop it so new columns and the
-- rebuilt loyalty column can be added, then recreate it at the end.
DROP VIEW IF EXISTS `purchy_grower_summary_v`;

-- supply_2025
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchy_grower_summary' AND COLUMN_NAME = 'supply_2025'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `purchy_grower_summary` ADD COLUMN `supply_2025` DOUBLE NULL AFTER `weight_qty_2025`',
  'SELECT ''supply_2025 already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- bquota2025, bond2025, issue25, indqty25, wt25
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchy_grower_summary' AND COLUMN_NAME = 'issue25'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `purchy_grower_summary`
     ADD COLUMN `bquota2025` BIGINT NULL AFTER `indent_failer_qty`,
     ADD COLUMN `bond2025` DOUBLE NULL AFTER `bquota2025`,
     ADD COLUMN `issue25` BIGINT NULL AFTER `bond2025`,
     ADD COLUMN `indqty25` BIGINT NULL AFTER `issue25`,
     ADD COLUMN `wt25` BIGINT NULL AFTER `indqty25`',
  'SELECT ''2025 history columns already exist'' AS message'
);


PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Loyalty counted 2020-2024. Current file's five prior seasons are 2021-2025.
SET @old_loyalty = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchy_grower_summary' AND COLUMN_NAME = 'years_supplied_2020_2024'
);
SET @sql = IF(
  @old_loyalty = 1,
  'ALTER TABLE `purchy_grower_summary` DROP COLUMN `loyalty_slicer`',
  'SELECT ''loyalty window already uses 2021-2025'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  @old_loyalty = 1,
  'ALTER TABLE `purchy_grower_summary` DROP COLUMN `years_supplied_2020_2024`',
  'SELECT ''years_supplied_2020_2024 already dropped'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @new_loyalty = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchy_grower_summary' AND COLUMN_NAME = 'years_supplied_2021_2025'
);
SET @sql = IF(
  @new_loyalty = 0,
  'ALTER TABLE `purchy_grower_summary`
     ADD COLUMN `years_supplied_2021_2025` TINYINT
       GENERATED ALWAYS AS (
         IF(IFNULL(`supply_2021`, 0) > 0, 1, 0) +
         IF(IFNULL(`supply_2022`, 0) > 0, 1, 0) +
         IF(IFNULL(`supply_2023`, 0) > 0, 1, 0) +
         IF(IFNULL(`supply_2024`, 0) > 0, 1, 0) +
         IF(IFNULL(`supply_2025`, 0) > 0, 1, 0)
       ) STORED,
     ADD COLUMN `loyalty_slicer` VARCHAR(32)
       GENERATED ALWAYS AS (
         CASE `years_supplied_2021_2025`
           WHEN 5 THEN ''5. Supplied 5 years''
           WHEN 4 THEN ''4. Supplied 4 years''
           WHEN 3 THEN ''3. Supplied 3 years''
           WHEN 2 THEN ''2. Supplied 2 years''
           WHEN 1 THEN ''1. Supplied 1 year''
           ELSE ''0. Never supplied''
         END
       ) STORED,
     ADD INDEX `idx_purchy_gs_loyalty` (`loyalty_slicer`)',
  'SELECT ''years_supplied_2021_2025 already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE OR REPLACE VIEW `purchy_grower_summary_v` AS
SELECT g.* FROM `purchy_grower_summary` g;
