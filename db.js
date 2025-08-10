/*require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString : process.env.DATABASE_URL,
  ssl              : { rejectUnauthorized: false }
});

module.exports = pool;        // every file can now:  const pool = require('./db'); */

require('dotenv').config();
const { Pool } = require('pg');

const dbUrl = process.env.DATABASE_URL ||
  'postgresql://2p9c58:xau_P0AXHjI0JWau97sEpBWNuFry3gMSm2b00@eu-central-1.sql.xata.sh/test:main?sslmode=require';

const isLocal = dbUrl.includes('localhost');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

module.exports = pool;
