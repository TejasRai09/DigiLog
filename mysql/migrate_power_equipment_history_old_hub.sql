-- Rename legacy Power Plant Equipment History hub card and move it to last in Forms Hub order.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_power_equipment_history_old_hub.sql

USE `__MYSQL_DATABASE__`;

UPDATE `apps`
SET
  `name` = 'Power Plant Equipment History (old)',
  `sort_order` = 11
WHERE `name` = 'Power Plant Equipment History';
