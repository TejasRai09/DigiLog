-- Clear approval QUEUE data for:
--   1) Maintenance Notes
--   2) Maintenance History approval
--   3) Operations Forms approval
-- Keeps HOD / enabled / digest-time config.
-- Resets digest "already sent today" markers so combined mail can fire again.
--
-- Apply: cd DigiLog/backend && npm run db:apply-sql -- ../mysql/clear_three_approval_queues.sql

USE `__MYSQL_DATABASE__`;

START TRANSACTION;

-- ── In-app notifications for all three flows ──────────────────────────────
DELETE FROM `user_notification`
WHERE `type` IN (
  'mn_pending_hod',
  'mn_approved',
  'mn_rework',
  'mh_pending_hod',
  'mh_approved',
  'mh_needs_modification',
  'form_pending_hod',
  'form_approved',
  'form_needs_modification'
)
OR `ref_type` IN (
  'maintenance_note',
  'maintenance_history_approval_request',
  'form_approval'
);

-- ── Maintenance Notes ─────────────────────────────────────────────────────
DELETE FROM `maintenance_note_event`;
DELETE FROM `maintenance_note`;

-- ── Maintenance History approval ──────────────────────────────────────────
DELETE FROM `maintenance_history_approval_audit`;
DELETE FROM `maintenance_history_approval_request`;

-- ── Operations Forms approval ─────────────────────────────────────────────
DELETE FROM `form_approval_audit`;
DELETE FROM `form_approval_request`;

-- ── Digest last-sent markers (not HOD assignments) ────────────────────────
UPDATE `form_approval_card_setting`
SET `digest_last_sent_date` = NULL,
    `digest_last_sent_slots` = '{}'
WHERE 1=1;

UPDATE `portal_settings`
SET `setting_value` = ''
WHERE `setting_key` IN (
  'mh_approval_sugar_digest_last_sent_date',
  'mh_approval_power_digest_last_sent_date',
  'mh_approval_production_digest_last_sent_date'
);

UPDATE `portal_settings`
SET `setting_value` = '{}'
WHERE `setting_key` IN (
  'mh_approval_sugar_digest_last_sent_slots',
  'mh_approval_power_digest_last_sent_slots',
  'mh_approval_production_digest_last_sent_slots',
  'combined_hod_digest_slots'
);

COMMIT;

ALTER TABLE `maintenance_note_event` AUTO_INCREMENT = 1;
ALTER TABLE `maintenance_note` AUTO_INCREMENT = 1;
ALTER TABLE `maintenance_history_approval_audit` AUTO_INCREMENT = 1;
ALTER TABLE `maintenance_history_approval_request` AUTO_INCREMENT = 1;
ALTER TABLE `form_approval_audit` AUTO_INCREMENT = 1;
ALTER TABLE `form_approval_request` AUTO_INCREMENT = 1;

SELECT
  (SELECT COUNT(*) FROM `maintenance_note`) AS notes_left,
  (SELECT COUNT(*) FROM `maintenance_note_event`) AS note_events_left,
  (SELECT COUNT(*) FROM `maintenance_history_approval_request`) AS mh_requests_left,
  (SELECT COUNT(*) FROM `maintenance_history_approval_audit`) AS mh_audits_left,
  (SELECT COUNT(*) FROM `form_approval_request`) AS form_requests_left,
  (SELECT COUNT(*) FROM `form_approval_audit`) AS form_audits_left,
  (SELECT COUNT(*) FROM `user_notification`
   WHERE `type` IN (
     'mn_pending_hod','mn_approved','mn_rework',
     'mh_pending_hod','mh_approved','mh_needs_modification',
     'form_pending_hod','form_approved','form_needs_modification'
   )
   OR `ref_type` IN (
     'maintenance_note',
     'maintenance_history_approval_request',
     'form_approval'
   )) AS related_notifications_left;
