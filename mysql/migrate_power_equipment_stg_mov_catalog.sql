-- 30.85 MW STG instrument MOVs / PCW tags
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_power_equipment_stg_mov_catalog.sql

USE `__MYSQL_DATABASE__`;

INSERT INTO `pp_equipment` (`dept`, `equip_no`, `name`, `sort_order`)
SELECT * FROM (
  SELECT 'instrument' AS dept, 'MOV-401' AS equip_no, 'MOV-401 (Steam to hogger ejector MOV)' AS name, 301 AS sort_order UNION ALL
  SELECT 'instrument', 'MOV-402', 'MOV-402 (Steam to standby hogger ejector MOV)', 302 UNION ALL
  SELECT 'instrument', 'MOV-403', 'MOV-403 (Steam to Y1 ejector MOV)', 303 UNION ALL
  SELECT 'instrument', 'MOV-404', 'MOV-404 (Air to hogger ejector MOV)', 304 UNION ALL
  SELECT 'instrument', 'MOV-405', 'MOV-405 (Air to standby hogger ejector MOV)', 305 UNION ALL
  SELECT 'instrument', 'MOV-406', 'MOV-406 (Condensate to hogger ejector MOV)', 306 UNION ALL
  SELECT 'instrument', 'MOV-407', 'MOV-407 (Condensate to standby hogger ejector MOV)', 307 UNION ALL
  SELECT 'instrument', 'MOV-408', 'MOV-408 (Condensate to Y1 ejector MOV)', 308 UNION ALL
  SELECT 'instrument', 'MS-66', 'MS-66 (TG inlet iso MOV)', 309 UNION ALL
  SELECT 'instrument', 'MS-67', 'MS-67 (TG inlet bypass iso MOV)', 310 UNION ALL
  SELECT 'instrument', 'MOV-201', 'MOV-201 (CEP-A discharge MOV)', 311 UNION ALL
  SELECT 'instrument', 'MOV-202', 'MOV-202 (CEP-B discharge MOV)', 312 UNION ALL
  SELECT 'instrument', 'MOV-203', 'MOV-203 (CEP-C discharge MOV)', 313 UNION ALL
  SELECT 'instrument', 'MOV-100', 'MOV-100 (Bleed-1 MOV)', 314 UNION ALL
  SELECT 'instrument', 'MOV-101', 'MOV-101 (Bleed-2 MOV)', 315 UNION ALL
  SELECT 'instrument', 'MOV-102', 'MOV-102 (Bleed-2 to ejector MOV)', 316 UNION ALL
  SELECT 'instrument', 'PCW-13', 'PCW-13 (MCWP-A)', 317 UNION ALL
  SELECT 'instrument', 'PCW-14', 'PCW-14 (MCWP-B)', 318 UNION ALL
  SELECT 'instrument', 'PCW-15', 'PCW-15 (MCWP-C)', 319 UNION ALL
  SELECT 'instrument', 'PCW-42', 'PCW-42 (ACWP-A)', 320 UNION ALL
  SELECT 'instrument', 'PCW-43', 'PCW-43 (ACWP-B)', 321 UNION ALL
  SELECT 'instrument', 'PCW-44', 'PCW-44 (ACWP-C)', 322
) AS src
WHERE NOT EXISTS (
  SELECT 1 FROM `pp_equipment` e
  WHERE e.`equip_no` = src.`equip_no` AND e.`name` = src.`name`
);
