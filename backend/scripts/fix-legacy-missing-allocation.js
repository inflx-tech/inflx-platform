'use strict';
/**
 * fix-legacy-missing-allocation.js — give the pre-Stage-2 collaborations something to sell.
 *
 * Contract: features/stage-3-watch-the-work-happen (walk preparation)
 *
 * WHAT WENT WRONG, AND WHEN
 * Four collaborations on selling sets carry alloc_scope NULL. Since Part 4 that means the
 * resolver returns them no products, so they are contracted and INVISIBLE in the shopping
 * app. Stage 3's roll-up surfaced them, which is what it is for.
 *
 * They are not a design gap. Every one of the four rows was written on 21 August, four days
 * before Stage 2 shipped the rule that a campaign cannot be PUBLISHED with a creator who
 * has nothing to sell — and both campaigns have published_at NULL, so they were seeded
 * straight into 'active' and never went through publish at all.
 *
 * The founder's question is what found it: "while making detailed campaign it should be
 * compulsory to allocate... then how can we say to a creator you can't sell anything?" The
 * answer is that it IS compulsory now, and these four predate it. The live hole they came
 * through — invite has no draft guard, so a creator can be added to an already-running
 * campaign — is closed separately in campaign.controller.invite.
 *
 * WHAT IT SETS, AND WHY 'store'
 * Whole store. Kanchi Silks is a saree house whose entire catalogue is sarees, and both
 * sets ("Sarees", "Cottons") sell from it. Store scope also AUTO-JOINS anything added
 * later, which is what a brand briefing its own shop would expect. Nothing is invented: no
 * hand-picked list is guessed on anyone's behalf.
 *
 * ONLY rows that are NULL, only on SELLING sets, only for (practice) brands. It will not
 * overwrite an allocation anyone actually chose.
 *
 * USAGE
 *   node backend/scripts/fix-legacy-missing-allocation.js           # dry run
 *   node backend/scripts/fix-legacy-missing-allocation.js --apply
 */

const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const APPLY = process.argv.includes('--apply');

const FIND = `
  SELECT ci.id, u.name AS creator, cam.name AS campaign, cs.name AS set_name, cs.goal,
         ci.created_at, b.business_name
    FROM campaign_influencers ci
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns cam    ON cam.id = cs.campaign_id
    JOIN brands b         ON b.id = cam.brand_id
    JOIN influencers i    ON i.id = ci.influencer_id
    JOIN users u          ON u.id = i.user_id
   WHERE ci.alloc_scope IS NULL
     AND cs.goal IN ('conversion', 'hybrid')
     AND ci.status <> ALL(ARRAY['declined','expired','rejected_by_brand','slots_filled']::campaign_influencer_status[])
     AND b.business_name ILIKE '%(practice)'
   ORDER BY b.business_name, cam.name, u.name`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows } = await c.query(FIND);
  if (!rows.length) {
    console.log('Nothing to fix — no practice collaboration on a selling set is missing an allocation.');
    await c.end();
    return;
  }

  console.log(`${rows.length} collaboration(s) on a selling set with nothing to sell:\n`);
  rows.forEach(r => console.log(
    `  ${r.business_name} / ${r.campaign} / ${r.set_name}: ${r.creator}` +
    `   (row written ${String(r.created_at).slice(0, 15)})`));

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply.');
    console.log('Each will be set to alloc_scope = store: the whole catalogue, and anything added later.');
    await c.end();
    return;
  }

  await c.query('BEGIN');
  try {
    const { rowCount } = await c.query(
      `UPDATE campaign_influencers SET alloc_scope = 'store' WHERE id = ANY($1::uuid[])`,
      [rows.map(r => r.id)]);
    await c.query('COMMIT');
    console.log(`\nSET ${rowCount} collaboration(s) to the whole store.`);
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('FAILED, rolled back:', e.message);
    await c.end();
    process.exit(1);
  }

  const { rows: after } = await c.query(FIND);
  if (after.length) {
    console.error(`UNEXPECTED: ${after.length} still missing an allocation.`);
    await c.end();
    process.exit(1);
  }

  // What each of them can now actually sell — the number the shopping app will resolve.
  const { rows: check } = await c.query(
    `SELECT u.name AS creator, ci.alloc_scope,
            (SELECT count(*)::int FROM brand_products bp
              WHERE bp.brand_id = cam.brand_id AND bp.is_active = true
                AND (bp.stock IS NULL OR bp.stock > 0)) AS sellable
       FROM campaign_influencers ci
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns cam    ON cam.id = cs.campaign_id
       JOIN influencers i    ON i.id = ci.influencer_id
       JOIN users u          ON u.id = i.user_id
      WHERE cs.goal IN ('conversion','hybrid')
      ORDER BY u.name`);
  console.log('\nwhat each can sell now:');
  check.forEach(r => console.log(`  ${r.creator.padEnd(24)} ${r.alloc_scope} · ${r.sellable} products`));

  console.log('\nOK — nobody on a selling set is contracted with an empty shelf.');
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
