'use strict';

const { Pool } = require('pg');
const env = require('./env');

const requireSSL = env.NODE_ENV === 'production' ||
  (env.DATABASE_URL && env.DATABASE_URL.includes('supabase.com'));

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ...(requireSSL && { ssl: { rejectUnauthorized: false } }),
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterised SQL query.
 * @param {string} text  SQL string with $1, $2, … placeholders
 * @param {any[]}  params
 */
async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Run multiple queries inside a single transaction.
 * Pass a callback that receives a { query } client object.
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback({ query: (t, p) => client.query(t, p) });
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
