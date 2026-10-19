-- Remove all Maintenance Notes register data (notes, events, related in-app notifications).
-- Does NOT change portal_settings (per-plant HOD assignments).
--
-- Apply:
--   cd DigiLog/backend
--   npm run db:apply-sql -- ../mysql/clear_maintenance_notes.sql

USE `__MYSQL_DATABASE__`;

START TRANSACTION;

DELETE FROM `user_notification`
WHERE `type` IN (
  'mn_pending_hod',
  'mn_approved',
  'mn_rework'
)
OR `ref_type` = 'maintenance_note';

DELETE FROM `maintenance_note_event`;
DELETE FROM `maintenance_note`;

COMMIT;

ALTER TABLE `maintenance_note_event` AUTO_INCREMENT = 1;
ALTER TABLE `maintenance_note` AUTO_INCREMENT = 1;

SELECT
  (SELECT COUNT(*) FROM `maintenance_note`) AS notes_left,
  (SELECT COUNT(*) FROM `maintenance_note_event`) AS events_left,
  (SELECT COUNT(*) FROM `user_notification`
   WHERE `type` IN ('mn_pending_hod', 'mn_approved', 'mn_rework')
      OR `ref_type` = 'maintenance_note') AS mn_notifications_left;
