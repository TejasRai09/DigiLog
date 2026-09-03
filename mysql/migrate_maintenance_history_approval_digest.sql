-- Daily HOD digest for maintenance history approval (Sugar House + Power Plant)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval_digest.sql

USE `__MYSQL_DATABASE__`;

ALTER TABLE `maintenance_history_approval_request`
  ADD COLUMN `hod_notified_at` DATETIME NULL DEFAULT NULL AFTER `token_expires_at`;

ALTER TABLE `maintenance_history_approval_request`
  ADD INDEX `idx_mh_approval_digest` (`domain`, `status`, `created_at`, `hod_notified_at`);

INSERT INTO `portal_settings` (`setting_key`, `setting_value`)
VALUES
  ('mh_approval_sugar_digest_time', '22:00'),
  ('mh_approval_power_digest_time', '22:00'),
  ('mh_approval_sugar_digest_last_sent_date', ''),
  ('mh_approval_power_digest_last_sent_date', '')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
