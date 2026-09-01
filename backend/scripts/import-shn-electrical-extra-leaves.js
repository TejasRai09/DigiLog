/**
 * Attach electrical LIFE-card tags that are missing from the hierarchy sheet
 * under Sugar Plant → REFINERY HOUSE → Raw House so they show in Sugar Card.
 *
 * Usage (from backend/):
 *   node scripts/import-shn-electrical-extra-leaves.js --file "backlog-data/mill data/mill-house-electrical-equipment-history-11082026.xlsx"
 */
require('../config/env');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { pool } = require('../config/mysql');

function trim(v) {
  return String(v ?? '').trim();
}

function normTag(t) {
  return trim(t).toLowerCase().replace(/\s+/g, '');
}

function parseArgs(argv) {
  const opts = { dryRun: false, file: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') opts.dryRun = true;
    else if (argv[i] === '--file' && argv[i + 1]) {
      opts.file = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  if (!opts.file) {
    throw new Error('Pass --file <normalized electrical history xlsx>');
  }
  return opts;
}

function loadLifeCards(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Workbook not found: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets['EQUIPMENT LIFE HISTORY CARD'];
  if (!sheet) throw new Error('EQUIPMENT LIFE HISTORY CARD sheet missing');
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const cards = [];
  const seen = new Set();
  for (const row of rows) {
    const tag = trim(row['EQUIPMENT TAG NO']);
    if (!tag || seen.has(normTag(tag))) continue;
    seen.add(normTag(tag));
    const name = trim(row['NAME OF EQUIPMENT']) || tag;
    cards.push({
      tag,
      name,
      location: trim(row.LOCATION),
      mainName: name.replace(/\s+MOTOR\s*$/i, '').trim() || name,
    });
  }
  return cards;
}

async function findNamedChild(conn, parentId, name) {
  const [rows] = await conn.execute(
    'SELECT id, name FROM shn_hierarchy_node WHERE parent_id = ? AND is_active = 1',
    [parentId],
  );
  const want = name.replace(/\s+/g, ' ').trim().toUpperCase();
  return rows.find((r) => r.name.replace(/\s+/g, ' ').trim().toUpperCase() === want) || null;
}

async function main() {
  const opts = parseArgs(process.argv);
  const cards = loadLifeCards(opts.file);
  const conn = await pool.getConnection();
  try {
    const [roots] = await conn.execute(
      `SELECT id FROM shn_hierarchy_node WHERE name = 'Sugar Plant' AND parent_id IS NULL AND is_active = 1 LIMIT 1`,
    );
    if (!roots[0]) throw new Error('Sugar Plant root not found');
    const section = await findNamedChild(conn, roots[0].id, 'REFINERY HOUSE');
    if (!section) throw new Error('REFINERY HOUSE section not found');
    const loc = await findNamedChild(conn, section.id, 'Raw House');
    if (!loc) throw new Error('Raw House location not found');

    const [leaves] = await conn.execute(
      `SELECT equip_no FROM shn_hierarchy_node WHERE node_type = 'equipment' AND is_active = 1 AND equip_no IS NOT NULL`,
    );
    const existing = new Set(leaves.map((r) => normTag(r.equip_no)).filter(Boolean));

    const extras = cards.filter((c) => !existing.has(normTag(c.tag)));
    console.log(`LIFE cards: ${cards.length}; extra tags to attach: ${extras.length}`);
    extras.forEach((c) => console.log(`  + ${c.tag}  (${c.name})`));

    if (opts.dryRun || !extras.length) {
      console.log(opts.dryRun ? 'No DB changes made.' : 'Nothing to insert.');
      return;
    }

    await conn.beginTransaction();
    const [mains] = await conn.execute(
      'SELECT COALESCE(MAX(sort_order), -1) AS mx FROM shn_hierarchy_node WHERE parent_id = ?',
      [loc.id],
    );
    let sort = Number(mains[0].mx) + 1;
    let inserted = 0;
    for (const card of extras) {
      const [mainRes] = await conn.execute(
        `INSERT INTO shn_hierarchy_node
           (parent_id, node_type, name, sort_order, is_imported)
         VALUES (?, 'group', ?, ?, 1)`,
        [loc.id, card.mainName, sort],
      );
      await conn.execute(
        `INSERT INTO shn_hierarchy_node
           (parent_id, node_type, name, equip_no, lookup_name, hist_location, sort_order, is_imported)
         VALUES (?, 'equipment', ?, ?, ?, ?, 0, 1)`,
        [mainRes.insertId, card.name, card.tag, card.name, card.location || null],
      );
      sort += 1;
      inserted += 1;
    }
    await conn.commit();
    console.log(`Inserted ${inserted} extra main+leaf pairs under REFINERY HOUSE / Raw House.`);
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
