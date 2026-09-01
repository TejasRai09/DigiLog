-- 150TPH boiler instrument MOVs / actuators (supplement to ZIL electrical catalog)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_power_equipment_150tph_mov_catalog.sql

USE `__MYSQL_DATABASE__`;

INSERT INTO `pp_equipment` (`dept`, `equip_no`, `name`, `sort_order`)
SELECT * FROM (
  SELECT 'instrument' AS dept, 'PDW-38' AS equip_no, 'PDW-38 (Deaerator emergency make-up water line MOV)' AS name, 201 AS sort_order UNION ALL
  SELECT 'instrument', 'MS-16', 'MS-16 (LTSH inlet header drain MOV)', 202 UNION ALL
  SELECT 'instrument', 'MS-103', 'MS-103 (LTSH outlet drain MOV)', 203 UNION ALL
  SELECT 'instrument', 'MS-21', 'MS-21 (RSH outlet header vent MOV)', 204 UNION ALL
  SELECT 'instrument', 'MS-105', 'MS-105 (RSH outlet drain MOV)', 205 UNION ALL
  SELECT 'instrument', 'MS-107', 'MS-107 (FSH outlet vent MOV)', 206 UNION ALL
  SELECT 'instrument', 'MS-109', 'MS-109 (FSH outlet drain MOV)', 207 UNION ALL
  SELECT 'instrument', 'PFW-133', 'PFW-133 (Economiser inlet header iso MOV)', 208 UNION ALL
  SELECT 'instrument', 'PFW-133A', 'PFW-133A (Economiser inlet integral iso MOV)', 209 UNION ALL
  SELECT 'instrument', 'MS-14', 'MS-14 (Roof tube inlet drain MOV)', 210 UNION ALL
  SELECT 'instrument', 'MS-20', 'MS-20 (DSH-501 outlet drain MOV)', 211 UNION ALL
  SELECT 'instrument', 'MS-24', 'MS-24 (DSH-502 outlet drain MOV)', 212 UNION ALL
  SELECT 'instrument', 'MS-43', 'MS-43 (Main steam line iso MOV)', 213 UNION ALL
  SELECT 'instrument', 'MS-44', 'MS-44 (Main steam line bypass iso MOV)', 214 UNION ALL
  SELECT 'instrument', 'MS-27', 'MS-27 (EMRV inlet iso MOV)', 215 UNION ALL
  SELECT 'instrument', 'MS-27A', 'MS-27A (EMRV inlet integral iso MOV)', 216 UNION ALL
  SELECT 'instrument', 'IBD-03', 'IBD-03 (IBD ISO MOV)', 217 UNION ALL
  SELECT 'instrument', 'CBD-03', 'CBD-03 (CBD ISO MOV)', 218 UNION ALL
  SELECT 'instrument', 'PFW-62', 'PFW-62 (BFP-A Discharge ISO MOV)', 219 UNION ALL
  SELECT 'instrument', 'PFW-63', 'PFW-63 (BFP-B Discharge ISO MOV)', 220 UNION ALL
  SELECT 'instrument', 'PFW-64', 'PFW-64 (BFP-C Discharge ISO MOV)', 221 UNION ALL
  SELECT 'instrument', 'PFW-264', 'PFW-264 (BFP-D Discharge ISO MOV)', 222
) AS src
WHERE NOT EXISTS (
  SELECT 1 FROM `pp_equipment` e
  WHERE e.`equip_no` = src.`equip_no` AND e.`name` = src.`name`
);
