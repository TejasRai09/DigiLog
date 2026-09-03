/**
 * Regenerate Distillery_Dashboard_Section_Calculations.xlsx to match
 * DigiLog Distillery BI after Power BI SemanticModel alignment (Aug 2026).
 *
 * Run from DigiLog/: node scripts/generate-distillery-section-calculations.js
 * Or from PLANT/: node DigiLog/scripts/... with paths adjusted.
 */
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'xlsx'));

const OUT = path.join(__dirname, '..', '..', 'Distillery_Dashboard_Section_Calculations.xlsx');

const rows = [
  ['S.No', 'Dashboard Section', 'UI Label (exact text on screen)', 'Description / What this number means', 'Formula (what dashboard calculates)', 'PBI SemanticModel reference', 'Validation Status'],
  ['★', 'Source', 'Power BI model', 'Distillery Dashboard.SemanticModel', 'Fact table Distillery; calc cols FS %, Total Mol in Store; measures * 7DMA', 'Distillery.tmdl', 'Done'],
  ['★', 'API', 'GET /api/bi/distillery-operations', 'All dated rows (no silent 365-day lookback); client filters MTD/QTD/YTD/Custom + mode', 'WHERE Date IS NOT NULL; LIMIT 200000; dedupe latest timestamp per Date', 'SharePoint Excel → DigiLog MySQL distillery_operations', 'Done'],
  [],
  [2, 'KPI Card 1', 'Total Ethanol Produced (main value, BL)', 'Total bulk litres of ethanol produced over the selected period', 'SUM(actual_ethanol_bl) for filtered days', 'SUM(Actual Ethanol Production (BL))', 'Done'],
  [3, 'KPI Card 1', 'Total Ethanol Produced (badge %)', 'Percent change vs comparison period', '((cur SUM - prior SUM) / prior SUM) × 100', 'PoP on same measure', 'Done'],
  [4, 'KPI Card 1', 'Sparkline', 'Daily ethanol', 'totalProd per day', 'Daily column', 'Done'],
  [],
  [5, 'KPI Card 2', 'Syrup/Molasses Consumed (Q)', 'Total feed consumed', 'SUM(syrup_molasses_qtls)', 'SUM(Syrup or Molasses Used (Qtls))', 'Done'],
  [6, 'KPI Card 2', 'Badge %', 'Inverse colour (up = red)', '((cur - prior) / prior) × 100', '—', 'Done'],
  [],
  [8, 'KPI Card 3', 'Fermentation Efficiency %', 'Average daily FE', 'AVG(effPercent(fe)); effPercent = fe×100 if |fe|≤1 else fe', 'FE (format %); FE 7DMA measure', 'Done'],
  [11, 'KPI Card 4', 'Distillation Efficiency %', 'Average daily DE', 'AVG(effPercent(de))', 'DE (format %); DE 7DMA measure', 'Done'],
  [],
  [14, 'Chart: Ethanol Vol', 'Stacked bars by mode', 'Ethanol allocated to operating mode only', 'B Heavy / C Heavy / Syrup / Mixed = full day ethanol on that mode (NO 50/50 Mixed split)', 'Operation Mode column', 'Done'],
  [18, 'Chart: Ethanol Vol', 'REC BL line (right axis)', 'Recovery BL per quintal feed (NOT AL/BL %)', 'recovery = rec_bl; fallback actual_ethanol_bl / syrup_molasses_qtls', 'REC BL column; Ethanol Rec 7DMA', 'Done'],
  ['18b', 'Chart: Ethanol Vol', 'Ethanol 7DMA', '7-day moving average of daily ethanol ending day before each point', 'AVG(totalProd) over previous 7 days in filtered series', 'Ethanol Prod 7DMA (was DMR_SS24 — DigiLog uses Operation Date series)', 'Done'],
  [19, 'Chart: Ethanol Vol', 'Total Vol subtitle', 'Period sum', 'SUM(totalProd)', '—', 'Done'],
  [20, 'Chart: Ethanol Vol', 'Avg REC BL subtitle', 'Period average REC BL', 'AVG(recovery)', '—', 'Done'],
  [],
  [22, 'Chart: Ferm. Sugar', 'Ferm. Sugar %', 'FS as % of TRS', 'fermSugar = (fs/trs)×100 if valid else fs', 'FS % = FS/TRS (ratio); DigiLog displays ×100', 'Done'],
  [24, 'Chart: Ferm. Sugar', 'Alcohol %', 'Wash alcohol', 'alcohol_pct', 'Alcohol %', 'Done'],
  [],
  [28, 'Chart: Overall Efficiency', 'FE / DE / OE lines', 'Daily efficiencies', 'FE%, DE%; OE% = effPercent(oe) or (FE/100)×(DE/100)×100', 'FE, DE, OE columns', 'Done'],
  ['28b', 'Chart: Overall Efficiency', 'FE 7DMA / DE 7DMA', 'Rolling averages', 'AVG previous 7 days FE% / DE%', 'FE 7DMA, DE 7DMA', 'Done'],
  [],
  [32, 'Chart: Wash Distilled', 'Wash Volume', 'Daily wash', 'wash_distilled', 'Wash Distilled', 'Done'],
  [35, 'Chart: Molasses Stock', 'Molasses Stock', 'BH+CH inventory', 'COALESCE(BH,0)+COALESCE(CH,0)', 'Total Mol in Store', 'Done'],
  ['35b', 'Chart: Molasses Stock', 'Mol Stock 7DMA', '7DMA of total mol stock', 'AVG previous 7 days molInStore', 'BMol/CMol Store 7DMA (combined in DigiLog)', 'Done'],
  [38, 'Chart: Ethanol Stock', 'Ethanol Stock', 'Finished inventory', 'ethanol_storage_bl', 'Ethanol in Storage (BL)', 'Done'],
  ['38b', 'Chart: Ethanol Stock', 'Ethanol Store 7DMA', '7DMA storage', 'AVG previous 7 days ethInStore', 'Ethanol Store 7DMA', 'Done'],
  [],
  [51, 'Raw Data', 'REC BL', 'Recovery BL/Q', 'rec_bl / recovery field', 'REC BL', 'Done'],
  ['51b', 'Raw Data', 'AL to BL Ratio %', 'Absolute alcohol ratio', 'al_bl_ratio_pct (separate from REC BL)', 'AL to BL Ratio (%)', 'Done'],
  [65, 'Raw Data', 'Mixed (BL, alloc.)', 'Mixed / unknown mode ethanol', 'Full day ethanol when mode is Mixed (not 50/50 B+Syrup)', 'Operation Mode text', 'Done'],
  ['60b', 'Raw Data', 'Overall eff % (OE)', 'FE×DE as %', 'effPercent(oe) or product of FE% & DE% ratios', 'OE', 'Done'],
  [],
  ['N1', 'Note', 'PBI 7DMA DMR_SS24', 'SemanticModel 7DMA measures reference missing table DMR_SS24', 'DigiLog implements 7DMA on Operation Date series in the filtered window', 'Broken in PBI model until DMR_SS24 restored', 'Documented'],
  ['N2', 'Note', 'Data source', 'PBI Excel SharePoint vs DigiLog MySQL', 'Numbers match only if MySQL import equals Excel', 'partition Distillery = Excel Web.Contents', 'Documented'],
  ['N3', 'Note', 'Stock summarizeBy', 'PBI columns default summarizeBy sum for storage', 'DigiLog uses daily values + AVG for stock charts (correct for inventory)', 'Prefer AVERAGE / LAST in PBI visuals', 'Documented'],
];

const aoa = rows.map((r) => (Array.isArray(r) ? r : [r]));
const ws = XLSX.utils.aoa_to_sheet(aoa);
ws['!cols'] = [
  { wch: 6 },
  { wch: 28 },
  { wch: 36 },
  { wch: 55 },
  { wch: 70 },
  { wch: 45 },
  { wch: 14 },
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Section Calculations');

// Second sheet: field mapping
const mapRows = [
  ['PBI column / measure', 'DigiLog field / formula', 'Notes'],
  ['Operation Date', 'Date / dateIso', ''],
  ['Operation Mode', 'operation_mode → mode (None→Mixed)', ''],
  ['Syrup or Molasses Used (Qtls)', 'syrup_molasses_qtls / syrupMolConsumed', ''],
  ['Wash Distilled', 'wash_distilled / totalWash', ''],
  ['TRS', 'trs', ''],
  ['UFS', 'ufs', ''],
  ['Alcohol %', 'alcohol_pct / alcohol', ''],
  ['Actual Ethanol Production (BL)', 'actual_ethanol_bl / totalProd', ''],
  ['AL to BL Ratio (%)', 'al_bl_ratio_pct', 'Not used as chart "Recovery" anymore'],
  ['REC BL', 'rec_bl / recovery', 'Chart recovery line'],
  ['Total BH Molasses…', 'total_bh_molasses_qtls', ''],
  ['Total CH Molasses…', 'total_ch_molasses_qtls', ''],
  ['Total Mol in Store', 'molInStore = BH+CH', 'Calculated column'],
  ['Ethanol in Storage (BL)', 'ethanol_storage_bl / ethInStore', ''],
  ['FS', 'fs = trs−ufs (form)', ''],
  ['FS %', 'fermSugar = (fs/trs)×100', 'PBI stores ratio; DigiLog shows %'],
  ['FE', 'fe → fermEff %', ''],
  ['DE', 'de → distEff %', ''],
  ['OE', 'oe → overallEff %', 'FE×DE'],
  ['Ethanol Prod 7DMA', 'totalProd7dma', ''],
  ['Ethanol Rec 7DMA', 'recovery7dma', 'Available on series'],
  ['Ethanol Store 7DMA', 'ethInStore7dma', ''],
  ['FE 7DMA', 'fermEff7dma', ''],
  ['DE 7DMA', 'distEff7dma', ''],
  ['BMol/CMol Store 7DMA', 'molInStore7dma (combined)', ''],
];
const ws2 = XLSX.utils.aoa_to_sheet(mapRows);
ws2['!cols'] = [{ wch: 36 }, { wch: 42 }, { wch: 40 }];
XLSX.utils.book_append_sheet(wb, ws2, 'PBI Field Map');

XLSX.writeFile(wb, OUT);
console.log('Wrote', OUT);
