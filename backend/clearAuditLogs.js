const { pool } = require('./config/mysql');

async function main() {
  console.log('Clearing all data from audit_logs table...');
  
  try {
    const [auditRes] = await pool.query('TRUNCATE TABLE audit_logs');
    console.log('✅ Successfully deleted all records from the audit_logs table.');

    const [activityRes] = await pool.query('TRUNCATE TABLE user_activity_logs');
    console.log('✅ Successfully deleted all records from the user_activity_logs table.');

    const [sessionRes] = await pool.query('TRUNCATE TABLE user_sessions');
    console.log('✅ Successfully deleted all records from the user_sessions table.');
  } catch (error) {
    console.error('❌ Error clearing audit_logs:', error.message);
  } finally {
    process.exit(0);
  }
}

main();
