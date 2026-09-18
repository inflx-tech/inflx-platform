'use strict';

/**
 * Calendar days, in India, without losing one.
 * Contract: features/dates-stop-losing-a-day
 *
 * Founder, 2026-08-30: "ok pls fix this" — the day-loss found while analysing every date in the
 * campaign flow.
 *
 * THE BUG, ON HIS OWN ROW
 *   contracts.posting_date stored   2026-08-30
 *   the driver hands Node           2026-08-29T18:30:00.000Z   (midnight in India)
 *   old code subtracted 2 days IN UTC  →  27 Aug, when 28 Aug was meant
 *
 * Every visit window in the system was a day short. Silently, on every campaign.
 *
 * Runs through scripts/run-test-file.js — the test database is still unreachable and these
 * assertions need none.
 */

const fs   = require('fs');
const path = require('path');
const D = require('../src/utils/indiaDay');

const read = (p) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');
/** Comments state intent; only shipped code proves it. Eight checks in this repo have passed by
 *  matching their own explanatory comment. */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** What the pg driver actually hands over for a DATE column, on a server running IST. */
const asIstServer = (day) => new Date(`${day}T00:00:00+05:30`);
/** And on a server running UTC — Render. Same stored day, different instant. */
const asUtcServer = (day) => new Date(`${day}T00:00:00Z`);

describe('reading a DATE column without losing the day', () => {
  test('⚠️ his exact row: stored 30 Aug, received as 29 Aug 18:30Z, read back as 30 Aug', () => {
    const received = asIstServer('2026-08-30');
    expect(received.toISOString()).toBe('2026-08-29T18:30:00.000Z');
    // The old way, kept here so the difference is visible rather than described.
    expect(received.toISOString().slice(0, 10)).toBe('2026-08-29');
    // The right way.
    expect(D.calendarDay(received)).toBe('2026-08-30');
  });

  test('a plain string is already a calendar day', () => {
    expect(D.calendarDay('2026-08-30')).toBe('2026-08-30');
    expect(D.calendarDay('2026-08-30T00:00:00.000Z')).toBe('2026-08-30');
  });

  test('nothing in, nothing out — never a wrong day', () => {
    for (const v of [null, undefined, '', 'not a date', new Date('nonsense')]) {
      expect([String(v), D.calendarDay(v)]).toEqual([String(v), null]);
    }
  });
});

describe('an INSTANT is a different question, and gets a different function', () => {
  test('6:30pm UTC is already tomorrow in India', () => {
    // The reason todayInIndia cannot just use the server clock: Render runs UTC.
    // ⚠️ My first version of this used 18:00 and expected the 31st. Wrong — the turn is at
    // 18:30, so 18:00 UTC is 11:30pm the SAME day in India. The test caught my fixture,
    // which is what a boundary test is for.
    expect(D.istDayOf('2026-08-30T18:30:00Z')).toBe('2026-08-31');
    expect(D.istDayOf('2026-08-30T18:30:00Z')).not.toBe('2026-08-30');
  });

  test('and one second before the turn it is still today', () => {
    expect(D.istDayOf('2026-08-30T18:29:59Z')).toBe('2026-08-30');
    expect(D.istDayOf('2026-08-30T18:00:00Z')).toBe('2026-08-30');
  });

  test('midnight UTC is early morning in India, same day', () => {
    expect(D.istDayOf('2026-08-30T00:00:00Z')).toBe('2026-08-30');
  });
});

describe('calendar arithmetic stays on the calendar', () => {
  test('adding and subtracting days', () => {
    expect(D.addDays('2026-08-30', 1)).toBe('2026-08-31');
    expect(D.addDays('2026-08-30', -1)).toBe('2026-08-29');
    expect(D.addDays('2026-08-30', 0)).toBe('2026-08-30');
  });

  test('across a month end', () => {
    expect(D.addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(D.addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  test('across a year end', () => {
    expect(D.addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  test('across a leap day', () => {
    expect(D.addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(D.addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  test('daysBetween counts whole days, signed', () => {
    expect(D.daysBetween('2026-08-30', '2026-09-02')).toBe(3);
    expect(D.daysBetween('2026-09-02', '2026-08-30')).toBe(-3);
    expect(D.daysBetween('2026-08-30', '2026-08-30')).toBe(0);
  });

  test('and it reads as English', () => {
    expect(D.isBefore('2026-08-30', '2026-08-31')).toBe(true);
    expect(D.isAfter('2026-08-31', '2026-08-30')).toBe(true);
    expect(D.isBefore('2026-08-30', '2026-08-30')).toBe(false);
  });
});

describe('a day has a first and a last moment, in India', () => {
  test('the day starts at 6:30pm UTC the evening before', () => {
    expect(D.startOfIndiaDay('2026-08-30').toISOString()).toBe('2026-08-29T18:30:00.000Z');
  });

  test('and ends a millisecond before the next one starts', () => {
    expect(D.endOfIndiaDay('2026-08-30').toISOString()).toBe('2026-08-30T18:29:59.999Z');
    expect(D.endOfIndiaDay('2026-08-30').getTime() + 1)
      .toBe(D.startOfIndiaDay('2026-08-31').getTime());
  });

  test('⚠️ so a 9am visit on the last allowed day is INSIDE it', () => {
    // In UTC that instant is 3:30am on the following day. Comparing against UTC boundaries
    // refused it, which is the same off-by-one wearing different clothes.
    const nineAm = new Date('2026-08-30T09:00:00+05:30');
    expect(nineAm.getTime()).toBeGreaterThan(D.startOfIndiaDay('2026-08-30').getTime());
    expect(nineAm.getTime()).toBeLessThan(D.endOfIndiaDay('2026-08-30').getTime());
  });
});

describe('the visit window itself', () => {
  const prod = () => code('../src/services/production.service.js');

  test('⚠️ no UTC date arithmetic survives in it', () => {
    // The whole class of bug, banned from the file rather than fixed case by case.
    const src = prod();
    expect(src).not.toMatch(/setUTCDate\(/);
    expect(src).not.toMatch(/setUTCHours\(/);
    expect(src).not.toMatch(/toISOString\(\)\.slice\(0, ?10\)/);
  });

  test('it reads the posting date as a calendar day', () => {
    expect(prod()).toContain('addDays(calendarDay(r.posting_date), -PRE_VISIT_BUFFER_DAYS_AGAINST_POSTING)');
  });

  test('the earliest day is TODAY in India, not on the server (item 10, founder Q10: no minimum notice)', () => {
    // Was "tomorrow" (addDays(todayInIndia(), 1)). Rules v1.24 §11.1 sets no minimum notice — a
    // brand and a creator who agree on "this afternoon" are not doing anything wrong — so the
    // window opens today; only the past is refused, and that is judged on the instant.
    expect(prod()).toContain('const earliest = todayInIndia();');
    expect(prod()).not.toContain('addDays(todayInIndia(), 1)');
  });

  test('⚠️ it reads window_end, the field the wizard actually writes', () => {
    // content_end_date has never been written by either app, so reading it alone made that
    // branch dead code and the window fell through to the campaign end or the year-out ceiling.
    // ⚠️ Asserting the phrase once was satisfied by EITHER of the two places it appears, so
    // breaking the branch condition alone stayed green. Both sites, separately.
    expect(prod()).toContain('} else if (r.window_end || r.content_end_date) {');
    expect(prod()).toContain('addDays(calendarDay(r.window_end || r.content_end_date)');
    expect(prod()).toContain('cs.window_end,');
  });

  test('the buffer is one day, as the founder approved', () => {
    expect(prod()).toContain('const PRE_VISIT_BUFFER_DAYS_AGAINST_POSTING = 1;');
  });

  test('and a slot is compared against Indian day boundaries', () => {
    const src = prod();
    expect(src).toContain('startOfIndiaDay(range.earliest)');
    expect(src).toContain('endOfIndiaDay(range.latest)');
  });
});

describe('what his own row now produces', () => {
  // Reproduced without a database: posting_date 30 Aug, a 1-day buffer.
  test('latest is 29 Aug — the day before she posts, not two days before', () => {
    const posting = D.calendarDay(asIstServer('2026-08-30'));
    expect(D.addDays(posting, -1)).toBe('2026-08-29');
  });

  test('and the same answer on a UTC server, which is the point', () => {
    // Render runs UTC, this laptop runs IST. The old code agreed with itself on one of them.
    const ist = D.calendarDay(asIstServer('2026-08-30'));
    const utc = D.calendarDay(asUtcServer('2026-08-30'));
    expect([ist, utc]).toEqual(['2026-08-30', '2026-08-30']);
  });
});
