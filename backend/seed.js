/**
 * Seed MySQL with:
 *  - 1 admin user  (admin@gsma.com / Admin@123)
 *  - 3 apps
 *  - 13 forms
 *
 * Run: node seed.js
 */

require('./config/env');
const bcrypt   = require('bcryptjs');
const { pool } = require('./config/mysql');

// ─── Definitions ─────────────────────────────────────────────

const appDefs = [
  {
    name:        'GSMA Mill Logbook',
    description: 'Mill equipment temperatures, shredder, lube pressure and stoppages',
    icon:        'MdPrecisionManufacturing',
    color:       '#10B981',
    sort_order:  1,
  },
  {
    name:        'GSMA Lab Logbook',
    description: 'DS, RS, Ops, Special analysis, Syrup and Stoppage logbooks',
    icon:        'MdScience',
    color:       '#3B82F6',
    sort_order:  2,
  },
  {
    name:        'GSMA Power Logbook',
    description: 'Power, Steam and Stoppage details for the power house',
    icon:        'MdPower',
    color:       '#F59E0B',
    sort_order:  3,
  },
];

const formDefs = [
  // App 1 – Mill Logbook
  { name: 'Equipment Temperature',           description: 'Motor and bearing temperatures for all mill equipment', formKey: 'mill_logbook1',    app: 'GSMA Mill Logbook',  sort_order: 1 },
  { name: 'Shredder and OTG',                description: 'Shredder motor, bearing and OTG mill temperatures',    formKey: 'mill_logbook2',    app: 'GSMA Mill Logbook',  sort_order: 2 },
  { name: 'Lube Pressure and Roller Temp',   description: 'Lube pressure readings and roller temperatures',       formKey: 'mill_logbook3',    app: 'GSMA Mill Logbook',  sort_order: 3 },
  { name: 'Mill Stoppages',                  description: 'Mill stoppage events with section and remarks',        formKey: 'mill_stoppages',   app: 'GSMA Mill Logbook',  sort_order: 4 },

  // App 2 – Lab Logbook
  { name: 'DS Logbook',                      description: 'Direct sulphitation process logbook',                  formKey: 'ds_logbook',       app: 'GSMA Lab Logbook',   sort_order: 1 },
  { name: 'RS Logbook',                      description: 'Remelt sulphitation process logbook',                  formKey: 'rs_logbook',       app: 'GSMA Lab Logbook',   sort_order: 2 },
  { name: 'Operations Logbook',              description: 'Daily operations summary logbook',                     formKey: 'ops_logbook',      app: 'GSMA Lab Logbook',   sort_order: 3 },
  { name: 'Special Analysis Logbook',        description: 'Special product analysis logbook',                     formKey: 'sa_logbook',       app: 'GSMA Lab Logbook',   sort_order: 4 },
  { name: 'Syrup Logbook',                   description: 'Syrup production and diversion logbook',               formKey: 'syrp_logbook',     app: 'GSMA Lab Logbook',   sort_order: 5 },
  { name: 'Stoppage Logbook',                description: 'Lab and process stoppage logbook',                     formKey: 'stoppage_logbook', app: 'GSMA Lab Logbook',   sort_order: 6 },

  // App 3 – Power Logbook
  { name: 'Power Details',                   description: 'Power generation and consumption details',             formKey: 'ph_power',         app: 'GSMA Power Logbook', sort_order: 1 },
  { name: 'Steam Details',                   description: 'Steam generation and consumption details',             formKey: 'ph_steam',         app: 'GSMA Power Logbook', sort_order: 2 },
  { name: 'Stoppage Details',                description: 'Power house stoppage details',                        formKey: 'ph_stoppage',      app: 'GSMA Power Logbook', sort_order: 3 },
];

// ─── Seed ─────────────────────────────────────────────────────

const seed = async () => {
  console.log('🌱  Seeding MySQL...');

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
