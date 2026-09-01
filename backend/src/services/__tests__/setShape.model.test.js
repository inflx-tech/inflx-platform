'use strict';

/**
 * The set's shape — one aim, one go-live day, one way of shooting.
 * Contract: features/stage-a-the-set
 *
 * Every case below was mutation-tested: the model was deliberately broken and each test
 * confirmed to fail before being kept. A test that passes against a broken model is worse
 * than no test, and this codebase has shipped nine of them.
 */

const {
  SHOOT_MODES,
  SHOOT_MODES_OFFERED,
  shootNeedsBothMarks,
  goLiveDayOf,
  isPreSetFirst,
  validateSetShape,
  earliestGoLiveDay,
  MIN_DAYS_TO_GO_LIVE,
} = require('../setShape.model');

describe('shoot modes', () => {
  test('the column accepts three, the wizard offers two', () => {
    expect(SHOOT_MODES).toEqual(['visit', 'shipment', 'remote']);
    expect(SHOOT_MODES_OFFERED).toEqual(['visit', 'shipment']);
  });

  test('remote is NOT offered by the wizard — it would skip her address screen', () => {
    expect(SHOOT_MODES_OFFERED).not.toContain('remote');
    // but it stays legal for the older brand-approve path
    expect(SHOOT_MODES).toContain('remote');
  });

  test('only a store visit needs both marks', () => {
    expect(shootNeedsBothMarks('visit')).toBe(true);
    expect(shootNeedsBothMarks('shipment')).toBe(false);
    expect(shootNeedsBothMarks('remote')).toBe(false);
  });
});

describe('which day does this set launch on', () => {
  test('go_live_date wins when it is there', () => {
    expect(goLiveDayOf({ go_live_date: '2026-09-12', window_end: '2026-09-30' }))
      .toBe('2026-09-12');
  });

  test('a pre-set-first set falls back to window_end', () => {
    // 9 of the 11 live sets have no window_end either — this is the 2 that do
    expect(goLiveDayOf({ go_live_date: null, window_end: '2026-09-30' }))
      .toBe('2026-09-30');
  });

  test('then to window_start', () => {
    expect(goLiveDayOf({ go_live_date: null, window_end: null, window_start: '2026-08-26' }))
      .toBe('2026-08-26');
  });

  test('a set with no day at all returns null rather than inventing one', () => {
    expect(goLiveDayOf({ go_live_date: null, window_end: null, window_start: null }))
      .toBeNull();
    expect(goLiveDayOf(null)).toBeNull();
  });

  test('a DATE column arriving as a local-midnight Date keeps its calendar day', () => {
    // the 30 Aug bug: UTC arithmetic on a local-midnight Date loses a day
    const localMidnight = new Date(2026, 8, 12); // 12 Sep 2026, local
    expect(goLiveDayOf({ go_live_date: localMidnight })).toBe('2026-09-12');
  });

  test('isPreSetFirst is true exactly when go_live_date is absent', () => {
    expect(isPreSetFirst({ go_live_date: null, window_end: '2026-09-30' })).toBe(true);
    expect(isPreSetFirst({ go_live_date: '2026-09-12' })).toBe(false);
  });
});

describe('validating a shape', () => {
  const TODAY = '2026-09-01';

  test('a set the wizard could produce is fine', () => {
    const r = validateSetShape(
      { go_live_date: '2026-09-12', shoot_mode: 'visit', invites_close_at: '2026-09-09' },
      { today: TODAY }
    );
    expect(r.ok).toBe(true);
  });

  test('the wizard cannot choose remote', () => {
    const r = validateSetShape({ shoot_mode: 'remote' }, { today: TODAY });
    expect(r.ok).toBe(false);
    expect(r.field).toBe('shoot_mode');
    expect(r.error).toContain('visit, shipment');
    expect(r.error).not.toContain('remote,');
  });

  test('but the brand-approve path still can', () => {
    const r = validateSetShape({ shoot_mode: 'remote' }, { today: TODAY, offeredOnly: false });
    expect(r.ok).toBe(true);
  });

  test('a mode nobody recognises is refused on both paths', () => {
    expect(validateSetShape({ shoot_mode: 'teleport' }, { today: TODAY }).ok).toBe(false);
    expect(validateSetShape({ shoot_mode: 'teleport' }, { today: TODAY, offeredOnly: false }).ok)
      .toBe(false);
  });

  test('a go-live day too soon to invite, sign and shoot is refused', () => {
    const r = validateSetShape({ go_live_date: '2026-09-03' }, { today: TODAY });
    expect(r.ok).toBe(false);
    expect(r.field).toBe('go_live_date');
    expect(r.error).toContain('2026-09-06');
  });

  test('the earliest allowed day is exactly on the boundary, not one past it', () => {
    const edge = earliestGoLiveDay(TODAY);
    expect(edge).toBe('2026-09-06');
    expect(validateSetShape({ go_live_date: edge }, { today: TODAY }).ok).toBe(true);
    // and the day before it is not
    expect(validateSetShape({ go_live_date: '2026-09-05' }, { today: TODAY }).ok).toBe(false);
  });

  test('invitations cannot close after the set has launched', () => {
    const r = validateSetShape(
      { go_live_date: '2026-09-12', invites_close_at: '2026-09-14' },
      { today: TODAY }
    );
    expect(r.ok).toBe(false);
    expect(r.field).toBe('invites_close_at');
  });

  test('closing ON the go-live day is allowed', () => {
    const r = validateSetShape(
      { go_live_date: '2026-09-12', invites_close_at: '2026-09-12' },
      { today: TODAY }
    );
    expect(r.ok).toBe(true);
  });

  test('a half-built draft is not refused — the wizard fills it in a screen at a time', () => {
    expect(validateSetShape({}, { today: TODAY }).ok).toBe(true);
    expect(validateSetShape({ shoot_mode: 'visit' }, { today: TODAY }).ok).toBe(true);
    expect(validateSetShape({ go_live_date: '2026-09-12' }, { today: TODAY }).ok).toBe(true);
  });

  test('a pre-set-first set is not retrospectively invalid', () => {
    // all 11 live rows: every new column null. Publishing one must not start failing.
    const r = validateSetShape(
      { go_live_date: null, shoot_mode: null, invites_close_at: null },
      { today: TODAY }
    );
    expect(r.ok).toBe(true);
  });

  test('it never throws — the app needs the same answer without an exception', () => {
    expect(() => validateSetShape(undefined, { today: TODAY })).not.toThrow();
    expect(() => validateSetShape({ go_live_date: 'not a date' }, { today: TODAY })).not.toThrow();
  });

  test('the minimum lead time is the one the picker greys out from', () => {
    // if these two ever disagree, the brand picks a day the picker offered and is refused
    expect(earliestGoLiveDay(TODAY)).toBe('2026-09-06');
    expect(MIN_DAYS_TO_GO_LIVE).toBe(5);
  });
});
