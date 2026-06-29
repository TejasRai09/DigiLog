/**
 * Backfill section / sub_section / equipment_refs on ppn_history rows imported
 * before history was scoped to equipment spec disciplines.
 *
 * Usage (from backend/):
 *   npm run db:backfill-ppn-history-scope
 *   npm run db:backfill-ppn-history-scope -- --dry-run
 *   npm run db:backfill-ppn-history-scope -- --equip-id 42
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { pool } = require('../../config/mysql');
const {
  inferPrimarySectionFromSpecs,
  readSubSectionsMeta,
  scopeHistoryFromSpecs,
  normalizeHistoryRow,
} = require('./ppnFeedLib');

function parseArgs(argv) {
  const opts = { dryRun: false, equipId: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--equip-id') opts.equipId = Number(argv[++i]);
  }
  return opts;
}

async function backfillEquipment(conn, equipId, opts) {
  const [specRows] = await conn.execute(
    `SELECT section, sub_section, lbl, val FROM ppn_specs WHERE equip_id = ? ORDER BY sort_order, id`,
    [equipId],
  );
  if (!specRows.length) {
    return { equipId, updated: 0, reason: 'no specs' };
  }

  const [historyRows] = await conn.execute(
    `SELECT * FROM ppn_history
     WHERE equip_id = ?
       AND (section IS NULL OR section = '' OR equipment_refs IS NULL)`,
    [equipId],
  );
  if (!historyRows.length) {
    return { equipId, updated: 0, reason: 'already scoped' };
  }

  const normalized = historyRows.map(normalizeHistoryRow);
  const scoped = scopeHistoryFromSpecs(normalized, specRows);
  const section = scoped[0]?.section || inferPrimarySectionFromSpecs(specRows);
  const subSection = scoped[0]?.sub_section || readSubSectionsMeta(specRows)[section]?.[0] || 'General';

  if (opts.dryRun) {
    return { equipId, updated: scoped.length, section, subSection, dryRun: true };
  }

  let updated = 0;
  for (let i = 0; i < historyRows.length; i++) {
    const row = scoped[i];
    const refsJson = JSON.stringify(row.equipment_refs);
    await conn.execute(
      `UPDATE ppn_history
       SET section = ?, sub_section = ?, equipment_refs = ?
       WHERE id = ? AND equip_id = ?`,
      [row.section, row.sub_section, refsJson, historyRows[i].id, equipId],
    );
    updated += 1;
  }

  return { equipId, updated, section, subSection };
}

async function main() {
  const opts = parseArgs(process.argv);
  console.log(`PPN history scope backfill — ${opts.dryRun ? 'DRY RUN' : 'LIVE'}\n`);

  let equipIds = [];
  if (opts.equipId) {
    equipIds = [opts.equipId];
  } else {
    const [rows] = await pool.execute(
      `SELECT DISTINCT equip_id FROM ppn_history
       WHERE section IS NULL OR section = '' OR equipment_refs IS NULL
       ORDER BY equip_id`,
    );
    equipIds = rows.map((r) => r.equip_id);
  }

  if (!equipIds.length) {
    console.log('Nothing to backfill — all history rows already scoped.');
    return;
  }

  let totalUpdated = 0;
  for (const equipId of equipIds) {
    const [eqRows] = await pool.execute(
      'SELECT name FROM ppn_equipment WHERE id = ? LIMIT 1',
      [equipId],
    );
    const name = eqRows[0]?.name || `(id ${equipId})`;
    const result = await backfillEquipment(pool, equipId, opts);
    if (result.updated) {
      totalUpdated += result.updated;
      console.log(`  + ${name}: ${result.updated} row(s) → ${result.section} / ${result.subSection}`);
    } else {
      console.log(`  - ${name}: ${result.reason}`);
    }
  }

  console.log(`\nSummary: ${opts.dryRun ? 'would update' : 'updated'} ${totalUpdated} row(s) across ${equipIds.length} equipment`);
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
