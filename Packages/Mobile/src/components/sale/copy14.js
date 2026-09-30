/**
 * Item 14 — every sentence the Going live screens say, in one place (board v2, locked 30 Sep 2026).
 * Contract: features/item14-sale-going-live · rules v1.30 §12.1
 *
 * Refusals come from the server (contentCopy.js) and are shown as sent; this file holds the
 * screens' own words. Two paths, always named the same way: "Shoppable posts" (checked by INFLX)
 * and "Social media" (checked by the brand).
 */
import { day10 } from '../shoot/copy10';

const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'She';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export { day10, first, rupees };

export const C14 = {
  titleHers: 'Going live',
  couldntLoad: 'Going live',
  crumb: (brand, set) => `${String(brand || '').toUpperCase()} · ${String(set || '').toUpperCase()}`,
  crumbBrand: (campaign, set) => `${String(campaign || '').toUpperCase()} · ${String(set || '').toUpperCase()}`,

  // The doors (S1, S2)
  goLive: 'Go live — your posts',
  goLiveHint: '1 · shoppable posts (INFLX) → 2 · social media',
  openGoingLive: 'Open going live',

  // Path 1 (S4–S7)
  path1: '1 · Shoppable posts',
  path1Who: 'Checked by INFLX',
  path1WhoBrand: 'INFLX checks',
  progress: (a, m) => `${a} of ${m} approved`,
  minimum: (m) => `Minimum ${m} · set by INFLX`,
  moreToMin: (n) => `${plural(n, 'more', 'more')} to reach the minimum.`,
  withInflx: (n) => `${plural(n, 'post is', 'posts are')} with INFLX for review.`,
  shortBy: (n) => `Short of the minimum by ${n}. No penalty; it completes once it is met.`,
  createPost: 'Create a shoppable post',
  createAnother: 'Create another',
  late: 'Late',
  approvedLate: (d) => `Approved ${day10(d)} · after the posting date`,
  inShopFrom: (d) => `In the shop from ${day10(d)}`,
  postState: { draft: 'Draft', in_review: 'With INFLX', sent_back: 'Sent back', approved: 'Approved', live: 'Live', removed: 'Removed' },

  // Path 2 (S4, S5)
  path2: '2 · Share on social media',
  path2Brand: '2 · Social media',
  path2Who: (brand) => `${brand} checks this part`,
  path2WhoBrand: 'You check',
  locked: 'Locked',
  open: 'Open',
  lockedWhy: (brand) => `Opens when INFLX approves your first shoppable post. ${brand} checks this part.`,
  openWhy: (brand) => `Send ${brand} the version you'll post, and where. You can share approved posts only.`,
  shareOnSocial: 'Share on social media',
  herMoveNotSent: "Her move. She hasn't sent what she'll share yet.",

  // Choosing and filling (S7–S9)
  whereTitle: (title) => `Where will you share "${title}"?`,
  whereHint: 'Pick one or more. Each becomes a row you upload the version for.',
  addRows: (n) => (n ? `Add ${plural(n, 'row', 'rows')}` : 'Pick at least one'),
  storyProof: 'Proved with a screenshot',
  addPostOrPlace: '+ Add another post or place',
  approvedOnly: 'Only posts INFLX has approved appear here.',
  sendTo: (brand) => `Send to ${brand}`,
  sendChanges: 'Send again',
  rowLabel: (post, place) => `${post} · ${place}`,
  withThem: (brand, d) => `With ${brand} since ${day10(d)}. You'll hear when they reply.`,
  lockedWhile: 'Locked while they review. Nothing here can change until they approve or ask for changes.',
  captionPlaceholder: 'Caption you suggest (optional)',
  removeRow: 'Take this out',
  noRowsYet: 'Nothing to send yet',
  noRowsBody: 'Pick an approved post and where you will share it.',

  // Changes (S12, S13)
  theyAsked: (brand, d) => `${brand} asked for changes · ${day10(d)}`,
  lastRoundHint: (n) => `Round ${n} is the last.`,

  // Posting (S14–S16)
  approvedPostNow: (brand, d) => `Approved on ${day10(d)}. Post these — this is the version ${brand} approved.`,
  addLinkEach: 'Add a link for each one',
  pasteLink: 'Paste the link',
  addScreenshot: 'Add a screenshot',
  storiesGo: 'Stories disappear in a day.',
  postedEverything: "I've posted everything",
  toGo: (links, shots) => [links ? plural(links, 'link', 'links') : null, shots ? plural(shots, 'screenshot', 'screenshots') : null].filter(Boolean).join(' and ') + ' to go.',
  postedWaiting: (d, brand) => `Posted on ${day10(d)}. ${brand} confirms it's live.`,
  confirmsItselfOn: "If they don't answer, it confirms itself on",

  // Outside the package (S16)
  whereShared: 'Where did you share it?',
  notSharedYet: 'Not shared yet',
  addBy: (d, brand) => `Add a link by ${day10(d)}. ${brand} sees posts that aren't shared yet. No penalty.`,
  addWhere: 'Add where you shared it',
  saveLink: 'Save link',

  // Brand's verdict (S10–S13)
  yourMoveSent: (name, d) => `Your move. ${first(name)} sent what she'll share on ${day10(d)}.`,
  approvingLocks: 'Approving locks this as what she posts. Her shop posts are separate; this is only the social media version.',
  approve: "Approve what she'll share",
  askChanges: 'Ask for changes',
  askChangesLast: 'Ask for changes — last time',
  lastRound: 'This is the last round. If you ask for changes now, the next step is approve or tell INFLX — never a third round.',
  roundsUsed: 'Rounds used. Approve what she\'ll share, or tell INFLX.',
  withHer: (name) => `With ${first(name)} for changes.`,
  approvedPosting: (name) => `Approved. ${first(name)} is posting it.`,

  // Confirming (S17, S18)
  yourMovePosted: (name, d) => `Your move. ${first(name)} posted everything on ${day10(d)}.`,
  confirmCompletes: 'Confirming completes the collaboration',
  confirmCompletesSub: (d) => `No money moves. Her sales and commission keep running.${d ? ` If you don't answer, it confirms itself on ${day10(d)}.` : ''}`,
  confirmWaits: 'Confirming marks it live',
  confirmWaitsSub: (n, d) => `It completes when INFLX has approved ${plural(n, 'more post', 'more posts')}. No money moves.${d ? ` If you don't answer, it confirms itself on ${day10(d)}.` : ''}`,
  confirmLive: "Confirm it's live",
  somethingWrong: "Something's wrong — tell INFLX",
  youConfirmed: (d) => `You confirmed it's live on ${day10(d)}.`,
  theyConfirmed: (brand, d) => `${brand} confirmed it's live on ${day10(d)}.`,
  completesWhen: (n) => `Completes by itself when ${plural(n, 'more post is', 'more posts are')} approved.`,

  // Completed and selling (S19–S21)
  completedHers: (d) => `Completed on ${day10(d)}. Your posts keep selling.`,
  completedBrand: (d) => `Completed on ${day10(d)}. Her posts keep selling.`,
  confirmedItself: (d) => `Confirmed itself on ${day10(d)} — no answer in time.`,
  orders: 'Orders', sales: 'Sales', youEarn: 'You earn',
  waitingReturn: 'Waiting for the return window',
  inWallet: 'In your wallet',
  ordersSales: 'Orders · sales',
  commissionTo: (name) => `Commission to ${first(name)}`,
  inflxFee: 'INFLX fee',
  youReceive: 'You receive',
  herPosts: 'Her posts',
  yourPosts: 'Your posts',
  socialCount: (n) => plural(n, 'social post', 'social posts'),
  copyCodes: 'Copy all post codes',

  // Every other state (S21–S24)
  toldInflxBrand: (d) => `You told INFLX on ${day10(d)}`,
  toldInflxBrandBody: 'Nothing moves here until INFLX settles it. Her posts stay in the shop.',
  toldInflxHers: (brand, d) => `${brand} told INFLX on ${day10(d)}`,
  toldInflxHersBody: 'INFLX will contact you. Your shop posts keep selling.',
  delayed: (d, label) => `Delayed · ${String(label || '').toLowerCase()}. The posting date was ${day10(d)}.`,
  delayedHers: (d) => `Delayed. The posting date was ${day10(d)}. Everything still works.`,
  oldTerms: 'Signed under the old terms. Shoppable posts need the new terms — a new collaboration.',
  oldTermsBrand: 'Signed under the old terms. This collaboration has no shoppable posts.',
  shootNotDone: "The shoot isn't done yet",
  opensAfterShoot: 'Going live opens when the shoot is marked done.',

  // Reporting (S22)
  reportTitle: "What's wrong?",
  reasons: { not_posted: "She hasn't posted it", posted_wrong: "It isn't what I approved", missing: 'Something is missing' },
  reportNote: 'Add a note (optional)',
  reportStops: 'This stops it confirming itself. Her shop posts keep selling.',
  tellInflx: 'Tell INFLX',
  back: 'Back',

  // Item 15 — Hybrid: the fixed amount (board S1–S9).
  payingHers: (brand, amt) => `${brand} confirms it's live, and that pays your second ${rupees(amt)}.`,
  secondIn: (brand, d, amt) => `${brand} confirmed it's live on ${day10(d)}. ${rupees(amt)} is in your wallet.`,
  lastOn: (amt, d) => `The last ${rupees(amt)} arrives on ${day10(d)}.`,
  paidInFull: (fee) => `Paid in full — ${rupees(fee)}.`,
  askInflx: 'Ask INFLX to look',
  canAskFrom: (d) => `No answer by ${day10(d)}? You can ask INFLX to look. It never stops them paying you.`,
  youAsked: (d) => `You asked INFLX to look on ${day10(d)}. They can still confirm and pay you.`,
  confirmPays: (amt) => `Confirm it's live · ${rupees(amt)}`,
  confirmReleases: (amt) => `Confirming releases ${rupees(amt)}`,
  confirmReleasesSub: (fee, last, days) => `The second 25% of her ${rupees(fee)}. The last ${rupees(last)} follows ${days} days later. Her sales and commission run separately.`,
  youConfirmedPaid: (d, amt, name) => `You confirmed it's live on ${day10(d)}. ${rupees(amt)} went to ${first(name)}.`,
  lockedStays: (amt) => `Nothing moves until INFLX settles it. ${rupees(amt)} of her fixed amount stays locked. Her posts stay in the shop.`,
  sheToldInflx: (name, d) => `${first(name)} told INFLX on ${day10(d)} that you haven't confirmed. You can still confirm it.`,

  // Toasts
  sent: 'Sent',
  approved: 'Approved',
  changesSent: 'Sent back with your reason',
  postedDone: 'Told them',
  confirmedDone: 'Confirmed',
  reportedDone: 'INFLX has it',
  saved: 'Saved',
  copied: 'Copied',

  // Steps (S1, S15, S18)
  steps: {
    signed: 'Agreement signed',
    shoot: 'Shoot',
    posts: 'Shoppable posts',
    social: 'Social media',
    complete: 'Completed',
    postsGoLive: (d) => `Posts go live ${day10(d)}`,
    salesKeep: 'Your sales keep running after',
  },
};
