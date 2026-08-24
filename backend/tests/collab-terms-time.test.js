'use strict';

/**
 * One date, whatever the aim. Contract: features/collab-terms-by-aim (item 3)
 *
 * A paid collaboration used to demand a posting WINDOW. Asked what a single date would
 * mean, the founder was explicit: "by that time they should post and campaign should
 * start." That is a deadline — the same thing a sales collaboration already had.
 *
 * These touch no database of their own — but jest's globalSetup connects to the test DB
 * before any suite runs, so while that DB is down they cannot execute either. Written to
 * run the moment it is back; verified in the meantime by exercising the same assertions
 * directly against the module.
 */

const model = require('../src/services/collabTerms.model');

const money = (aim) =>
  aim === 'conversion' ? { commission_pct: 18 }
  : aim === 'hybrid' ? { fee: 10000, commission_pct: 5 }
  : { fee: 25000 };

describe('every aim takes one date, and it means the same thing', () => {
  for (const aim of ['conversion', 'engagement', 'hybrid']) {
    it(`${aim} accepts a post-by date`, () => {
      const r = model.validateTerms({ aim, money: money(aim), time: { post_by: '2026-09-15' } });
      expect(r.ok).toBe(true);
    });

    it(`${aim} refuses terms with no date at all`, () => {
      const r = model.validateTerms({ aim, money: money(aim), time: {} });
      expect(r.ok).toBe(false);
      expect(r.field).toBe('terms.time.post_by');
    });
  }
});

describe('a posting window is refused, not quietly dropped', () => {
  /**
   * Silently ignoring a date somebody deliberately set is how a creator ends up held to
   * a deadline she never agreed to. The brand is told instead.
   */
  it('refuses a window on a paid collaboration', () => {
    const r = model.validateTerms({
      aim: 'engagement', money: money('engagement'),
      time: { post_by: '2026-09-15', window_start: '2026-09-10', window_end: '2026-09-24' },
    });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/one date/i);
  });

  it('refuses a window on a sales collaboration too', () => {
    const r = model.validateTerms({
      aim: 'conversion', money: money('conversion'),
      time: { post_by: '2026-09-15', window_end: '2026-09-24' },
    });
    expect(r.ok).toBe(false);
  });
});

describe('accepting a pitch still produces valid terms', () => {
  /**
   * handshake.termsFromProposal turns a creator's pitch into terms. It used to emit a
   * window for a paid collaboration — which the rule above now refuses, so accepting a
   * pay-for-content pitch would have failed validation with nothing on screen to explain
   * it. This is the shape it emits now.
   */
  const fromPitch = (aim, wStart, wEnd) => ({
    aim, money: money(aim), time: { post_by: wEnd || wStart },
  });

  for (const aim of ['conversion', 'engagement', 'hybrid']) {
    it(`a ${aim} pitch converts into terms the model accepts`, () => {
      expect(model.validateTerms(fromPitch(aim, '2026-09-10', '2026-09-24')).ok).toBe(true);
    });
  }

  it('an older pitch carrying only a start date still converts', () => {
    expect(model.validateTerms(fromPitch('engagement', '2026-09-10', null)).ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 4 — what the fee buys
// ─────────────────────────────────────────────────────────────────────────────

describe('deliverables belong to a fee, not to a commission', () => {
  /**
   * The founder: "if pay per content as an option chosen, one more important thing is
   * what deliverables he can expect for the mentioned amount — this is important for pay
   * for content. This is not required for commission based on sale."
   *
   * A fee buys specific work, so both sides must know what it buys. A commission buys
   * nothing in advance — she earns only if she sells, so counting her posts measures the
   * wrong thing.
   */
  const D = [{ type: 'reel', count: 2 }, { type: 'story', count: 3 }];
  const terms = (aim, extra = {}) => ({
    aim,
    money: aim === 'conversion' ? { commission_pct: 18 }
      : aim === 'hybrid' ? { fee: 10000, commission_pct: 5 } : { fee: 25000 },
    time: { post_by: '2026-09-15' },
    ...extra,
  });

  it('a paid collaboration must say what the fee buys', () => {
    const r = model.validateTerms(terms('engagement'));
    expect(r.ok).toBe(false);
    expect(r.field).toBe('terms.deliverables');
  });

  it('a fee-plus-commission deal must say it too', () => {
    expect(model.validateTerms(terms('hybrid')).ok).toBe(false);
  });

  it('a sales collaboration does not have to', () => {
    expect(model.validateTerms(terms('conversion')).ok).toBe(true);
  });

  it('but a sales brand wanting a minimum commitment is not prevented', () => {
    // "Not required" is not the same as forbidden.
    expect(model.validateTerms(terms('conversion', { deliverables: D })).ok).toBe(true);
  });

  it('accepts the platform vocabulary and nothing else', () => {
    expect(model.validateTerms(terms('engagement', { deliverables: D })).ok).toBe(true);
    const bad = model.validateTerms(terms('engagement', { deliverables: [{ type: 'tiktok', count: 1 }] }));
    expect(bad.ok).toBe(false);
    expect(bad.message).toMatch(/reel, post, story, youtube_video, youtube_short/);
  });

  it('refuses the same format twice', () => {
    // "2 reels" plus "3 reels" is not a richer deal, it is an unanswerable one.
    const r = model.validateTerms(terms('engagement', {
      deliverables: [{ type: 'reel', count: 2 }, { type: 'reel', count: 3 }],
    }));
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/twice/);
  });

  it('refuses a count of zero — that is not a deliverable', () => {
    expect(model.validateTerms(terms('engagement', { deliverables: [{ type: 'reel', count: 0 }] })).ok).toBe(false);
  });

  it('refuses a leftover requirement marker', () => {
    // Deliverables are always negotiable on a paid deal, so a marker contradicts itself.
    const r = model.validateTerms(terms('engagement', {
      deliverables: D, importance: { deliverables: 'requirement' },
    }));
    expect(r.ok).toBe(false);
    expect(r.field).toBe('terms.importance.deliverables');
  });

  it('lets her counter the deliverables on a paid deal, but not on a sales one', () => {
    expect(model.counterableTerms(terms('engagement', { deliverables: D }))).toContain('deliverables');
    expect(model.counterableTerms(terms('conversion'))).not.toContain('deliverables');
  });
});
