/**
 * Build power_equipment_comparison.csv and .xlsx — old card vs new hierarchy.
 *
 * Usage (from backend/):
 *   node scripts/generate-power-equipment-comparison.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('xlsx');

const ROOT = path.join(__dirname, '..', '..');
const OUT_CSV = path.join(ROOT, 'power_equipment_comparison.csv');
const OUT_XLSX = path.join(ROOT, 'power_equipment_comparison.xlsx');

const SQL_FILES = [
  'mysql/migrate_power_equipment_zil_catalog.sql',
  'mysql/migrate_power_equipment_150tph_mov_catalog.sql',
  'mysql/migrate_power_equipment_stg_mov_catalog.sql',
  'mysql/migrate_power_equipment_instrument_150tph.sql',
];

const HIERARCHY_FILE = path.join(ROOT, 'frontend/src/config/powerPlantEquipmentHierarchy.js');

const HEADERS = ['bucket', 'dept', 'equip_no', 'name', 'hierarchy_path', 'display_label'];

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function loadOldEquipment() {
  const records = [];
  const re = /SELECT\s+'([^']+)'\s*(?:AS\s+\w+)?\s*,\s*'([^']+)'\s*(?:AS\s+\w+)?\s*,\s*'((?:[^'\\]|\\.)*)'/gi;

  for (const rel of SQL_FILES) {
    const sql = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    let m;
    while ((m = re.exec(sql)) !== null) {
      const dept = m[1];
      if (!['electrical', 'instrument', 'instrument2'].includes(dept)) continue;
      records.push({ dept, equip_no: m[2], name: m[3] });
    }
  }

  return records;
}

function loadHierarchyRoot() {
  const src = fs.readFileSync(HIERARCHY_FILE, 'utf8');
  const trimmed = src
    .replace(/export const POWER_PLANT_EQUIPMENT_ROOT = /, 'const POWER_PLANT_EQUIPMENT_ROOT = ')
    .replace(/\n\/\*\* Assign stable ids[\s\S]*$/m, '');

  const context = { module: { exports: {} } };
  vm.createContext(context);
  vm.runInContext(`${trimmed}\nmodule.exports.ROOT = POWER_PLANT_EQUIPMENT_ROOT;`, context);
  return context.module.exports.ROOT;
}

function walkHierarchy(node, pathParts, mapped, unmapped) {
  const children = node.children ?? [];
  if (children.length === 0) {
    const hierarchyPath = pathParts.join(' > ');
    if (node.equipNo) {
      mapped.push({
        hierarchyPath,
        displayLabel: node.name,
        equip_no: node.equipNo,
        lookupName: node.lookupName ?? node.name,
      });
    } else {
      unmapped.push({ hierarchyPath, displayLabel: node.name });
    }
    return;
  }
  for (const child of children) {
    walkHierarchy(child, [...pathParts, child.name], mapped, unmapped);
  }
}

function lookupKey(equipNo, name) {
  return `${equipNo}\0${name}`;
}

function buildRows() {
  const oldRecords = loadOldEquipment();
  const root = loadHierarchyRoot();

  const mapped = [];
  const unmapped = [];
  walkHierarchy(root, [root.name], mapped, unmapped);

  const mappedKeys = new Set(mapped.map((m) => lookupKey(m.equip_no, m.lookupName)));
  const pathsByLookup = new Map();
  for (const m of mapped) {
    const key = lookupKey(m.equip_no, m.lookupName);
    const list = pathsByLookup.get(key) ?? [];
    list.push(m.hierarchyPath);
    pathsByLookup.set(key, list);
  }

  const shared = [];
  const oldOnly = [];

  for (const rec of oldRecords) {
    const key = lookupKey(rec.equip_no, rec.name);
    if (mappedKeys.has(key)) {
      shared.push(rec);
    } else {
      oldOnly.push(rec);
    }
  }

  shared.sort((a, b) => a.dept.localeCompare(b.dept) || a.equip_no.localeCompare(b.equip_no) || a.name.localeCompare(b.name));
  oldOnly.sort((a, b) => a.dept.localeCompare(b.dept) || a.equip_no.localeCompare(b.equip_no) || a.name.localeCompare(b.name));
  unmapped.sort((a, b) => a.hierarchyPath.localeCompare(b.hierarchyPath));

  const rows = [];

  for (const rec of shared) {
    const key = lookupKey(rec.equip_no, rec.name);
    rows.push([
      'shared',
      rec.dept,
      rec.equip_no,
      rec.name,
      (pathsByLookup.get(key) ?? []).join(' | '),
      '',
    ]);
  }

  for (const rec of oldOnly) {
    rows.push(['old_only', rec.dept, rec.equip_no, rec.name, '', '']);
  }

  for (const item of unmapped) {
    rows.push(['new_only', '', '', '', item.hierarchyPath, item.displayLabel]);
  }

  return {
    rows,
    counts: {
      shared: shared.length,
      oldOnly: oldOnly.length,
      newOnly: unmapped.length,
      oldTotal: oldRecords.length,
      hierarchyMapped: mapped.length,
      hierarchyTotal: mapped.length + unmapped.length,
    },
  };
}

function writeCsv(rows) {
  const lines = [HEADERS.map(csvEscape).join(',')];
  for (const r of rows) {
    lines.push(r.map(csvEscape).join(','));
  }
  fs.writeFileSync(OUT_CSV, `${lines.join('\n')}\n`, 'utf8');
}

function writeXlsx(rows, counts) {
  const wb = XLSX.utils.book_new();

  const comparison = [HEADERS, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(comparison);
  ws['!cols'] = [
    { wch: 10 },
    { wch: 14 },
    { wch: 16 },
    { wch: 55 },
    { wch: 70 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Comparison');

  const summary = [
    ['Metric', 'Count'],
    ['Old card total (pp_equipment)', counts.oldTotal],
    ['New hierarchy total nodes', counts.hierarchyTotal],
    ['New hierarchy mapped (clickable)', counts.hierarchyMapped],
    ['Shared (old + new linked)', counts.shared],
    ['Old only', counts.oldOnly],
    ['New only (no history card)', counts.newOnly],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  wsSummary['!cols'] = [{ wch: 36 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  XLSX.writeFile(wb, OUT_XLSX);
}

function main() {
  const { rows, counts } = buildRows();
  writeCsv(rows);
  writeXlsx(rows, counts);

  console.log(`Wrote ${OUT_CSV}`);
  console.log(`Wrote ${OUT_XLSX}`);
  console.log(`  shared:   ${counts.shared}`);
  console.log(`  old_only: ${counts.oldOnly}`);
  console.log(`  new_only: ${counts.newOnly}`);
  console.log(`  total rows: ${rows.length}`);
}

main();
