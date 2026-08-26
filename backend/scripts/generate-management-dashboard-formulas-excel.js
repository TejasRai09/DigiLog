/**
 * Management Dashboard formula reference Excel.
 *
 * Cell-wise then number-wise: every KPI card, each number inside the card,
 * 7DMA, compare %, chart, DigiLog formula, and Power BI DAX.
 *
 * Usage:
 *   cd DigiLog/backend
 *   node scripts/generate-management-dashboard-formulas-excel.js
 */
const path = require('path');
const ExcelJS = require('exceljs');

const OUT = process.argv.includes('--out')
  ? path.resolve(process.argv[process.argv.indexOf('--out') + 1])
  : path.resolve(__dirname, '../../docs/bi/Management-Dashboard-Formulas.xlsx');

const DMA =
  '7DMA = AVERAGE of daily values for the 7 calendar days ending PREVIOUSDAY(To). ' +
  'Denom is always 7 (days with no data count as missing, not skipped in the divisor). ' +
  'DAX pattern: CALCULATE(measure, DATESINPERIOD(DMR_SS24[Date], PREVIOUSDAY(MAX(DMR_SS24[Date])), -7, DAY)) / 7';

const COMPARE =
  '% change = (Current − Prior) / ABS(Prior) × 100. ' +
  'Blank if Current or Prior is blank, or Prior = 0. ' +
  'Green = improvement (inverted for inverse KPIs: bagasse pol, power/steam, inhouse, spec steam).';

const FILTERS =
  'Date slicer = DMR_SS24[Date] (dmr_daily) only. ' +
  'STD = Oct 1 of current crushing season → latest DMR date. ' +
  'MTD = 1st of month → latest DMR date. ' +
  'YTD = Jan 1 → latest DMR date. ' +
  'All = min DMR date → max DMR date. ' +
  'Compare PP = shift window −1 season/month/year. ' +
  'Season toggle = same month/day window inside crushing season Oct–Sep (not Indian FY Apr–Mar).';

function cell(row, col, title, mysql, numbers, extras = {}) {
  return { row, col, title, mysql, numbers, ...extras };
}

function num(n, name, opts = {}) {
  return { n, name, ...opts };
}

const CELLS = [
  cell('Cane', 1, 'Cane Indent (Q)', 'centre_indent_data', [
    num(1, 'Cane Indent (Q)', {
      unit: 'Q',
      field: 'indent_qty',
      agg: 'SUM',
      digilog: 'SUM(centre_indent_data.indent_qty) WHERE indent_date BETWEEN From AND To',
      dax: 'SUM(\'Cane Indent\'[Qty in Qtls])',
      dma: 'Cane Indent 7DMA = SUM(indent_qty over last 7 DMR days) / 7',
      chart: 'Line / area sparkline of daily SUM(indent_qty)',
    }),
  ], { dateJoin: 'indent_date → dmr_daily.Date' }),
  cell('Cane', 2, 'Cane Purchase (Q)', 'centre_purchase_data', [
    num(1, 'Cane Purchase (Q)', {
      unit: 'Q',
      field: 'purchase_qty',
      agg: 'SUM',
      digilog: 'SUM(centre_purchase_data.purchase_qty) WHERE purchase_date BETWEEN From AND To',
      dax: 'SUM(\'Cane Purchase\'[Qty in Qtls])',
      dma: 'Cane Purchase 7DMA = SUM(purchase_qty over last 7 DMR days) / 7',
      chart: 'Bar sparkline of daily SUM(purchase_qty)',
    }),
  ], { dateJoin: 'purchase_date → dmr_daily.Date' }),
  cell('Cane', 3, 'Yard Bal. (8AM)', 'dmr_daily + centre_indent_data + centre_purchase_data', [
    num(1, 'Yard Bal. (8AM)', {
      unit: 'Q',
      field: 'YARD BAL  8 AM',
      agg: 'AVG',
      digilog: 'AVG(dmr_daily.`YARD BAL  8 AM`); fallback ops_logbook.yard_bal at 7–9 AM sampling',
      dax: 'AVERAGE(DMR_SS24[YARD BAL 8 AM])',
      dma: 'Yard Balance 7DMA = rolling AVG(YARD BAL 8 AM)',
      chart: 'None (stacked card)',
    }),
    num(2, 'Overrun Gate', {
      unit: '%',
      field: 'purchase_qty / indent_qty (category=gate)',
      agg: 'RATIO',
      digilog: 'SUM(purchase_qty WHERE category=gate) / SUM(indent_qty WHERE category=gate) × 100',
      dax: 'Overrun_Gate = DIVIDE(SUM(Purchase|Gate), SUM(Indent|Gate))',
      dma: 'No separate 7DMA in Power BI for this sub',
      chart: 'None',
    }),
    num(3, 'Overrun Center', {
      unit: '%',
      field: 'purchase_qty / indent_qty (category=center)',
      agg: 'RATIO',
      digilog: 'SUM(purchase_qty WHERE category=center) / SUM(indent_qty WHERE category=center) × 100',
      dax: 'Overrun_Center = DIVIDE(SUM(Purchase|Center), SUM(Indent|Center))',
      dma: 'Companion qty = MAX(0, CenterPurchase − CenterIndent) used as rightVal in DigiLog historically',
      chart: 'None',
    }),
  ]),
  cell('Cane', 4, 'Pol in Cane %', 'dmr_daily', [
    num(1, 'Pol in Cane %', {
      unit: '%',
      field: 'Plant POL IN CANE DS',
      agg: 'WAVG',
      digilog: 'SUM(Plant POL IN CANE DS × Total Cane to Sugar) / SUM(Total Cane to Sugar); fallback AVG(PJ_Pol) from ds_logbook',
      dax: 'WAvgPol = SUMX(DMR_SS24, [Plant POL IN CANE DS] * [Total Cane]) / SUM([Total Cane])',
      dma: 'WAvgPol_7DMA',
      chart: 'Line sparkline of daily pol',
    }),
  ]),
  cell('Cane', 5, 'Middle Brix % Yard', 'brix_yard_sampling', [
    num(1, 'Middle Brix % Yard', {
      unit: '%',
      field: 'MiddleBrix',
      agg: 'AVG',
      digilog: 'AVG(brix_yard_sampling.MiddleBrix) WHERE Date BETWEEN From AND To',
      dax: 'AVERAGE(YardBrix[Middle Brix %])',
      dma: 'YardBrix 7DMA = rolling AVG(Middle Brix %)',
      chart: 'Bar sparkline',
    }),
  ], { dateJoin: 'brix_yard_sampling.Date → dmr_daily.Date' }),
  cell('Cane', 6, 'Middle Brix % Field', 'brix_field_sampling', [
    num(1, 'Middle Brix % Field', {
      unit: '%',
      field: 'MiddleBrix',
      agg: 'AVG',
      digilog: 'AVG(brix_field_sampling.MiddleBrix) WHERE Date BETWEEN From AND To',
      dax: 'AVERAGE(FieldBrix[Middle Brix %])',
      dma: 'FieldBrix 7DMA = rolling AVG(Middle Brix %)',
      chart: 'Line sparkline',
    }),
  ], { dateJoin: 'brix_field_sampling.Date → dmr_daily.Date' }),

  cell('Milling', 1, 'Cane Crush (Q)', 'dmr_daily', [
    num(1, 'Cane Crush (Q)', {
      unit: 'Q',
      field: 'CANE CRUSHED [DS] + CANE CRUSHED [REF]  (or Total Cane)',
      agg: 'SUM',
      digilog: 'SUM(CANE CRUSHED [DS]) + SUM(CANE CRUSHED [REF]); overlay ops_logbook.crush',
      dax: 'SUM(DMR_SS24[Total Cane])',
      dma: 'Cane Crush 7DMA = rolling SUM(Total Cane) / 7',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Milling', 2, 'Masceration %', 'dmr_daily', [
    num(1, 'Masceration %', {
      unit: '%',
      field: 'MACERATION',
      agg: 'WAVG',
      digilog: 'WAVG(MACERATION, Total Cane to Sugar); fallback (imb_wtr / crush) × 100 from ops_logbook',
      dax: 'WAvgMaceration = SUMX(DMR, [MACERATION] * [Total Cane to Sugar]) / SUM([Total Cane to Sugar])',
      dma: 'Maceration 7DMA = rolling AVG(MACERATION)',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Milling', 3, 'Mixed Juice (Q)', 'dmr_daily', [
    num(1, 'Mixed Juice (Q)', {
      unit: 'Q',
      field: 'MIXED JUICE [AV] × cane  or MIXED JUICE',
      agg: 'SUM',
      digilog: 'If MIXED JUICE [AV] present: (AV/100) × (DS+REF cane); else MIXED JUICE. Overlay ops mixj_ds+mixj_rs',
      dax: 'SUM(DMR_SS24[Mixed Juice Cal])',
      dma: 'Mixed Juice 7DMA = rolling AVG(Mixed Juice Cal)',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Milling', 4, 'DMF %', 'dmr_daily', [
    num(1, 'DMF %', {
      unit: '%',
      field: 'DMF',
      agg: 'WAVG',
      digilog: 'WAVG(DMF, Total Cane to Sugar)',
      dax: 'WAvgDMF = SUMX(DMR, [DMF] * [Total Cane to Sugar]) / SUM([Total Cane to Sugar])',
      dma: 'DMF 7DMA',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Milling', 5, 'Bag Pol % Cane', 'dmr_daily', [
    num(1, 'Bag Pol % Cane', {
      unit: '%',
      field: 'Plant POL IN BAGASSE DS',
      agg: 'WAVG',
      digilog: 'WAVG(Plant POL IN BAGASSE DS, Total Cane to Sugar)',
      dax: 'WAvgBaggPol/Cane = SUMX(DMR, [Plant POL IN BAGASSE DS] * [Total Cane to Sugar]) / SUM([Total Cane to Sugar])',
      dma: 'WAvgBaggPol/Cane_7DMA',
      chart: 'None (stacked card)',
      inverse: true,
    }),
    num(2, 'Pol % Bagasse', {
      unit: '%',
      field: 'BAGASSE POL',
      agg: 'WAVG',
      digilog: 'WAVG(BAGASSE POL, Total Cane to Sugar)',
      dax: 'WAvgBaggPol = SUMX(DMR, [BAGASSE POL] * [Total Cane to Sugar]) / SUM([Total Cane to Sugar])',
      dma: 'WAvgBaggPol_7DMA',
      chart: 'None',
      inverse: true,
    }),
    num(3, 'Bagasse Moisture', {
      unit: '%',
      field: 'BAGASSE MOISTURE',
      agg: 'WAVG',
      digilog: 'WAVG(BAGASSE MOISTURE, Total Cane to Sugar)',
      dax: 'WAvgBagMoist = SUMX(DMR, [BAGASSE MOISTURE] * [Total Cane to Sugar]) / SUM([Total Cane to Sugar])',
      dma: 'WAvgBagMoist_7DMA',
      chart: 'None',
      inverse: true,
    }),
  ]),
  cell('Milling', 6, 'Power/Cane (KWH/Q)', 'ph_power + dmr_daily', [
    num(1, 'Power/Cane (KWH/Q)', {
      unit: 'KWH/Q',
      field: 'PowerConMillHouse / Crush',
      agg: 'RATIO (daily then avg)',
      digilog: 'Daily PowerConMillHouse / Crush, then average of daily ratios. Fallback SUM(mill house)/SUM(crush)',
      dax: 'Power/Cane = DIVIDE(PowerConMillHouse, Crush)',
      dma: 'Power/Cane 7DMA = rolling AVG(Power/Cane)',
      chart: 'Line sparkline',
      inverse: true,
    }),
  ]),
  cell('Milling', 7, 'Steam/Cane (KG/Q)', 'ph_steam + dmr_daily', [
    num(1, 'Steam/Cane (KG/Q)', {
      unit: 'KG/Q',
      field: '(StmMillTurbine110_45ATAPRDS + SteamGen70 − StmCons3New − StmCons3Old) × 1000 / Crush',
      agg: 'RATIO (daily then avg)',
      digilog: 'Daily mill steam kg / crush, then average of daily ratios',
      dax: 'Steam/Cane = (StmMillTurbine + StmConsMill&PRDS70) * 1000 / Crush',
      dma: 'Steam/Cane 7DMA',
      chart: 'Line sparkline',
      inverse: true,
    }),
  ]),

  cell('Sugar', 1, 'Cane DS (Q)', 'dmr_daily', [
    num(1, 'Cane DS (Q)', {
      unit: 'Q',
      field: 'CANE CRUSHED [DS]',
      agg: 'SUM',
      digilog: 'SUM(CANE CRUSHED [DS]); overlay ops_logbook.qty_dsl',
      dax: 'SUM(DMR_SS24[CANE CRUSHED [DS]])',
      dma: 'Daily SUM 7DMA / 7',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Sugar', 2, 'Cane RS (Q)', 'dmr_daily', [
    num(1, 'Cane RS (Q)', {
      unit: 'Q',
      field: 'CANE CRUSHED [REF]',
      agg: 'SUM',
      digilog: 'SUM(CANE CRUSHED [REF]); overlay ops_logbook.qty_rsl',
      dax: 'SUM(DMR_SS24[CANE CRUSHED [REF]])',
      dma: 'Daily SUM 7DMA / 7',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Sugar', 3, 'Sugar Total (Q)', 'dmr_daily', [
    num(1, 'Sugar Total (Q) — card value', {
      unit: 'Q',
      field: 'Total SUGAR PRODUCTION [DS] + [REF]',
      agg: 'SUM',
      digilog: 'SUM(Total SUGAR PRODUCTION [DS] + Total SUGAR PRODUCTION [REF]); fallback SUGAR OUTPUT[DS]+[REF]; overlay ops sugar bags',
      dax: 'SUM(Total SUGAR PRODUCTION [DS] + Total SUGAR PRODUCTION [REF])',
      dma: 'Sugar Total 7DMA = rolling SUM / 7',
      chart: 'Stacked bar: Sugar Prod DS vs Sugar Prod RS (valueDs / valueRs)',
    }),
    num(2, 'Chart series — Sugar Prod DS (Q)', {
      unit: 'Q',
      field: 'Total SUGAR PRODUCTION [DS] / SUGAR OUTPUT[DS]',
      agg: 'SUM by date',
      digilog: 'Daily SUM DS production (overlay ops qty_dsl+qty_dsm+qty_dss)',
      dax: 'SUM(DMR_SS24[Total SUGAR PRODUCTION [DS]])',
      dma: 'Used in bar chart only',
      chart: 'Bar series valueDs',
    }),
    num(3, 'Chart series — Sugar Prod RS (Q)', {
      unit: 'Q',
      field: 'Total SUGAR PRODUCTION [REF] / SUGAR OUTPUT [REF]',
      agg: 'SUM by date',
      digilog: 'Daily SUM RS production (overlay ops qty_rsl+qty_rsm+qty_rss)',
      dax: 'SUM(DMR_SS24[Total SUGAR PRODUCTION [REF]])',
      dma: 'Used in bar chart only',
      chart: 'Bar series valueRs',
    }),
  ]),
  cell('Sugar', 4, 'Sugar Recovery %', 'dmr_daily', [
    num(1, 'Sugar Recovery %', {
      unit: '%',
      field: 'AV. RECOVERY%',
      agg: 'WAVG',
      digilog: 'WAVG(AV. RECOVERY%, Total Cane to Sugar); fallback AVG(RECOVERY [DS] %)',
      dax: 'WAvgRec = SUMX(DMR, [AV. RECOVERY%] * [Total Cane to Sugar]) / SUM([Total Cane to Sugar])',
      dma: 'WAvgRec_7DMA',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Sugar', 5, 'Pol In F Cake', 'dmr_daily', [
    num(1, 'Pol In F Cake', {
      unit: '%',
      field: 'Plant POL IN F CAKE DS',
      agg: 'WAVG',
      digilog: 'WAVG(Plant POL IN F CAKE DS, Total Cane to Sugar); fallback AVG(ds_logbook.FCake_Pol)',
      dax: 'WAvgFCakePol = SUMX(DMR, [Plant POL IN F CAKE DS] * [Total Cane to Sugar]) / SUM([Total Cane to Sugar])',
      dma: 'WAvgFCakePol_7DMA',
      chart: 'None (stacked card)',
      inverse: true,
    }),
    num(2, 'Mol Pol % Cane', {
      unit: '%',
      field: 'Plant POL IN F MOL DS',
      agg: 'WAVG',
      digilog: 'WAVG(Plant POL IN F MOL DS, Total Cane to Sugar)',
      dax: 'WAvgFMolPol = SUMX(DMR, [Plant POL IN F MOL DS] * [Total Cane to Sugar]) / SUM([Total Cane to Sugar])',
      dma: 'WAvgFMolPol_7DMA',
      chart: 'None',
    }),
    num(3, 'F Mol Purity (DS)', {
      unit: '%',
      field: 'Purity B HEAVY Mol DS',
      agg: 'WAVG',
      digilog: 'WAVG(Purity B HEAVY Mol DS, CANE CRUSHED [DS]); fallback FMol_Pol/FMol_Brix×100 from ds_logbook',
      dax: 'WAvgPurityMolDS = SUMX(DMR, [Purity B HEAVY Mol DS] * [CANE CRUSHED [DS]]) / SUM([CANE CRUSHED [DS]])',
      dma: 'WAvgPurityMolDS_7DMA',
      chart: 'None',
      inverse: true,
    }),
    num(4, 'F Mol Purity (RS)', {
      unit: '%',
      field: 'Purity C HEAVY MOL. Ref',
      agg: 'WAVG',
      digilog: 'WAVG(Purity C HEAVY MOL. Ref, CANE CRUSHED [REF]); fallback FMol_Pol/FMol_Brix×100 from rs_logbook',
      dax: 'WAvgPurityMolRS = SUMX(DMR, [Purity C HEAVY MOL. Ref] * [CANE CRUSHED [REF]]) / SUM([CANE CRUSHED [REF]])',
      dma: 'WAvgPurityMolRS_7DMA',
      chart: 'None',
      inverse: true,
    }),
  ]),
  cell('Sugar', 6, 'Power/Sugar (KWH/Q)', 'ph_power + dmr_daily', [
    num(1, 'Power/Sugar (KWH/Q)', {
      unit: 'KWH/Q',
      field: '(PowerConRaw_Ref + PowerConDSHouse) / sugar output',
      agg: 'RATIO (daily then avg)',
      digilog: 'Daily sugar-house power / sugar output, then average of daily ratios',
      dax: 'Power/Sugar = DIVIDE(sugar-house power, LOOKUPVALUE DMR sugar production)',
      dma: 'Power/Sugar 7DMA',
      chart: 'Line sparkline',
      inverse: true,
    }),
  ]),
  cell('Sugar', 7, 'Steam/Sugar (KG/Q)', 'ph_steam + dmr_daily', [
    num(1, 'Steam/Sugar (KG/Q)', {
      unit: 'KG/Q',
      field: '(TotalStmtoSug150 + TotalStmtoSug70) × 1000 / sugar output',
      agg: 'RATIO (daily then avg)',
      digilog: 'Daily steam-to-sugar kg / sugar output, then average of daily ratios',
      dax: 'Steam/Sugar = (Steam to Sugar 70 + Extraction 3ATA) * 1000 / sugar production',
      dma: 'Steam/Sugar 7DMA',
      chart: 'Line sparkline',
      inverse: true,
    }),
  ]),

  cell('Power', 1, 'Power Gen (Units)', 'ph_power', [
    num(1, 'Power Gen (Units)', {
      unit: 'KWH',
      field: 'PowerGen30 + PowerGen3New + PowerGen3Old + PowerGen4MW',
      agg: 'SUM',
      digilog: 'SUM of four generator columns in ph_power (latest row per date)',
      dax: 'Total Power Gen = [PowerGen30]+[PowerGen3New]+[PowerGen3Old]+[PowerGen4MW]',
      dma: 'Power Gen 7DMA = rolling AVG(Total Power Gen)',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Power', 2, 'Export (Units)', 'ph_power', [
    num(1, 'Export (Units)', {
      unit: 'KWH',
      field: 'ExportGrid30',
      agg: 'SUM',
      digilog: 'SUM(ph_power.ExportGrid30)',
      dax: 'SUM(power[ExportGrid30])',
      dma: 'Export 7DMA = rolling AVG(ExportGrid30)',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Power', 3, 'Inhouse Consp (Units)', 'ph_power', [
    num(1, 'Inhouse Consp (Units)', {
      unit: 'KWH',
      field: 'Total Power Gen − ExportGrid30',
      agg: 'SUM',
      digilog: 'SUM(gen) − SUM(ExportGrid30)',
      dax: 'Total Internal Consp Col = Total Power Gen − ExportGrid30',
      dma: 'Internal Consp 7DMA',
      chart: 'Line sparkline',
      inverse: true,
    }),
  ]),
  cell('Power', 4, 'Total Steam Gen (T)', 'ph_steam', [
    num(1, 'Total Steam Gen (T)', {
      unit: 'MT',
      field: 'SteamGen150 + SteamGen70 + SteamGen35',
      agg: 'SUM',
      digilog: 'SUM of three boiler steam gen columns',
      dax: 'TotalSteamGen = [SteamGen150]+[SteamGen70]+[SteamGen35]',
      dma: 'Total Steam Gen 7DMA',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Power', 5, 'Total Steam to Sugar (T)', 'ph_steam', [
    num(1, 'Total Steam to Sugar (T)', {
      unit: 'MT',
      field: 'TotalStmtoSug150 + TotalStmtoSug70',
      agg: 'SUM',
      digilog: 'SUM(TotalStmtoSug150) + SUM(TotalStmtoSug70)',
      dax: 'TotalSteamtoSug = [TotalStmtoSug150]+[TotalStmtoSug70]',
      dma: 'TotalSteamtoSug 7DMA',
      chart: 'Line sparkline',
      inverse: true,
    }),
  ]),
  cell('Power', 6, 'Steam/Bag 150 TPH', 'ph_steam', [
    num(1, 'Steam/Bag 150 TPH', {
      unit: 'T/T',
      field: 'SteamGen150 / Baggase150',
      agg: 'RATIO',
      digilog: 'SUM(SteamGen150) / SUM(Baggase150)',
      dax: 'StmtoBaggase150 = DIVIDE(SUM(SteamGen150), SUM(Baggase150))',
      dma: 'StmtoBaggase150_7DMA',
      chart: 'None (stacked card)',
    }),
    num(2, 'Steam/Bag 70 TPH', {
      unit: 'T/T',
      field: 'SteamGen70 / Baggase70',
      agg: 'RATIO',
      digilog: 'SUM(SteamGen70) / SUM(Baggase70)',
      dax: 'StmtoBaggase70 = DIVIDE(SUM(SteamGen70), SUM(Baggase70))',
      dma: 'StmtoBaggase70_7DMA',
      chart: 'None',
    }),
    num(3, 'Steam/Bag 35 TPH', {
      unit: 'T/T',
      field: 'SteamGen35 / (Baggase35 + SlopCon)',
      agg: 'RATIO',
      digilog: 'SUM(SteamGen35) / (SUM(Baggase35)+SUM(SlopCon))',
      dax: 'StmtoBaggase35 = DIVIDE(SUM(SteamGen35), SUM(Baggase35)+SUM(SlopCon))',
      dma: 'StmtoBaggase35_7DMA',
      chart: 'None',
    }),
  ]),
  cell('Power', 7, 'Sp. Steam 30MW', 'ph_steam + ph_power', [
    num(1, 'Sp. Steam 30MW', {
      unit: 'T/MWh',
      field: 'SteamCon30MW / (PowerGen30/1000)',
      agg: 'RATIO',
      digilog: 'SUM(SteamCon30MW) / (SUM(PowerGen30)/1000)',
      dax: 'SpecSteam30 = DIVIDE(SUM(SteamCon30MW), SUM(PowerGen30)/1000)',
      dma: 'SpecSteam30MW_7DMA',
      chart: 'None (stacked card)',
      inverse: true,
    }),
    num(2, 'Sp. Steam 3(O+N)', {
      unit: 'T/MWh',
      field: '(StmCons3Old70 + StmCons3New70) / ((PowerGen3Old+PowerGen3New)/1000)',
      agg: 'RATIO',
      digilog: 'SUM(StmCons3Old35 + StmCons3New35) / ((SUM(PowerGen3Old)+SUM(PowerGen3New))/1000). Note: DigiLog maps StmCons3Old70←StmCons3Old35',
      dax: 'SpecSteam3(O+N) = DIVIDE(SUM(StmCons3Old)+SUM(StmCons3New), (PowerGen3Old+PowerGen3New)/1000)',
      dma: 'SpecSteam3(O+N)_7DMA',
      chart: 'None',
      inverse: true,
    }),
    num(3, 'Sp. Steam 4MW', {
      unit: 'T/MWh',
      field: 'StmCons4 / (PowerGen4MW/1000)',
      agg: 'RATIO',
      digilog: 'SUM(StmCons4) / (SUM(PowerGen4MW)/1000)',
      dax: 'SpecSteam4 = DIVIDE(SUM(StmCons4), SUM(PowerGen4MW)/1000)',
      dma: 'SpecSteam4MW_7DMA',
      chart: 'None',
      inverse: true,
    }),
  ]),

  cell('Distillery', 1, 'Syrup+Mol Used (Q)', 'distillery_operations', [
    num(1, 'Syrup+Mol Used (Q)', {
      unit: 'Q',
      field: 'syrup_molasses_qtls',
      agg: 'SUM',
      digilog: 'SUM(distillery_operations.syrup_molasses_qtls)',
      dax: 'SUM(Distillery[Syrup or Molasses Used (Qtls)])',
      dma: 'Daily SUM 7DMA / 7',
      chart: 'Line sparkline',
    }),
  ], { dateJoin: 'distillery_operations.Date → dmr_daily.Date' }),
  cell('Distillery', 2, 'Ethanol Prod. (BL)', 'distillery_operations', [
    num(1, 'Ethanol Prod. (BL)', {
      unit: 'BL',
      field: 'actual_ethanol_bl',
      agg: 'SUM',
      digilog: 'SUM(distillery_operations.actual_ethanol_bl)',
      dax: 'SUM(Distillery[Actual Ethanol Production (BL)])',
      dma: 'Ethanol Prod 7DMA',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Distillery', 3, 'Recovery BL', 'distillery_operations', [
    num(1, 'Recovery BL', {
      unit: 'BL/Q',
      field: 'rec_bl',
      agg: 'AVG / RATIO',
      digilog: 'AVG(rec_bl); fallback SUM(actual_ethanol_bl)/SUM(syrup_molasses_qtls)',
      dax: 'AVERAGE(Distillery[REC BL])',
      dma: 'Ethanol Rec 7DMA',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Distillery', 4, 'Ethanol Stored (BL)', 'distillery_operations', [
    num(1, 'Ethanol Stored (BL)', {
      unit: 'BL',
      field: 'ethanol_storage_bl',
      agg: 'AVG',
      digilog: 'AVG(distillery_operations.ethanol_storage_bl)',
      dax: 'AVERAGE(Distillery[Ethanol in Storage (BL)])',
      dma: 'Ethanol Store 7DMA',
      chart: 'Line sparkline',
    }),
  ]),
  cell('Distillery', 5, 'B Mol in Store (Q)', 'distillery_operations', [
    num(1, 'B Mol in Store (Q)', {
      unit: 'Q',
      field: 'total_bh_molasses_qtls',
      agg: 'AVG',
      digilog: 'AVG(total_bh_molasses_qtls)',
      dax: 'AVERAGE(Distillery[Total BH Molasses in Storage (Distillery) - Qtls])',
      dma: 'BMol Store 7DMA',
      chart: 'None (stacked card)',
    }),
    num(2, 'C Mol in Store (Q)', {
      unit: 'Q',
      field: 'total_ch_molasses_qtls',
      agg: 'AVG',
      digilog: 'AVG(total_ch_molasses_qtls)',
      dax: 'AVERAGE(Distillery[Total CH Molasses in Storage])',
      dma: 'CMol Store 7DMA',
      chart: 'None',
    }),
  ]),
  cell('Distillery', 6, 'Distillation Eff.', 'distillery_operations', [
    num(1, 'Distillation Eff.', {
      unit: '%',
      field: 'de',
      agg: 'AVG after per-row normalize',
      digilog: 'For each row: if |de|≤1 then de×100 else de. Then AVG of percents. (Fixes mixed 0.98 vs 98 storage)',
      dax: 'AVERAGE(Distillery[DE])  /* PBI assumes one scale */',
      dma: 'DE 7DMA (same per-row normalize)',
      chart: 'None (stacked card)',
    }),
    num(2, 'Fermentation Eff.', {
      unit: '%',
      field: 'fe',
      agg: 'AVG after per-row normalize',
      digilog: 'Same as DE: per-row effPercent then average',
      dax: 'AVERAGE(Distillery[FE])',
      dma: 'FE 7DMA',
      chart: 'None',
    }),
  ]),
  cell('Distillery', 7, 'TRS & FS %', 'distillery_operations', [
    num(1, 'TRS %', {
      unit: '%',
      field: 'trs',
      agg: 'AVG',
      digilog: 'AVG(distillery_operations.trs)',
      dax: 'AVERAGE(Distillery[TRS])',
      dma: 'TRS 7DMA',
      chart: 'None (stacked card — Power BI shows two numbers, not a chart)',
    }),
    num(2, 'FS %', {
      unit: '%',
      field: 'fs',
      agg: 'AVG',
      digilog: 'AVG(distillery_operations.fs)',
      dax: 'AVERAGE(Distillery[FS])',
      dma: 'FS 7DMA',
      chart: 'None',
    }),
  ]),
];

const HEADER_FILL = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E3A5F' },
};
const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Calibri' };
const ROW_COLORS = {
  Cane: 'FFCCE0FF',
  Milling: 'FFF5CBB3',
  Sugar: 'FFFEF0B3',
  Power: 'FFCCFFCC',
  Distillery: 'FFF5C2D6',
};

function styleHeader(row) {
  row.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
    c.alignment = { vertical: 'middle', wrapText: true, horizontal: 'center' };
    c.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });
  row.height = 28;
}

function styleBody(cell, rowName) {
  cell.alignment = { vertical: 'top', wrapText: true };
  cell.font = { name: 'Calibri', size: 9 };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
  if (rowName && ROW_COLORS[rowName]) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ROW_COLORS[rowName] } };
  }
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'DigiLog';
  wb.created = new Date();

  // ── Readme ──
  const readme = wb.addWorksheet('How to read', { views: [{ state: 'frozen', ySplit: 1 }] });
  readme.columns = [
    { header: 'Topic', key: 'topic', width: 28 },
    { header: 'Rule', key: 'rule', width: 110 },
  ];
  styleHeader(readme.getRow(1));
  const readmeRows = [
    ['Purpose', 'This workbook documents every Management Dashboard KPI card (cell) and every number inside that card: primary value, sub-values, 7DMA (red italic), compare %, and chart.'],
    ['Layout', 'Sheet "1-Cell catalog" = one row per KPI card. Sheet "2-Number wise" = one row per displayed number (and extra rows for 7DMA + compare). Sheet "3-Filters & compare" = STD/MTD/YTD and compare toggle. Sheet "4-DAX library" = reusable DAX patterns.'],
    ['Date filter', FILTERS],
    ['Days Elapsed', 'COUNT of dmr_daily rows (DMR dates) in the selected From–To. Same as Power BI Days = COUNTROWS(DMR_SS24). Not calendar days.'],
    ['7DMA (red number)', DMA],
    ['Compare % badge', COMPARE],
    ['Inverse KPIs (lower is better)', 'bag_pol_cane, power_per_cane, steam_per_cane, pol_f_cake, power_per_sugar, steam_per_sugar, inhouse_consp, steam_to_sugar, spec_steam — green when the % change is negative.'],
    ['Blank cards', 'If the source table has no rows in the DMR date window, the card shows "—". Compare % is hidden if current or prior is blank.'],
    ['Deduping', 'ops_logbook, ds/rs logbook, ph_power, ph_steam, distillery_operations: latest timestamp per Date is kept before aggregating.'],
    ['Files in code', 'backend/utils/managementDashboardMeasures.js (KPI values), managementDashboardSeries.js (7DMA + charts), dmrDailyMeasures.js (DMR WAVG), frontend mergeManagementDashboardApi.js + ManagementKpiCell.jsx (display).'],
  ];
  readmeRows.forEach(([topic, rule], i) => {
    const r = readme.addRow({ topic, rule });
    r.height = 48;
    r.eachCell((c) => styleBody(c));
    r.getCell(1).font = { bold: true, name: 'Calibri', size: 10 };
  });

  // ── Cell catalog ──
  const cat = wb.addWorksheet('1-Cell catalog', { views: [{ state: 'frozen', ySplit: 1, xSplit: 3 }] });
  cat.columns = [
    { header: 'Row', key: 'row', width: 14 },
    { header: 'Cell #', key: 'col', width: 10 },
    { header: 'KPI card (cell) title', key: 'title', width: 28 },
    { header: 'How many numbers in cell', key: 'count', width: 16 },
    { header: 'Number names (in order)', key: 'names', width: 55 },
    { header: 'Chart on card?', key: 'chart', width: 22 },
    { header: '7DMA shown?', key: 'dma', width: 14 },
    { header: 'Compare % shown?', key: 'cmp', width: 16 },
    { header: 'MySQL source table(s)', key: 'mysql', width: 42 },
    { header: 'Date join to DMR', key: 'join', width: 40 },
  ];
  styleHeader(cat.getRow(1));
  CELLS.forEach((c) => {
    const charts = [...new Set(c.numbers.map((n) => n.chart).filter(Boolean))];
    const r = cat.addRow({
      row: c.row,
      col: c.col,
      title: c.title,
      count: c.numbers.length,
      names: c.numbers.map((n) => `${n.n}. ${n.name}`).join('  |  '),
      chart: charts.join(' / ') || 'None',
      dma: 'Yes — red italic next to each number that has a daily series',
      cmp: 'Yes — badge per number vs selected compare period',
      mysql: c.mysql,
      join: c.dateJoin || 'dmr_daily.Date (same table or Date column)',
    });
    r.height = 36;
    r.eachCell((cell) => styleBody(cell, c.row));
  });

  // ── Number wise ──
  const det = wb.addWorksheet('2-Number wise', { views: [{ state: 'frozen', ySplit: 1, xSplit: 4 }] });
  det.columns = [
    { header: 'Row', key: 'row', width: 12 },
    { header: 'Cell #', key: 'col', width: 8 },
    { header: 'KPI card', key: 'card', width: 24 },
    { header: '# in cell', key: 'n', width: 10 },
    { header: 'What is shown', key: 'what', width: 18 },
    { header: 'Display name', key: 'name', width: 32 },
    { header: 'Unit', key: 'unit', width: 10 },
    { header: 'MySQL table', key: 'mysql', width: 28 },
    { header: 'Field / columns', key: 'field', width: 42 },
    { header: 'Aggregation', key: 'agg', width: 22 },
    { header: 'DigiLog formula (app)', key: 'digilog', width: 70 },
    { header: 'Power BI DAX', key: 'dax', width: 70 },
    { header: '7DMA formula / DAX', key: 'dma', width: 55 },
    { header: 'Chart / sparkline', key: 'chart', width: 36 },
    { header: 'Compare % formula', key: 'cmp', width: 50 },
    { header: 'Lower is better?', key: 'inv', width: 14 },
  ];
  styleHeader(det.getRow(1));

  CELLS.forEach((c) => {
    c.numbers.forEach((n) => {
      const add = (what, extra = {}) => {
        const r = det.addRow({
          row: c.row,
          col: c.col,
          card: c.title,
          n: n.n,
          what,
          name: extra.name || n.name,
          unit: extra.unit || n.unit || '',
          mysql: extra.mysql || c.mysql,
          field: extra.field || n.field,
          agg: extra.agg || n.agg,
          digilog: extra.digilog || n.digilog,
          dax: extra.dax || n.dax,
          dma: extra.dma || n.dma || DMA,
          chart: extra.chart || n.chart || 'None',
          cmp: extra.cmp || COMPARE,
          inv: extra.inv != null ? extra.inv : (n.inverse ? 'Yes' : 'No'),
        });
        r.height = 42;
        r.eachCell((cell) => styleBody(cell, c.row));
      };

      add('1. Primary / sub number');
      add('2. 7DMA (red italic)', {
        name: `${n.name} — 7DMA`,
        unit: n.unit,
        agg: '7-day rolling',
        digilog: n.dma,
        dax: n.dma,
        dma: DMA,
        chart: 'Same daily series as the sparkline, averaged over 7 days',
        cmp: '7DMA is NOT compared; compare % uses period totals/averages, not 7DMA',
      });
      add('3. Compare % badge', {
        name: `${n.name} — vs prior period`,
        unit: '%',
        field: 'n/a — derived',
        agg: '% change',
        digilog: `(current.${n.name} − prior.${n.name}) / ABS(prior.${n.name}) × 100`,
        dax: 'Same % change vs parallel period (Prev Season / Prev Month / Prev Year / crushing-season window)',
        dma: 'n/a',
        chart: 'None',
        cmp: COMPARE,
      });
    });
  });

  // ── Filters ──
  const fil = wb.addWorksheet('3-Filters & compare', { views: [{ state: 'frozen', ySplit: 1 }] });
  fil.columns = [
    { header: 'Control', key: 'ctrl', width: 28 },
    { header: 'From', key: 'from', width: 42 },
    { header: 'To', key: 'to', width: 36 },
    { header: 'Compare window when toggle = Prev…', key: 'prev', width: 50 },
    { header: 'Notes', key: 'notes', width: 70 },
  ];
  styleHeader(fil.getRow(1));
  [
    ['STD (Season To Date)', '1 Oct of current crushing season (Oct–Sep)', 'Latest DMR date (clamped)', 'Same Oct 1 → To, minus 1 year (Prev. Season)', 'If today is Aug, season started previous Oct.'],
    ['MTD (Month To Date)', '1st of current calendar month', 'Latest DMR date', 'Same day-of-month window, minus 1 month (Prev. Month)', 'Short months clamp the day (e.g. Mar 31 → Feb 28).'],
    ['YTD (Year To Date)', '1 Jan of current calendar year', 'Latest DMR date', 'Same Jan 1 → To, minus 1 year (Prev. Year)', 'Not crushing-season based.'],
    ['All', 'MIN(dmr_daily.Date)', 'MAX(dmr_daily.Date)', 'Equal-length window ending the day before From (Prev. Period)', 'Uses DMR bounds only, not other fact tables.'],
    ['Custom dates', 'User From', 'User To', 'Equal-length window ending day before From', 'Preset switches to Custom when dates edited.'],
    ['Compare: 2024-2025 (S1)', 'Same month/day as current From, inside Oct 2024–Sep 2025', 'Same month/day as current To, inside that season', 'n/a — this IS the compare range', 'Crushing season Oct–Sep, NOT Indian FY Apr–Mar.'],
    ['Compare: 2023-2024 (S2)', 'Same as above for Oct 2023–Sep 2024', 'Same', 'n/a', 'Labels use latest DMR year, not browser today.'],
    ['Days Elapsed box', 'n/a', 'n/a', 'n/a', 'COUNT(dmr_daily.Date) in selected range.'],
  ].forEach((row) => {
    const r = fil.addRow({ ctrl: row[0], from: row[1], to: row[2], prev: row[3], notes: row[4] });
    r.height = 36;
    r.eachCell((c) => styleBody(c));
    r.getCell(1).font = { bold: true, name: 'Calibri', size: 10 };
  });

  // ── DAX library ──
  const dax = wb.addWorksheet('4-DAX library', { views: [{ state: 'frozen', ySplit: 1 }] });
  dax.columns = [
    { header: 'Pattern name', key: 'name', width: 28 },
    { header: 'DAX', key: 'dax', width: 95 },
    { header: 'Used by', key: 'used', width: 50 },
  ];
  styleHeader(dax.getRow(1));
  [
    ['Date slicer', 'ALLSELECTED(DMR_SS24[Date])  — slicer bound to DMR_SS24[Date] only', 'Every KPI date filter'],
    ['Simple SUM', 'SUM(Table[Column])', 'Indent, Purchase, Crush, Cane DS/RS, Power Gen, Export, Steam totals, Ethanol prod, Syrup'],
    ['Simple AVG', 'AVERAGE(Table[Column])', 'Yard bal, Brix, Ethanol stored, B/C mol store, TRS, FS'],
    ['Weighted average', 'DIVIDE( SUMX(DMR_SS24, DMR_SS24[Metric] * DMR_SS24[Total Cane to Sugar]), SUM(DMR_SS24[Total Cane to Sugar]) )', 'Pol in cane, Maceration, DMF, Bag pol, Recovery, F cake pol, Mol pol'],
    ['Ratio of sums', 'DIVIDE( SUM(Num[x]), SUM(Den[y]) )', 'Overrun, Power/Cane, Steam/Cane, Steam/Bag, Spec steam, Power/Sugar, Steam/Sugar'],
    ['7DMA (PBI)', 'CALCULATE( [Measure], DATESINPERIOD( DMR_SS24[Date], PREVIOUSDAY( MAX(DMR_SS24[Date]) ), -7, DAY ) ) / 7', 'Red italic on every number with a daily series'],
    ['Days elapsed', 'COUNTROWS( DMR_SS24 )  /* with slicer */', 'Days Elapsed card'],
    ['Compare %', 'DIVIDE( [Current] - [Prior], ABS([Prior]) )', 'Green/red badge on every number'],
    ['Prior period STD', 'SAMEPERIODLASTYEAR on the STD window (Oct 1 → To)', 'Compare = Prev. Season'],
    ['Prior period MTD', 'DATEADD(dates, -1, MONTH)', 'Compare = Prev. Month'],
    ['Prior period YTD', 'SAMEPERIODLASTYEAR on YTD window', 'Compare = Prev. Year'],
    ['Efficiency normalize', 'DigiLog only: IF(ABS(de)<=1, de*100, de) per row then AVERAGE', 'Distillation Eff., Fermentation Eff.'],
  ].forEach((row) => {
    const r = dax.addRow({ name: row[0], dax: row[1], used: row[2] });
    r.height = 36;
    r.eachCell((c) => styleBody(c));
    r.getCell(1).font = { bold: true, name: 'Calibri', size: 10 };
  });

  const fs = require('fs');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log('Wrote', OUT);
  console.log(`Cells: ${CELLS.length}  Numbers: ${CELLS.reduce((s, c) => s + c.numbers.length, 0)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
