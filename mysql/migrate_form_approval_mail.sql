-- Forms approval digest email + no-login inbox tokens
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_form_approval_mail.sql

USE `__MYSQL_DATABASE__`;

SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'form_approval_card_setting' AND COLUMN_NAME = 'digest_time'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `form_approval_card_setting`
     ADD COLUMN `digest_time` VARCHAR(5) NOT NULL DEFAULT ''22:00'' AFTER `hod_user_id`,
     ADD COLUMN `digest_time_2` VARCHAR(5) NULL DEFAULT NULL AFTER `digest_time`,
     ADD COLUMN `digest_last_sent_date` VARCHAR(10) NULL DEFAULT NULL AFTER `digest_time_2`,
     ADD COLUMN `digest_last_sent_slots` TEXT NULL DEFAULT NULL AFTER `digest_last_sent_date`',
  'SELECT ''form_approval_card_setting digest columns already exist'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'form_approval_request' AND COLUMN_NAME = 'token_accept'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `form_approval_request`
     ADD COLUMN `token_accept` VARCHAR(64) NULL DEFAULT NULL AFTER `hod_email`,
     ADD COLUMN `token_reject` VARCHAR(64) NULL DEFAULT NULL AFTER `token_accept`,
     ADD COLUMN `token_expires_at` DATETIME NULL DEFAULT NULL AFTER `token_reject`,
     ADD COLUMN `hod_notified_at` DATETIME NULL DEFAULT NULL AFTER `token_expires_at`,
     ADD COLUMN `notification_count` INT NOT NULL DEFAULT 0 AFTER `hod_notified_at`,
     ADD COLUMN `employee_reminder_sent_at` DATETIME NULL DEFAULT NULL AFTER `notification_count`,
     ADD UNIQUE KEY `uq_form_approval_token_accept` (`token_accept`),
     ADD UNIQUE KEY `uq_form_approval_token_reject` (`token_reject`)',
  'SELECT ''form_approval_request token columns already exist'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
