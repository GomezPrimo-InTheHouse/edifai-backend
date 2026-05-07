const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL
  ? decodeURIComponent(process.env.DATABASE_URL)
  : undefined;

console.log('Connecting to DB...');

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;