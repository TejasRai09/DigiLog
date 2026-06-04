-- Migration: add before/after service photo columns to mh_history
-- Apply: cd backend && node scripts/apply-sql-file.js ../mysql/migrate_history_images.sql
USE `__MYSQL_DATABASE__`;

ALTER TABLE `mh_history`
  ADD COLUMN `img_before` MEDIUMTEXT DEFAULT NULL AFTER `rem`,
  ADD COLUMN `img_after`  MEDIUMTEXT DEFAULT NULL AFTER `img_before`;
