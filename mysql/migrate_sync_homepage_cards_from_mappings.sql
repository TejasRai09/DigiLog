-- Re-sync homepage cards from actual form/dashboard mappings (requires mapping_forms rows).
-- Apply: cd backend && node scripts/apply-sql-file.js ../mysql/migrate_sync_homepage_cards_from_mappings.sql

USE `__MYSQL_DATABASE__`;

DELETE FROM `user_homepage_cards`WHERE `card_key` IN ('forms_hub', 'bi_control_tower');

INSERT IGNORE INTO `user_homepage_cards` (`user_id`, `card_key`)
  SELECT DISTINCT m.user_id, 'forms_hub'
  FROM `mapping_forms` mf
  JOIN `mappings` m ON m.id = mf.mapping_id
  JOIN `apps` a ON a.id = m.app_id
  WHERE a.name <> 'BI Control Tower';

INSERT IGNORE INTO `user_homepage_cards` (`user_id`, `card_key`)
  SELECT DISTINCT m.user_id, 'bi_control_tower'
  FROM `mapping_forms` mf
  JOIN `mappings` m ON m.id = mf.mapping_id
  JOIN `apps` a ON a.id = m.app_id
  WHERE a.name = 'BI Control Tower';
