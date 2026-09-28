// Small words shared by the offer screens. Contract: features/offer-builder-v2
// Dates arrive as 'YYYY-MM-DD' calendar days (India); they are never parsed as instants.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-01' → '1 Oct' */
export function dayMonth(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : '';
}
/** '2026-10-01' → '1 Oct 2026' */
export function longDay(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}
/** '1 Oct – 31 Oct' (year added when the two differ) */
export function span(from, to) {
  if (!from || !to) return '—';
  const y1 = String(from).slice(0, 4), y2 = String(to).slice(0, 4);
  return y1 === y2 ? `${dayMonth(from)} – ${dayMonth(to)}` : `${longDay(from)} – ${longDay(to)}`;
}
/** Add whole days to a calendar day. */
export function addDays(d, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
  if (!m) return null;
  const x = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
/** Today in India as 'YYYY-MM-DD'. */
export function todayIndia() {
  const d = new Date(Date.now() + (5 * 60 + 30) * 60000);
  return d.toISOString().slice(0, 10);
}

export const inr = (n) => (n === null || n === undefined || n === '' ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);

export const STATUS_LABEL = { live: 'Live', scheduled: 'Scheduled', draft: 'Draft', ended: 'Ended' };

export const TYPES = [
  { key: 'discount', label: 'Discount', icon: '%', hint: 'A % or ₹ off each item.', eg: "e.g. Levi's jeans 20% off" },
  { key: 'bogo', label: 'BOGO', icon: '⇆', hint: 'Buy one, get the same product free in any size or colour.' },
  { key: 'volume', label: 'Volume', icon: '▤', hint: 'Buy more, save more. Tiers by quantity or by spend.' },
  { key: 'bundle', label: 'Bundle', icon: '⊞', hint: 'Pick any 2 for ₹2,999, mix & match, or a fixed set.' },
  { key: 'free_gift', label: 'Free gift', icon: '🎁', hint: 'Spend or buy enough, get a gift.' },
];

export const SUB_TYPES = {
  discount: [
    { key: 'percentage', label: 'Percentage', hint: '20% off, with an optional max ₹ per item' },
    { key: 'flat', label: 'Flat', hint: '₹200 off each item' },
  ],
  volume: [
    { key: 'quantity', label: 'By quantity', hint: 'Buy 2 → 20%, Buy 3 → 30%' },
    { key: 'value', label: 'By value', hint: 'Spend ₹2,000 → 10%, ₹3,000 → 20%' },
  ],
  bundle: [
    { key: 'pick_any', label: 'Pick-any', hint: 'Products from one category. Any 2 jeans for ₹2,999' },
    { key: 'mix_match', label: 'Mix & match', hint: 'Several categories. Any 3 of shirts, trousers, jeans for ₹3,499' },
    { key: 'fixed', label: 'Fixed', hint: 'Exact products. Shirt + trouser + belt for ₹2,499' },
  ],
  free_gift: [
    { key: 'spend', label: 'Spend threshold', hint: 'Spend ₹3,000 on jackets → 1 free gift' },
    { key: 'buy_x', label: 'Buy X get Y', hint: 'Buy any 2 Pattu sarees → 1 free gift' },
  ],
};

export const TYPE_CHIPS = [['', 'All types'], ['discount', 'Discount'], ['bogo', 'BOGO'], ['volume', 'Volume'], ['bundle', 'Bundle'], ['free_gift', 'Free gift']];
