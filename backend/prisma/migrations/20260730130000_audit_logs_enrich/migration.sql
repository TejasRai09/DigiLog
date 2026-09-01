-- Enrich audit_logs with readability / debugging columns.
USE `__MYSQL_DATABASE__`;

ALTER TABLE `audit_logs` ADD COLUMN `user_department` VARCHAR(255) NULL DEFAULT NULL AFTER `user_role`;
ALTER TABLE `audit_logs` ADD COLUMN `success` TINYINT(1) NULL DEFAULT NULL AFTER `status_code`;
ALTER TABLE `audit_logs` ADD COLUMN `action_type` VARCHAR(20) NULL DEFAULT NULL AFTER `success`;
ALTER TABLE `audit_logs` ADD COLUMN `module` VARCHAR(100) NULL DEFAULT NULL AFTER `action_summary`;
ALTER TABLE `audit_logs` ADD COLUMN `module_key` VARCHAR(64) NULL DEFAULT NULL AFTER `module`;
ALTER TABLE `audit_logs` ADD COLUMN `resource_type` VARCHAR(64) NULL DEFAULT NULL AFTER `module_key`;
ALTER TABLE `audit_logs` ADD COLUMN `resource_id` VARCHAR(64) NULL DEFAULT NULL AFTER `resource_type`;
ALTER TABLE `audit_logs` ADD COLUMN `resource_name` VARCHAR(255) NULL DEFAULT NULL AFTER `resource_id`;
ALTER TABLE `audit_logs` ADD COLUMN `display_path` VARCHAR(500) NULL DEFAULT NULL AFTER `resource_name`;
ALTER TABLE `audit_logs` ADD COLUMN `screen` VARCHAR(100) NULL DEFAULT NULL AFTER `display_path`;
ALTER TABLE `audit_logs` ADD COLUMN `duration_ms` INT NULL DEFAULT NULL AFTER `screen`;
