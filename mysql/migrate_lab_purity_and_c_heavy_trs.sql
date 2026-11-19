-- DS and RS purity is stored as (Pol / Brix) * 100.
-- Existing rows are filled when the columns are added.
-- Syrup Logbook: Avg C-Heavy TRS (ch_trs).
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_lab_purity_and_c_heavy_trs.sql

ALTER TABLE `ds_logbook` ADD COLUMN `PJ_Purity` DOUBLE AS (IF(`PJ_Brix` IS NULL OR `PJ_Brix` = 0 OR `PJ_Pol` IS NULL, NULL, ROUND((`PJ_Pol` / `PJ_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `MJ_Purity` DOUBLE AS (IF(`MJ_Brix` IS NULL OR `MJ_Brix` = 0 OR `MJ_Pol` IS NULL, NULL, ROUND((`MJ_Pol` / `MJ_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `LMJ_Purity` DOUBLE AS (IF(`LMJ_Brix` IS NULL OR `LMJ_Brix` = 0 OR `LMJ_Pol` IS NULL, NULL, ROUND((`LMJ_Pol` / `LMJ_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `CJ_Purity` DOUBLE AS (IF(`CJ_Brix` IS NULL OR `CJ_Brix` = 0 OR `CJ_Pol` IS NULL, NULL, ROUND((`CJ_Pol` / `CJ_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `FJ_Purity` DOUBLE AS (IF(`FJ_Brix` IS NULL OR `FJ_Brix` = 0 OR `FJ_Pol` IS NULL, NULL, ROUND((`FJ_Pol` / `FJ_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `USul_Syrp_Purity` DOUBLE AS (IF(`USul_Syrp_Brix` IS NULL OR `USul_Syrp_Brix` = 0 OR `USul_Syrp_Pol` IS NULL, NULL, ROUND((`USul_Syrp_Pol` / `USul_Syrp_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `Sul_Syrp_Purity` DOUBLE AS (IF(`Sul_Syrp_Brix` IS NULL OR `Sul_Syrp_Brix` = 0 OR `Sul_Syrp_Pol` IS NULL, NULL, ROUND((`Sul_Syrp_Pol` / `Sul_Syrp_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `A_Mc_Purity` DOUBLE AS (IF(`A_Mc_Brix` IS NULL OR `A_Mc_Brix` = 0 OR `A_Mc_Pol` IS NULL, NULL, ROUND((`A_Mc_Pol` / `A_Mc_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `B_Mc_Purity` DOUBLE AS (IF(`B_Mc_Brix` IS NULL OR `B_Mc_Brix` = 0 OR `B_Mc_Pol` IS NULL, NULL, ROUND((`B_Mc_Pol` / `B_Mc_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `A1_Mc_Purity` DOUBLE AS (IF(`A1_Mc_Brix` IS NULL OR `A1_Mc_Brix` = 0 OR `A1_Mc_Pol` IS NULL, NULL, ROUND((`A1_Mc_Pol` / `A1_Mc_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `C_Mc_Purity` DOUBLE AS (IF(`C_Mc_Brix` IS NULL OR `C_Mc_Brix` = 0 OR `C_Mc_Pol` IS NULL, NULL, ROUND((`C_Mc_Pol` / `C_Mc_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `AH_Mol_Purity` DOUBLE AS (IF(`AH_Mol_Brix` IS NULL OR `AH_Mol_Brix` = 0 OR `AH_Mol_Pol` IS NULL, NULL, ROUND((`AH_Mol_Pol` / `AH_Mol_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `AL_Mol_Purity` DOUBLE AS (IF(`AL_Mol_Brix` IS NULL OR `AL_Mol_Brix` = 0 OR `AL_Mol_Pol` IS NULL, NULL, ROUND((`AL_Mol_Pol` / `AL_Mol_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `BH_Mol_Purity` DOUBLE AS (IF(`BH_Mol_Brix` IS NULL OR `BH_Mol_Brix` = 0 OR `BH_Mol_Pol` IS NULL, NULL, ROUND((`BH_Mol_Pol` / `BH_Mol_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `CL_Mol_Purity` DOUBLE AS (IF(`CL_Mol_Brix` IS NULL OR `CL_Mol_Brix` = 0 OR `CL_Mol_Pol` IS NULL, NULL, ROUND((`CL_Mol_Pol` / `CL_Mol_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `FMol_Purity` DOUBLE AS (IF(`FMol_Brix` IS NULL OR `FMol_Brix` = 0 OR `FMol_Pol` IS NULL, NULL, ROUND((`FMol_Pol` / `FMol_Brix`) * 100, 2))) STORED;
ALTER TABLE `ds_logbook` ADD COLUMN `A1_Mol_Purity` DOUBLE AS (IF(`A1_Mol_Brix` IS NULL OR `A1_Mol_Brix` = 0 OR `A1_Mol_Pol` IS NULL, NULL, ROUND((`A1_Mol_Pol` / `A1_Mol_Brix`) * 100, 2))) STORED;

ALTER TABLE `rs_logbook` ADD COLUMN `CJ_Purity` DOUBLE AS (IF(`CJ_Brix` IS NULL OR `CJ_Brix` = 0 OR `CJ_Pol` IS NULL, NULL, ROUND((`CJ_Pol` / `CJ_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `FJ_Purity` DOUBLE AS (IF(`FJ_Brix` IS NULL OR `FJ_Brix` = 0 OR `FJ_Pol` IS NULL, NULL, ROUND((`FJ_Pol` / `FJ_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `UtrSyrp_Purity` DOUBLE AS (IF(`UtrSyrp_Brix` IS NULL OR `UtrSyrp_Brix` = 0 OR `UtrSyrp_Pol` IS NULL, NULL, ROUND((`UtrSyrp_Pol` / `UtrSyrp_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `RawMc_Purity` DOUBLE AS (IF(`RawMc_Brix` IS NULL OR `RawMc_Brix` = 0 OR `RawMc_Pol` IS NULL, NULL, ROUND((`RawMc_Pol` / `RawMc_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `R1Mc_Purity` DOUBLE AS (IF(`R1Mc_Brix` IS NULL OR `R1Mc_Brix` = 0 OR `R1Mc_Pol` IS NULL, NULL, ROUND((`R1Mc_Pol` / `R1Mc_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `R2Mc_Purity` DOUBLE AS (IF(`R2Mc_Brix` IS NULL OR `R2Mc_Brix` = 0 OR `R2Mc_Pol` IS NULL, NULL, ROUND((`R2Mc_Pol` / `R2Mc_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `BMc_Purity` DOUBLE AS (IF(`BMc_Brix` IS NULL OR `BMc_Brix` = 0 OR `BMc_Pol` IS NULL, NULL, ROUND((`BMc_Pol` / `BMc_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `CMc_Purity` DOUBLE AS (IF(`CMc_Brix` IS NULL OR `CMc_Brix` = 0 OR `CMc_Pol` IS NULL, NULL, ROUND((`CMc_Pol` / `CMc_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `AH_Mol_Purity` DOUBLE AS (IF(`AH_Mol_Brix` IS NULL OR `AH_Mol_Brix` = 0 OR `AH_Mol_Pol` IS NULL, NULL, ROUND((`AH_Mol_Pol` / `AH_Mol_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `AL_Mol_Purity` DOUBLE AS (IF(`AL_Mol_Brix` IS NULL OR `AL_Mol_Brix` = 0 OR `AL_Mol_Pol` IS NULL, NULL, ROUND((`AL_Mol_Pol` / `AL_Mol_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `R1_Mol_Purity` DOUBLE AS (IF(`R1_Mol_Brix` IS NULL OR `R1_Mol_Brix` = 0 OR `R1_Mol_Pol` IS NULL, NULL, ROUND((`R1_Mol_Pol` / `R1_Mol_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `R2_Mol_Purity` DOUBLE AS (IF(`R2_Mol_Brix` IS NULL OR `R2_Mol_Brix` = 0 OR `R2_Mol_Pol` IS NULL, NULL, ROUND((`R2_Mol_Pol` / `R2_Mol_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `BH_Mol_Purity` DOUBLE AS (IF(`BH_Mol_Brix` IS NULL OR `BH_Mol_Brix` = 0 OR `BH_Mol_Pol` IS NULL, NULL, ROUND((`BH_Mol_Pol` / `BH_Mol_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `CL_Mol_Purity` DOUBLE AS (IF(`CL_Mol_Brix` IS NULL OR `CL_Mol_Brix` = 0 OR `CL_Mol_Pol` IS NULL, NULL, ROUND((`CL_Mol_Pol` / `CL_Mol_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `FMol_Purity` DOUBLE AS (IF(`FMol_Brix` IS NULL OR `FMol_Brix` = 0 OR `FMol_Pol` IS NULL, NULL, ROUND((`FMol_Pol` / `FMol_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `RawMlt_Purity` DOUBLE AS (IF(`RawMlt_Brix` IS NULL OR `RawMlt_Brix` = 0 OR `RawMlt_Pol` IS NULL, NULL, ROUND((`RawMlt_Pol` / `RawMlt_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `ClearMlt_Purity` DOUBLE AS (IF(`ClearMlt_Brix` IS NULL OR `ClearMlt_Brix` = 0 OR `ClearMlt_Pol` IS NULL, NULL, ROUND((`ClearMlt_Pol` / `ClearMlt_Brix`) * 100, 2))) STORED;
ALTER TABLE `rs_logbook` ADD COLUMN `Purity_FineLiqourMelt` DOUBLE AS (IF(`Brix_FineLiqourMelt` IS NULL OR `Brix_FineLiqourMelt` = 0 OR `Pol_FineLiqourMelt` IS NULL, NULL, ROUND((`Pol_FineLiqourMelt` / `Brix_FineLiqourMelt`) * 100, 2))) STORED;

ALTER TABLE `syrp_logbook` ADD COLUMN `ch_trs` DOUBLE NULL DEFAULT NULL;
