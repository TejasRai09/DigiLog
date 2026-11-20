-- Form correction requests. One pending request per saved form row.
-- Apply: npm run db:apply-sql -- ../mysql/migrate_form_edit_requests.sql

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `form_edit_requests` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`       INT          NOT NULL,
  `form_key`      VARCHAR(100) NOT NULL,
  `record_key`    VARCHAR(64)  NOT NULL,
  `app_id`        INT          NULL,
  `app_name`      VARCHAR(200) NULL,
  `form_name`     VARCHAR(200) NULL,
  `before_json`   JSON         NOT NULL,
  `after_json`    JSON         NOT NULL,
  `comment`       TEXT         NULL,
  `status`        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `reviewed_by`   INT          NULL,
  `reviewed_at`   TIMESTAMP    NULL DEFAULT NULL,
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_form_edit_req_status` (`status`, `created_at`),
  KEY `idx_form_edit_req_row` (`form_key`, `record_key`, `status`),
  KEY `idx_form_edit_req_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @add_comment = (
  SELECT IF(
    COUNT(*) = 0,
    'ALTER TABLE `form_edit_requests` ADD COLUMN `comment` TEXT NULL AFTER `after_json`',
    'SELECT 1'
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'form_edit_requests'
    AND COLUMN_NAME = 'comment'
);
PREPARE add_form_edit_comment FROM @add_comment;
EXECUTE add_form_edit_comment;
DEALLOCATE PREPARE add_form_edit_comment;
