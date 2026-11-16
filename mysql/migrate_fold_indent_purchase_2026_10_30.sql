-- Count 30 October 2026 indent and purchase as 31 October 2026.
-- Does not change season_mapping. Safe to run again: the second run updates 0 rows.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_fold_indent_purchase_2026_10_30.sql

USE `__MYSQL_DATABASE__`;

UPDATE centre_indent_data
SET indent_date = '2026-10-31', season_label = '2026-2027'
WHERE indent_date = '2026-10-30';

UPDATE centre_purchase_data
SET purchase_date = '2026-10-31', season_label = '2026-2027'
WHERE purchase_date = '2026-10-30';
