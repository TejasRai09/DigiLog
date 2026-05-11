-- Migration: add before/after service photo columns to mh_history
USE gsmadb;

ALTER TABLE `mh_history`
  ADD COLUMN `img_before` MEDIUMTEXT DEFAULT NULL AFTER `rem`,
  ADD COLUMN `img_after`  MEDIUMTEXT DEFAULT NULL AFTER `img_before`;
