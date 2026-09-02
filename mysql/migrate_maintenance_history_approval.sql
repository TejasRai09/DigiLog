-- Maintenance history HOD approval (Sugar House + Power Plant)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval.sql

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `maintenance_history_approval_request` (
  `id`                    INT AUTO_INCREMENT PRIMARY KEY,
  `domain`                ENUM('sugar', 'power') NOT NULL,
  `action`                ENUM('create', 'update', 'delete') NOT NULL,
  `equip_id`              INT          NOT NULL,
  `history_id`            INT          DEFAULT NULL,
  `payload_json`          MEDIUMTEXT   DEFAULT NULL,
  `previous_json`         MEDIUMTEXT   DEFAULT NULL,
  `equipment_context_json` TEXT        DEFAULT NULL,
  `requested_by_user_id`  INT          DEFAULT NULL,
  `requested_by_email`    VARCHAR(200) DEFAULT NULL,
  `requested_by_name`     VARCHAR(200) DEFAULT NULL,
  `hod_user_id`           INT          DEFAULT NULL,
  `hod_email`             VARCHAR(200) NOT NULL,
  `status`                ENUM('pending', 'approved', 'rejected', 'expired') NOT NULL DEFAULT 'pending',
  `token_accept`          VARCHAR(64)  NOT NULL,
  `token_reject`          VARCHAR(64)  NOT NULL,
  `token_expires_at`      DATETIME     NOT NULL,
  `resolved_at`           DATETIME     DEFAULT NULL,
  `resolved_by`           VARCHAR(200) DEFAULT NULL,
  `created_at`            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_mh_approval_token_accept (`token_accept`),
  UNIQUE KEY uq_mh_approval_token_reject (`token_reject`),
  INDEX idx_mh_approval_domain_status (`domain`, `status`, `created_at`),
  INDEX idx_mh_approval_equip (`equip_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `portal_settings` (`setting_key`, `setting_value`)
VALUES
  ('mh_approval_sugar_enabled', '0'),
  ('mh_approval_power_enabled', '0'),
  ('mh_approval_sugar_hod_user_id', ''),
  ('mh_approval_power_hod_user_id', '')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
