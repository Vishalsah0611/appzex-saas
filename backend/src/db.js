const mysql = require('mysql2/promise');
module.exports = mysql.createPool({
  uri: process.env.DATABASE_URL,
  connectionLimit: 10,
  dateStrings: true,
  ...(process.env.DB_SSL === 'true' && { ssl: { rejectUnauthorized: false } }),
});