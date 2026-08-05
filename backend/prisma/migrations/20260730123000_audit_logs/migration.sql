-- Application audit trail (mutating API calls from the SPA).
USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT,
  `created_at`     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user_id`        INT          NULL DEFAULT NULL,
  `user_name`      VARCHAR(200) NULL DEFAULT NULL,
  `user_email`     VARCHAR(200) NULL DEFAULT NULL,
  `user_role`      VARCHAR(20)  NULL DEFAULT NULL,
  `method`         VARCHAR(10)  NOT NULL,
  `path`           VARCHAR(500) NOT NULL,
  `status_code`    INT          NULL DEFAULT NULL,
  `action_summary` VARCHAR(255) NULL DEFAULT NULL,
  `request_body`   MEDIUMTEXT   NULL DEFAULT NULL,
  `ip`             VARCHAR(64)  NULL DEFAULT NULL,
  `user_agent`     VARCHAR(500) NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `audit_logs_created_at_idx` (`created_at`),
  KEY `audit_logs_user_id_idx` (`user_id`),
  KEY `audit_logs_method_idx` (`method`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
