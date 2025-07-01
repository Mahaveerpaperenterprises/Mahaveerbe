require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString : process.env.DATABASE_URL,
  ssl              : { rejectUnauthorized: false }
});

module.exports = pool;        // every file can now:  const pool = require('./db');
