-- Center codes that mean Gate on Management Dashboard indent/purchase.
-- Any code not in this table is stored as Center.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_md_gate_center_codes.sql

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `md_gate_center_codes` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(32) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_md_gate_center_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
