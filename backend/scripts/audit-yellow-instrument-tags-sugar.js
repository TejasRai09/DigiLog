/**
 * Audit yellow-highlighted rows from Plant Instrument Equipment List
 * vs Sugar House hierarchy + card data.
 *
 * Categories:
 *   - Hierarchy + data
 *   - Hierarchy only
 *   - Data only
 *   - Nothing
 */
require('../config/env');

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const XLSX = require('xlsx');
const { pool } = require('../config/mysql');

const ROOT = path.resolve(__dirname, '../../..');
const SRC_XLSX = path.join(
  ROOT,
  'Extraction_files-sugar',
  'instrument and mechanical',
  'Plant Instrument Equipment List-21-08-2026.xlsx',
);
const OUT_DIR = path.join(
  __dirname,
  '../backlog-data/mill data/migration files-24-08-26',
);
const OUT_XLSX = path.join(
  OUT_DIR,
  'yellow-instrument-tags-sugar-audit-250826.xlsx',
);

const PY_HELPER = path.join(__dirname, '_tmp_extract_yellow_rows.py');

function writePythonHelper() {
  const code = `#!/usr/bin/env python3
import json, re
from pathlib import Path
import openpyxl

src = Path(r${JSON.stringify(SRC_XLSX)})
wb = openpyxl.load_workbook(src, data_only=True)
ws = wb.active

def cell_rgb(cell):
    fill = cell.fill
    if not fill or fill.patternType in (None, "none"):
        return None
    fg = fill.fgColor
    if fg is None:
        return None
    if getattr(fg, "type", None) == "rgb" and fg.rgb:
        return str(fg.rgb).upper()
    return None

def is_yellow(rgb):
    return bool(rgb and rgb.endswith("FFFF00"))

def clean(v):
    return re.sub(r"\\s+", " ", str(v or "").replace("\\n", " ")).strip()

rows = []
for r in range(3, ws.max_row + 1):
    yellow = any(is_yellow(cell_rgb(ws.cell(r, c))) for c in range(1, 10))
    if not yellow:
        continue
    rows.append({
        "excel_row": r,
        "sr_no": clean(ws.cell(r, 1).value),
        "plant": clean(ws.cell(r, 2).value),
        "section": clean(ws.cell(r, 3).value),
        "location": clean(ws.cell(r, 4).value),
        "main_equipment": clean(ws.cell(r, 5).value),
        "sub_equipment": clean(ws.cell(r, 6).value),
        "department": clean(ws.cell(r, 7).value),
        "tag": clean(ws.cell(r, 8).value),
        "hist_location": clean(ws.cell(r, 9).value),
    })
print(json.dumps(rows, ensure_ascii=False))
`;
  fs.writeFileSync(PY_HELPER, code, 'utf8');
}

function loadYellowRows() {
  writePythonHelper();
  const res = spawnSync('py', ['-3', PY_HELPER], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(`Yellow extract failed: ${res.stderr || res.stdout}`);
  }
  const out = (res.stdout || '').trim();
  const jsonLine = out.split(/\r?\n/).filter(Boolean).pop();
  return JSON.parse(jsonLine);
}

function norm(t) {
  return String(t || '').toLowerCase().replace(/\s+/g, '');
}

function loose(t) {
  return norm(t).replace(/[^a-z0-9]/g, '');
}

function classify(hasHier, hasData) {
  if (hasHier && hasData) return 'Hierarchy + data';
  if (hasHier && !hasData) return 'Hierarchy only';
  if (!hasHier && hasData) return 'Data only';
  return 'Nothing';
}

async function main() {
  if (!fs.existsSync(SRC_XLSX)) {
    throw new Error(`Source not found: ${SRC_XLSX}`);
  }
  const yellow = loadYellowRows();
  console.log(`Yellow rows: ${yellow.length}`);

  const conn = await pool.getConnection();
  try {
    const [leaves] = await conn.query(`
      SELECT id, name, equip_no, lookup_name, hist_location, shn_equip_id
      FROM shn_hierarchy_node
      WHERE node_type = 'equipment' AND is_active = 1
    `);
    const [equips] = await conn.query(`
      SELECT e.id, e.equip_no, e.tag_name, e.name, e.location,
        (SELECT COUNT(*) FROM shn_specs s
          WHERE s.equip_id = e.id AND IFNULL(s.lbl,'') <> '__subsections__') AS specs,
        (SELECT COUNT(*) FROM shn_oem_schedule o WHERE o.equip_id = e.id) AS schedule,
        (SELECT COUNT(*) FROM shn_history h WHERE h.equip_id = e.id) AS history,
        (SELECT GROUP_CONCAT(DISTINCT section ORDER BY section) FROM (
          SELECT section FROM shn_specs
            WHERE equip_id = e.id AND section IS NOT NULL AND section <> ''
          UNION
          SELECT section FROM shn_oem_schedule
            WHERE equip_id = e.id AND section IS NOT NULL AND section <> ''
          UNION
          SELECT section FROM shn_history
            WHERE equip_id = e.id AND section IS NOT NULL AND section <> ''
        ) x) AS sections
      FROM shn_equipment e
    `);

    const leafByNorm = new Map();
    const leafByLoose = new Map();
    for (const l of leaves) {
      if (!l.equip_no) continue;
      const n = norm(l.equip_no);
      const lo = loose(l.equip_no);
      if (!leafByNorm.has(n)) leafByNorm.set(n, []);
      leafByNorm.get(n).push(l);
      if (!leafByLoose.has(lo)) leafByLoose.set(lo, []);
      leafByLoose.get(lo).push(l);
    }

    const eqByNorm = new Map();
    const eqByLoose = new Map();
    const eqById = new Map(equips.map((e) => [e.id, e]));
    for (const e of equips) {
      for (const t of [e.equip_no, e.tag_name]) {
        if (!t) continue;
        const n = norm(t);
        const lo = loose(t);
        if (!eqByNorm.has(n)) eqByNorm.set(n, []);
        eqByNorm.get(n).push(e);
        if (!eqByLoose.has(lo)) eqByLoose.set(lo, []);
        eqByLoose.get(lo).push(e);
      }
    }

    function findLeaves(tag) {
      if (!tag) return { leaves: [], how: '' };
      const a = leafByNorm.get(norm(tag));
      if (a?.length) return { leaves: a, how: 'exact-tag' };
      const b = leafByLoose.get(loose(tag));
      if (b?.length) return { leaves: b, how: 'loose-tag' };
      return { leaves: [], how: '' };
    }

    function findEquip(tag, leaf) {
      if (tag) {
        const a = eqByNorm.get(norm(tag));
        if (a?.length) return { eq: a[0], how: 'exact-tag' };
        const b = eqByLoose.get(loose(tag));
        if (b?.length) return { eq: b[0], how: 'loose-tag' };
      }
      if (leaf?.shn_equip_id) {
        const eq = eqById.get(leaf.shn_equip_id);
        if (eq) return { eq, how: 'linked-leaf' };
      }
      return { eq: null, how: '' };
    }

    const audited = [];
    const counts = {
      'Hierarchy + data': 0,
      'Hierarchy only': 0,
      'Data only': 0,
      Nothing: 0,
    };

    for (const row of yellow) {
      const { leaves, how: leafHow } = findLeaves(row.tag);
      const leaf = leaves[0] || null;
      const { eq, how: eqHow } = findEquip(row.tag, leaf);
      const hasHier = leaves.length > 0;
      const hasData = Boolean(eq && (eq.specs + eq.schedule + eq.history) > 0);
      const category = classify(hasHier, hasData);
      counts[category] += 1;

      audited.push({
        Category: category,
        'Excel row': row.excel_row,
        'Sr.No.': row.sr_no,
        Plant: row.plant,
        Section: row.section,
        Location: row.location,
        'Main Equipment': row.main_equipment,
        'Sub Equipment': row.sub_equipment,
        Department: row.department,
        'Inst. History card Tag Nos.': row.tag,
        'History card Location': row.hist_location,
        'In hierarchy': hasHier ? 'Yes' : 'No',
        'Hierarchy match': leafHow || '',
        'Hierarchy leaf id': leaf?.id || '',
        'Hierarchy leaf name': leaf?.lookup_name || leaf?.name || '',
        'Hierarchy leaves count': leaves.length,
        'Linked shn_equip_id': leaf?.shn_equip_id || '',
        'In equipment table': eq ? 'Yes' : 'No',
        'Equipment match': eqHow || '',
        'Equipment id': eq?.id || '',
        'Equipment name': eq?.name || '',
        Specs: eq?.specs || 0,
        Schedule: eq?.schedule || 0,
        History: eq?.history || 0,
        'Has card data': hasData ? 'Yes' : 'No',
        'Data sections': eq?.sections || '',
        Notes:
          hasHier && eq && !hasData
            ? 'Hierarchy leaf linked/found but card has no specs/schedule/history'
            : !hasHier && hasData
              ? 'Card exists in shn_equipment but no active hierarchy leaf for this tag'
              : '',
      });
    }

    // Sort: category order, then excel row
    const order = {
      'Hierarchy + data': 1,
      'Hierarchy only': 2,
      'Data only': 3,
      Nothing: 4,
    };
    audited.sort((a, b) => {
      const d = order[a.Category] - order[b.Category];
      if (d) return d;
      return a['Excel row'] - b['Excel row'];
    });

    const summary = [
      { 'Issue type': 'Yellow rows audited', Count: yellow.length },
      { 'Issue type': 'Hierarchy + data', Count: counts['Hierarchy + data'] },
      { 'Issue type': 'Hierarchy only', Count: counts['Hierarchy only'] },
      { 'Issue type': 'Data only', Count: counts['Data only'] },
      { 'Issue type': 'Nothing', Count: counts.Nothing },
      {
        'Issue type': 'Source Excel',
        Count: path.basename(SRC_XLSX),
      },
      {
        'Issue type': 'Filter',
        Count: 'Rows with yellow background (FFFF00) only',
      },
    ];

    const byCat = (cat) => audited.filter((r) => r.Category === cat);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(audited), 'All yellow rows');
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(byCat('Hierarchy + data')),
      'Hierarchy + data',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(byCat('Hierarchy only')),
      'Hierarchy only',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(byCat('Data only')),
      'Data only',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(byCat('Nothing')),
      'Nothing',
    );
    XLSX.writeFile(wb, OUT_XLSX);

    console.log(`Wrote: ${OUT_XLSX}`);
    console.log(counts);
  } finally {
    conn.release();
    await pool.end();
    try {
      fs.unlinkSync(PY_HELPER);
    } catch (_) {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
