/**
 * Import Production House equipment history from the four extract workbooks.
 * Each Equipment row / source sheet becomes one component card (specs + history, no OEM).
 *
 * Usage (from backend/):
 *   node scripts/import-production-house-equipment-history.js
 *   node scripts/import-production-house-equipment-history.js --replace
 */
require('../config/env');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { pool } = require('../config/mysql');
const { formatProductionHouseSpecValue } = require('../utils/productionHouseSpecValue');

const DIR = path.join(__dirname, '..', 'backlog-data', 'production-equipments');

const HOUSES = [
  {
    id: 'pan_crystallizer',
    prefix: 'PH-PAN',
    file: 'ds-pan-crystallizer-equipment-history.xlsx',
  },
  {
    id: 'evaporation',
    prefix: 'PH-EVP',
    file: 'ds-evaporation-equipment-history.xlsx',
  },
  {
    id: 'clarification',
    prefix: 'PH-CLR',
    file: 'ds-clarification-equipment-history.xlsx',
  },
  {
    id: 'centrifugal_drier',
    prefix: 'PH-CEN',
    file: 'ds-centrifugal-drier-equipment-history.xlsx',
  },
];

const REPLACE = process.argv.includes('--replace');

function cellText(cell) {
  if (!cell || cell.value == null || cell.value === '') return '';
  const v = cell.value;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((p) => p.text || '').join('');
    if (v.text) return String(v.text);
    if (v.result != null) return cellText({ value: v.result });
    if (v.hyperlink && v.text) return String(v.text);
  }
  if (typeof v === 'boolean') return v ? 'Yes' : '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(v);
  return String(v);
}

function norm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function headerKey(label) {
  const t = norm(label).toLowerCase();
  if (t === 'sr') return 'sr';
  if (t === 'sheet name' || t === 'sheet') return 'sheetName';
  if (t === 'equipment') return 'equipmentName';
  if (t === 'type') return 'type';
  if (t === 'duty' || t === 'duty / application') return 'duty';
  if (t === 'capacity' || t === 'heating surface / capacity') return 'capacity';
  if (t === 'spec rows') return 'specCount';
  if (t === 'history actions') return 'historyCount';
  if (t === 'sn') return 'sn';
  if (t === 'parameter') return 'parameter';
  if (t === 'uom') return 'uom';
  if (t === 'value') return 'value';
  if (t === 'section header') return 'isSection';
  if (t === 'season') return 'season';
  if (t === 'year') return 'year';
  if (t === 'action no.' || t === 'action no') return 'actionNo';
  if (t === 'action taken') return 'action';
  return null;
}

function sheetToRows(ws) {
  const headerMap = {};
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell, col) => {
    const key = headerKey(cellText(cell));
    if (key) headerMap[col] = key;
  });
  const rows = [];
  for (let r = 2; r <= (ws.rowCount || 0); r++) {
    const row = ws.getRow(r);
    const obj = {};
    let any = false;
    for (const [col, key] of Object.entries(headerMap)) {
      const val = norm(cellText(row.getCell(Number(col))));
      obj[key] = val;
      if (val) any = true;
    }
    if (any) rows.push(obj);
  }
  return rows;
}

function isSectionRow(value) {
  const t = String(value || '').trim().toLowerCase();
  return t === 'yes' || t === 'true' || t === '1' || t === 'y';
}

function specValue(parameter, uom, value) {
  const val = norm(value);
  const unit = norm(uom);
  let combined;
  if (!unit) combined = val;
  else if (val.toLowerCase().includes(unit.toLowerCase())) combined = val;
  else if (!val) combined = unit;
  else combined = `${val} ${unit}`;
  return formatProductionHouseSpecValue(combined);
}

function normalizeSeason(season) {
  const t = norm(season);
  if (!t) return null;
  if (/off[\s-]*se/i.test(t)) return 'Off-Season';
  if (/^se/i.test(t)) return 'Season';
  return t;
}

/** Merge multiple extract rows that share the same year (as in source sheets). */
function combineHistoryByYear(rows) {
  const groups = new Map();
  const order = [];
  for (const h of rows) {
    const act = norm(h.action);
    if (!act) continue;
    const year = norm(h.year);
    const season = normalizeSeason(h.season) || '';
    const key = `${season}\0${year}`;
    if (!groups.has(key)) {
      groups.set(key, {
        season: normalizeSeason(h.season),
        year: year || null,
        actions: [],
      });
      order.push(key);
    }
    groups.get(key).actions.push(act);
  }
  return order.map((key) => {
    const g = groups.get(key);
    return {
      season: g.season,
      year: g.year,
      action: g.actions.join('\n'),
    };
  });
}

function findSheet(wb, name) {
  const want = name.toLowerCase();
  return wb.worksheets.find((ws) => String(ws.name || '').trim().toLowerCase() === want);
}

async function loadWorkbook(filePath) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const eqSheet = findSheet(wb, 'Equipment');
  const specSheet = findSheet(wb, 'Equipment Specification');
  const histSheet = findSheet(wb, 'Equipment Maintenance History');
  if (!eqSheet || !specSheet || !histSheet) {
    throw new Error(`Missing expected sheets in ${path.basename(filePath)}`);
  }
  return {
    equipment: sheetToRows(eqSheet),
    specs: sheetToRows(specSheet),
    history: sheetToRows(histSheet),
  };
}

async function importHouse(conn, house, data) {
  const specsByName = new Map();
  for (const row of data.specs) {
    const name = row.equipmentName;
    if (!name) continue;
    if (!specsByName.has(name)) specsByName.set(name, []);
    specsByName.get(name).push(row);
  }
  const histByName = new Map();
  for (const row of data.history) {
    const name = row.equipmentName;
    if (!name) continue;
    if (!histByName.has(name)) histByName.set(name, []);
    histByName.get(name).push(row);
  }

  let inserted = 0;
  let specCount = 0;
  let histCount = 0;

  for (let i = 0; i < data.equipment.length; i++) {
    const eq = data.equipment[i];
    const name = eq.equipmentName || eq.sheetName;
    if (!name) continue;
    const sheetName = eq.sheetName || name;
    const equipNo = `${house.prefix}-${String(i + 1).padStart(3, '0')}`;

    const [result] = await conn.execute(
      `INSERT INTO phn_equipment
         (house_section, sheet_name, equip_no, name, type, duty, capacity, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        house.id,
        sheetName.slice(0, 120),
        equipNo,
        name.slice(0, 300),
        (eq.type || null)?.slice?.(0, 100) || eq.type || null,
        (eq.duty || null)?.slice?.(0, 200) || eq.duty || null,
        (eq.capacity || null)?.slice?.(0, 100) || eq.capacity || null,
        i,
      ]
    );
    const equipId = result.insertId;
    inserted += 1;

    const specRows = specsByName.get(name) || specsByName.get(sheetName) || [];
    let sort = 0;
    for (const spec of specRows) {
      if (isSectionRow(spec.isSection)) continue;
      const lbl = norm(spec.parameter);
      if (!lbl) continue;
      const val = specValue(lbl, spec.uom, spec.value);
      await conn.execute(
        `INSERT INTO phn_specs (equip_id, section, sub_section, lbl, val, sort_order)
         VALUES (?, 'mechanical', ?, ?, ?, ?)`,
        [equipId, name.slice(0, 200), lbl.slice(0, 500), val, sort]
      );
      sort += 1;
      specCount += 1;
    }

    const histRows = histByName.get(name) || histByName.get(sheetName) || [];
    for (const h of combineHistoryByYear(histRows)) {
      await conn.execute(
        `INSERT INTO phn_history (equip_id, section, sub_section, season, year, act)
         VALUES (?, 'mechanical', ?, ?, ?, ?)`,
        [
          equipId,
          name.slice(0, 200),
          h.season,
          h.year,
          h.action,
        ]
      );
      histCount += 1;
    }
  }

  return { inserted, specCount, histCount };
}

async function main() {
  console.log(`Importing Production House equipment history${REPLACE ? ' (--replace)' : ''}...`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (REPLACE) {
      await conn.query('DELETE FROM phn_history');
      await conn.query('DELETE FROM phn_specs');
      await conn.query('DELETE FROM phn_equipment');
      console.log('  Cleared existing phn_* rows');
    }

    const totals = { inserted: 0, specCount: 0, histCount: 0 };

    for (const house of HOUSES) {
      const filePath = path.join(DIR, house.file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing extract: ${filePath}`);
      }
      if (!REPLACE) {
        const [[{ n }]] = await conn.query(
          'SELECT COUNT(*) AS n FROM phn_equipment WHERE house_section = ?',
          [house.id]
        );
        if (n > 0) {
          console.log(`  Skip ${house.id}: ${n} cards already present (use --replace)`);
          continue;
        }
      }
      const data = await loadWorkbook(filePath);
      const result = await importHouse(conn, house, data);
      totals.inserted += result.inserted;
      totals.specCount += result.specCount;
      totals.histCount += result.histCount;
      console.log(
        `  ${house.id}: ${result.inserted} cards, ${result.specCount} specs, ${result.histCount} history`
      );
    }

    await conn.commit();
    console.log(
      `\nDone. ${totals.inserted} cards, ${totals.specCount} specs, ${totals.histCount} history actions.`
    );
  } catch (err) {
    await conn.rollback();
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
