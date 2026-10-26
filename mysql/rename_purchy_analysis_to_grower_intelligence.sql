-- Rename BI dashboard display name. form_key and route stay bi_purchy_analysis.
-- Apply: cd DigiLog/backend && npm run db:apply-sql -- ../mysql/rename_purchy_analysis_to_grower_intelligence.sql

USE `__MYSQL_DATABASE__`;

UPDATE `forms`
SET `name` = 'Grower Intelligence'
WHERE `form_key` = 'bi_purchy_analysis';

UPDATE `data_upload_files`
SET `category` = 'Grower Intelligence — Grower Details'
WHERE `category` = 'Purchy Analysis — Grower Details';

UPDATE `data_upload_files`
SET `category` = 'Grower Intelligence — Staff Mapping'
WHERE `category` = 'Purchy Analysis — Staff Mapping';
