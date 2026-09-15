/**
 * Item 6 — every string the negotiation, move-request and pool screens show, word for word from
 * the locked mockups (N1–N21) and the prompt (§6, §7). MSG6 mirrors
 * backend/src/services/negotiationCopy.js.
 * Contract: features/item6-negotiation
 */
import { longDate4, shortDate4, stampDate4, aimLabel4, modeLabel4 } from '../campaigns/copy4';
import { rupees5, fmtPct5, first, deliverablesShort } from '../invitations/copy5';

export const MSG6 = {
  NOTHING_CHANGED: 'Change something before you send this.',
  NO_ROUNDS_LEFT: 'There are no counters left. You can accept or decline.',
  CLOSED: (d) => `This invitation closed on ${longDate4(d)}.`,
  SWITCH_OFF: (brand) => `${brand} aren't taking counters on this campaign.`,
  NOT_YOUR_MOVE: (name) => `You've already sent your counter. ${name} has to reply first.`,
  AGREED: 'The terms are agreed. Nothing can be countered now.',
  MOVE_NOTHING: "Choose what doesn't suit.",
  MOVE_SAME_DATE: "That's the date they already asked for.",
  MOVE_TWICE: "You've already asked them to move this.",
  BRAND_REASON_LONG: 'Keep it under 200 characters.',
  NOTE_LONG: 'Keep it under 300 characters.',
  ANSWERED_TWICE: "You've already answered this.",
  POOL_MIXED_AIMS: 'Pick creators who agreed the same Aim.',
  POOL_GONE: (name) => `${name} is no longer in your pool.`,
  RANGE: (min, max) => `Enter a number between ${min} and ${max}.`,
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const ordinal = (n) => (n === 1 ? 'first' : n === 2 ? 'second' : n === 3 ? 'third' : `${n}th`);

/** The value of one negotiable term, as a change line reads it. */
export function termValue(goal, key, terms) {
  if (!terms) return '—';
  switch (key) {
    case 'commissionPct': return fmtPct5(terms.commissionPct) || '—';
    case 'fee': return terms.fee != null && terms.fee !== '' ? rupees5(terms.fee) : '—';
    case 'deliverables': return deliverablesShort(terms.deliverables) || '—';
    case 'usageRights': return terms.usageRights && terms.usageRights.on
      ? `${terms.usageRights.durationDays == null ? 'Forever' : `${terms.usageRights.durationDays} days`}`
      : 'Off';
    default: return '—';
  }
}
export const TERM_LABEL = { commissionPct: 'Commission', fee: 'Fee', deliverables: 'What you deliver', usageRights: 'Usage rights', postingDate: 'Posts on', shootMode: 'Mode' };
/** Which terms a change line may show, per Aim (rules v1.18 §7B). */
export const NEGOTIABLE = { conversion: ['commissionPct'], engagement: ['fee', 'deliverables', 'usageRights'], hybrid: ['fee', 'commissionPct'] };

/** "13%" · "₹12,000 · 1 reel, 1 story" · "₹5,000 + 10%" */
export function snapshotLine6(goal, s) {
  if (!s) return '';
  if (goal === 'engagement') return [s.fee != null && s.fee !== '' ? rupees5(s.fee) : null, deliverablesShort(s.deliverables)].filter(Boolean).join(' · ');
  if (goal === 'hybrid') return [s.fee != null && s.fee !== '' ? rupees5(s.fee) : null, fmtPct5(s.commissionPct)].filter(Boolean).join(' + ');
  return fmtPct5(s.commissionPct);
}

export const C6 = {
  choice: {
    title: 'What would you like to change?',
    money: 'The money and the work', moneySub: 'Fee, what you post, how the brand may reuse it',
    date: 'The posting date or the mode', dateSub: 'Ask to be moved to a set that suits you',
    left: (limit, used) => `You can counter ${limit === 1 ? 'once' : limit === 2 ? 'twice' : `${limit} times`} in this collaboration. This would be your ${ordinal(used + 1)}.`,
    continue: 'Continue',
  },
  counter: {
    title: 'Your counter', brandTitle: 'Counter back',
    round: (n, of) => `ROUND ${n} OF ${of}`, roundLast: (n, of) => `ROUND ${n} OF ${of} · YOUR LAST`,
    locked: "Can't be changed",
    rows: { aim: 'Aim', posts: 'Posts on', mode: 'Mode', sell: 'You can sell' },
    commission: 'Commission', fee: 'Fee', fixedFee: 'Fixed fee',
    delivers: "What you'll deliver", addAnother: 'Add another',
    reuse: 'Brand can reuse the content',
    theirOffer: 'Their offer', theyAsked: 'They asked for', sheAsked: (f) => `${f} asked for`,
    theyAskedUsage: (words) => `They asked for ${words}.`,
    yourMin: (label, v) => `Your minimum for ${label} is ${v}.`,
    yourMinPlain: (v) => `Your minimum is ${v}.`,
    belowHer: (f, v) => `Below ${f}'s minimum of ${v}. She can still accept.`,
    why: 'Say why (optional)', whyBrand: 'Say why (optional)',
    hint: (brand, left) => `${brand} can accept this, ${left > 0 ? (left === 1 ? 'counter once more' : `counter ${left} more times`) : 'or decline'}${left > 0 ? ', or decline' : ''}. Nothing is final until you both sign.`,
    lastHintBrand: (f) => `After this, ${f} can only accept or decline.`,
    send: 'Send counter', sendLast: 'Send last counter',
    sent: 'Counter sent.',
  },
  move: {
    title: 'Ask for a change', thisSet: 'This set',
    what: "What doesn't suit?",
    dateOpt: 'The posting date', dateOptSub: "You'd post on a different day",
    modeOpt: 'The mode of work', modeOptSub: "You'd rather they ship the products",
    dateLabel: 'The date that suits you',
    why: 'Say why (optional)',
    explain: (brand, date) => `A set has one date for everyone, so this isn't a counter. If ${brand} agree, they'll invite you to a new set for ${shortDate4(date)} with the money you've already agreed. If they don't, this invitation carries on and you can still accept or decline it.`,
    explainMode: (brand) => `A set has one mode of work for everyone, so this isn't a counter. If ${brand} agree, they'll invite you to a new set with the money you've already agreed. If they don't, this invitation carries on and you can still accept or decline it.`,
    send: 'Send request', sent: 'Request sent.',
  },
  thread: {
    title: (brand) => brand,
    sub: (campaign, set) => `${campaign} · ${set}`.toUpperCase(),
    waiting: (brand, cutoff) => `Waiting for ${brand}. Reply by ${shortDate4(cutoff)}.`,
    waitingBrand: (f) => `Waiting for ${f}. She has to reply.`,
    yourMove: (f) => `Your move. ${f} is waiting.`,
    yourMoveMe: 'Your move.',
    moveAsked: (f) => `Your move. ${f} asked for a different date.`,
    moveAskedMode: (f) => `Your move. ${f} asked for a different mode.`,
    lastRound: 'This is their last counter. You can accept it or decline — there are no more rounds.',
    youCountered: 'You countered', theyCountered: 'They countered',
    namedCountered: (f) => `${f} countered`,
    theirInvitation: 'Their invitation', youInvited: (f) => `You invited ${f}`,
    asked: (f) => `${f} asked`, youAsked: 'You asked',
    accepted: 'Accepted', declined: 'Declined',
    canDo: (left) => (left > 0 ? `They can accept, ${left === 1 ? 'counter once more' : `counter ${left} more times`}, or decline.` : 'They can only accept or decline now.'),
    acceptLine: (line) => `Accept ${line}`,
    counterBack: 'Counter back', decline: 'Decline', accept: 'Accept',
    brandAcceptHint: (line) => `Accepting writes ${line} onto her invitation. The agreement is the next step.`,
    accepted6: 'Terms agreed.', declined6: 'Declined.',
    loadWhat: 'this conversation',
  },
  declineCounter: {
    title: (f) => `Decline ${f}'s counter?`,
    body: (f) => `This ends the invitation. ${f} will see that you said no, and you can invite her again with new terms while there is still time.`,
    why: 'Tell her why (optional)', whyHint: 'She sees this.',
    keep: 'Keep', decline: 'Decline', done: 'Counter declined.',
  },
  moveAnswer: {
    line: (setDate, f, terms, wantDate) => `Your set keeps ${shortDate4(setDate)} whatever you choose. Agreeing moves ${f} out of it, with her ${terms} kept, and you build a set for ${shortDate4(wantDate)} when you're ready.`,
    lineMode: (setDate, f, terms) => `Your set keeps ${shortDate4(setDate)} whatever you choose. Agreeing moves ${f} out of it, with her ${terms} kept, and you build a set that suits her when you're ready.`,
    agree: 'Agree · move her to the pool', keep: (d) => `Keep ${shortDate4(d)}`, decline: 'Decline',
    confirmTitle: (f) => `Move ${f} to your pool?`,
    what: 'What happens',
    rowTerms: (terms) => `Her ${terms}`, rowTermsValue: 'Kept',
    rowInvitation: 'This invitation', rowInvitationValue: 'Closes',
    rowPool: 'She goes to', rowPoolValue: (d) => `Your pool${d ? ` · wants ${shortDate4(d)}` : ''}`,
    confirmBody: (f, d) => `When you create a set for ${shortDate4(d)}, she'll be waiting there with these terms filled in. She gets a fresh invitation to accept.`,
    confirmBodyMode: (f) => `When you create a set that suits her, she'll be waiting there with these terms filled in. She gets a fresh invitation to accept.`,
    notNow: 'Not now', move: 'Move her',
    moved: (f) => `${f} moved to your pool.`, kept: 'The date stays. She can still accept.', declinedDone: 'Declined.',
  },
  creatorMove: {
    agreedTitle: 'AGREED, WAITING FOR A SET', agreedChip: 'Agreed',
    agreedBody: (d) => `They agreed to ${shortDate4(d)}. They'll send a new invitation once the dates are set.`,
    agreedBodyMode: 'They agreed. They\'ll send a new invitation once the set is ready.',
    keptTitle: 'THEY SAID NO TO THE DATE', keptChip: 'Your move',
    keptBody: (brand, d, cutoff) => `${brand} are keeping ${shortDate4(d)}. You can still accept or decline by ${shortDate4(cutoff)}.`,
    closedTitle: 'NOTHING CAME OF IT', closedChip: 'Closed',
    closedBody: (days) => `${days} days passed without a new set, so this closed.`,
    removedBody: (brand) => `${brand} removed you from their pool.`,
    leave: 'Leave the pool', left: 'You left the pool.',
  },
  pool: {
    entry: (n) => `Agreed, needs a set · ${n}`,
    entrySub: 'Creators who agreed terms but need other dates',
    title: 'Agreed, needs a set',
    intro: 'Creators who agreed your terms but asked for a different date or mode. Pick the ones that go together and build a set for them.',
    groupDate: (d) => `Want ${shortDate4(d)}`, groupMode: (m) => `Want ${m === 'visit' ? 'Store Visit' : 'Remote'}`, groupOther: 'Want a different set',
    noLonger: ' · no longer possible',
    row: (aim, terms, days) => `${aim} · ${terms} · ${plural(days, 'day', 'days')} left`,
    // Item 8 (T11) — where a pool entry came from, when it was her own pitch.
    fromPitch: 'PITCH',
    closingSoon: (n) => `Closing in ${plural(n, 'day', 'days')}`,
    aimHint: 'One set has one Aim, so only creators on the same Aim can go into it together.',
    create: (n) => `Create a set for ${plural(n, 'creator', 'creators')}`,
    emptyTitle: 'Nobody is waiting', emptyBody: 'Creators who agree your terms but need a different date or mode wait here until you build them a set.',
    loadWhat: 'your pool',
    remove: 'Remove from the pool', removed: 'Removed from your pool.',
    menuProfile: 'Open profile',
    mixedAims: 'Pick creators who agreed the same Aim.',
  },
  newSet: {
    banner: (n) => `Building for ${plural(n, 'creator', 'creators')} from your pool`,
    names: (names, d) => `${names}${d ? ` · they all asked for ${shortDate4(d)}` : ''}`,
    aimNote: (n, aim) => `From the pool: ${n === 1 ? 'she' : `all ${n}`} agreed ${aim} terms.`,
    dateHint: (cutoff) => `Filled in from the pool. Invitations close ${shortDate4(cutoff)}, three days before posting.`,
    dateGone: (d) => `${shortDate4(d)} is no longer possible — a posting date must be at least seven days away. Pick a new one.`,
  },
  terms: {
    filled: (f, d) => `Filled in from what you agreed with ${f} on ${stampDate4(d)}.`,
    fieldHint: (f) => `Agreed with ${f}. Change it and she sees it as a new offer.`,
  },
  invitation: {
    fromPool: (d, terms, agreedAt) => `The ${shortDate4(d)} date and the ${terms} you agreed on ${stampDate4(agreedAt)}.`,
    fromPoolTermsOnly: (terms, agreedAt) => `The ${terms} you agreed on ${stampDate4(agreedAt)}.`,
    counterOff: (brand) => `${brand} aren't taking counters on this campaign.`,
    counter: 'Counter',
  },
  switch: {
    label: 'Allow creators to counter',
    hint: 'If this is off, creators can only accept or decline.',
    note: 'You can change this later. Turning it off never stops a negotiation that has already started.',
    menu: 'Countering', on: 'On', off: 'Off', saved: 'Saved.',
  },
  set: {
    yourMove: 'Your move', negotiating: 'Negotiating', waitingChip: 'Waiting', yourMoveChip: 'Your move',
    countered: (line, d) => `Countered ${line} · ${shortDate4(d)}`,
    youCountered: (line, d) => `You countered ${line} · ${shortDate4(d)}`,
    askedFor: (d, at) => `Asked for ${shortDate4(d)} · ${shortDate4(at)}`,
    askedForMode: (m, at) => `Asked for ${m === 'visit' ? 'Store Visit' : 'Remote'} · ${shortDate4(at)}`,
  },
  endings: {
    agreed: 'AGREED', declinedByCreator: 'SHE DECLINED THE LAST COUNTER', declinedByBrand: 'YOU DECLINED HER COUNTER',
    expired: 'THE CUTOFF PASSED MID-NEGOTIATION', moved: 'SHE MOVED TO YOUR POOL',
  },
};

export { longDate4 as longDate6, shortDate4 as shortDate6, stampDate4 as stampDate6, aimLabel4 as aimLabel6, modeLabel4 as modeLabel6, first, rupees5 as rupees6, fmtPct5 as fmtPct6 };
