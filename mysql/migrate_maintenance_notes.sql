-- Shared Maintenance Notes register with per-plant HOD closure.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_maintenance_notes.sql

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `maintenance_note` (
  `id`                      INT AUTO_INCREMENT PRIMARY KEY,
  `plant`                   ENUM('sugar', 'power', 'production') NOT NULL,
  `equipment_id`            INT          DEFAULT NULL,
  `equipment_node_id`       INT          DEFAULT NULL,
  `equipment_name`          VARCHAR(500) DEFAULT NULL,
  `no_equipment`            TINYINT(1)   NOT NULL DEFAULT 0,
  `activity_type`           VARCHAR(40)  DEFAULT NULL,
  `activity_description`    VARCHAR(80)  NOT NULL,
  `activity_details`        TEXT         DEFAULT NULL,
  `images`                  MEDIUMTEXT   DEFAULT NULL,
  `documents`               JSON         DEFAULT NULL,
  `status`                  ENUM('pending', 'approval_pending', 'completed', 'rework_required')
                            NOT NULL DEFAULT 'pending',
  `created_by_user_id`      INT          NOT NULL,
  `created_by_name`         VARCHAR(200) NOT NULL,
  `created_by_email`        VARCHAR(200) DEFAULT NULL,
  `submitted_by_user_id`    INT          DEFAULT NULL,
  `submitted_by_name`       VARCHAR(200) DEFAULT NULL,
  `submitted_at`            DATETIME     DEFAULT NULL,
  `completion_remarks`      TEXT         DEFAULT NULL,
  `hod_user_id`             INT          DEFAULT NULL,
  `hod_name`                VARCHAR(200) DEFAULT NULL,
  `hod_decision`            ENUM('approved', 'rejected') DEFAULT NULL,
  `hod_decision_at`         DATETIME     DEFAULT NULL,
  `hod_remarks`             TEXT         DEFAULT NULL,
  `updated_at`              DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at`              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_mn_plant_status` (`plant`, `status`, `created_at`),
  INDEX `idx_mn_created_by` (`created_by_user_id`, `created_at`),
  INDEX `idx_mn_equipment` (`plant`, `equipment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `maintenance_note_event` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `note_id`         INT          NOT NULL,
  `action`          VARCHAR(40)  NOT NULL,
  `actor_user_id`   INT          DEFAULT NULL,
  `actor_name`      VARCHAR(200) DEFAULT NULL,
  `from_status`     VARCHAR(40)  DEFAULT NULL,
  `to_status`       VARCHAR(40)  DEFAULT NULL,
  `remarks`         TEXT         DEFAULT NULL,
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_mn_event_note` (`note_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `portal_settings` (`setting_key`, `setting_value`)
VALUES
  ('mn_hod_sugar', ''),
  ('mn_hod_power', ''),
  ('mn_hod_production', '')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
