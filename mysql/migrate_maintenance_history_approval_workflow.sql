-- HOD approval workflow: statuses, versioning, audit, carry-forward digest fields
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval_workflow.sql

USE `__MYSQL_DATABASE__`;

ALTER TABLE `maintenance_history_approval_request`
  ADD COLUMN `module` VARCHAR(40) NOT NULL DEFAULT 'maintenance' AFTER `id`,
  ADD COLUMN `entity_type` VARCHAR(60) NOT NULL DEFAULT 'maintenance_history' AFTER `module`;

ALTER TABLE `maintenance_history_approval_request`
  MODIFY COLUMN `status` ENUM(
    'pending',
    'needs_modification',
    'resubmitted',
    'approved',
    'rejected',
    'conflict',
    'cancelled',
    'expired'
  ) NOT NULL DEFAULT 'pending';

ALTER TABLE `maintenance_history_approval_request`
  ADD COLUMN `hod_comment` TEXT NULL DEFAULT NULL AFTER `status`,
  ADD COLUMN `reviewed_by_user_id` INT NULL DEFAULT NULL AFTER `resolved_by`,
  ADD COLUMN `base_version` INT NOT NULL DEFAULT 1 AFTER `reviewed_by_user_id`,
  ADD COLUMN `notification_count` INT NOT NULL DEFAULT 0 AFTER `hod_notified_at`;

ALTER TABLE `maintenance_history_approval_request`
  ADD INDEX `idx_mh_approval_status_created` (`status`, `created_at`),
  ADD INDEX `idx_mh_approval_entity_status` (`domain`, `history_id`, `status`),
  ADD INDEX `idx_mh_approval_requester_status` (`requested_by_user_id`, `status`),
  ADD INDEX `idx_mh_approval_hod_status` (`hod_user_id`, `status`),
  ADD INDEX `idx_mh_approval_module_status` (`module`, `status`);

CREATE TABLE IF NOT EXISTS `maintenance_history_approval_audit` (
  `id`                     INT AUTO_INCREMENT PRIMARY KEY,
  `request_id`             INT          NOT NULL,
  `action`                 VARCHAR(60)  NOT NULL,
  `performed_by_user_id`   INT          DEFAULT NULL,
  `performed_by_email`     VARCHAR(200) DEFAULT NULL,
  `previous_status`        VARCHAR(40)  DEFAULT NULL,
  `new_status`             VARCHAR(40)  DEFAULT NULL,
  `comment`                TEXT         DEFAULT NULL,
  `created_at`             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_mh_audit_request` (`request_id`, `created_at`),
  CONSTRAINT `fk_mh_audit_request`
    FOREIGN KEY (`request_id`) REFERENCES `maintenance_history_approval_request` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `shn_history`
  ADD COLUMN `version` INT NOT NULL DEFAULT 1 AFTER `documents`;

ALTER TABLE `ppn_history`
  ADD COLUMN `version` INT NOT NULL DEFAULT 1 AFTER `documents`;
