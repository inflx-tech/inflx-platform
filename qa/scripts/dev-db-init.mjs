#!/usr/bin/env node
'use strict';

/**
 * dev-db-init.mjs — apply ALL backend/migrations/*.sql to the dev DB
 * in numeric order. Mirrors backend/tests/setup.js (the proven
 * globalSetup pattern from qa:db): drop+recreate the public schema,
 * then iterate migrations in lexicographic order (zero-padded
 * prefixes = numeric).
 *
 * DESTRUCTIVE within the schema (DROP SCHEMA public CASCADE) — wipes
 * any existing dev data. Container + volume are unaffected (use
 * pnpm db:dev:reset for the nuclear option).
 *
 * Loud failure on missing dev DB, connection failure, or any SQL
 * error (names the failing file).
 *
 * Contract: features/setup-local-dev-environment/
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEV_DATABASE_URL, PG_CONTAINER, PG_PORT } from './dev-db-config.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// Resolve pg from backend/node_modules so this script doesn't need
// pg as a root devDep.
const require = createRequire(path.join(REPO_ROOT, 'backend', 'package.json'));
const { Client } = require('pg');

function fail(msg) { console.error(`[dev-db-init] FAIL — ${msg}`); process.exit(1); }

async function main() {
  const migDir = path.join(REPO_ROOT, 'backend', 'migrations');
  if (!fs.existsSync(migDir)) fail(`migrations dir not found: ${migDir}`);

  const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
  if (files.length === 0) fail(`no .sql files in ${migDir}`);
  console.log(`[dev-db-init] found ${files.length} migration files (001 → ${files[files.length - 1].slice(0, 3)})`);

  const client = new Client({ connectionString: DEV_DATABASE_URL });
  try { await client.connect(); }
  catch (e) { fail(`cannot connect to ${DEV_DATABASE_URL}: ${e.message}. ` +
                   `Is the container up? Run: pnpm db:dev:up`); }

  console.log(`[dev-db-init] connected to ${PG_CONTAINER}:${PG_PORT}/inflx_dev — wiping schema ...`);
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT ALL ON SCHEMA public TO public');

  let applied = 0;
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migDir, f), 'utf8');
    process.stdout.write(`[dev-db-init] ${f} ... `);
    try {
      await client.query(sql);
      applied += 1;
      console.log('OK');
    } catch (e) {
      console.log('FAIL');
      await client.end().catch(() => {});
      fail(`MIGRATION FAILED at ${f}: ${e.message}`);
    }
  }

  // Smoke probe: confirm key tables + the view shipped this window.
  const { rows: t } = await client.query(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`
  );
  const { rows: v } = await client.query(
    `SELECT count(*)::int AS n FROM information_schema.views WHERE table_schema='public'`
  );
  const { rows: vsc } = await client.query(
    `SELECT count(*)::int AS n FROM information_schema.views WHERE table_schema='public' AND table_name='v_searchable_creators'`
  );
  await client.end();

  console.log(`\n[dev-db-init] migrations applied: ${applied}/${files.length}`);
  console.log(`[dev-db-init] tables: ${t[0].n}, views: ${v[0].n}, v_searchable_creators: ${vsc[0].n === 1 ? 'present ✓' : 'MISSING ✗'}`);
  if (vsc[0].n !== 1) fail('v_searchable_creators view missing — migration 055 not applied?');
  if (t[0].n < 30) fail(`only ${t[0].n} tables — expected 30+ (the full schema). Something is off.`);
  console.log(`[dev-db-init] DONE — dev DB ready. Next: \`pnpm dev:doctor\` then \`pnpm dev:all\`.`);
}

main().catch((e) => fail(e.message));
