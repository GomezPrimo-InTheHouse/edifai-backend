const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: 'postgres.mjhgxssercxlknfkfnjh',
  password: process.env.PGPASSWORD,
  host: 'aws-1-us-east-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;