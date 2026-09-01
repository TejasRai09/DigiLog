-- Structured equipment specification sections (Mechanical / Civil / Instrument / Electrical)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_pp_specs_sections.sql

USE `__MYSQL_DATABASE__`;

ALTER TABLE `pp_specs`
  ADD COLUMN `section` VARCHAR(32) NULL DEFAULT NULL AFTER `equip_id`,
  ADD COLUMN `sub_section` VARCHAR(200) NULL DEFAULT NULL AFTER `section`;
