'use strict';

/**
 * Commercial usage as a negotiable term on the agreement.
 * Contract: features/commercial-usage-term
 *
 * Founder, 2026-08-28: *"if brand requires commercial rights he mentioned that as negotiable
 * thing in agreements itself... dont make it complex."*
 *
 * TWO RIGHTS, TWO PLACES — and this is the whole design:
 *
 *   Showing her content on the brand's and INFLX's OWN social accounts is included by default,
 *   stated in the contract, negotiated by nobody and paid for by nobody.
 *
 *   COMMERCIAL use — paid ads, print, packaging — is a different right, it is worth money, and
 *   it is settled HERE, in the agreement, BEFORE a campaign exists. While she can still say no,
 *   or say yes for a price.
 *
 * Runs through scripts/run-test-file.js — the test database is still unreachable and these
 * assertions need none.
 */

const T = require('../src/services/collabTerms.model');

/** A minimal valid commission agreement, so each case only varies what it is about. */
const base = (over = {}) => ({
  aim: 'conversion',
  money: { commission_pct: 18 },
  time: { post_by: '2026-09-28' },
  // Required on every collaboration — 'it is asked on every collaboration and can always be
  // countered'. Left out of the first draft of this fixture, which made six cases fail on
  // terms.mode and say nothing about usage at all.
  mode: 'visit',
  importance: {},
  ...over,
});

describe('the term exists and applies to every aim', () => {
  test('usage is an optional term, beside scope', () => {
    expect(T.OPTIONAL_TERMS).toContain('usage');
    expect(T.OPTIONAL_TERMS).toContain('scope');
  });

  test.each(['conversion', 'engagement', 'hybrid'])('a %s agreement may carry it', (aim) => {
    // "in all types (commission, pay for content, pay for both) should be settled before
    // detailed campaign." A commission creator's content is as reusable as a paid one's.
    const money = aim === 'conversion' ? { commission_pct: 18 }
      : aim === 'engagement' ? { fee: 12000 }
        : { commission_pct: 8, fee: 5000 };
    const terms = base({
      aim,
      money,
      // ONE date on every aim: 'a collaboration has one date — the day she must have posted
      // by. Use post_by, not a window.' The posting WINDOW belongs to the set, not the
      // agreement. My first two fixtures got this wrong in two different ways and neither
      // failure said anything about usage — the fixture was wrong, not the model.
      time: { post_by: '2026-09-28' },
      mode: 'visit',
      deliverables: aim === 'conversion' ? undefined : [{ type: 'reel', count: 2 }],
      usage: { commercial: true, extra: 8000 },
      importance: { usage: 'preference' },
    });
    const r = T.validateTerms(terms);
    expect([aim, r.ok]).toEqual([aim, true]);
  });

  test('and it is counterable on every aim, not just the paid ones', () => {
    // Unlike deliverables, which only exist where a fee does.
    for (const aim of ['conversion', 'engagement', 'hybrid']) {
      const original = base({ aim, usage: { commercial: true, extra: 8000 }, importance: { usage: 'preference' } });
      expect(T.counterableTerms(original)).toContain('usage');
    }
  });
});

describe('the shape, kept as simple as he asked for', () => {
  test('asking for commercial rights needs an amount — even zero', () => {
    // Zero is a real offer: "we want them, we are not paying extra." She can counter it.
    // Silence is not, because it leaves her guessing what was meant.
    const withZero = T.validateTerms(base({ usage: { commercial: true, extra: 0 }, importance: { usage: 'preference' } }));
    expect(withZero.ok).toBe(true);

    const without = T.validateTerms(base({ usage: { commercial: true }, importance: { usage: 'preference' } }));
    expect(without.ok).toBe(false);
    expect(without.field).toBe('terms.usage.extra');
  });

  test('a negative amount is refused', () => {
    const r = T.validateTerms(base({ usage: { commercial: true, extra: -100 }, importance: { usage: 'preference' } }));
    expect(r.ok).toBe(false);
  });

  test('saying no needs no amount — that is how she refuses', () => {
    const r = T.validateTerms(base({ usage: { commercial: false }, importance: { usage: 'preference' } }));
    expect(r.ok).toBe(true);
  });

  test('the flag must be stated — a bare object means nothing', () => {
    const r = T.validateTerms(base({ usage: {}, importance: { usage: 'preference' } }));
    expect(r.ok).toBe(false);
    expect(r.field).toBe('terms.usage.commercial');
  });

  test('not raising it at all is fine — that is what optional means', () => {
    expect(T.validateTerms(base()).ok).toBe(true);
  });

  test('but stating it without an importance marker is not', () => {
    // The same rule every optional term follows: say whether it can be argued with.
    const r = T.validateTerms(base({ usage: { commercial: true, extra: 5000 } }));
    expect(r.ok).toBe(false);
    expect(r.field).toBe('terms.importance.usage');
  });

  test('and marking it without stating it is a half-filled form', () => {
    const r = T.validateTerms(base({ importance: { usage: 'preference' } }));
    expect(r.ok).toBe(false);
  });
});

describe('the negotiation — what she can actually do about it', () => {
  const asked = base({ usage: { commercial: true, extra: 8000 }, importance: { usage: 'preference' } });

  test('she can counter the price', () => {
    const r = T.validateCounter(asked, { usage: { commercial: true, extra: 15000 } });
    expect(r.ok).toBe(true);
  });

  test('she can refuse commercial use outright, by countering it to false', () => {
    const r = T.validateCounter(asked, { usage: { commercial: false } });
    expect(r.ok).toBe(true);
  });

  test('an accepted counter is what the agreement records', () => {
    const settled = T.settle(asked, { usage: { commercial: true, extra: 15000 } });
    expect(settled.usage).toEqual({ commercial: true, extra: 15000 });
  });

  test('marked a requirement, it cannot be countered — accept or decline', () => {
    // The honest shape for a brand that genuinely cannot run the campaign without the rights.
    // A counter that quietly changed it would look like agreement and would not be one.
    const mustHave = base({ usage: { commercial: true, extra: 8000 }, importance: { usage: 'requirement' } });
    const r = T.validateCounter(mustHave, { usage: { commercial: false } });
    expect(r.ok).toBe(false);
    expect(r.field).toBe('counter.usage');
    expect(r.message).toMatch(/accept it or decline/);
    expect(T.counterableTerms(mustHave)).not.toContain('usage');
  });
});

describe('one description, so four screens cannot disagree', () => {
  // The request, the counter, the agreement summary and the contract all read from this.
  test('nothing asked → the default, which is real and worth saying', () => {
    const s = T.describeUsage(null);
    expect(s).toMatch(/stays yours/);
    expect(s).toMatch(/own social accounts/);
    expect(s).toMatch(/nothing more/);
  });

  test('refused → the same default', () => {
    expect(T.describeUsage({ commercial: false })).toBe(T.describeUsage(null));
  });

  test('agreed with a price → names the money and keeps her ownership', () => {
    const s = T.describeUsage({ commercial: true, extra: 8000 });
    expect(s).toMatch(/Commercial use/);
    expect(s).toMatch(/₹8,000/);
    expect(s).toMatch(/still own the content/);
  });

  test('agreed for nothing → says so plainly rather than hiding it', () => {
    const s = T.describeUsage({ commercial: true, extra: 0 });
    expect(s).toMatch(/no extra payment/);
  });
});
