-- Per-season BI calculation constants (theoretical yield, power tariff, Brix threshold).
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_season_bi_constants.sql

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `season_bi_constants` (
  `season_label`        VARCHAR(50)    NOT NULL,
  `theoretical_yield`   DECIMAL(10,4)  NOT NULL,
  `power_tariff_rate`   DECIMAL(10,4)  NOT NULL,
  `brix_threshold`      DECIMAL(10,4)  NOT NULL,
  `updated_at`          TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`season_label`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `season_bi_constants` (`season_label`, `theoretical_yield`, `power_tariff_rate`, `brix_threshold`)
SELECT
  sm.`season_label`,
  CAST(COALESCE(ty.`setting_value`, '64.4') AS DECIMAL(10,4)),
  CAST(COALESCE(pt.`setting_value`, '4.85') AS DECIMAL(10,4)),
  CAST(COALESCE(bx.`setting_value`, '18') AS DECIMAL(10,4))
FROM `season_mapping` sm
LEFT JOIN `portal_settings` ty ON ty.`setting_key` = 'distillery_theoretical_yield'
LEFT JOIN `portal_settings` pt ON pt.`setting_key` = 'power_tariff_rate'
LEFT JOIN `portal_settings` bx ON bx.`setting_key` = 'brix_threshold'
ON DUPLICATE KEY UPDATE `updated_at` = `season_bi_constants`.`updated_at`;
