/**
 * Copy the sampling date people entered on the Brix forms from audit_logs
 * into brix_yard_sampling and brix_field_sampling.
 *
 * Does NOT truncate, delete, or reload either table.
 * Existing rows are updated in place (Date only) when the audit save can be
 * matched to the row that was written at the same time.
 * A row is inserted only when that save is not already in the table.
 *
 * Dry run (default — prints what would change, writes nothing):
 *   node scripts/backfill-brix-dates-from-audit.js
 *
 * Apply on production (from DigiLog/backend, using that server's .env):
 *   node scripts/backfill-brix-dates-from-audit.js --apply
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool } = require('../config/mysql');

const APPLY = process.argv.includes('--apply');
const MATCH_SECONDS = 180;

const FORMS = {
  brix_yard_sampling: {
    table: 'brix_yard_sampling',
    text: [
      ['Name', 'Name', 100],
      ['Delivery Point', 'DeliveryPoint', 50],
      ['Village Or Center Code', 'VillageOrCenterCode', 50],
      ['Grower Code', 'GrowerCode', 50],
      ['Truck Number', 'TruckNumber', 50],
      ['Vehicle Type', 'VehicleType', 50],
      ['Variety Of Cane', 'VarietyOfCane', 100],
      ['Crop Type', 'CropType', 50],
      ['Diseased Cane', 'DiseasedCane', 10],
      ['Stale Cane', 'StaleCane', 10],
      ['Consignment Conditions', 'ConsignmentConditions', 50],
    ],
    numbers: [
      ['Middle Brix', 'MiddleBrix'],
    ],
  },
  brix_field_sampling: {
    table: 'brix_field_sampling',
    text: [
      ['Name', 'Name', 100],
      ['Test Type', 'TestType', 50],
      ['Grower Name', 'GrowerName', 150],
      ['Village Name', 'VillageName', 100],
      ['Variety', 'Variety', 100],
      ['Land Type', 'LandType', 50],
      ['Soil Type', 'SoilType', 50],
      ['Crop Type', 'CropType', 50],
      ['Field Condition', 'FieldCondition', 50],
      ['Crop Condition', 'CropCondition', 50],
      ['Sampling Point', 'SamplingPoint', 50],
    ],
    numbers: [
      ['Bottom Brix', 'BottomBrix'],
      ['Middle Brix', 'MiddleBrix'],
      ['Top Brix', 'TopBrix'],
    ],
  },
};

function blank(value) {
  if (value == null) return true;
  const s = String(value).trim();
  return s === '' || s === '—' || s === '-';
}

function clip(value, length) {
  if (blank(value)) return null;
  return String(value).trim().slice(0, length);
}

function num(value) {
  if (blank(value)) return null;
  const n = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function samplingDate(value) {
  if (blank(value)) return null;
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  return null;
}

function bodyMap(raw) {
  if (raw == null || raw === '') return null;
  let parsed = raw;
  if (typeof raw === 'string') {
    const text = raw.endsWith('…') ? raw.slice(0, -1) : raw;
    try {
      parsed = JSON.parse(text);
    } catch {
      return null;
    }
  }
  const map = {};
  if (parsed && Array.isArray(parsed.fields)) {
    for (const field of parsed.fields) {
      if (!field || field.field == null) continue;
      map[String(field.field).trim().toLowerCase()] = field.value;
    }
  } else if (parsed && typeof parsed === 'object') {
    for (const [key, value] of Object.entries(parsed)) {
      map[String(key).trim().toLowerCase()] = value;
    }
  }
  return map;
}

function pick(map, label) {
  if (!map) return null;
  return map[label.toLowerCase()];
}

function recordFromAudit(formKey, map) {
  const spec = FORMS[formKey];
  const date = samplingDate(pick(map, 'Date') ?? pick(map, 'date'));
  if (!date) return null;
  const row = { Date: date };
  for (const [label, column, length] of spec.text) {
    row[column] = clip(pick(map, label) ?? pick(map, column), length);
  }
  for (const [label, column] of spec.numbers) {
    row[column] = num(pick(map, label) ?? pick(map, column));
  }
  return row;
}

function sqlDate(value) {
  if (value == null) return null;
  const s = String(value);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s.slice(0, 10);
}

async function columnSet(table) {
  const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
  return new Set(cols.map((c) => c.Field));
}

async function findMatch(table, createdAt, row) {
  const brixClause = row.MiddleBrix == null
    ? '`MiddleBrix` IS NULL'
    : 'ROUND(IFNULL(`MiddleBrix`, -99999), 2) = ROUND(?, 2)';
  const [rows] = await pool.query(
    `SELECT id, \`Date\`, \`timestamp\`
     FROM \`${table}\`
     WHERE ABS(TIMESTAMPDIFF(SECOND, \`timestamp\`, ?)) <= ?
       AND LOWER(TRIM(IFNULL(Name, ''))) = LOWER(TRIM(?))
       AND ${brixClause}
     ORDER BY ABS(TIMESTAMPDIFF(SECOND, \`timestamp\`, ?)) ASC
     LIMIT 5`,
    row.MiddleBrix == null
      ? [createdAt, MATCH_SECONDS, row.Name || '', createdAt]
      : [createdAt, MATCH_SECONDS, row.Name || '', row.MiddleBrix, createdAt],
  );
  return rows;
}

async function alreadyStored(table, spec, row) {
  const where = ['`Date` = ?'];
  const params = [row.Date];
  for (const [, column] of spec.text) {
    if (row[column] == null) {
      where.push(`\`${column}\` IS NULL`);
    } else {
      where.push(`\`${column}\` = ?`);
      params.push(row[column]);
    }
  }
  for (const [, column] of spec.numbers) {
    if (row[column] == null) {
      where.push(`\`${column}\` IS NULL`);
    } else {
      where.push(`ROUND(IFNULL(\`${column}\`, -99999), 2) = ROUND(?, 2)`);
      params.push(row[column]);
    }
  }
  const [rows] = await pool.query(
    `SELECT id FROM \`${table}\` WHERE ${where.join(' AND ')} LIMIT 1`,
    params,
  );
  return rows[0] || null;
}

async function insertRow(table, spec, row, createdAt, columns) {
  const names = ['Date'];
  const values = [row.Date];
  for (const [, column] of spec.text) {
    if (!columns.has(column)) continue;
    names.push(column);
    values.push(row[column]);
  }
  for (const [, column] of spec.numbers) {
    if (!columns.has(column)) continue;
    names.push(column);
    values.push(row[column]);
  }
  if (columns.has('timestamp')) {
    names.push('timestamp');
    values.push(createdAt);
  }
  const placeholders = names.map(() => '?').join(', ');
  const colSql = names.map((c) => `\`${c}\``).join(', ');
  await pool.query(
    `INSERT INTO \`${table}\` (${colSql}) VALUES (${placeholders})`,
    values,
  );
}

async function runForm(formKey) {
  const spec = FORMS[formKey];
  const columns = await columnSet(spec.table);
  const [logs] = await pool.query(
    `SELECT id, created_at, user_name, status_code, success, request_body
     FROM audit_logs
     WHERE method = 'POST'
       AND (path = ? OR path LIKE ?)
       AND status_code >= 200 AND status_code < 300
       AND (success = 1 OR success IS NULL)
     ORDER BY id ASC`,
    [`/api/forms/${formKey}`, `/api/forms/${formKey}?%`],
  );

  const stats = {
    logs: logs.length,
    updated: 0,
    inserted: 0,
    already: 0,
    skippedNoDate: 0,
    skippedUnreadable: 0,
    skippedAmbiguous: 0,
  };

  for (const log of logs) {
    const map = bodyMap(log.request_body);
    if (!map) {
      stats.skippedUnreadable += 1;
      console.log(`  skip audit ${log.id}: request body is not readable JSON`);
      continue;
    }
    const row = recordFromAudit(formKey, map);
    if (!row) {
      stats.skippedNoDate += 1;
      console.log(`  skip audit ${log.id}: no sampling date in the saved form`);
      continue;
    }

    const matches = await findMatch(spec.table, log.created_at, row);
    if (matches.length > 1) {
      stats.skippedAmbiguous += 1;
      console.log(`  skip audit ${log.id}: ${matches.length} rows match ${row.Name} at ${log.created_at}; left unchanged`);
      continue;
    }

    if (matches.length === 1) {
      const current = sqlDate(matches[0].Date);
      if (current === row.Date) {
        stats.already += 1;
        continue;
      }
      console.log(`  update ${spec.table} id ${matches[0].id}: Date ${current || 'NULL'} -> ${row.Date} (audit ${log.id}, ${log.user_name || 'unknown'})`);
      if (APPLY) {
        await pool.query(
          `UPDATE \`${spec.table}\` SET \`Date\` = ? WHERE id = ?`,
          [row.Date, matches[0].id],
        );
      }
      stats.updated += 1;
      continue;
    }

    const existing = await alreadyStored(spec.table, spec, row);
    if (existing) {
      stats.already += 1;
      continue;
    }

    console.log(`  insert ${spec.table}: Date ${row.Date}, ${row.Name || 'no name'} (audit ${log.id}, ${log.user_name || 'unknown'})`);
    if (APPLY) {
      await insertRow(spec.table, spec, row, log.created_at, columns);
    }
    stats.inserted += 1;
  }

  return stats;
}

async function main() {
  console.log(APPLY
    ? 'APPLY: writing sampling dates. Tables will not be truncated.'
    : 'DRY RUN: no rows will be written. Re-run with --apply to save.');

  const summary = {};
  for (const formKey of Object.keys(FORMS)) {
    console.log(`\n${formKey}`);
    summary[formKey] = await runForm(formKey);
  }

  console.log('\nSummary');
  console.log(JSON.stringify(summary, null, 2));
  if (!APPLY) console.log('\nNo changes saved. Run with --apply when the dry run looks right.');
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
