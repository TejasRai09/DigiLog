const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
  const url = process.env.DATABASE_URL;
  console.log('Connecting to:', url);
  try {
    const conn = await mysql.createConnection(url);
    const [rows] = await conn.query('SHOW DATABASES');
    console.log('Databases on this host:');
    console.log(rows);
    await conn.end();
  } catch (err) {
    console.error('Error connecting to MySQL:', err);
  }
}

main();


