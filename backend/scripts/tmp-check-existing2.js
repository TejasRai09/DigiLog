require('../config/env');
const path = require('path');
const XLSX = require('xlsx');
const { pool } = require('../config/mysql');

function trim(v) { return String(v ?? '').trim(); }
function normTag(t) { return trim(t).toUpperCase().replace(/\s+/g, ''); }

async function main() {
  const wb = XLSX.readFile(path.join(__dirname, '../backlog-data/mill data/migration files-24-08-26/yellow-instrument-turbine-equipment-history-260826.xlsx'));
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Hierarchy'], { defval: '' });
  const tags = rows.map((r) => trim(r['History card Tag Nos.'])).filter(Boolean);

  const conn = await pool.getConnection();
  try {
    const [nodes] = await conn.execute(
      `SELECT id, parent_id, name, equip_no, node_type, shn_equip_id
       FROM shn_hierarchy_node WHERE is_active = 1 AND equip_no IS NOT NULL AND equip_no != ''`,
    );
    const byNorm = new Map();
    for (const n of nodes) {
      const key = normTag(n.equip_no);
      if (!byNorm.has(key)) byNorm.set(key, []);
      byNorm.get(key).push(n);
    }

    let dupTags = 0;
    for (const tag of tags) {
      const key = normTag(tag);
      const matches = byNorm.get(key) || [];
      if (matches.length > 1) {
        dupTags += 1;
        console.log(`${tag}: ${matches.length} node(s) -> ids=${matches.map((m) => m.id).join(',')} parents=${matches.map((m) => m.parent_id).join(',')}`);
      } else if (matches.length === 0) {
        console.log(`${tag}: MISSING`);
      }
    }
    console.log(`\nTags with >1 hierarchy node: ${dupTags} / ${tags.length}`);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
