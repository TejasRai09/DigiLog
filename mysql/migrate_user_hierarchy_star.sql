-- Per-user starred hierarchy folders and equipment cards (Sugar / Power)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_user_hierarchy_star.sql

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `user_hierarchy_star` (
  `user_id`    INT          NOT NULL,
  `house`      ENUM('sugar', 'power') NOT NULL,
  `node_id`    INT          NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `house`, `node_id`),
  INDEX `idx_user_hierarchy_star_house` (`house`, `node_id`),
  CONSTRAINT `fk_user_hierarchy_star_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
