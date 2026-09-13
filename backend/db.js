const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'sensordb',
  password: 'your_postgres_password', // change to your password
  port: 5432,
});

module.exports = pool;