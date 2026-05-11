-- CreateTable
CREATE TABLE `mill_logbook1` (
    `Date` DATE NULL,
    `Shift` VARCHAR(10) NULL,
    `Time` DATETIME(0) NULL,
    `CaneKeig_MtrTemp` DOUBLE NULL,
    `CaneKeig_GearTempDE` DOUBLE NULL,
    `CaneKeig_GearTempNDE` DOUBLE NULL,
    `CaneKeig_BearTempDE` DOUBLE NULL,
    `CaneKeig_BearTempNDE` DOUBLE NULL,
    `CardDrum1_MtrTemp` DOUBLE NULL,
    `CardDrum1_GearTempDE` DOUBLE NULL,
    `CardDrum1_GearTempNDE` DOUBLE NULL,
    `CardDrum1_BearTempDE` DOUBLE NULL,
    `CardDrum1_BearTempNDE` DOUBLE NULL,
    `CardDrum2_MtrTemp` DOUBLE NULL,
    `CardDrum2_GearTempDE` DOUBLE NULL,
    `CardDrum2_GearTempNDE` DOUBLE NULL,
    `CardDrum2_BearTempDE` DOUBLE NULL,
    `CardDrum2_BearTempNDE` DOUBLE NULL,
    `FeedDrum_MtrTemp` DOUBLE NULL,
    `FeedDrum_GearTempDE` DOUBLE NULL,
    `FeedDrum_GearTempNDE` DOUBLE NULL,
    `FeedDrum_BearTempDE` DOUBLE NULL,
    `FeedDrum_BearTempNDE` DOUBLE NULL,
    `CaneCar_MtrTemp` DOUBLE NULL,
    `CaneCar_GearTempDE` DOUBLE NULL,
    `CaneCar_GearTempNDE` DOUBLE NULL,
    `CaneCar_BearTempDE` DOUBLE NULL,
    `CaneCar_BearTempNDE` DOUBLE NULL,
    `ShredCar_MtrTemp` DOUBLE NULL,
    `ShredCar_GearTempDE` DOUBLE NULL,
    `ShredCar_GearTempNDE` DOUBLE NULL,
    `ShredCar_BearTempDE` DOUBLE NULL,
    `ShredCar_BearTempNDE` DOUBLE NULL,
    `BeltConvy_MtrTemp` DOUBLE NULL,
    `BeltConvy_GearTempDE` DOUBLE NULL,
    `BeltConvy_GearTempNDE` DOUBLE NULL,
    `BeltConvy_BearTempDE` DOUBLE NULL,
    `BeltConvy_BearTempNDE` DOUBLE NULL,
    `IRC1_MtrTemp` DOUBLE NULL,
    `IRC1_GearTempDE` DOUBLE NULL,
    `IRC1_GearTempNDE` DOUBLE NULL,
    `IRC1_BearTempDE` DOUBLE NULL,
    `IRC1_BearTempNDE` DOUBLE NULL,
    `IRC2_MtrTemp` DOUBLE NULL,
    `IRC2_GearTempDE` DOUBLE NULL,
    `IRC2_GearTempNDE` DOUBLE NULL,
    `IRC2_BearTempDE` DOUBLE NULL,
    `IRC2_BearTempNDE` DOUBLE NULL,
    `IRC3_MtrTemp` DOUBLE NULL,
    `IRC3_GearTempDE` DOUBLE NULL,
    `IRC3_GearTempNDE` DOUBLE NULL,
    `IRC3_BearTempDE` DOUBLE NULL,
    `IRC3_BearTempNDE` DOUBLE NULL,
    `IRC4_MtrTemp` DOUBLE NULL,
    `IRC4_GearTempDE` DOUBLE NULL,
    `IRC4_GearTempNDE` DOUBLE NULL,
    `IRC4_BearTempDE` DOUBLE NULL,
    `IRC4_BearTempNDE` DOUBLE NULL,
    `Mill0_MtrTemp` DOUBLE NULL,
    `Mill0_GearTempDE` DOUBLE NULL,
    `Mill0_GearTempNDE` DOUBLE NULL,
    `Mill0_BearTempDE` DOUBLE NULL,
    `Mill0_BearTempNDE` DOUBLE NULL,
    `Mill4_MtrTemp` DOUBLE NULL,
    `Mill4_GearTempDE` DOUBLE NULL,
    `Mill4_GearTempNDE` DOUBLE NULL,
    `Mill4_BearTempDE` DOUBLE NULL,
    `Mill4_BearTempNDE` DOUBLE NULL,
    `timestamp` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mill_logbook2` (
    `Date` DATE NULL,
    `Shift` VARCHAR(10) NULL,
    `Time` DATETIME(0) NULL,
    `shredR_MtrTemp` DOUBLE NULL,
    `shredR_BearTempSite` DOUBLE NULL,
    `shredR_BearTempDCS` DOUBLE NULL,
    `shredR_VibH` DOUBLE NULL,
    `shredR_VibV` DOUBLE NULL,
    `shredR_VibA` DOUBLE NULL,
    `shredL_MtrTemp` DOUBLE NULL,
    `shredL_BearTempSite` DOUBLE NULL,
    `shredL_BearTempDCS` DOUBLE NULL,
    `shredL_VibH` DOUBLE NULL,
    `shredL_VibV` DOUBLE NULL,
    `shredL_VibA` DOUBLE NULL,
    `M1_InpT` DOUBLE NULL,
    `M1_InpM` DOUBLE NULL,
    `M1_IntT` DOUBLE NULL,
    `M1_IntM` DOUBLE NULL,
    `M1_OutT` DOUBLE NULL,
    `M1_OutM` DOUBLE NULL,
    `M2_InpT` DOUBLE NULL,
    `M2_InpM` DOUBLE NULL,
    `M2_IntT` DOUBLE NULL,
    `M2_IntM` DOUBLE NULL,
    `M2_OutT` DOUBLE NULL,
    `M2_OutM` DOUBLE NULL,
    `M3_InpT` DOUBLE NULL,
    `M3_InpM` DOUBLE NULL,
    `M3_IntT` DOUBLE NULL,
    `M3_IntM` DOUBLE NULL,
    `M3_OutT` DOUBLE NULL,
    `M3_OutM` DOUBLE NULL,
    `M4_InpT` DOUBLE NULL,
    `M4_InpM` DOUBLE NULL,
    `M4_IntT` DOUBLE NULL,
    `M4_IntM` DOUBLE NULL,
    `M4_OutT` DOUBLE NULL,
    `M4_OutM` DOUBLE NULL,
    `timestamp` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mill_logbook3` (
    `Date` DATE NULL,
    `Shift` VARCHAR(10) NULL,
    `Time` DATETIME(0) NULL,
    `LubePressure_ACC` DOUBLE NULL,
    `LubePressure_MCC` DOUBLE NULL,
    `LubePressure_Shred` DOUBLE NULL,
    `LubePressure_M0` DOUBLE NULL,
    `M0_gsT` DOUBLE NULL,
    `M0_gsB` DOUBLE NULL,
    `M0_gsUF` DOUBLE NULL,
    `M0_psT` DOUBLE NULL,
    `M0_psB` DOUBLE NULL,
    `M0_psUF` DOUBLE NULL,
    `M1_gsT` DOUBLE NULL,
    `M1_gsB` DOUBLE NULL,
    `M1_gsUF` DOUBLE NULL,
    `M1_psT` DOUBLE NULL,
    `M1_psB` DOUBLE NULL,
    `M1_psUF` DOUBLE NULL,
    `M2_gsT` DOUBLE NULL,
    `M2_gsB` DOUBLE NULL,
    `M2_gsUF` DOUBLE NULL,
    `M2_psT` DOUBLE NULL,
    `M2_psB` DOUBLE NULL,
    `M2_psUF` DOUBLE NULL,
    `M3_gsT` DOUBLE NULL,
    `M3_gsB` DOUBLE NULL,
    `M3_gsUF` DOUBLE NULL,
    `M3_psT` DOUBLE NULL,
    `M3_psB` DOUBLE NULL,
    `M3_psUF` DOUBLE NULL,
    `M4_gsT` DOUBLE NULL,
    `M4_gsB` DOUBLE NULL,
    `M4_gsUF` DOUBLE NULL,
    `M4_psT` DOUBLE NULL,
    `M4_psB` DOUBLE NULL,
    `M4_psUF` DOUBLE NULL,
    `timestamp` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mill_stoppages` (
    `Date` DATE NULL,
    `start_time` DATETIME(0) NULL,
    `end_time` DATETIME(0) NULL,
    `section` VARCHAR(100) NULL,
    `machinery` VARCHAR(200) NULL,
    `remarks` VARCHAR(600) NULL,
    `timestamp` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ds_logbook` (
    `Date` DATE NULL,
    `Shift` VARCHAR(10) NULL,
    `Sampling_time` VARCHAR(10) NULL,
    `PJ_Pol` DOUBLE NULL,
    `PJ_Brix` DOUBLE NULL,
    `MJ_Pol` DOUBLE NULL,
    `MJ_Brix` DOUBLE NULL,
    `LMJ_Pol` DOUBLE NULL,
    `LMJ_Brix` DOUBLE NULL,
    `CJ_Pol` DOUBLE NULL,
    `CJ_Brix` DOUBLE NULL,
    `FJ_Pol` DOUBLE NULL,
    `FJ_Brix` DOUBLE NULL,
    `USul_Syrp_Pol` DOUBLE NULL,
    `USul_Syrp_Brix` DOUBLE NULL,
    `Sul_Syrp_Pol` DOUBLE NULL,
    `Sul_Syrp_Brix` DOUBLE NULL,
    `A_Mc_Pol` DOUBLE NULL,
    `A_Mc_Brix` DOUBLE NULL,
    `B_Mc_Pol` DOUBLE NULL,
    `B_Mc_Brix` DOUBLE NULL,
    `A1_Mc_Pol` DOUBLE NULL,
    `A1_Mc_Brix` DOUBLE NULL,
    `C_Mc_Pol` DOUBLE NULL,
    `C_Mc_Brix` DOUBLE NULL,
    `AH_Mol_Pol` DOUBLE NULL,
    `AH_Mol_Brix` DOUBLE NULL,
    `AL_Mol_Pol` DOUBLE NULL,
    `AL_Mol_Brix` DOUBLE NULL,
    `BH_Mol_Pol` DOUBLE NULL,
    `BH_Mol_Brix` DOUBLE NULL,
    `CL_Mol_Pol` DOUBLE NULL,
    `CL_Mol_Brix` DOUBLE NULL,
    `FMol_Pol` DOUBLE NULL,
    `FMol_Brix` DOUBLE NULL,
    `Bag_Pol` DOUBLE NULL,
    `Bag_Moisture` DOUBLE NULL,
    `FCake_Pol` DOUBLE NULL,
    `op_mode` VARCHAR(10) NULL,
    `A1_Mol_Pol` DOUBLE NULL,
    `A1_Mol_Brix` DOUBLE NULL,
    `MillDrain_Pol` DOUBLE NULL,
    `BoilHouseDrain_Pol` DOUBLE NULL,
    `timestamp` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rs_logbook` (
    `Date` DATE NULL,
    `Shift` VARCHAR(10) NULL,
    `Sampling_time` VARCHAR(10) NULL,
    `CJ_Pol` DOUBLE NULL,
    `CJ_Brix` DOUBLE NULL,
    `FJ_Pol` DOUBLE NULL,
    `FJ_Brix` DOUBLE NULL,
    `UtrSyrp_Pol` DOUBLE NULL,
    `UtrSyrp_Brix` DOUBLE NULL,
    `RawMc_Pol` DOUBLE NULL,
    `RawMc_Brix` DOUBLE NULL,
    `R1Mc_Pol` DOUBLE NULL,
    `R1Mc_Brix` DOUBLE NULL,
    `R2Mc_Pol` DOUBLE NULL,
    `R2Mc_Brix` DOUBLE NULL,
    `BMc_Pol` DOUBLE NULL,
    `BMc_Brix` DOUBLE NULL,
    `CMc_Pol` DOUBLE NULL,
    `CMc_Brix` DOUBLE NULL,
    `AH_Mol_Pol` DOUBLE NULL,
    `AH_Mol_Brix` DOUBLE NULL,
    `AL_Mol_Pol` DOUBLE NULL,
    `AL_Mol_Brix` DOUBLE NULL,
    `R1_Mol_Pol` DOUBLE NULL,
    `R1_Mol_Brix` DOUBLE NULL,
    `R2_Mol_Pol` DOUBLE NULL,
    `R2_Mol_Brix` DOUBLE NULL,
    `BH_Mol_Pol` DOUBLE NULL,
    `BH_Mol_Brix` DOUBLE NULL,
    `CL_Mol_Pol` DOUBLE NULL,
    `CL_Mol_Brix` DOUBLE NULL,
    `FMol_Pol` DOUBLE NULL,
    `FMol_Brix` DOUBLE NULL,
    `FCake_Pol` DOUBLE NULL,
    `op_mode` VARCHAR(10) NULL,
    `R1Mc_IU` DOUBLE NULL,
    `R2Mc_IU` DOUBLE NULL,
    `R1Mol_IU` DOUBLE NULL,
    `R2Mol_IU` DOUBLE NULL,
    `RawMlt_Pol` DOUBLE NULL,
    `RawMlt_Brix` DOUBLE NULL,
    `RawMlt_IU` DOUBLE NULL,
    `ClearMlt_Pol` DOUBLE NULL,
    `ClearMlt_Brix` DOUBLE NULL,
    `ClearMlt_IU` DOUBLE NULL,
    `Pol_FineLiqourMelt` DOUBLE NULL,
    `Brix_FineLiqourMelt` DOUBLE NULL,
    `IU_FineLiqourMelt` DOUBLE NULL,
    `IERInlet_IU` DOUBLE NULL,
    `IERInlet_PH` DOUBLE NULL,
    `IEROutlet_IU` DOUBLE NULL,
    `IEROutlet_PH` DOUBLE NULL,
    `timestamp` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ops_logbook` (
    `Date` DATE NULL,
    `Shift` VARCHAR(10) NULL,
    `Sampling_time` VARCHAR(10) NULL,
    `yard_bal` DOUBLE NULL,
    `crush` DOUBLE NULL,
    `imb_wtr` DOUBLE NULL,
    `imb_temp` DOUBLE NULL,
    `mixj_ds` DOUBLE NULL,
    `mixj_rs` DOUBLE NULL,
    `mol_ds` DOUBLE NULL,
    `mol_rs` DOUBLE NULL,
    `fcake_ds` DOUBLE NULL,
    `fcake_rs` DOUBLE NULL,
    `qty_dsl` DOUBLE NULL,
    `mesh_dsl` DOUBLE NULL,
    `bagtemp_dsl` DOUBLE NULL,
    `qty_dsm` DOUBLE NULL,
    `mesh_dsm` DOUBLE NULL,
    `bagtemp_dsm` DOUBLE NULL,
    `qty_dss` DOUBLE NULL,
    `mesh_dss` DOUBLE NULL,
    `bagtemp_dss` DOUBLE NULL,
    `qty_rsl` DOUBLE NULL,
    `mesh_rsl` DOUBLE NULL,
    `bagtemp_rsl` DOUBLE NULL,
    `qty_rsm` DOUBLE NULL,
    `mesh_rsm` DOUBLE NULL,
    `bagtemp_rsm` DOUBLE NULL,
    `qty_rss` DOUBLE NULL,
    `mesh_rss` DOUBLE NULL,
    `bagtemp_rss` DOUBLE NULL,
    `qty_p20` DOUBLE NULL,
    `bagtemp_p20` DOUBLE NULL,
    `qty_p30` DOUBLE NULL,
    `bagtemp_p30` DOUBLE NULL,
    `qty_p40` DOUBLE NULL,
    `bagtemp_p40` DOUBLE NULL,
    `FBDInlet_TempDS` DOUBLE NULL,
    `FBDInlet_MoistDS` DOUBLE NULL,
    `FBDOutlet_TempDS` DOUBLE NULL,
    `FBDOutlet_MoistDS` DOUBLE NULL,
    `Hopper_TempDS` DOUBLE NULL,
    `Hopper_MoistDS` DOUBLE NULL,
    `FBDInlet_TempRS` DOUBLE NULL,
    `FBDInlet_MoistRS` DOUBLE NULL,
    `FBDOutlet_TempRS` DOUBLE NULL,
    `FBDOutlet_MoistRS` DOUBLE NULL,
    `Hopper_TempRS` DOUBLE NULL,
    `Hopper_MoistRS` DOUBLE NULL,
    `RSDInlet_Temp` DOUBLE NULL,
    `RSDInlet_Moist` DOUBLE NULL,
    `RSDOutlet_Temp` DOUBLE NULL,
    `RSDOutlet_Moist` DOUBLE NULL,
    `timestamp` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sa_logbook` (
    `Date` DATE NULL,
    `Shift` VARCHAR(10) NULL,
    `Sampling_time` VARCHAR(10) NULL,
    `retn_DSL` DOUBLE NULL,
    `retn_DSM` DOUBLE NULL,
    `retn_DSS` DOUBLE NULL,
    `retn_RSL` DOUBLE NULL,
    `retn_RSM` DOUBLE NULL,
    `retn_RSS` DOUBLE NULL,
    `retn_Pharma20` DOUBLE NULL,
    `retn_Pharma30` DOUBLE NULL,
    `retn_Pharma40` DOUBLE NULL,
    `moist_DSL` DOUBLE NULL,
    `moist_DSM` DOUBLE NULL,
    `moist_DSS` DOUBLE NULL,
    `moist_RSL` DOUBLE NULL,
    `moist_RSM` DOUBLE NULL,
    `moist_RSS` DOUBLE NULL,
    `moist_Pharma20` DOUBLE NULL,
    `moist_Pharma30` DOUBLE NULL,
    `moist_Pharma40` DOUBLE NULL,
    `col_DSL` DOUBLE NULL,
    `col_DSM` DOUBLE NULL,
    `col_DSS` DOUBLE NULL,
    `col_RSL` DOUBLE NULL,
    `col_RSM` DOUBLE NULL,
    `col_RSS` DOUBLE NULL,
    `col_Pharma20` DOUBLE NULL,
    `col_Pharma30` DOUBLE NULL,
    `col_Pharma40` DOUBLE NULL,
    `col_ClrJDS` DOUBLE NULL,
    `col_RawMeltRS` DOUBLE NULL,
    `col_ClrMeltRS` DOUBLE NULL,
    `col_FineLqrRS` DOUBLE NULL,
    `timestamp_col` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `syrp_logbook` (
    `Date` DATE NULL,
    `Shift` VARCHAR(10) NULL,
    `syrp_prodDS` DOUBLE NULL,
    `syrp_prodRS` DOUBLE NULL,
    `div_mode` VARCHAR(30) NULL,
    `syrp_div` DOUBLE NULL,
    `MoLtoDist_DS` DOUBLE NULL,
    `MoLtoDist_RS` DOUBLE NULL,
    `syrp_trs` DOUBLE NULL,
    `bh_trs` DOUBLE NULL,
    `timestamp` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stoppage_logbook` (
    `Date` DATE NULL,
    `start_time` DATETIME(0) NULL,
    `end_time` DATETIME(0) NULL,
    `department` VARCHAR(40) NULL,
    `remarks` VARCHAR(225) NULL,
    `timestamp` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ph_power` (
    `Date` DATE NULL,
    `Time` DATETIME(0) NULL,
    `Crush` DOUBLE NULL,
    `Baggase` DOUBLE NULL,
    `Hours30` DOUBLE NULL,
    `Hours3Old` DOUBLE NULL,
    `Hours3New` DOUBLE NULL,
    `Hours4` DOUBLE NULL,
    `PowerGen30` DOUBLE NULL,
    `PowerGen3Old` DOUBLE NULL,
    `PowerGen3New` DOUBLE NULL,
    `PowerGen4MW` DOUBLE NULL,
    `GenDG30` DOUBLE NULL,
    `GenDG3Old` DOUBLE NULL,
    `GenDG3New` DOUBLE NULL,
    `GenDG4` DOUBLE NULL,
    `ExportGrid30` DOUBLE NULL,
    `ExportGrid3Old` DOUBLE NULL,
    `ExportGrid3New` DOUBLE NULL,
    `ExportGrid4` DOUBLE NULL,
    `ExportSug30` DOUBLE NULL,
    `ExportSug3Old` DOUBLE NULL,
    `ExportSug3New` DOUBLE NULL,
    `ExportSug4` DOUBLE NULL,
    `ExportCogen30` DOUBLE NULL,
    `ExportCogen3Old` DOUBLE NULL,
    `ExportCogen3New` DOUBLE NULL,
    `ExportCogen4` DOUBLE NULL,
    `ExportDist30` DOUBLE NULL,
    `Imp_Grid` DOUBLE NULL,
    `Imp_3MWOld` DOUBLE NULL,
    `Imp_3MWNew` DOUBLE NULL,
    `Imp_4MW` DOUBLE NULL,
    `PowerConMillHouse` DOUBLE NULL,
    `PowerConDSHouse` DOUBLE NULL,
    `PowerConRaw_Ref` DOUBLE NULL,
    `PowerCon70TPH` DOUBLE NULL,
    `PowerConETP` DOUBLE NULL,
    `PowerConColony` DOUBLE NULL,
    `PowerConOthers` DOUBLE NULL,
    `remark` VARCHAR(600) NULL,
    `timestamp` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ph_steam` (
    `Date` DATE NULL,
    `Time` DATETIME(0) NULL,
    `SteamGen150` DOUBLE NULL,
    `SteamCon30MW` DOUBLE NULL,
    `SteamtoSugar110_3ATAPRDS` DOUBLE NULL,
    `Stmto3Old110_45ATAPRDS` DOUBLE NULL,
    `Stmto3New110_45ATAPRDS` DOUBLE NULL,
    `StmMillTurbine110_45ATAPRDS` DOUBLE NULL,
    `StmtoDistil110_45ATAPRDS_o` DOUBLE NULL,
    `Stm4MWTG110_45ATAPRDS` DOUBLE NULL,
    `ExtractionStm30MW` DOUBLE NULL,
    `Bleed2HPH1Stm` DOUBLE NULL,
    `Bleed1HPH2Stm` DOUBLE NULL,
    `TotalStmtoSug150` DOUBLE NULL,
    `Stmtodeareator150` DOUBLE NULL,
    `SteamGen35` DOUBLE NULL,
    `StmCons4` DOUBLE NULL,
    `StmCons45_55ATAPRDS` DOUBLE NULL,
    `Stm45_55ATADeareatorEjectorPRDS` DOUBLE NULL,
    `Extractionstm4` DOUBLE NULL,
    `TotalStmdistil` DOUBLE NULL,
    `StmtoEjector` DOUBLE NULL,
    `Stm35TDeareator` DOUBLE NULL,
    `StmtoSugDisti` DOUBLE NULL,
    `SteamGen70` DOUBLE NULL,
    `StmCons3Old35` DOUBLE NULL,
    `StmCons3New35` DOUBLE NULL,
    `StmDist70` DOUBLE NULL,
    `Stmto4_70TPH` DOUBLE NULL,
    `TotalStmtoSug70` DOUBLE NULL,
    `Firewood150` DOUBLE NULL,
    `Baggase150` DOUBLE NULL,
    `Firewood70` DOUBLE NULL,
    `Baggase70` DOUBLE NULL,
    `Firewood35` DOUBLE NULL,
    `Baggase35` DOUBLE NULL,
    `SlopCon` DOUBLE NULL,
    `timestamp` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ph_stoppage` (
    `Date` DATE NULL,
    `start_time` DATETIME(0) NULL,
    `end_Time` DATETIME(0) NULL,
    `section` VARCHAR(100) NULL,
    `sub_section` VARCHAR(100) NULL,
    `machinery` VARCHAR(100) NULL,
    `category` VARCHAR(100) NULL,
    `remarks` VARCHAR(300) NULL,
    `created_at` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3),
    `timestamp` DATETIME(3) NULL DEFAULT CURRENT_TIMESTAMP(3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `distillery_operations` (
    `Date` DATE NULL,
    `operation_mode` VARCHAR(32) NULL,
    `syrup_molasses_qtls` DOUBLE NULL,
    `wash_distilled` DOUBLE NULL,
    `trs` DOUBLE NULL,
    `ufs` DOUBLE NULL,
    `alcohol_pct` DOUBLE NULL,
    `actual_ethanol_bl` DOUBLE NULL,
    `al_bl_ratio_pct` DOUBLE NULL,
    `total_bh_molasses_qtls` DOUBLE NULL,
    `total_ch_molasses_qtls` DOUBLE NULL,
    `ethanol_storage_bl` DOUBLE NULL,
    `fs` DOUBLE NULL,
    `fs_quantity` DOUBLE NULL,
    `theoretical_yield` DOUBLE NULL,
    `alcohol_prod_fermentation` DOUBLE NULL,
    `fe` DOUBLE NULL,
    `actual_prod_al` DOUBLE NULL,
    `de` DOUBLE NULL,
    `oe` DOUBLE NULL,
    `rec_bl` DOUBLE NULL,
    `rec_al` DOUBLE NULL,
    `trs_qty` DOUBLE NULL,
    `ufs_qty` DOUBLE NULL,
    `timestamp` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `email` VARCHAR(200) NOT NULL,
    `password` VARCHAR(200) NULL,
    `role` ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `auth_provider` VARCHAR(20) NOT NULL DEFAULT 'local',
    `mail_sent` BOOLEAN NOT NULL DEFAULT false,
    `microsoft_id` VARCHAR(200) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `email`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `apps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `description` VARCHAR(500) NULL,
    `icon` VARCHAR(100) NULL,
    `color` VARCHAR(20) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `name`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `forms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(200) NOT NULL,
    `description` VARCHAR(500) NULL,
    `form_key` VARCHAR(100) NOT NULL,
    `app_id` INTEGER NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `form_key`(`form_key`),
    INDEX `app_id`(`app_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mappings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `app_id` INTEGER NOT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `uq_user_app`(`user_id`, `app_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mapping_forms` (
    `mapping_id` INTEGER NOT NULL,
    `form_id` INTEGER NOT NULL,

    PRIMARY KEY (`mapping_id`, `form_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mh_equipment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `equip_no` VARCHAR(30) NOT NULL,
    `plant` VARCHAR(50) NOT NULL DEFAULT 'Mill House',
    `name` VARCHAR(200) NOT NULL,
    `location` VARCHAR(200) NULL,
    `commissioned` VARCHAR(50) NULL,
    `drive` VARCHAR(300) NULL,
    `photo` MEDIUMTEXT NULL,
    `plate` MEDIUMTEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mh_specs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `equip_id` INTEGER NOT NULL,
    `lbl` VARCHAR(300) NOT NULL,
    `val` TEXT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mh_oem_schedule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `equip_id` INTEGER NOT NULL,
    `no` INTEGER NOT NULL,
    `comp` VARCHAR(500) NULL,
    `act` TEXT NULL,
    `iv_W` CHAR(1) NULL,
    `iv_M` CHAR(1) NULL,
    `iv_Q` CHAR(1) NULL,
    `iv_H` CHAR(1) NULL,
    `iv_Y` CHAR(1) NULL,
    `iv_T` CHAR(1) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mh_history` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `equip_id` INTEGER NOT NULL,
    `season` VARCHAR(20) NULL,
    `year` VARCHAR(64) NULL,
    `date_start` DATE NULL,
    `date_finish` DATE NULL,
    `obs` TEXT NULL,
    `act` TEXT NULL,
    `cost` VARCHAR(50) NULL,
    `svc` VARCHAR(20) NULL,
    `provider` VARCHAR(300) NULL,
    `resp` VARCHAR(300) NULL,
    `rem` TEXT NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `forms` ADD CONSTRAINT `forms_ibfk_1` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mappings` ADD CONSTRAINT `mappings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mappings` ADD CONSTRAINT `mappings_ibfk_2` FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mapping_forms` ADD CONSTRAINT `mapping_forms_ibfk_1` FOREIGN KEY (`mapping_id`) REFERENCES `mappings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mapping_forms` ADD CONSTRAINT `mapping_forms_ibfk_2` FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mh_specs` ADD CONSTRAINT `mh_specs_equip_id_fkey` FOREIGN KEY (`equip_id`) REFERENCES `mh_equipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mh_oem_schedule` ADD CONSTRAINT `mh_oem_schedule_equip_id_fkey` FOREIGN KEY (`equip_id`) REFERENCES `mh_equipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mh_history` ADD CONSTRAINT `mh_history_equip_id_fkey` FOREIGN KEY (`equip_id`) REFERENCES `mh_equipment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
