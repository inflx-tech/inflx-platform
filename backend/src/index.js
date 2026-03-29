'use strict';

// Load and validate env vars before anything else
const env = require('./config/env');
const app = require('./app');
const { pool } = require('./config/db');
const { startAllJobs } = require('./jobs');

const PORT = env.PORT;

async function start() {
  // Verify database connectivity before accepting traffic
  try {
    await pool.query('SELECT 1');
    console.log(`[DB] Connected to PostgreSQL`);
  } catch (err) {
    console.error('[DB] Failed to connect to PostgreSQL:', err.message);
    console.error('Ensure DATABASE_URL is set correctly and PostgreSQL is running.');
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    console.log(`\n[INFLX] API running on http://localhost:${PORT}`);
    console.log(`[INFLX] Environment: ${env.NODE_ENV}`);
    console.log(`[INFLX] OTP mock: ${env.OTP_MOCK ? 'ON (OTP = 000000)' : 'OFF (real SMS)'}`);
    console.log(`[INFLX] Apify mock: ${env.APIFY_MOCK ? 'ON (fixture data)' : 'OFF (live scrape)'}`);
  });

  // Start cron jobs
  startAllJobs();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[INFLX] SIGTERM received. Shutting down...');
    server.close(async () => {
      await pool.end();
      console.log('[INFLX] Server closed.');
      process.exit(0);
    });
  });
}

start();
