-- Power Plant Equipment History (new) — hub app + hierarchy browser form
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_power_plant_equipment_new_hub.sql

USE `__MYSQL_DATABASE__`;

INSERT INTO `apps` (`name`, `description`, `icon`, `color`, `sort_order`, `is_active`)
VALUES
(
  'Power Plant Equipment History (new)',
  'Boiler, turbine and WTP equipment hierarchy — browse by cards or tree',
  'MdFlashOn',
  '#EA580C',
  10,
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
  'Power Plant equipment hierarchy',
  'Browse 150TPH/70TPH boilers, STG and WTP equipment',
  'digilog_hub_power_equipment_new',
  `id`,
  1,
  1
FROM `apps` WHERE `name` = 'Power Plant Equipment History (new)' LIMIT 1
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `app_id` = VALUES(`app_id`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);
