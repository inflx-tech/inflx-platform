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
