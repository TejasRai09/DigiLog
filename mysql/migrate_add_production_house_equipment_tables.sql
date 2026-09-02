-- Production House Equipment History — phn_* tables
-- Specs + maintenance history only (no OEM schedule).
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_add_production_house_equipment_tables.sql

USE `__MYSQL_DATABASE__`;

CREATE TABLE IF NOT EXISTS `phn_equipment` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `house_section` VARCHAR(40)  NOT NULL,
  `sheet_name`    VARCHAR(120) NOT NULL,
  `equip_no`      VARCHAR(40)  DEFAULT NULL,
  `name`          VARCHAR(300) NOT NULL,
  `type`          VARCHAR(100) DEFAULT NULL,
  `duty`          VARCHAR(200) DEFAULT NULL,
  `capacity`      VARCHAR(100) DEFAULT NULL,
  `photo`         MEDIUMTEXT   DEFAULT NULL,
  `plate`         MEDIUMTEXT   DEFAULT NULL,
  `sort_order`    INT          NOT NULL DEFAULT 0,
  `created_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_phn_house_sheet (`house_section`, `sheet_name`),
  INDEX idx_phn_house (`house_section`, `sort_order`),
  INDEX idx_phn_name (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `phn_specs` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `equip_id`    INT          NOT NULL,
  `section`     VARCHAR(32)  DEFAULT NULL,
  `sub_section` VARCHAR(200) DEFAULT NULL,
  `lbl`         VARCHAR(500) NOT NULL,
  `val`         MEDIUMTEXT   DEFAULT NULL,
  `sort_order`  INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (`equip_id`) REFERENCES `phn_equipment`(`id`) ON DELETE CASCADE,
  INDEX idx_phn_specs_equip (`equip_id`, `sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `phn_history` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `equip_id`         INT          NOT NULL,
  `section`          VARCHAR(32)  DEFAULT NULL,
  `sub_section`      VARCHAR(200) DEFAULT NULL,
  `season`           VARCHAR(20)  DEFAULT NULL,
  `year`             VARCHAR(64)  DEFAULT NULL,
  `date_start`       DATE         DEFAULT NULL,
  `date_finish`      DATE         DEFAULT NULL,
  `obs`              TEXT         DEFAULT NULL,
  `act`              TEXT         DEFAULT NULL,
  `cost`             VARCHAR(50)  DEFAULT NULL,
  `svc`              VARCHAR(20)  DEFAULT NULL,
  `maintenance_type` VARCHAR(20)  DEFAULT NULL,
  `provider`         VARCHAR(300) DEFAULT NULL,
  `resp`             VARCHAR(300) DEFAULT NULL,
  `rem`              TEXT         DEFAULT NULL,
  `img_before`       MEDIUMTEXT   DEFAULT NULL,
  `img_after`        MEDIUMTEXT   DEFAULT NULL,
  `created_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`equip_id`) REFERENCES `phn_equipment`(`id`) ON DELETE CASCADE,
  INDEX idx_phn_history_equip (`equip_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
