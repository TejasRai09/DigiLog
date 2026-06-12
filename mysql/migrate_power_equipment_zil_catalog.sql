-- Seed / upsert power plant equipment life-history cards (ZIL/GSM/PP catalog)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_power_equipment_zil_catalog.sql

USE `__MYSQL_DATABASE__`;

-- Canonical equipment list for hierarchy lookup (equip_no + name)
INSERT INTO `pp_equipment` (`dept`, `equip_no`, `name`, `sort_order`)
SELECT * FROM (
  SELECT 'electrical' AS dept, 'ZIL/GSM/PP/01' AS equip_no, '30.85MW Steam Turbine' AS name, 1 AS sort_order UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/02', '30.85MW Generator Set', 2 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/03', '150TPH Boiler', 3 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/04', 'HP Heater -1', 4 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/05', 'HP Heater -2', 5 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/06', 'BFP-1', 6 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/07', 'BFP-2', 7 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/08', 'BFP-3', 8 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/09', 'BFP-4', 9 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/10', 'ID Fan -1', 10 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/11', 'ID Fan-2', 11 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/12', 'FD Fan-1', 12 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/13', 'FD Fan-2', 13 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/14', 'SA Fan -1', 14 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/14', 'SA Fan -2', 15 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/15', 'BC-1', 16 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/16', 'BC-2', 17 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/17', 'BC-3', 18 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/18', 'BC-4', 19 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/19', 'BC-5', 20 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/20', 'BC-6', 21 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/21', 'BC-7', 22 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/22', 'BC-8', 23 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/23', 'Bagasse Elevator', 24 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/24', 'Slat Chain', 25 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/25', 'MCW Pump-1', 26 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/26', 'MCW pump -2', 27 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/27', 'MCW Pump-3', 28 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/28', 'ACW Pump -1', 29 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/29', 'ACW Pump-2', 30 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/30', 'ACW Pump -3', 31 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/30', 'Inst.Air Comp.-1', 32 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/30', 'Inst.Air Comp.-2', 33 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/15', 'MOP', 34 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/15', 'AOP', 35 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/15', 'ACOP', 36 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/15', 'MCOP', 37 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/15', 'EOP', 38 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/15', 'CEP No.-1', 39 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/15', 'CEP No.-2', 40 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/15', 'CEP No.-3', 41 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/30', 'CT Fan No.-1', 42 UNION ALL
  SELECT 'electrical', 'ZIL/GSM/PP/30', 'CT Fan No.-2', 43
) AS src
WHERE NOT EXISTS (
  SELECT 1 FROM `pp_equipment` e
  WHERE e.`equip_no` = src.`equip_no` AND e.`name` = src.`name`
);
