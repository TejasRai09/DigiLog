/**
 * Purchy Excel row mappers (Power BI Power Query parity).
 * Use purchyExcelStream.js for large workbooks — streams one sheet at a time.
 */
const fs = require('fs');
const XLSX = require('xlsx');

const SHEET_NAMES = {
  summary: 'Grower  Wise summary ',
  indent: 'Grower Purchy wise Indent',
  supply: 'Grower Indent Purchy wise suppl',
  dishonour: 'Grower Purchy wise Indent Faile',
  staff: 'Main',
};

/** Power BI uses "Main"; uploads may use Sheet1 / Field Staff exports. */
const STAFF_SHEET_ALIASES = new Set([
  'main',
  'sheet1',
  'field staff',
  'field-staff',
  'staff',
  'staff main',
]);

function isStaffSheetName(name) {
  return STAFF_SHEET_ALIASES.has(String(name || '').trim().toLowerCase());
}

function resolveStaffSheetName(sheetNames) {
  const names = sheetNames || [];
  const primary = names.find((n) => n === SHEET_NAMES.staff);
  if (primary) return primary;
  const alias = names.find((n) => isStaffSheetName(n));
  if (alias) return alias;
  return null;
}

function noopProgress() {}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function int(v) {
  const n = num(v);
  return n === null ? null : Math.trunc(n);
}

function str(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function parsePurchaseModeQty(purchasemodename) {
  const name = str(purchasemodename);
  if (!name) return null;
  const space = name.indexOf(' ');
  if (space <= 0) return null;
  return num(name.slice(0, space));
}

function formatDateParts(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Excel serial (days since 1899-12-30) → JS Date (local calendar). */
function excelSerialToDate(serial) {
  const days = Math.floor(Number(serial));
  if (!Number.isFinite(days)) return null;
  const epoch = new Date(1899, 11, 30);
  let offset = days;
  if (offset >= 60) offset -= 1; // Excel 1900 leap-year bug
  return new Date(epoch.getTime() + offset * 86400000);
}

function isPlausiblePurchyYear(y) {
  return y >= 1990 && y <= 2035;
}

function parseDate(v) {
  if (v === null || v === undefined || v === '') return null;

  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v > 30000 && v < 60000) {
      const d = excelSerialToDate(v);
      return d && isPlausiblePurchyYear(d.getFullYear()) ? formatDateParts(d) : null;
    }
    return null;
  }

  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    if (!isPlausiblePurchyYear(y)) {
      // ExcelJS sometimes treats serial 46111 as year 46111 AD
      if (y > 2035 && y < 60000) {
        const d = excelSerialToDate(y);
        return d && isPlausiblePurchyYear(d.getFullYear()) ? formatDateParts(d) : null;
      }
      return null;
    }
    return formatDateParts(v);
  }

  const s = String(v).trim();
  if (!s) return null;

  const asNum = Number(s);
  if (Number.isFinite(asNum) && asNum > 30000 && asNum < 60000 && !/[-/]/.test(s)) {
    const d = excelSerialToDate(asNum);
    return d && isPlausiblePurchyYear(d.getFullYear()) ? formatDateParts(d) : null;
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  if (!isPlausiblePurchyYear(d.getFullYear())) return null;
  return formatDateParts(d);
}

/** Normalize ExcelJS / CSV cell values. */
function cellRaw(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.result !== undefined && v.result !== null) return v.result;
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join('');
    if (v.text !== undefined) return v.text;
    if (v.hyperlink) return v.text ?? v.hyperlink;
  }
  return v;
}

function mapGrowerSummaryRow(r, seen) {
  const villageCode = int(r['Village Code']);
  const growerCode = int(r['Grower Code']);
  if (villageCode === null || growerCode === null) return null;
  const key = `${villageCode}-${growerCode}`;
  if (seen.has(key)) return null;
  seen.add(key);
  return {
    village_code: villageCode,
    grower_code: growerCode,
    grower_name: str(r['Grower Name']),
    grower_father_name: str(r['Grower Father Name']),
    village_name: str(r['Village Name']),
    centre_code: int(r['Centre Code']),
    centre_name: str(r['Centre Name']),
    supply_centre_code: int(r['Supply Centre Code']),
    supply_centre_name: str(r['Supply Centre Name']),
    society_code: int(r['Society Code']),
    society_name: str(r['Society Name']),
    cul_area: num(r['Cul Area']),
    survey_area: num(r['Survey Area']),
    bond_area: num(r['Bond Area']),
    basic_quota: int(r['Basic Quota']),
    bonding: int(r.Bonding),
    ad_bonding: int(r['Ad Bonding']),
    total_bond: int(r['Total Bond']),
    no_of_purchy_indent: int(r['No of Purchy Indent']),
    indent_qty: int(r['Indent QTY']),
    no_of_weight_purchy: int(r['No of Weight Purchy']),
    weight_qty_2025: num(r['Weight Qty 2025']),
    supply_2024: num(r['Supply 2024']),
    supply_2023: num(r['Supply 2023']),
    supply_2022: num(r['Supply 2022']),
    supply_2021: num(r['Supply 2021']),
    supply_2020: num(r['Supply 2020']),
    no_of_balance_purchy: int(r['No of Balance purchy']),
    balance_indent_qty: num(r['Balance Indent Qty']),
    no_of_indent_failer_purchy: int(r['No of Indent Failer purchy']),
    indent_failer_qty: int(r['Indent Failer QTY']),
    issue24: int(r.issue24),
    indqty24: int(r.indqty24),
    wt24: int(r.wt24),
    supp2024: num(r.supp2024),
    bquota2024: int(r.BQUOTA2024),
    bond2024: num(r.bond2024),
    issue23: int(r.issue23),
    indqty23: int(r.indqty23),
    wt23: int(r.wt23),
    supp2023: num(r.supp2023),
    bquota2023: int(r.BQUOTA2023),
    bond2023: num(r.bond2023),
    issue22: int(r.issue22),
    indqty22: int(r.indqty22),
    wt22: int(r.wt22),
    supp2022: num(r.supp2022),
    bquota2022: int(r.BQUOTA2022),
    bond2022: num(r.bond2022),
    issue21: int(r.issue21),
    indqty21: int(r.indqty21),
    wt21: int(r.wt21),
    supp2021: num(r.supp2021),
    bquota2021: int(r.BQUOTA2021),
    bond2021: int(r.bond2021),
    standing_bond: str(r['StandingBond '] ?? r.StandingBond),
  };
}

function mapIndentRow(r) {
  const villagecode = int(r.Villagecode);
  const growercode = int(r.GrowerCode);
  if (villagecode === null || growercode === null) return null;
  return {
    villagecode,
    growercode,
    growername: str(r.Growername),
    growerfather: str(r.Growerfather),
    villagename: str(r.Villagename),
    societyname: str(r.societyname),
    supplycentre: int(r.supplyCentre),
    supplycentrename: str(r.Supplycentrename),
    societypurchy_no: str(r.societypurchyNo),
    issuedate: parseDate(r.Issuedate),
    supplydate: parseDate(r.SupplyDate),
    varietytype: str(r.Varietytype),
    supllymodeqty: int(r.supllymodeqty),
    supplymodecode: int(r.supplymodecode),
    supplymodename: str(r.Supplymodename),
  };
}

function mapSupplyRow(r) {
  const villagecode = int(r.VillageCode);
  const growercode = int(r.growerCode);
  if (villagecode === null || growercode === null) return null;
  return {
    villagecode,
    growercode,
    growername: str(r.growername),
    growerfather: str(r.growerfather),
    villagename: str(r.villagename),
    purchsecentre: int(r.purchsecentre),
    purchsecentrename: str(r.purchsecentrename),
    supplycentrecode: int(r.supplycentrecode),
    supplycentrename: str(r.supplycentrename),
    societypurchy_no: str(r.SocietyPurchyNo),
    supplydate: parseDate(r.Supplydate),
    millpurchy_no: str(r.millPurchyNo),
    purchasedate: parseDate(r.purchasedate),
    purchasemodecode: int(r.purchasemodecode),
    purchasemodename: str(r.purchasemodename),
    varietytype: str(r.Varietytype),
    varietycode: int(r.varietycode),
    varietyname: str(r.varietyname),
    grossweight: num(r.Grossweight),
    tareweight: num(r.Tareweight),
    joonaweight: num(r.Joonaweight),
    netwt: num(r.NetWt),
    societycode: int(r.societycode),
    societyname: str(r.societyname),
    purchasemodeqty: parsePurchaseModeQty(r.purchasemodename) ?? num(r.purchasemodeqty),
  };
}

function mapDishonourRow(r) {
  const mapped = {
    sl_no: int(r['Sl No.']),
    village_code: int(r['Village Code']),
    grower_code: int(r['Grower Code']),
    grower_name: str(r['Grower Name']),
    grower_father_name: str(r['Grower Father Name']),
    society_name: str(r['Society Name']),
    center_name: str(r['Center Name']),
    village_name: str(r['Village Name']),
    mobile_no: int(r['Mobile No']),
    issue_date: parseDate(r['Issue Date']),
    purchase_date: parseDate(r['Purchase Date']),
    society_purchy_no: str(r['Society Purchy No']),
    mode_qty: int(r['Mode QTY']),
    purchasemodecode: int(r.purchasemodecode),
    purchasemodename: str(r.purchasemodename),
    remarks: str(r.Remarks),
  };
  const vals = Object.values(mapped).filter((v) => v !== null && v !== '');
  return vals.length > 0 ? mapped : null;
}

function mapFieldStaffRow(r) {
  const village_code = int(r['Village Code']);
  if (village_code === null) return null;
  return {
    village_code,
    village_name: str(r['Village Name']),
    village_staff: str(r['Village Staff']),
    zonal_incharge: str(r['Zonal Incharge']),
    zonal_manager: str(r['Zonal Manager']),
    region: str(r.Region),
    zone_head: str(r['Zone Head']),
    sum_of_survey_area: num(r['Sum of SurveyArea']),
    bonding_area: num(r.BondingArea),
    basic_quota: int(r.BasicQuota),
    bonding: int(r[' Bonding'] ?? r.Bonding),
    additinalbond: int(r.Additinalbond),
    yield_per_ha: int(r['Yield per Ha.']),
    drwal_per_ha: num(r['Drwal per ha.']),
    target_estimated_cane_availbility: num(r['Target Estimated Cane availbility']),
  };
}

const SHEET_KEY_BY_NAME = Object.fromEntries(
  Object.entries(SHEET_NAMES).map(([key, name]) => [name, key]),
);

/** @deprecated Use streamGrowerWorkbook from purchyExcelStream.js for large files. */
function loadGrowerWorkbook(filePath, onProgress = noopProgress) {
  const stat = fs.statSync(filePath);
  onProgress('file_start', {
    path: filePath,
    sizeMb: (stat.size / (1024 * 1024)).toFixed(1),
  });
  onProgress('workbook_read_start', {});
  const wb = XLSX.readFile(filePath, { cellDates: true });
  onProgress('workbook_read_done', { sheets: wb.SheetNames.length, names: wb.SheetNames });

  const summarySeen = new Set();
  const summaryRows = XLSX.utils.sheet_to_json(wb.Sheets[SHEET_NAMES.summary], { defval: null, raw: false });
  const summary = summaryRows.map((r) => mapGrowerSummaryRow(r, summarySeen)).filter(Boolean);

  const indent = XLSX.utils.sheet_to_json(wb.Sheets[SHEET_NAMES.indent], { defval: null, raw: false })
    .map(mapIndentRow).filter(Boolean);
  const supply = XLSX.utils.sheet_to_json(wb.Sheets[SHEET_NAMES.supply], { defval: null, raw: false })
    .map(mapSupplyRow).filter(Boolean);
  const dishonour = XLSX.utils.sheet_to_json(wb.Sheets[SHEET_NAMES.dishonour], { defval: null, raw: false })
    .map(mapDishonourRow).filter(Boolean);

  onProgress('workbook_parse_done', {
    summary: summary.length,
    indent: indent.length,
    supply: supply.length,
    dishonour: dishonour.length,
  });
  return { summary, indent, supply, dishonour };
}

function loadStaffWorkbook(filePath, onProgress = noopProgress) {
  onProgress('file_start', {
    path: filePath,
    sizeMb: (fs.statSync(filePath).size / (1024 * 1024)).toFixed(1),
  });
  onProgress('workbook_read_start', {});
  const wb = XLSX.readFile(filePath, { cellDates: true });
  onProgress('workbook_read_done', { sheets: wb.SheetNames.length });
  const staffSheetName = resolveStaffSheetName(wb.SheetNames);
  const sheet = staffSheetName ? wb.Sheets[staffSheetName] : null;
  if (!sheet) {
    throw new Error(`Staff sheet not found. Expected "${SHEET_NAMES.staff}" or one of: ${[...STAFF_SHEET_ALIASES].join(', ')}`);
  }
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  const withoutLast = raw.slice(0, -1);
  const headers = withoutLast[0];
  const result = withoutLast.slice(1).map((row) => {
    const r = {};
    headers.forEach((h, i) => { if (h) r[h] = row[i]; });
    return mapFieldStaffRow(r);
  }).filter(Boolean);
  onProgress('parse_done', { sheet: 'Staff Main', rows: result.length });
  return result;
}

module.exports = {
  SHEET_NAMES,
  STAFF_SHEET_ALIASES,
  isStaffSheetName,
  resolveStaffSheetName,
  SHEET_KEY_BY_NAME,
  num,
  int,
  str,
  parseDate,
  cellRaw,
  mapGrowerSummaryRow,
  mapIndentRow,
  mapSupplyRow,
  mapDishonourRow,
  mapFieldStaffRow,
  loadGrowerWorkbook,
  loadStaffWorkbook,
};
