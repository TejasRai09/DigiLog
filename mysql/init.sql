-- ═══════════════════════════════════════════════════════════
--  GSMA Portal – MySQL schema (gsmadb)
--  Run once: Get-Content mysql\init.sql | mysql -u root -p
--
--  Forward schema changes for form/logbook tables (Mill, Lab, Power,
--  Distillery) are managed with Prisma Migrate from DigiLog/backend:
--    npm run db:migrate:dev        (dev)
--    npm run db:migrate:deploy     (CI/prod)
--  Users `department` / `avatar`: included in CREATE below. OLD DBs missing them: run
--  `cd DigiLog/backend && npm run db:schema` (script adds columns idempotently: users profile,
--  distillery_operations `FS%` / total_mol_in_store_qtls if missing).
--  Prisma: migration 20260512140000_users_department_avatar; if columns already exist from
--  init/db:schema, use `prisma migrate resolve --applied 20260512140000_users_department_avatar` once.
--  If you created the DB with this file first, sync migration history:
--    cd backend && npm run db:migrate:resolve-baseline
-- ═══════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS gsmadb CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE gsmadb; 

-- ── System tables (users, apps, forms, mappings) ──────────

CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `name`          VARCHAR(200) NOT NULL,
  `department`    VARCHAR(255) DEFAULT NULL,
  `avatar`        MEDIUMTEXT   DEFAULT NULL,
  `email`         VARCHAR(200) NOT NULL UNIQUE,
  `password`      VARCHAR(200) DEFAULT NULL,
  `role`          ENUM('admin','employee') NOT NULL DEFAULT 'employee',
  `is_active`     TINYINT(1)   NOT NULL DEFAULT 1,
  `auth_provider` VARCHAR(20)  NOT NULL DEFAULT 'local',
  `mail_sent`     TINYINT(1)   NOT NULL DEFAULT 0,
  `microsoft_id`  VARCHAR(200) DEFAULT NULL,
  `google_id`     VARCHAR(200) DEFAULT NULL,
  `manager_id`    INT          DEFAULT NULL,
  `created_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- manager_id FK is added idempotently by apply-init-sql.js (ensureManagerColumn),
-- not inline here, because MySQL does not support ADD CONSTRAINT IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS `apps` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(200) NOT NULL UNIQUE,
  `description` VARCHAR(500) DEFAULT NULL,
  `icon`        VARCHAR(100) DEFAULT NULL,
  `color`       VARCHAR(20)  DEFAULT NULL,
  `sort_order`  INT          NOT NULL DEFAULT 0,
  `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `forms` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(200) NOT NULL,
  `description` VARCHAR(500) DEFAULT NULL,
  `form_key`    VARCHAR(100) NOT NULL UNIQUE,
  `app_id`      INT          NOT NULL,
  `sort_order`  INT          NOT NULL DEFAULT 0,
  `is_active`   TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `mappings` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT NOT NULL,
  `app_id`     INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_user_app` (`user_id`, `app_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)  ON DELETE CASCADE,
  FOREIGN KEY (`app_id`)  REFERENCES `apps`(`id`)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `mapping_forms` (
  `mapping_id` INT NOT NULL,
  `form_id`    INT NOT NULL,
  PRIMARY KEY (`mapping_id`, `form_id`),
  FOREIGN KEY (`mapping_id`) REFERENCES `mappings`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`form_id`)    REFERENCES `forms`(`id`)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Portal-wide settings (admin toggles, e.g. BI third season compare).
CREATE TABLE IF NOT EXISTS `portal_settings` (
  `setting_key`   VARCHAR(64)  NOT NULL,
  `setting_value` VARCHAR(255) NOT NULL,
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `portal_settings` (`setting_key`, `setting_value`)
VALUES ('bi_third_season_compare', '0')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;

-- Homepage big-card access (Forms Hub / BI Control Tower on `/`).
CREATE TABLE IF NOT EXISTS `user_homepage_cards` (
  `user_id`    INT          NOT NULL,
  `card_key`   VARCHAR(32)  NOT NULL,
  `created_at` TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`, `card_key`),
  INDEX `user_homepage_cards_user_id_idx` (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill: give forms_hub to everyone with a non-BI mapping,
--           give bi_control_tower to everyone mapped to the BI app.
INSERT IGNORE INTO `user_homepage_cards` (`user_id`, `card_key`)
  SELECT DISTINCT m.user_id, 'forms_hub'
  FROM `mappings` m
  JOIN `apps` a ON a.id = m.app_id
  WHERE a.name <> 'BI Control Tower';

INSERT IGNORE INTO `user_homepage_cards` (`user_id`, `card_key`)
  SELECT DISTINCT m.user_id, 'bi_control_tower'
  FROM `mappings` m
  JOIN `apps` a ON a.id = m.app_id
  WHERE a.name = 'BI Control Tower';

-- Data Upload tab access (admin grants per employee).
CREATE TABLE IF NOT EXISTS `user_data_upload_access` (
  `user_id`     INT NOT NULL,
  `granted_by`  INT DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Uploaded telemetry / log files (disk path + uploader audit).
CREATE TABLE IF NOT EXISTS `data_upload_files` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`            INT NOT NULL,
  `category`           VARCHAR(200) NOT NULL,
  `original_filename`  VARCHAR(255) NOT NULL,
  `stored_filename`    VARCHAR(255) NOT NULL,
  `mime_type`          VARCHAR(128) DEFAULT NULL,
  `file_size_bytes`    BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_stored_filename` (`stored_filename`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_data_upload_created` (`created_at` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ── App 1: GSMA Mill Logbook ──────────────────────────────

CREATE TABLE IF NOT EXISTS `mill_logbook1` (
  `Date` DATE NULL DEFAULT NULL,
  `Shift` VARCHAR(10) NULL DEFAULT NULL,
  `Time` DATETIME NULL DEFAULT NULL,
  `CaneKeig_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `CaneKeig_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `CaneKeig_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `CaneKeig_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `CaneKeig_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `CardDrum1_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `CardDrum1_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `CardDrum1_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `CardDrum1_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `CardDrum1_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `CardDrum2_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `CardDrum2_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `CardDrum2_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `CardDrum2_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `CardDrum2_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `FeedDrum_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `FeedDrum_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `FeedDrum_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `FeedDrum_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `FeedDrum_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `CaneCar_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `CaneCar_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `CaneCar_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `CaneCar_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `CaneCar_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `ShredCar_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `ShredCar_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `ShredCar_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `ShredCar_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `ShredCar_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `BeltConvy_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `BeltConvy_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `BeltConvy_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `BeltConvy_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `BeltConvy_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `IRC1_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `IRC1_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `IRC1_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `IRC1_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `IRC1_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `IRC2_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `IRC2_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `IRC2_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `IRC2_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `IRC2_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `IRC3_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `IRC3_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `IRC3_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `IRC3_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `IRC3_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `IRC4_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `IRC4_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `IRC4_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `IRC4_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `IRC4_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `Mill0_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `Mill0_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `Mill0_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `Mill0_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `Mill0_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `Mill4_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `Mill4_GearTempDE` DOUBLE NULL DEFAULT NULL,
  `Mill4_GearTempNDE` DOUBLE NULL DEFAULT NULL,
  `Mill4_BearTempDE` DOUBLE NULL DEFAULT NULL,
  `Mill4_BearTempNDE` DOUBLE NULL DEFAULT NULL,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `mill_logbook2` (
  `Date` DATE NULL DEFAULT NULL,
  `Shift` VARCHAR(10) NULL DEFAULT NULL,
  `Time` DATETIME NULL DEFAULT NULL,
  `shredR_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `shredR_BearTempSite` DOUBLE NULL DEFAULT NULL,
  `shredR_BearTempDCS` DOUBLE NULL DEFAULT NULL,
  `shredR_VibH` DOUBLE NULL DEFAULT NULL,
  `shredR_VibV` DOUBLE NULL DEFAULT NULL,
  `shredR_VibA` DOUBLE NULL DEFAULT NULL,
  `shredL_MtrTemp` DOUBLE NULL DEFAULT NULL,
  `shredL_BearTempSite` DOUBLE NULL DEFAULT NULL,
  `shredL_BearTempDCS` DOUBLE NULL DEFAULT NULL,
  `shredL_VibH` DOUBLE NULL DEFAULT NULL,
  `shredL_VibV` DOUBLE NULL DEFAULT NULL,
  `shredL_VibA` DOUBLE NULL DEFAULT NULL,
  `M1_InpT` DOUBLE NULL DEFAULT NULL,
  `M1_InpM` DOUBLE NULL DEFAULT NULL,
  `M1_IntT` DOUBLE NULL DEFAULT NULL,
  `M1_IntM` DOUBLE NULL DEFAULT NULL,
  `M1_OutT` DOUBLE NULL DEFAULT NULL,
  `M1_OutM` DOUBLE NULL DEFAULT NULL,
  `M2_InpT` DOUBLE NULL DEFAULT NULL,
  `M2_InpM` DOUBLE NULL DEFAULT NULL,
  `M2_IntT` DOUBLE NULL DEFAULT NULL,
  `M2_IntM` DOUBLE NULL DEFAULT NULL,
  `M2_OutT` DOUBLE NULL DEFAULT NULL,
  `M2_OutM` DOUBLE NULL DEFAULT NULL,
  `M3_InpT` DOUBLE NULL DEFAULT NULL,
  `M3_InpM` DOUBLE NULL DEFAULT NULL,
  `M3_IntT` DOUBLE NULL DEFAULT NULL,
  `M3_IntM` DOUBLE NULL DEFAULT NULL,
  `M3_OutT` DOUBLE NULL DEFAULT NULL,
  `M3_OutM` DOUBLE NULL DEFAULT NULL,
  `M4_InpT` DOUBLE NULL DEFAULT NULL,
  `M4_InpM` DOUBLE NULL DEFAULT NULL,
  `M4_IntT` DOUBLE NULL DEFAULT NULL,
  `M4_IntM` DOUBLE NULL DEFAULT NULL,
  `M4_OutT` DOUBLE NULL DEFAULT NULL,
  `M4_OutM` DOUBLE NULL DEFAULT NULL,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `mill_logbook3` (
  `Date` DATE NULL DEFAULT NULL,
  `Shift` VARCHAR(10) NULL DEFAULT NULL,
  `Time` DATETIME NULL DEFAULT NULL,
  `LubePressure_ACC` DOUBLE NULL DEFAULT NULL,
  `LubePressure_MCC` DOUBLE NULL DEFAULT NULL,
  `LubePressure_Shred` DOUBLE NULL DEFAULT NULL,
  `LubePressure_M0` DOUBLE NULL DEFAULT NULL,
  `M0_gsT` DOUBLE NULL DEFAULT NULL,
  `M0_gsB` DOUBLE NULL DEFAULT NULL,
  `M0_gsUF` DOUBLE NULL DEFAULT NULL,
  `M0_psT` DOUBLE NULL DEFAULT NULL,
  `M0_psB` DOUBLE NULL DEFAULT NULL,
  `M0_psUF` DOUBLE NULL DEFAULT NULL,
  `M1_gsT` DOUBLE NULL DEFAULT NULL,
  `M1_gsB` DOUBLE NULL DEFAULT NULL,
  `M1_gsUF` DOUBLE NULL DEFAULT NULL,
  `M1_psT` DOUBLE NULL DEFAULT NULL,
  `M1_psB` DOUBLE NULL DEFAULT NULL,
  `M1_psUF` DOUBLE NULL DEFAULT NULL,
  `M2_gsT` DOUBLE NULL DEFAULT NULL,
  `M2_gsB` DOUBLE NULL DEFAULT NULL,
  `M2_gsUF` DOUBLE NULL DEFAULT NULL,
  `M2_psT` DOUBLE NULL DEFAULT NULL,
  `M2_psB` DOUBLE NULL DEFAULT NULL,
  `M2_psUF` DOUBLE NULL DEFAULT NULL,
  `M3_gsT` DOUBLE NULL DEFAULT NULL,
  `M3_gsB` DOUBLE NULL DEFAULT NULL,
  `M3_gsUF` DOUBLE NULL DEFAULT NULL,
  `M3_psT` DOUBLE NULL DEFAULT NULL,
  `M3_psB` DOUBLE NULL DEFAULT NULL,
  `M3_psUF` DOUBLE NULL DEFAULT NULL,
  `M4_gsT` DOUBLE NULL DEFAULT NULL,
  `M4_gsB` DOUBLE NULL DEFAULT NULL,
  `M4_gsUF` DOUBLE NULL DEFAULT NULL,
  `M4_psT` DOUBLE NULL DEFAULT NULL,
  `M4_psB` DOUBLE NULL DEFAULT NULL,
  `M4_psUF` DOUBLE NULL DEFAULT NULL,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `mill_stoppages` (
  `Date` DATE NULL DEFAULT NULL,
  `start_time` DATETIME NULL DEFAULT NULL,
  `end_time` DATETIME NULL DEFAULT NULL,
  `section` VARCHAR(100) NULL DEFAULT NULL,
  `machinery` VARCHAR(200) NULL DEFAULT NULL,
  `remarks` VARCHAR(600) NULL DEFAULT NULL,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ── App 2: GSMA Lab Logbook ───────────────────────────────

CREATE TABLE IF NOT EXISTS `ds_logbook` (
  `Date` DATE NULL DEFAULT NULL,
  `Shift` VARCHAR(10) NULL DEFAULT NULL,
  `Sampling_time` VARCHAR(10) NULL DEFAULT NULL,
  `PJ_Pol` DOUBLE NULL DEFAULT NULL,
  `PJ_Brix` DOUBLE NULL DEFAULT NULL,
  `MJ_Pol` DOUBLE NULL DEFAULT NULL,
  `MJ_Brix` DOUBLE NULL DEFAULT NULL,
  `LMJ_Pol` DOUBLE NULL DEFAULT NULL,
  `LMJ_Brix` DOUBLE NULL DEFAULT NULL,
  `CJ_Pol` DOUBLE NULL DEFAULT NULL,
  `CJ_Brix` DOUBLE NULL DEFAULT NULL,
  `FJ_Pol` DOUBLE NULL DEFAULT NULL,
  `FJ_Brix` DOUBLE NULL DEFAULT NULL,
  `USul_Syrp_Pol` DOUBLE NULL DEFAULT NULL,
  `USul_Syrp_Brix` DOUBLE NULL DEFAULT NULL,
  `Sul_Syrp_Pol` DOUBLE NULL DEFAULT NULL,
  `Sul_Syrp_Brix` DOUBLE NULL DEFAULT NULL,
  `A_Mc_Pol` DOUBLE NULL DEFAULT NULL,
  `A_Mc_Brix` DOUBLE NULL DEFAULT NULL,
  `B_Mc_Pol` DOUBLE NULL DEFAULT NULL,
  `B_Mc_Brix` DOUBLE NULL DEFAULT NULL,
  `A1_Mc_Pol` DOUBLE NULL DEFAULT NULL,
  `A1_Mc_Brix` DOUBLE NULL DEFAULT NULL,
  `C_Mc_Pol` DOUBLE NULL DEFAULT NULL,
  `C_Mc_Brix` DOUBLE NULL DEFAULT NULL,
  `AH_Mol_Pol` DOUBLE NULL DEFAULT NULL,
  `AH_Mol_Brix` DOUBLE NULL DEFAULT NULL,
  `AL_Mol_Pol` DOUBLE NULL DEFAULT NULL,
  `AL_Mol_Brix` DOUBLE NULL DEFAULT NULL,
  `BH_Mol_Pol` DOUBLE NULL DEFAULT NULL,
  `BH_Mol_Brix` DOUBLE NULL DEFAULT NULL,
  `CL_Mol_Pol` DOUBLE NULL DEFAULT NULL,
  `CL_Mol_Brix` DOUBLE NULL DEFAULT NULL,
  `FMol_Pol` DOUBLE NULL DEFAULT NULL,
  `FMol_Brix` DOUBLE NULL DEFAULT NULL,
  `Bag_Pol` DOUBLE NULL DEFAULT NULL,
  `Bag_Moisture` DOUBLE NULL DEFAULT NULL,
  `FCake_Pol` DOUBLE NULL DEFAULT NULL,
  `op_mode` VARCHAR(10) NULL DEFAULT NULL,
  `A1_Mol_Pol` DOUBLE NULL DEFAULT NULL,
  `A1_Mol_Brix` DOUBLE NULL DEFAULT NULL,
  `MillDrain_Pol` DOUBLE NULL DEFAULT NULL,
  `BoilHouseDrain_Pol` DOUBLE NULL DEFAULT NULL,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `rs_logbook` (
  `Date` DATE NULL DEFAULT NULL,
  `Shift` VARCHAR(10) NULL DEFAULT NULL,
  `Sampling_time` VARCHAR(10) NULL DEFAULT NULL,
  `CJ_Pol` DOUBLE NULL DEFAULT NULL,
  `CJ_Brix` DOUBLE NULL DEFAULT NULL,
  `FJ_Pol` DOUBLE NULL DEFAULT NULL,
  `FJ_Brix` DOUBLE NULL DEFAULT NULL,
  `UtrSyrp_Pol` DOUBLE NULL DEFAULT NULL,
  `UtrSyrp_Brix` DOUBLE NULL DEFAULT NULL,
  `RawMc_Pol` DOUBLE NULL DEFAULT NULL,
  `RawMc_Brix` DOUBLE NULL DEFAULT NULL,
  `R1Mc_Pol` DOUBLE NULL DEFAULT NULL,
  `R1Mc_Brix` DOUBLE NULL DEFAULT NULL,
  `R2Mc_Pol` DOUBLE NULL DEFAULT NULL,
  `R2Mc_Brix` DOUBLE NULL DEFAULT NULL,
  `BMc_Pol` DOUBLE NULL DEFAULT NULL,
  `BMc_Brix` DOUBLE NULL DEFAULT NULL,
  `CMc_Pol` DOUBLE NULL DEFAULT NULL,
  `CMc_Brix` DOUBLE NULL DEFAULT NULL,
  `AH_Mol_Pol` DOUBLE NULL DEFAULT NULL,
  `AH_Mol_Brix` DOUBLE NULL DEFAULT NULL,
  `AL_Mol_Pol` DOUBLE NULL DEFAULT NULL,
  `AL_Mol_Brix` DOUBLE NULL DEFAULT NULL,
  `R1_Mol_Pol` DOUBLE NULL DEFAULT NULL,
  `R1_Mol_Brix` DOUBLE NULL DEFAULT NULL,
  `R2_Mol_Pol` DOUBLE NULL DEFAULT NULL,
  `R2_Mol_Brix` DOUBLE NULL DEFAULT NULL,
  `BH_Mol_Pol` DOUBLE NULL DEFAULT NULL,
  `BH_Mol_Brix` DOUBLE NULL DEFAULT NULL,
  `CL_Mol_Pol` DOUBLE NULL DEFAULT NULL,
  `CL_Mol_Brix` DOUBLE NULL DEFAULT NULL,
  `FMol_Pol` DOUBLE NULL DEFAULT NULL,
  `FMol_Brix` DOUBLE NULL DEFAULT NULL,
  `FCake_Pol` DOUBLE NULL DEFAULT NULL,
  `op_mode` VARCHAR(10) NULL DEFAULT NULL,
  `R1Mc_IU` DOUBLE NULL DEFAULT NULL,
  `R2Mc_IU` DOUBLE NULL DEFAULT NULL,
  `R1Mol_IU` DOUBLE NULL DEFAULT NULL,
  `R2Mol_IU` DOUBLE NULL DEFAULT NULL,
  `RawMlt_Pol` DOUBLE NULL DEFAULT NULL,
  `RawMlt_Brix` DOUBLE NULL DEFAULT NULL,
  `RawMlt_IU` DOUBLE NULL DEFAULT NULL,
  `ClearMlt_Pol` DOUBLE NULL DEFAULT NULL,
  `ClearMlt_Brix` DOUBLE NULL DEFAULT NULL,
  `ClearMlt_IU` DOUBLE NULL DEFAULT NULL,
  `Pol_FineLiqourMelt` DOUBLE NULL DEFAULT NULL,
  `Brix_FineLiqourMelt` DOUBLE NULL DEFAULT NULL,
  `IU_FineLiqourMelt` DOUBLE NULL DEFAULT NULL,
  `IERInlet_IU` DOUBLE NULL DEFAULT NULL,
  `IERInlet_PH` DOUBLE NULL DEFAULT NULL,
  `IEROutlet_IU` DOUBLE NULL DEFAULT NULL,
  `IEROutlet_PH` DOUBLE NULL DEFAULT NULL,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `ops_logbook` (
  `Date` DATE NULL DEFAULT NULL,
  `Shift` VARCHAR(10) NULL DEFAULT NULL,
  `Sampling_time` VARCHAR(10) NULL DEFAULT NULL,
  `yard_bal` DOUBLE NULL DEFAULT NULL,
  `crush` DOUBLE NULL DEFAULT NULL,
  `imb_wtr` DOUBLE NULL DEFAULT NULL,
  `imb_temp` DOUBLE NULL DEFAULT NULL,
  `mixj_ds` DOUBLE NULL DEFAULT NULL,
  `mixj_rs` DOUBLE NULL DEFAULT NULL,
  `mol_ds` DOUBLE NULL DEFAULT NULL,
  `mol_rs` DOUBLE NULL DEFAULT NULL,
  `fcake_ds` DOUBLE NULL DEFAULT NULL,
  `fcake_rs` DOUBLE NULL DEFAULT NULL,
  `qty_dsl` DOUBLE NULL DEFAULT NULL,
  `mesh_dsl` DOUBLE NULL DEFAULT NULL,
  `bagtemp_dsl` DOUBLE NULL DEFAULT NULL,
  `qty_dsm` DOUBLE NULL DEFAULT NULL,
  `mesh_dsm` DOUBLE NULL DEFAULT NULL,
  `bagtemp_dsm` DOUBLE NULL DEFAULT NULL,
  `qty_dss` DOUBLE NULL DEFAULT NULL,
  `mesh_dss` DOUBLE NULL DEFAULT NULL,
  `bagtemp_dss` DOUBLE NULL DEFAULT NULL,
  `qty_rsl` DOUBLE NULL DEFAULT NULL,
  `mesh_rsl` DOUBLE NULL DEFAULT NULL,
  `bagtemp_rsl` DOUBLE NULL DEFAULT NULL,
  `qty_rsm` DOUBLE NULL DEFAULT NULL,
  `mesh_rsm` DOUBLE NULL DEFAULT NULL,
  `bagtemp_rsm` DOUBLE NULL DEFAULT NULL,
  `qty_rss` DOUBLE NULL DEFAULT NULL,
  `mesh_rss` DOUBLE NULL DEFAULT NULL,
  `bagtemp_rss` DOUBLE NULL DEFAULT NULL,
  `qty_p20` DOUBLE NULL DEFAULT NULL,
  `bagtemp_p20` DOUBLE NULL DEFAULT NULL,
  `qty_p30` DOUBLE NULL DEFAULT NULL,
  `bagtemp_p30` DOUBLE NULL DEFAULT NULL,
  `qty_p40` DOUBLE NULL DEFAULT NULL,
  `bagtemp_p40` DOUBLE NULL DEFAULT NULL,
  `FBDInlet_TempDS` DOUBLE NULL DEFAULT NULL,
  `FBDInlet_MoistDS` DOUBLE NULL DEFAULT NULL,
  `FBDOutlet_TempDS` DOUBLE NULL DEFAULT NULL,
  `FBDOutlet_MoistDS` DOUBLE NULL DEFAULT NULL,
  `Hopper_TempDS` DOUBLE NULL DEFAULT NULL,
  `Hopper_MoistDS` DOUBLE NULL DEFAULT NULL,
  `FBDInlet_TempRS` DOUBLE NULL DEFAULT NULL,
  `FBDInlet_MoistRS` DOUBLE NULL DEFAULT NULL,
  `FBDOutlet_TempRS` DOUBLE NULL DEFAULT NULL,
  `FBDOutlet_MoistRS` DOUBLE NULL DEFAULT NULL,
  `Hopper_TempRS` DOUBLE NULL DEFAULT NULL,
  `Hopper_MoistRS` DOUBLE NULL DEFAULT NULL,
  `RSDInlet_Temp` DOUBLE NULL DEFAULT NULL,
  `RSDInlet_Moist` DOUBLE NULL DEFAULT NULL,
  `RSDOutlet_Temp` DOUBLE NULL DEFAULT NULL,
  `RSDOutlet_Moist` DOUBLE NULL DEFAULT NULL,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sa_logbook` (
  `Date` DATE NULL DEFAULT NULL,
  `Shift` VARCHAR(10) NULL DEFAULT NULL,
  `Sampling_time` VARCHAR(10) NULL DEFAULT NULL,
  `retn_DSL` DOUBLE NULL DEFAULT NULL,
  `retn_DSM` DOUBLE NULL DEFAULT NULL,
  `retn_DSS` DOUBLE NULL DEFAULT NULL,
  `retn_RSL` DOUBLE NULL DEFAULT NULL,
  `retn_RSM` DOUBLE NULL DEFAULT NULL,
  `retn_RSS` DOUBLE NULL DEFAULT NULL,
  `retn_Pharma20` DOUBLE NULL DEFAULT NULL,
  `retn_Pharma30` DOUBLE NULL DEFAULT NULL,
  `retn_Pharma40` DOUBLE NULL DEFAULT NULL,
  `moist_DSL` DOUBLE NULL DEFAULT NULL,
  `moist_DSM` DOUBLE NULL DEFAULT NULL,
  `moist_DSS` DOUBLE NULL DEFAULT NULL,
  `moist_RSL` DOUBLE NULL DEFAULT NULL,
  `moist_RSM` DOUBLE NULL DEFAULT NULL,
  `moist_RSS` DOUBLE NULL DEFAULT NULL,
  `moist_Pharma20` DOUBLE NULL DEFAULT NULL,
  `moist_Pharma30` DOUBLE NULL DEFAULT NULL,
  `moist_Pharma40` DOUBLE NULL DEFAULT NULL,
  `col_DSL` DOUBLE NULL DEFAULT NULL,
  `col_DSM` DOUBLE NULL DEFAULT NULL,
  `col_DSS` DOUBLE NULL DEFAULT NULL,
  `col_RSL` DOUBLE NULL DEFAULT NULL,
  `col_RSM` DOUBLE NULL DEFAULT NULL,
  `col_RSS` DOUBLE NULL DEFAULT NULL,
  `col_Pharma20` DOUBLE NULL DEFAULT NULL,
  `col_Pharma30` DOUBLE NULL DEFAULT NULL,
  `col_Pharma40` DOUBLE NULL DEFAULT NULL,
  `col_ClrJDS` DOUBLE NULL DEFAULT NULL,
  `col_RawMeltRS` DOUBLE NULL DEFAULT NULL,
  `col_ClrMeltRS` DOUBLE NULL DEFAULT NULL,
  `col_FineLqrRS` DOUBLE NULL DEFAULT NULL,
  `timestamp_col` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `syrp_logbook` (
  `Date` DATE NULL DEFAULT NULL,
  `Shift` VARCHAR(10) NULL DEFAULT NULL,
  `syrp_prodDS` DOUBLE NULL DEFAULT NULL,
  `syrp_prodRS` DOUBLE NULL DEFAULT NULL,
  `div_mode` VARCHAR(30) NULL DEFAULT NULL,
  `syrp_div` DOUBLE NULL DEFAULT NULL,
  `MoLtoDist_DS` DOUBLE NULL DEFAULT NULL,
  `MoLtoDist_RS` DOUBLE NULL DEFAULT NULL,
  `syrp_trs` DOUBLE NULL DEFAULT NULL,
  `bh_trs` DOUBLE NULL DEFAULT NULL,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `stoppage_logbook` (
  `Date` DATE NULL DEFAULT NULL,
  `start_time` DATETIME NULL DEFAULT NULL,
  `end_time` DATETIME NULL DEFAULT NULL,
  `department` VARCHAR(40) NULL DEFAULT NULL,
  `remarks` VARCHAR(225) NULL DEFAULT NULL,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ── App 3: GSMA Power Logbook ─────────────────────────────

CREATE TABLE IF NOT EXISTS `ph_power` (
  `Date` DATE NULL DEFAULT NULL,
  `Time` DATETIME NULL DEFAULT NULL,
  `Crush` DOUBLE NULL DEFAULT NULL,
  `Baggase` DOUBLE NULL DEFAULT NULL,
  `Hours30` DOUBLE NULL DEFAULT NULL,
  `Hours3Old` DOUBLE NULL DEFAULT NULL,
  `Hours3New` DOUBLE NULL DEFAULT NULL,
  `Hours4` DOUBLE NULL DEFAULT NULL,
  `PowerGen30` DOUBLE NULL DEFAULT NULL,
  `PowerGen3Old` DOUBLE NULL DEFAULT NULL,
  `PowerGen3New` DOUBLE NULL DEFAULT NULL,
  `PowerGen4MW` DOUBLE NULL DEFAULT NULL,
  `GenDG30` DOUBLE NULL DEFAULT NULL,
  `GenDG3Old` DOUBLE NULL DEFAULT NULL,
  `GenDG3New` DOUBLE NULL DEFAULT NULL,
  `GenDG4` DOUBLE NULL DEFAULT NULL,
  `ExportGrid30` DOUBLE NULL DEFAULT NULL,
  `ExportGrid3Old` DOUBLE NULL DEFAULT NULL,
  `ExportGrid3New` DOUBLE NULL DEFAULT NULL,
  `ExportGrid4` DOUBLE NULL DEFAULT NULL,
  `ExportSug30` DOUBLE NULL DEFAULT NULL,
  `ExportSug3Old` DOUBLE NULL DEFAULT NULL,
  `ExportSug3New` DOUBLE NULL DEFAULT NULL,
  `ExportSug4` DOUBLE NULL DEFAULT NULL,
  `ExportCogen30` DOUBLE NULL DEFAULT NULL,
  `ExportCogen3Old` DOUBLE NULL DEFAULT NULL,
  `ExportCogen3New` DOUBLE NULL DEFAULT NULL,
  `ExportCogen4` DOUBLE NULL DEFAULT NULL,
  `ExportDist30` DOUBLE NULL DEFAULT NULL,
  `Imp_Grid` DOUBLE NULL DEFAULT NULL,
  `Imp_3MWOld` DOUBLE NULL DEFAULT NULL,
  `Imp_3MWNew` DOUBLE NULL DEFAULT NULL,
  `Imp_4MW` DOUBLE NULL DEFAULT NULL,
  `PowerConMillHouse` DOUBLE NULL DEFAULT NULL,
  `PowerConDSHouse` DOUBLE NULL DEFAULT NULL,
  `PowerConRaw_Ref` DOUBLE NULL DEFAULT NULL,
  `PowerCon70TPH` DOUBLE NULL DEFAULT NULL,
  `PowerConETP` DOUBLE NULL DEFAULT NULL,
  `PowerConColony` DOUBLE NULL DEFAULT NULL,
  `PowerConOthers` DOUBLE NULL DEFAULT NULL,
  `remark` VARCHAR(600) NULL DEFAULT NULL,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `ph_steam` (
  `Date` DATE NULL DEFAULT NULL,
  `Time` DATETIME NULL DEFAULT NULL,
  `SteamGen150` DOUBLE NULL DEFAULT NULL,
  `SteamCon30MW` DOUBLE NULL DEFAULT NULL,
  `SteamtoSugar110_3ATAPRDS` DOUBLE NULL DEFAULT NULL,
  `Stmto3Old110_45ATAPRDS` DOUBLE NULL DEFAULT NULL,
  `Stmto3New110_45ATAPRDS` DOUBLE NULL DEFAULT NULL,
  `StmMillTurbine110_45ATAPRDS` DOUBLE NULL DEFAULT NULL,
  `StmtoDistil110_45ATAPRDS_o` DOUBLE NULL DEFAULT NULL,
  `Stm4MWTG110_45ATAPRDS` DOUBLE NULL DEFAULT NULL,
  `ExtractionStm30MW` DOUBLE NULL DEFAULT NULL,
  `Bleed2HPH1Stm` DOUBLE NULL DEFAULT NULL,
  `Bleed1HPH2Stm` DOUBLE NULL DEFAULT NULL,
  `TotalStmtoSug150` DOUBLE NULL DEFAULT NULL,
  `Stmtodeareator150` DOUBLE NULL DEFAULT NULL,
  `SteamGen35` DOUBLE NULL DEFAULT NULL,
  `StmCons4` DOUBLE NULL DEFAULT NULL,
  `StmCons45_55ATAPRDS` DOUBLE NULL DEFAULT NULL,
  `Stm45_55ATADeareatorEjectorPRDS` DOUBLE NULL DEFAULT NULL,
  `Extractionstm4` DOUBLE NULL DEFAULT NULL,
  `TotalStmdistil` DOUBLE NULL DEFAULT NULL,
  `StmtoEjector` DOUBLE NULL DEFAULT NULL,
  `Stm35TDeareator` DOUBLE NULL DEFAULT NULL,
  `StmtoSugDisti` DOUBLE NULL DEFAULT NULL,
  `SteamGen70` DOUBLE NULL DEFAULT NULL,
  `StmCons3Old35` DOUBLE NULL DEFAULT NULL,
  `StmCons3New35` DOUBLE NULL DEFAULT NULL,
  `StmDist70` DOUBLE NULL DEFAULT NULL,
  `Stmto4_70TPH` DOUBLE NULL DEFAULT NULL,
  `TotalStmtoSug70` DOUBLE NULL DEFAULT NULL,
  `Firewood150` DOUBLE NULL DEFAULT NULL,
  `Baggase150` DOUBLE NULL DEFAULT NULL,
  `Firewood70` DOUBLE NULL DEFAULT NULL,
  `Baggase70` DOUBLE NULL DEFAULT NULL,
  `Firewood35` DOUBLE NULL DEFAULT NULL,
  `Baggase35` DOUBLE NULL DEFAULT NULL,
  `SlopCon` DOUBLE NULL DEFAULT NULL,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `ph_stoppage` (
  `Date` DATE NULL DEFAULT NULL,
  `start_time` DATETIME NULL DEFAULT NULL,
  `end_Time` DATETIME NULL DEFAULT NULL,
  `section` VARCHAR(100) NULL DEFAULT NULL,
  `sub_section` VARCHAR(100) NULL DEFAULT NULL,
  `machinery` VARCHAR(100) NULL DEFAULT NULL,
  `category` VARCHAR(100) NULL DEFAULT NULL,
  `remarks` VARCHAR(300) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `timestamp` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ── Power Plant equipment (Electrical dept life card → /api/power) ──

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

CREATE TABLE IF NOT EXISTS `distillery_operations` (
  `Date`                      DATE         NULL DEFAULT NULL,
  `operation_mode`            VARCHAR(32)  NULL DEFAULT NULL,
  `syrup_molasses_qtls`       DOUBLE       NULL DEFAULT NULL,
  `wash_distilled`            DOUBLE       NULL DEFAULT NULL,
  `trs`                       DOUBLE       NULL DEFAULT NULL,
  `ufs`                       DOUBLE       NULL DEFAULT NULL,
  `alcohol_pct`               DOUBLE       NULL DEFAULT NULL,
  `actual_ethanol_bl`         DOUBLE       NULL DEFAULT NULL,
  `al_bl_ratio_pct`           DOUBLE       NULL DEFAULT NULL,
  `total_bh_molasses_qtls`    DOUBLE       NULL DEFAULT NULL,
  `total_ch_molasses_qtls`    DOUBLE       NULL DEFAULT NULL,
  `ethanol_storage_bl`        DOUBLE       NULL DEFAULT NULL,
  `fs`                        DOUBLE       NULL DEFAULT NULL,
  `fs_quantity`               DOUBLE       NULL DEFAULT NULL,
  `theoretical_yield`         DOUBLE       NULL DEFAULT NULL,
  `alcohol_prod_fermentation` DOUBLE       NULL DEFAULT NULL,
  `fe`                        DOUBLE       NULL DEFAULT NULL,
  `actual_prod_al`            DOUBLE       NULL DEFAULT NULL,
  `de`                        DOUBLE       NULL DEFAULT NULL,
  `oe`                        DOUBLE       NULL DEFAULT NULL,
  `rec_bl`                    DOUBLE       NULL DEFAULT NULL,
  `rec_al`                    DOUBLE       NULL DEFAULT NULL,
  `trs_qty`                   DOUBLE       NULL DEFAULT NULL,
  `ufs_qty`                   DOUBLE       NULL DEFAULT NULL,
  /* FS% = fs / trs; null when trs is 0 or operands missing */
  `FS%`                       DOUBLE       AS (IF(`trs` IS NOT NULL AND `trs` <> 0 AND `fs` IS NOT NULL, `fs` / `trs`, NULL)) STORED,
  /* Total molasses in store (Qtls) = BH + CH; null when both inputs null */
  `total_mol_in_store_qtls`   DOUBLE       AS (IF(`total_bh_molasses_qtls` IS NULL AND `total_ch_molasses_qtls` IS NULL, NULL, COALESCE(`total_bh_molasses_qtls`, 0) + COALESCE(`total_ch_molasses_qtls`, 0))) STORED,
  `timestamp`                 TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE = InnoDB DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ── Mill House Equipment Life History Card ────────────────────

CREATE TABLE IF NOT EXISTS `mh_equipment` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `equip_no`     VARCHAR(30)  NOT NULL,
  `plant`        VARCHAR(50)  NOT NULL DEFAULT 'Mill House',
  `name`         VARCHAR(200) NOT NULL,
  `location`     VARCHAR(200) DEFAULT NULL,
  `commissioned` VARCHAR(50)  DEFAULT NULL,
  `drive`        VARCHAR(300) DEFAULT NULL,
  `photo`        MEDIUMTEXT   DEFAULT NULL,
  `plate`        MEDIUMTEXT   DEFAULT NULL,
  `sort_order`   INT          NOT NULL DEFAULT 0,
  `created_at`   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `mh_specs` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `equip_id`   INT          NOT NULL,
  `lbl`        VARCHAR(300) NOT NULL,
  `val`        TEXT         DEFAULT NULL,
  `sort_order` INT          NOT NULL DEFAULT 0,
  FOREIGN KEY (`equip_id`) REFERENCES `mh_equipment`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `mh_oem_schedule` (
  `id`       INT AUTO_INCREMENT PRIMARY KEY,
  `equip_id` INT          NOT NULL,
  `no`       INT          NOT NULL,
  `comp`     VARCHAR(500) DEFAULT NULL,
  `act`      TEXT         DEFAULT NULL,
  `iv_W`     CHAR(1)      DEFAULT NULL,
  `iv_M`     CHAR(1)      DEFAULT NULL,
  `iv_Q`     CHAR(1)      DEFAULT NULL,
  `iv_H`     CHAR(1)      DEFAULT NULL,
  `iv_Y`     CHAR(1)      DEFAULT NULL,
  `iv_T`     CHAR(1)      DEFAULT NULL,
  FOREIGN KEY (`equip_id`) REFERENCES `mh_equipment`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `mh_history` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `equip_id`    INT          NOT NULL,
  `season`      VARCHAR(20)  DEFAULT NULL,
  `year`        VARCHAR(64)  DEFAULT NULL,
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
  FOREIGN KEY (`equip_id`) REFERENCES `mh_equipment`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Production Forms — 5 tables

CREATE TABLE IF NOT EXISTS `prod_shift_chemist` (
  `id`                    INT           NOT NULL AUTO_INCREMENT,
  `Date`                  DATE              DEFAULT NULL,
  `season`                VARCHAR(20)       DEFAULT NULL,
  `instructions`          TEXT              DEFAULT NULL,
  `shift8_4_jobs_done`    TEXT              DEFAULT NULL,
  `shift8_4_jobs_todo`    TEXT              DEFAULT NULL,
  `shift8_4_sign`         VARCHAR(100)      DEFAULT NULL,
  `shift4_12_jobs_done`   TEXT              DEFAULT NULL,
  `shift4_12_jobs_todo`   TEXT              DEFAULT NULL,
  `shift4_12_sign`        VARCHAR(100)      DEFAULT NULL,
  `shift12_8_jobs_done`   TEXT              DEFAULT NULL,
  `shift12_8_jobs_todo`   TEXT              DEFAULT NULL,
  `shift12_8_sign`        VARCHAR(100)      DEFAULT NULL,
  `timestamp`             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `prod_centrifugal` (
  `id`                    INT           NOT NULL AUTO_INCREMENT,
  `Date`                  DATE              DEFAULT NULL,
  `Shift`                 VARCHAR(20)       DEFAULT NULL,
  `shw_temp`              DECIMAL(8,2)      DEFAULT NULL,
  `shw_pressure`          DECIMAL(8,2)      DEFAULT NULL,
  `air_pressure`          DECIMAL(8,2)      DEFAULT NULL,
  `m1_basket_cleaning`    TINYINT(1)        DEFAULT NULL,
  `m1_screen_condition`   VARCHAR(100)      DEFAULT NULL,
  `m1_from`               VARCHAR(10)       DEFAULT NULL,
  `m1_to`                 VARCHAR(10)       DEFAULT NULL,
  `m1_duration`           VARCHAR(20)       DEFAULT NULL,
  `m1_reasons`            TEXT              DEFAULT NULL,
  `m1_separator`          TINYINT(1)        DEFAULT NULL,
  `m1_remarks`            TEXT              DEFAULT NULL,
  `m2_basket_cleaning`    TINYINT(1)        DEFAULT NULL,
  `m2_screen_condition`   VARCHAR(100)      DEFAULT NULL,
  `m2_from`               VARCHAR(10)       DEFAULT NULL,
  `m2_to`                 VARCHAR(10)       DEFAULT NULL,
  `m2_duration`           VARCHAR(20)       DEFAULT NULL,
  `m2_reasons`            TEXT              DEFAULT NULL,
  `m2_separator`          TINYINT(1)        DEFAULT NULL,
  `m2_remarks`            TEXT              DEFAULT NULL,
  `m3_basket_cleaning`    TINYINT(1)        DEFAULT NULL,
  `m3_screen_condition`   VARCHAR(100)      DEFAULT NULL,
  `m3_from`               VARCHAR(10)       DEFAULT NULL,
  `m3_to`                 VARCHAR(10)       DEFAULT NULL,
  `m3_duration`           VARCHAR(20)       DEFAULT NULL,
  `m3_reasons`            TEXT              DEFAULT NULL,
  `m3_separator`          TINYINT(1)        DEFAULT NULL,
  `m3_remarks`            TEXT              DEFAULT NULL,
  `m4_basket_cleaning`    TINYINT(1)        DEFAULT NULL,
  `m4_screen_condition`   VARCHAR(100)      DEFAULT NULL,
  `m4_from`               VARCHAR(10)       DEFAULT NULL,
  `m4_to`                 VARCHAR(10)       DEFAULT NULL,
  `m4_duration`           VARCHAR(20)       DEFAULT NULL,
  `m4_reasons`            TEXT              DEFAULT NULL,
  `m4_separator`          TINYINT(1)        DEFAULT NULL,
  `m4_remarks`            TEXT              DEFAULT NULL,
  `operator_sign`         VARCHAR(100)      DEFAULT NULL,
  `chemist_sign`          VARCHAR(100)      DEFAULT NULL,
  `section_head_sign`     VARCHAR(100)      DEFAULT NULL,
  `timestamp`             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `prod_pan_logbook` (
  `id`                    INT           NOT NULL AUTO_INCREMENT,
  `Date`                  DATE              DEFAULT NULL,
  `season`                VARCHAR(20)       DEFAULT NULL,
  `grade`                 VARCHAR(30)       DEFAULT NULL,
  `strike_no`             VARCHAR(20)       DEFAULT NULL,
  `pan_no`                VARCHAR(10)       DEFAULT NULL,
  `start_time`            VARCHAR(10)       DEFAULT NULL,
  `drop_time`             VARCHAR(10)       DEFAULT NULL,
  `boil_time`             VARCHAR(20)       DEFAULT NULL,
  `down_time`             VARCHAR(20)       DEFAULT NULL,
  `qty`                   VARCHAR(20)       DEFAULT NULL,
  `cry_no`                VARCHAR(20)       DEFAULT NULL,
  `sample_purity`         VARCHAR(20)       DEFAULT NULL,
  `brix`                  VARCHAR(20)       DEFAULT NULL,
  `purity`                VARCHAR(20)       DEFAULT NULL,
  `remarks`               TEXT              DEFAULT NULL,
  `timestamp`             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `prod_decanter` (
  `id`                    INT           NOT NULL AUTO_INCREMENT,
  `Date`                  DATE              DEFAULT NULL,
  `season`                VARCHAR(20)       DEFAULT NULL,
  `crop_day`              VARCHAR(10)       DEFAULT NULL,
  `time_slot`             VARCHAR(20)       DEFAULT NULL,
  `st1_mud`               DECIMAL(8,2)      DEFAULT NULL,
  `st1_centrate`          DECIMAL(8,2)      DEFAULT NULL,
  `st1_floc`              DECIMAL(8,2)      DEFAULT NULL,
  `st1_water`             DECIMAL(8,2)      DEFAULT NULL,
  `st1_load`              DECIMAL(8,2)      DEFAULT NULL,
  `st1_torque`            DECIMAL(8,2)      DEFAULT NULL,
  `st1_vib`               DECIMAL(8,2)      DEFAULT NULL,
  `st1_diff_speed`        DECIMAL(8,2)      DEFAULT NULL,
  `st2_mud`               DECIMAL(8,2)      DEFAULT NULL,
  `st2_centrate`          DECIMAL(8,2)      DEFAULT NULL,
  `st2_floc`              DECIMAL(8,2)      DEFAULT NULL,
  `st2_water`             DECIMAL(8,2)      DEFAULT NULL,
  `st2_load`              DECIMAL(8,2)      DEFAULT NULL,
  `st2_torque`            DECIMAL(8,2)      DEFAULT NULL,
  `st2_vib`               DECIMAL(8,2)      DEFAULT NULL,
  `st2_diff_speed`        DECIMAL(8,2)      DEFAULT NULL,
  `timestamp`             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `prod_clarification` (
  `id`                    INT           NOT NULL AUTO_INCREMENT,
  `Date`                  DATE              DEFAULT NULL,
  `season`                VARCHAR(20)       DEFAULT NULL,
  `crop_day`              VARCHAR(10)       DEFAULT NULL,
  `inst_hod`              TEXT              DEFAULT NULL,
  `inst_dy_hod`           TEXT              DEFAULT NULL,
  `inst_sectional_head`   TEXT              DEFAULT NULL,
  `time_slot`             VARCHAR(20)       DEFAULT NULL,
  `juice_flow`            DECIMAL(8,2)      DEFAULT NULL,
  `mol_dose`              DECIMAL(8,3)      DEFAULT NULL,
  `mol_set_be`            DECIMAL(8,2)      DEFAULT NULL,
  `mol_std_wt`            DECIMAL(8,2)      DEFAULT NULL,
  `mol_meas_be`           DECIMAL(8,2)      DEFAULT NULL,
  `mol_meas_wt`           DECIMAL(8,2)      DEFAULT NULL,
  `vessel_std_time`       DECIMAL(8,2)      DEFAULT NULL,
  `vessel_meas_time`      DECIMAL(8,2)      DEFAULT NULL,
  `ph_pre`                DECIMAL(5,2)      DEFAULT NULL,
  `ph_shock`              DECIMAL(5,2)      DEFAULT NULL,
  `ph_sulphured`          DECIMAL(5,2)      DEFAULT NULL,
  `sulphur_temp`          DECIMAL(8,2)      DEFAULT NULL,
  `boiler_temp`           DECIMAL(8,2)      DEFAULT NULL,
  `boiler_press`          DECIMAL(8,2)      DEFAULT NULL,
  `op_sign`               VARCHAR(100)      DEFAULT NULL,
  `chem_sign`             VARCHAR(100)      DEFAULT NULL,
  `remarks`               TEXT              DEFAULT NULL,
  `timestamp`             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
