'use strict';

/**
 * contentCopy.js — every sentence the content step says, in one place.
 * Contract: features/item12-content · gap-check prompt §7 (server and app, identical text)
 *
 * Same shape as productionCopy: MSG for refusals, NOTIFY12 for the keys and titles, and sentence
 * builders that take a name, a number or a date rather than a row. The app imports a mirror of
 * this file word for word, so a refusal never arrives in two voices. Nothing here may be
 * paraphrased at a call site.
 */

const MSG = {
  // The gate (§12.2) — the prompt's sentences, verbatim.
  SHOOT_NOT_DONE: "The shoot isn't done yet.",
  NOT_PAY_FOR_CONTENT: "This collaboration doesn't use this step.",
  // Q7 / v1.29: never fall back to the live terms.
  NO_ROWS: 'This agreement lists no content. INFLX will sort it out.',
  UNKNOWN_ROW: "That isn't one of the deliverables on your agreement.",

  // The files (C3, C4)
  FILE_TOO_LARGE_PHOTO: 'Photos have to be under 10 MB.',
  FILE_TOO_LARGE_VIDEO: 'Videos have to be under 200 MB.',
  FILE_WRONG_TYPE: 'Send a JPG, PNG or MP4.',
  ROW_FULL: 'You can add up to 10 to one deliverable.',
  CAPTION_TOO_LONG: 'Keep it under 500 characters.',
  UPLOAD_MISSING: "The upload didn't finish. Try again.",
  FILE_NOT_FOUND: "That file isn't part of this content.",

  // Sending (C5)
  PACKAGE_INCOMPLETE: 'Every deliverable needs its files before you can send this.',
  PACKAGE_LOCKED: (brand) => `${brand} are reviewing this. You can change it if they ask for changes.`,
  ALREADY_SUBMITTED: (brand) => `This is already with ${brand}.`,

  // The review (C6, C7, C9, C14)
  NOTHING_TO_REVIEW: (name) => `${name} hasn't sent anything yet.`,
  ALREADY_APPROVED: 'This is already approved.',
  REASON_REQUIRED: 'Say what should change.',
  REASON_TOO_LONG: 'Keep it under 500 characters.',
  NOTE_TOO_LONG: 'Keep it under 300 characters.',
  // Q8 — "both" when the stamped limit is 2, "all {n}" otherwise.
  ROUNDS_USED: (n) => `${Number(n) === 2 ? "You've used both rounds." : `You've used all ${n} rounds.`} Approve this, or report it to INFLX.`,

  // Two devices, one package: a verdict on a round that has already moved on.
  STALE: 'This has changed since you opened it. Look again.',

  // Posting (C10)
  NOT_APPROVED: (brand) => `${brand} haven't approved this yet.`,
  UNKNOWN_SLOT: "That isn't one of the deliverables on your agreement.",
  LINK_INVALID: 'Paste the full link to the post.',
  PROOF_INCOMPLETE: 'Add a link for every deliverable first.',
  ALREADY_POSTED: "You've already told them.",
  SCREENSHOT_ONLY: 'A story is proved with a screenshot.',
  LINK_ONLY: 'Paste the link to the post.',

  // Confirming live (C11)
  NOT_POSTED: (name) => `${name} hasn't posted yet.`,
  ALREADY_CONFIRMED: 'This is already confirmed.',
  AMOUNT_CHANGED: 'The amount changed. Check it and confirm again.',
  COLLAB_ENDED: 'This collaboration has ended.',

  // Reports (C11, C14, C15) — recorded for item 18.
  REPORT_TOO_EARLY: (day) => `You can tell INFLX from ${day}.`,
  ALREADY_REPORTED: "You've already reported this.",
  REPORT_NOT_OPEN: 'There is nothing to report at this point.',
  // Approval §2.7 — ONE guard, ONE sentence, called by every write in the content service.
  REPORTED_HOLD: 'INFLX is looking at this. Nothing can change until they get back to you.',
  // What each side is told when a report is made (v1.29: "Both sides are told the same thing").
  REPORTED_BY_BRAND: (brand) => `${brand} reported this to INFLX. INFLX is looking at this. Nothing can change until they get back to you, and nothing is lost.`,
  REPORTED_BY_CREATOR: (name) => `${name} told INFLX you haven't confirmed her content is live yet. You can still confirm it.`,

  // Retired doors (Phase 2a, approval Q2, Q3) — server-side, whatever a client still shows.
  RETIRED_12_CONTENT: 'Content is sent, reviewed and confirmed in the app now.',
  RETIRED_12_CONFIRM_LIVE: 'Content is confirmed live in the app now, after she has posted it.',
  RETIRED_12_COMPLETE_VISIT: 'She marks the visit in the app, and you confirm it there.',

  // Admin (Q13, Q14)
  RELEASE_REASON_REQUIRED: 'Give a reason of at least 5 characters.',
  RELEASE_NOT_ALLOWED: (status) => `A ${status} payment can't be released by hand.`,
  CANCEL_QUEUED_TRANCHE: 'A creator on this campaign is waiting for her final payment. It can\'t be cancelled until that is paid.',
};

/** The stage words the Delayed chip uses (§12.2, v1.29). The CHECK is widened in migration 192. */
const DELAYED_STAGE_LABEL = {
  content_not_submitted: 'Content not sent',
  content_in_review: 'Content in review',
  content_changes_requested: 'Changes requested',
  content_not_posted: 'Approved, not posted',
  content_not_confirmed: 'Posted, not confirmed',
};

/**
 * Notification keys (D11). `sendSms: false` on every one — push and the in-app bell, as items
 * 5–11 do it. The tranche-3 job's old SMS goes with approval §3.5.
 */
const NOTIFY12 = {
  SUBMITTED:       { type: 'content.submitted',         title: 'Her content is here' },
  RESUBMITTED:     { type: 'content.resubmitted',       title: 'Her changes are here' },
  CHANGES:         { type: 'content.changes_requested', title: 'Changes were asked for' },
  APPROVED:        { type: 'content.approved',          title: 'Your content is approved' },
  POSTED:          { type: 'content.posted',            title: 'She has posted everything' },
  LIVE_CONFIRMED:  { type: 'content.live_confirmed',    title: 'Your content is confirmed live' },
  FINAL_PAID:      { type: 'content.final_paid',        title: 'The final payment is in' },
  COMPLETED:       { type: 'collab.completed',          title: 'Collaboration completed' },
  REPORTED:        { type: 'content.reported',          title: 'This was reported to INFLX' },
  DELAYED:         { type: 'collab.delayed',            title: 'This collaboration is delayed' },
  REMINDER:        { type: 'content.reminder',          title: 'Your content step is waiting on you' },
};

/**
 * The platform each deliverable type is for. The rules name it (§12.2: "an Instagram post, an
 * Instagram reel, an Instagram story, a YouTube video, a YouTube short"); the type list does not
 * carry it separately because every type belongs to exactly one platform.
 */
const PLATFORM_OF_TYPE = {
  reel: 'instagram', post: 'instagram', story: 'instagram',
  youtube_video: 'youtube', youtube_short: 'youtube',
};
const TYPE_LABEL = {
  reel: 'Instagram reel', post: 'Instagram post', story: 'Instagram story',
  youtube_video: 'YouTube video', youtube_short: 'YouTube short',
};
/** The hosts a link may name, per platform (approval Q15–Q29). Shape only, never fetched. */
const HOSTS = {
  instagram: ['instagram.com', 'www.instagram.com', 'm.instagram.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'],
};

module.exports = { MSG, NOTIFY12, DELAYED_STAGE_LABEL, PLATFORM_OF_TYPE, TYPE_LABEL, HOSTS };
