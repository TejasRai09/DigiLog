-- EHS Water Dashboard — ETP Working & CPU Water Recycle tables

CREATE TABLE IF NOT EXISTS `ehs_water_etp` (
  `id`                INT           NOT NULL AUTO_INCREMENT,
  `Date`              DATE              DEFAULT NULL,
  `cane_crush_ondate` DECIMAL(10,2)     DEFAULT NULL,
  `cane_crush_todate` DECIMAL(12,2)     DEFAULT NULL,
  `etp_inlet_meter`   DECIMAL(12,2)     DEFAULT NULL,
  `etp_inlet_kl`      DECIMAL(10,2)     DEFAULT NULL,
  `etp_outlet_meter`  DECIMAL(12,2)     DEFAULT NULL,
  `etp_outlet_kl`     DECIMAL(10,2)     DEFAULT NULL,
  `effluent_200ltcd`  DECIMAL(10,4)     DEFAULT NULL,
  `ph_g_shift`        DECIMAL(5,2)      DEFAULT NULL,
  `tss`               DECIMAL(8,2)      DEFAULT NULL,
  `cod`               DECIMAL(8,2)      DEFAULT NULL,
  `bod`               DECIMAL(8,2)      DEFAULT NULL,
  `tds`               DECIMAL(8,2)      DEFAULT NULL,
  `oil_grease`        VARCHAR(20)       DEFAULT NULL,
  `ondate_kld`        DECIMAL(10,2)     DEFAULT NULL,
  `remarks`           TEXT              DEFAULT NULL,
  `timestamp`         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ehs_water_cpu` (
  `id`                      INT           NOT NULL AUTO_INCREMENT,
  `Date`                    DATE              DEFAULT NULL,
  `cane_crush_ondate`       DECIMAL(10,2)     DEFAULT NULL,
  `cane_crush_todate`       DECIMAL(12,2)     DEFAULT NULL,
  `cpu_inlet_ondate`        DECIMAL(10,2)     DEFAULT NULL,
  `cpu_inlet_todate`        DECIMAL(12,2)     DEFAULT NULL,
  `cpu_outlet_ondate`       DECIMAL(10,2)     DEFAULT NULL,
  `cpu_outlet_todate`       DECIMAL(12,2)     DEFAULT NULL,
  `effluent_200ltcd_ondate` DECIMAL(10,4)     DEFAULT NULL,
  `effluent_200ltcd_todate` DECIMAL(12,4)     DEFAULT NULL,
  `inlet_ph_a`              DECIMAL(5,2)      DEFAULT NULL,
  `inlet_ph_b`              DECIMAL(5,2)      DEFAULT NULL,
  `inlet_ph_c`              DECIMAL(5,2)      DEFAULT NULL,
  `outlet_ph`               DECIMAL(5,2)      DEFAULT NULL,
  `outlet_tss`              VARCHAR(20)       DEFAULT NULL,
  `outlet_cod`              VARCHAR(20)       DEFAULT NULL,
  `outlet_bod`              VARCHAR(20)       DEFAULT NULL,
  `outlet_tds`              VARCHAR(20)       DEFAULT NULL,
  `oil_grease`              VARCHAR(20)       DEFAULT NULL,
  `transmittance`           VARCHAR(20)       DEFAULT NULL,
  `remarks`                 TEXT              DEFAULT NULL,
  `timestamp`               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
