-- Add tag_name, category, subcategory to power plant equipment cards
-- Apply: cd backend && node scripts/apply-sql-file.js ../mysql/migrate_pp_equipment_classification.sql
USE `__MYSQL_DATABASE__`;

ALTER TABLE `pp_equipment`
  ADD COLUMN `tag_name` VARCHAR(100) DEFAULT NULL AFTER `equip_no`,
  ADD COLUMN `category` VARCHAR(100) DEFAULT NULL AFTER `dept`,
  ADD COLUMN `subcategory` VARCHAR(100) DEFAULT NULL AFTER `category`;

CREATE INDEX `idx_pp_category` ON `pp_equipment` (`dept`, `category`);