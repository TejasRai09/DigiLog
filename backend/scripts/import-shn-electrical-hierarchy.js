/**
 * Import Sugar House electrical equipment hierarchy (Mill House) from Excel
 * into shn_hierarchy_node.
 *
 * Hierarchy: Sugar Plant → Section → Location → Main Equipment → Sub Equipment (leaf)
 * One leaf per Excel row.
 *
 * This script APPENDS electrical nodes under the existing Sugar Plant root
 * (does not clear existing instrument hierarchy).
 *
 * Usage (from backend/):
 *   npm run db:import-shn-electrical-hierarchy -- --dry-run
 *   npm run db:import-shn-electrical-hierarchy
 *   npm run db:import-shn-electrical-hierarchy -- --force
 */
require('../config/env');
const path = require('path');
const XLSX = require('xlsx');
const { pool } = require('../config/mysql');

const DEFAULT_XLSX_LIST = [
  path.join(__dirname, '../backlog-data/electrical -mill house-herarchy-30072026.xlsx'),
  path.join(__dirname, '../backlog-data/2_70 TPH boiler life history.xlsx'),
  path.join(__dirname, '../backlog-data/3_Power House life history.xlsx'),
  path.join(__dirname, '../backlog-data/4_DS Electrical Equipment Life History - MOTORS.xlsx'),
  path.join(__dirname, '../backlog-data/5_DS Electrical Equipment Live  History - VFD PANEL.xlsx'),
];

const ROOT_NAME = 'Sugar Plant';

function trim(value) {
  return String(value ?? '').trim();
}

function normTag(t) {
  return trim(t).toUpperCase().replace(/\s+/g, ' ');
}

function compactTag(t) {
  return normTag(t).replace(/\s+/g, '');
}

function tagsMatch(a, b) {
  const na = normTag(a);
  const nb = normTag(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (compactTag(a) === compactTag(b)) return true;
  return false;
}

function subEquipmentColumn(row) {
  return trim(row[' Sub Equipment'] || row['Sub Equipment'] || row.sub_equipment);
}

function tagNoColumn(row) {
  return trim(
    row[' History card Tag nas.']
    || row['History card Tag nas.']
    || row['History card Tag Nos.']
    || row[' History card Tag Nos.']
    || row['Inst. History card Tag nas.']
    || row['Inst. History card Tag no.']
  );
}

function histLocationColumn(row) {
  return trim(
    row['History card Location']
    || row['Inst. History card Location']
  );
}

function parseArgs(argv) {
  const args = { force: false, dryRun: false, files: [] };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--force') args.force = true;
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--file' && argv[i + 1]) {
      args.files.push(path.resolve(argv[i + 1]));
      i += 1;
    }
  }
  if (!args.files.length) {
    args.files = DEFAULT_XLSX_LIST.filter((f) => require('fs').existsSync(f));
  }
  return args;
}

function findHierarchyHeaderRow(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 30); i += 1) {
    const cells = (aoa[i] || []).map((c) => trim(c));
    const hasSection = cells.some((c) => c === 'Section');
    const hasMain = cells.some((c) => c === 'Main Equipment' || c.includes('Main Equipment'));
    const hasTag = cells.some((c) => /history card tag/i.test(c));
    if (hasSection && hasMain && hasTag) return i;
  }
  return 0;
}

function loadRows(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error('Workbook has no sheets.');
  const sheet = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
  if (!aoa.length) throw new Error('Sheet is empty.');

  const headerRow = findHierarchyHeaderRow(aoa);
  const headers = (aoa[headerRow] || []).map((c) => trim(c));
  const sheetRows = [];
  for (let r = headerRow + 1; r < aoa.length; r += 1) {
    const cells = aoa[r] || [];
    if (!cells.some((c) => trim(c))) continue;
    const row = {};
    headers.forEach((h, i) => {
      if (!h) return;
      row[h] = cells[i] ?? '';
    });
    sheetRows.push(row);
  }
  if (!sheetRows.length) throw new Error('Sheet is empty.');

  const unique = new Map();
  let skipped = 0;

  for (const row of sheetRows) {
    const section = trim(row.Section);
    const location = trim(row.Location);
    const mainEquipment = trim(row['Main Equipment']);
    const subEquipment = subEquipmentColumn(row);
    const equipNo = tagNoColumn(row);
    const histLocation = histLocationColumn(row);
    const department = trim(row.Department);

    if (!section || !mainEquipment || !subEquipment || !equipNo || !String(equipNo).includes('/')) {
      skipped += 1;
      continue;
    }

    const key = `${subEquipment}\0${equipNo}\0${histLocation}`;
    if (!unique.has(key)) {
      unique.set(key, {
        section,
        location,
        mainEquipment,
        subEquipment,
        equipNo,
        histLocation,
        department,
      });
    }
  }

  if (skipped) {
    console.log(`Skipped ${skipped} row(s) missing required fields.`);
  }

  return [...unique.values()];
}

function leafLabelKey(subEquipment, histLocation) {
  return `${subEquipment}\0${histLocation}`;
}

function leafDisplayName(subEquipment, histLocation, equipNo, duplicateLabel) {
  if (!histLocation) {
    return duplicateLabel ? `${subEquipment} · ${equipNo}` : subEquipment;
  }
  const base = `${subEquipment} · ${histLocation}`;
  if (duplicateLabel) return `${base} · ${equipNo}`;
  return base;
}

function buildTree(rows) {
  const sectionMap = new Map();
  const locationMap = new Map();
  const mainEquipMap = new Map();
  const mainLeavesMap = new Map();

  for (const row of rows) {
    const mainKey = [row.section, row.location, row.mainEquipment].join('\0');
    if (!mainLeavesMap.has(mainKey)) mainLeavesMap.set(mainKey, []);
    mainLeavesMap.get(mainKey).push(row);
  }

  const labelCountsByMain = new Map();
  for (const [mainKey, leaves] of mainLeavesMap) {
    const counts = new Map();
    for (const row of leaves) {
      const labelKey = leafLabelKey(row.subEquipment, row.histLocation);
      counts.set(labelKey, (counts.get(labelKey) || 0) + 1);
    }
    labelCountsByMain.set(mainKey, counts);
  }

  const sorted = [...rows].sort((a, b) => {
    const ka = [a.section, a.location, a.mainEquipment, a.subEquipment, a.equipNo].join('\0');
    const kb = [b.section, b.location, b.mainEquipment, b.subEquipment, b.equipNo].join('\0');
    return ka.localeCompare(kb);
  });

  const sections = [];

  for (const row of sorted) {
    let sectionNode = sectionMap.get(row.section);
    if (!sectionNode) {
      sectionNode = { name: row.section, children: [] };
      sectionMap.set(row.section, sectionNode);
      sections.push(sectionNode);
    }

    const locKey = `${row.section}\0${row.location}`;
    let locationNode = locationMap.get(locKey);
    if (!locationNode) {
      locationNode = { name: row.location, children: [] };
      locationMap.set(locKey, locationNode);
      sectionNode.children.push(locationNode);
    }

    const mainKey = `${locKey}\0${row.mainEquipment}`;
    let mainNode = mainEquipMap.get(mainKey);
    if (!mainNode) {
      mainNode = { name: row.mainEquipment, children: [] };
      mainEquipMap.set(mainKey, mainNode);
      locationNode.children.push(mainNode);
    }

    const mainIdentityKey = [row.section, row.location, row.mainEquipment].join('\0');
    const labelKey = leafLabelKey(row.subEquipment, row.histLocation);
    const duplicateLabel = (labelCountsByMain.get(mainIdentityKey)?.get(labelKey) || 0) > 1;

    mainNode.children.push({
      name: leafDisplayName(row.subEquipment, row.histLocation, row.equipNo, duplicateLabel),
      lookupName: row.subEquipment,
      equipNo: row.equipNo,
      histLocation: row.histLocation,
      children: [],
    });
  }

  return sections;
}

async function resolveShnEquipId(conn, node) {
  const equipNo = trim(node.equipNo);
  const lookupName = trim(node.lookupName || node.name);
  if (equipNo) {
    const [rows] = await conn.execute(
      'SELECT id FROM shn_equipment WHERE equip_no = ? OR tag_name = ? LIMIT 1',
      [equipNo, equipNo],
    );
    if (rows[0]) return rows[0].id;
  }
  if (lookupName) {
    const [rows] = await conn.execute(
      'SELECT id FROM shn_equipment WHERE name = ? LIMIT 1',
      [lookupName],
    );
    if (rows[0]) return rows[0].id;
  }
  return null;
}

async function insertNode(conn, parentId, node, sortOrder) {
  const children = node.children || [];
  const nodeType = children.length ? 'group' : 'equipment';
  let shnEquipId = null;
  if (nodeType === 'equipment') {
    shnEquipId = await resolveShnEquipId(conn, node);
  }

  const [result] = await conn.execute(
    `INSERT INTO shn_hierarchy_node
       (parent_id, node_type, name, equip_no, lookup_name, hist_location, shn_equip_id, sort_order, is_imported)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      parentId,
      nodeType,
      node.name,
      nodeType === 'equipment' ? (node.equipNo || null) : null,
      nodeType === 'equipment' ? (node.lookupName || node.name) : null,
      nodeType === 'equipment' ? (node.histLocation || null) : null,
      shnEquipId,
      sortOrder,
      1,
    ],
  );

  const newId = result.insertId;
  for (let i = 0; i < children.length; i += 1) {
    await insertNode(conn, newId, children[i], i);
  }
  return newId;
}

async function findRootNode(conn) {
  const [rows] = await conn.execute(
    `SELECT id FROM shn_hierarchy_node WHERE name = ? AND parent_id IS NULL AND is_active = 1 LIMIT 1`,
    [ROOT_NAME],
  );
  return rows[0] || null;
}

async function findExistingElectricalNodes(conn, rootId) {
  const [rows] = await conn.execute(
    `SELECT id, name FROM shn_hierarchy_node
     WHERE parent_id = ? AND is_active = 1 AND is_imported = 1
     AND id IN (
       SELECT DISTINCT ancestor.id
       FROM shn_hierarchy_node ancestor
       WHERE ancestor.parent_id = ?
       AND EXISTS (
         SELECT 1 FROM shn_hierarchy_node leaf
         WHERE leaf.equip_no LIKE 'ZIL/GSM/SP/ELECT%'
         AND leaf.is_active = 1
       )
     )`,
    [rootId, rootId],
  );
  return rows;
}

async function deleteSubtree(conn, nodeId) {
  const [children] = await conn.execute(
    'SELECT id FROM shn_hierarchy_node WHERE parent_id = ?',
    [nodeId],
  );
  for (const child of children) {
    await deleteSubtree(conn, child.id);
  }
  await conn.execute(
    'UPDATE shn_hierarchy_node SET shn_equip_id = NULL WHERE id = ? AND shn_equip_id IS NOT NULL',
    [nodeId],
  );
  await conn.execute('DELETE FROM shn_hierarchy_node WHERE id = ?', [nodeId]);
}

async function findElectricalSectionNodes(conn, rootId) {
  const [rows] = await conn.execute(
    `SELECT hn.id, hn.name FROM shn_hierarchy_node hn
     WHERE hn.parent_id = ? AND hn.is_active = 1
     AND hn.name = 'MILL HOUSE'`,
    [rootId],
  );
  return rows;
}

async function hasElectricalLeaves(conn, nodeId) {
  const [rows] = await conn.execute(
    `WITH RECURSIVE tree AS (
       SELECT id FROM shn_hierarchy_node WHERE id = ?
       UNION ALL
       SELECT c.id FROM shn_hierarchy_node c JOIN tree t ON c.parent_id = t.id
     )
     SELECT COUNT(*) AS cnt FROM shn_hierarchy_node
     WHERE id IN (SELECT id FROM tree)
     AND node_type = 'equipment'
     AND equip_no LIKE '%ELECT%'
     LIMIT 1`,
    [nodeId],
  );
  return rows[0]?.cnt > 0;
}

async function importFile(conn, file, root, force) {
  const rows = loadRows(file);
  if (!rows.length) {
    console.log(`No valid hierarchy rows found in ${file}`);
    return 0;
  }

  const sections = buildTree(rows);
  const totalLeaves = rows.length;
  console.log(`\nLoaded ${rows.length} sub-equipment row(s) from ${path.basename(file)}`);
  console.log(`Sections: ${sections.length}`);

  const maxSortRes = await conn.execute(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort FROM shn_hierarchy_node WHERE parent_id = ?',
    [root.id],
  );
  let sortStart = maxSortRes[0][0]?.next_sort || 0;

  let insertedNodes = 0;
  for (const section of sections) {
    const existingSection = await (async () => {
      const [found] = await conn.execute(
        'SELECT id, name FROM shn_hierarchy_node WHERE parent_id = ? AND is_active = 1',
        [root.id],
      );
      const exact = found.find((r) => r.name === section.name);
      if (exact) return exact;
      const secNorm = section.name.replace(/\s+/g, ' ').trim().toUpperCase();
      const alias = found.find((r) => {
        const n = r.name.replace(/\s+/g, ' ').trim().toUpperCase();
        return n === secNorm || n.startsWith(secNorm + '-') || n.startsWith(secNorm + ' -');
      });
      return alias || null;
    })();

    let sectionId;
    if (existingSection) {
      sectionId = existingSection.id;
      console.log(`Reusing existing section: ${existingSection.name} (id=${sectionId})`);
    } else {
      const [res] = await conn.execute(
        `INSERT INTO shn_hierarchy_node
           (parent_id, node_type, name, sort_order, is_imported)
         VALUES (?, 'group', ?, ?, 1)`,
        [root.id, section.name, sortStart++],
      );
      sectionId = res.insertId;
      insertedNodes += 1;
      console.log(`Created section: ${section.name} (id=${sectionId})`);
    }

    for (let li = 0; li < section.children.length; li += 1) {
      const loc = section.children[li];

      const existingLoc = await (async () => {
        const [found] = await conn.execute(
          'SELECT id, name FROM shn_hierarchy_node WHERE parent_id = ? AND is_active = 1',
          [sectionId],
        );
        const exact = found.find((r) => r.name === loc.name);
        if (exact) return exact;
        const locNorm = loc.name.replace(/\s+/g, ' ').trim().toUpperCase();
        const alias = found.find((r) => {
          const n = r.name.replace(/\s+/g, ' ').trim().toUpperCase();
          return n === locNorm || n.startsWith(locNorm + '-') || n.startsWith(locNorm + ' -');
        });
        return alias || null;
      })();

      let locId;
      if (existingLoc) {
        locId = existingLoc.id;
      } else {
        const [res] = await conn.execute(
          `INSERT INTO shn_hierarchy_node
             (parent_id, node_type, name, sort_order, is_imported)
           VALUES (?, 'group', ?, ?, 1)`,
          [sectionId, loc.name, li],
        );
        locId = res.insertId;
        insertedNodes += 1;
      }

      for (let mi = 0; mi < loc.children.length; mi += 1) {
        const main = loc.children[mi];

        const existingMain = await (async () => {
          const [found] = await conn.execute(
            'SELECT id, name FROM shn_hierarchy_node WHERE parent_id = ? AND is_active = 1',
            [locId],
          );
          const exact = found.find((r) => r.name === main.name);
          if (exact) return exact;
          const mainNorm = main.name.replace(/\s+/g, ' ').trim().toUpperCase();
          const alias = found.find((r) => {
            const n = r.name.replace(/\s+/g, ' ').trim().toUpperCase();
            return n === mainNorm || n.startsWith(mainNorm + '-') || n.startsWith(mainNorm + ' -');
          });
          return alias || null;
        })();

        let mainId;
        if (existingMain) {
          mainId = existingMain.id;
        } else {
          const [res] = await conn.execute(
            `INSERT INTO shn_hierarchy_node
               (parent_id, node_type, name, sort_order, is_imported)
             VALUES (?, 'group', ?, ?, 1)`,
            [locId, main.name, mi],
          );
          mainId = res.insertId;
          insertedNodes += 1;
        }

        for (let si = 0; si < main.children.length; si += 1) {
          const leaf = main.children[si];
          const existingLeaf = await (async () => {
            const [found] = await conn.execute(
              'SELECT id FROM shn_hierarchy_node WHERE parent_id = ? AND equip_no = ? AND is_active = 1 LIMIT 1',
              [mainId, leaf.equipNo || ''],
            );
            return found[0] || null;
          })();
          if (existingLeaf) continue;
          await insertNode(conn, mainId, leaf, si);
          insertedNodes += 1;
        }
      }
    }
  }

  console.log(`Inserted ${insertedNodes} nodes (${totalLeaves} leaves) from ${path.basename(file)}.`);
  return insertedNodes;
}

async function main() {
  const { force, dryRun, files } = parseArgs(process.argv);
  const conn = await pool.getConnection();

  try {
    if (!files.length) {
      throw new Error('No source files found.');
    }

    if (dryRun) {
      for (const file of files) {
        const rows = loadRows(file);
        const sections = buildTree(rows);
        console.log(`\n[dry-run] ${path.basename(file)}: ${rows.length} rows, ${sections.length} sections`);
        for (const section of sections) {
          console.log(`  Section: ${section.name}`);
          for (const loc of section.children) {
            console.log(`    Location: ${loc.name}`);
            for (const main of loc.children) {
              console.log(`      Main: ${main.name} (${main.children.length} sub-equipment)`);
            }
          }
        }
      }
      console.log('\nNo DB changes made.');
      return;
    }

    const root = await findRootNode(conn);
    if (!root) {
      throw new Error(
        `Root node "${ROOT_NAME}" not found. Import the main sugar house hierarchy first.`,
      );
    }
    console.log(`Found root node: ${ROOT_NAME} (id=${root.id})`);

    let totalInserted = 0;
    for (const file of files) {
      await conn.beginTransaction();
      try {
        totalInserted += await importFile(conn, file, root, force);
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        console.error(`Import failed for ${path.basename(file)}: ${err.message}`);
      }
    }

    console.log(`\nDone. Total inserted: ${totalInserted} nodes.`);
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
