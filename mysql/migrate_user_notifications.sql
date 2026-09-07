-- In-app user notifications (generic inbox; first use = maintenance history approval)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_user_notifications.sql

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `user_notification` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT          NOT NULL,
  `type`       VARCHAR(64)  NOT NULL,
  `title`      VARCHAR(255) NOT NULL,
  `body`       TEXT         DEFAULT NULL,
  `link_url`   VARCHAR(500) DEFAULT NULL,
  `cta_label`  VARCHAR(64)  DEFAULT NULL,
  `ref_type`   VARCHAR(64)  DEFAULT NULL,
  `ref_id`     INT          DEFAULT NULL,
  `meta_json`  JSON         DEFAULT NULL,
  `read_at`    DATETIME     DEFAULT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_user_notification_inbox` (`user_id`, `read_at`, `created_at`),
  INDEX `idx_user_notification_ref` (`ref_type`, `ref_id`),
  INDEX `idx_user_notification_type` (`user_id`, `type`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
