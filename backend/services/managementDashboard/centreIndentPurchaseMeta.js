/** Optional Excel headers + season_mapping fill for indent/purchase imports. */

function pickStr(row, keys) {
  for (const key of keys) {
    const v = row[key];
    if (v == null || v === '') continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return null;
}

function toIsoDate(v) {
  if (!v) return null;
  return String(v).slice(0, 10);
}

function seasonLabelForDate(iso, mappings) {
  if (!iso) return null;
  const d = String(iso).slice(0, 10);
  const hit = (mappings || []).find((m) => m.start && m.end && d >= m.start && d <= m.end);
  return hit?.label || null;
}

async function loadSeasonMappings(conn) {
  const [rows] = await conn.query(
    'SELECT season_label, start_date, end_date FROM season_mapping ORDER BY start_date',
  );
  return rows.map((r) => ({
    label: r.season_label,
    start: toIsoDate(r.start_date),
    end: toIsoDate(r.end_date),
  }));
}

/**
 * Optional: stamp season_label from season_mapping dates.
 * Centre Maturity now filters by indent_date / purchase_date (same as
 * Management Dashboard); labels are kept for other reports.
 */
async function backfillSeasonLabels(conn) {
  await conn.query(`
    UPDATE centre_indent_data i
    INNER JOIN season_mapping s
      ON i.indent_date BETWEEN s.start_date AND s.end_date
    SET i.season_label = s.season_label
    WHERE i.season_label IS NULL OR i.season_label = ''
  `);
  await conn.query(`
    UPDATE centre_purchase_data p
    INNER JOIN season_mapping s
      ON p.purchase_date BETWEEN s.start_date AND s.end_date
    SET p.season_label = s.season_label
    WHERE p.season_label IS NULL OR p.season_label = ''
  `);
}

module.exports = {
  pickStr,
  seasonLabelForDate,
  loadSeasonMappings,
  backfillSeasonLabels,
};
