/**
 * Item 17 — every word the Wallet says, on both phones, from the locked board (BW1–BW10, CW1–CW7).
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * One vocabulary for the brand and the creator: Available, On hold, Locked in collaborations,
 * Sales money coming, Still to come. A withdrawal is a REQUEST that INFLX pays — never "payout",
 * never "transfer". Nothing here mentions a tax deduction: none is made (W6).
 */

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "12 Oct" — from a calendar day (YYYY-MM-DD) or a moment, read in India's day. */
export function dayMon(v) {
  if (!v) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  if (m) return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const ist = new Date(d.getTime() + 330 * 60000);
  return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}`;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const first = (name) => String(name || '').trim().split(/\s+/)[0] || '';

export const W17 = {
  title: 'Wallet',
  available: 'Available',
  addMoney: 'Add money',
  withdraw: 'Withdraw',
  oneAtATime: 'One withdrawal at a time.',

  // the figures
  hold: 'On hold · your withdrawal',
  holdSub: (d, to) => `Requested ${d} · to ${to}`,
  holdBoxBold: (amt, d) => `You requested ${amt} on ${d}.`,
  holdBoxRest: (hours) => ` It will be processed within ${hours} hours. This amount is on hold until then.`,
  locked: 'Locked in collaborations',
  lockedSub: (n) => (n ? plural(n, 'collaboration', 'collaborations') : 'Nothing locked'),
  sales: 'Sales money coming',
  // shopper-walk-fixes (W13): a sale that is coming may be not shipped, on its way, or in its return window.
  salesSub: (n) => (n ? `${plural(n, 'sale', 'sales')} not added yet` : 'No sales waiting'),
  history: 'History',
  historySub: 'Everything in and out',
  brandDetails: 'Bank and business details',
  brandDetailsSub: (bank, gst) => `${bank ? 'Bank account added' : 'Bank account not added'} · ${gst ? 'GST added' : 'GST not added'}`,

  // creator
  stillToCome: 'Still to come',
  stillToComeSub: 'Collaboration payments and commission',
  payments: 'Collaboration payments',
  paymentsSub: (n, next) => (n ? `${plural(n, 'collaboration', 'collaborations')}${next ? ` · next on ${next}` : ''}` : 'Nothing waiting'),
  commission: 'Commission',
  commissionSub: (n) => (n ? `${plural(n, 'sale', 'sales')} not added yet` : 'No sales waiting'),
  payDetails: 'Payment details',
  payDetailsSub: (upi, bank) => `${upi ? 'UPI added' : 'UPI not added'} · ${bank ? 'bank added' : 'bank not added'}`,

  // BW3, BW4, CW3
  lockedTitle: 'Locked in collaborations',
  stillLocked: 'Still locked',
  paidToCreators: 'Paid to creators so far',
  fixedAmount: 'Fixed amount',
  fee: 'Fee',
  herFee: 'Her fee',
  paid: 'Paid',
  nextBrand: (p) => {
    if (!p) return null;
    if (p.dueAt) return `Next: ${inr(p.amount)} on ${dayMon(p.dueAt)}`;
    if (p.kind === 'confirm_live') return `Next: ${inr(p.amount)} when you confirm it's live`;
    return `Next: ${inr(p.amount)} after it's confirmed live`;
  },
  feeNotLocked: 'The INFLX campaign fee on Pay for Content was charged once at signing and is not part of what is locked for her.',
  campaignFee: (amt) => `INFLX campaign fee ${inr(amt)} · charged to you at signing, never to her.`,
  paidInFull: 'Paid in full',
  nothingLockedTitle: 'Nothing is locked',
  nothingLockedBody: 'Money locks here when you sign a Pay for Content or Hybrid agreement.',
  openCollab: 'Open the collaboration',
  payWhenBrand: (p) => (p.paid ? `Paid ${dayMon(p.paidAt)}` : p.dueAt ? `On ${dayMon(p.dueAt)}` : p.n === 2 ? "When you confirm it's live" : "After it's confirmed live"),
  payWhenCreator: (p) => (p.paid ? `Paid ${dayMon(p.paidAt)}` : p.dueAt ? `Arrives on ${dayMon(p.dueAt)}` : p.n === 2 ? "When they confirm it's live" : "After it's confirmed live"),
  paymentsTitle: 'Collaboration payments',
  received: 'Received so far',
  noPaymentsTitle: 'No collaboration payments yet',
  noPaymentsBody: 'When a brand signs a Pay for Content or Hybrid agreement with you, its three payments appear here with their dates.',

  // BW5, BW6, CW4
  salesTitle: 'Sales money',
  coming: 'Coming',
  addedMonth: 'Added this month',
  salesCount: 'Sales',
  filters: [['all', 'All'], ['coming', 'Coming'], ['added', 'Added'], ['cancelled', 'Cancelled']],
  saleLine: (s, whose) => {
    const post = `${whose} post ${s.post && s.post.code ? s.post.code : ''}`.trim();
    if (s.state === 'cancelled') return `${post} · cancelled`;
    if (s.state === 'returned') return `${post} · returned`;
    if (s.state === 'added') return `${post} · added ${dayMon(s.at)}`;
    if (s.state === 'cod_waiting') return `${post} · cash on delivery · waiting for delivery`;
    if (s.state === 'not_shipped') return `${post} · not shipped yet`;
    if (s.state === 'waiting_delivery') return `${post} · on its way · waiting for delivery`;
    const cod = s.cashOnDelivery ? ` · cash on delivery · delivered ${dayMon(s.deliveredAt)}` : '';
    return `${post}${cod} · ${s.cashOnDelivery ? 'until' : 'return window until'} ${dayMon(s.windowUntil)}`;
  },
  whoseBrand: (s) => `${first(s.creatorName) || 'Creator'}'s`,
  shopperPaid: 'Shopper paid',
  creatorShare: (pct) => `Creator's share · ${pct}%`,
  inflxShare: (pct) => `INFLX's share · ${pct}%`,
  yourShare: 'Your share',
  saleBox: (s) => {
    if (s.state === 'cancelled') return { tone: 'ended', text: 'This item was cancelled. Nothing is added for it.' };
    if (s.state === 'returned') return { tone: 'ended', text: 'The shopper returned this item. Nothing is added for it.' };
    if (s.state === 'added') return { tone: 'active', text: `${inr(s.brandShare)} was added to your wallet on ${dayMon(s.at)}.` };
    if (s.state === 'cod_waiting') return { tone: 'waiting', text: 'Cash on delivery. Its return window starts when it is delivered.' };
    if (s.state === 'not_shipped') return { tone: 'yourMove', text: `This order has not been shipped yet. Your ${inr(s.brandShare)} is added to your wallet after it is delivered and its return window closes.` };
    if (s.state === 'waiting_delivery') return { tone: 'waiting', text: 'On its way to the shopper. Its return window starts when it is delivered.' };
    return { tone: 'waiting', text: `In its return window until ${dayMon(s.windowUntil)}. Your ${inr(s.brandShare)} is added to your wallet when it closes, if it isn't returned.` };
  },
  offer: 'Offer', paidBy: 'Paid by', status: 'Status',
  paidByWord: (s) => (s.cashOnDelivery ? 'Cash on delivery' : 'Online'),
  orderWord: (s) => {
    const w = { confirmed: 'Confirmed', packed: 'Packed', dispatched: 'Shipped', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' }[s.orderStatus] || '—';
    return s.orderStatus === 'delivered' && s.deliveredAt ? `${w} ${dayMon(s.deliveredAt)}` : w;
  },
  noSalesTitle: 'No sales yet',
  noSalesBody: 'Each item sold through a creator\'s post appears here with its three shares.',
  commissionTitle: 'Commission',
  inWindow: 'Not added yet',
  addedSoFar: 'Added so far',
  commissionNote: 'Commission is added to your wallet after each sale is delivered and its return window closes.',
  noCommissionTitle: 'No commission yet',
  noCommissionBody: 'Each item sold through your posts appears here with your commission.',

  // BW7, BW9, CW5
  howMuch: 'How much?',
  availMin: (a, min) => `Available ${inr(a)} · minimum ${inr(min)}`,
  all: (a) => `All · ${inr(a)}`,
  sentTo: 'Sent to',
  sendItTo: 'Send it to',
  change: 'Change',
  brandExplain: (amt, h) => `INFLX pays this from its bank within ${h} hours. Until then ${amt} is on hold: it can't be used for an agreement or requested again.`,
  creatorExplain: (amt, h) => `INFLX pays this within ${h} hours. You get the full ${amt}. Until then it is on hold.`,
  request: (amt) => `Request ${amt}`,
  requestPlain: 'Request',
  requested: (amt) => `${amt} requested. It is on hold until INFLX pays it.`,
  errMin: (min, have) => `The minimum is ${inr(min)}.${have < min ? ` You have ${inr(have)} available.` : ''}`,
  errMax: (have) => `That's more than your ${inr(have)} available.`,
  addBankTitle: 'Add your bank account first',
  addDetailsTitle: 'Add where to send your money first',
  addBankBody: 'We need it to send your money.',
  addBank: 'Add bank account',
  addDetails: 'Add payment details',
  seeWithdrawals: 'Your withdrawals',

  // BW8, CW6
  withdrawalsTitle: 'Withdrawals',
  chip: { requested: ['waiting', 'Waiting'], processed: ['active', 'Processed'], could_not_process: ['declined', 'Could not process'] },
  wSub: (w) => {
    if (w.status === 'processed') return `Requested ${dayMon(w.requestedAt)} · paid ${dayMon(w.paidOn || w.processedAt)} to ${w.sendTo}`;
    if (w.status === 'could_not_process') return `Requested ${dayMon(w.requestedAt)}`;
    return `Requested ${dayMon(w.requestedAt)} · to ${w.sendTo} · within ${w.processHours} hours`;
  },
  reference: (r) => `Reference ${r}`,
  backInAvailable: (amt) => `Your ${amt} is back in Available.`,
  noWithdrawalsTitle: 'No withdrawals yet',
  noWithdrawalsBody: 'When you ask to withdraw, the request and what happened to it appear here.',

  // BW10, CW7
  historyTitle: 'History',
  brandHistoryFilters: [['all', 'All'], ['added', 'Added'], ['collaborations', 'Collaborations'], ['sales', 'Sales'], ['withdrawals', 'Withdrawals'], ['courier', 'Courier']],
  creatorHistoryFilters: [['all', 'All'], ['collaborations', 'Collaborations'], ['commission', 'Commission'], ['withdrawals', 'Withdrawals']],
  amount: (r) => `${r.sign ? `${r.sign} ` : ''}${inr(r.amount)}`,
  noHistoryTitle: 'Nothing yet',
  noHistoryBody: 'Every rupee that moves appears here.',
  more: 'Show more',
};

export const AIM17 = { engagement: 'Pay for Content', hybrid: 'Hybrid', conversion: 'Pay for Sale' };
