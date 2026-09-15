/**
 * Item 8 — every string the pitch screens show, word for word from the locked
 * mockups T1–T14. MSG8 mirrors backend/src/services/pitchCopy.js, so a refusal
 * she reads on the phone is the same sentence the server would have sent.
 * Contract: features/item8-pitch · rules v1.21 §8
 *
 * Nothing here is computed from a rule. Every sentence the SERVER can produce —
 * the endings, the cooldown line, the deadline — arrives on the payload and is
 * rendered as given; these are the ones only the form can know, before anything
 * has been sent.
 */
import { longDate4, shortDate4, aimLabel4, modeLabel4 } from '../campaigns/copy4';
import { rupees5, fmtPct5, first, deliverablesShort } from '../invitations/copy5';

export const MSG8 = {
  AIM_NOT_TAKEN: (brand) => `${brand} aren't taking that kind of pitch.`,
  NOT_ACCEPTING: (brand) => `${brand} aren't taking pitches right now.`,
  NOT_MATCHING: (brand) => `You don't meet what ${brand} are looking for.`,
  IN_COOLDOWN: (brand, date) => `You can pitch ${brand} again after ${shortDate4(date)}.`,
  SAME_AIM_OPEN: (aim, brand) => `You already have an open ${aim} pitch with ${brand}.`,
  TOO_MANY_OPEN: (n, brand) => `You have ${n} open pitches with ${brand}, which is the most allowed.`,
  DATE_TOO_SOON: 'Choose a date at least seven days from today.',
  MESSAGE_REQUIRED: "Tell them why you'd be a good fit.",
  MESSAGE_LONG: 'Keep it under 500 characters.',
  MODE_REQUIRED: 'Choose how you would work.',
  MODE_NOT_TAKEN: (brand) => `${brand} aren't taking that way of working.`,
  CLOSED: (date) => `This pitch closed on ${shortDate4(date)}.`,
  ANSWERED_TWICE: "You've already answered this pitch.",
  REJECT_REASON_LONG: 'Keep it under 200 characters.',
  BEING_MEASURED: 'Your numbers are still being measured.',
};

/** T1 — the brand list, now with a purpose. */
export const C8 = {
  find: {
    title: 'Pitch a brand',
    search: 'Search brands by name',
    accepting: 'Accepting',
    notAccepting: 'Not accepting',
    noMatch: "You don't match",
    measuring: 'Being measured',
    cooldown: 'On cooldown',
    emptyTitle: 'No brands to show',
    emptyBody: 'Try a different filter, or search by name.',
  },

  // T2, T3 — the form. Two steps of terms, then the message.
  form: {
    title: (brand) => `Pitch ${brand}`,
    aim: 'What kind of deal',
    aimHintOnly: (brand, missing) => `${brand} don't take ${missing} pitches.`,
    commission: 'Commission you want',
    fee: 'Fee you want',
    hybridFee: 'Fixed fee you want',
    minCommission: (pct) => `Your minimum for this brand is ${fmtPct5(pct)}.`,
    minFee: (n) => `Your minimum fee is ${rupees5(n)}. Paid 25% on signing, 25% when the content is live, 50% after it stays live.`,
    sell: "What you'd like to sell",
    wholeStore: 'Whole store',
    someCategories: 'Some categories',
    deliverables: "What you'd deliver",
    addAnother: 'Add another',
    date: 'When you could post',
    dateHint: "They'll build a set around this. It can move when you talk.",
    mode: "How you'd work",
    next1: 'Next: when and how',
    next2: 'Next: your message',
    // T4
    review: 'Review and send',
    reviewHead: (brand) => `Your pitch to ${brand}`,
    why: 'Why you',
    counter: (n) => `${n} / 500`,
    send: 'Send pitch',
    sending: 'Sending…',
    theyHaveDays: (brand, days) =>
      `${brand} have ${days} days to reply. If they agree, they'll invite you to a set with these terms and you'll sign an agreement then. Nothing is committed until you both sign.`,
    limitLine: (nth, max) => `Your ${ordinal(nth)} open pitch to this brand · ${max} allowed`,
    // The review card's labels, in her voice.
    lblAim: 'Aim', lblFee: 'Fee', lblCommission: 'Commission',
    lblPost: "You'd post", lblDate: 'You could post on', lblMode: "How you'd work",
    lblSell: "You'd sell",
  },

  // T13, T14 — her list.
  mine: {
    tab: 'Pitches',
    waiting: 'WAITING FOR A REPLY',
    agreed: 'AGREED',
    rejected: 'REJECTED',
    ended: 'ENDED',
    chipSent: 'Sent', chipTalking: 'Talking', chipAgreed: 'Agreed',
    chipRejected: 'Rejected', chipWithdrawn: 'Withdrawn', chipClosed: 'Closed',
    emptyTitle: 'No pitches yet',
    emptyBody: "Find a brand you'd like to work with and tell them what you'd do.",
    withdraw: 'Withdraw this pitch',
    withdrawConfirm: 'Withdraw this pitch?',
    withdrawBody: 'They will be told you took it back. There is no cooldown — you can pitch them again whenever you like.',
    withdrawKeep: 'Keep it',
    withdrawGo: 'Withdraw',
    openThread: 'Open the conversation',
  },

  // T5, T6 — the brand's side.
  brand: {
    tab: 'Pitches',
    groupNew: 'New', groupTalking: 'Talking',
    yourMove: 'Your move', waiting: 'Waiting',
    instagram: 'Instagram', youtube: 'YouTube', engagement: 'Engagement',
    notMeasured: '—',
    proposing: "What she's proposing",
    lblAim: 'Aim', lblFee: 'Fee', lblCommission: 'Commission',
    lblPost: "She'd post", lblDate: 'She could post on', lblMode: "How she'd work",
    lblSell: "She'd sell",
    acceptTerms: 'Accept her terms',
    counter: 'Counter',
    reject: 'Reject',
    fullProfile: 'Open her full profile',
    emptyTitle: 'No pitches yet',
    emptyBody: "Creators who want to work with you will appear here. Turn pitches on in Pitch settings if you'd like more of them.",
    // T7 — the most important sentence in item 8.
    acceptTitle: (name) => `Accept ${first(name)}'s terms?`,
    acceptWhat: 'What happens',
    acceptMoney: (line) => `Her ${line}`,
    acceptAgreed: 'Agreed',
    acceptGoesToLabel: 'She goes to',
    acceptGoesTo: (date) => `Your pool · ${shortDate4(date)}`,
    acceptCollabLabel: 'A collaboration',
    acceptNotYet: 'Not yet',
    acceptCancel: 'Not now',
    acceptGo: 'Accept',
    // T8 — the cooldown, said before the tap.
    rejectTitle: 'Reject this pitch?',
    rejectWhy: 'Tell her why (optional)',
    rejectSeen: 'She sees this.',
    rejectKeep: 'Keep',
    rejectGo: 'Reject',
    rejectBlockHint: "If you'd rather never hear from her, block her in Pitch settings instead.",
  },

  // T11 — the pool's provenance tag.
  pool: { tag: 'PITCH', cameToYou: (name, date) => `${first(name)} came to you on ${shortDate4(date)}` },

  // T9, T10 — the thread's breadcrumb. The thread itself is item 6's screen.
  thread: { crumbBrand: (aim) => `PITCH · ${String(aim).toUpperCase()}`, crumbCreator: (aim) => `YOUR PITCH · ${String(aim).toUpperCase()}` },
};

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** "14%" · "₹12,000 · 1 reel, 2 stories" · "₹5,000 + 10%" — the same three shapes the server writes. */
export function termsLine8(goal, terms) {
  if (!terms) return '';
  if (goal === 'engagement') {
    return [terms.fee != null ? rupees5(terms.fee) : null, deliverablesShort(terms.deliverables)].filter(Boolean).join(' · ');
  }
  if (goal === 'hybrid') {
    return [terms.fee != null ? rupees5(terms.fee) : null, fmtPct5(terms.commissionPct)].filter(Boolean).join(' + ');
  }
  return fmtPct5(terms.commissionPct) || '';
}

export { longDate4 as longDate8, shortDate4 as shortDate8, aimLabel4 as aimLabel8, modeLabel4 as modeLabel8, first, rupees5 as rupees8, fmtPct5 as fmtPct8, deliverablesShort, ordinal };
