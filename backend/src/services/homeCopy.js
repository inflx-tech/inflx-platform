'use strict';

/**
 * Item 19 — the words on a Home row (rules v1.32 §24; board item19-home-v3).
 *
 * A row is: who, ONE sentence, and where there is one a "why now". The row's name sits above the
 * sentence on the phone, so a sentence about a creator says "She", and one about a brand "They".
 * The BUTTON word is not here: the phone uses the set screen's own constants (C5, C6), so a row
 * and the screen it opens cannot read differently.
 * Contract: features/item19-home
 */

const { calendarDay } = require('../utils/indiaDay');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '12 Oct' from a calendar day or an instant (India day). */
function dayMon(v) {
  if (!v) return '';
  const d = calendarDay(v);
  if (!d) return '';
  const [, m, day] = d.split('-');
  return `${Number(day)} ${MONTHS[Number(m) - 1]}`;
}
const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const pct = (p) => `${Number(p) % 1 === 0 ? Number(p) : Number(p).toFixed(1)}%`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const AIM = { engagement: 'Pay for Content', conversion: 'Pay for Sale', hybrid: 'Hybrid' };
const MODE = { visit: 'Store Visit', shipment: 'Remote', remote: 'Remote' };
const aimLabel = (g) => AIM[g] || '';
const modeLabel = (m) => MODE[String(m || '').toLowerCase()] || '';

/** "₹25,000" · "12% commission" · "₹12,000 + 10%" */
function earnWords(goal, fee, commissionPct, { long = false } = {}) {
  if (goal === 'engagement') return fee != null ? inr(fee) : '';
  if (goal === 'hybrid') return [fee != null ? inr(fee) : null, commissionPct != null ? pct(commissionPct) : null].filter(Boolean).join(' + ');
  return commissionPct != null ? `${pct(commissionPct)}${long ? ' commission' : ''}` : '';
}

/** "Today" · "Tomorrow" · "3 days left" — for a deadline `n` days away. */
function daysLeftWords(n) {
  if (n == null) return null;
  if (n <= 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return `${n} days left`;
}

const BRAND = {
  // ── needs ──
  sign: (cutoff) => `She signed. Your signature is needed by ${dayMon(cutoff)}.`,
  send_agreement: () => 'She accepted. Send her the agreement.',
  reply: () => 'She sent a counter. It is your turn to reply.',
  reply_move: () => 'She asked for another date or mode. Your answer.',
  plan_visit: () => 'Signed. Plan her store visit.',
  visit_passed: (at) => `The ${dayMon(at)} visit passed with nothing marked. Send a new time.`,
  reply_time: () => 'She asked for another visit time. It is your turn to reply.',
  confirm_shoot: () => 'She says she came to the store. Confirm the shoot.',
  book_parcel: () => 'Her address is in. Pick the products and book the parcel.',
  rebook: () => 'The parcel came back to the store. Book it once more.',
  difference: () => 'She reported an item missing or damaged. Take a look.',
  confirm_return: (selfSent) => (selfSent ? 'She says she sent the products back. Confirm the return.' : 'The products are back with you. Confirm the return.'),
  review_content: () => 'Her content is ready. Review it.',
  review_social: () => 'She sent what she will share. Review it.',
  confirm_live: () => 'She has posted and added her links. Confirm it is live.',
  pitchesName: (n, anyTalking) => (anyTalking ? plural(n, 'pitch is waiting for you', 'pitches are waiting for you') : plural(n, 'new pitch', 'new pitches')),
  pitches: (anyTalking) => (anyTalking ? 'New pitches, and replies from creators.' : 'Creators asking to work with you.'),
  poolName: (n) => `${plural(n, 'creator', 'creators')} agreed, ${n === 1 ? 'needs' : 'need'} a set`,
  pool: (n) => (n === 1 ? 'She agreed your terms for another date. Build a set for her.' : 'They agreed your terms for other dates. Build a set for them.'),
  poolCloses: (days) => (days <= 0 ? 'One closes today' : `One closes in ${plural(days, 'day', 'days')}`),
  ordersName: (n) => plural(n, 'order to pack', 'orders to pack'),
  orders: () => 'Shoppers are waiting. Orders are handled on the website.',
  ordersCtx: 'Opens the website',
  withdrawalFailedName: 'Your withdrawal could not be processed',
  withdrawalFailed: () => 'The money is back in Available. See why, and ask again.',
  addBankName: 'Add your bank account',
  addBank: () => 'You have money you can withdraw, and nowhere to send it yet.',
  // ── why now ──
  whyPayment: 'Her payment waits',
  whyNextStep: 'Her next step waits',
  // ── waiting ──
  w_not_answered: (sentAt) => `Invited on ${dayMon(sentAt)}. She has not answered yet.`,
  w_her_counter: () => 'Your counter is with her.',
  w_to_sign: () => 'The agreement is with her to sign.',
  w_her_time: () => 'The visit plan is with her.',
  w_her_address: () => 'Waiting for her delivery address.',
  w_in_transit: () => 'The parcel is on its way to her.',
  w_her_check: () => 'Delivered. She is checking the parcel.',
  w_her_shoot: () => 'She has the products. Waiting for her to shoot.',
  w_send_content: (posting) => `She is working on her content.${posting ? ` Posting date ${dayMon(posting)}.` : ''}`,
  w_make_changes: () => 'She is making the changes you asked for.',
  w_post_and_link: () => 'Approved. She is posting it.',
  w_make_posts: () => 'She is making her shoppable posts.',
  w_send_social: () => 'She is preparing what she will share.',
  w_waiting_posts: () => 'Live. Waiting on her shoppable posts.',
  w_reported: () => 'Reported to INFLX.',
  w_final_payment: (due) => (due ? `The final payment goes out on ${dayMon(due)}.` : 'Live. The final payment follows.'),
  closes: (cutoff) => `Closes ${dayMon(cutoff)}`,
  tags: {
    not_answered: 'Not answered', waiting: 'Waiting', to_sign: 'To sign', her_move: 'Her move',
    in_transit: 'In transit', inflx: 'With INFLX', automatic: 'Automatic',
  },
};

const CREATOR = {
  // ── needs ──
  answer: (goal, mode, earn) => `New invitation. ${[aimLabel(goal), modeLabel(mode), earn].filter(Boolean).join(' · ')}.`,
  replyBy: (cutoff) => `Reply by ${dayMon(cutoff)}`,
  reply: () => 'They sent a counter. It is your turn to reply.',
  sign: (cutoff) => `The agreement is ready. Review and sign by ${dayMon(cutoff)}.`,
  answer_plan: () => 'They planned your store visit. Answer the time.',
  reply_time: () => 'They proposed another visit time. Your reply.',
  mark_visit: () => 'Been to the store? Mark the visit done.',
  send_address: () => 'Send your delivery address.',
  correct_address: () => 'The parcel could not be delivered. Correct your address.',
  check_parcel: () => 'Your parcel arrived. Say what turned up.',
  mark_shoot: () => 'Mark the shoot done when you have shot.',
  send_back: () => 'Shoot done. Send the products back.',
  send_content: () => 'Upload your content and send it.',
  make_changes_content: () => 'They asked for changes to your content.',
  make_changes_social: () => "They asked for changes to what you'll share.",
  post_and_link: () => 'Approved. Post it and add the links.',
  make_posts: () => 'Create your shoppable posts.',
  send_social: () => "Send them what you'll share.",
  postNeededName: 'Shoppable post needed',
  postNeeded: (brand, campaign, done, min) => `${brand} · ${campaign}. You have made ${done} of ${min}.`,
  before: (day) => `Before ${dayMon(day)}`,
  postBackName: 'A post was sent back',
  postBack: (reason) => (reason ? `INFLX asked for a fix: “${String(reason).trim().slice(0, 120)}”` : 'INFLX asked for a fix.'),
  pitch_reply: () => 'They answered your pitch with a counter. Your reply.',
  fixName: { fix_instagram: 'Instagram needs fixing', fix_youtube: 'YouTube needs fixing', fix_accounts: 'Your accounts need fixing' },
  fix: (chip) => (chip === 'fix_accounts' ? 'We could not read your accounts, so brands cannot see your numbers.' : 'We could not read your account, so brands cannot see your numbers.'),
  fixCtx: 'Profile · Your numbers',
  pausedName: 'Invitations are paused',
  paused: () => 'Brands cannot invite you while this is paused.',
  pausedCtx: 'Profile · Invitation settings',
  addDetailsName: 'Add payment details',
  addDetails: () => 'You have money you can withdraw, and nowhere to send it yet.',
  addDetailsCtx: 'Wallet · Payment details',
  withdrawalFailedName: 'Your withdrawal could not be processed',
  withdrawalFailed: () => 'The money is back in Available. See why, and ask again.',
  walletCtx: 'Wallet',
  createCtx: 'Create',
  // ── waiting ──
  w_brand_to_sign: (brand) => `You signed. Waiting for ${brand} to sign.`,
  w_counter_with_brand: () => 'Your counter is with them.',
  w_date_request: () => 'You asked for another date. Waiting for their answer.',
  w_agreement_coming: () => 'You accepted. Their agreement is on its way.',
  w_pooled: () => 'Agreed. Waiting for them to build a set.',
  w_applied: () => 'You applied. Waiting for their answer.',
  w_brand_plan: () => 'They are planning your store visit.',
  w_brand_time: () => 'You asked for another time. Waiting for their answer.',
  w_brand_confirm_visit: () => 'You marked the visit done. Waiting for them to confirm.',
  w_brand_ship: () => 'Address sent. Waiting for your products.',
  w_courier: () => 'Your products are on the way.',
  w_review_content: () => 'Your content is with them for review.',
  w_review_social: () => "What you'll share is with them for review.",
  w_confirm_live: () => 'Posted. Waiting for them to confirm it is live.',
  w_reported: () => 'INFLX is looking at this.',
  w_final_payment: (due) => (due ? `Live. Your last payment is on ${dayMon(due)}.` : 'Live. Your last payment is on its way.'),
  w_waiting_posts: () => 'Live. It completes when your posts are approved.',
  postCheckName: 'Your post is being checked',
  postCheck: () => 'INFLX reviews every shoppable post before it goes live.',
  w_pitch: (due) => (due ? `Your pitch is with them. They have until ${dayMon(due)}.` : 'Your pitch is with them.'),
  w_pitch_talking: () => 'Your counter on the pitch is with them.',
  tags: {
    waiting: 'Waiting', to_sign: 'To sign', in_review: 'In review', in_transit: 'In transit',
    inflx: 'With INFLX', automatic: 'Automatic', sent: 'Sent', talking: 'Talking',
  },
  // Running now
  posts: (day) => (day ? `Posts ${dayMon(day)}` : ''),
  youEarn: (words) => (words ? `you earn ${words}` : ''),
  runChip: { active: 'Active', selling: 'Completed · selling' },
};

module.exports = { BRAND, CREATOR, dayMon, inr, pct, plural, aimLabel, modeLabel, earnWords, daysLeftWords };
