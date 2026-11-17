-- Remove the season text from the Brix Sampling form names.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_brix_form_names.sql

USE `__MYSQL_DATABASE__`;

UPDATE forms
SET name = TRIM(REPLACE(name, '23-24', ''))
WHERE form_key IN ('brix_yard_sampling', 'brix_field_sampling')
  AND name LIKE '%23-24%';
