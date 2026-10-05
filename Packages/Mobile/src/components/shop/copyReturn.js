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
};

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
