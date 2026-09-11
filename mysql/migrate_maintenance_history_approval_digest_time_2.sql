-- Second daily full-digest time + per-slot last-sent markers
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_maintenance_history_approval_digest_time_2.sql

INSERT INTO portal_settings (setting_key, setting_value) VALUES
  ('mh_approval_sugar_digest_time_2', ''),
  ('mh_approval_power_digest_time_2', ''),
  ('mh_approval_production_digest_time_2', ''),
  ('mh_approval_sugar_digest_last_sent_slots', '{}'),
  ('mh_approval_power_digest_last_sent_slots', '{}'),
  ('mh_approval_production_digest_last_sent_slots', '{}')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
