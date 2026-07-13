-- Sugar House Equipment History (new hub) — shn_* tables
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_add_sugar_house_equipment_new_tables.sql

USE __MYSQL_DATABASE__;

CREATE TABLE IF NOT EXISTS `shn_equipment` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `dept`        VARCHAR(20)  NOT NULL DEFAULT 'sugar_house',
  `category`    VARCHAR(100) DEFAULT NULL,
  `subcategory` VARCHAR(100) DEFAULT NULL,
  `equip_no`    VARCHAR(100) DEFAULT NULL,
  `tag_name`    VARCHAR(100) DEFAULT NULL,
  `name`        VARCHAR(300) NOT NULL,
  `location`    VARCHAR(200) DEFAULT NULL,
  `commissioned` VARCHAR(100) DEFAULT NULL,
  `drive`       VARCHAR(200) DEFAULT NULL,
  `photo`       MEDIUMTEXT   DEFAULT NULL,
  `plate`       MEDIUMTEXT   DEFAULT NULL,
  `sort_order`  INT          NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_shn_dept (dept),
  INDEX idx_shn_category (category, subcategory),
  INDEX idx_shn_sort (dept, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `shn_specs` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `equip_id`    INT          NOT NULL,
  `section`     VARCHAR(32)  DEFAULT NULL,
  `sub_section` VARCHAR(200) DEFAULT NULL,
  `lbl`         VARCHAR(300) NOT NULL,
  `val`         MEDIUMTEXT   DEFAULT NULL,
  `sort_order`  INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (`equip_id`) REFERENCES `shn_equipment`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `shn_oem_schedule` (
  `id`       INT AUTO_INCREMENT PRIMARY KEY,
  `equip_id` INT          NOT NULL,
  `section`     VARCHAR(32)  DEFAULT NULL,
  `sub_section` VARCHAR(200) DEFAULT NULL,
  `equipment_refs` JSON        DEFAULT NULL,
  `no`       INT          NOT NULL DEFAULT 0,
  `comp`     VARCHAR(300) DEFAULT NULL,
  `act`      TEXT         DEFAULT NULL,
  `iv_W`     CHAR(1)      DEFAULT NULL,
  `iv_M`     CHAR(1)      DEFAULT NULL,
  `iv_Q`     CHAR(1)      DEFAULT NULL,
  `iv_H`     CHAR(1)      DEFAULT NULL,
  `iv_Y`     CHAR(1)      DEFAULT NULL,
  `iv_T`     CHAR(1)      DEFAULT NULL,
  `iv_3Y`    CHAR(1)      DEFAULT NULL,
  FOREIGN KEY (`equip_id`) REFERENCES `shn_equipment`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `shn_history` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `equip_id`    INT          NOT NULL,
  `section`     VARCHAR(32)  DEFAULT NULL,
  `sub_section` VARCHAR(200) DEFAULT NULL,
  `equipment_refs` JSON        DEFAULT NULL,
  `season`      VARCHAR(20)  DEFAULT NULL,
  `year`        VARCHAR(50)  DEFAULT NULL,
  `date_start`  DATE         DEFAULT NULL,
  `date_finish` DATE         DEFAULT NULL,
  `obs`         TEXT         DEFAULT NULL,
  `act`         TEXT         DEFAULT NULL,
  `cost`        VARCHAR(50)  DEFAULT NULL,
  `svc`         VARCHAR(20)  DEFAULT NULL,
  `maintenance_type` VARCHAR(20) DEFAULT NULL,
  `provider`    VARCHAR(300) DEFAULT NULL,
  `resp`        VARCHAR(300) DEFAULT NULL,
  `rem`         TEXT         DEFAULT NULL,
  `img_before`  MEDIUMTEXT   DEFAULT NULL,
  `img_after`   MEDIUMTEXT   DEFAULT NULL,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`equip_id`) REFERENCES `shn_equipment`(`id`) ON DELETE CASCADE,
  INDEX idx_shn_history_sub_group (equip_id, section, sub_section)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
