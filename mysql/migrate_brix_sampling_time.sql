-- Allow more than one Yard / Field Brix report on the same date.
-- Sampling time is stamped to the second when the form is saved.
-- Duplicate check is Date + Time.

ALTER TABLE `brix_yard_sampling`
  ADD COLUMN `Time` TIME NULL AFTER `Date`;

ALTER TABLE `brix_field_sampling`
  ADD COLUMN `Time` TIME NULL AFTER `Date`;
