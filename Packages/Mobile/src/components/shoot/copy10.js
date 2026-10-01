/**
 * Item 10 — every string the store-visit screens show, word for word from the locked mockups
 * (V1–V15) and the gap-check prompt §6–§7. MSG10 mirrors backend/src/services/productionCopy.js.
 * Contract: features/item10-store-visit
 */
import { first, rupees5 } from '../invitations/copy5';

export const MSG10 = {
  NOT_SIGNED: "This collaboration isn't signed by both of you yet.",
  NOT_FUNDED: "The money for this collaboration isn't locked yet.",
  CONTACT_NAME: 'Enter who she should ask for.',
  CONTACT_PHONE: 'Enter a contact number.',
  TIME_REQUIRED: 'Choose a date and time.',
  TIME_IN_PAST: 'Choose a time in the future.',
  NOTES_LONG: 'Keep it under 500 characters.',
  NOTHING_CHANGED: 'Choose a different time before you send this.',
  NO_DECLINE: "There is no declining a time. If it can't work, suggest a different one.",
  NO_ROUNDS_LEFT: 'There are no counters left. You can accept this time or ask to move it.',
};

/* ── dates and times, always in India, without Intl (Hermes) ─────────────────── */
const IST = 330 * 60000;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The parts of an instant as they read on an Indian clock. */
export function istParts(iso) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const d = new Date(t + IST);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: d.getUTCHours(), min: d.getUTCMinutes() };
}
/** A 'YYYY-MM-DD' calendar day, read without a timezone. */
export function dayParts(day) {
  if (!day) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(day));
  if (!m) return istParts(day);
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay(), h: 0, min: 0 };
}
/** An Indian clock reading → the instant, as ISO. */
export function istToIso(y, m, d, h, min) {
  return new Date(Date.UTC(y, m, d, h, min) - IST).toISOString();
}
export function clock10(p) {
  if (!p) return '';
  const h12 = p.h % 12 || 12;
  return `${h12}:${String(p.min).padStart(2, '0')} ${p.h >= 12 ? 'pm' : 'am'}`;
}
/** "Sun 19 Oct, 4:00 pm" — the time card. */
export function whenLine10(iso) { const p = istParts(iso); return p ? `${DAYS[p.wd]} ${p.d} ${MONTHS[p.m]}, ${clock10(p)}` : ''; }
/** "19 Oct, 4:00 pm" — in sentences. */
export function whenShort10(iso) { const p = istParts(iso); return p ? `${p.d} ${MONTHS[p.m]}, ${clock10(p)}` : ''; }
/** "19 Oct" — from an instant or a calendar day. */
export function day10(v) { const p = /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? dayParts(v) : istParts(v); return p ? `${p.d} ${MONTHS[p.m]}` : ''; }
/** "24 October 2026" — the locked card. */
export function longDay10(v) { const p = /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? dayParts(v) : istParts(v); return p ? `${p.d} ${FULL_MONTHS[p.m]} ${p.y}` : ''; }
/** "19 Oct, 7:12 pm" — the record card's timestamps. */
export const stamp10 = whenShort10;
/** 'YYYY-MM-DD' of an instant in India. */
export function istDay10(iso) { const p = istParts(iso); return p ? `${p.y}-${String(p.m + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : null; }
export function todayIst10() { return istDay10(new Date().toISOString()); }

export const MODE_LABEL10 = { visit: 'Store Visit', shipment: 'Remote', remote: 'Remote' };
export const AIM_LABEL10 = { conversion: 'Pay for Sale', engagement: 'Pay for Content', hybrid: 'Hybrid' };

export const C10 = {
  /* ── V1 · the gate and the step line ── */
  gate: {
    signed: (date) => `Signed by both on ${day10(date)}`,
    locked: (n) => `${rupees5(n)} locked`,
    released: (n, name) => `${rupees5(n)} released to ${first(name)}`,
    notSigned: 'Waiting for both signatures',
    notFunded: 'Money not locked yet',
  },
  steps: {
    signed: 'Agreement signed', shoot: 'Shoot plan', content: 'Content', live: 'Live and paid',
    sendHerATime: 'Send her a time', afterTheShoot: 'After the shoot', posts: (day) => `Posts ${day10(day)}`,
  },
  countdown: (day, n) => `She posts on ${day10(day)} · ${n} ${n === 1 ? 'day' : 'days'}`,
  countdownHers: (day, n) => `You post on ${day10(day)} · ${n} ${n === 1 ? 'day' : 'days'}`,
  planTheVisit: 'Plan the visit',
  remoteNext: 'The Remote shoot — shipping the products — arrives with item 11.',
  /**
   * V1's button, told the truth (walk fix, 20 Sep). It used to say "Plan the visit" at every
   * stage, so a brand whose creator had already visited saw nothing asking him to confirm.
   * The agreement screen is the only door to the shoot until Needs You (§24) builds the list.
   */
  openLabel: (stage, passed) =>
    stage === 'complete' ? 'The store visit'
      : stage === 'attended' ? 'Confirm the shoot is done'
      : stage === 'agreed' ? (passed ? 'The visit time passed — send a new time' : 'The store visit')
      : stage === 'sent' ? 'Waiting on her answer — open the visit'
      : 'Plan the visit',
  activeChip: 'Active',

  /* ── V2 · the plan ── */
  plan: {
    title: 'Plan the visit',
    fromTheSet: 'From the set',
    mode: 'Mode', branch: 'Branch', shePostsOn: 'She posts on',
    whoToAskFor: 'Who she should ask for', theirNumber: 'Their number',
    seesOnceSent: 'She sees this once you send the plan.',
    date: 'Date', time: 'Time',
    datesHint: (day) => `Dates after ${day10(day)} aren't offered — she can't shoot after the day she posts.`,
    howLong: 'Roughly how long', howLongPh: 'About 2 hours',
    bring: 'Anything she should bring or know', bringPh: 'Parking, which floor, who to ask at the desk…',
    sendTo: (name) => `Send to ${first(name)}`,
    /* V3 */
    confirmTitle: (name) => `Send this plan to ${first(name)}?`,
    whatSheGets: 'What she gets',
    fullAddress: 'The full address', theNumber: (who) => `${first(who)}'s number`, theTime: 'The time',
    confirmBody: 'She can accept the time or ask for a different one. She can\'t change anything else — the branch and the posting date came from the set.',
    notYet: 'Not yet', send: 'Send',
    sent: 'Plan sent.',
  },

  /* ── V4 · her card ── */
  card: { plannedFor: (iso) => `Store visit planned for ${whenShort10(iso)}` },

  /* ── V5 / V8 / V9 · her visit ── */
  hers: {
    title: 'Your store visit',
    about: (t) => (t ? `About ${String(t).replace(/^about\s+/i, '')}` : ''),
    today: 'Today',
    openInMaps: 'Open in Maps',
    beforeYouGo: 'Before you go',
    postingLine: (day) => `You post on ${day10(day)}, so this has to happen before then. Ask for another time if ${day10(day)} doesn't work.`,
    thisTimeWorks: 'This time works',
    askAnother: 'Ask for another time',
    acceptNew: (iso) => `Accept ${whenShort10(iso)}`,
    timeAgreedOn: (date) => `Time agreed on ${day10(date)}.`,
    theyMoved: (brand, iso, note) => `${brand} asked to move the visit to ${whenShort10(iso)}.${note ? ` Their reason: "${note}"` : ''}`,
    theyCountered: (brand, iso, note) => `${brand} asked for ${whenShort10(iso)} instead.${note ? ` "${note}"` : ''}`,
    waitingForThem: (brand) => `Waiting for ${brand} to answer on the time.`,
    beenToStore: "I've been to the store",
    beenHint: (brand) => `Tap this after your visit. ${brand} confirm it, and then you shoot and upload.`,
    askToMove: 'Ask to move this',
    markedWaiting: (date, brand) => `You marked this done on ${day10(date)}. Waiting for ${brand} to confirm.`,
    visited: 'Visited',
    passed: 'Passed',
    // Founder, 1 Oct 2026: a store visit never confirms itself. Only the brand's confirmation opens her next step.
    waitsForConfirm: (brand) => `Your next step opens when ${brand} confirm the visit. We keep reminding them until they do.`,
    timePassedHers: (brand) => `The visit time came and went. ${brand} will send a new time.`,
    /* V15 */
    confirmed: (brand, date) => `${brand} confirmed the shoot on ${day10(date)}. Your content step is open.`,
    delayed: (day, brand, paid) => `The ${day10(day)} posting date passed before the visit happened. ${brand} will send a new time.${paid > 0 ? ` The ${rupees5(paid)} you were paid at signing stays yours.` : ''}`,
    notYetTitle: 'No visit planned yet',
    notYetBody: (brand) => `${brand} will send a time and the store address.`,
    stepsHers: { signed: 'Agreement signed', visit: 'Store visit', content: 'Content', live: 'Live and paid', onceTheyConfirm: 'Once they confirm', posts: (day) => `Posts ${day10(day)}` },
  },

  /* ── V6 · countering the time ── */
  counter: {
    title: 'Ask for another time',
    titleBrand: 'Suggest another time',
    theyAsked: (iso) => `They asked for ${whenShort10(iso)}`,
    agreedWas: (iso) => `Agreed ${whenShort10(iso)}`,
    why: 'Say why (optional)',
    onlyTime: (day) => `Only the time can change. The branch and the ${day10(day)} posting date came from the set.`,
    send: 'Send',
    sent: 'Sent. Their move now.',
  },

  /* ── V7 · the thread ── */
  thread: {
    crumb: 'SHOOT PLAN',
    yourMoveAsked: (name) => `Your move. ${first(name)} asked for a different time.`,
    yourMoveMoved: (name) => `Your move. ${first(name)} asked to move the visit.`,
    waiting: (name) => `Waiting for ${first(name)} to answer on the time.`,
    youSentThePlan: 'You sent the plan',
    theySentThePlan: (brand) => `${brand} sent the plan`,
    asked: (name) => `${first(name)} asked`,
    youAsked: 'You asked',
    rows: { time: 'Time', branch: 'Branch', askFor: 'Ask for' },
    accept: (iso) => `Accept ${whenShort10(iso)}`,
    suggestAnother: 'Suggest another time',
    noDecline: "There is no declining a time. If it can't work, suggest a different one.",
    agreed: 'Time agreed.',
  },

  /* ── V10 / V11 / V13 / V14 · the brand's shoot ── */
  brand: {
    crumb: 'SHOOT PLAN',
    yourMoveVisited: (name, date) => `Your move. ${first(name)} says she visited on ${day10(date)}.`,
    confirmOpens: 'Confirming opens her next step. It stays closed until you confirm.',
    confirmDone: 'Confirm the shoot is done',
    sheDidntCome: "She didn't come — send a new time",
    confirmed: 'Shoot confirmed.',
    /* V11 */
    done: (date, name) => `Shoot done on ${day10(date)}. ${first(name)} is working on the content.`,
    theVisit: 'The visit',
    rows: { branch: 'Branch', when: 'When', sheMarked: 'She marked it', youConfirmed: 'You confirmed' },
    withHer: (name) => `With ${first(name)}`,
    visited: (date) => `Visited ${day10(date)}`,
    /* waiting states */
    waitingOnHer: (name) => `Waiting for ${first(name)} to answer on the time.`,
    timeAgreed: (date, iso) => `Time agreed on ${day10(date)}: ${whenShort10(iso)}.`,
    // The mockups draw no brand screen for the agreed stage, so nothing said what happens next
    // and the confirm step looked missing. It is not a task list — it is the sentence that
    // tells the brand the ball is with her (walk fix, 20 Sep).
    whatHappensNext: (name) => `${first(name)} marks the visit once she has been, and then you confirm it. Nothing moves until she does.`,
    openConversation: 'Open the conversation',
    /* V13 */
    passedTitle: (iso) => `The ${day10(iso)} visit came and went with nothing marked.`,
    passedBody: (name, n) => `Nobody is blamed for this. Sort it out with ${first(name)} however you like, then send a new time — there ${n === 1 ? 'is 1 day' : `are ${n} days`} before she posts.`,
    sendNewTime: 'Send a new time',
    // V13 (founder, 20 Sep): once the time has passed the brand may ring her to sort it out.
    call: (name) => `Call ${first(name)}`,
    /* V12 */
    moveTitle: 'Move the visit?',
    moveTitleHers: 'Ask to move the visit?',
    newDate: 'New date', time: 'Time',
    moveHint: (name, day) => `${first(name)} has to agree the new time. It still has to be before ${day10(day)}.`,
    moveHintHers: (brand, day) => `${brand} have to agree the new time. It still has to be before ${day10(day)}.`,
    sendNew: 'Send new time',
    moved: 'Sent. They have to agree the new time.',
    /* V14 */
    delayedChip: 'Delayed',
    delayedTitle: (day) => `The ${day10(day)} posting date passed before the shoot happened. This is now a delayed collaboration.`,
    whereItStopped: 'Where it stopped',
    stage: 'Stage', agreedTime: 'Agreed time', delayedSince: 'Delayed since',
    delayedMoney: (locked, paid, name) => `Nothing has changed about the money: ${rupees5(locked)} is still locked and ${first(name)} keeps the ${rupees5(paid)} she was paid at signing. You can still plan a visit and carry on.`,
    delayedMoneySale: 'Nothing has changed about the money. You can still plan a visit and carry on.',
    legacy: "This is an older collaboration with no posting date. It can't take a shoot plan.",
  },
};
