-- Widen ppn_specs.val for sub-group gallery metadata (base64 images in __subgroup_meta__ JSON).
-- Apply: cd backend && node scripts/apply-sql-file.js ../mysql/migrate_ppn_specs_val_mediumtext.sql

USE __MYSQL_DATABASE__;

ALTER TABLE `ppn_specs`
  MODIFY COLUMN `val` MEDIUMTEXT DEFAULT NULL;
