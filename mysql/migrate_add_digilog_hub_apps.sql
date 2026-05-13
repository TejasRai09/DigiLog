-- Optional: same data as prisma/migrations/20260515120000_digilog_hub_apps/migration.sql
-- Run if you use init.sql only: mysql -u ... gsmadb < mysql/migrate_add_digilog_hub_apps.sql

USE gsmadb;

INSERT INTO `apps` (`name`, `description`, `icon`, `color`, `sort_order`, `is_active`)
VALUES
('Mill House Equipment History', 'Equipment life history cards — specs, OEM schedule and maintenance history', 'MdPrecisionManufacturing', '#7C3AED', 5, 1),
('Power Plant Equipment History', 'Electrical, Instrument and control valve history cards for the 30MW power plant', 'MdFlashOn', '#D97706', 6, 1),
('EHS — Environment Health & Safety', 'Incident reports, accident register and water dashboard', 'MdSecurity', '#16A34A', 7, 1)
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `icon` = VALUES(`icon`),
  `color` = VALUES(`color`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);

INSERT INTO `forms` (`name`, `description`, `form_key`, `app_id`, `sort_order`, `is_active`)
SELECT 'Mill House equipment', 'Open equipment life history cards', 'digilog_hub_mill_equipment', `id`, 1, 1
FROM `apps` WHERE `name` = 'Mill House Equipment History' LIMIT 1
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `app_id` = VALUES(`app_id`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);

INSERT INTO `forms` (`name`, `description`, `form_key`, `app_id`, `sort_order`, `is_active`)
SELECT 'Power Plant equipment', 'Open power plant equipment history cards', 'digilog_hub_power_equipment', `id`, 1, 1
FROM `apps` WHERE `name` = 'Power Plant Equipment History' LIMIT 1
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `app_id` = VALUES(`app_id`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);

INSERT INTO `forms` (`name`, `description`, `form_key`, `app_id`, `sort_order`, `is_active`)
SELECT 'EHS home', 'Open EHS forms and dashboards', 'digilog_hub_ehs', `id`, 1, 1
FROM `apps` WHERE `name` = 'EHS — Environment Health & Safety' LIMIT 1
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `app_id` = VALUES(`app_id`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);
