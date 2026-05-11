-- EHS (Environment Health & Safety) tables
-- Run this on the gsmadb database

CREATE TABLE IF NOT EXISTS `ehs_near_miss` (
  `id`               INT          NOT NULL AUTO_INCREMENT,
  `Date`             DATE             DEFAULT NULL,
  `Time`             VARCHAR(20)      DEFAULT NULL,
  `name`             VARCHAR(255)     DEFAULT NULL,
  `contact_no`       VARCHAR(50)      DEFAULT NULL,
  `department`       VARCHAR(255)     DEFAULT NULL,
  `person_type`      VARCHAR(50)      DEFAULT NULL,
  `person_type_other` VARCHAR(255)    DEFAULT NULL,
  `location`         VARCHAR(255)     DEFAULT NULL,
  `severity`         VARCHAR(50)      DEFAULT NULL,
  `treatment`        VARCHAR(50)      DEFAULT NULL,
  `treatment_given`  TEXT             DEFAULT NULL,
  `treatment_by`     VARCHAR(255)     DEFAULT NULL,
  `description`      TEXT             DEFAULT NULL,
  `hazard_identified` VARCHAR(5)      DEFAULT NULL,
  `hod_comments`     TEXT             DEFAULT NULL,
  `hod_signed`       VARCHAR(255)     DEFAULT NULL,
  `hod_position`     VARCHAR(255)     DEFAULT NULL,
  `hod_date`         DATE             DEFAULT NULL,
  `timestamp`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ehs_accident` (
  `id`               INT          NOT NULL AUTO_INCREMENT,
  `Date`             DATE             DEFAULT NULL,
  `Time`             VARCHAR(20)      DEFAULT NULL,
  `injured_person`   VARCHAR(255)     DEFAULT NULL,
  `department`       VARCHAR(255)     DEFAULT NULL,
  `location`         VARCHAR(255)     DEFAULT NULL,
  `type_of_accident` VARCHAR(20)      DEFAULT NULL,
  `description`      TEXT             DEFAULT NULL,
  `timestamp`        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ehs_water_gwa` (
  `id`                  INT           NOT NULL AUTO_INCREMENT,
  `Date`                DATE              DEFAULT NULL,
  `Time`                VARCHAR(20)       DEFAULT NULL,
  `gw_pump1_meter`      DECIMAL(12,2)     DEFAULT NULL,
  `gw_pump1_ext_kl`     DECIMAL(10,2)     DEFAULT NULL,
  `gw_pump2_meter`      DECIMAL(12,2)     DEFAULT NULL,
  `gw_pump2_ext_kl`     DECIMAL(10,2)     DEFAULT NULL,
  `total_ext_kl`        DECIMAL(10,2)     DEFAULT NULL,
  `dom_colony`          DECIMAL(10,2)     DEFAULT NULL,
  `dom_fire`            DECIMAL(10,2)     DEFAULT NULL,
  `ind_distillery`      DECIMAL(10,2)     DEFAULT NULL,
  `ind_power_plant`     DECIMAL(10,2)     DEFAULT NULL,
  `ind_refinery`        DECIMAL(10,2)     DEFAULT NULL,
  `total_industrial`    DECIMAL(10,2)     DEFAULT NULL,
  `cane_crush_ondate`   DECIMAL(10,2)     DEFAULT NULL,
  `cane_crush_todate`   DECIMAL(12,2)     DEFAULT NULL,
  `sugar_total_lt`      DECIMAL(10,4)     DEFAULT NULL,
  `industrial_lt`       DECIMAL(10,4)     DEFAULT NULL,
  `total_ext_sugar_lt`  DECIMAL(10,4)     DEFAULT NULL,
  `remarks`             TEXT              DEFAULT NULL,
  `timestamp`           TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
