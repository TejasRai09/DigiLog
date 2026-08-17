/**
 * Seed MySQL with:
 *  - 1 admin user  (admin@gsma.com / Admin@123)
 *  - 10 apps (incl. Mill House / Power / EHS hub modules and BI Control Tower for employee mapping)
 *  - 20 forms
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
    name:        'Power Plant Equipment History (old)',
    description: 'Electrical, Instrument and control valve history cards for the 30MW power plant',
    icon:        'MdFlashOn',
    color:       '#D97706',
    sort_order:  11,
  },
  {
    name:        'Power Plant Equipment History',
    description: 'Boiler, turbine and WTP equipment hierarchy — browse by cards or tree',
    icon:        'MdFlashOn',
    color:       '#EA580C',
    sort_order:  10,
  },
  {
    name:        'Sugar House Equipment History',
    description: 'Sugar plant equipment hierarchy — browse by section, location and equipment',
    icon:        'MdDomain',
    color:       '#8B5CF6',
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
    name:        'Production',
    description: 'Pan boiling, clarification, decanter and centrifugal shift logs',
    icon:        'MdFactory',
    color:       '#D97706',
    sort_order:  8,
  },
  {
    name:        'BI Control Tower',
    description: 'Business intelligence dashboards (employee-mapped)',
    icon:        'MdInsights',
    color:       '#6366F1',
    sort_order:  9,
  },
  {
    name:        'Brix Sampling Forms',
    description: 'Yard and Field Area Brix measurement and Analysis',
    icon:        'MdScience',
    color:       '#0284C7',
    sort_order:  10,
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

  // Hub modules — equipment history cards (single hub entry, opens card-browser)
  { name: 'Mill House equipment',  description: 'Open equipment life history cards',            formKey: 'digilog_hub_mill_equipment',  app: 'Mill House Equipment History',    sort_order: 1 },
  { name: 'Power Plant equipment', description: 'Open power plant equipment history cards',     formKey: 'digilog_hub_power_equipment', app: 'Power Plant Equipment History (old)', sort_order: 1 },
  { name: 'Power Plant equipment hierarchy', description: 'Browse 150TPH/70TPH boilers, STG and WTP equipment', formKey: 'digilog_hub_power_equipment_new', app: 'Power Plant Equipment History', sort_order: 1 },
  { name: 'Sugar House equipment hierarchy', description: 'Browse sugar plant equipment by section, location, main and sub equipment', formKey: 'digilog_hub_sugar_equipment_new', app: 'Sugar House Equipment History', sort_order: 1 },

  // EHS — individual submit forms
  { name: 'Accident Report',    description: 'Log workplace accidents for investigation', formKey: 'ehs_near_miss',  app: 'EHS — Environment Health & Safety', sort_order: 1 },
  { name: 'Water Dashboard — Ground Water Abstraction', description: 'Daily bore well extraction and usage report',                         formKey: 'ehs_water_gwa', app: 'EHS — Environment Health & Safety', sort_order: 2 },
  { name: 'Water Dashboard — ETP Working',              description: 'Effluent Treatment Plant daily quantity and quality report',          formKey: 'ehs_water_etp', app: 'EHS — Environment Health & Safety', sort_order: 3 },
  { name: 'Water Dashboard — CPU Water Recycle',        description: 'CPU inlet/outlet daily report with quality parameters',              formKey: 'ehs_water_cpu', app: 'EHS — Environment Health & Safety', sort_order: 4 },
  { name: 'Daily Safety Toolbox Talk',                    description: 'Record daily toolbox talk session with attendance and session photos', formKey: 'ehs_toolbox_talk', app: 'EHS — Environment Health & Safety', sort_order: 5 },

  // Production — individual submit forms
  { name: 'Shift Chemist Job Log Book',              description: 'Log jobs done and pending tasks for each shift chemist',                      formKey: 'prod_shift_chemist',  app: 'Production', sort_order: 1 },
  { name: 'A-Centrifugal Machine Stoppage Log Book', description: 'Machine run/stoppage details and thermodynamic parameters per shift',         formKey: 'prod_centrifugal',    app: 'Production', sort_order: 2 },
  { name: 'Pan Log Book',                            description: 'Boiling operation details by massecuite grade with lab analysis',             formKey: 'prod_pan_logbook',    app: 'Production', sort_order: 3 },
  { name: 'Decanter Log Book',                       description: 'Hourly 1st and 2nd stage decanter readings per shift',                       formKey: 'prod_decanter',       app: 'Production', sort_order: 4 },
  { name: 'Clarification Log Book',                  description: 'Hourly juice clarification readings and process parameters',                 formKey: 'prod_clarification',  app: 'Production', sort_order: 5 },

  // Brix Sampling Forms
  { name: 'GSMA Yard Brix Sampling Form 23-24',      description: 'Yard Area Brix measurement and Analysis Form',                               formKey: 'brix_yard_sampling',  app: 'Brix Sampling Forms', sort_order: 1 },
  { name: 'GSMA Field Brix Sampling Form 23-24',     description: 'Cane Area Brix measurement and Analysis Form',                               formKey: 'brix_field_sampling', app: 'Brix Sampling Forms', sort_order: 2 },

  // BI dashboards (routes under /bi/…; mapped via forms like other apps)
  {
    name: 'Distillery Operations — Analytics',
    description: 'KPIs, trends and daily log from distillery operations data',
    formKey: 'bi_distillery_operations',
    app: 'BI Control Tower',
    sort_order: 1,
  },
  {
    name: 'Milling Division Cockpit',
    description: 'Mill outages, equipment temperature and lube oil analytics from the milling division',
    formKey: 'bi_milling_operations',
    app: 'BI Control Tower',
    sort_order: 2,
  },
  {
    name: 'Purchy Analysis',
    description: 'Grower performance year-wise summary and purchy dishonour analysis',
    formKey: 'bi_purchy_analysis',
    app: 'BI Control Tower',
    sort_order: 3,
  },
  {
    name: 'Brix Sampling Analytics',
    description: 'Field & Yard intelligence — Brix sampling trends, crop maturity, and consignment quality',
    formKey: 'bi_brix_sampling',
    app: 'BI Control Tower',
    sort_order: 4,
  },
  {
    name: 'Centre Maturity Dashboard',
    description: 'Centre maturity analysis and season vs season indent and purchase metrics',
    formKey: 'bi_centre_maturity',
    app: 'BI Control Tower',
    sort_order: 5,
  },
  {
    name: 'Cane Performance Dashboard',
    description: 'Procurement Summary, Gate and Center Handling, Vehicle Transit and Holding Analytics',
    formKey: 'bi_cane_performance',
    app: 'BI Control Tower',
    sort_order: 6,
  },
  {
    name: 'Power House Dashboard',
    description: 'Power generation, steam, and outage analytics from power logbook data',
    formKey: 'bi_power_house',
    app: 'BI Control Tower',
    sort_order: 7,
  },
  {
    name: 'Management Dashboard',
    description: 'Executive KPI summary across cane, milling, sugar, power and distillery',
    formKey: 'bi_management_dashboard',
    app: 'BI Control Tower',
    sort_order: 8,
  },
];

// Renamed apps (re-seed used to INSERT new rows because `name` is unique).
const APP_RENAMES = [
  { oldName: 'GSMA Mill Logbook', newName: 'Mill Logbook' },
  { oldName: 'GSMA Lab Logbook', newName: 'Lab Logbook' },
  { oldName: 'GSMA Power Logbook', newName: 'Power Logbook' },
  { oldName: 'GSMA Distillery Operations', newName: 'Distillery Operations' },
  { oldName: 'Power Plant Equipment History', newName: 'Power Plant Equipment History (old)' },
  { oldName: 'Power Plant Equipment History (new)', newName: 'Power Plant Equipment History' },
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

/**
 * Remove stale hub-entry forms that were replaced with individual forms.
 * These keys are no longer meaningful in the forms registry.
 */
const STALE_HUB_KEYS = ['digilog_hub_ehs', 'digilog_hub_production'];

async function removeStaleHubForms(pool) {
  for (const key of STALE_HUB_KEYS) {
    const [[row]] = await pool.query('SELECT id FROM forms WHERE form_key = ? LIMIT 1', [key]);
    if (row) {
      await pool.query('DELETE FROM forms WHERE form_key = ?', [key]);
      console.log(`  🗑️   Removed stale hub form: ${key}`);
    }
  }
}

// ─── Seed ─────────────────────────────────────────────────────

const seed = async () => {
  console.log('🌱  Seeding MySQL...');

  await mergeRenamedApps(pool);
  await removeStaleHubForms(pool);

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
