-- Maintenance Notes HOD digest mail (tokens + notified markers + digest times).
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_maintenance_notes_mail_approval.sql
-- Startup also ensures these columns via ensureNotesMailSchema().

USE `__MYSQL_DATABASE__`;

ALTER TABLE `maintenance_note`
  ADD COLUMN IF NOT EXISTS `hod_email` VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS `token_accept` VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS `token_reject` VARCHAR(128) NULL,
  ADD COLUMN IF NOT EXISTS `token_expires_at` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `hod_notified_at` DATETIME NULL,
  ADD COLUMN IF NOT EXISTS `notification_count` INT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS `uq_mn_token_accept` ON `maintenance_note` (`token_accept`);
CREATE UNIQUE INDEX IF NOT EXISTS `uq_mn_token_reject` ON `maintenance_note` (`token_reject`);

INSERT INTO `portal_settings` (`setting_key`, `setting_value`) VALUES
  ('mn_digest_sugar_time', '22:00'),
  ('mn_digest_power_time', '22:00'),
  ('mn_digest_production_time', '22:00'),
  ('mn_digest_sugar_time_2', ''),
  ('mn_digest_power_time_2', ''),
  ('mn_digest_production_time_2', ''),
  ('combined_hod_digest_slots', '{}')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;

