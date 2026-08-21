'use strict';

// Load and validate env vars before anything else
const env = require('./config/env');
const app = require('./app');
const { pool } = require('./config/db');
const { startAllJobs } = require('./jobs');

const PORT = env.PORT;

async function start() {
  // Start the HTTP server first so Render detects the port
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n[INFLX] API running on http://0.0.0.0:${PORT}`);
    console.log(`[INFLX] Environment: ${env.NODE_ENV}`);
    console.log(`[INFLX] Apify mock: ${env.APIFY_MOCK ? 'ON (fixture data)' : 'OFF (live scrape)'}`);
  });

  // Verify database connectivity
  try {
    await pool.query('SELECT 1');
    console.log(`[DB] Connected to PostgreSQL`);
  } catch (err) {
    console.error('[DB] Failed to connect to PostgreSQL:', err.message);
    console.error('Ensure DATABASE_URL is set correctly and PostgreSQL is running.');
    process.exit(1);
  }

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
