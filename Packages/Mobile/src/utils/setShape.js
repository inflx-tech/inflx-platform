/**
 * setShape.js — what shape a set may have, on the phone.
 * Contract: features/stage-a-the-set
 * Design:   features/screen-atlas (mockup-locked 2026-09-01) — SB-25, SB-26, SB-27
 *
 * A MIRROR, NOT A SECOND OPINION
 * Every rule here repeats backend/src/services/setShape.model.js exactly. The server is the
 * authority and will refuse a bad set with a 422; this copy exists only so a day the server
 * would reject is never offered in the picker, and a mode it would refuse is never drawn as
 * a button. If the two ever drift, the server wins and the screen is the bug.
 * `setShape.rules.test.js` pins them together by reading both files.
 *
 * THE RULE
 * A set is one aim, one go-live day, one way of shooting. Money settles INSIDE a set. A day
 * or a shoot mode cannot — other creators already agreed to them — so disagreeing about
 * either one moves her out of the set. (Stage B.)
 */

/** Every value the column accepts. Migration 165's CHECK mirrors this list. */
export const SHOOT_MODES = ['visit', 'shipment', 'remote'];

/**
 * What this wizard OFFERS — two, not three. Founder's decision, 2026-09-01.
 *
 * 'remote' means nothing is sent at all. Offering it here would let a brand pick a path
 * where her address screen never appears and no parcel is ever tracked. It stays reachable
 * only through the older brand-approve flow, which five live contracts resolve through.
 */
export const SHOOT_MODES_OFFERED = ['visit', 'shipment'];

/** What each one says on screen, and the line underneath it. */
export const SHOOT_MODE_COPY = {
  visit:    { title: 'Store visit',           sub: 'She comes to you.' },
  shipment: { title: 'We send the products',  sub: 'You ship them, she keeps them.' },
  remote:   { title: 'No shoot',              sub: 'She works from your images.' },
};

/** Modes where the shoot is not finished until BOTH sides have said so. */
export const shootNeedsBothMarks = (mode) => String(mode || '').toLowerCase() === 'visit';

/**
 * Days between today and the earliest go-live day. She has to be invited, sign, and shoot.
 * Must equal MIN_DAYS_TO_GO_LIVE on the server, or the picker offers a day that is refused.
 */
export const MIN_DAYS_TO_GO_LIVE = 5;

/* ───────────────────────────────────────────────────────── calendar days */

const pad = (n) => String(n).padStart(2, '0');

/**
 * A calendar day as 'YYYY-MM-DD', using LOCAL getters.
 *
 * Deliberately local, not UTC. The 30 Aug bug: a DATE column arrives as a Date at local
 * midnight, and UTC arithmetic on it loses a day — which closed the only day that would
 * have worked on a tight schedule.
 */
export const dayOf = (v) => {
  if (!v) return null;
  if (typeof v === 'string') {
    // Only a real ISO day, not "whatever the first ten characters were". Slicing blindly
    // turned 'not a date' into 'not a date' and would have posted it to the server as a
    // go-live day. Found by setShape.rules.test.js.
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const addDays = (day, n) => {
  const [y, m, d] = String(day).slice(0, 10).split('-').map(Number);
  const t = new Date(y, m - 1, d + n);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
};

export const today = () => dayOf(new Date());

/** The earliest day a set started today may go live. The picker greys out everything before. */
export const earliestGoLiveDay = (from = null) => addDays(from || today(), MIN_DAYS_TO_GO_LIVE);

/**
 * A sensible day to close invitations, given a go-live day: three days before, but never
 * in the past and never after the launch.
 */
export const suggestedInvitesClose = (goLive, from = null) => {
  if (!goLive) return null;
  const now = from || today();
  const three = addDays(goLive, -3);
  return three < now ? goLive : three;
};

/* ─────────────────────────────────────────────────────────── which day */

/**
 * Which day does this set launch on?
 *
 * A set created before set-first has go_live_date null — migration 165 deliberately did not
 * backfill it, because production had window_end on only 2 of 11 sets. So the old window
 * keeps serving those rows.
 */
export const goLiveDayOf = (set) => {
  if (!set) return null;
  if (set.go_live_date) return dayOf(set.go_live_date);
  if (set.window_end) return dayOf(set.window_end);
  if (set.window_start) return dayOf(set.window_start);
  return null;
};

/** True when this set predates set-first and is running on the old window. */
export const isPreSetFirst = (set) => !!set && !set.go_live_date;

/* ────────────────────────────────────────────────────────── validation */

/**
 * Is this a shape a set may have? Returns { ok, field, error } and NEVER throws — the
 * wizard needs to grey out a button, not catch an exception.
 */
export const validateSetShape = (shape = {}, { offeredOnly = true, from = null } = {}) => {
  const { go_live_date, shoot_mode, invites_close_at } = shape || {};
  const now = from || today();

  if (shoot_mode != null && shoot_mode !== '') {
    const allowed = offeredOnly ? SHOOT_MODES_OFFERED : SHOOT_MODES;
    if (!allowed.includes(shoot_mode)) {
      return { ok: false, field: 'shoot_mode', error: `shoot_mode must be one of: ${allowed.join(', ')}` };
    }
  }

  const goLive = go_live_date ? dayOf(go_live_date) : null;
  const closes = invites_close_at ? dayOf(invites_close_at) : null;

  if (goLive) {
    const earliest = addDays(now, MIN_DAYS_TO_GO_LIVE);
    if (goLive < earliest) {
      return {
        ok: false,
        field: 'go_live_date',
        error: `go_live_date must be ${earliest} or later — there has to be time to invite, sign and shoot`,
      };
    }
  }

  if (goLive && closes && goLive < closes) {
    return { ok: false, field: 'invites_close_at', error: 'invites_close_at must be on or before go_live_date' };
  }

  return { ok: true };
};

/** Everything the Basics step needs before it will let the brand continue. */
export const basicsReady = ({ name, go_live_date, shoot_mode }) =>
  !!(name && String(name).trim()) && !!go_live_date && !!shoot_mode;
