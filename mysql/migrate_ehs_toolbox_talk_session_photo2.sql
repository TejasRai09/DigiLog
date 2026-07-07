-- Add second session photo + cap topic_discussed at 150 chars
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_ehs_toolbox_talk_session_photo2.sql
-- Safe to re-run.

USE `__MYSQL_DATABASE__`;

SET @db = DATABASE();

SET @has_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'ehs_toolbox_talk' AND COLUMN_NAME = 'session_photo_2'
);
SET @sql_add = IF(
  @has_col = 0,
  'ALTER TABLE `ehs_toolbox_talk` ADD COLUMN `session_photo_2` MEDIUMTEXT DEFAULT NULL AFTER `session_photo`',
  'SELECT ''ehs_toolbox_talk.session_photo_2 already exists'' AS message'
);
PREPARE stmt FROM @sql_add;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `ehs_toolbox_talk`
SET `topic_discussed` = LEFT(`topic_discussed`, 150)
WHERE `topic_discussed` IS NOT NULL AND CHAR_LENGTH(`topic_discussed`) > 150;

ALTER TABLE `ehs_toolbox_talk`
  MODIFY COLUMN `topic_discussed` VARCHAR(150) DEFAULT NULL;
