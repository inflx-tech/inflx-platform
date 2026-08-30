'use strict';

/**
 * Calendar days, in India, without losing one.
 *
 * Contract: features/dates-stop-losing-a-day
 *
 * THE BUG THIS EXISTS TO END
 *
 * `contracts.posting_date` is a Postgres DATE — a calendar day, "30 Aug 2026". It is not an
 * instant. The pg driver still hands it to Node as a Date object, built at LOCAL midnight:
 *
 *     stored:   2026-08-30
 *     received: 2026-08-29T18:30:00.000Z     (midnight in India is 6:30pm UTC the day before)
 *
 * Anything that then does UTC arithmetic on it is one day early:
 *
 *     latest.setUTCDate(latest.getUTCDate() - 2)   →  27 Aug, when 28 Aug was meant
 *     value.toISOString().slice(0, 10)             →  "2026-08-29", when it is the 30th
 *
 * Both of those were live in getVisitDateRange, so every visit window in the system was a day
 * short. Nobody noticed because nobody could see the window at all — a separate bug.
 *
 * WHY LOCAL GETTERS ARE THE RIGHT READ FOR A DATE COLUMN
 *
 * The driver builds the Date at midnight in whatever timezone the process runs in. So:
 *
 *     server in IST  →  2026-08-29T18:30Z  →  .getDate() = 30   ✓
 *     server in UTC  →  2026-08-30T00:00Z  →  .getDate() = 30   ✓
 *
 * The local getters give the stored day on ANY server timezone, which matters because Render
 * runs UTC and this laptop runs IST. The UTC getters agree only by luck, on one of them.
 *
 * ⚠️ This applies to DATE columns. An instant — a timestamptz — is a different question, and
 * has its own function below.
 */

/** India is UTC+5:30 all year. No daylight saving, so one constant is the whole story. */
const IST_OFFSET_MINUTES = 5 * 60 + 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * The calendar day a DATE column holds, as 'YYYY-MM-DD'.
 *
 * Accepts what the driver actually returns: a Date built at local midnight, or a string, or
 * null. Use this — never `.toISOString().slice(0, 10)` — on anything that came out of a DATE
 * column.
 *
 * @param {Date|string|null} v
 * @returns {string|null}
 */
function calendarDay(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'string') {
    const m = DAY_RE.exec(v);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The Indian calendar day an INSTANT falls on.
 *
 * For timestamptz values, where the answer genuinely depends on a timezone. 6pm UTC is already
 * tomorrow in India, and a server in UTC would otherwise call it today.
 *
 * @param {Date|string|number} instant
 * @returns {string|null}
 */
function istDayOf(instant) {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return null;
  const shifted = new Date(d.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

/** Today, in India. Not "today on the server", which on Render is UTC and wrong after 6:30pm. */
function todayInIndia() {
  return istDayOf(new Date());
}

/**
 * Move a calendar day by whole days. Stays a calendar day — no hours, no timezone.
 * @param {string} day 'YYYY-MM-DD'
 * @param {number} n may be negative
 */
function addDays(day, n) {
  const m = DAY_RE.exec(String(day || ''));
  if (!m) return null;
  // Built and read in UTC deliberately: this is pure calendar arithmetic on a bare day, and
  // using UTC on both sides means no timezone can enter and shift it.
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Whole days from a to b. Negative when b is before a. */
function daysBetween(a, b) {
  const A = DAY_RE.exec(String(a || '')), B = DAY_RE.exec(String(b || ''));
  if (!A || !B) return null;
  const ta = Date.UTC(+A[1], +A[2] - 1, +A[3]);
  const tb = Date.UTC(+B[1], +B[2] - 1, +B[3]);
  return Math.round((tb - ta) / MS_PER_DAY);
}

/** Day comparison that reads as English. Both arguments are 'YYYY-MM-DD'. */
const isBefore = (a, b) => daysBetween(a, b) > 0;
const isAfter  = (a, b) => daysBetween(a, b) < 0;

/** The first instant of that Indian day — for comparing against a timestamptz. */
function startOfIndiaDay(day) {
  const m = DAY_RE.exec(String(day || ''));
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]) - IST_OFFSET_MINUTES * 60 * 1000);
}

/** The last instant of that Indian day. */
function endOfIndiaDay(day) {
  const start = startOfIndiaDay(day);
  return start ? new Date(start.getTime() + MS_PER_DAY - 1) : null;
}

module.exports = {
  IST_OFFSET_MINUTES,
  calendarDay,
  istDayOf,
  todayInIndia,
  addDays,
  daysBetween,
  isBefore,
  isAfter,
  startOfIndiaDay,
  endOfIndiaDay,
};
