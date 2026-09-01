/**
 * Map legacy free-text users.department values to Config employee categories.
 *
 * Left (category): name in employee_category / Config tab
 * Right (legacyDepartment): old manual text stored on users.department
 *
 * Edit mappings in: scripts/data/employee-department-category-mapping.json
 *
 * Usage:
 *   cd backend
 *   npm run db:map-employee-departments              # apply updates
 *   npm run db:map-employee-departments -- --dry-run   # preview only
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/mysql');

const MAPPING_FILE = path.join(__dirname, 'data', 'employee-department-category-mapping.json');

function loadMappings() {
  const raw = fs.readFileSync(MAPPING_FILE, 'utf8');
  const list = JSON.parse(raw);
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`No mappings found in ${MAPPING_FILE}`);
  }
  for (const row of list) {
    if (!row.category || !row.legacyDepartment) {
      throw new Error('Each mapping needs "category" and "legacyDepartment".');
    }
  }
  return list;
}

async function listDistinctDepartments(conn) {
  const [rows] = await conn.execute(
    `SELECT department, COUNT(*) AS user_count
     FROM users
     WHERE department IS NOT NULL AND TRIM(department) <> ''
     GROUP BY department
     ORDER BY department ASC`,
  );
  return rows;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const mappings = loadMappings();
  const conn = await pool.getConnection();

  try {
    const [categories] = await conn.execute(
      'SELECT id, name FROM employee_category WHERE is_active = 1 ORDER BY name ASC',
    );
    const categoryNames = new Set(categories.map((c) => c.name));

    console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'APPLY'}`);
    console.log(`Categories in Config: ${categories.length}`);
    console.log(`Mappings to process: ${mappings.length}\n`);

    let totalUpdated = 0;

    for (const { category, legacyDepartment } of mappings) {
      if (!categoryNames.has(category)) {
        console.warn(`[skip] Category not found in employee_category: "${category}"`);
        continue;
      }

      const [[{ matchCount }]] = await conn.execute(
        'SELECT COUNT(*) AS matchCount FROM users WHERE department = ?',
        [legacyDepartment],
      );

      if (category === legacyDepartment) {
        console.log(
          `[ok] "${legacyDepartment}" already matches category "${category}" (${matchCount} user(s))`,
        );
        continue;
      }

      if (matchCount === 0) {
        console.log(`[ok] No users with legacy department "${legacyDepartment}"`);
        continue;
      }

      if (dryRun) {
        console.log(
          `[dry-run] Would update ${matchCount} user(s): "${legacyDepartment}" -> "${category}"`,
        );
        totalUpdated += matchCount;
        continue;
      }

      const [result] = await conn.execute(
        'UPDATE users SET department = ? WHERE department = ?',
        [category, legacyDepartment],
      );
      console.log(
        `[updated] ${result.affectedRows} user(s): "${legacyDepartment}" -> "${category}"`,
      );
      totalUpdated += result.affectedRows;
    }

    const departments = await listDistinctDepartments(conn);
    const mappedLegacy = new Set(mappings.map((m) => m.legacyDepartment));
    const mappedCategories = new Set(mappings.map((m) => m.category));
    const unmapped = departments.filter(
      (row) => !mappedLegacy.has(row.department) && !mappedCategories.has(row.department),
    );

    console.log('\n--- Remaining distinct departments on users ---');
    if (departments.length === 0) {
      console.log('(none)');
    } else {
      for (const row of departments) {
        const tag = unmapped.some((u) => u.department === row.department) ? ' UNMAPPED' : '';
        console.log(`  "${row.department}" — ${row.user_count} user(s)${tag}`);
      }
    }

    if (unmapped.length > 0) {
      console.log(
        `\nNote: ${unmapped.length} department value(s) are not covered by the mapping file.`,
      );
      console.log('Add entries to employee-department-category-mapping.json if needed.');
    }

    console.log(`\nDone. ${dryRun ? 'Would update' : 'Updated'} ${totalUpdated} user row(s).`);
  } catch (err) {
    console.error('Department mapping failed:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
