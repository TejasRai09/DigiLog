-- Live MSSQL→MySQL sync uses INSERT ... ON DUPLICATE KEY UPDATE.
-- That only updates existing rows when purchyno / purchy_no are UNIQUE.
-- Without these keys every sync INSERTs another full copy.
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_cane_live_unique_purchy.sql

USE `__MYSQL_DATABASE__`;

SET @db := DATABASE();

-- g_ctc: keep newest id per purchyno, then add UNIQUE
DELETE t1 FROM `g_ctc` t1
INNER JOIN `g_ctc` t2
  ON t1.`purchyno` = t2.`purchyno`
 AND t1.id < t2.id
WHERE t1.`purchyno` IS NOT NULL;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = @db
        AND table_name = 'g_ctc'
        AND index_name = 'uq_purchyno'
    ),
    'SELECT ''g_ctc.uq_purchyno already exists'' AS message',
    'ALTER TABLE `g_ctc` ADD UNIQUE KEY `uq_purchyno` (`purchyno`)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- cnt_performance: keep newest id per purchy_no, then add UNIQUE
DELETE t1 FROM `cnt_performance` t1
INNER JOIN `cnt_performance` t2
  ON t1.`purchy_no` = t2.`purchy_no`
 AND t1.id < t2.id
WHERE t1.`purchy_no` IS NOT NULL;

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = @db
        AND table_name = 'cnt_performance'
        AND index_name = 'uq_purchy_no'
    ),
    'SELECT ''cnt_performance.uq_purchy_no already exists'' AS message',
    'ALTER TABLE `cnt_performance` ADD UNIQUE KEY `uq_purchy_no` (`purchy_no`)'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
