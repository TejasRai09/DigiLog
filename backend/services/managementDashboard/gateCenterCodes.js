const { pool } = require('../../config/mysql');

function normalizeCenterCode(value) {
  if (value == null) return '';
  let text = String(value).trim();
  if (!text) return '';
  if (/^\d+\.0+$/.test(text)) text = String(parseInt(text, 10));
  return text;
}

function categoryForCode(code, gateCodes) {
  if (!gateCodes || gateCodes.size === 0) return null;
  const key = normalizeCenterCode(code);
  return gateCodes.has(key) ? 'gate' : 'center';
}

async function loadGateCodeSet(conn = pool) {
  const [rows] = await conn.query('SELECT code FROM md_gate_center_codes');
  return new Set(rows.map((row) => normalizeCenterCode(row.code)).filter(Boolean));
}

async function retagIndentAndPurchase(conn, gateCodes) {
  const codes = [...gateCodes];
  if (!codes.length) {
    await conn.query('UPDATE centre_indent_data SET category = NULL');
    await conn.query('UPDATE centre_purchase_data SET category = NULL');
    return;
  }
  const sql = (table) => `UPDATE ${table}
    SET category = IF(TRIM(CAST(code AS CHAR)) IN (?), 'gate', 'center')`;
  await conn.query(sql('centre_indent_data'), [codes]);
  await conn.query(sql('centre_purchase_data'), [codes]);
}

async function listGateCodes() {
  const [rows] = await pool.query(
    'SELECT id, code, created_at FROM md_gate_center_codes ORDER BY CAST(code AS UNSIGNED), code',
  );
  return rows;
}

async function addGateCode(rawCode) {
  const code = normalizeCenterCode(rawCode);
  if (!code) {
    const err = new Error('Enter a center code.');
    err.status = 400;
    throw err;
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('INSERT INTO md_gate_center_codes (code) VALUES (?)', [code]);
    const gateCodes = await loadGateCodeSet(conn);
    await retagIndentAndPurchase(conn, gateCodes);
    const [[row]] = await conn.query(
      'SELECT id, code, created_at FROM md_gate_center_codes WHERE code = ? LIMIT 1',
      [code],
    );
    await conn.commit();
    return row;
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      const dup = new Error('That center code is already marked as Gate.');
      dup.status = 400;
      throw dup;
    }
    throw err;
  } finally {
    conn.release();
  }
}

async function deleteGateCode(id) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query('DELETE FROM md_gate_center_codes WHERE id = ?', [id]);
    if (!result.affectedRows) {
      const err = new Error('Center code not found.');
      err.status = 404;
      throw err;
    }
    const gateCodes = await loadGateCodeSet(conn);
    await retagIndentAndPurchase(conn, gateCodes);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  normalizeCenterCode,
  categoryForCode,
  loadGateCodeSet,
  retagIndentAndPurchase,
  listGateCodes,
  addGateCode,
  deleteGateCode,
};
