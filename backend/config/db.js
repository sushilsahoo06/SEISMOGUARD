const { Pool } = require('pg');
require('dotenv').config();

// Use direct Neon connection to avoid PgBouncer session drops
const connectionString = (process.env.DATABASE_URL || '').replace('-pooler.', '.');

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false, // Required for Neon SSL connection
  },
  max: 10,
  idleTimeoutMillis: 15000,
  connectionTimeoutMillis: 15000,
});

let hasLoggedDbConnect = false;
pool.on('connect', () => {
  if (!hasLoggedDbConnect) {
    console.log('Connected to Neon PostgreSQL database pool');
    hasLoggedDbConnect = true;
  }
});

pool.on('error', (err) => {
  console.warn('Database pool client notice (auto-reconnecting):', err.message);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
