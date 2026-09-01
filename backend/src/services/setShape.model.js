'use strict';

/**
 * The shape of a set: one aim, one go-live day, one way of shooting.
 *
 * Contract: features/stage-a-the-set
 * Design:   features/screen-atlas (mockup-locked 2026-09-01) — SB-25, SB-26, SB-27
 *
 * THE RULE THE WHOLE DESIGN TURNS ON
 *
 *   Money settles INSIDE a set and changes nothing for anybody else. A day or a shoot
 *   mode cannot settle inside a set — other creators already agreed to them — so
 *   disagreeing about either one MOVES HER OUT, into a deferred pool from which a later
 *   set is built. (Stage B.)
 *
 * Everything here exists so that the wizard, the server and the creator's app cannot
 * answer "what shape is this set" differently. That fault — two things doing one job —
 * has cost five shipped bugs in this codebase:
 *
 *   the wizard sending [] deliverables while the server called [] an error
 *   the deliverables check running for every aim, so a sale-only contract was rejected
 *     for buying no content
 *   the app's decline list offering 'not_a_fit', which the server never accepted
 *   MAY_COMPLETE read as "either one closes it", so one side closed a visit the other
 *     said never happened
 *   production_mode written in exactly one place, so a brief-to-signing flow left it null
 *
 * Every rule below is written once and exported, so no caller can invent a sixth.
 */

const { todayInIndia, calendarDay, addDays, isBefore } = require('../utils/indiaDay');

/* ─────────────────────────────────────────────────────────────── shoot mode */

/**
 * Every value the column accepts. The CHECK in migration 165 mirrors this list.
 *
 *   visit      she comes to the store        BOTH sides mark it done
 *   shipment   the brand sends the products  SHE ALONE marks it done
 *   remote     nothing is sent               SHE ALONE marks it done
 */
const SHOOT_MODES = ['visit', 'shipment', 'remote'];

/**
 * What the set wizard OFFERS — two, not three. Founder's decision, 2026-09-01.
 *
 * The atlas draws two and calls the second one "remote", but everything Book 3 describes
 * under that name — her address, tracking, "everything arrived" — is SHIPMENT. The
 * no-parcel 'remote' stays reachable only through the older brand-approve flow, which five
 * live contracts still resolve their mode through. Offering it on the wizard would let a
 * brand pick a path where nothing is ever sent and her address screen never appears.
 */
const SHOOT_MODES_OFFERED = ['visit', 'shipment'];

const SHOOT_MODE_LABELS = {
  visit:    'Store visit',
  shipment: 'We send the products',
  remote:   'No shoot',
};

/** Modes where the shoot is not finished until BOTH sides have said so. */
const shootNeedsBothMarks = (mode) => String(mode || '').toLowerCase() === 'visit';

/* ─────────────────────────────────────────────────────────── the go-live day */

/**
 * Days between a set opening and its go-live day, at the very least: she has to be
 * invited, sign, and shoot. The wizard closes anything sooner.
 */
const MIN_DAYS_TO_GO_LIVE = 5;

/**
 * Which day does this set launch on?
 *
 * A set created before set-first has go_live_date NULL — migration 165 deliberately did
 * not backfill it, because production had window_end on only 2 of 11 sets and inventing a
 * launch day for nine live campaigns is not a migration, it is a guess. So the old window
 * keeps serving those rows, exactly as it does today.
 *
 * @returns {string|null} 'YYYY-MM-DD' in India, or null if the set has no day at all
 */
const goLiveDayOf = (set) => {
  if (!set) return null;
  if (set.go_live_date) return calendarDay(set.go_live_date);
  // pre-set-first fallback: the end of the posting window, then its start
  if (set.window_end) return calendarDay(set.window_end);
  if (set.window_start) return calendarDay(set.window_start);
  return null;
};

/** True when this set predates set-first and is running on the old window. */
const isPreSetFirst = (set) => !!set && !set.go_live_date;

/* ────────────────────────────────────────────────────────────── validation */

/**
 * Is this a shape a set may have?
 *
 * Returns { ok, error } and NEVER throws — the caller decides whether a bad shape is a
 * 422 or a disabled button, and the app needs the same answer without an exception.
 *
 * @param {object}  shape
 * @param {boolean} shape.offeredOnly  true when it came from the wizard, which offers two
 *                                     modes; false for the older brand-approve path
 * @param {string}  today              'YYYY-MM-DD'; injected so tests are not time-bombs
 */
const validateSetShape = (shape = {}, { offeredOnly = true, today = null } = {}) => {
  const { go_live_date, shoot_mode, invites_close_at } = shape;
  const now = today || todayInIndia();

  if (shoot_mode != null && shoot_mode !== '') {
    const allowed = offeredOnly ? SHOOT_MODES_OFFERED : SHOOT_MODES;
    if (!allowed.includes(shoot_mode)) {
      return {
        ok: false,
        field: 'shoot_mode',
        error: `shoot_mode must be one of: ${allowed.join(', ')}`,
      };
    }
  }

  // Both dates are optional — a draft set is being built up a screen at a time, and a
  // pre-set-first set has neither. Only their RELATIONSHIP is enforced, and only when
  // both are actually present.
  const goLive = go_live_date ? calendarDay(go_live_date) : null;
  const closes = invites_close_at ? calendarDay(invites_close_at) : null;

  if (goLive) {
    const earliest = addDays(now, MIN_DAYS_TO_GO_LIVE);
    if (isBefore(goLive, earliest)) {
      return {
        ok: false,
        field: 'go_live_date',
        error: `go_live_date must be ${earliest} or later — there has to be time to invite, sign and shoot`,
      };
    }
  }

  if (goLive && closes && isBefore(goLive, closes)) {
    return {
      ok: false,
      field: 'invites_close_at',
      error: 'invites_close_at must be on or before go_live_date',
    };
  }

  return { ok: true };
};

/**
 * The earliest day a set being created today may go live. The date picker greys out
 * everything before this rather than letting the brand pick a day and be refused.
 */
const earliestGoLiveDay = (today = null) => addDays(today || todayInIndia(), MIN_DAYS_TO_GO_LIVE);

module.exports = {
  SHOOT_MODES,
  SHOOT_MODES_OFFERED,
  SHOOT_MODE_LABELS,
  MIN_DAYS_TO_GO_LIVE,
  shootNeedsBothMarks,
  goLiveDayOf,
  isPreSetFirst,
  validateSetShape,
  earliestGoLiveDay,
};
