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
};