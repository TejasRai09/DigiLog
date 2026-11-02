const xlsx = require('xlsx');
const { ColumnValidationError } = require('../../utils/excelColumnValidation');
const { excelDateToISO } = require('../../utils/excelDateUtils');
const { seasonLabelForDate } = require('./centreIndentPurchaseMeta');

/**
 * Normalizes header string to lowercase alphanumeric characters only.
 * E.g., "Qty in Qtls." -> "qtyinqtls", "c_Code" -> "ccode", "No. of Purchy" -> "noofpurchy".
 */
function normalizeHeader(str) {
  if (str == null) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Field definitions and aliases for Indent sheet */
const INDENT_FIELD_DEFS = {
  code: {
    name: 'code',
    label: 'Code / Center Code',
    required: true,
    aliases: ['code', 'ccode', 'centercode', 'centrecode', 'cnamecode', 'centercd', 'centrecd', 'centerno'],
  },
  center_name: {
    name: 'center_name',
    label: 'Center Name',
    required: true,
    aliases: ['centername', 'centrename', 'center', 'centre', 'cname', 'centerdesc', 'centredesc'],
  },
  indent_date: {
    name: 'indent_date',
    label: 'Indent Date',
    required: true,
    aliases: ['indentdate', 'indentdt', 'indentationdate', 'indentday', 'date'],
  },
  no_of_purchy: {
    name: 'no_of_purchy',
    label: 'No of Purchy',
    required: true,
    aliases: [
      'noofpurchy',
      'noofpurchies',
      'purchycount',
      'purchiescount',
      'purchy',
      'purchies',
      'nopurchy',
      'purchyno',
      'purchyquantity',
      'totalpurchy',
      'purchiesno',
    ],
  },
  indent_qty: {
    name: 'indent_qty',
    label: 'Indent Quantity (Qty in Qtls)',
    required: true,
    aliases: [
      'qtyinqtls',
      'indentqty',
      'indentquantity',
      'qtyinqtl',
      'qtyinquintals',
      'qtyinquintal',
      'qtyqtls',
      'quantityinqtls',
      'indentweight',
      'qty',
      'quantity',
      'caneqty',
    ],
  },
  category: {
    name: 'category',
    label: 'Category / Variety',
    required: true,
    aliases: ['category', 'canecategory', 'variety', 'varietytype', 'varietyname', 'canevariety'],
  },
  unique_id: {
    name: 'unique_id',
    label: 'Unique ID',
    required: false,
    aliases: ['uniqueid', 'uniquecode', 'uid'],
  },
  bonding_id: {
    name: 'bonding_id',
    label: 'Bonding Id',
    required: false,
    aliases: ['bondingid', 'bondid', 'bid'],
  },
  season_label: {
    name: 'season_label',
    label: 'Season Label',
    required: false,
    aliases: ['seasonlabelindent', 'seasonlabel', 'season', 'seasonname'],
  },
};

/** Field definitions and aliases for Purchase sheet */
const PURCHASE_FIELD_DEFS = {
  code: {
    name: 'code',
    label: 'Center Code (c_Code)',
    required: true,
    aliases: ['ccode', 'code', 'centercode', 'centrecode', 'cnamecode', 'centercd', 'centrecd', 'centerno'],
  },
  center_name: {
    name: 'center_name',
    label: 'Center Name (Center)',
    required: true,
    aliases: ['center', 'centre', 'centername', 'centrename', 'cname', 'centerdesc', 'centredesc'],
  },
  purchase_date: {
    name: 'purchase_date',
    label: 'Purchase Date',
    required: true,
    // Specific aliases first; fallback to generic 'date' handled after
    aliases: ['purchasedate', 'purchdate', 'purchasedt', 'purchdt', 'purchaseddate', 'date'],
  },
  no_of_purchy: {
    name: 'no_of_purchy',
    label: 'No of Purchy',
    required: true,
    aliases: [
      'noofpurchy',
      'noofpurchies',
      'purchycount',
      'purchiescount',
      'purchy',
      'purchies',
      'nopurchy',
      'purchyno',
      'purchyquantity',
      'totalpurchy',
      'purchiesno',
    ],
  },
  purchase_qty: {
    name: 'purchase_qty',
    label: 'Purchase Quantity (Qty in Qtls)',
    required: true,
    aliases: [
      'qtyinqtls',
      'purchaseqty',
      'purchasequantity',
      'qtyinqtl',
      'qtyinquintals',
      'qtyinquintal',
      'qtyqtls',
      'quantityinqtls',
      'purchaseweight',
      'weightqty',
      'qty',
      'quantity',
      'caneqty',
    ],
  },
  category: {
    name: 'category',
    label: 'Category / Variety',
    required: true,
    aliases: ['category', 'canecategory', 'variety', 'varietytype', 'varietyname', 'canevariety'],
  },
  indent_date: {
    name: 'indent_date',
    label: 'Indent Date (Optional in Purchase)',
    required: false,
    aliases: ['indentdate', 'indentdt', 'indentationdate'],
  },
  unique_id: {
    name: 'unique_id',
    label: 'Unique ID',
    required: false,
    aliases: ['uniqueid', 'uniquecode', 'uid'],
  },
  season_label: {
    name: 'season_label',
    label: 'Season Label',
    required: false,
    aliases: ['seasonlabelpurchase', 'seasonlabel', 'season', 'seasonname'],
  },
};

/**
 * Searches the first rows of a matrix to find the header row and maps each canonical field
 * to its column index regardless of column ordering or header capitalization.
 */
function findHeaderAndColumnMap(matrix, fieldDefs, sheetLabel = 'sheet') {
  if (!matrix || !matrix.length) {
    throw new ColumnValidationError(`Sheet "${sheetLabel}" is empty.`);
  }

  let bestHeaderIndex = -1;
  let bestColMap = null;
  let bestMatchedCount = -1;

  // Scan up to first 15 rows to find the row that matches the most required fields
  const maxScan = Math.min(15, matrix.length);
  for (let r = 0; r < maxScan; r += 1) {
    const rawRow = matrix[r] || [];
    if (!rawRow.some((c) => c != null && String(c).trim() !== '')) continue;

    const normalizedCols = rawRow.map((c) => normalizeHeader(c));
    const colMap = {};
    const usedColIndexes = new Set();
    let requiredMatched = 0;

    // First pass: match specific aliases
    for (const [fieldKey, def] of Object.entries(fieldDefs)) {
      for (const alias of def.aliases) {
        const foundIdx = normalizedCols.findIndex(
          (c, idx) => c === alias && !usedColIndexes.has(idx),
        );
        if (foundIdx !== -1) {
          colMap[fieldKey] = foundIdx;
          usedColIndexes.add(foundIdx);
          if (def.required) requiredMatched += 1;
          break;
        }
      }
    }

    if (requiredMatched > bestMatchedCount) {
      bestMatchedCount = requiredMatched;
      bestHeaderIndex = r;
      bestColMap = colMap;
    }
  }

  const requiredFields = Object.values(fieldDefs).filter((d) => d.required);
  const missing = [];
  for (const def of requiredFields) {
    if (bestColMap == null || bestColMap[def.name] == null) {
      missing.push(def.label);
    }
  }

  if (missing.length > 0) {
    const headerRow = matrix[bestHeaderIndex >= 0 ? bestHeaderIndex : 0] || [];
    const foundHeaders = headerRow
      .map((c) => (c == null ? '' : String(c).trim()))
      .filter(Boolean)
      .join(', ');

    throw new ColumnValidationError(
      `Missing required columns in ${sheetLabel} (${missing.length}): ${missing.join(', ')}. ` +
      `Found headers: [${foundHeaders || 'none'}]. Columns can be in any order, but valid names must be present.`,
      { missing, foundHeaders },
    );
  }

  return {
    headerRowIndex: bestHeaderIndex,
    colMap: bestColMap,
    actualHeaders: matrix[bestHeaderIndex] || [],
  };
}

/**
 * Automatically detects which sheet is Indent and which is Purchase in a multi-sheet workbook,
 * even if sheets are reordered or named differently.
 */
function resolveIndentAndPurchaseSheets(wb) {
  const sheetNames = wb.SheetNames || [];
  if (sheetNames.length < 2) {
    throw new Error(
      `Workbook must have at least 2 sheets (found ${sheetNames.length}: ${sheetNames.join(', ') || 'none'}). ` +
      'One sheet must contain indent data and one sheet must contain purchase data.',
    );
  }

  let indentSheet = null;
  let purchaseSheet = null;

  // 1. Check sheet names for "indent" and "purch" keywords
  for (const name of sheetNames) {
    const lower = name.toLowerCase().trim();
    if (!indentSheet && lower.includes('indent')) {
      indentSheet = name;
    } else if (!purchaseSheet && (lower.includes('purch') || lower.includes('purc'))) {
      purchaseSheet = name;
    }
  }

  if (indentSheet && purchaseSheet && indentSheet !== purchaseSheet) {
    return { indentSheet, purchaseSheet };
  }

  // 2. Score sheets based on matching headers
  const indentScores = {};
  const purchaseScores = {};

  for (const name of sheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    let maxInd = 0;
    let maxPur = 0;

    for (let r = 0; r < Math.min(6, matrix.length); r += 1) {
      const row = (matrix[r] || []).map(normalizeHeader);
      let indCount = 0;
      let purCount = 0;
      for (const def of Object.values(INDENT_FIELD_DEFS)) {
        if (def.aliases.some((a) => row.includes(a))) indCount += 1;
      }
      for (const def of Object.values(PURCHASE_FIELD_DEFS)) {
        if (def.aliases.some((a) => row.includes(a))) purCount += 1;
      }
      if (indCount > maxInd) maxInd = indCount;
      if (purCount > maxPur) maxPur = purCount;
    }

    indentScores[name] = maxInd;
    purchaseScores[name] = maxPur;
  }

  const sortedForIndent = [...sheetNames].sort((a, b) => (indentScores[b] || 0) - (indentScores[a] || 0));
  const candidateIndent = sortedForIndent[0];

  const sortedForPurchase = [...sheetNames].filter((n) => n !== candidateIndent).sort((a, b) => (purchaseScores[b] || 0) - (purchaseScores[a] || 0));
  const candidatePurchase = sortedForPurchase[0];

  if (candidateIndent && candidatePurchase && (indentScores[candidateIndent] >= 3 || purchaseScores[candidatePurchase] >= 3)) {
    return { indentSheet: candidateIndent, purchaseSheet: candidatePurchase };
  }

  // 3. Fallback to default index 0 for indent and index 1 for purchase
  return {
    indentSheet: sheetNames[0],
    purchaseSheet: sheetNames[1],
  };
}

function strVal(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s || null;
}

function numVal(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function intVal(v) {
  if (v == null || v === '') return 0;
  const n = parseInt(String(v).replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Maps a single row array into the normalized Indent row object using the column index map.
 */
function mapIndentRowFromMatrix(row, colMap, seasonMappings = []) {
  const indent_date = excelDateToISO(row[colMap.indent_date]);
  return {
    code: strVal(row[colMap.code]),
    center_name: strVal(row[colMap.center_name]),
    indent_date,
    no_of_purchy: intVal(row[colMap.no_of_purchy]),
    indent_qty: numVal(row[colMap.indent_qty]),
    category: strVal(row[colMap.category]),
    unique_id: colMap.unique_id != null ? strVal(row[colMap.unique_id]) : null,
    bonding_id: colMap.bonding_id != null ? strVal(row[colMap.bonding_id]) : null,
    season_label:
      (colMap.season_label != null ? strVal(row[colMap.season_label]) : null) ||
      seasonLabelForDate(indent_date, seasonMappings),
  };
}

/**
 * Maps a single row array into the normalized Purchase row object using the column index map.
 */
function mapPurchaseRowFromMatrix(row, colMap, seasonMappings = []) {
  const purchase_date = excelDateToISO(row[colMap.purchase_date]);
  const indent_date = colMap.indent_date != null ? excelDateToISO(row[colMap.indent_date]) : null;
  return {
    code: strVal(row[colMap.code]),
    center_name: strVal(row[colMap.center_name]),
    purchase_date,
    indent_date,
    no_of_purchy: intVal(row[colMap.no_of_purchy]),
    purchase_qty: numVal(row[colMap.purchase_qty]),
    category: strVal(row[colMap.category]),
    unique_id: colMap.unique_id != null ? strVal(row[colMap.unique_id]) : null,
    season_label:
      (colMap.season_label != null ? strVal(row[colMap.season_label]) : null) ||
      seasonLabelForDate(purchase_date, seasonMappings),
  };
}

module.exports = {
  normalizeHeader,
  INDENT_FIELD_DEFS,
  PURCHASE_FIELD_DEFS,
  findHeaderAndColumnMap,
  resolveIndentAndPurchaseSheets,
  mapIndentRowFromMatrix,
  mapPurchaseRowFromMatrix,
  strVal,
  numVal,
  intVal,
};

