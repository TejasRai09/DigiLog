-- Management Dashboard form (employee mapping via mappings / mapping_forms).
-- Apply: cd backend && node scripts/apply-sql-file.js ../mysql/migrate_add_bi_management_dashboard.sql

USE `__MYSQL_DATABASE__`;

INSERT INTO `forms` (`name`, `description`, `form_key`, `app_id`, `sort_order`, `is_active`)
SELECT
  'Management Dashboard',
  'Executive KPI summary across cane, milling, sugar, power and distillery',
  'bi_management_dashboard',
  `id`,
  8,
  1
FROM `apps` WHERE `name` = 'BI Control Tower' LIMIT 1
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `app_id` = VALUES(`app_id`),
  `sort_order` = VALUES(`sort_order`),
  `is_active` = VALUES(`is_active`);
