-- phn_history — link maintenance rows to equipment specification sub-group
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_phn_history_section.sql

USE `__MYSQL_DATABASE__`;

ALTER TABLE `phn_history`
  ADD COLUMN `section` VARCHAR(32) DEFAULT NULL AFTER `equip_id`,
  ADD COLUMN `sub_section` VARCHAR(200) DEFAULT NULL AFTER `section`;

UPDATE `phn_history` h
INNER JOIN `phn_equipment` e ON e.id = h.equip_id
SET h.section = 'mechanical', h.sub_section = e.name
WHERE h.section IS NULL OR h.sub_section IS NULL;
