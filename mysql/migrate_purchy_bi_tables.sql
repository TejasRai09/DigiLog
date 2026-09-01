-- Purchy BI dashboard tables (Grower Performance + Dishonour Analysis)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_purchy_bi_tables.sql

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `purchy_years` (
  `year` VARCHAR(4) NOT NULL,
  `year_order` INT NOT NULL,
  PRIMARY KEY (`year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO `purchy_years` (`year`, `year_order`) VALUES
  ('2020', 1), ('2021', 2), ('2022', 3), ('2023', 4), ('2024', 5), ('2025', 6);

CREATE TABLE IF NOT EXISTS `purchy_grower_summary` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `village_code` INT NULL,
  `grower_code` INT NULL,
  `grower_name` VARCHAR(255) NULL,
  `grower_father_name` VARCHAR(255) NULL,
  `village_name` VARCHAR(255) NULL,
  `centre_code` INT NULL,
  `centre_name` VARCHAR(255) NULL,
  `supply_centre_code` INT NULL,
  `supply_centre_name` VARCHAR(255) NULL,
  `society_code` INT NULL,
  `society_name` VARCHAR(255) NULL,
  `cul_area` DOUBLE NULL,
  `survey_area` DOUBLE NULL,
  `bond_area` DOUBLE NULL,
  `basic_quota` BIGINT NULL,
  `bonding` BIGINT NULL,
  `ad_bonding` BIGINT NULL,
  `total_bond` BIGINT NULL,
  `no_of_purchy_indent` BIGINT NULL,
  `indent_qty` BIGINT NULL,
  `no_of_weight_purchy` BIGINT NULL,
  `weight_qty_2025` DOUBLE NULL,
  `supply_2024` DOUBLE NULL,
  `supply_2023` DOUBLE NULL,
  `supply_2022` DOUBLE NULL,
  `supply_2021` DOUBLE NULL,
  `supply_2020` DOUBLE NULL,
  `no_of_balance_purchy` BIGINT NULL,
  `balance_indent_qty` DOUBLE NULL,
  `no_of_indent_failer_purchy` BIGINT NULL,
  `indent_failer_qty` BIGINT NULL,
  `issue24` BIGINT NULL,
  `indqty24` BIGINT NULL,
  `wt24` BIGINT NULL,
  `supp2024` DOUBLE NULL,
  `bquota2024` BIGINT NULL,
  `bond2024` DOUBLE NULL,
  `issue23` BIGINT NULL,
  `indqty23` BIGINT NULL,
  `wt23` BIGINT NULL,
  `supp2023` DOUBLE NULL,
  `bquota2023` BIGINT NULL,
  `bond2023` DOUBLE NULL,
  `issue22` BIGINT NULL,
  `indqty22` BIGINT NULL,
  `wt22` BIGINT NULL,
  `supp2022` DOUBLE NULL,
  `bquota2022` BIGINT NULL,
  `bond2022` DOUBLE NULL,
  `issue21` BIGINT NULL,
  `indqty21` BIGINT NULL,
  `wt21` BIGINT NULL,
  `supp2021` DOUBLE NULL,
  `bquota2021` BIGINT NULL,
  `bond2021` BIGINT NULL,
  `standing_bond` VARCHAR(64) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_purchy_gs_village_grower` (`village_code`, `grower_code`),
  KEY `idx_purchy_gs_society` (`society_name`),
  KEY `idx_purchy_gs_village` (`village_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `purchy_indent` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `villagecode` INT NULL,
  `growercode` INT NULL,
  `growername` VARCHAR(255) NULL,
  `growerfather` VARCHAR(255) NULL,
  `villagename` VARCHAR(255) NULL,
  `societyname` VARCHAR(255) NULL,
  `supplycentre` INT NULL,
  `supplycentrename` VARCHAR(255) NULL,
  `societypurchy_no` VARCHAR(64) NULL,
  `issuedate` DATE NULL,
  `supplydate` DATE NULL,
  `varietytype` VARCHAR(64) NULL,
  `supllymodeqty` BIGINT NULL,
  `supplymodecode` BIGINT NULL,
  `supplymodename` VARCHAR(128) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_purchy_indent_grower` (`villagecode`, `growercode`),
  KEY `idx_purchy_indent_purchy_no` (`societypurchy_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `purchy_supply` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `villagecode` INT NULL,
  `growercode` INT NULL,
  `growername` VARCHAR(255) NULL,
  `growerfather` VARCHAR(255) NULL,
  `villagename` VARCHAR(255) NULL,
  `purchsecentre` INT NULL,
  `purchsecentrename` VARCHAR(255) NULL,
  `supplycentrecode` INT NULL,
  `supplycentrename` VARCHAR(255) NULL,
  `societypurchy_no` VARCHAR(64) NULL,
  `supplydate` DATE NULL,
  `millpurchy_no` VARCHAR(64) NULL,
  `purchasedate` DATE NULL,
  `purchasemodecode` BIGINT NULL,
  `purchasemodename` VARCHAR(128) NULL,
  `varietytype` VARCHAR(64) NULL,
  `varietycode` BIGINT NULL,
  `varietyname` VARCHAR(128) NULL,
  `grossweight` DOUBLE NULL,
  `tareweight` DOUBLE NULL,
  `joonaweight` DOUBLE NULL,
  `netwt` DOUBLE NULL,
  `societycode` INT NULL,
  `societyname` VARCHAR(255) NULL,
  `purchasemodeqty` DOUBLE NULL,
  PRIMARY KEY (`id`),
  KEY `idx_purchy_supply_grower` (`villagecode`, `growercode`),
  KEY `idx_purchy_supply_purchy_no` (`societypurchy_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `purchy_dishonour` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sl_no` INT NULL,
  `village_code` INT NULL,
  `grower_code` INT NULL,
  `grower_name` VARCHAR(255) NULL,
  `grower_father_name` VARCHAR(255) NULL,
  `society_name` VARCHAR(255) NULL,
  `center_name` VARCHAR(255) NULL,
  `village_name` VARCHAR(255) NULL,
  `mobile_no` BIGINT NULL,
  `issue_date` DATE NULL,
  `purchase_date` DATE NULL,
  `society_purchy_no` VARCHAR(64) NULL,
  `mode_qty` BIGINT NULL,
  `purchasemodecode` BIGINT NULL,
  `purchasemodename` VARCHAR(128) NULL,
  `remarks` VARCHAR(512) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_purchy_dishonour_grower` (`village_code`, `grower_code`),
  KEY `idx_purchy_dishonour_purchy_no` (`society_purchy_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `purchy_field_staff` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `village_code` INT NULL,
  `village_name` VARCHAR(255) NULL,
  `village_staff` VARCHAR(255) NULL,
  `zonal_incharge` VARCHAR(255) NULL,
  `zonal_manager` VARCHAR(255) NULL,
  `region` VARCHAR(128) NULL,
  `zone_head` VARCHAR(255) NULL,
  `sum_of_survey_area` DOUBLE NULL,
  `bonding_area` DOUBLE NULL,
  `basic_quota` BIGINT NULL,
  `bonding` BIGINT NULL,
  `additinalbond` BIGINT NULL,
  `yield_per_ha` BIGINT NULL,
  `drwal_per_ha` DOUBLE NULL,
  `target_estimated_cane_availbility` DOUBLE NULL,
  PRIMARY KEY (`id`),
  KEY `idx_purchy_fs_village` (`village_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP VIEW IF EXISTS `purchy_grower_summary_v`;
CREATE VIEW `purchy_grower_summary_v` AS
SELECT
  g.*,
  CONCAT(g.village_code, '-', g.grower_code) COLLATE utf8mb4_0900_ai_ci AS grower_key,
  CONCAT(g.village_code, '-', g.grower_code, '-', g.grower_name) COLLATE utf8mb4_0900_ai_ci AS grower_name_key,
  CONCAT(g.village_code, '-', g.village_name) COLLATE utf8mb4_0900_ai_ci AS village_name_key,
  (
    IF(IFNULL(g.supply_2020, 0) > 0, 1, 0) +
    IF(IFNULL(g.supply_2021, 0) > 0, 1, 0) +
    IF(IFNULL(g.supply_2022, 0) > 0, 1, 0) +
    IF(IFNULL(g.supply_2023, 0) > 0, 1, 0) +
    IF(IFNULL(g.supply_2024, 0) > 0, 1, 0)
  ) AS years_supplied_2020_2024,
  CASE (
    IF(IFNULL(g.supply_2020, 0) > 0, 1, 0) +
    IF(IFNULL(g.supply_2021, 0) > 0, 1, 0) +
    IF(IFNULL(g.supply_2022, 0) > 0, 1, 0) +
    IF(IFNULL(g.supply_2023, 0) > 0, 1, 0) +
    IF(IFNULL(g.supply_2024, 0) > 0, 1, 0)
  )
    WHEN 5 THEN '5. Supplied 5 years'
    WHEN 4 THEN '4. Supplied 4 years'
    WHEN 3 THEN '3. Supplied 3 years'
    WHEN 2 THEN '2. Supplied 2 years'
    WHEN 1 THEN '1. Supplied 1 year'
    ELSE '0. Never supplied'
  END AS loyalty_slicer,
  CASE
    WHEN IFNULL(g.indent_qty, 0) = 0 THEN 'No Indent'
    WHEN IFNULL(g.indent_failer_qty, 0) / g.indent_qty = 0 THEN '0% - No Failure'
    WHEN IFNULL(g.indent_failer_qty, 0) / g.indent_qty <= 0.2 THEN '1-20% Failure'
    WHEN IFNULL(g.indent_failer_qty, 0) / g.indent_qty <= 0.4 THEN '21-40% Failure'
    WHEN IFNULL(g.indent_failer_qty, 0) / g.indent_qty <= 0.6 THEN '41-60% Failure'
    WHEN IFNULL(g.indent_failer_qty, 0) / g.indent_qty <= 0.8 THEN '61-80% Failure'
    WHEN IFNULL(g.indent_failer_qty, 0) / g.indent_qty < 1 THEN '81-99% Failure'
    ELSE '100% Failure'
  END AS dishonour_bucket
FROM `purchy_grower_summary` g;
