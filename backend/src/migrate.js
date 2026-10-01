require('dotenv').config();
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({
    uri: process.env.DATABASE_URL, multipleStatements: true,
    ...(process.env.DB_SSL === 'true' && { ssl: { rejectUnauthorized: false } }),
  });
  await c.query(require('fs').readFileSync(__dirname + '/../schema.sql', 'utf8'));
  console.log('Schema created'); process.exit(0);
})();