/**
 * Item 12 — every string the content screens show, word for word from the REISSUED locked mockups
 * (C1–C16) and the gap-check prompt §6–§7. MSG12 mirrors backend/src/services/contentCopy.js —
 * a test holds the two identical, so a refusal never arrives in two voices.
 * Contract: features/item12-content
 */
import { first, rupees5, DELIVERABLE_TYPES } from '../invitations/copy5';
import { day10 } from '../shoot/copy10';

export { first, rupees5, day10 };

export const MSG12 = {
  SHOOT_NOT_DONE: "The shoot isn't done yet.",
  NOT_PAY_FOR_CONTENT: "This collaboration doesn't use this step.",
  NO_ROWS: 'This agreement lists no content. INFLX will sort it out.',
  FILE_TOO_LARGE_PHOTO: 'Photos have to be under 10 MB.',
  FILE_TOO_LARGE_VIDEO: 'Videos have to be under 200 MB.',
  FILE_WRONG_TYPE: 'Send a JPG, PNG or MP4.',
  ROW_FULL: 'You can add up to 10 to one deliverable.',
  CAPTION_TOO_LONG: 'Keep it under 500 characters.',
  UPLOAD_MISSING: "The upload didn't finish. Try again.",
  PACKAGE_INCOMPLETE: 'Every deliverable needs its files before you can send this.',
  PACKAGE_LOCKED: (brand) => `${brand} are reviewing this. You can change it if they ask for changes.`,
  ALREADY_SUBMITTED: (brand) => `This is already with ${brand}.`,
  ALREADY_APPROVED: 'This is already approved.',
  REASON_REQUIRED: 'Say what should change.',
  REASON_TOO_LONG: 'Keep it under 500 characters.',
  NOTE_TOO_LONG: 'Keep it under 300 characters.',
  ROUNDS_USED: (n) => `${Number(n) === 2 ? "You've used both rounds." : `You've used all ${n} rounds.`} Approve this, or report it to INFLX.`,
  LINK_INVALID: 'Paste the full link to the post.',
  PROOF_INCOMPLETE: 'Add a link for every deliverable first.',
  NOT_POSTED: (name) => `${name} hasn't posted yet.`,
  ALREADY_CONFIRMED: 'This is already confirmed.',
  REPORT_TOO_EARLY: (day) => `You can tell INFLX from ${day}.`,
  ALREADY_REPORTED: "You've already reported this.",
  REPORTED_HOLD: 'INFLX is looking at this. Nothing can change until they get back to you.',
};

/** The five deliverable types' words, from item 5's list: "reel" / "reels". */
const TYPE = Object.fromEntries(DELIVERABLE_TYPES.map((t) => [t.code, t]));
const noun = (type, n) => { const t = TYPE[type]; return t ? (n === 1 ? t.one : t.many) : type; };
const joinAnd = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const MB = 1024 * 1024;
export const LIMITS12 = { 'image/jpeg': 10 * MB, 'image/png': 10 * MB, 'video/mp4': 200 * MB };

/** "0:28" — a video's duration badge. */
export function duration12(s) {
  const n = Math.max(0, Math.round(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

/** Where a Delayed collaboration stopped, as the brand's C16 sentence says it. */
const STOPPED_BRAND = {
  content_not_submitted: 'nothing sent yet',
  content_in_review: 'in review with you',
  content_changes_requested: 'changes asked for, with her',
  content_not_posted: 'approved, not posted yet',
  content_not_confirmed: 'posted, waiting for you to confirm',
};

export const C12 = {
  titleHers: 'Your content',
  crumb: (brand, set) => `${String(brand || '').toUpperCase()} · ${String(set || '').toUpperCase()}`,
  steps: {
    signed: 'Agreement signed', shoot: 'Shoot', shootPlan: 'Shoot plan', content: 'Content', live: 'Live and paid',
    contentLive: 'Content live', finalPayment: 'Final payment',
    done: (d) => `Done ${d}`, visited: (d) => `Visited ${d}`, posts: (d) => `Posts ${d}`,
    uploadWhat: 'Upload what you agreed', withHer: (name) => `With ${first(name)}`,
  },
  countdownHers: (day, n) => `You post on ${day10(day)} · ${plural(n, 'day', 'days')}`,
  countdownBrand: (day, n) => `She posts on ${day10(day)} · ${plural(n, 'day', 'days')}`,

  /* ── C1 ── */
  shootDone: (d) => `Shoot done on ${day10(d)}. Now the content.`,
  whatYouAgreed: 'What you agreed',
  usageRights: 'Usage rights',
  noUsageRights: 'None',
  uploadFirst: (brand) => `Upload everything here first. ${brand} see it before it goes anywhere, and you post once they approve.`,
  startUploading: 'Start uploading',
  openContentHers: 'Go to your content',
  openContentBrand: 'Open the content',

  /* ── C2 ── */
  aimLine: (mode) => `Pay for Content · ${mode === 'visit' ? 'Store Visit' : 'Remote'}`,
  active: 'Active',
  workingOnIt: (name) => `${first(name)} is working on the content. You review it here before she posts anything.`,

  /* ── the fee card ── */
  fee: {
    title: (fee) => `Her fee · ${rupees5(fee)}`,
    onSigning: 'On signing · 25%',
    contentLive: 'Content live · 25%',
    afterDays: (n) => `After ${n} days · 50%`,
    paid: (d) => `Paid ${day10(d)}`,
    whenTheyConfirm: 'When they confirm',
    // Item 17: INFLX settled a dispute by returning what was locked — these payments will not be made.
    returned: 'Returned to the brand by INFLX',
    thenComplete: 'Then it is complete',
    campaignFeeWaiting: (n) => `INFLX campaign fee ${rupees5(n)} · charged to you at signing, never to her.`,
    campaignFeeDone: (n) => `INFLX campaign fee ${rupees5(n)} · charged at signing.`,
  },

  /* ── C3, C4 ── */
  nothingYet: 'Nothing uploaded yet',
  nothingYetBody: (rows) => `Add the ${joinAnd(rows.map((r) => `${r.count} ${noun(r.type, r.count)}`))} you agreed. Photos up to 10 MB, videos up to 200 MB.`,
  countOf: (n, m) => `${n} of ${m}`,
  captionPlaceholder: 'Write a caption (optional)',
  captionsHint: (brand) => `Captions are what you suggest. ${brand} can ask for changes to any of it.`,
  sendTo: (brand) => `Send to ${brand}`,
  everyRow: 'Every row has to be filled before you can send.',
  moreToAdd: (missing) => `${joinAnd(missing.map((m) => `${m.short} more ${noun(m.type || String(m.key).split('#')[0], m.short)}`))} to add.`,
  uploading: (p) => `${Math.round((p || 0) * 100)}%`,
  add: 'Add',
  remove: 'Remove',
  view: 'View',

  /* ── C5 ── */
  sendTitle: (brand) => `Send this to ${brand}?`,
  sendRow: (files) => {
    const v = files.filter((f) => f.kind === 'video').length;
    const p = files.length - v;
    return [v ? plural(v, 'video', 'videos') : null, p ? plural(p, 'photo', 'photos') : null].filter(Boolean).join(', ');
  },
  sendLock: "You can't change anything while they are reviewing it.",
  dontPostYet: "Don't post any of this yet. They approve it first, then you post and they confirm it is live.",
  notYet: 'Not yet',
  send: 'Send',

  /* ── C6, C9, C14 ── */
  yourMoveSent: (name, d) => `Your move. ${first(name)} sent her content on ${day10(d)}.`,
  yourMoveChanges: (name, d) => `Your move. ${first(name)} sent her changes on ${day10(d)}.`,
  approvingLocks: 'Approving locks this as the version she posts. Asking for changes sends it back with your reason.',
  approve: 'Approve the content',
  askChanges: 'Ask for changes',
  roundPill: (i, n) => `ROUND ${i} OF ${n}`,
  roundPillLast: (i, n) => `ROUND ${i} OF ${n} · LAST`,
  roundsUsedPill: 'ROUNDS USED',
  lastRound: "This is the last round. If this still isn't right, you can approve it or report it to INFLX — there is no third round.",
  roundsUsed: (n) => `${Number(n) === 2 ? "You've used both rounds." : `You've used all ${n} rounds.`} There is no third — approve what she sent, or report it to INFLX.`,
  historyLine: (no, d, reason) => `Round ${no} · ${day10(d)} — "${String(reason || '').length > 60 ? `${String(reason).slice(0, 57)}…` : reason}"`,
  reportToInflx: 'Report to INFLX',
  addNote: 'Add a note',
  noteTitle: 'A note on this file',
  notePlaceholder: 'What should change in this one?',
  noteCount: (n) => (n ? `${plural(n, 'note', 'notes')} pinned to files` : null),

  /* ── C7 ── */
  whatShouldChange: 'What should change?',
  roundsInfo: (n) => `You have ${plural(n, 'round', 'rounds')}. After this one you can approve it or report it to INFLX.`,
  back: 'Back',

  /* ── C8 ── */
  theyAskedChanges: (brand, d) => `${brand} asked for changes on ${day10(d)}.`,
  sendChanges: 'Send the changes',
  replaceHint: 'Replace what they asked about. Everything else stays as it is.',

  /* ── C10 ── */
  approvedPostNow: (d) => `Approved on ${day10(d)}. Post it now — this is the version they approved.`,
  addLinkEach: 'Add a link for each one',
  pasteLink: 'Paste the link',
  addScreenshot: 'Add a screenshot',
  storyProof: 'Stories disappear in a day, so a screenshot is the proof.',
  postedEverything: "I've posted everything",
  toGo: (links, shots) => `${joinAnd([links ? plural(links, 'link', 'links') : null, shots ? plural(shots, 'screenshot', 'screenshots') : null].filter(Boolean))} to go.`,
  save: 'Save',

  /* ── C11 ── */
  yourMovePosted: (name, d) => `Your move. ${first(name)} posted everything on ${day10(d)}.`,
  confirmReleases: (n) => `Confirming releases ${rupees5(n)}`,
  confirmReleasesSub: (fee, last, days) => `The second 25% of her ${rupees5(fee)} fee. The last ${rupees5(last)} follows ${plural(days, 'day', 'days')} later.`,
  confirmLive: 'Confirm the content is live',
  somethingWrong: "Something's wrong — tell INFLX",

  /* ── C12 ── */
  theyConfirmed: (brand, d) => `${brand} confirmed your content is live on ${day10(d)}.`,
  // Item 17: INFLX stood in for a brand that stayed silent (liveConfirmedBy === 'inflx').
  inflxConfirmed: (d) => `INFLX confirmed your content is live on ${day10(d)}.`,
  // No confirmation at all: INFLX settled the payments by hand (a dispute).
  inflxSettled: 'INFLX settled this collaboration and released your payments.',
  settledForCreator: 'INFLX has settled this payment and will settle the rest of this collaboration with you.',
  settledForBrand: 'INFLX has settled this payment and will settle the rest of this collaboration.',
  inflxConfirmedForBrand: (d) => `INFLX confirmed the content is live on ${day10(d)} and released the second payment.`,
  returnedToBrand: (n) => `INFLX returned the locked ${rupees5(n)} to the brand. No more payments are to come for this collaboration.`,
  returnedToYou: (n) => `INFLX returned the locked ${rupees5(n)} to your wallet. No more payments will be made for this collaboration.`,
  inWallet: (n, last, d) => `${rupees5(n)} is in your wallet. The last ${rupees5(last)} arrives on ${day10(d)} — nothing for you to do.`,

  /* ── C13 ── */
  completedOn: (d) => `Collaboration completed on ${day10(d)}.`,
  theRecord: 'The record',
  rec: {
    shoot: 'Shoot', approved: 'Content approved', posted: 'Posted', confirmed: 'You confirmed live', paid: 'Paid in full',
    approvedValue: (d, n) => `${day10(d)} · ${n === 0 ? 'no changes' : plural(n, 'round of changes', 'rounds of changes')}`,
    postedValue: (d, n) => `${day10(d)} · ${plural(n, 'link', 'links')}`,
  },
  usageAfter: (words) => `Her posts stay up under the usage rights you agreed: ${words}.`,

  /* ── C15 ── */
  waitingTitle: 'Waiting for them to confirm',
  waitingBody: (d, brand, from) => `You posted on ${day10(d)}. ${brand} haven't confirmed yet. From ${day10(from)} you can ask INFLX to look at it.`,
  askInflx: 'Ask INFLX to look at it',
  toldInflxTitle: 'They told INFLX',
  toldInflxBody: (brand, t1) => `${brand} reported a problem with what you posted. INFLX will contact you both. Your ${rupees5(t1)} from signing stays yours.`,
  youToldInflx: (d) => `You asked INFLX to look at this on ${day10(d)}.`,
  delayedTitle: 'Delayed',
  delayedHers: (d) => `The ${day10(d)} posting date passed before your content went live. Nothing changes: carry on from wherever you are, and the money is untouched.`,
  shootNotDoneTitle: 'Shoot not done yet',
  afterTheShoot: 'After the shoot',
  opensOnceVisit: 'This opens once your visit is confirmed.',
  opensOnceRemote: 'This opens once you mark the shoot done.',
  brandOpensVisit: 'This opens once the visit is confirmed.',
  brandOpensRemote: 'This opens once she marks the shoot done.',
  withHerForChanges: (name) => `${first(name)} is making the changes you asked for.`,
  approvedPosting: (name) => `You approved it. ${first(name)} is posting it now.`,
  youConfirmed: (d) => `You confirmed the content is live on ${day10(d)}.`,
  lastFollows: (n, d) => `The last ${rupees5(n)} is paid to her on ${day10(d)}.`,

  /* ── C16 ── */
  delayedBrand: (d, stage) => `The ${day10(d)} posting date passed before the content went live. Where it stopped: ${STOPPED_BRAND[stage] || 'the content step'}.`,
  reportedTitle: 'Reported to INFLX',
  reportedBrand: (d, locked) => `You reported this on ${day10(d)}. INFLX has it. ${rupees5(locked)} of her fee stays in escrow until it is settled.`,
  nothingReceivedTitle: "She hasn't sent anything",
  nothingReceived: (name) => `${first(name)} hasn't sent her content yet. She is being reminded every two days.`,
  sheToldInflx: (name, d) => `${first(name)} asked INFLX to look at this on ${day10(d)}. You can still confirm it.`,
  couldntLoad: 'the content',

  /* ── the report sheets ── */
  reportTitle: 'Report this to INFLX?',
  reportRoundsUsed: 'You have used every round of changes. INFLX will look at the content and contact you both. Nothing moves until they do.',
  reportPostedWrong: "If what she posted isn't what you approved, or something is missing, INFLX looks at it with you both. Nothing moves until they do.",
  reportSilent: (brand) => `${brand} haven't confirmed your content is live. INFLX will look at it with you both. Nothing you were paid is affected.`,
  notePlaceholderReport: 'Anything INFLX should know (optional)',
  report: 'Report to INFLX',
  askLook: 'Ask INFLX to look',

  /* ── toasts ── */
  sent: 'Sent. They review it before you post anything.',
  approved: 'Approved. She posts it next.',
  changesSent: 'Sent back with your reason.',
  postedDone: "Done. They confirm it's live next.",
  confirmedDone: 'Confirmed. The second payment is released.',
  reportedDone: 'INFLX has it.',
};
