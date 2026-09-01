const sql = require('mssql');

const config = {
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  port: parseInt(process.env.SQL_PORT || 1433, 10),
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true', // Use this if you're on Windows Azure
    trustServerCertificate: process.env.SQL_TRUST_CERT === 'true', // Change to true for local dev / self-signed certs
    requestTimeout: 60000 // 60 seconds
  }
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Connected to SQL Server successfully!');
    return pool;
  })
  .catch(err => {
    console.error('⚠️  SQL Server Connection Failed (non-fatal):', err.message);
    console.error('   The app will continue running. SQL Server dependent features will be unavailable.');
    return null; // Return null instead of crashing — APIs should check for null pool
  });

module.exports = {
  sql,
  poolPromise
};
