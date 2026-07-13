-- Sugar House Equipment History — hub app + hierarchy browser form
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_sugar_house_equipment_new_hub.sql

USE `__MYSQL_DATABASE__`;

INSERT INTO `apps` (`name`, `description`, `icon`, `color`, `sort_order`, `is_active`)
VALUES
(
  'Sugar House Equipment History',
  'Sugar plant equipment hierarchy — browse by section, location and equipment',
  'MdDomain',
  '#8B5CF6',
  6,
  1
)
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `icon` = VALUES(`icon`),
  `color` = VALUES(`color`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);

INSERT INTO `forms` (`name`, `description`, `form_key`, `app_id`, `sort_order`, `is_active`)
SELECT
  'Sugar House equipment hierarchy',
  'Browse sugar plant equipment by section, location, main and sub equipment',
  'digilog_hub_sugar_equipment_new',
  `id`,
  1,
  1
FROM `apps` WHERE `name` = 'Sugar House Equipment History' LIMIT 1
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `app_id` = VALUES(`app_id`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);
