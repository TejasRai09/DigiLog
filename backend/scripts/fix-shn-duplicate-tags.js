/**
 * Split Sugar House cards that share a tag so each leaf has its own
 * shn_equipment row and a unique equip_no.
 *
 * Usage: node scripts/fix-shn-duplicate-tags.js
 */
require('../config/env');
const { pool } = require('../config/mysql');

const TAG_OVERRIDES = {
  962: 'ZIL/SUG/04-M3',
  1149: 'ZIL/SUG./01/FT-203-REF',
  862: 'ZIL/SUG./01/DS_EX_FLOW-2',
  1147: 'ZIL/SUG./01/FT-201-REF',
  1209: 'ZIL/GSM/UPS-1-RAW',
  1381: 'ZIL/GSM/UPS-1-REF',
  1210: 'ZIL/GSM/UPS-2-RAW',
  1382: 'ZIL/GSM/UPS-2-REF',
  1350: 'ZIL/SUG./01/22FT220B01-REF',
};

function compact(value) {
  return String(value || '').replace(/\s+/g, '').toLowerCase();
}

async function pathLabels(conn, nodeId) {
  const labels = [];
  let id = nodeId;
  while (id != null) {
    const [[row]] = await conn.query(
      'SELECT id, parent_id, name FROM shn_hierarchy_node WHERE id = ?',
      [id],
    );
    if (!row) break;
    labels.unshift(row.name);
    id = row.parent_id;
  }
  return labels;
}

async function existingTagSet() {
  const [rows] = await pool.query(
    `SELECT equip_no FROM shn_hierarchy_node
     WHERE is_active = 1 AND equip_no IS NOT NULL AND TRIM(equip_no) <> ''`,
  );
  return new Set(rows.map((r) => compact(r.equip_no)));
}

async function createEquipment(conn, node, tag, labels) {
  const name = String(node.lookup_name || node.name || '').trim();
  const location = String(node.hist_location || '').trim() || null;
  const category = labels[1] || null;
  const subcategory = labels[2] || null;
  const [result] = await conn.query(
    `INSERT INTO shn_equipment
       (dept, category, subcategory, equip_no, tag_name, name, location, sort_order)
     VALUES ('sugar_house', ?, ?, ?, ?, ?, ?, 0)`,
    [category, subcategory, tag, tag, name, location],
  );
  return result.insertId;
}

(async () => {
  const [leaves] = await pool.query(`
    SELECT id, name, equip_no, lookup_name, hist_location, shn_equip_id
    FROM shn_hierarchy_node
    WHERE is_active = 1 AND node_type = 'equipment'
      AND equip_no IS NOT NULL AND TRIM(equip_no) <> ''
    ORDER BY id
  `);

  const groups = new Map();
  for (const leaf of leaves) {
    const key = compact(leaf.equip_no);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(leaf);
  }

  const usedTags = await existingTagSet();
  const conn = await pool.getConnection();
  let updated = 0;

  try {
    await conn.beginTransaction();

    for (const [, rows] of groups) {
      if (rows.length < 2) continue;

      const keep = rows.find((r) => r.shn_equip_id) || rows[0];
      const extras = rows.filter((r) => r.id !== keep.id);

      if (!keep.shn_equip_id) {
        const labels = await pathLabels(conn, keep.id);
        const equipId = await createEquipment(conn, keep, keep.equip_no, labels);
        await conn.query(
          'UPDATE shn_hierarchy_node SET shn_equip_id = ? WHERE id = ?',
          [equipId, keep.id],
        );
        console.log(`linked original ${keep.equip_no} node ${keep.id} -> equipment ${equipId}`);
        updated += 1;
      }

      for (const extra of extras) {
        let nextTag = TAG_OVERRIDES[extra.id] || `${String(extra.equip_no).trim()}-N${extra.id}`;
        let n = 2;
        while (usedTags.has(compact(nextTag))) {
          nextTag = `${TAG_OVERRIDES[extra.id] || extra.equip_no}-${n}`;
          n += 1;
        }
        usedTags.add(compact(nextTag));

        const labels = await pathLabels(conn, extra.id);
        let equipId = extra.shn_equip_id;
        if (!equipId) {
          equipId = await createEquipment(conn, extra, nextTag, labels);
        } else {
          await conn.query(
            'UPDATE shn_equipment SET equip_no = ?, tag_name = ? WHERE id = ?',
            [nextTag, nextTag, equipId],
          );
        }

        await conn.query(
          `UPDATE shn_hierarchy_node
           SET equip_no = ?, shn_equip_id = ?
           WHERE id = ?`,
          [nextTag, equipId, extra.id],
        );

        console.log(
          `split node ${extra.id} (${extra.lookup_name}) ${extra.equip_no} -> ${nextTag} equipment ${equipId}`,
        );
        updated += 1;
      }
    }

    await conn.commit();
    console.log(`done. updated ${updated} nodes.`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
