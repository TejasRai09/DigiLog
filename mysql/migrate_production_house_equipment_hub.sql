-- Production House Equipment History — hub app + form
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_production_house_equipment_hub.sql

USE `__MYSQL_DATABASE__`;

INSERT INTO `apps` (`name`, `description`, `icon`, `color`, `sort_order`, `is_active`)
VALUES
(
  'Production House Equipment History',
  'Pan, evaporation, clarification and centrifugal equipment cards — specs and maintenance history',
  'MdPrecisionManufacturing',
  '#C026D3',
  7,
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
  'Production House equipment',
  'Browse production house equipment cards by house section',
  'digilog_hub_production_equipment',
  `id`,
  1,
  1
FROM `apps` WHERE `name` = 'Production House Equipment History' LIMIT 1
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `app_id` = VALUES(`app_id`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);
