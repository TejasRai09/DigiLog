-- Section-wise Data Upload access (purchy | management | milling).
-- Apply: cd DigiLog/backend && npm run db:apply-sql -- ../mysql/migrate_data_upload_section_access.sql

SET @db = DATABASE();

-- Add section_key if missing (legacy boolean-style grants had one row per user).
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'user_data_upload_access' AND COLUMN_NAME = 'section_key'
);
SET @sql = IF(
  @col_exists = 0,
  'ALTER TABLE `user_data_upload_access` ADD COLUMN `section_key` VARCHAR(32) NOT NULL DEFAULT ''__legacy__'' AFTER `user_id`',
  'SELECT ''user_data_upload_access.section_key already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Expand legacy rows (one grant → all three sections).
INSERT IGNORE INTO `user_data_upload_access` (`user_id`, `section_key`, `granted_by`, `created_at`)
SELECT `user_id`, 'purchy', `granted_by`, `created_at`
FROM `user_data_upload_access`
WHERE `section_key` = '__legacy__';

INSERT IGNORE INTO `user_data_upload_access` (`user_id`, `section_key`, `granted_by`, `created_at`)
SELECT `user_id`, 'management', `granted_by`, `created_at`
FROM `user_data_upload_access`
WHERE `section_key` = '__legacy__';

INSERT IGNORE INTO `user_data_upload_access` (`user_id`, `section_key`, `granted_by`, `created_at`)
SELECT `user_id`, 'milling', `granted_by`, `created_at`
FROM `user_data_upload_access`
WHERE `section_key` = '__legacy__';

DELETE FROM `user_data_upload_access` WHERE `section_key` = '__legacy__';

-- Rebuild table with composite PK (cannot ALTER PRIMARY KEY while FKs reference user_id PK).
CREATE TABLE IF NOT EXISTS `user_data_upload_access__new` (
  `user_id`     INT NOT NULL,
  `section_key` VARCHAR(32) NOT NULL,
  `granted_by`  INT DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `section_key`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO `user_data_upload_access__new` (`user_id`, `section_key`, `granted_by`, `created_at`)
SELECT `user_id`, `section_key`, `granted_by`, `created_at`
FROM `user_data_upload_access`
WHERE `section_key` IN ('purchy', 'management', 'milling');

DROP TABLE `user_data_upload_access`;
RENAME TABLE `user_data_upload_access__new` TO `user_data_upload_access`;
