-- Hide Mill House Equipment History and legacy Power Plant Equipment History (old)
-- from Forms Hub (GET /apps uses is_active = 1). Data and APIs remain; cards only.
-- Safe to re-run.

UPDATE `apps`
SET `is_active` = 0
WHERE `name` IN (
  'Mill House Equipment History',
  'Power Plant Equipment History (old)'
);
