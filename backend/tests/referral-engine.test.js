'use strict';

/**
 * QA — referral-engine (Contract 1). Asserts the expected outputs in
 * features/referral-engine/03-expected-outputs.md against a real Postgres DB.
 *
 * Coverage map (step → test):
 *   A1/A2  subscription accrual + idempotent replay
 *   B3/B4  protection-fee accrual (per escrow_entries.id; 3 tranches → 3 rows)
 *   C5/C6  commission accrual via the REAL commission-confirm cron; referred
 *          influencer's own credit unchanged
 *   D7/D8  expired-window / no-edge → no accrual (host path still completes)
 *   D9     duplicate active edge rejected (partial unique index)
 *   D10    self / circular edge rejected (VALIDATION_ERROR)
 *   + agency-referrer rows stay 'pending' (no wallet touched)
 *   + influencer-referrer wallet + referral_earned_total invariant
 *
 * Subscription (A) + protection-fee (B) are driven through the engine's public
 * seam — referralService.accrue / accrueWithClient — using the SAME calls the
 * thin, verified hooks make (webhook.controller.js / escrow.service.js). The
 * commission path (C) is exercised end-to-end through the real cron. source_ref_id
 * is an opaque polymorphic idempotency key (no FK by design), so synthetic UUIDs
 * stand in for subscription_invoices.id / escrow_entries.id.
 */

const crypto = require('crypto');
const { truncateAll, query, pool } = require('./helpers/db');
const {
  createBrandUser,
  createInfluencerUser,
  createFollowerUser,
  registerBrand,
  registerInfluencer,
} = require('./helpers/factories');
const referralService = require('../src/services/referral.service');
const db = require('../src/config/db');
const { run: runCommissionConfirm } = require('../src/jobs/commission-confirm.job');

beforeEach(async () => {
  await truncateAll();
});

const uuid = () => crypto.randomUUID();
const round2 = (n) => parseFloat(parseFloat(n).toFixed(2));

// ── seed helpers ────────────────────────────────────────────────────────────

async function seedBrand() {
  const { token, user } = await createBrandUser();
  await registerBrand(token);
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [user.id]);
  const { rows: [brand] } = await query(`SELECT id FROM brands WHERE user_id = $1`, [user.id]);
  return brand; // { id }
}

let infSeq = 0;
async function seedInfluencer({ wallet = 0, pending = 0, earned = 0 } = {}) {
  infSeq += 1;
  const { token, user } = await createInfluencerUser();
  const inf = await registerInfluencer(token, { instagram_handle: `ref_inf_${infSeq}_${Date.now()}` });
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [user.id]);
  await query(
    `UPDATE influencers
        SET wallet_balance = $1, pending_balance = $2, total_earned = $3, referral_earned_total = 0
      WHERE id = $4`,
    [wallet, pending, earned, inf.id]
  );
  return inf; // { id, ... }
}

async function ledgerRows(where = '', params = []) {
  const { rows } = await query(
    `SELECT * FROM referral_ledger ${where ? 'WHERE ' + where : ''} ORDER BY created_at`,
    params
  );
  return rows;
}

// ── A. Subscription accrual (brand referred) ─────────────────────────────────

describe('A. subscription accrual (brand referred)', () => {
  test('A1: paid subscription → 1 ledger row with correct base/pct/amount', async () => {
    const brand = await seedBrand();
    const referrer = await seedInfluencer();
    await referralService.createEdge({
      referrerType: 'influencer', referrerId: referrer.id,
      referredType: 'brand', referredId: brand.id,
      pct: 25, source: 'admin',
    });

    const invoiceId = uuid();
    await referralService.accrue({
      source: 'subscription', sourceRefId: invoiceId,
      referredType: 'brand', referredId: brand.id, baseAmount: 5000,
    });

    const rows = await ledgerRows(`source = 'subscription'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].source_ref_id).toBe(invoiceId);
    expect(parseFloat(rows[0].base_amount)).toBe(5000);
    expect(parseFloat(rows[0].pct)).toBe(25);
    expect(parseFloat(rows[0].amount)).toBe(1250); // 5000 × 25%
  });

  test('A2: replayed webhook (same invoice id) → still exactly 1 row', async () => {
    const brand = await seedBrand();
    const referrer = await seedInfluencer();
    await referralService.createEdge({
      referrerType: 'influencer', referrerId: referrer.id,
      referredType: 'brand', referredId: brand.id,
      pct: 25, source: 'admin',
    });

    const invoiceId = uuid();
    const opts = {
      source: 'subscription', sourceRefId: invoiceId,
      referredType: 'brand', referredId: brand.id, baseAmount: 5000,
    };
    await referralService.accrue(opts);
    await referralService.accrue(opts); // retry

    const rows = await ledgerRows(`source = 'subscription'`);
    expect(rows).toHaveLength(1);
    // influencer referrer wallet credited exactly once
    const { rows: [r] } = await query(
      `SELECT wallet_balance, referral_earned_total FROM influencers WHERE id = $1`,
      [referrer.id]
    );
    expect(parseFloat(r.wallet_balance)).toBe(1250);
    expect(parseFloat(r.referral_earned_total)).toBe(1250);
  });
});

// ── B. Protection-fee accrual (brand referred) ───────────────────────────────

describe('B. protection-fee accrual (brand referred)', () => {
  test('B3: released tranche → 1 ledger row source=protection_fee, base=escrow_fee_amount', async () => {
    const brand = await seedBrand();
    const referrer = await seedInfluencer();
    await referralService.createEdge({
      referrerType: 'influencer', referrerId: referrer.id,
      referredType: 'brand', referredId: brand.id,
      pct: 25, source: 'admin',
    });

    const escrowEntryId = uuid();
    await db.withTransaction((client) =>
      referralService.accrueWithClient(client, {
        source: 'protection_fee', sourceRefId: escrowEntryId,
        referredType: 'brand', referredId: brand.id, baseAmount: 1000,
      })
    );

    const rows = await ledgerRows(`source = 'protection_fee'`);
    expect(rows).toHaveLength(1);
    expect(parseFloat(rows[0].base_amount)).toBe(1000);
    expect(parseFloat(rows[0].amount)).toBe(250);
  });

  test('B4: T1/T2/T3 each release → 3 separate ledger rows, one per escrow id', async () => {
    const brand = await seedBrand();
    const referrer = await seedInfluencer();
    await referralService.createEdge({
      referrerType: 'influencer', referrerId: referrer.id,
      referredType: 'brand', referredId: brand.id,
      pct: 25, source: 'admin',
    });

    const escrowIds = [uuid(), uuid(), uuid()];
    for (const id of escrowIds) {
      await db.withTransaction((client) =>
        referralService.accrueWithClient(client, {
          source: 'protection_fee', sourceRefId: id,
          referredType: 'brand', referredId: brand.id, baseAmount: 1000,
        })
      );
    }

    const rows = await ledgerRows(`source = 'protection_fee'`);
    expect(rows).toHaveLength(3);
    const refs = rows.map((r) => r.source_ref_id).sort();
    expect(refs).toEqual([...escrowIds].sort());
    // referrer wallet credited 3 × 250
    const { rows: [r] } = await query(
      `SELECT referral_earned_total FROM influencers WHERE id = $1`,
      [referrer.id]
    );
    expect(parseFloat(r.referral_earned_total)).toBe(750);
  });
});

// ── C. Commission accrual (influencer referred) — REAL cron ──────────────────

describe('C. commission accrual (influencer referred) via real cron', () => {
  async function seedConfirmableTxn({ referredInf, brand, commission, marketplaceFee }) {
    const { token: followerToken } = await createFollowerUser();
    const followerRes = await require('supertest')(require('../src/app'))
      .get('/v1/followers/me').set('Authorization', `Bearer ${followerToken}`);
    const followerId = followerRes.body.data.follower.id;

    const { rows: [campaign] } = await query(
      `INSERT INTO campaigns (brand_id, name, status, total_budget)
       VALUES ($1, 'Referral Campaign', 'live', 100000) RETURNING *`,
      [brand.id]
    );
    const { rows: [set] } = await query(
      `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode)
       VALUES ($1, 'Set 1', 'engagement', 'handpick') RETURNING *`,
      [campaign.id]
    );
    const { rows: [ci] } = await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, agreed_fee)
       VALUES ($1, $2, 'active', 10000) RETURNING *`,
      [set.id, referredInf.id]
    );
    await query(
      `INSERT INTO follower_transactions
         (follower_id, brand_id, campaign_id, set_id, campaign_influencer_id,
          transaction_type, gross_amount, discount_amount, net_amount,
          influencer_commission, marketplace_fee_amount, brand_net,
          status, return_window_ends_at)
       VALUES ($1, $2, $3, $4, $5, 'pay_at_store', 56000, 0, 56000, $6, $7, 55552,
               'completed', NOW() - interval '31 days')`,
      [followerId, brand.id, campaign.id, set.id, ci.id, commission, marketplaceFee]
    );
    return ci;
  }

  test('C5/C6: influencer-referrer credited; referred influencer own credit unchanged', async () => {
    const brand = await seedBrand();
    const referredInf = await seedInfluencer({ wallet: 0, pending: 5600, earned: 5600 });
    const referrerInf = await seedInfluencer();

    await referralService.createEdge({
      referrerType: 'influencer', referrerId: referrerInf.id,
      referredType: 'influencer', referredId: referredInf.id,
      pct: 25, source: 'admin',
    });

    await seedConfirmableTxn({
      referredInf, brand, commission: 5600, marketplaceFee: 448,
    });

    const result = await runCommissionConfirm();
    expect(result.confirmed).toBe(1);

    // C5: one commission ledger row, base = marketplace_fee_amount, paid, referrer credited
    const rows = await ledgerRows(`source = 'commission'`);
    expect(rows).toHaveLength(1);
    expect(parseFloat(rows[0].base_amount)).toBe(448);
    expect(parseFloat(rows[0].amount)).toBe(112); // 448 × 25%
    expect(rows[0].payout_status).toBe('paid');
    expect(rows[0].paid_at).not.toBeNull();

    const { rows: [ref] } = await query(
      `SELECT wallet_balance, referral_earned_total FROM influencers WHERE id = $1`,
      [referrerInf.id]
    );
    expect(parseFloat(ref.wallet_balance)).toBe(112);
    expect(parseFloat(ref.referral_earned_total)).toBe(112);

    // C6: referred influencer's OWN commission credit is the full unchanged amount
    const { rows: [referred] } = await query(
      `SELECT wallet_balance, pending_balance, referral_earned_total FROM influencers WHERE id = $1`,
      [referredInf.id]
    );
    expect(parseFloat(referred.wallet_balance)).toBe(5600); // full commission, not reduced
    expect(parseFloat(referred.pending_balance)).toBe(0);
    expect(parseFloat(referred.referral_earned_total)).toBe(0); // referred earns no referral here
  });

  test('D7: expired edge → commission confirms but NO referral ledger row', async () => {
    const brand = await seedBrand();
    const referredInf = await seedInfluencer({ wallet: 0, pending: 5600, earned: 5600 });
    const referrerInf = await seedInfluencer();

    await referralService.createEdge({
      referrerType: 'influencer', referrerId: referrerInf.id,
      referredType: 'influencer', referredId: referredInf.id,
      pct: 25, source: 'admin',
    });
    // slam the window shut (status stays 'active', but now() > expires_at)
    await query(
      `UPDATE referral_edges SET expires_at = now() - interval '1 day'
        WHERE referred_type = 'influencer' AND referred_id = $1`,
      [referredInf.id]
    );

    await seedConfirmableTxn({ referredInf, brand, commission: 5600, marketplaceFee: 448 });

    const result = await runCommissionConfirm();
    expect(result.confirmed).toBe(1); // host path completes

    expect(await ledgerRows()).toHaveLength(0); // no accrual
    const { rows: [ref] } = await query(
      `SELECT wallet_balance FROM influencers WHERE id = $1`, [referrerInf.id]
    );
    expect(parseFloat(ref.wallet_balance)).toBe(0);
  });

  test('D8: no edge → commission confirms but NO referral ledger row', async () => {
    const brand = await seedBrand();
    const referredInf = await seedInfluencer({ wallet: 0, pending: 5600, earned: 5600 });

    await seedConfirmableTxn({ referredInf, brand, commission: 5600, marketplaceFee: 448 });

    const result = await runCommissionConfirm();
    expect(result.confirmed).toBe(1);
    expect(await ledgerRows()).toHaveLength(0);
  });
});

// ── D. Guards ─────────────────────────────────────────────────────────────

describe('D. edge guards', () => {
  test('D9: a second active edge for the same referred entity is rejected', async () => {
    const brand = await seedBrand();
    const r1 = await seedInfluencer();
    const r2 = await seedInfluencer();

    await referralService.createEdge({
      referrerType: 'influencer', referrerId: r1.id,
      referredType: 'brand', referredId: brand.id, pct: 25, source: 'admin',
    });

    await expect(
      referralService.createEdge({
        referrerType: 'influencer', referrerId: r2.id,
        referredType: 'brand', referredId: brand.id, pct: 30, source: 'admin',
      })
    ).rejects.toMatchObject({ code: '23505' }); // uniq_referral_active_referred
  });

  test('D10: self-referral is rejected with VALIDATION_ERROR', async () => {
    const inf = await seedInfluencer();
    await expect(
      referralService.createEdge({
        referrerType: 'influencer', referrerId: inf.id,
        referredType: 'influencer', referredId: inf.id, pct: 25, source: 'admin',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  test('D10: circular referral (reverse of an active edge) is rejected', async () => {
    const a = await seedInfluencer();
    const b = await seedInfluencer();

    await referralService.createEdge({
      referrerType: 'influencer', referrerId: a.id,
      referredType: 'influencer', referredId: b.id, pct: 25, source: 'admin',
    });

    await expect(
      referralService.createEdge({
        referrerType: 'influencer', referrerId: b.id,
        referredType: 'influencer', referredId: a.id, pct: 25, source: 'admin',
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

// ── Referrer-type behaviour ─────────────────────────────────────────────────

describe('referrer-type accrual behaviour', () => {
  test('agency referrer: ledger row stays pending, no wallet table touched', async () => {
    const brand = await seedBrand();
    const agencyId = uuid(); // synthetic — agency role/wallet arrives in Contract 3
    await referralService.createEdge({
      referrerType: 'agency', referrerId: agencyId,
      referredType: 'brand', referredId: brand.id, pct: 25, source: 'admin',
    });

    await referralService.accrue({
      source: 'subscription', sourceRefId: uuid(),
      referredType: 'brand', referredId: brand.id, baseAmount: 5000,
    });

    const rows = await ledgerRows(`referrer_type = 'agency'`);
    expect(rows).toHaveLength(1);
    expect(rows[0].payout_status).toBe('pending'); // not paid — no agency wallet yet
    expect(parseFloat(rows[0].amount)).toBe(1250);
  });

  test('zero-pct edge: ledger row with amount=0, no wallet movement', async () => {
    const brand = await seedBrand();
    const referrer = await seedInfluencer();
    await referralService.createEdge({
      referrerType: 'influencer', referrerId: referrer.id,
      referredType: 'brand', referredId: brand.id, pct: 0, source: 'admin',
    });

    await referralService.accrue({
      source: 'subscription', sourceRefId: uuid(),
      referredType: 'brand', referredId: brand.id, baseAmount: 5000,
    });

    const rows = await ledgerRows();
    expect(rows).toHaveLength(1);
    expect(parseFloat(rows[0].amount)).toBe(0);
    const { rows: [r] } = await query(
      `SELECT wallet_balance, referral_earned_total FROM influencers WHERE id = $1`,
      [referrer.id]
    );
    expect(parseFloat(r.wallet_balance)).toBe(0);
    expect(parseFloat(r.referral_earned_total)).toBe(0);
  });
});
