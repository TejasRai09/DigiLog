/**
 * Export Management Dashboard KPI formulas / columns / DAX to Excel.
 * One row per dashboard cell; all calculations for that cell in the DAX columns.
 *
 * Usage (from backend/):
 *   node scripts/export-management-dashboard-formulas.js
 */
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { enrichVisualLayers } = require('./managementDashboardCellLayers');

const TMDL_DIR = path.resolve(
  __dirname,
  '../../../Management Dashboard-v1.SemanticModel/definition/tables',
);
const OUT_DIR = path.resolve(__dirname, '../../docs');
const OUT_FILE = path.join(OUT_DIR, 'Management-Dashboard-KPI-Formulas.xlsx');

function cleanDax(s) {
  return String(s || '')
    .replace(/```/g, '')
    .replace(/\t/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseTmdl(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const table = (text.match(/^table\s+'?([^'\r\n]+)'?/m) || [])[1] || path.basename(filePath, '.tmdl');
  const items = [];
  const re = /^\t(measure|column)\s+((?:'[^']+')|[^\s=]+)\s*=\s*(```[\s\S]*?```|.+)$/gm;
  let m;
  while ((m = re.exec(text))) {
    const kind = m[1];
    const name = m[2].replace(/^'|'$/g, '');
    items.push({ table, kind, name, dax: cleanDax(m[3]) });
  }
  return { table, items };
}

function loadAllTmdl() {
  const map = new Map();
  if (!fs.existsSync(TMDL_DIR)) return map;
  for (const f of fs.readdirSync(TMDL_DIR)) {
    if (!f.endsWith('.tmdl')) continue;
    const parsed = parseTmdl(path.join(TMDL_DIR, f));
    for (const it of parsed.items) {
      map.set(`${it.table}::${it.name}`, it);
      map.set(it.name, it);
    }
  }
  return map;
}

function daxOf(map, ...keys) {
  const parts = [];
  for (const key of keys) {
    const it = map.get(key);
    if (!it) continue;
    parts.push(`${it.kind.toUpperCase()} ${it.table}[${it.name}]\n${it.dax}`);
  }
  return parts.join('\n\n────────\n\n');
}

const DMR_DATE_CALENDAR = 'DMR_SS24[Date]';

/** Fact-table date column joined to DMR_SS24.Date (PBI relationships.tmdl). */
const DATE_JOIN_BY_KPI = {
  'Cane Indent (Q)': "Cane Indent[Indent Date] → DMR_SS24[Date]",
  'Cane Purchase (Q)': "Cane Purchase[Purchase Date] → DMR_SS24[Date]",
  'Yard Bal. (8AM) + Overrun Gate + Overrun Center': 'DMR_SS24[Date] (same table; yard balance + 7DMA)',
  'Pol in Cane %': 'DMR_SS24[Date] (same table)',
  'Middle Brix % Yard': "YardBrix[Sampling Date] → DMR_SS24[Date]",
  'Middle Brix % Field': "FieldBrix[Date of Sampling] → DMR_SS24[Date]",
  'Cane Crush (Q)': 'DMR_SS24[Date] (same table)',
  'Maceration %': 'DMR_SS24[Date] (same table)',
  'Mixed Juice (Q)': 'DMR_SS24[Date] (same table)',
  'DMF %': 'DMR_SS24[Date] (same table)',
  'Bag Pol % Cane + Pol % Bagasse + Bagasse Moisture': 'DMR_SS24[Date] (same table)',
  'Power/Cane (Unit/Q)': "power[Date] → DMR_SS24[Date]",
  'Steam/Cane (T/Q)': "steam[Date] → DMR_SS24[Date]",
  'Sugar Recovery %': 'DMR_SS24[Date] (same table)',
  'Pol in F Cake + Mol Pol % Cane + F Mol Purity DS + F Mol Purity RS': 'DMR_SS24[Date] (same table)',
  'Power/Sugar (Units/Q)': "power[Date] → DMR_SS24[Date] (card also LOOKUPVALUE DMR sugar)",
  'Steam/Sugar (T/Q)': "steam[Date] → DMR_SS24[Date] (card also LOOKUPVALUE DMR sugar)",
  'Power Gen (Units)': "power[Date] → DMR_SS24[Date]",
  'Export (Units)': "power[Date] → DMR_SS24[Date]",
  'Inhouse Consp (Units)': "power[Date] → DMR_SS24[Date]",
  'Total Steam Gen (T)': "steam[Date] → DMR_SS24[Date]",
  'Total Steam to Sugar (T)': "steam[Date] → DMR_SS24[Date]",
  'Steam/Bag 150 + 70 + 35 TPH': "steam[Date] → DMR_SS24[Date]",
  'Sp. Steam 30MW + 3(O+N) + 4MW': "power[Date] → DMR_SS24[Date]",
  'Ethanol Prod. (BL)': "Distillery[Operation Date] → DMR_SS24[Date]",
  'Recovery (BL/Q)': "Distillery[Operation Date] → DMR_SS24[Date]",
  'Ethanol in Store (BL)': "Distillery[Operation Date] → DMR_SS24[Date]",
  'B Mol in Store + C Mol in Store': "Distillery[Operation Date] → DMR_SS24[Date]",
  'Distillation Eff. + Fermentation Eff.': "Distillery[Operation Date] → DMR_SS24[Date]",
  'TRS % + FS %': "Distillery[Operation Date] → DMR_SS24[Date]",
};

function usesDmrDateCalendar(text) {
  return /'?DMR_SS24'?\s*\[\s*Date\s*\]/i.test(String(text || ''));
}

function has7dmaOverlay(text) {
  return /7DMA/i.test(String(text || ''));
}

function enrichDateCalendar(row) {
  const daxBlob = `${row.extraDax || ''}\n${row.cardDax || ''}`;
  const mappedJoin = DATE_JOIN_BY_KPI[row.kpi];
  const needsCalendar =
    Boolean(mappedJoin)
    || (has7dmaOverlay(row.extraDax) && usesDmrDateCalendar(daxBlob));
  if (!needsCalendar) {
    row.dateCalendar = '';
    row.dateJoin = '';
    return row;
  }

  row.dateCalendar = DMR_DATE_CALENDAR;
  row.dateJoin = mappedJoin || 'See PBI relationships.tmdl → DMR_SS24.Date';

  if (!String(row.pbiTable).includes('DMR_SS24')) {
    row.pbiTable = `${row.pbiTable} + DMR_SS24 (date calendar)`;
  }
  if (!String(row.columns).includes('DMR_SS24[Date]')) {
    row.columns = `${row.columns}; DMR_SS24[Date] (7DMA rolling window via DATESINPERIOD)`;
  }
  return row;
}

function buildRows(map) {
  const cells = [
    // ── Cane ──
    {
      section: 'Cane',
      cell: 1,
      kpi: 'Cane Indent (Q)',
      glossary: 'Schedule/permit issued to farmers to supply sugarcane to the mill.',
      pbiTable: 'Cane Indent',
      columns: 'Qty in Qtls, Indent Date, Category',
      cardDax: "SUM('Cane Indent'[Qty in Qtls])",
      extraDax: daxOf(map, 'Cane Indent 7DMA'),
      mysql: 'centre_indent_data.qty / indent_date',
      agg: 'SUM',
      chart: 'Area',
      unit: 'Q',
    },
    {
      section: 'Cane',
      cell: 2,
      kpi: 'Cane Purchase (Q)',
      glossary: 'Total cane received and purchased from growers.',
      pbiTable: 'Cane Purchase',
      columns: 'Qty in Qtls, Purchase Date, Category',
      cardDax: "SUM('Cane Purchase'[Qty in Qtls])",
      extraDax: daxOf(map, 'Cane Purchase 7DMA', 'Indenting Eff'),
      mysql: 'centre_purchase_data.qty / purchase_date',
      agg: 'SUM',
      chart: 'Area',
      unit: 'Q',
    },
    {
      section: 'Cane',
      cell: 3,
      kpi: 'Yard Bal. (8AM) + Overrun Gate + Overrun Center',
      glossary: 'Cane in yard at 8AM. Overrun Gate/Center = purchase vs indent by category.',
      pbiTable: 'DMR_SS24 + Cane Purchase + Cane Indent',
      columns: 'YARD BAL  8 AM; Cane Purchase[Qty in Qtls]; Cane Indent[Qty in Qtls]; Category',
      cardDax: "AVG('DMR_SS24'[YARD BAL  8 AM])",
      extraDax: [
        daxOf(map, 'Overrun_Gate'),
        daxOf(map, 'Overrun_Center'),
        daxOf(map, 'Yard Balance 7DMA'),
      ].filter(Boolean).join('\n\n────────\n\n'),
      mysql: 'ops_logbook yard balance; centre_purchase_data + centre_indent_data by Gate/Center',
      agg: 'AVG + ratio',
      chart: 'None (multiRowCard)',
      unit: 'Q / %',
    },
    {
      section: 'Cane',
      cell: 4,
      kpi: 'Pol in Cane %',
      glossary: 'Sucrose % in cane as received. Increase is positive.',
      pbiTable: 'DMR_SS24',
      columns: 'Plant POL IN CANE DS, Total Cane, Total Cane to Sugar',
      cardDax: daxOf(map, 'WAvgPol') || "WAvgPol = DIVIDE(SUMX(DMR_SS24, [Plant POL IN CANE DS]*[Total Cane to Sugar]), SUM([Total Cane to Sugar]))",
      extraDax: daxOf(map, 'WAvgPol_7DMA', 'Pol in Cane 7DMA'),
      mysql: 'ds_logbook / ops_logbook pol in cane, weighted by crush',
      agg: 'Weighted AVG',
      chart: 'Line',
      unit: '%',
    },
    {
      section: 'Cane',
      cell: 5,
      kpi: 'Middle Brix % Yard',
      glossary: 'Average sugar content (°Brix) of juice from cane in the factory yard.',
      pbiTable: 'YardBrix',
      columns: 'Middle Brix %, Date',
      cardDax: 'AVERAGE(YardBrix[Middle Brix %])',
      extraDax: daxOf(map, 'YardBrix 7DMA'),
      mysql: 'brix_yard_sampling.middle_brix',
      agg: 'AVG',
      chart: 'Line',
      unit: '%',
    },
    {
      section: 'Cane',
      cell: 6,
      kpi: 'Middle Brix % Field',
      glossary: 'Average sugar content (°Brix) measured in the field before harvest.',
      pbiTable: 'FieldBrix',
      columns: 'Middle Brix %, Date',
      cardDax: 'AVERAGE(FieldBrix[Middle Brix %])',
      extraDax: daxOf(map, 'FiledBrix 7DMA'),
      mysql: 'brix_field_sampling.middle_brix',
      agg: 'AVG',
      chart: 'Area',
      unit: '%',
    },
    // ── Milling ──
    {
      section: 'Milling',
      cell: 1,
      kpi: 'Cane Crush (Q)',
      glossary: 'Quantity of cane crushed in the mill.',
      pbiTable: 'DMR_SS24',
      columns: "Total Cane (= CANE CRUSHED [DS] + CANE CRUSHED [REF])",
      cardDax: "SUM('DMR_SS24'[Total Cane])\n\nCalculated column:\nTotal Cane = [CANE CRUSHED [DS]] + [CANE CRUSHED [REF]]",
      extraDax: daxOf(map, 'Cane Crush 7DMA', 'Crush Rate'),
      mysql: 'ops_logbook / ds+rs crush qty',
      agg: 'SUM',
      chart: 'Line',
      unit: 'Q',
    },
    {
      section: 'Milling',
      cell: 2,
      kpi: 'Maceration %',
      glossary: 'Water/juice added at final mills to improve sucrose extraction. Increase is positive.',
      pbiTable: 'DMR_SS24',
      columns: 'MACERATION, Total Cane to Sugar',
      cardDax: daxOf(map, 'WAvgMaceration') || "WAvgMaceration = DIVIDE(SUMX(DMR, [MACERATION]*[Total Cane to Sugar]), SUM([Total Cane to Sugar]))",
      extraDax: daxOf(map, 'Maceration 7DMA'),
      mysql: 'ops_logbook MACERATION, weighted by cane-to-sugar',
      agg: 'Weighted AVG',
      chart: 'Stacked area / Area',
      unit: '%',
    },
    {
      section: 'Milling',
      cell: 3,
      kpi: 'Mixed Juice (Q)',
      glossary: 'Combined juice from all milling units before clarification.',
      pbiTable: 'DMR_SS24',
      columns: "Mixed Juice Cal (= MIXED JUICE [AV] / 100 * Total Cane)",
      cardDax: "SUM('DMR_SS24'[Mixed Juice Cal])\n\nCalculated column:\nMixed Juice Cal = [MIXED JUICE [AV]]/100 * [Total Cane]",
      extraDax: daxOf(map, 'Mixed Juice 7DMA'),
      mysql: 'ops_logbook mixed juice',
      agg: 'SUM',
      chart: 'Line',
      unit: 'Q',
    },
    {
      section: 'Milling',
      cell: 4,
      kpi: 'DMF %',
      glossary: 'Direct mill extraction efficiency of the milling tandem.',
      pbiTable: 'DMR_SS24',
      columns: 'DMF, Total Cane to Sugar',
      cardDax: daxOf(map, 'WAvgDMF') || "WAvgDMF = DIVIDE(SUMX(DMR, [DMF]*[Total Cane to Sugar]), SUM([Total Cane to Sugar]))",
      extraDax: daxOf(map, 'DMF 7DMA'),
      mysql: 'ops_logbook DMF',
      agg: 'Weighted AVG',
      chart: 'Area',
      unit: '%',
    },
    {
      section: 'Milling',
      cell: 5,
      kpi: 'Bag Pol % Cane + Pol % Bagasse + Bagasse Moisture',
      glossary: 'Sucrose left in bagasse (on cane and on bagasse) and bagasse moisture. Decrease is positive.',
      pbiTable: 'DMR_SS24',
      columns: 'Plant POL IN BAGASSE DS, Eff. BAGASSE POL %, Eff. BAGASSE MOISTURE %, Total Cane to Sugar',
      cardDax: [
        daxOf(map, 'WAvgBaggPol/Cane'),
        daxOf(map, 'WAvgBaggPol'),
        daxOf(map, 'WAvgBagMoist'),
      ].filter(Boolean).join('\n\n────────\n\n'),
      extraDax: daxOf(map, 'WAvgBaggPol/Cane_7DMA', 'WAvgBaggPol_7DMA', 'WAvgBagMoist_7DMA'),
      mysql: 'ds_logbook bagasse pol / moisture',
      agg: 'Weighted AVG (3 metrics)',
      chart: 'None (multiRowCard)',
      unit: '%',
    },
    {
      section: 'Milling',
      cell: 6,
      kpi: 'Power/Cane (Unit/Q)',
      glossary: 'Power used to process 1 quintal of cane. Decrease is positive.',
      pbiTable: 'power',
      columns: 'PowerConMillHouse, Crush',
      cardDax: daxOf(map, 'Power/Cane') || "Power/Cane = IF([Crush]<>0, [PowerConMillHouse]/[Crush], BLANK())",
      extraDax: daxOf(map, 'Power/Cane 7DMA'),
      mysql: 'ph_power mill-house kWh / crush',
      agg: 'AVG of calculated column',
      chart: 'Line',
      unit: 'KWH/Q',
    },
    {
      section: 'Milling',
      cell: 7,
      kpi: 'Steam/Cane (T/Q)',
      glossary: 'Steam used to process 1 quintal of cane. Decrease is positive.',
      pbiTable: 'steam + power',
      columns: 'StmMillTurbine110_45ATAPRDS, SteamGen70, StmCons3New70, StmCons3Old70, Crush',
      cardDax: [
        daxOf(map, 'StmConsMill&PRDS70'),
        daxOf(map, 'Steam/Cane'),
      ].filter(Boolean).join('\n\n────────\n\n')
        || "Steam/Cane = IF(Crush<>0, (StmMillTurbine + StmConsMill&PRDS70)*1000 / Crush, BLANK())\nStmConsMill&PRDS70 = SUM(SteamGen70)-SUM(StmCons3New70)-SUM(StmCons3Old70)",
      extraDax: daxOf(map, 'Steam/Cane 7DMA'),
      mysql: 'ph_steam mill turbine + PRDS / ph_power.Crush',
      agg: 'AVG of calculated column',
      chart: 'Area',
      unit: 'KG/Q',
    },
    // ── Sugar ──
    {
      section: 'Sugar',
      cell: 1,
      kpi: 'Cane DS (Q)',
      glossary: 'Cane diverted to DS house.',
      pbiTable: 'DMR_SS24',
      columns: 'CANE CRUSHED [DS]',
      cardDax: "SUM('DMR_SS24'[CANE CRUSHED [DS]])",
      extraDax: 'Daily SUM by Date (chart layer)',
      mysql: 'ds_logbook cane crushed',
      agg: 'SUM',
      chart: 'Line',
      unit: 'Q',
    },
    {
      section: 'Sugar',
      cell: 2,
      kpi: 'Cane RS (Q)',
      glossary: 'Cane diverted to RS house.',
      pbiTable: 'DMR_SS24',
      columns: 'CANE CRUSHED [REF]',
      cardDax: "SUM('DMR_SS24'[CANE CRUSHED [REF]])",
      extraDax: 'Daily SUM by Date (chart layer)',
      mysql: 'rs_logbook cane crushed',
      agg: 'SUM',
      chart: 'Line',
      unit: 'Q',
    },
    {
      section: 'Sugar',
      cell: 3,
      kpi: 'Sugar Prod DS (Q) + Sugar Prod RS (Q)  /  Sugar Total',
      glossary: 'Total sugar produced by DS and RS. Increase is positive.',
      pbiTable: 'DMR_SS24',
      columns: 'Total SUGAR PRODUCTION [DS], Total SUGAR PRODUCTION [REF], Total Sugar Production (Qtls), Total Sugar Output',
      cardDax: "SUM([Total SUGAR PRODUCTION [DS]]) + SUM([Total SUGAR PRODUCTION [REF]])\n\nCalculated column:\nTotal Sugar Output = [SUGAR OUTPUT [REF]] + [SUGAR OUTPUT[DS]]",
      extraDax: 'Column chart: two series DS + RS by Date',
      mysql: 'ds_logbook + rs_logbook sugar bags/qty',
      agg: 'SUM (grouped column chart)',
      chart: 'Column (grouped)',
      unit: 'Q',
    },
    {
      section: 'Sugar',
      cell: 4,
      kpi: 'Sugar Recovery %',
      glossary: 'Sugar produced as % of cane crush. Increase is positive.',
      pbiTable: 'DMR_SS24',
      columns: 'AV. RECOVERY%, Total Cane to Sugar',
      cardDax: daxOf(map, 'WAvgRec') || "WAvgRec = DIVIDE(SUMX(DMR, [AV. RECOVERY%]*[Total Cane to Sugar]), SUM([Total Cane to Sugar]))",
      extraDax: daxOf(map, 'WAvgRec_7DMA', 'Recovery 7DMA'),
      mysql: 'ops_logbook recovery %, weighted by cane-to-sugar',
      agg: 'Weighted AVG',
      chart: 'Area',
      unit: '%',
    },
    {
      section: 'Sugar',
      cell: 5,
      kpi: 'Pol in F Cake + Mol Pol % Cane + F Mol Purity DS + F Mol Purity RS',
      glossary: 'Sucrose in filter cake and final molasses; higher molasses purity = more sugar loss.',
      pbiTable: 'DMR_SS24',
      columns: 'Plant POL IN F CAKE DS, Plant POL IN F MOL DS, Purity B HEAVY Mol DS, Purity C HEAVY MOL. Ref, Total Cane to Sugar, CANE CRUSHED [DS], CANE CRUSHED [REF]',
      cardDax: [
        daxOf(map, 'WAvgFCakePol'),
        daxOf(map, 'WAvgFMolPol'),
        daxOf(map, 'WAvgPurityMolDS'),
        daxOf(map, 'WAvgPurityMolRS'),
      ].filter(Boolean).join('\n\n────────\n\n'),
      extraDax: daxOf(map, 'WAvgFCakePol_7DMA', 'WAvgFMolPol_7DMA', 'WAvgPurityMolDS_7DMA', 'WAvgPurityMolRS_7DMA'),
      mysql: 'ds_logbook / rs_logbook filter cake pol, mol pol, mol purity',
      agg: 'Weighted AVG (4 metrics)',
      chart: 'None (multiRowCard)',
      unit: '%',
    },
    {
      section: 'Sugar',
      cell: 6,
      kpi: 'Power/Sugar (Units/Q)',
      glossary: 'Power used to produce one unit of sugar. Decrease is positive.',
      pbiTable: 'power + DMR_SS24',
      columns: 'PowerConRaw_Ref, PowerConDSHouse, Total Sugar Output, Date',
      cardDax: daxOf(map, 'Power/Sugar') || "Power/Sugar = IF(Sugar<>0, (PowerConRaw_Ref+PowerConDSHouse)/LOOKUPVALUE(DMR[Total Sugar Output], Date), BLANK())",
      extraDax: daxOf(map, 'Power/Sugar 7DMA'),
      mysql: 'ph_power sugar-house kWh / sugar production',
      agg: 'AVG of calculated column',
      chart: 'Line',
      unit: 'KWH/Q',
    },
    {
      section: 'Sugar',
      cell: 7,
      kpi: 'Steam/Sugar (T/Q)',
      glossary: 'Steam used to produce one unit of sugar. Decrease is positive.',
      pbiTable: 'steam + DMR_SS24',
      columns: 'TotalStmtoSug150, TotalStmtoSug70, Total Sugar Output, Date',
      cardDax: daxOf(map, 'Steam/Sugar') || "Steam/Sugar = IF(Sugar<>0, (TotalStmtoSug150+TotalStmtoSug70)*1000 / Sugar, BLANK())",
      extraDax: daxOf(map, 'Steam/Sugar 7DMA'),
      mysql: 'ph_steam to sugar / sugar production',
      agg: 'AVG of calculated column',
      chart: 'Area',
      unit: 'KG/Q',
    },
    // ── Power ──
    {
      section: 'Power',
      cell: 1,
      kpi: 'Power Gen (Units)',
      glossary: 'Total power generated in the plant. Increase is positive.',
      pbiTable: 'power',
      columns: 'PowerGen30, PowerGen3New, PowerGen3Old, PowerGen4MW',
      cardDax: daxOf(map, 'Total Power_Gen', 'Total Power Gen')
        || "Total Power Gen = PowerGen30 + PowerGen3New + PowerGen3Old + PowerGen4MW",
      extraDax: daxOf(map, 'Power Gen 7DMA'),
      mysql: 'ph_power PowerGen30/3New/3Old/4MW',
      agg: 'SUM',
      chart: 'Area',
      unit: 'KWH',
    },
    {
      section: 'Power',
      cell: 2,
      kpi: 'Export (Units)',
      glossary: 'Power exported to the grid (UPPCL). Increase is positive.',
      pbiTable: 'power',
      columns: 'ExportGrid30',
      cardDax: "SUM('power'[ExportGrid30])",
      extraDax: daxOf(map, 'Export 7DMA'),
      mysql: 'ph_power.ExportGrid30',
      agg: 'SUM',
      chart: 'Line',
      unit: 'KWH',
    },
    {
      section: 'Power',
      cell: 3,
      kpi: 'Inhouse Consp (Units)',
      glossary: 'Power used in plant operations. Decrease is positive.',
      pbiTable: 'power',
      columns: 'Total Power Gen, ExportGrid30, ExportCogen*, ExportSug*, PowerGen4MW, ExportDist30, Imp_4MW',
      cardDax: [
        daxOf(map, 'Total Internal Consp Col'),
        daxOf(map, 'Total_Internal_Con'),
        daxOf(map, 'PowerCons_Dist+CPU_4MW'),
        daxOf(map, 'Inhouse30MW'),
      ].filter(Boolean).join('\n\n────────\n\n')
        || "Total Internal Consp Col = [Total Power Gen] - ExportGrid30",
      extraDax: daxOf(map, 'Internal Consp 7DMA'),
      mysql: 'ph_power generation minus grid export',
      agg: 'SUM',
      chart: 'Stacked area',
      unit: 'KWH',
    },
    {
      section: 'Power',
      cell: 4,
      kpi: 'Total Steam Gen (T)',
      glossary: 'Total steam generated in the plant.',
      pbiTable: 'steam',
      columns: 'SteamGen150, SteamGen70, SteamGen35',
      cardDax: daxOf(map, 'TotalSteamGen') || "TotalSteamGen = SteamGen150 + SteamGen70 + SteamGen35",
      extraDax: daxOf(map, 'Total Steam Gen 7DMA'),
      mysql: 'ph_steam SteamGen150/70/35',
      agg: 'SUM',
      chart: 'Line',
      unit: 'MT',
    },
    {
      section: 'Power',
      cell: 5,
      kpi: 'Total Steam to Sugar (T)',
      glossary: 'Steam used in sugar manufacturing. Decrease is positive.',
      pbiTable: 'steam',
      columns: 'TotalStmtoSug150, TotalStmtoSug70',
      cardDax: daxOf(map, 'TotalSteamtoSug') || "TotalSteamtoSug = TotalStmtoSug150 + TotalStmtoSug70",
      extraDax: daxOf(map, 'TotalSteamtoSug 7DMA'),
      mysql: 'ph_steam steam to sugar 150+70',
      agg: 'SUM',
      chart: 'Line',
      unit: 'MT',
    },
    {
      section: 'Power',
      cell: 6,
      kpi: 'Steam/Bag 150 + 70 + 35 TPH',
      glossary: 'Steam generated per unit of bagasse. Increase is positive.',
      pbiTable: 'steam',
      columns: 'SteamGen150/70/35, Baggase150/70/35, SlopCon',
      cardDax: [
        daxOf(map, 'StmtoBaggase150'),
        daxOf(map, 'StmtoBaggase70'),
        daxOf(map, 'StmtoBaggase35'),
      ].filter(Boolean).join('\n\n────────\n\n'),
      extraDax: daxOf(map, 'StmtoBaggase150_7DMA', 'StmtoBaggase70_7DMA', 'StmtoBaggase35_7DMA'),
      mysql: 'ph_steam steam gen / bagasse per boiler',
      agg: 'AVG of calculated columns (3 metrics)',
      chart: 'None (multiRowCard)',
      unit: 'T/T',
    },
    {
      section: 'Power',
      cell: 7,
      kpi: 'Sp. Steam 30MW + 3(O+N) + 4MW',
      glossary: 'Steam consumed per unit of generation. Decrease is positive.',
      pbiTable: 'power + steam',
      columns: 'PowerGen30, PowerGen3New, PowerGen3Old, PowerGen4MW, SteamCon30MW, StmCons3New70, StmCons3Old70, StmCons4',
      cardDax: [
        daxOf(map, 'SpecSteam30'),
        daxOf(map, 'SpecSteam3(O+N)'),
        daxOf(map, 'SpecSteam4'),
      ].filter(Boolean).join('\n\n────────\n\n'),
      extraDax: daxOf(map, 'SpecSteam30MW_7DMA', 'SpecSteam3(O+N)_7DMA', 'SpecSteam4MW_7DMA'),
      mysql: 'ph_steam TG steam / ph_power TG kWh',
      agg: 'AVG of calculated columns (3 metrics)',
      chart: 'None (multiRowCard)',
      unit: 'T/MWH',
    },
    // ── Distillery ──
    {
      section: 'Distillery',
      cell: 1,
      kpi: 'Syrup+Mol Used (Q)',
      glossary: 'Syrup and molasses quantity used for ethanol production.',
      pbiTable: 'Distillery',
      columns: 'Syrup or Molasses Used (Qtls), Operation Date',
      cardDax: "SUM(Distillery[Syrup or Molasses Used (Qtls)])",
      extraDax: 'Daily SUM by Operation Date (chart layer)',
      mysql: 'distillery_operations syrup/molasses used',
      agg: 'SUM',
      chart: 'Area',
      unit: 'Q',
    },
    {
      section: 'Distillery',
      cell: 2,
      kpi: 'Ethanol Prod. (BL)',
      glossary: 'Ethanol produced from molasses/syrup. Increase is positive.',
      pbiTable: 'Distillery',
      columns: 'Actual Ethanol Production (BL)',
      cardDax: "SUM(Distillery[Actual Ethanol Production (BL)])",
      extraDax: daxOf(map, 'Ethanol Prod 7DMA'),
      mysql: 'distillery_operations actual ethanol production',
      agg: 'SUM',
      chart: 'Line',
      unit: 'BL',
    },
    {
      section: 'Distillery',
      cell: 3,
      kpi: 'Recovery (BL/Q)',
      glossary: 'Ethanol recovered vs available sugars. Increase is positive.',
      pbiTable: 'Distillery',
      columns: 'REC BL',
      cardDax: 'AVERAGE(Distillery[REC BL])',
      extraDax: daxOf(map, 'Ethanol Rec 7DMA'),
      mysql: 'distillery_operations REC BL',
      agg: 'AVG',
      chart: 'Line',
      unit: 'BL/Q',
    },
    {
      section: 'Distillery',
      cell: 4,
      kpi: 'Ethanol in Store (BL)',
      glossary: 'Ethanol kept in storage tanks after distillation.',
      pbiTable: 'Distillery',
      columns: 'Ethanol in Storage (BL)',
      cardDax: 'AVERAGE(Distillery[Ethanol in Storage (BL)])',
      extraDax: daxOf(map, 'Ethanol Store 7DMA'),
      mysql: 'distillery_operations ethanol storage',
      agg: 'AVG',
      chart: 'Line',
      unit: 'BL',
    },
    {
      section: 'Distillery',
      cell: 5,
      kpi: 'B Mol in Store + C Mol in Store',
      glossary: 'B and C molasses inventory.',
      pbiTable: 'Distillery',
      columns: 'Total BH Molasses in Storage (Distillery) - Qtls, Total CH Molasses in Storage',
      cardDax: "AVERAGE(Distillery[Total BH Molasses in Storage (Distillery) - Qtls])\nAVERAGE(C molasses storage column)",
      extraDax: daxOf(map, 'BMol Store 7DMA', 'CMol Store 7DMA'),
      mysql: 'distillery_operations BH/CH molasses storage',
      agg: 'AVG (2 metrics)',
      chart: 'None (multiRowCard)',
      unit: 'Q',
    },
    {
      section: 'Distillery',
      cell: 6,
      kpi: 'Distillation Eff. + Fermentation Eff.',
      glossary: 'Column separation efficiency and fermentation conversion efficiency. Increase is positive.',
      pbiTable: 'Distillery',
      columns: 'DE, FE',
      cardDax: 'AVERAGE(Distillery[DE])\nAVERAGE(Distillery[FE])',
      extraDax: daxOf(map, 'DE 7DMA', 'FE 7DMA'),
      mysql: 'distillery_operations DE, FE',
      agg: 'AVG (2 metrics)',
      chart: 'None (multiRowCard)',
      unit: '%',
    },
    {
      section: 'Distillery',
      cell: 7,
      kpi: 'TRS % + FS %',
      glossary: 'TRS = total fermentable sugars in feedstock. FS = fermentable sugars. Increase is positive.',
      pbiTable: 'Distillery',
      columns: 'TRS, FS',
      cardDax: 'AVERAGE(Distillery[TRS])\nAVERAGE(Distillery[FS])',
      extraDax: daxOf(map, 'TRS 7DMA', 'FS 7DMA'),
      mysql: 'distillery_operations TRS, FS',
      agg: 'AVG (dual line)',
      chart: 'Line (dual series)',
      unit: '%',
    },
  ];

  return cells.map(enrichDateCalendar).map(enrichVisualLayers);
}

function verifyDateCalendar(rows) {
  const gaps = [];
  for (const r of rows) {
    const shouldHave = Boolean(DATE_JOIN_BY_KPI[r.kpi]);
    if (!shouldHave) continue;
    if (!r.dateCalendar) gaps.push(`${r.section} / ${r.kpi} (missing date calendar)`);
    if (!String(r.pbiTable).includes('DMR_SS24')) {
      gaps.push(`${r.section} / ${r.kpi} (Tables used missing DMR_SS24)`);
    }
  }
  if (gaps.length) {
    console.warn('Date calendar / tables used gaps:', gaps.join('; '));
  }
  return gaps;
}

async function main() {
  const map = loadAllTmdl();
  const rows = buildRows(map);
  verifyDateCalendar(rows);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLog';
  wb.created = new Date();

  const headers = [
    'Section',
    'Cell #',
    'KPI cell (dashboard)',
    'Cell layout',
    'What it means',
    'Tables used',
    'Date calendar (7DMA)',
    'Date join to DMR_SS24',
    'Columns used',
    '① Big bold number — source',
    '② Red 7DMA number — source',
    '③ Graph — source',
    'Card / main DAX (all calcs for this cell)',
    '7DMA + extra DAX',
    'Aggregation',
    'Chart type',
    'Unit',
    'DigiLog MySQL (Phase 2)',
  ];

  const colWidths = [14, 10, 38, 28, 42, 34, 22, 38, 42, 52, 52, 52, 60, 60, 22, 22, 12, 42];

  function styleHeader(row) {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    row.alignment = { wrapText: true, vertical: 'middle' };
    row.height = 28;
  }

  const sectionColors = {
    Cane: 'FFDBEAFE',
    Milling: 'FFFED7AA',
    Sugar: 'FFFEF08A',
    Power: 'FFBBF7D0',
    Distillery: 'FFFBCFE8',
  };

  function addSheet(name, data) {
    const ws = wb.addWorksheet(name);
    ws.addRow(headers);
    styleHeader(ws.getRow(1));
    headers.forEach((_, i) => {
      ws.getColumn(i + 1).width = colWidths[i];
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: 'A1', to: 'R1' };

    for (const r of data) {
      const row = ws.addRow([
        r.section,
        r.cell,
        r.kpi,
        r.cellLayout || '',
        r.glossary,
        r.pbiTable,
        r.dateCalendar || '',
        r.dateJoin || '',
        r.columns,
        r.layer1Main || '',
        r.layer2Red7dma || '',
        r.layer3Graph || '',
        r.cardDax || '',
        r.extraDax || '',
        r.agg,
        r.chart,
        r.unit,
        r.mysql,
      ]);
      row.alignment = { wrapText: true, vertical: 'top' };
      const lines = Math.max(
        6,
        String(r.layer1Main || '').split('\n').length,
        String(r.layer2Red7dma || '').split('\n').length,
        String(r.layer3Graph || '').split('\n').length,
        String(r.cardDax || '').split('\n').length,
        String(r.extraDax || '').split('\n').length,
      );
      row.height = Math.min(220, 16 * lines);
      const fill = sectionColors[r.section];
      if (fill) {
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        row.getCell(1).font = { bold: true };
      }
    }
    return ws;
  }

  addSheet('All KPI cells', rows);
  for (const section of ['Cane', 'Milling', 'Sugar', 'Power', 'Distillery']) {
    addSheet(section, rows.filter((r) => r.section === section));
  }

  const note = wb.addWorksheet('How to read');
  note.getColumn(1).width = 28;
  note.getColumn(2).width = 100;
  note.addRow(['Management Dashboard — formula workbook']);
  note.getRow(1).font = { bold: true, size: 14 };
  note.addRow([]);
  note.addRow(['Scope', 'Management Dashboard only (Page 1 values + Duplicate Page 1 charts).']);
  note.addRow(['Layout', 'One Excel row = one dashboard cell. Most cells have 3 visual parts on Page 1 + chart page.']);
  note.addRow(['Cell layout', '3-part = bold main + red 7DMA + chart. Multi-row = stacked metrics (some cells have no chart).']);
  note.addRow(['① Big bold number', 'Main card value for selected period — large black number (Page 1).']);
  note.addRow(['② Red 7DMA number', 'Small red italic overlay — 7-day moving average measure (Page 1). Uses DMR_SS24[Date] as calendar.']);
  note.addRow(['③ Graph', 'Daily trend sparkline from Duplicate of Page 1 — X-axis DMR_SS24[Date], Y-axis daily aggregate.']);
  note.addRow(['Example — Cane Indent', '① SUM(Cane Indent[Qty in Qtls]) | ② Cane Indent 7DMA | ③ Area chart of daily indent by DMR_SS24[Date]']);
  note.addRow(['Card / main DAX', 'Full DAX for card calculations (may include multiple sub-metrics).']);
  note.addRow(['7DMA + extra DAX', 'Full 7DMA measure DAX pulled from semantic model TMDL.']);
  note.addRow(['7DMA pattern', "CALCULATE(..., DATESINPERIOD('DMR_SS24'[Date], PREVIOUSDAY(LASTDATE('DMR_SS24'[Date])), -7, DAY)) / 7"]);
  note.addRow(['Date calendar (7DMA)', 'DMR_SS24[Date] is the season calendar for every 7DMA overlay, even when the metric value comes from Cane Indent, Distillery, power, steam, etc.']);
  note.addRow(['Date join to DMR_SS24', 'Fact-table date column related to DMR_SS24.Date in relationships.tmdl (e.g. Cane Indent[Indent Date]).']);
  note.addRow(['Source', 'Management Dashboard-v1.SemanticModel (TMDL) + DigiLog catalog.']);
  note.addRow(['Phase 1 UI', 'Frontend static snapshot. Live MySQL is Phase 2.']);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await wb.xlsx.writeFile(OUT_FILE);
  console.log('Wrote', OUT_FILE);
  console.log('KPI cells:', rows.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
