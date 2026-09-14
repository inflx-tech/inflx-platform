#!/usr/bin/env node
/**
 * Migration 183 — item 7: the agreement, the two signatures, the standard
 * terms, and the money-safety index Phase 2a needs.
 * Usage: node scripts/run-183.js --dry | --apply   [--env=.env]
 * Contract: features/item7-agreement
 */
const fs = require('fs');
const path = require('path');
const envArg = process.argv.find(a => a.startsWith('--env='));
const envFile = envArg ? envArg.slice(6) : '.env.prod-backup';
require('dotenv').config({ path: path.join(__dirname, '..', envFile) });
const { Client } = require('pg');

const apply = process.argv.includes('--apply');
const dry = process.argv.includes('--dry');
if (!apply && !dry) { console.error('Pass --dry or --apply.'); process.exit(2); }
const url = process.env.DATABASE_URL || '';
if (!url) { console.error(`No DATABASE_URL in backend/${envFile}.`); process.exit(2); }

const COLS = [
  'reference_no', 'terms_json', 'terms_version', 'sent_at', 'sent_by',
  'influencer_signed_ip', 'influencer_signed_device',
  'brand_signed_name', 'brand_signed_ip', 'brand_signed_device',
  'withdrawn_at', 'withdrawn_by', 'declined_at', 'decline_reason', 'decline_note',
  'expired_at', 'locked_amount', 'campaign_fee_amount', 'released_amount',
  'money_at', 'pdf_sha256',
];
const IDX = ['uq_escrow_ci_tranche', 'idx_escrow_ci', 'uq_contracts_reference',
  'idx_contracts_status', 'idx_contracts_open_unsigned', 'uq_standard_terms_current'];
const STATUSES = ['withdrawn', 'declined', 'expired'];

(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const q = async (s, p) => (await c.query(s, p)).rows;
  const one = async (s, p) => (await q(s, p))[0];
  const hasCol = async (t, col) => (await one(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [t, col])).n === 1;
  const hasTable = async (t) => (await one(`SELECT count(*)::int n FROM information_schema.tables WHERE table_name=$1`, [t])).n === 1;
  const hasIdx = async (n) => (await one(`SELECT count(*)::int n FROM pg_indexes WHERE indexname=$1`, [n])).n === 1;
  const hasStatus = async (v) => (await one(`SELECT count(*)::int n FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='contract_status' AND e.enumlabel=$1`, [v])).n === 1;

  console.log(`\n=== migration 183 · ${apply ? 'APPLY' : 'DRY RUN'} · ${envFile} ===\n`);

  const before = await one(`SELECT
      (SELECT count(*)::int FROM contracts) contracts,
      (SELECT count(*)::int FROM contracts WHERE influencer_signed_at IS NOT NULL AND brand_signed_at IS NOT NULL) both_signed,
      (SELECT count(*)::int FROM contracts WHERE influencer_signed_at IS NOT NULL AND brand_signed_at IS NULL) creator_only,
      (SELECT count(*)::int FROM contracts WHERE influencer_signed_at IS NULL AND brand_signed_at IS NOT NULL) brand_only,
      (SELECT count(*)::int FROM contracts WHERE influencer_signed_at IS NULL AND brand_signed_at IS NULL) neither,
      (SELECT count(*)::int FROM contracts WHERE status = 'active' AND (influencer_signed_at IS NULL OR brand_signed_at IS NULL)) active_unsigned,
      (SELECT count(*)::int FROM contracts WHERE pdf_url IS NOT NULL) with_pdf,
      (SELECT count(*)::int FROM escrow_entries) escrow_rows,
      (SELECT count(*)::int FROM wallet_transactions) wallet_rows,
      (SELECT count(*)::int FROM campaign_influencers) invitations`, []);
  console.log('before:', before);

  const byStatus = await q(`SELECT status, count(*)::int n FROM contracts GROUP BY status ORDER BY 1`);
  console.log('contracts by status:', byStatus);

  // The unique index in part A fails if production already holds a duplicate.
  const dupes = await q(`SELECT campaign_influencer_id, tranche_number, count(*)::int n
                           FROM escrow_entries GROUP BY 1,2 HAVING count(*) > 1`);
  console.log('duplicate (invitation, tranche) escrow rows:', dupes.length ? dupes : '(none — the unique index will build)');
  if (dupes.length) { console.error('\nREFUSING: resolve the duplicates above before applying.'); await c.end(); process.exit(1); }

  const present = {};
  for (const col of COLS) present[`contracts.${col}`] = await hasCol('contracts', col);
  for (const s of STATUSES) present[`contract_status.${s}`] = await hasStatus(s);
  present['table.standard_terms'] = await hasTable('standard_terms');
  for (const i of IDX) present[`index.${i}`] = await hasIdx(i);
  console.log('already present:', present);
  console.log('nothing to backfill: no reference number is invented for an old contract, no terms are snapshotted onto one, and no signature is ever invented. The seeded rows stay exactly as they are.');

  if (!apply) { console.log('\nDRY RUN — nothing written.'); await c.end(); return; }

  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '183_item7_agreement.sql'), 'utf8');
  await c.query(sql);

  const after = {};
  for (const col of COLS) after[`contracts.${col}`] = await hasCol('contracts', col);
  for (const s of STATUSES) after[`contract_status.${s}`] = await hasStatus(s);
  after['table.standard_terms'] = await hasTable('standard_terms');
  for (const i of IDX) after[`index.${i}`] = await hasIdx(i);
  console.log('after:', after);

  const terms = await q(`SELECT version, is_current, length(body_md) body_len FROM standard_terms ORDER BY version`);
  console.log('standard terms:', terms);
  const settings = await q(`SELECT key, value, min_value, max_value FROM platform_settings ORDER BY key`);
  console.log('platform settings:', settings);

  const counts = await one(`SELECT
      (SELECT count(*)::int FROM contracts) contracts,
      (SELECT count(*)::int FROM contracts WHERE influencer_signed_at IS NOT NULL AND brand_signed_at IS NOT NULL) both_signed,
      (SELECT count(*)::int FROM escrow_entries) escrow_rows,
      (SELECT count(*)::int FROM wallet_transactions) wallet_rows,
      (SELECT count(*)::int FROM campaign_influencers) invitations`, []);
  const unchanged = counts.contracts === before.contracts
    && counts.both_signed === before.both_signed
    && counts.escrow_rows === before.escrow_rows
    && counts.wallet_rows === before.wallet_rows
    && counts.invitations === before.invitations;
  console.log('row counts unchanged:', unchanged, counts);

  const ok = Object.values(after).every(Boolean) && terms.length >= 1 && settings.length === 5 && unchanged;
  console.log(ok ? '\nAll checks OK.' : '\nCHECKS FAILED — inspect above.');
  await c.end();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
