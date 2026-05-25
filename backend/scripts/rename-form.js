/**
 * Rename a form in the `forms` table by its current name.
 *
 * Usage (from DigiLog/backend):
 *   node scripts/rename-form.js
 */

require('../config/env');
const { pool } = require('../config/mysql');

const OLD_NAME = 'EHS home';
const NEW_NAME = 'EHS';

async function main() {
  try {
    // Check the form exists
    const [[existing]] = await pool.query(
      'SELECT id, name, form_key FROM forms WHERE name = ? LIMIT 1',
      [OLD_NAME],
    );

    if (!existing) {
      console.error(`❌  Form "${OLD_NAME}" not found in the forms table.`);
      console.log('\nAvailable forms:');
      const [all] = await pool.query('SELECT id, name, form_key FROM forms ORDER BY name');
      all.forEach((f) => console.log(`  [${f.id}] ${f.name}  (${f.form_key})`));
      process.exit(1);
    }

    console.log(`Found: [${existing.id}] "${existing.name}"  (${existing.form_key})`);

    const [result] = await pool.query(
      'UPDATE forms SET name = ? WHERE id = ?',
      [NEW_NAME, existing.id],
    );

    if (result.affectedRows === 1) {
      console.log(`✅  Renamed "${OLD_NAME}"  →  "${NEW_NAME}"`);
    } else {
      console.warn('⚠️  Update ran but no rows were affected.');
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
