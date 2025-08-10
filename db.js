/*require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString : process.env.DATABASE_URL,
  ssl              : { rejectUnauthorized: false }
});

module.exports = pool;        // every file can now:  const pool = require('./db'); */






require('dotenv').config();
const { Pool } = require('pg');

const FALLBACK_DATABASE_URL = 'postgresql://2p9c58:xau_P0AXHjI0JWau97sEpBWNuFry3gMSm2b00@eu-central-1.sql.xata.sh/test:main?sslmode=require';
const connectionString = process.env.DATABASE_URL || FALLBACK_DATABASE_URL;

if (!process.env.DATABASE_URL) {
  console.warn('[db] DATABASE_URL not set; using fallback connection string.');
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client', err);
});

module.exports = pool; 
