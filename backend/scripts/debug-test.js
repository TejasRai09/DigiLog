const { pool } = require('../config/mysql');
const http = require('http');

async function runTest() {
  const [[cnt1]] = await pool.query('SELECT COUNT(*) as count FROM cnt_performance');
  const [[g1]] = await pool.query('SELECT COUNT(*) as count FROM g_ctc');
  console.log('Before API request:');
  console.log('  cnt_performance:', cnt1.count);
  console.log('  g_ctc:', g1.count);
  
  // Make API request
  console.log('Making API request...');
  await new Promise((resolve) => {
    http.get('http://localhost:5000/api/bi/cane-performance/procurement?from=2025-10-01&to=2025-11-30', (res) => {
      console.log('API Response Status:', res.statusCode);
      resolve();
    }).on('error', (e) => {
      console.log('API Error:', e.message);
      resolve();
    });
  });
  
  const [[cnt2]] = await pool.query('SELECT COUNT(*) as count FROM cnt_performance');
  const [[g2]] = await pool.query('SELECT COUNT(*) as count FROM g_ctc');
  console.log('After API request:');
  console.log('  cnt_performance:', cnt2.count);
  console.log('  g_ctc:', g2.count);
  
  process.exit(0);
}
runTest();
