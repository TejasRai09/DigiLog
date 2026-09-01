-- 150TPH boiler instrumentation & control valves (instrument tags)
-- Apply: cd backend && npm run db:apply-sql -- ../mysql/migrate_power_equipment_instrument_150tph.sql

USE `__MYSQL_DATABASE__`;

INSERT INTO `pp_equipment` (`dept`, `equip_no`, `name`, `sort_order`)
SELECT * FROM (
  SELECT 'instrument2' AS dept, 'FCV-501A' AS equip_no, 'FCV-501A (Boiler feed water 100% control valve-1)' AS name, 101 AS sort_order UNION ALL
  SELECT 'instrument2', 'FCV-501B', 'FCV-501B (Boiler feed water 100% control valve-2)', 102 UNION ALL
  SELECT 'instrument2', 'FCV-500', 'FCV-500 (Boiler feed water 30% control valve)', 103 UNION ALL
  SELECT 'instrument2', 'PCV-503', 'PCV-503 (Soot Blower control valve)', 104 UNION ALL
  SELECT 'instrument2', 'PCV-505', 'PCV-505 (Boiler Start up vent control valve)', 105 UNION ALL
  SELECT 'instrument2', 'LCV-501', 'LCV-501 (Boiler CBD Tank Level control valve)', 106 UNION ALL
  SELECT 'instrument2', 'TCV-501A', 'TCV-501A (Boiler Spray Water Temp. control valve for DSH-501)', 107 UNION ALL
  SELECT 'instrument2', 'TCV-501B', 'TCV-501B (Boiler Spray Water Bypass Temp. control valve for DSH-501)', 108 UNION ALL
  SELECT 'instrument2', 'TCV-502A', 'TCV-502A (Boiler Spray Water Temp. control valve For DSH-502)', 109 UNION ALL
  SELECT 'instrument2', 'TCV-502B', 'TCV-502B (Boiler Spray Water Bypass Temp. control valve for DSH-502)', 110 UNION ALL
  SELECT 'instrument2', 'PCV-509', 'PCV-509 (Boiler 110/3 ATA Process PRDS control valve)', 111 UNION ALL
  SELECT 'instrument2', 'PCV-510', 'PCV-510 (Boiler 110/3 ATA Dearator Steam Pr. control valve)', 112 UNION ALL
  SELECT 'instrument2', 'PCV-511A', 'PCV-511A (Boiler 110/8 ATA Auxiliary Steam Pr. control valve)', 113 UNION ALL
  SELECT 'instrument2', 'PCV-511B', 'PCV-511B (Boiler 110/8 ATA Auxiliary Steam Pr. Bypass control valve)', 114 UNION ALL
  SELECT 'instrument2', 'PRV-501', 'PRV-501 (135/67 KG/CM2 Water Pressure Reducing Valve)', 115 UNION ALL
  SELECT 'instrument2', 'PCV-502', 'PCV-502 (110/45 ATA Process Steam Pr. Control Valve)', 116 UNION ALL
  SELECT 'instrument2', 'TCV-509A', 'TCV-509A', 117 UNION ALL
  SELECT 'instrument2', 'TCV-510A', 'TCV-510B', 118 UNION ALL
  SELECT 'instrument2', 'TCV-511A', 'TCV-511A/SPRAY WATER TCV FOR 110/8 ATA AUX. STEAM PRDS', 119 UNION ALL
  SELECT 'instrument2', 'TCV-511B', 'TCV-511B/SPRAY WATER TCV FOR 110/8 ATA AUX. STEAM PRDS', 120 UNION ALL
  SELECT 'instrument2', 'TCV-604A', 'TCV-604A (Spray Water Control Valve For 110/45 ATA Steam PRDS)', 121 UNION ALL
  SELECT 'instrument2', 'BV-01', 'BV-01 (Spray water on/off valve to DSH-502)', 122 UNION ALL
  SELECT 'instrument2', 'BV-02', 'BV-02 (Spray water on/off valve to DSH-501)', 123 UNION ALL
  SELECT 'instrument2', 'BV-03', 'BV-03 (Spray water on/off valve FOR 110/3 ATA process steam PRDS)', 124 UNION ALL
  SELECT 'instrument2', 'BV-04', 'BV-04 (Spray water on/off valve FOR 110/3 ATA Dearator steam PRDS)', 125 UNION ALL
  SELECT 'instrument2', 'BV-05', 'BV-05 (Spray water on/off valve FOR 110/8 Auxiliary steam PRDS)', 126 UNION ALL
  SELECT 'instrument2', 'PFW-09', 'PFW-09 (Dearator Overflow On/Off Valve)', 127 UNION ALL
  SELECT 'instrument2', 'BV-07', 'BV-07', 128 UNION ALL
  SELECT 'instrument2', 'DAM-901', 'DAM-901 (ID FAN-A Suction Damper RPC))', 129 UNION ALL
  SELECT 'instrument2', 'DAM-902', 'DAM-902 (ID FAN-B Suction Damper RPC))', 130 UNION ALL
  SELECT 'instrument2', 'DAM-903', 'DAM-903 (SA FAN-A Suction Damper RPC))', 131 UNION ALL
  SELECT 'instrument2', 'DAM-904', 'DAM-904 (SA FAN-B Suction Damper RPC))', 132 UNION ALL
  SELECT 'instrument2', 'DAM-905', 'DAM-905 (FD FAN-A Suction Damper RPC))', 133 UNION ALL
  SELECT 'instrument2', 'DAM-906', 'DAM-906 (FD FAN-B Suction Damper RPC))', 134 UNION ALL
  SELECT 'instrument2', 'DAM-907', 'DAM-907 (DA FAN-A Suction Damper RPC))', 135 UNION ALL
  SELECT 'instrument2', 'DAM-908', 'DAM-908 (DA FAN-B Suction Damper RPC))', 136 UNION ALL
  SELECT 'instrument2', 'APH-PC-M', 'APH-PC-M', 137 UNION ALL
  SELECT 'instrument2', 'APH-PC-S', 'APH-PC-S', 138 UNION ALL
  SELECT 'instrument2', 'ESP1-PC', 'ESP1-PC', 139 UNION ALL
  SELECT 'instrument2', 'ESP2-PC', 'ESP2-PC', 140 UNION ALL
  SELECT 'instrument2', 'ESP3-PC', 'ESP3-PC', 141 UNION ALL
  SELECT 'instrument2', 'ESP4-PC', 'ESP4-PC', 142 UNION ALL
  SELECT 'instrument2', 'TCV-509A NEW', 'TCV-509A', 143 UNION ALL
  SELECT 'instrument2', 'TCV-511A NEW', 'TCV-511A', 144
) AS src
WHERE NOT EXISTS (
  SELECT 1 FROM `pp_equipment` e
  WHERE e.`equip_no` = src.`equip_no` AND e.`name` = src.`name`
);
