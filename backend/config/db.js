const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon SSL connection
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log('Connected to Neon PostgreSQL database pool');
});

pool.on('error', (err) => {
  console.error('Unexpected database client error:', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};