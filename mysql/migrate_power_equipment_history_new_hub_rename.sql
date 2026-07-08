-- Rename Power Plant Equipment History (new) hub card to Power Plant Equipment History.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_power_equipment_history_new_hub_rename.sql

USE `__MYSQL_DATABASE__`;

UPDATE `apps`
SET `name` = 'Power Plant Equipment History'
WHERE `name` = 'Power Plant Equipment History (new)';
