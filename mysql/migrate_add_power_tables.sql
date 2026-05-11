-- Same DDL is included in mysql/init.sql (npm run db:schema). This file is optional on its own.
USE gsmadb;

CREATE TABLE IF NOT EXISTS `pp_equipment` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `dept`        VARCHAR(20)  NOT NULL DEFAULT 'electrical',
  `equip_no`    VARCHAR(100) DEFAULT NULL,
  `name`        VARCHAR(300) NOT NULL,
  `location`    VARCHAR(200) DEFAULT NULL,
  `commissioned` VARCHAR(100) DEFAULT NULL,
  `drive`       VARCHAR(200) DEFAULT NULL,
  `photo`       MEDIUMTEXT   DEFAULT NULL,
  `plate`       MEDIUMTEXT   DEFAULT NULL,
  `sort_order`  INT          NOT NULL DEFAULT 0,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_dept (dept),
  INDEX idx_sort (dept, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pp_specs` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `equip_id`    INT          NOT NULL,
  `lbl`         VARCHAR(300) NOT NULL,
  `val`         TEXT         DEFAULT NULL,
  `sort_order`  INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (`equip_id`) REFERENCES `pp_equipment`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pp_oem_schedule` (
  `id`       INT AUTO_INCREMENT PRIMARY KEY,
  `equip_id` INT          NOT NULL,
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
  FOREIGN KEY (`equip_id`) REFERENCES `pp_equipment`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pp_history` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `equip_id`    INT          NOT NULL,
  `season`      VARCHAR(20)  DEFAULT NULL,
  `year`        VARCHAR(50)  DEFAULT NULL,
  `date_start`  DATE         DEFAULT NULL,
  `date_finish` DATE         DEFAULT NULL,
  `obs`         TEXT         DEFAULT NULL,
  `act`         TEXT         DEFAULT NULL,
  `cost`        VARCHAR(50)  DEFAULT NULL,
  `svc`         VARCHAR(20)  DEFAULT NULL,
  `provider`    VARCHAR(300) DEFAULT NULL,
  `resp`        VARCHAR(300) DEFAULT NULL,
  `rem`         TEXT         DEFAULT NULL,
  `img_before`  MEDIUMTEXT   DEFAULT NULL,
  `img_after`   MEDIUMTEXT   DEFAULT NULL,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`equip_id`) REFERENCES `pp_equipment`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
