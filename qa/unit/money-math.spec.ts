import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: B2a — money-math invariants (pure-calc L1).
 * Contract: features/calc-money-math/ (locked 2026-05-18).
 *
 * Locks the settlement identity computed by the exported pure
 * functions in backend/src/services/transaction.service.js. No DB,
 * no Docker, no network, no app change. A change to the fee %,
 * rounding, or the brand_net formula fails this loudly.
 */

// transaction.service transitively requires backend/config/env which
// HARD-VALIDATES required env at module load (anticipated in
// features/calc-money-math/05-impact.md). calc* are pure and use
// none of these — supply minimal dummy values so the module imports.
// This is an import shim, NOT a behaviour stub: the values are never
// read by the math under test.
process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const txn = require('../../backend/src/services/transaction.service');
const { calcPayAtStore, calcOnlineOrder } = txn;

// In-test mirror of the service's r2 (2-dp rupees) — used only to
// check structural invariants, never to define the fixed cases.
const r2 = (n: number) => parseFloat((n || 0).toFixed(2));

test.describe('WORKFLOW: B2a money-math invariants', () => {
  test('C1 — pay-at-store clean case (1000, 10%, 5%, 8%)', () => {
    expect(calcPayAtStore(1000, 10, 5, 8)).toEqual({
      discountAmount: 100,
      netAmount: 900,
      influencerCommission: 45,
      platformFee: 72,
      brandNet: 783,
    });
  });

  test('C2 — pay-at-store default 8% fee, no discount/commission', () => {
    expect(calcPayAtStore(1000, 0, 0, 8)).toEqual({
      discountAmount: 0,
      netAmount: 1000,
      influencerCommission: 0,
      platformFee: 80,
      brandNet: 920,
    });
  });

  test('C3 — pay-at-store zero bill → all zero', () => {
    expect(calcPayAtStore(0, 10, 5, 8)).toEqual({
      discountAmount: 0,
      netAmount: 0,
      influencerCommission: 0,
      platformFee: 0,
      brandNet: 0,
    });
  });

  test('C4 — online order multi-item + ₹30 delivery', () => {
    expect(
      calcOnlineOrder([{ price: 200, quantity: 2 }, { price: 100, quantity: 1 }], 10, 5, 8, 30),
    ).toEqual({
      itemsTotal: 500,
      discountAmount: 50,
      netAmount: 480, // discountedItems 450 + delivery 30
      influencerCommission: 22.5,
      platformFee: 36,
      brandNet: 391.5,
    });
  });

  test('C5 — online order empty cart → all zero', () => {
    expect(calcOnlineOrder([], 10, 5, 8)).toEqual({
      itemsTotal: 0,
      discountAmount: 0,
      netAmount: 0,
      influencerCommission: 0,
      platformFee: 0,
      brandNet: 0,
    });
  });

  test('I1 — structural invariants hold for sampled inputs (r2-mirrored)', () => {
    const samples = [
      { bill: 1234.56, disc: 7.5, comm: 6, fee: 8 },
      { bill: 999.99, disc: 10, comm: 5, fee: 8 },
      { bill: 50, disc: 0, comm: 12.5, fee: 8 },
      { bill: 7777, disc: 33.33, comm: 5, fee: 8 },
      { bill: 100, disc: 100, comm: 5, fee: 8 }, // full discount → net 0
    ];

    for (const s of samples) {
      const p = calcPayAtStore(s.bill, s.disc, s.comm, s.fee);
      // base for pay-at-store is netAmount
      expect(p.discountAmount).toBe(r2(s.bill * s.disc / 100));
      expect(p.netAmount).toBe(r2(s.bill - p.discountAmount));
      expect(p.platformFee).toBe(r2(p.netAmount * s.fee / 100));
      expect(p.influencerCommission).toBe(r2(p.netAmount * s.comm / 100));
      expect(p.brandNet).toBe(r2(p.netAmount - p.influencerCommission - p.platformFee));

      const o = calcOnlineOrder([{ price: s.bill, quantity: 1 }], s.disc, s.comm, s.fee, 0);
      // base for online order is discountedItems = itemsTotal - discount
      const discountedItems = r2(o.itemsTotal - o.discountAmount);
      expect(o.platformFee).toBe(r2(discountedItems * s.fee / 100));
      expect(o.influencerCommission).toBe(r2(discountedItems * s.comm / 100));
      expect(o.brandNet).toBe(r2(discountedItems - o.influencerCommission - o.platformFee));
    }
  });
});
