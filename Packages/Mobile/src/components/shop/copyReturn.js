/**
 * Every sentence of the shopper's Return, in one place.
 * Contract: features/shopper-walk-fixes · 01-spec.md W14 (founder, 4 Oct 2026: "build return option
 * for shopper as well… no need to draw screens now for return") · rules v1.18 §6.16.
 *
 * No board was drawn for these two screens: they are the Cancel screens (shopper-ordering O15–O17)
 * with Return's words, so they look and behave as the screens she already knows.
 * The reasons, the refund sentence and "how it works" come from the server; nothing here states a
 * number of days — the window is INFLX's admin setting, and the server says until when.
 */
import { CO, dayLabel } from './copyOrder';

export const CR = {
  // My orders
  filter: ['returned', 'Returned'],
  // Order details
  returnItem: 'Return',
  // shopper-deal-orders · O4: a deal goes back as one. ("Return or replace" comes with replacing one item.)
  returnDeal: 'Return deal',
  openUntil: (when) => `You can return this until ${when}.`,
  head: 'RETURN',
  box: {
    requested: 'INFLX is looking at your return. You will be told here.',
    approved: 'The store will collect the item. Your refund follows when it is back.',
    received: 'The item is back with the store. Your refund is next.',
    rejected: 'INFLX did not accept this return. The order stays as it is.',
    refunded: 'The item went back to the store.',
  },
  yourReason: (reason, note) => `Your reason: ${reason}${note ? ` — ${note}` : ''}`,
  askedOn: (d) => `Asked on ${d}`,
  inflxNote: (note) => `INFLX: ${note}`,
  // The money, by what happened to it
  refund: {
    manual: (v) => `You paid cash, so INFLX sends your refund of ${v} to you directly.`,
  },
  // The Return screen
  title: 'Return',
  why: 'Why are you returning it?',
  writeNote: 'Write a note',
  refundHead: 'REFUND',
  confirm: 'Request return',
  // After she asks
  requested: 'Return requested',

  // shopper-deal-orders · R1–R8: one item of a deal is not right
  returnOrReplace: 'Return or replace',
  oneItem: 'One item is not right',
  oneItemSub: 'Replace it. The deal stays.',
  wholeDeal: 'Return the whole deal',
  wholeDealSub: (n, amount) => `All ${n} items go back. Refund of ${amount}.`,
  whichItem: 'Which item?',
  whatWrong: 'What is wrong with it?',
  next: 'Continue',
  // `gone`: the sizes that are sold out — a list, or one size
  sizesHint: (have, gone) => {
    const out = [].concat(gone || []).filter(Boolean);
    return [have ? `${have} is the one you have.` : null, out.length ? `${out.join(', ')} ${out.length === 1 ? 'is' : 'are'} sold out.` : null].filter(Boolean).join(' ');
  },
  replacement: (what) => `Replacement: ${what}.`,
  dealStays: 'The deal stays and no money moves.',
  storeBrings: (size) => (size ? `The store brings it and collects the ${size}.` : 'The store brings it and collects the other.'),
  requestReplacement: 'Request replacement',
  sameItem: 'Replace with the same item',
  inStock: 'In stock',
  tellUs: 'Tell us what is wrong',
  sameHint: 'The deal stays and no money moves. The store brings it and collects the other.',
  noMore: 'The store has no more of this.',
  shareRefund: (amount) => `INFLX refunds this item's share: ${amount}. You keep the rest of the deal.`,
  storeCollects: 'The store collects it.',
  youKeep: 'You keep',
  requestRefundItem: 'Request refund for this item',
  noOtherSize: 'No other size is in stock.',
  keepOrReturn: 'You can keep it, or return the whole deal.',
  replacedOnce: 'This item has already been replaced once.',
  pairTogether: 'A pair goes back together.',
  lookingAtIt: 'INFLX is looking at it.',
  // R8 — the box on the deal's page, by kind of request
  heads: { return: 'RETURN', replace: 'REPLACEMENT', refund_item: 'REFUND' },
  itemState: { returned: 'Returned', cancelled: 'Cancelled' },
};

/**
 * R8 — what her request is doing, in one sentence, by its kind and where it stands. The names, sizes
 * and amounts are the server's (`back.replace`, `back.amount`); `day` formats a date, `money` an amount.
 */
export function boxLine(back, { day = (v) => v, money = (v) => v } = {}) {
  const kind = back.kind || 'return';
  if (kind === 'replace') {
    const r = back.replace || {};
    const from = r.from || {}; const to = r.to || {};
    const sizeMoved = (to.size || null) !== (from.size || null);
    const colourMoved = (to.colour || null) !== (from.colour || null);
    const what = [r.name, colourMoved ? to.colour : null, sizeMoved ? to.size : null].filter(Boolean).join(' · ') || 'the replacement';
    const other = sizeMoved && from.size ? `the ${from.size}` : colourMoved && from.colour ? `the ${from.colour} one` : 'the other';
    const again = !sizeMoved && !colourMoved;
    if (back.status === 'requested') return CR.lookingAtIt;
    if (back.status === 'approved') {
      if (r.state === 'sent') return again ? `The store is bringing another ${r.name || 'one'} and will collect this one.` : `The store is bringing ${what} and will collect ${other}.`;
      return again ? `The store will bring another ${r.name || 'one'} and collect this one.` : `The store will bring ${what} and collect ${other}.`;
    }
    if (back.status === 'replaced') return `${again ? r.name || 'Your item' : what} delivered${r.delivered_at ? ` ${day(r.delivered_at)}` : ''}.`;
    if (back.status === 'rejected') return back.sold_out ? 'Your order stays as it is.' : 'INFLX did not accept this replacement. Your order stays as it is.';
    return '';
  }
  if (kind === 'refund_item') {
    const amount = back.amount != null ? money(back.amount) : null;
    if (back.status === 'requested') return CR.lookingAtIt;
    if (back.status === 'approved' || back.status === 'received') return `The store will collect the item. Your refund${amount ? ` of ${amount}` : ''} follows when it is back. You keep the rest of the deal.`;
    if (back.status === 'refunded') return 'The item went back to the store. You keep the rest of the deal.';
    if (back.status === 'rejected') return 'INFLX did not accept this refund. Your order stays as it is.';
    return '';
  }
  return CR.box[back.status] || '';
}

/** What happened to the money of a cancelled or returned item — one sentence, or null. */
export function refundWords(refund, money) {
  if (!refund) return null;
  const v = money(refund.amount);
  if (refund.status === 'issued' || refund.status === 'pending') return CO.refundOnWay(v);
  if (refund.status === 'manual') return CR.refund.manual(v);
  if (refund.status === 'not_needed') return CO.noRefund;
  return CO.refundFailed;
}

/** An exact moment → 'Sat, 11 Oct, 4:30 pm' — a window set in hours closes at a time, not on a day. */
export function untilLabel(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const m = d.getMinutes();
  return `${dayLabel(d.toISOString())}, ${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`;
}
