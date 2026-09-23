-- Card move history for Sugar / Power hierarchy explorers (all users)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_hierarchy_move_history.sql

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `hierarchy_move_history` (
  `id`               BIGINT       NOT NULL AUTO_INCREMENT,
  `house`            ENUM('sugar', 'power') NOT NULL,
  `node_id`          INT          NOT NULL,
  `node_name`        VARCHAR(255) NOT NULL,
  `node_type`        VARCHAR(20)  NULL DEFAULT NULL,
  `from_parent_id`   INT          NULL DEFAULT NULL,
  `from_parent_name` VARCHAR(255) NULL DEFAULT NULL,
  `from_path`        VARCHAR(500) NULL DEFAULT NULL,
  `to_parent_id`     INT          NOT NULL,
  `to_parent_name`   VARCHAR(255) NOT NULL,
  `to_path`          VARCHAR(500) NULL DEFAULT NULL,
  `user_id`          INT          NULL DEFAULT NULL,
  `user_name`        VARCHAR(200) NOT NULL,
  `created_at`       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_hierarchy_move_history_house_created` (`house`, `created_at` DESC),
  INDEX `idx_hierarchy_move_history_node` (`house`, `node_id`),
  CONSTRAINT `fk_hierarchy_move_history_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
