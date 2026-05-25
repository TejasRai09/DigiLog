/**
 * Seed MySQL with:
 *  - 1 admin user  (admin@gsma.com / Admin@123)
 *  - 8 apps (incl. Mill House / Power / EHS hub modules and BI Control Tower for employee mapping)
 *  - 18 forms
 *
 * Run: node seed.js
 */

require('./config/env');
const bcrypt   = require('bcryptjs');
const { pool } = require('./config/mysql');

// ─── Definitions ─────────────────────────────────────────────

const appDefs = [
  {
    name:        'Mill Logbook',
    description: 'Mill equipment temperatures, shredder, lube pressure and stoppages',
    icon:        'MdPrecisionManufacturing',
    color:       '#10B981',
    sort_order:  1,
  },
  {
    name:        'Lab Logbook',
    description: 'DS, RS, Ops, Special analysis, Syrup and Stoppage logbooks',
    icon:        'MdScience',
    color:       '#3B82F6',
    sort_order:  2,
  },
  {
    name:        'Power Logbook',
    description: 'Power, Steam and Stoppage details for the power house',
    icon:        'MdPower',
    color:       '#F59E0B',
    sort_order:  3,
  },
  {
    name:        'Distillery Operations',
    description: 'Daily operations tracking for the distillery',
    icon:        'MdLocalBar',
    color:       '#0D9488',
    sort_order:  4,
  },
  {
    name:        'Mill House Equipment History',
    description: 'Equipment life history cards — specs, OEM schedule and maintenance history',
    icon:        'MdPrecisionManufacturing',
    color:       '#7C3AED',
    sort_order:  5,
  },
  {
    name:        'Power Plant Equipment History',
    description: 'Electrical, Instrument and control valve history cards for the 30MW power plant',
    icon:        'MdFlashOn',
    color:       '#D97706',
    sort_order:  6,
  },
  {
    name:        'EHS — Environment Health & Safety',
    description: 'Incident reports, accident register and water dashboard',
    icon:        'MdSecurity',
    color:       '#16A34A',
    sort_order:  7,
  },
  {
    name:        'BI Control Tower',
    description: 'Business intelligence dashboards (employee-mapped)',
    icon:        'MdInsights',
    color:       '#6366F1',
    sort_order:  8,
  },
];

const formDefs = [
  // App 1 – Mill Logbook
  { name: 'Equipment Temperature',           description: 'Motor and bearing temperatures for all mill equipment', formKey: 'mill_logbook1',    app: 'Mill Logbook',  sort_order: 1 },
  { name: 'Shredder and OTG',                description: 'Shredder motor, bearing and OTG mill temperatures',    formKey: 'mill_logbook2',    app: 'Mill Logbook',  sort_order: 2 },
  { name: 'Lube Pressure and Roller Temp',   description: 'Lube pressure readings and roller temperatures',       formKey: 'mill_logbook3',    app: 'Mill Logbook',  sort_order: 3 },
  { name: 'Mill Stoppages',                  description: 'Mill stoppage events with section and remarks',        formKey: 'mill_stoppages',   app: 'Mill Logbook',  sort_order: 4 },

  // App 2 – Lab Logbook
  { name: 'DS Logbook',                      description: 'Direct sulphitation process logbook',                  formKey: 'ds_logbook',       app: 'Lab Logbook',   sort_order: 1 },
  { name: 'RS Logbook',                      description: 'Remelt sulphitation process logbook',                  formKey: 'rs_logbook',       app: 'Lab Logbook',   sort_order: 2 },
  { name: 'Operations Logbook',              description: 'Daily operations summary logbook',                     formKey: 'ops_logbook',      app: 'Lab Logbook',   sort_order: 3 },
  { name: 'Special Analysis Logbook',        description: 'Special product analysis logbook',                     formKey: 'sa_logbook',       app: 'Lab Logbook',   sort_order: 4 },
  { name: 'Syrup Logbook',                   description: 'Syrup production and diversion logbook',               formKey: 'syrp_logbook',     app: 'Lab Logbook',   sort_order: 5 },
  { name: 'Stoppage Logbook',                description: 'Lab and process stoppage logbook',                     formKey: 'stoppage_logbook', app: 'Lab Logbook',   sort_order: 6 },

  // App 3 – Power Logbook
  { name: 'Power Details',                   description: 'Power generation and consumption details',             formKey: 'ph_power',         app: 'Power Logbook', sort_order: 1 },
  { name: 'Steam Details',                   description: 'Steam generation and consumption details',             formKey: 'ph_steam',         app: 'Power Logbook', sort_order: 2 },
  { name: 'Stoppage Details',                description: 'Power house stoppage details',                        formKey: 'ph_stoppage',      app: 'Power Logbook', sort_order: 3 },

  // App 4 – Distillery
  { name: 'Distillery Operations Form', description: 'Daily operations tracking form for the distillery', formKey: 'distillery_ops', app: 'Distillery Operations', sort_order: 1 },

  // Hub modules (DigiLog routes — not submit-style forms; form_key opens /equipment, /power, /ehs)
  { name: 'Mill House equipment', description: 'Open equipment life history cards', formKey: 'digilog_hub_mill_equipment', app: 'Mill House Equipment History', sort_order: 1 },
  { name: 'Power Plant equipment', description: 'Open power plant equipment history cards', formKey: 'digilog_hub_power_equipment', app: 'Power Plant Equipment History', sort_order: 1 },
  { name: 'EHS home', description: 'Open EHS forms and dashboards', formKey: 'digilog_hub_ehs', app: 'EHS — Environment Health & Safety', sort_order: 1 },

  // BI dashboards (routes under /bi/…; mapped via forms like other apps)
  {
    name: 'Distillery Operations — Analytics',
    description: 'KPIs, trends and daily log from distillery operations data',
    formKey: 'bi_distillery_operations',
    app: 'BI Control Tower',
    sort_order: 1,
  },
];

// Renamed apps (re-seed used to INSERT new rows because `name` is unique).
const APP_RENAMES = [
  { oldName: 'GSMA Mill Logbook', newName: 'Mill Logbook' },
  { oldName: 'GSMA Lab Logbook', newName: 'Lab Logbook' },
  { oldName: 'GSMA Power Logbook', newName: 'Power Logbook' },
  { oldName: 'GSMA Distillery Operations', newName: 'Distillery Operations' },
];

async function mergeRenamedApps(pool) {
  for (const { oldName, newName } of APP_RENAMES) {
    const [[oldRow]] = await pool.query('SELECT id FROM apps WHERE name = ? LIMIT 1', [oldName]);
    const [[newRow]] = await pool.query('SELECT id FROM apps WHERE name = ? LIMIT 1', [newName]);
    if (!oldRow) continue;
    if (!newRow) {
      await pool.query('UPDATE apps SET name = ? WHERE id = ?', [newName, oldRow.id]);
      continue;
    }
    if (oldRow.id === newRow.id) continue;

    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM forms WHERE app_id = ?', [oldRow.id]);
    if (n > 0) {
      await pool.query('UPDATE forms SET app_id = ? WHERE app_id = ?', [newRow.id, oldRow.id]);
    }

    const [maps] = await pool.query('SELECT id, user_id FROM mappings WHERE app_id = ?', [oldRow.id]);
    for (const m of maps) {
      const [[dup]] = await pool.query(
        'SELECT id FROM mappings WHERE user_id = ? AND app_id = ? LIMIT 1',
        [m.user_id, newRow.id],
      );
      if (dup) await pool.query('DELETE FROM mappings WHERE id = ?', [m.id]);
      else await pool.query('UPDATE mappings SET app_id = ? WHERE id = ?', [newRow.id, m.id]);
    }

    await pool.query('DELETE FROM apps WHERE id = ?', [oldRow.id]);
  }
}

// ─── Seed ─────────────────────────────────────────────────────

const seed = async () => {
  console.log('🌱  Seeding MySQL...');

  await mergeRenamedApps(pool);

  // 1. Admin user
  const adminHash = await bcrypt.hash('Admin@123', 12);
  await pool.query(
    `INSERT INTO users (name, email, password, role, auth_provider, is_active, mail_sent)
     VALUES ('Admin', 'admin@gsma.com', ?, 'admin', 'local', 1, 1)
     ON DUPLICATE KEY UPDATE password = VALUES(password), role = 'admin', is_active = 1`,
    [adminHash]
  );
  console.log('  ✅  Admin user: admin@gsma.com / Admin@123');

  // 2. Apps
  const appIdMap = {};
  for (const a of appDefs) {
    await pool.query(
      `INSERT INTO apps (name, description, icon, color, sort_order)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description), icon = VALUES(icon),
                               color = VALUES(color), sort_order = VALUES(sort_order)`,
      [a.name, a.description, a.icon, a.color, a.sort_order]
    );
    const [[row]] = await pool.query('SELECT id FROM apps WHERE name = ?', [a.name]);
    appIdMap[a.name] = row.id;
    console.log(`  ✅  App: ${a.name} (id=${row.id})`);
  }

  // 3. Forms
  for (const f of formDefs) {
    const appId = appIdMap[f.app];
    if (!appId) { console.warn(`  ⚠️   App not found for form "${f.name}"`); continue; }

    await pool.query(
      `INSERT INTO forms (name, description, form_key, app_id, sort_order)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description),
                               app_id = VALUES(app_id), sort_order = VALUES(sort_order)`,
      [f.name, f.description, f.formKey, appId, f.sort_order]
    );
    console.log(`  ✅  Form: ${f.name} (${f.formKey})`);
  }

  console.log('\n🎉  Seed complete!');
  process.exit(0);
};

seed().catch((err) => {
  console.error('❌  Seed failed:', err.message);
  process.exit(1);
});
