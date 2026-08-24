'use strict';
/**
 * Move the practice brand and practice creator OFF the founder's real number.
 * Contract: features/stage-0-clear-the-decks
 *
 * WHAT WENT WRONG (2026-08-21, found by the founder 2026-08-24):
 * The practice world was seeded with --brand-phone and --creator-phone both pointed at
 * +918639448121 — the founder's own number — to demonstrate "one number, many roles".
 * That contradicted the decision recorded in this stage's own lock file:
 *
 *   "8639448121: EXISTS as a follower since 2026-04-10. Reserved as the practice
 *    follower for Stage 6. Cannot also be a brand or creator."
 *
 * The number reserved for the practice brand/creator (+918465994979) was left unused.
 * Result: opening the brand app on his number signs him into Kanchi Silks, a practice
 * shop, when he expects his number to be the superadmin and nothing else.
 *
 * WHY MOVE RATHER THAN DELETE AND RESEED:
 * Kanchi Silks is not scenery. It holds 11 conversations, 6 agreements and 2 groups —
 * the entire Stage 1 practice world. Deleting and recreating would destroy all of it.
 * Changing the phone on the user row keeps every relationship intact, because nothing
 * references a user by phone.
 *
 * The admin account on his number is not touched.
 *
 *   node scripts/unbind-founder-practice-accounts.js           # dry run
 *   node scripts/unbind-founder-practice-accounts.js --apply
 */
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const APPLY = process.argv.includes('--apply');
const FOUNDER = '+918639448121';
const MOVES = [
  { role: 'brand',      to: '+917900000190', note: 'practice brand — Kanchi Silks' },
  { role: 'influencer', to: '+917900000110', note: 'practice creator — Asha M.' },
];

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const show = async (label) => {
    const { rows } = await c.query(
      `SELECT role, name, phone FROM users WHERE phone = $1 ORDER BY role`, [FOUNDER]);
    console.log(label); console.table(rows);
  };
  await show('BEFORE — accounts on the founder\'s number:');

  for (const m of MOVES) {
    const { rows: [target] } = await c.query(
      `SELECT id, name FROM users WHERE phone = $1 AND role = $2`, [FOUNDER, m.role]);
    if (!target) { console.log(`  no ${m.role} on ${FOUNDER} — nothing to move`); continue; }

    const { rows: [clash] } = await c.query(
      `SELECT id FROM users WHERE phone = $1 AND role = $2`, [m.to, m.role]);
    if (clash) { console.error(`  REFUSING: ${m.to} already holds a ${m.role}`); process.exit(1); }

    console.log(`  ${m.role}: "${target.name}"  ${FOUNDER} -> ${m.to}`);
    if (!APPLY) continue;

    await c.query(`UPDATE users SET phone = $1 WHERE id = $2`, [m.to, target.id]);
    // Practice numbers sign in with the fixed code. Safe here precisely because these
    // are no longer the founder's number — the allowlist is per NUMBER, so allow-listing
    // his would have handed the fixed code to his superadmin account too.
    await c.query(
      `INSERT INTO test_phone_numbers (phone, note) VALUES ($1,$2)
         ON CONFLICT (phone) DO UPDATE SET note = EXCLUDED.note`, [m.to, m.note]);
  }

  if (!APPLY) { console.log('\nDRY RUN — re-run with --apply.'); await c.end(); return; }

  await show('\nAFTER — accounts on the founder\'s number:');

  // The practice world must be exactly as it was, just reachable on a different number.
  const { rows: [k] } = await c.query(
    `SELECT b.id,
            (SELECT count(*)::int FROM brand_collab_requests WHERE brand_id = b.id) AS requests,
            (SELECT count(*)::int FROM collab_agreements  WHERE brand_id = b.id) AS agreements,
            (SELECT count(*)::int FROM influencer_groups  WHERE brand_id = b.id) AS groups
       FROM brands b JOIN users u ON u.id = b.user_id
      WHERE u.phone = $1`, ['+917900000190']);
  console.log('Kanchi Silks after the move:', JSON.stringify(k));
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
