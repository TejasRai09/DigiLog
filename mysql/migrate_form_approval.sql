-- Forms Hub HOD approval (card-wise and form-wise)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_form_approval.sql

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `form_approval_card_setting` (
  `app_id`      INT          NOT NULL,
  `enabled`     TINYINT(1)   NOT NULL DEFAULT 0,
  `hod_user_id` INT          NULL DEFAULT NULL,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`app_id`),
  CONSTRAINT `fk_form_approval_card_app`
    FOREIGN KEY (`app_id`) REFERENCES `apps` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_form_approval_card_hod`
    FOREIGN KEY (`hod_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `form_approval_form_setting` (
  `form_id`     INT          NOT NULL,
  `mode`        ENUM('inherit', 'on', 'off') NOT NULL DEFAULT 'inherit',
  `hod_user_id` INT          NULL DEFAULT NULL,
  `updated_at`  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`form_id`),
  CONSTRAINT `fk_form_approval_form`
    FOREIGN KEY (`form_id`) REFERENCES `forms` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_form_approval_form_hod`
    FOREIGN KEY (`hod_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `form_approval_request` (
  `id`                    INT AUTO_INCREMENT PRIMARY KEY,
  `app_id`                INT          NOT NULL,
  `form_id`               INT          NULL DEFAULT NULL,
  `form_key`              VARCHAR(80)  NOT NULL,
  `form_name`             VARCHAR(200) NOT NULL,
  `app_name`              VARCHAR(200) NOT NULL,
  `action`                ENUM('create') NOT NULL DEFAULT 'create',
  `is_batch`              TINYINT(1)   NOT NULL DEFAULT 0,
  `payload_json`          MEDIUMTEXT   NOT NULL,
  `requested_by_user_id`  INT          NULL DEFAULT NULL,
  `requested_by_email`    VARCHAR(200) DEFAULT NULL,
  `requested_by_name`     VARCHAR(200) DEFAULT NULL,
  `hod_user_id`           INT          NULL DEFAULT NULL,
  `hod_email`             VARCHAR(200) DEFAULT NULL,
  `status`                ENUM(
                            'pending',
                            'needs_modification',
                            'resubmitted',
                            'approved',
                            'rejected',
                            'cancelled'
                          ) NOT NULL DEFAULT 'pending',
  `hod_comment`           TEXT         NULL DEFAULT NULL,
  `resolved_at`           DATETIME     DEFAULT NULL,
  `resolved_by`           VARCHAR(200) DEFAULT NULL,
  `reviewed_by_user_id`   INT          NULL DEFAULT NULL,
  `created_at`            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_form_approval_hod_status` (`hod_user_id`, `status`, `created_at`),
  INDEX `idx_form_approval_form_status` (`form_key`, `status`, `created_at`),
  INDEX `idx_form_approval_requester` (`requested_by_user_id`, `status`),
  CONSTRAINT `fk_form_approval_req_app`
    FOREIGN KEY (`app_id`) REFERENCES `apps` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_form_approval_req_form`
    FOREIGN KEY (`form_id`) REFERENCES `forms` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_form_approval_req_user`
    FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_form_approval_req_hod`
    FOREIGN KEY (`hod_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `form_approval_audit` (
  `id`                     INT AUTO_INCREMENT PRIMARY KEY,
  `request_id`             INT          NOT NULL,
  `action`                 VARCHAR(60)  NOT NULL,
  `performed_by_user_id`   INT          DEFAULT NULL,
  `performed_by_email`     VARCHAR(200) DEFAULT NULL,
  `previous_status`        VARCHAR(40)  DEFAULT NULL,
  `new_status`             VARCHAR(40)  DEFAULT NULL,
  `comment`                TEXT         DEFAULT NULL,
  `created_at`             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_form_approval_audit_request` (`request_id`, `created_at`),
  CONSTRAINT `fk_form_approval_audit_request`
    FOREIGN KEY (`request_id`) REFERENCES `form_approval_request` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
