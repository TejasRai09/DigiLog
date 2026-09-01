-- Map legacy free-text users.department to Config employee categories.
-- Apply after migrate_employee_categories.sql and after categories exist in Config.
--
--   cd backend && npm run db:apply-sql -- ../mysql/migrate_employee_department_mapping.sql
--
-- Legacy manual text -> category name:
--   PowerPlant   -> Power Plant
--   Engineering  -> Engineering
--   Strategy     -> Strategy

USE `__MYSQL_DATABASE__`;

UPDATE `users` SET `department` = 'Power Plant' WHERE `department` = 'PowerPlant';
UPDATE `users` SET `department` = 'Engineering' WHERE `department` = 'Engineering';
UPDATE `users` SET `department` = 'Strategy' WHERE `department` = 'Strategy';
