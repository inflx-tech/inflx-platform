#!/usr/bin/env node
/**
 * Migration 210 — post-performance-v2: post_stat_runs, proof_stats, proof_stat_reads; the
 * owner_mismatch flag kind.
 * Usage: node scripts/run-210.js --dry | --apply   [--env=.env]
 * Contract: features/post-performance-v2 · 05-impact.md · E27
 *
 * ADDITIVE. Idempotent (a second --apply changes nothing). No existing row is written: three new
 * tables and one CHECK widened by a value. content_proofs, collab_content and deliverable_stats
 * are counted before and after and must be identical (E27).
 */
const fs = require('fs');
const path = require('path');
const envArg = process.argv.find((a) => a.startsWith('--env='));
const envFile = envArg ? envArg.slice(6) : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const { Client } = require('pg');

const apply = process.argv.includes('--apply');
const dry = process.argv.includes('--dry');
if (!apply && !dry) { console.error('Pass --dry or --apply.'); process.exit(2); }
const url = process.env.DATABASE_URL || '';
if (!url) { console.error(`No DATABASE_URL in backend/${envFile}.`); process.exit(2); }

(async () => {
  console.log('Target:', url.replace(/:[^:@/]+@/, ':***@'));
  const c = new Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await c.connect();
  const one = async (sql, p) => (await c.query(sql, p)).rows[0];
  const hasTable = async (table) => !!(await one(
    `SELECT 1 AS x FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`, [table]));
  const checkText = async (name) => ((await one(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname = $1`, [name])) || {}).d || '';

  const shape = async () => ({
    post_stat_runs: await hasTable('post_stat_runs'),
    proof_stats: await hasTable('proof_stats'),
    proof_stat_reads: await hasTable('proof_stat_reads'),
    'flag kind allows owner_mismatch': /owner_mismatch/.test(await checkText('social_admin_flags_kind_check')),
  });
  const counts = async () => ({
    content_proofs: Number((await one(`SELECT count(*)::int AS n FROM content_proofs`)).n),
    content_proof_links: Number((await one(`SELECT count(*)::int AS n FROM content_proofs WHERE url IS NOT NULL`)).n),
    collab_content: Number((await one(`SELECT count(*)::int AS n FROM collab_content`)).n),
    deliverable_stats: Number((await one(`SELECT count(*)::int AS n FROM deliverable_stats`)).n),
    social_admin_flags: Number((await one(`SELECT count(*)::int AS n FROM social_admin_flags`)).n),
    creator_social_runs: Number((await one(`SELECT count(*)::int AS n FROM creator_social_runs`)).n),
  });

  const before = { shape: await shape(), counts: await counts() };
  console.log('Before:', JSON.stringify(before, null, 2));
  if (dry) { await c.end(); console.log('Dry run: nothing written.'); return; }

  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '210_post_performance_v2.sql'), 'utf8');
  await c.query(sql);
  const after = { shape: await shape(), counts: await counts() };
  console.log('After:', JSON.stringify(after, null, 2));
  const same = JSON.stringify(before.counts) === JSON.stringify(after.counts);
  const allOn = Object.values(after.shape).every(Boolean);
  console.log(same ? 'Row counts identical before and after.' : 'ROW COUNTS CHANGED — look.');
  console.log(allOn ? 'Every shape check is on.' : 'A SHAPE CHECK IS OFF — look.');
  await c.end();
  process.exit(same && allOn ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
