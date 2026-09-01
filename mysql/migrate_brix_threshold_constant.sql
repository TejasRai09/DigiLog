-- Seed the configurable Brix ripeness threshold used by the Brix Sampling dashboard.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_brix_threshold_constant.sql

USE `__MYSQL_DATABASE__`;

INSERT INTO `portal_settings` (`setting_key`, `setting_value`)
VALUES ('brix_threshold', '18')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
