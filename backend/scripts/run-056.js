'use strict';

/**
 * Apply migration 056 — INFLX Meals P0 data foundation.
 * Per run-055.js / run-058.js precedent. Forward-only, idempotent, additive.
 * Contract: features/meals-schema/.
 *
 * BACKFILL NOTE: 056 + 057 were authored and locked but never received a
 * run-0XX.js runner, so they were the only migrations skipped on the Render/
 * Supabase prod DB (run scripts jump 055 → 058). Result: `meal_offer_rules`
 * and the other 8 meals tables do not exist on prod, so every /v1/meals/*
 * endpoint 500s (42P01 undefined_table). This restores them.
 *
 * Creates 9 tables (restaurant_meal_config, meal_slots, meal_offer_rules,
 * meal_intents, meal_offers, meal_orders, meal_restaurant_learnings,
 * meal_customer_preferences, meal_conversations) + 6 enums + indexes +
 * updated_at triggers. SCHEMA ONLY — no backfill.
 *
 * Safe to re-run: every CREATE uses IF NOT EXISTS / DO $$ EXCEPTION
 * WHEN duplicate_object.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

(async () => {
  const url = process.env.DATABASE_URL || '';
  // Auto-detect: local Postgres (Docker on localhost) does not speak SSL;
  // Supabase/prod requires it. Override with PGSSL=disable / PGSSL=require.
  const isLocal = /\/\/[^@]*@(localhost|127\.0\.0\.1)[:\/]/.test(url);
  const sslMode =
    process.env.PGSSL === 'disable' ? false :
    process.env.PGSSL === 'require' ? { rejectUnauthorized: false } :
    isLocal                          ? false :
                                       { rejectUnauthorized: false };
  const c = new Client({ connectionString: url, ssl: sslMode });
  await c.connect();
  console.log(`Target: ${url.replace(/:[^:@]+@/, ':***@')}`);

  const f = '056_meals_schema.sql';
  const sql = fs.readFileSync(path.join(__dirname, '../migrations', f), 'utf8');
  process.stdout.write(`Running ${f} ... `);
  await c.query(sql);
  console.log('OK');

  // ── Sanity probes ─────────────────────────────────────────────────────────

  // 9 meals tables present
  const MEALS_TABLES = [
    'restaurant_meal_config', 'meal_slots', 'meal_offer_rules', 'meal_intents',
    'meal_offers', 'meal_orders', 'meal_restaurant_learnings',
    'meal_customer_preferences', 'meal_conversations',
  ];
  const { rows: tbls } = await c.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)
      ORDER BY table_name`,
    [MEALS_TABLES]
  );
  console.log(`\nTables present (${tbls.length}/9):`);
  console.table(tbls);
  if (tbls.length !== 9) {
    console.error(`\n⚠️  Expected 9 meals tables — got ${tbls.length}`);
    process.exit(2);
  }

  // 6 meals enums present
  const MEALS_ENUMS = [
    'meal_party_size', 'meal_offer_kind', 'meal_offer_status',
    'meal_intent_status', 'meal_presented_status', 'meal_order_status',
  ];
  const { rows: enums } = await c.query(
    `SELECT typname FROM pg_type
      WHERE typname = ANY($1) AND typtype = 'e' ORDER BY typname`,
    [MEALS_ENUMS]
  );
  console.log(`\nEnums present (${enums.length}/6):`);
  console.table(enums);
  if (enums.length !== 6) {
    console.error(`\n⚠️  Expected 6 meals enums — got ${enums.length}`);
    process.exit(2);
  }

  // The table whose absence caused the prod 500 must now exist + be queryable.
  const { rows: probe } = await c.query('SELECT COUNT(*)::int AS n FROM meal_offer_rules');
  console.log(`\nmeal_offer_rules now queryable — row count: ${probe[0].n}`);

  await c.end();
  console.log('\nDone.');
})().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
