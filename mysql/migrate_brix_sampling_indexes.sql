-- Speed up Brix Sampling BI date filters
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_brix_sampling_indexes.sql

USE `__MYSQL_DATABASE__`;

-- Idempotent index creation
SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'brix_yard_sampling'
        AND index_name = 'idx_brix_yard_date'
    ),
    'SELECT 1',
    'CREATE INDEX `idx_brix_yard_date` ON `brix_yard_sampling` (`Date`)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'brix_yard_sampling'
        AND index_name = 'idx_brix_yard_date_dp'
    ),
    'SELECT 1',
    'CREATE INDEX `idx_brix_yard_date_dp` ON `brix_yard_sampling` (`Date`, `DeliveryPoint`)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'brix_field_sampling'
        AND index_name = 'idx_brix_field_date'
    ),
    'SELECT 1',
    'CREATE INDEX `idx_brix_field_date` ON `brix_field_sampling` (`Date`)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'brix_field_sampling'
        AND index_name = 'idx_brix_field_date_tt'
    ),
    'SELECT 1',
    'CREATE INDEX `idx_brix_field_date_tt` ON `brix_field_sampling` (`Date`, `TestType`)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
