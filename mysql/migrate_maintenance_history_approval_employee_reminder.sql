-- Employee reminder emails for needs_modification (every 2 days at 09:00 IST)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval_employee_reminder.sql
-- Also added automatically by ensureDigestSchema() on backend start.

USE `__MYSQL_DATABASE__`;

ALTER TABLE `maintenance_history_approval_request`
  ADD COLUMN `employee_reminder_sent_at` DATETIME NULL DEFAULT NULL AFTER `hod_notified_at`;
