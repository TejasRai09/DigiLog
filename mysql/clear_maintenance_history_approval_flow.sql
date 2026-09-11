-- Clear maintenance-history approval FLOW data (requests, audit, related in-app notifications).
-- Does NOT change portal_settings (HOD / enabled / digest config) or equipment history tables.
--
-- Apply:
--   cd DigiLog/backend
--   npm run db:apply-sql -- ../mysql/clear_maintenance_history_approval_flow.sql
--
-- After apply, also remove orphaned staged upload folders (AUTO_INCREMENT reuse
-- otherwise hits "Maximum 2 documents allowed" on the first upload):
--   Remove-Item -Recurse -Force uploads\history-documents\approval\*
--   (from DigiLog/backend)
--
-- Or run manually in MySQL after replacing the database name below.

USE `__MYSQL_DATABASE__`;

START TRANSACTION;

-- 1) In-app notifications from the approval flow only (shared table — do not TRUNCATE)
DELETE FROM `user_notification`
WHERE `type` IN (
  'mh_pending_hod',
  'mh_approved',
  'mh_needs_modification'
)
OR `ref_type` = 'maintenance_history_approval_request';

-- 2) Audit log
DELETE FROM `maintenance_history_approval_audit`;

-- 3) Main approval request queue
DELETE FROM `maintenance_history_approval_request`;

COMMIT;

-- Optional: reset AUTO_INCREMENT after empty tables
ALTER TABLE `maintenance_history_approval_audit` AUTO_INCREMENT = 1;
ALTER TABLE `maintenance_history_approval_request` AUTO_INCREMENT = 1;

-- Verify
SELECT
  (SELECT COUNT(*) FROM `maintenance_history_approval_request`) AS requests_left,
  (SELECT COUNT(*) FROM `maintenance_history_approval_audit`) AS audits_left,
  (SELECT COUNT(*) FROM `user_notification`
   WHERE `type` IN ('mh_pending_hod', 'mh_approved', 'mh_needs_modification')
      OR `ref_type` = 'maintenance_history_approval_request') AS mh_notifications_left;
