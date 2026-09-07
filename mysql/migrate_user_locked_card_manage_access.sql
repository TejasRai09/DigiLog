-- Locked equipment card manage access (Sugar / Power / Production)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_user_locked_card_manage_access.sql

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `user_locked_card_manage_access` (
  `user_id`    INT          NOT NULL,
  `domain`     ENUM('sugar', 'power', 'production') NOT NULL,
  `granted_by` INT          DEFAULT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `domain`),
  INDEX `idx_locked_card_manage_domain` (`domain`),
  CONSTRAINT `fk_locked_card_manage_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_locked_card_manage_granted_by`
    FOREIGN KEY (`granted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Production House extracted equipment lock flag
SET @db := DATABASE();

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'phn_equipment' AND COLUMN_NAME = 'is_imported'
);
SET @sql := IF(
  @exists = 0,
  'ALTER TABLE `phn_equipment` ADD COLUMN `is_imported` TINYINT(1) NOT NULL DEFAULT 0 AFTER `sort_order`',
  'SELECT ''phn_equipment.is_imported already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Existing production equipment came from extract/import → lock by default
UPDATE `phn_equipment` SET `is_imported` = 1 WHERE `is_imported` = 0;
