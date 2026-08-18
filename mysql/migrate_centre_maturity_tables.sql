-- Centre Indent / Purchase tables for Management Dashboard + Centre Maturity BI
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_centre_maturity_tables.sql

CREATE TABLE IF NOT EXISTS `centre_indent_data` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) NULL DEFAULT NULL,
  `center_name` VARCHAR(150) NULL DEFAULT NULL,
  `indent_date` DATE NULL DEFAULT NULL,
  `no_of_purchy` INT NULL DEFAULT NULL,
  `indent_qty` DECIMAL(12,2) NULL DEFAULT NULL,
  `category` VARCHAR(50) NULL DEFAULT NULL,
  `unique_id` VARCHAR(100) NULL DEFAULT NULL,
  `bonding_id` VARCHAR(100) NULL DEFAULT NULL,
  `season_label` VARCHAR(50) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_center_name (`center_name`),
  INDEX idx_indent_date (`indent_date`),
  INDEX idx_season_label (`season_label`),
  INDEX idx_category (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `centre_purchase_data` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(50) NULL DEFAULT NULL,
  `center_name` VARCHAR(150) NULL DEFAULT NULL,
  `purchase_date` DATE NULL DEFAULT NULL,
  `indent_date` DATE NULL DEFAULT NULL,
  `no_of_purchy` INT NULL DEFAULT NULL,
  `purchase_qty` DECIMAL(12,2) NULL DEFAULT NULL,
  `category` VARCHAR(50) NULL DEFAULT NULL,
  `unique_id` VARCHAR(100) NULL DEFAULT NULL,
  `season_label` VARCHAR(50) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_center_name (`center_name`),
  INDEX idx_purchase_date (`purchase_date`),
  INDEX idx_season_label (`season_label`),
  INDEX idx_category (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
