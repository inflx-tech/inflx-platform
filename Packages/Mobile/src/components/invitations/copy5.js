/**
 * Item 5 — every string the invitation screens show, word for word from the locked mockups
 * (I1–I15) and the prompt (§6, §7). MSG5 mirrors backend/src/services/invitationCopy.js.
 * Contract: features/item5-invitations
 */
import { aimLabel4, modeLabel4, longDate4, shortDate4, stampDate4 } from '../campaigns/copy4';

export const MSG5 = {
  COMMISSION_REQUIRED: 'Enter a commission percentage.',
  COMMISSION_RANGE: 'Commission must be between 0 and 100.',
  FEE_REQUIRED: 'Enter a fee.',
  HYBRID_FEE: "A Hybrid set needs a fixed fee. It can't be ₹0.",
  DELIVERABLES_EMPTY: 'Add at least one thing she delivers.',
  DELIVERABLE_COUNT: 'Choose between 1 and 20.',
  DELIVERABLE_DUP: "You've already added that. Change the count instead.",
  // creator-terms-v2 (rules 2.2): offers + products without offers; at least one of the two.
  SELL_NOTHING: (f) => `Give ${f} at least one offer or one product without an offer.`,
  SCOPE_CATEGORIES: 'Pick at least one category.',
  SCOPE_PRODUCTS: 'Pick at least one product.',
  USAGE_PLACE: 'Choose where the brand can use the content.',
  NOTE_LONG: 'Keep it under 300 characters.',
  OFFER_AMOUNT: 'Enter the discount.',
  OFFER_SCOPE: 'Pick what this offer applies to.',
  OFFER_DATES: 'The end date must be after the start date.',
  BELOW_MIN: (first, value) => `Below ${first}'s minimum of ${value}. You can still invite her, and she can counter.`,
  NOBODY_PICKED: 'Pick at least one creator.',
  SENT_LOCKED: "Terms can't be changed once the invitation is sent. Withdraw it and invite again.",
  DECLINE_REASON: 'Choose a reason.',
  DECLINE_NOTE_LONG: 'Keep it under 200 characters.',
};

export const first = (name) => String(name || 'She').trim().split(/\s+/)[0] || 'She';
export const rupees5 = (n) => (n == null || n === '' ? '' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
export const fmtPct5 = (p) => (p == null || p === '' ? '' : `${Number(p) % 1 === 0 ? Number(p) : Number(p).toFixed(1)}%`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const DELIVERABLE_TYPES = [
  { code: 'reel', label: 'Instagram reel', one: 'reel', many: 'reels' },
  { code: 'post', label: 'Instagram post', one: 'post', many: 'posts' },
  { code: 'story', label: 'Instagram story', one: 'story', many: 'stories' },
  { code: 'youtube_video', label: 'YouTube video', one: 'YouTube video', many: 'YouTube videos' },
  { code: 'youtube_short', label: 'YouTube short', one: 'YouTube short', many: 'YouTube shorts' },
];
/** "1 reel, 2 stories" — the short form for lines; the server's long form is on the detail. */
export function deliverablesShort(rows) {
  if (!Array.isArray(rows) || !rows.length) return '';
  return rows.map(r => { const t = DELIVERABLE_TYPES.find(x => x.code === r.type); const n = Number(r.count) || 1; return `${n} ${t ? (n === 1 ? t.one : t.many) : r.type}`; }).join(', ');
}
export const USAGE_DURATIONS = [[30, '30 days'], [60, '60 days'], [90, '90 days'], [null, 'Forever']];
export const USAGE_PLACES = [['social', "Brand's social"], ['ads', 'Ads'], ['website', 'Website']];
export const DECLINE_REASONS = [
  ['fee_too_low', 'Fee too low'], ['schedule_conflict', "Dates don't suit"], ['not_relevant', 'Not my kind of brand'], ['too_much_work', 'Too much work'], ['other', 'Other'],
];
export const SCOPE_LABEL = { store: 'Whole store', category: 'Some categories', products: 'Chosen products' };
export const MIN_SHOPPABLE_POSTS = 1;

/** "Priya Sharma", "Priya Sharma and Sneha N.", "Priya Sharma, Sneha N. and 2 others". */
export function nameList5(names) {
  const n = (names || []).filter(Boolean);
  if (!n.length) return '';
  if (n.length === 1) return n[0];
  if (n.length === 2) return `${n[0]} and ${n[1]}`;
  return `${n[0]}, ${n[1]} and ${n.length - 2} ${n.length - 2 === 1 ? 'other' : 'others'}`;
}

export const C5 = {
  pick: {
    title: 'Add creators',
    tabs: ['All creators', 'Worked with', 'Groups'],
    sub: (campaign, set) => `${campaign} · ${set}`.toUpperCase(),
    cantInvite: "Can't invite", notOpen: 'Not open to this set', invited: 'Invited', alreadyIn: 'Already in this set',
    hint: "Creators whose own settings rule this set out can't be picked, and the reason is never shown to them.",
    next: (n) => `Next: terms for ${plural(n, 'creator', 'creators')}`,
    groupsEmptyTitle: 'No groups yet', groupsEmptyBody: 'Groups are made on the Creators tab. Invite one here in a single step.',
    groupRow: (n) => plural(n, 'creator', 'creators'),
    // The basket, shared by all four tabs (2026-09-17).
    groupRowPicked: (n, k) => `${plural(n, 'creator', 'creators')} · ${k} already selected`,
    selected: (n) => `${n} selected`,
    review: 'Review',
    reviewTitle: (n) => `${n} selected`,
    reviewRemoveHint: 'Tap to remove',
    byHand: 'Picked by hand', fromPool: 'From the pool', fromGroup: (g) => `From ${g}`,
    reviewDone: 'Done',
    emptyBasket: 'Nobody selected yet.',
    loadWhat: 'creators',
  },
  group: {
    title: 'Invite a group',
    summary: (k, n) => `${k} of ${n} can be invited`,
    line: (g, aim, mode, date) => `${g} · ${aim} · ${mode} · posts ${shortDate4(date)}`,
    will: (k) => `Will be invited · ${k}`, cant: (m) => `Can't be invited · ${m}`, more: (n) => `+${n} more`,
    labels: { NOT_ACCEPTING: 'Not taking invitations', NOT_MATCHING: 'Not open to this set', IN_SET: 'Already in this set' },
    hint: 'Each creator still gets their own invitation and their own terms. The group is never shown to them.',
    next: (k) => `Next: terms for ${plural(k, 'creator', 'creators')}`,
    nobody: 'Nobody in this group can be invited to this set.',
    /**
     * 2026-09-17 — the group check now adds to the picker's basket instead of starting its own
     * send, so its words change from "next" to "add", and it says what the overlap is BEFORE
     * the tap rather than surprising her after it.
     */
    willAdd: (k) => `Will be added · ${k}`,
    add: (k) => `Add ${plural(k, 'creator', 'creators')} to selection`,
    addNone: 'Everyone here is already selected',
    running: (have, add) => `${have} already selected · ${add} new from this group`,
    overlap: (names) => `${names} — you had already picked. ${names.includes(' and ') ? 'They will' : 'She will'} not be added twice.`,
    added: (k, g) => `${plural(k, 'creator', 'creators')} added from ${g}.`,
    addedDup: (k, g, d) => `${plural(k, 'creator', 'creators')} added from ${g}. ${d} ${d === 1 ? 'was' : 'were'} already in your selection.`,
  },
  terms: {
    title: (name) => `Terms · ${name}`,
    step: (i, n) => `Creator ${i} of ${n}`,
    lockedTitle: 'Set terms, same for everyone',
    rows: { aim: 'Aim', posts: 'Posts on', mode: 'Mode', closes: 'Replies close' },
    next: 'Next creator', review: 'Review and send',
    minCommission: (f, v) => `${f}'s minimum is ${v}.`,
    minFee: (f, v) => `${f}'s minimum fee is ${v}.`,
    everyone: 'Use these terms for everyone', everyoneHint: 'You can still change any creator before sending.',
    commission: 'Commission', sell: 'What she can sell', change: 'Change',
    offer: 'Follower offer', none: 'None',
    shoppable: 'Shoppable posts', shoppableValue: (n) => `${plural(n, 'post', 'posts')} · set by INFLX`,
    fee: 'Fee', feeHint: 'Paid 25% on signing, 25% when the content is live, 50% after it stays live.',
    delivers: 'What she delivers', addAnother: 'Add another', deliverHint: 'Reels, posts, stories, YouTube videos and shorts.',
    note: 'Anything else she should know', notePlaceholder: 'Optional note for this creator',
    reuse: 'Brand can reuse the content', reuseHint: 'Usage rights. Off unless you need it.',
    fixedFee: 'Fixed fee', fixedFeeHint: "Paid whatever the sales are, in the same three parts. Can't be ₹0.",
    over50Title: "That's more than half of every sale. Are you sure?",
    over50Body: 'A commission above 50% means the creator keeps more than half of every sale made through her.',
    over50Yes: 'Yes, keep it', over50No: 'Change it',
    pickCategory: 'Pick a category', pickProducts: 'Pick products', noProducts: 'No published products yet. Add them on the website first.',
    categories: (n) => plural(n, 'category', 'categories'), products: (n) => plural(n, 'product', 'products'),
  },
  // creator-terms-v2 — T1–T7 (features/creator-terms-v2, locked 2026-09-28)
  sell: {
    offers: 'Offers', productsWithout: 'Products without offers',
    offersNone: 'None given', productsNone: 'None',
    offersValue: (n, p) => `${plural(n, 'offer', 'offers')} · ${plural(p, 'product', 'products')}`,
    productsValue: (n) => `${plural(n, 'product', 'products')} · normal price`,
    productsAll: (n) => `All ${plural(n, 'product', 'products')} · normal price`,
    summary: (o, op, p) => {
      const off = o ? `${plural(o, 'offer', 'offers')} (${plural(op, 'product', 'products')})` : null;
      const pr = p ? `${plural(p, 'product', 'products')} at normal price` : null;
      return `She can sell: ${[off, pr].filter(Boolean).join(' + ') || 'nothing yet'}`;
    },
    summaryMoney: (pct) => `Commission: ${pct} on every sale`,
    everyoneHint: 'Copies commission, offers and products. You can still change any creator.',
    // T2 / T6
    offersTitle: (f) => `Offers for ${f}`,
    offersHint: (d) => `Your offers that start by ${d} and end after it.`,
    selectAll: 'Select all', picked: (k, n) => `${k} of ${n} picked`,
    endsSoon: (end, days) => `⚠ Ends ${end}, ${plural(days, 'day', 'days')} after posting. Her posts using it leave the shop then.`,
    hidden: (n, parts) => `${plural(n, 'offer', 'offers')} ${n === 1 ? "isn't" : "aren't"} listed: ${parts}.`,
    hiddenStarts: (d) => `one starts ${d}`, hiddenEnded: (d) => `one ended ${d}`, hiddenEnds: (d) => `one ends ${d}`,
    give: (n) => (n ? `Give ${plural(n, 'offer', 'offers')}` : 'Give no offers'),
    noOffersTitle: (d) => `No offers valid on ${d}`,
    noOffersBody: (d, d1) => `Offers are built on the INFLX website. Build one that runs on ${d} or ${d1}, or give her products without offers instead.`,
    buildOnWeb: 'Build an offer on the website', close: 'Close',
    // T3 / T4
    productsTitle: 'Products without offers',
    productsHint: () => 'Sold at normal price. Only products not in any offer from today on are shown.',
    none: 'None', noneSub: 'She sells only her offers',
    all: 'All products without offers', allSub: (n) => `${plural(n, 'product', 'products')}, fixed when you send`,
    choose: 'Choose products', chooseSub: (n, cats) => (n ? `${n} picked${cats ? ` · ${cats}` : ''}` : 'Pick the ones she can sell'),
    change: (n) => `Change the ${plural(n, 'product', 'products')}`,
    giveTheOffer: "To give a product that's in an offer, give its offer.",
    done: 'Done',
    chooseTitle: 'Choose products', tabs: ['Categories', 'Search'], allIn: (n) => `All ${n}`, tickSome: 'Tick some',
    searchPlaceholder: 'Product name or SKU',
    notHere: 'Products in an offer now or later don\'t appear here at all.',
    use: (n) => (n ? `Use ${plural(n, 'product', 'products')}` : 'Use no products'),
    freeCount: (n, d) => `${n} WITHOUT OFFERS`,
    loadFailed: "Couldn't load. Try again.",
  },
  offer: {
    title: (f) => `Follower offer for ${f}`, header: 'FOLLOWER OFFER',
    none: 'No offer', noneSub: 'Shoppers pay the normal price',
    saved: 'Use a saved offer', savedSub: 'From the offers you built on the website',
    special: 'Create a special offer', specialSub: (f) => `Only for ${f}, on this collaboration`,
    preview: (price, product, discounted) => `A ${rupees5(price)} ${product} costs ${rupees5(discounted)}`,
    earns: (f, amount, pct) => `${f} earns ${rupees5(amount)} at ${fmtPct5(pct)} on what shoppers actually pay.`,
    use: 'Use this offer', noSaved: 'No saved offers yet. Build them on the website, or create a special offer.',
    specialLine: 'Special offer',
  },
  special: {
    title: (f) => `Special offer for ${f}`, header: (name) => `FOR ${String(name || '').toUpperCase()} ONLY`,
    kinds: [['discount', 'Money off'], ['volume', 'Buy more, save more'], ['bogo', 'Buy one, get one']],
    type: 'Type', amount: 'Amount', applies: 'Applies to',
    scopes: [['store', 'Whole store'], ['category', 'A category'], ['products', 'Chosen products']],
    from: 'From', until: 'Until', noEnd: 'No end',
    save: 'Also save to my offers', saveHint: 'It joins the offers on your website too.',
    tiers: 'Tiers', tierSpend: 'Spend ₹', tierOff: '% off', addTier: 'Add a tier',
    product: 'Product', buy: 'Buy', free: 'Get free',
    nameLabel: 'Name', namePlaceholder: (f) => `e.g. ${f}'s festive offer`,
  },
  review: {
    title: 'Review and send', all: (n) => `All ${plural(n, 'creator', 'creators')}`,
    belowMany: (n) => `${n} ${n === 1 ? 'creator is' : 'creators are'} below their own minimum. They can still be invited and can counter.`,
    ok: 'OK', below: 'Below min', endsSoon: 'Ends soon',
    endsSoonMany: (n, days) => `${n === 1 ? '1 creator was' : `${n} creators were`} given an offer that ends ${days} ${days === 1 ? 'day' : 'days'} after posting.`,
    from: (g) => `from ${g}`,
    hint: (date) => `Each creator gets their own invitation. They can accept, counter or decline until ${shortDate4(date)}.`,
    send: (n) => `Send ${plural(n, 'invitation', 'invitations')}`,
    sent: (n) => `${plural(n, 'invitation', 'invitations')} sent.`,
    failedTitle: (n) => `${n === 1 ? '1 creator' : `${n} creators`} can't be invited`,
    failedBody: 'Nothing was sent. Fix them, or remove them and send the rest.',
    removeAndSend: (n) => `Remove ${n} and send the rest`,
  },
  set: {
    groups: {
      waiting: 'Waiting to answer', negotiating: 'Negotiating', accepted: 'Accepted, waiting for the agreement', signed: 'Signed',
      deferred: 'Asked for another date', declined: 'Declined', expired: 'Expired', withdrawn: 'Withdrawn and closed',
    },
    sent: (d) => `sent ${stampDate4(d)}`, accepted: (d) => `Accepted ${stampDate4(d)}`, signed: (d) => `Signed ${stampDate4(d)}`,
    wants: (d) => `Wants ${shortDate4(d)}`, anotherSet: 'Another set', sendAgreement: 'Send agreement',
    // Item 7 (P1). Contract: features/item7-agreement
    signChip: 'Sign',
    signedWaiting: (d) => `Signed ${stampDate4(d)} · waiting for you`,
    agreementSent: (d) => `Agreement sent ${stampDate4(d)}`,
    signedByBoth: (d) => `Signed by both ${stampDate4(d)}`,
    withdrawnMeta: (d) => `Withdrawn ${stampDate4(d)}`, removedMeta: (d) => `Removed ${stampDate4(d)}`, expiredMeta: 'Expired',
    more: (n) => `+${n} more`,
    menu: { viewTerms: 'View terms sent', profile: 'Open profile', withdraw: 'Withdraw invitation', withdrawHint: "Only while she hasn't answered", remove: 'Remove from set', removeHint: 'Until the agreement is signed' },
    withdrawTitle: (f) => `Withdraw ${f}'s invitation?`,
    withdrawBody: 'She sees it as withdrawn. You can invite her again with new terms while there is still time.',
    keep: 'Keep', withdraw: 'Withdraw', withdrawn: 'Invitation withdrawn.',
    removeTitle: (f) => `Remove ${f} from this set?`,
    removeBody: "She's told the brand is no longer going ahead. No reason is sent. A signed agreement is never touched.",
    remove: 'Remove', removed: 'Removed from the set.',
    termsHint: "Terms can't be edited once sent. Withdraw and invite again instead.",
    termsTitle: 'Terms sent', creatorHeader: 'CREATOR',
  },
  creator: {
    youEarn: (v) => `You earn ${v}`, commission: (p) => `${fmtPct5(p)} commission`,
    replyBy: (d, n) => `Reply by ${shortDate4(d)} · ${n == null ? '' : n === 0 ? 'today' : plural(n, 'day', 'days') + ' left'}`.replace(/ · $/, ''),
    posts: (d) => `Posts ${shortDate4(d)}`,
    // Item 6 (N12, N20): 'pooled' is the agreed move; 'yourMove' is a counter waiting on her.
    chips: { accepted: 'Accepted', expired: 'Expired', withdrawn: 'Withdrawn', closed: 'Closed', declined: 'Declined', negotiating: 'Waiting', yourMove: 'Your move', pooled: 'Agreed', deferred: 'Another date asked',
      // Item 7 (P4, P7, P16). Contract: features/item7-agreement
      toSign: 'Your move', signedWaiting: 'Waiting', signed: 'Active' },
    waitingFor: (b) => `Waiting for the agreement from ${b}.`,
    expiredBody: (d) => `You didn't reply by ${shortDate4(d)}, so this invitation closed.`,
    withdrawnBody: (b, d) => `${b} withdrew this invitation on ${stampDate4(d)}.`,
    closedBody: (b) => `${b} is no longer going ahead with this collaboration.`,
    declinedBody: (d) => `You declined on ${stampDate4(d)}.`,
    negotiatingBody: 'Your counter is with the brand.',
    deferredBody: 'You asked for another date. The brand will put you in another set.',
    emptyTitle: 'No invitations yet', emptyBody: 'When a brand invites you to a set, it shows up here.',
    doneEmptyTitle: 'Nothing finished yet', doneEmptyBody: 'Expired, withdrawn and closed invitations move here after seven days.',
    loadWhat: 'your invitations',
    detail: {
      title: 'Invitation', lockedTitle: 'Set by the brand, same for everyone',
      rows: { aim: 'Aim', posts: 'Posts on', mode: 'Mode', reply: 'Reply by' },
      yours: 'Your terms',
      commission: 'Commission', commissionValue: (p) => `${fmtPct5(p)} on what you sell`,
      sell: 'You can sell', sellStore: 'Anything in the store',
      offer: 'Shopper offer', posts: 'Shoppable posts', postsValue: (n) => `At least ${n}`,
      fee: 'Fee', post: 'You post', reuse: 'Brand can reuse',
      payTitle: 'How the fee is paid',
      pay: (a, b, c) => `${rupees5(a)} when you both sign · ${rupees5(b)} when the brand confirms your content is live · ${rupees5(c)} after it stays live`,
      final: 'Nothing is final until you both sign the agreement.',
      accept: 'Accept', counter: 'Counter', decline: 'Decline',
      acceptTitle: 'Accept these terms?', acceptBody: (b) => `${b} will send the agreement next. Nothing is final until you both sign it.`, notYet: 'Not yet',
      declineTitle: 'Why are you saying no?', anythingElse: 'Anything else (optional)',
      declineHint: 'The brand sees this. It helps them come back with something better.', declineButton: 'Decline invitation',
      accepted: 'Accepted.', declined: 'Invitation declined.',
    },
    counterSoon: { title: 'Countering is coming next', body: 'Item 6 adds the negotiation here. Nothing has been sent to the brand.', back: 'Back to the invitation' },
  },
};

/** Chip tone per group, on the item 2 palette (prompt §8). */
export const GROUP_TONE = {
  waiting: 'waiting', invited: 'waiting', negotiating: 'waiting', yourMove: 'yourMove', accepted: 'active', signed: 'completed',
  // Item 7: the agreement is hers to sign (amber), or she has signed and waits (blue).
  toSign: 'yourMove', signedWaiting: 'waiting',
  pooled: 'active', deferred: 'waiting',
  declined: 'declined', expired: 'ended', withdrawn: 'ended', closed: 'ended', ok: 'active', below: 'yourMove',
};

export { aimLabel4 as aimLabel5, modeLabel4 as modeLabel5, longDate4 as longDate5, shortDate4 as shortDate5, stampDate4 as stampDate5 };
