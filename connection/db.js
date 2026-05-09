// const { Pool } = require('pg');
// require('dotenv').config();

// const pool = new Pool({
//   user: 'postgres.mjhgxssercxlknfkfnjh',
//   password: process.env.PGPASSWORD,
//   host: 'aws-1-us-east-1.pooler.supabase.com',
//   port: 5432,
//   database: 'postgres',
//   ssl: { rejectUnauthorized: false },
// });

// module.exports = pool;

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user:                    'postgres.mjhgxssercxlknfkfnjh',
  password:                process.env.PGPASSWORD,
  host:                    'aws-1-us-east-1.pooler.supabase.com',
  port:                    5432,
  database:                'postgres',
  ssl:                     { rejectUnauthorized: false },
  max:                     8,
  min:                     0,
  idleTimeoutMillis:       10000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Pool error:', err.message);
});

module.exports = pool;