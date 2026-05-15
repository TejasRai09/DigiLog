-- BI Control Tower app + distillery analytics dashboard form (employee mapping via mappings / mapping_forms).
-- Run if you use init.sql only: mysql -u ... gsmadb < mysql/migrate_add_bi_control_tower.sql

USE gsmadb;

INSERT INTO `apps` (`name`, `description`, `icon`, `color`, `sort_order`, `is_active`)
VALUES
('BI Control Tower', 'Business intelligence dashboards (employee-mapped)', 'MdInsights', '#6366F1', 8, 1)
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `icon` = VALUES(`icon`),
  `color` = VALUES(`color`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);

INSERT INTO `forms` (`name`, `description`, `form_key`, `app_id`, `sort_order`, `is_active`)
SELECT
  'Distillery Operations — Analytics',
  'KPIs, trends and daily log from distillery operations data',
  'bi_distillery_operations',
  `id`,
  1,
  1
FROM `apps` WHERE `name` = 'BI Control Tower' LIMIT 1
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `app_id` = VALUES(`app_id`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);
