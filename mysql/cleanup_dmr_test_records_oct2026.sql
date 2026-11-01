-- Clean up orphaned test season 26-27 DMR records
DELETE FROM `__MYSQL_DATABASE__`.`dmr_daily`
WHERE `Date` >= '2026-10-01' OR `file_upload_id` IN (33, 35, 37, 38);

-- Clean up any residual test file records
DELETE FROM `__MYSQL_DATABASE__`.`data_upload_files`
WHERE `dataset` = 'dmr_workbook' AND (`date_min` >= '2026-10-01' OR `original_filename` LIKE '%season 26-27%');
