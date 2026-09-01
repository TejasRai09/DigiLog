CREATE TABLE IF NOT EXISTS `season_mapping` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `season_label` VARCHAR(50) NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `season_mapping_season_label_key` (`season_label`)
);

INSERT INTO `season_mapping` (`season_label`, `start_date`, `end_date`) VALUES
('2023-2024', '2023-11-16', '2024-04-17'),
('2024-2025', '2024-10-27', '2025-03-29'),
('2025-2026', '2025-10-22', '2026-04-06'),
('2026-2027', '2026-10-25', '2027-04-06')
ON DUPLICATE KEY UPDATE 
  `start_date` = VALUES(`start_date`),
  `end_date` = VALUES(`end_date`);
