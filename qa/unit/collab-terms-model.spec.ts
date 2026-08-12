import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: the handshake terms model.
 * Contract: features/collab-part2-precampaign-handshake.
 *
 * THE MODEL (founder). Money and time are PRIMARY — always stated, always negotiable.
 * Everything else is optional, including deliverables, because a brand often does not
 * know which channels a creator has. Anything stated carries an importance marker:
 * a REQUIREMENT must be settled and cannot be countered; a PREFERENCE is put to the
 * other side as a question and declining it does not break the deal.
 *
 * That marker is the whole point of the design, so these tests exist mainly to pin it:
 * a requirement that can be quietly countered would let a counter look like agreement
 * while changing the deal.
 *
 * Shared by both record types — a brand request and a creator pitch — so the two sides
 * cannot drift on what a term means.
 */

process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const T = require('../../backend/src/services/collabTerms.model');

const SALES = { aim: 'conversion', money: { commission_pct: 12 }, time: { post_by: '2026-09-15' } };
const CONTENT = {
  aim: 'engagement', money: { fee: 25000 },
  time: { window_start: '2026-09-10', window_end: '2026-09-24' },
};

test.describe('WORKFLOW: money follows the aim', () => {
  test('T1 — conversion is commission-only, engagement is fee-only, hybrid takes both', () => {
    expect(T.validateTerms(SALES)).toEqual({ ok: true });
    expect(T.validateTerms(CONTENT)).toEqual({ ok: true });
    // `hybrid` takes commission AND a fee — and, like engagement, a posting WINDOW rather
    // than a conversion post-by date. (A first draft of this test reused the conversion
    // time shape here, and the model correctly rejected it.)
    expect(T.validateTerms({
      aim: 'hybrid', money: { commission_pct: 8, fee: 10000 }, time: CONTENT.time,
    })).toEqual({ ok: true });
  });

  test('T2 — a conversion collaboration cannot carry a fee', () => {
    // Accepting one here would quietly reintroduce the upfront budget that a sales
    // campaign is not supposed to have — the fault Part 1 and Part 4 removed.
    const r = T.validateTerms({ ...SALES, money: { commission_pct: 12, fee: 5000 } });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('commission-only');
  });

  test('T3 — an engagement collaboration cannot carry commission', () => {
    const r = T.validateTerms({ ...CONTENT, money: { fee: 25000, commission_pct: 10 } });
    expect(r.ok).toBe(false);
    expect(r.field).toBe('terms.money.commission_pct');
  });

  test('T4 — money is required, and bounded', () => {
    expect(T.validateTerms({ ...SALES, money: undefined }).ok).toBe(false);
    expect(T.validateTerms({ ...SALES, money: { commission_pct: 0 } }).ok).toBe(false);
    expect(T.validateTerms({ ...SALES, money: { commission_pct: 150 } }).ok).toBe(false);
  });
});

test.describe('WORKFLOW: time means different things per aim', () => {
  test('T5 — conversion gets a post-by date, not a window', () => {
    // A conversion collaboration has no duration, so a window would be meaningless.
    expect(T.validateTerms(SALES)).toEqual({ ok: true });
    const r = T.validateTerms({
      aim: 'conversion', money: { commission_pct: 12 },
      time: { window_start: '2026-09-01', window_end: '2026-09-09' },
    });
    expect(r.ok).toBe(false);
  });

  test('T6 — engagement gets a window, and it cannot run backwards', () => {
    expect(T.validateTerms(CONTENT)).toEqual({ ok: true });
    const r = T.validateTerms({ ...CONTENT, time: { window_start: '2026-09-24', window_end: '2026-09-10' } });
    expect(r.ok).toBe(false);
    expect(r.field).toBe('terms.time.window_end');
  });

  test('T7 — time is required', () => {
    expect(T.validateTerms({ ...SALES, time: undefined }).ok).toBe(false);
  });
});

test.describe('WORKFLOW: optional terms carry an importance marker', () => {
  test('T8 — a bare request with only money and time is valid', () => {
    // The point of the model: two things must be agreed, everything else is a
    // conversation. Deliverables left blank is the intended case, not an omission.
    expect(T.validateTerms(SALES)).toEqual({ ok: true });
  });

  test('T9 — stating a term without marking it is refused', () => {
    const r = T.validateTerms({ ...SALES, scope: { level: 'store' } });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('requirement or a preference');
  });

  test('T10 — marking a term without stating it is refused', () => {
    // A half-filled form. Ignoring it silently would lose the intent.
    const r = T.validateTerms({ ...SALES, importance: { mode: 'preference' } });
    expect(r.ok).toBe(false);
    expect(r.message).toContain('marked but not stated');
  });

  test('T11 — stated and marked is valid', () => {
    expect(T.validateTerms({
      ...SALES, scope: { level: 'category', category: 'Ethnic' },
      mode: 'visit', deliverables: [{ type: 'reel', count: 2 }],
      importance: { scope: 'requirement', mode: 'preference', deliverables: 'preference' },
    })).toEqual({ ok: true });
  });

  test('T12 — the marker itself is validated', () => {
    const r = T.validateTerms({ ...SALES, mode: 'visit', importance: { mode: 'nice-to-have' } });
    expect(r.ok).toBe(false);
  });
});

test.describe('WORKFLOW: a requirement cannot be countered', () => {
  const REQ = {
    aim: 'conversion', money: { commission_pct: 12 }, time: { post_by: '2026-09-15' },
    scope: { level: 'category', category: 'Ethnic Wear' }, mode: 'visit',
    importance: { scope: 'requirement', mode: 'preference' },
  };

  test('C1 — money and time can always be moved', () => {
    expect(T.validateCounter(REQ, { money: { commission_pct: 15 }, time: { post_by: '2026-09-20' } }))
      .toEqual({ ok: true });
  });

  test('C2 — a PREFERENCE can be declined without breaking the deal', () => {
    expect(T.validateCounter(REQ, { mode: 'remote' })).toEqual({ ok: true });
  });

  test('C3 — a REQUIREMENT cannot be changed', () => {
    // The core rule. If the other side cannot live with it, the honest outcome is a
    // decline — not a counter that looks like agreement while changing the deal.
    const r = T.validateCounter(REQ, { scope: { level: 'store' } });
    expect(r.ok).toBe(false);
    expect(r.field).toBe('counter.scope');
    expect(r.message).toContain('accept it or decline');
  });

  test('C4 — re-sending a requirement unchanged is fine', () => {
    expect(T.validateCounter(REQ, { scope: { level: 'category', category: 'Ethnic Wear' } }))
      .toEqual({ ok: true });
  });

  test('C5 — a term the other side left OPEN can be filled in', () => {
    // Regression guard for a real bug: validateCounter merged with a shallow spread,
    // so the counter's `importance` object REPLACED the original's. A counter that
    // only filled in deliverables dropped the marker on scope, and the merged payload
    // then failed as "stated but unmarked" for a term the counter never touched.
    expect(T.validateCounter(REQ, {
      deliverables: [{ type: 'reel', count: 2 }, { type: 'story', count: 4 }],
      importance: { deliverables: 'preference' },
    })).toEqual({ ok: true });
  });

  test('C6 — counterableTerms tells the UI what to make editable', () => {
    const list = T.counterableTerms(REQ);
    expect(list).toContain('money');
    expect(list).toContain('time');
    expect(list).toContain('mode');            // a preference
    expect(list).toContain('deliverables');    // left open
    expect(list).not.toContain('scope');       // a requirement
  });
});

test.describe('WORKFLOW: settling', () => {
  const REQ = {
    aim: 'conversion', money: { commission_pct: 12 }, time: { post_by: '2026-09-15' },
    mode: 'visit', importance: { mode: 'preference' },
  };

  test('S1 — the accepted counter wins, and markers are preserved', () => {
    const settled = T.settle(REQ, { money: { commission_pct: 15 }, mode: 'remote' });
    expect(settled.money.commission_pct).toBe(15);
    expect(settled.mode).toBe('remote');
    expect(settled.time.post_by).toBe('2026-09-15');       // untouched
    expect(settled.importance.mode).toBe('preference');     // not lost
  });

  test('S2 — no counter settles to the original', () => {
    expect(T.settle(REQ, null)).toEqual(REQ);
  });
});
