-- Add Decanter Mud Pol to DS Logbook
ALTER TABLE `ds_logbook`
  ADD COLUMN `DecanterMud_Pol` DOUBLE NULL DEFAULT NULL
  AFTER `FCake_Pol`;
