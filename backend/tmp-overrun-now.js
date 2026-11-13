const { pool } = require('./config/mysql');

(async () => {
  const [[codes]] = await pool.query('SELECT COUNT(*) AS n FROM md_gate_center_codes');
  const [indent] = await pool.query(
    `SELECT file_upload_id, LOWER(TRIM(category)) AS category, COUNT(*) AS n, ROUND(SUM(indent_qty),2) AS qty,
            MIN(indent_date) AS min_d, MAX(indent_date) AS max_d
     FROM centre_indent_data GROUP BY file_upload_id, LOWER(TRIM(category))`,
  );
  const [purchase] = await pool.query(
    `SELECT file_upload_id, LOWER(TRIM(category)) AS category, COUNT(*) AS n, ROUND(SUM(purchase_qty),2) AS qty,
            MIN(purchase_date) AS min_d, MAX(purchase_date) AS max_d
     FROM centre_purchase_data GROUP BY file_upload_id, LOWER(TRIM(category))`,
  );
  const [files] = await pool.query(
    `SELECT id, original_filename, dataset, created_at
     FROM data_upload_files
     WHERE dataset = 'centre_indent_purchase'
     ORDER BY id DESC LIMIT 8`,
  );
  const [days] = await pool.query(`
    SELECT d, SUM(ind) AS ind, SUM(pur) AS pur FROM (
      SELECT indent_date AS d, indent_qty AS ind, 0 AS pur FROM centre_indent_data
      UNION ALL
      SELECT purchase_date AS d, 0, purchase_qty FROM centre_purchase_data
    ) t
    GROUP BY d ORDER BY d
  `);
  let ind = 0;
  let pur = 0;
  for (const row of days) {
    ind += Number(row.ind);
    pur += Number(row.pur);
  }
  const [seasons] = await pool.query('SELECT season_label, start_date, end_date FROM season_mapping ORDER BY start_date');
  console.log(seasons);
  console.log(days.map((r) => ({
    d: String(r.d).slice(0, 10),
    ind: Number(r.ind),
    pur: Number(r.pur),
    pct: Number(r.ind) ? (Number(r.pur) / Number(r.ind) * 100).toFixed(1) : null,
  })));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
