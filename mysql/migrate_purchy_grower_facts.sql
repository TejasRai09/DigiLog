-- Grower Intelligence performance:
--   1. Stored key / slicer columns on purchy_grower_summary (indexed, computed once on insert).
--   2. purchy_grower_facts_2025: per-grower 2025 Indent / Supply / Dishonour measures,
--      rebuilt after every Purchy import (purchyGrowerFacts.rebuildGrowerFacts).
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_purchy_grower_facts.sql
-- Then:  cd backend && npm run db:rebuild-purchy-facts

USE `__MYSQL_DATABASE__`;

SET @db = DATABASE();

SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'purchy_grower_summary' AND COLUMN_NAME = 'dishonour_bucket'
);
SET @sql = IF(
  @col_exists = 0,
  "ALTER TABLE `purchy_grower_summary`
    ADD COLUMN `grower_key` VARCHAR(32)
      GENERATED ALWAYS AS (CONCAT(`village_code`, '-', `grower_code`)) STORED,
    ADD COLUMN `grower_name_key` VARCHAR(300)
      GENERATED ALWAYS AS (CONCAT(`village_code`, '-', `grower_code`, '-', `grower_name`)) STORED,
    ADD COLUMN `village_name_key` VARCHAR(300)
      GENERATED ALWAYS AS (CONCAT(`village_code`, '-', `village_name`)) STORED,
    ADD COLUMN `years_supplied_2020_2024` TINYINT
      GENERATED ALWAYS AS (
        IF(IFNULL(`supply_2020`, 0) > 0, 1, 0) +
        IF(IFNULL(`supply_2021`, 0) > 0, 1, 0) +
        IF(IFNULL(`supply_2022`, 0) > 0, 1, 0) +
        IF(IFNULL(`supply_2023`, 0) > 0, 1, 0) +
        IF(IFNULL(`supply_2024`, 0) > 0, 1, 0)
      ) STORED,
    ADD COLUMN `loyalty_slicer` VARCHAR(32)
      GENERATED ALWAYS AS (
        CASE `years_supplied_2020_2024`
          WHEN 5 THEN '5. Supplied 5 years'
          WHEN 4 THEN '4. Supplied 4 years'
          WHEN 3 THEN '3. Supplied 3 years'
          WHEN 2 THEN '2. Supplied 2 years'
          WHEN 1 THEN '1. Supplied 1 year'
          ELSE '0. Never supplied'
        END
      ) STORED,
    ADD COLUMN `dishonour_bucket` VARCHAR(32)
      GENERATED ALWAYS AS (
        CASE
          WHEN IFNULL(`indent_qty`, 0) = 0 THEN 'No Indent'
          WHEN IFNULL(`indent_failer_qty`, 0) / `indent_qty` = 0 THEN '0% - No Failure'
          WHEN IFNULL(`indent_failer_qty`, 0) / `indent_qty` <= 0.2 THEN '1-20% Failure'
          WHEN IFNULL(`indent_failer_qty`, 0) / `indent_qty` <= 0.4 THEN '21-40% Failure'
          WHEN IFNULL(`indent_failer_qty`, 0) / `indent_qty` <= 0.6 THEN '41-60% Failure'
          WHEN IFNULL(`indent_failer_qty`, 0) / `indent_qty` <= 0.8 THEN '61-80% Failure'
          WHEN IFNULL(`indent_failer_qty`, 0) / `indent_qty` < 1 THEN '81-99% Failure'
          ELSE '100% Failure'
        END
      ) STORED,
    ADD INDEX `idx_purchy_gs_society_village_key` (`society_name`, `village_name_key`),
    ADD INDEX `idx_purchy_gs_village_name_key` (`village_name_key`),
    ADD INDEX `idx_purchy_gs_grower_name_key` (`grower_name_key`),
    ADD INDEX `idx_purchy_gs_loyalty` (`loyalty_slicer`),
    ADD INDEX `idx_purchy_gs_dishonour_bucket` (`dishonour_bucket`)",
  'SELECT ''purchy_grower_summary stored columns already exist'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE OR REPLACE VIEW `purchy_grower_summary_v` AS
SELECT g.* FROM `purchy_grower_summary` g;

CREATE TABLE IF NOT EXISTS `purchy_grower_facts_2025` (
  `village_code` INT NOT NULL,
  `grower_code` INT NOT NULL,
  `indent_count` INT NOT NULL DEFAULT 0,
  `indent_qty` BIGINT NOT NULL DEFAULT 0,
  `supply_count` INT NOT NULL DEFAULT 0,
  `supply_qty` DECIMAL(20,4) NOT NULL DEFAULT 0,
  `supply_netwt` DOUBLE NOT NULL DEFAULT 0,
  `dishonour_count` INT NOT NULL DEFAULT 0,
  `dishonour_qty` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`village_code`, `grower_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
