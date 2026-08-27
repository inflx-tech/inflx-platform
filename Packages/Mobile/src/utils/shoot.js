/**
 * shoot.js — everything both phones need to say the same thing about a shoot.
 * Contract: features/stage-4-the-shoot · boards ② ③ ④ ⑤ ⑥
 *
 * WHY THIS FILE EXISTS AT ALL
 * The recurring fault in this programme is **two things doing one job** — four of Stage 1's
 * twenty-one bugs, and a whole competing spine deleted in Stage 3. The shoot is the step most
 * exposed to it: the same event is rendered on a brand's phone and a creator's phone, and the
 * two must never disagree about who is waiting for whom.
 *
 * So the labels, the turn, and the completion rule live here once and are imported by both.
 *
 * THE COMPLETION RULE IS A MIRROR, NOT A SECOND OPINION
 * `canComplete` below repeats backend/src/services/parcel.service.js exactly. The server is
 * the authority and will refuse a bad call with a 403; this copy exists only so a button that
 * would be refused is never drawn. If the two ever drift, the server wins and the screen is
 * the bug. `shoot.rules.test.js` pins them together.
 */

/** Who may say "the shooting is done", by mode. Founder's ruling, 2026-08-27. */
export const MAY_COMPLETE = {
  visit: ['brand', 'influencer'],   // the brand was there; they know it happened
  shipment: ['influencer'],         // the brand cannot see whether she has shot anything
  remote: ['influencer'],
};

export const canComplete = (mode, role) =>
  (MAY_COMPLETE[mode] || ['influencer']).includes(role);

/**
 * Why the brand cannot close a remote shoot. Shown instead of the button, because a missing
 * button with no explanation reads as a bug.
 */
export const WHY_NOT_YOURS =
  'Only she can say the shoot is done — you cannot see whether it has happened yet. She submits the content next, and that is the proof.';

export const MODE_LABEL = {
  visit: 'Store visit',
  shipment: 'We ship to her',
  remote: 'Remote',
};

export const MODE_LINE = {
  visit: 'She comes to you.',
  shipment: 'The goods travel to her.',
  remote: 'She shoots with what she has.',
};

/**
 * Event status → what a person would call it.
 *
 * These are the FIVE the server actually writes — checked against production.service, not
 * remembered. There is no 'countered' status: a counter keeps the event 'proposed' and flips
 * `slot_proposed_by`. A label for a status that cannot occur is how a screen ends up with a
 * branch nobody can reach.
 */
export const STATUS_LABEL = {
  proposed: 'A time is on the table',
  confirmed: 'Settled',
  in_progress: 'In progress',
  completed: 'Done',
  cancelled: 'Cancelled',
};

/** Two per side, enforced server-side since before this stage. Mirrored for the counter. */
export const RESCHEDULE_LIMIT_PER_SIDE = 2;

/** How many suggestions this side has left. Never negative, never undefined. */
export function countersLeft(event, role) {
  const used = role === 'brand'
    ? Number(event?.reschedule_count_brand || 0)
    : Number(event?.reschedule_count_influencer || 0);
  return Math.max(0, RESCHEDULE_LIMIT_PER_SIDE - used);
}

/**
 * Whose move it is. Returns { who: 'brand'|'influencer'|null, line }.
 * `null` means nobody is blocked — the shoot is simply running or finished.
 *
 * A PROPOSED slot belongs to whoever did NOT propose it. That is `slot_proposed_by`, not the
 * status: the status stays 'proposed' through every counter, so reading it alone would leave
 * both phones saying "waiting on them" at the same time.
 */
export function turnOf(event, mode, opts = {}) {
  if (!event) return { who: 'brand', line: 'Set the shoot up.' };
  const m = mode || event.mode;
  const her = opts.creatorName || 'She';
  const herLower = opts.creatorName || 'she';

  switch (event.status) {
    case 'proposed': {
      if (!event.visit_scheduled_at) {
        return { who: 'brand', line: 'No time suggested yet.' };
      }
      // Whoever proposed it is waiting; the other side answers.
      return event.slot_proposed_by === 'influencer'
        ? { who: 'brand', line: `${her} suggested a time. Accept it, or suggest another.` }
        : { who: 'influencer', line: `${her} is deciding on the time.` };
    }
    case 'confirmed':
      if (m === 'visit') return { who: null, line: 'The time is settled.' };
      if (!event.shipment_dispatched_at) return { who: 'brand', line: 'Send the goods.' };
      return { who: 'influencer', line: `The parcel is on its way — ${herLower} confirms it when it lands.` };
    case 'in_progress':
      // stage-4 — a parcel that has landed leaves the shoot HERE, not completed. Receiving is
      // not shooting; the box arriving is not the photographs being taken.
      return { who: 'influencer', line: `${her} is shooting.` };
    case 'completed':
      return { who: null, line: 'The shoot is done.' };
    case 'cancelled':
      return { who: null, line: 'This shoot was cancelled.' };
    default:
      return { who: null, line: '' };
  }
}

/** A date the way a person writes it: "Thu 28 Aug". */
export function shortDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function shortDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${shortDate(value)}, ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}`;
}

/**
 * The sentence under the date window.
 *
 * The board flags this as the likeliest wording failure in the stage: the range is computed
 * from the campaign's posting dates, and "post-by minus two days" is a rule neither party set.
 * If it reads as arbitrary she will argue with it. So the REASON is given in words, never as
 * the arithmetic.
 */
export function windowReason(range) {
  if (!range) return null;
  switch (range.basis) {
    case 'post_by':
      return 'This leaves two days between the shoot and the day your post is due.';
    case 'posting_window':
      return 'This leaves three days between the shoot and the start of the posting window.';
    case 'campaign_end':
      return 'This leaves three days before the campaign ends.';
    case 'open_ended':
      // A sales campaign runs open-ended by design, so there is no end date to work back
      // from. Saying 'the campaign's dates' here would name a date that does not exist.
      return 'This campaign has no end date, so any day from tomorrow works.';
    default:
      return null;
  }
}

/** What is in the box, summarised for a header line. */
export function parcelLine(summary) {
  if (!summary || !summary.total) return null;
  const n = summary.total;
  const items = `${n} item${n === 1 ? '' : 's'}`;
  if (summary.parcels > 1) return `${items} across ${summary.parcels} parcels`;
  return items;
}

export const RECEIPT_LABEL = {
  received: 'Arrived',
  missing: 'Not in the box',
  damaged: 'Damaged',
};
