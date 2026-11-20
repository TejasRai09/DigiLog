-- Master switch for the user Edit request action on saved form rows.
-- 0 = off by default. Users do not see Edit request, and new requests are refused.
-- 1 = users see Edit request in the View Data action menu.
-- A missing row is treated as off.

INSERT INTO `portal_settings` (`setting_key`, `setting_value`)
VALUES ('form_edit_requests_enabled', '0')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
