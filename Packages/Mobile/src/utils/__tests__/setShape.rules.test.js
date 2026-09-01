/**
 * setShape — the phone's copy against the server's.
 * Contract: features/stage-a-the-set
 *
 * The point of this file is NOT that the phone's rules are correct in isolation. It is that
 * they are the SAME rules. A mirror that quietly drifts is worse than no mirror: the wizard
 * offers a day, the server refuses it, and the brand has no idea which of them is wrong.
 *
 * So the cases below read BOTH files and compare. Everything else in the app follows the
 * shoot.rules.test.js pattern for exactly this reason.
 */

const fs = require('fs');
const path = require('path');

const shape = require('../setShape');

const SERVER = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', '..', '..', 'backend', 'src', 'services', 'setShape.model.js'),
  'utf8'
);

/** Pull an exported array literal out of the server file, e.g. SHOOT_MODES. */
const serverArray = (name) => {
  const m = SERVER.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`));
  expect(m).toBeTruthy();
  return m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).filter(Boolean);
};

const serverNumber = (name) => {
  const m = SERVER.match(new RegExp(`const ${name} = (\\d+)`));
  expect(m).toBeTruthy();
  return Number(m[1]);
};

describe('the phone agrees with the server', () => {
  test('the same three modes are legal', () => {
    expect(shape.SHOOT_MODES).toEqual(serverArray('SHOOT_MODES'));
  });

  test('the same two are offered', () => {
    expect(shape.SHOOT_MODES_OFFERED).toEqual(serverArray('SHOOT_MODES_OFFERED'));
  });

  test('the lead time is identical — or the picker offers a day that is refused', () => {
    expect(shape.MIN_DAYS_TO_GO_LIVE).toBe(serverNumber('MIN_DAYS_TO_GO_LIVE'));
  });

  test('the server really does exclude remote from what is offered', () => {
    // guards against this test passing because BOTH sides were changed to allow it
    expect(serverArray('SHOOT_MODES_OFFERED')).not.toContain('remote');
    expect(serverArray('SHOOT_MODES')).toContain('remote');
  });
});

describe('calendar days', () => {
  test('a local-midnight Date keeps its day', () => {
    // the 30 Aug bug: UTC arithmetic on a DATE column loses a day
    expect(shape.dayOf(new Date(2026, 8, 12))).toBe('2026-09-12');
  });

  test('a string is taken as-is, not re-parsed through a timezone', () => {
    expect(shape.dayOf('2026-09-12')).toBe('2026-09-12');
    expect(shape.dayOf('2026-09-12T18:30:00.000Z')).toBe('2026-09-12');
  });

  test('addDays crosses a month boundary', () => {
    expect(shape.addDays('2026-08-30', 5)).toBe('2026-09-04');
  });

  test('addDays crosses a year boundary', () => {
    expect(shape.addDays('2026-12-30', 5)).toBe('2027-01-04');
  });

  test('nothing in, null out — never today', () => {
    expect(shape.dayOf(null)).toBeNull();
    expect(shape.dayOf('')).toBeNull();
    expect(shape.dayOf('not a date')).toBeNull();
  });
});

describe('which day this set launches on', () => {
  test('go_live_date wins', () => {
    expect(shape.goLiveDayOf({ go_live_date: '2026-09-12', window_end: '2026-09-30' }))
      .toBe('2026-09-12');
  });

  test('a pre-set-first set falls back to the old window', () => {
    expect(shape.goLiveDayOf({ window_end: '2026-09-30' })).toBe('2026-09-30');
    expect(shape.goLiveDayOf({ window_start: '2026-08-26' })).toBe('2026-08-26');
  });

  test('a set with no day at all returns null rather than inventing one', () => {
    expect(shape.goLiveDayOf({})).toBeNull();
    expect(shape.isPreSetFirst({ window_end: '2026-09-30' })).toBe(true);
    expect(shape.isPreSetFirst({ go_live_date: '2026-09-12' })).toBe(false);
  });
});

describe('what the wizard will and will not accept', () => {
  const FROM = '2026-09-01';

  test('a set the wizard could produce is fine', () => {
    expect(shape.validateSetShape(
      { go_live_date: '2026-09-12', shoot_mode: 'visit', invites_close_at: '2026-09-09' },
      { from: FROM }
    ).ok).toBe(true);
  });

  test('the wizard cannot choose remote', () => {
    const r = shape.validateSetShape({ shoot_mode: 'remote' }, { from: FROM });
    expect(r.ok).toBe(false);
    expect(r.field).toBe('shoot_mode');
  });

  test('the earliest day is on the boundary, and the day before is not', () => {
    expect(shape.earliestGoLiveDay(FROM)).toBe('2026-09-06');
    expect(shape.validateSetShape({ go_live_date: '2026-09-06' }, { from: FROM }).ok).toBe(true);
    expect(shape.validateSetShape({ go_live_date: '2026-09-05' }, { from: FROM }).ok).toBe(false);
  });

  test('invitations cannot close after the launch, but may close on it', () => {
    expect(shape.validateSetShape(
      { go_live_date: '2026-09-12', invites_close_at: '2026-09-14' }, { from: FROM }).ok).toBe(false);
    expect(shape.validateSetShape(
      { go_live_date: '2026-09-12', invites_close_at: '2026-09-12' }, { from: FROM }).ok).toBe(true);
  });

  test('a half-built draft is not refused', () => {
    expect(shape.validateSetShape({}, { from: FROM }).ok).toBe(true);
    expect(shape.validateSetShape({ shoot_mode: 'visit' }, { from: FROM }).ok).toBe(true);
  });

  test('it never throws', () => {
    expect(() => shape.validateSetShape(undefined, { from: FROM })).not.toThrow();
    expect(() => shape.validateSetShape(null, { from: FROM })).not.toThrow();
  });
});

describe('the suggested invitations-close day', () => {
  test('three days before the launch', () => {
    expect(shape.suggestedInvitesClose('2026-09-12', '2026-09-01')).toBe('2026-09-09');
  });

  test('never in the past — a launch four days out does not suggest yesterday', () => {
    const s = shape.suggestedInvitesClose('2026-09-03', '2026-09-01');
    expect(s >= '2026-09-01').toBe(true);
  });

  test('no launch day, no suggestion', () => {
    expect(shape.suggestedInvitesClose(null)).toBeNull();
  });
});

describe('the Basics step knows when it is done', () => {
  test('all three, or not ready', () => {
    expect(shape.basicsReady({ name: 'Sarees', go_live_date: '2026-09-12', shoot_mode: 'visit' })).toBe(true);
    expect(shape.basicsReady({ name: '', go_live_date: '2026-09-12', shoot_mode: 'visit' })).toBe(false);
    expect(shape.basicsReady({ name: '   ', go_live_date: '2026-09-12', shoot_mode: 'visit' })).toBe(false);
    expect(shape.basicsReady({ name: 'Sarees', go_live_date: null, shoot_mode: 'visit' })).toBe(false);
    expect(shape.basicsReady({ name: 'Sarees', go_live_date: '2026-09-12', shoot_mode: null })).toBe(false);
  });
});
