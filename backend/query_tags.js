const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function main() {
  const url = process.env.DATABASE_URL;
  console.log('Connecting to:', url);
  try {
    const conn = await mysql.createConnection(url);

    console.log('\n--- shn_hierarchy_node entries matching 016 or 018 ---');
    const [hierRows] = await conn.query(
      `SELECT id, name, equip_no, lookup_name, shn_equip_id 
       FROM shn_hierarchy_node 
       WHERE equip_no LIKE '%016%' OR equip_no LIKE '%018%'`
    );
    console.log(hierRows);

    console.log('\n--- shn_equipment entries matching 016 or 018 ---');
    const [equipRows] = await conn.query(
      `SELECT id, name, equip_no, tag_name 
       FROM shn_equipment 
       WHERE equip_no LIKE '%016%' OR equip_no LIKE '%018%' OR tag_name LIKE '%016%' OR tag_name LIKE '%018%'`
    );
    console.log(equipRows);

    await conn.end();
  } catch (err) {
    console.error('Error:', err);
  }
}
main();
