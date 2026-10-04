'use strict';

/**
 * offerRules — the offer builder's rules, with no database. Contract: features/offer-builder-v2
 * Rules: Docs/OFFER_TERMS_POSTS_RULES.md §1.6 (types), §1.8 (publish checks), §1.9 (status).
 *
 * Everything here is a pure function of an offer and the pool the caller resolved, so the same
 * code answers "as the brand types" (step 5) and at the moment of publishing (step 6).
 *
 * The numbers live in brand_offers.offer_config_json, one shape per sub-type:
 *   percentage { pct, max_off }                flat      { amount }
 *   bogo       { max_free }
 *   quantity   { reward:'pct'|'amount', tiers:[{ at, value }] }   (at = items)
 *   value      { reward:'pct'|'amount', tiers:[{ at, value }] }   (at = ₹ spend)
 *   pick_any / mix_match { pick, price }       fixed     { price, quantities: { productId: n } }
 *   spend      { min_spend, gift_count, gift_limits: { productId: n } }
 *   buy_x      { buy_qty,   gift_count, gift_limits: { productId: n } }
 */

const { daysBetween } = require('../utils/indiaDay');

const SUB_TYPES = {
  discount: ['percentage', 'flat'],
  bogo: ['bogo'],
  volume: ['quantity', 'value'],
  bundle: ['pick_any', 'mix_match', 'fixed'],
  free_gift: ['spend', 'buy_x'],
};
const TYPES = Object.keys(SUB_TYPES);

const TYPE_LABEL = { discount: 'Discount', bogo: 'BOGO', volume: 'Volume', bundle: 'Bundle', free_gift: 'Free gift' };
const SUB_LABEL = {
  percentage: '%', flat: 'Flat', bogo: null, quantity: 'Qty', value: 'Value',
  pick_any: 'Pick-any', mix_match: 'Mix & match', fixed: 'Fixed', spend: 'Spend', buy_x: 'Buy X get Y',
};

const MAX_TIERS = 4;
const BAND_RATIO = 1.5;        // costliest ≤ 1.5 × cheapest (pick-any, mix & match)
const MIN_SAVING = 0.10;       // the cheapest combination saves at least 10%
const SAFE_LOW = 0.80;         // suggested safe price: 80% – 90% of the cheapest combination
const SAFE_HIGH = 0.90;

// ── small words ──────────────────────────────────────────────────────────────
const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const int = (v) => { const n = num(v); return n === null ? null : Math.trunc(n); };
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const pctText = (p) => `${Number(p) % 1 === 0 ? Number(p) : Number(p).toFixed(1)}%`;
const q = (s) => `"${s}"`;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-10-01' → '1 Oct' */
function dayMonth(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(day || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : '';
}
/** '2026-10-01' → '1 Oct 2026' */
function longDay(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(day || ''));
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}
const floor100 = (n) => Math.floor(n / 100) * 100;
const round2 = (n) => Math.round(n * 100) / 100;

function typeLabel(offerType, subType) {
  const t = TYPE_LABEL[offerType] || offerType;
  const s = subType ? SUB_LABEL[subType] : null;
  return s ? `${t} · ${s}` : t;
}

function isValidSubType(offerType, subType) {
  return !!SUB_TYPES[offerType] && SUB_TYPES[offerType].includes(subType);
}

// ── the numbers: keep only what the sub-type uses ────────────────────────────
function idMap(obj, fn) {
  const out = {};
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) { const n = fn(v); if (n !== null) out[k] = n; }
  }
  return out;
}

/** Coerces and keeps only the fields the sub-type uses. Blank stays null (a draft may be partial). */
function normaliseConfig(subType, raw) {
  const c = raw && typeof raw === 'object' ? raw : {};
  switch (subType) {
    case 'percentage': return { pct: num(c.pct), max_off: num(c.max_off) };
    case 'flat': return { amount: num(c.amount) };
    case 'bogo': return { max_free: int(c.max_free) };
    case 'quantity':
    case 'value': {
      const tiers = Array.isArray(c.tiers) ? c.tiers.slice(0, MAX_TIERS + 1).map((t) => ({
        at: subType === 'quantity' ? int(t && t.at) : num(t && t.at), value: num(t && t.value),
      })) : [];
      return { reward: c.reward === 'amount' ? 'amount' : 'pct', tiers };
    }
    case 'pick_any':
    case 'mix_match': return { pick: int(c.pick), price: num(c.price) };
    case 'fixed': return { price: num(c.price), quantities: idMap(c.quantities, (v) => { const n = int(v); return n && n >= 1 ? n : null; }) };
    case 'spend': return { min_spend: num(c.min_spend), gift_count: int(c.gift_count), gift_limits: idMap(c.gift_limits, (v) => { const n = int(v); return n && n >= 1 ? n : null; }) };
    case 'buy_x': return { buy_qty: int(c.buy_qty), gift_count: int(c.gift_count), gift_limits: idMap(c.gift_limits, (v) => { const n = int(v); return n && n >= 1 ? n : null; }) };
    default: return {};
  }
}

// ── the deal, in words ───────────────────────────────────────────────────────
function tierText(subType, reward, t) {
  const r = reward === 'amount' ? `${inr(t.value)} off` : pctText(t.value);
  return subType === 'quantity' ? `Buy ${t.at} → ${r}` : `Spend ${inr(t.at)} → ${r}`;
}

/** One line for the offer list and the offer page: "20% off, max ₹400 per item". */
function dealLine(offer, poolCount = null, giftCount = null) {
  const c = normaliseConfig(offer.sub_type, offer.offer_config_json);
  switch (offer.sub_type) {
    case 'percentage':
      if (c.pct == null) return null;
      return c.max_off ? `${pctText(c.pct)} off, max ${inr(c.max_off)} per item` : `${pctText(c.pct)} off each item`;
    case 'flat': return c.amount == null ? null : `${inr(c.amount)} off per item`;
    case 'bogo': return c.max_free ? `Buy one, get the same product free · max ${c.max_free} free per order` : 'Buy one, get the same product free';
    case 'quantity':
    case 'value': {
      const ts = c.tiers.filter((t) => t.at != null && t.value != null);
      return ts.length ? ts.map((t) => tierText(offer.sub_type, c.reward, t)).join(' · ') : null;
    }
    case 'pick_any':
    case 'mix_match':
      if (c.pick == null || c.price == null) return null;
      return poolCount ? `Pick any ${c.pick} from ${poolCount} for ${inr(c.price)}` : `Any ${c.pick} for ${inr(c.price)}`;
    case 'fixed': return c.price == null ? null : `${poolCount || 'The'} items for ${inr(c.price)}`;
    case 'spend':
      if (c.min_spend == null) return null;
      return `Spend ${inr(c.min_spend)} · ${c.gift_count || 1} gift${(c.gift_count || 1) > 1 ? 's' : ''}${giftCount ? ` of ${giftCount}` : ''}`;
    case 'buy_x':
      if (c.buy_qty == null) return null;
      return `Buy ${c.buy_qty} · ${c.gift_count || 1} gift${(c.gift_count || 1) > 1 ? 's' : ''}${giftCount ? ` of ${giftCount}` : ''}`;
    default: return null;
  }
}

/** What a shopper pays for one item under a discount (null for other kinds). */
function discountedPrice(offer, price) {
  const c = normaliseConfig(offer.sub_type, offer.offer_config_json);
  const p = Number(price);
  if (offer.sub_type === 'percentage' && c.pct != null) {
    let off = (p * c.pct) / 100;
    const capped = c.max_off != null && off > c.max_off;
    if (capped) off = c.max_off;
    // Rounded to the rupee, per unit (rules 6.4): 20% off ₹999 → ₹799.
    return { pays: Math.max(0, Math.round(p - off)), capped };
  }
  if (offer.sub_type === 'flat' && c.amount != null) return { pays: round2(Math.max(0, p - c.amount)), capped: false };
  return null;
}

// ── status (rules 1.9) ───────────────────────────────────────────────────────
/**
 * draft · scheduled · live · ended. Worked out from the dates in India time; only an early end is
 * stored. `today` is 'YYYY-MM-DD'.
 */
function displayStatus(offer, today) {
  if (offer.status === 'draft') return 'draft';
  if (offer.status === 'ended') return 'ended';
  if (offer.status !== 'published') return offer.status; // old engine rows
  const s = offer.starts_on, e = offer.ends_on;
  if (s && daysBetween(today, s) > 0) return 'scheduled';
  if (e && daysBetween(e, today) > 0) return 'ended';
  return 'live';
}

// ── the numbers, as the brand types (step 5) ─────────────────────────────────
/** Problems with the numbers alone, before the pool is looked at. [{ field, text }] */
function numberProblems(subType, raw) {
  const c = normaliseConfig(subType, raw);
  const out = [];
  const need = (v, field, text) => { if (v == null) out.push({ field, text }); return v != null; };
  switch (subType) {
    case 'percentage':
      if (need(c.pct, 'pct', 'Enter the discount.') && !(c.pct > 0 && c.pct < 100)) out.push({ field: 'pct', text: 'The discount must be more than 0% and less than 100%.' });
      if (c.max_off != null && !(c.max_off > 0)) out.push({ field: 'max_off', text: 'The max ₹ off must be more than ₹0.' });
      break;
    case 'flat':
      if (need(c.amount, 'amount', 'Enter the ₹ off each item.') && !(c.amount > 0)) out.push({ field: 'amount', text: 'The ₹ off must be more than ₹0.' });
      break;
    case 'bogo':
      if (c.max_free != null && !(c.max_free >= 1)) out.push({ field: 'max_free', text: 'Max free items must be at least 1.' });
      break;
    case 'quantity':
    case 'value': {
      const ts = c.tiers;
      if (ts.length < 1 || ts.length > MAX_TIERS) { out.push({ field: 'tiers', text: `Add 1 to ${MAX_TIERS} tiers.` }); break; }
      const atWord = subType === 'quantity' ? 'quantity' : 'spend';
      ts.forEach((t, i) => {
        const n = i + 1;
        if (t.at == null || !(t.at > 0)) out.push({ field: `tiers.${i}.at`, text: `Tier ${n} needs a ${atWord} above 0.` });
        if (t.value == null || !(t.value > 0)) out.push({ field: `tiers.${i}.value`, text: `Tier ${n} needs a reward above 0.` });
        else if (c.reward === 'pct' && !(t.value < 100)) out.push({ field: `tiers.${i}.value`, text: `Tier ${n}'s reward must be less than 100%.` });
        else if (c.reward === 'amount' && subType === 'value' && t.at != null && !(t.value < t.at)) {
          out.push({ field: `tiers.${i}.value`, text: `Tier ${n}'s ₹ off must be less than its spend (${inr(t.at)}).` });
        }
        if (i > 0) {
          const p = ts[i - 1];
          if (t.at != null && p.at != null && !(t.at > p.at)) out.push({ field: `tiers.${i}.at`, text: `Tier ${n}'s ${atWord} must be bigger than tier ${i}'s.` });
          if (t.value != null && p.value != null && !(t.value > p.value)) out.push({ field: `tiers.${i}.value`, text: `Tier ${n}'s reward must be bigger than tier ${i}'s.` });
        }
      });
      break;
    }
    case 'pick_any':
    case 'mix_match':
      if (need(c.pick, 'pick', 'Enter how many the shopper picks.') && !(c.pick >= 2)) out.push({ field: 'pick', text: 'A bundle picks at least 2.' });
      if (need(c.price, 'price', 'Enter the bundle price.') && !(c.price > 0)) out.push({ field: 'price', text: 'The bundle price must be more than ₹0.' });
      break;
    case 'fixed':
      if (need(c.price, 'price', 'Enter the bundle price.') && !(c.price > 0)) out.push({ field: 'price', text: 'The bundle price must be more than ₹0.' });
      break;
    case 'spend':
      if (need(c.min_spend, 'min_spend', 'Enter the minimum spend.') && !(c.min_spend > 0)) out.push({ field: 'min_spend', text: 'The minimum spend must be more than ₹0.' });
      if (need(c.gift_count, 'gift_count', 'Enter how many gifts the shopper gets.') && !(c.gift_count >= 1)) out.push({ field: 'gift_count', text: 'The shopper gets at least 1 gift.' });
      break;
    case 'buy_x':
      if (need(c.buy_qty, 'buy_qty', 'Enter how many the shopper buys.') && !(c.buy_qty >= 1)) out.push({ field: 'buy_qty', text: 'The shopper buys at least 1.' });
      if (need(c.gift_count, 'gift_count', 'Enter how many gifts the shopper gets.') && !(c.gift_count >= 1)) out.push({ field: 'gift_count', text: 'The shopper gets at least 1 gift.' });
      break;
    default:
      out.push({ field: 'sub_type', text: 'Choose the sub-type.' });
  }
  return out;
}

// ── bundles: the band, the saving, the safe price ────────────────────────────
function cheapestCombination(prices, pick) {
  const sorted = prices.map(Number).sort((a, b) => a - b);
  if (!pick || sorted.length < pick) return null;
  return round2(sorted.slice(0, pick).reduce((s, p) => s + p, 0));
}

/** { low, high, combo } — the suggested safe bundle price, or null. */
function suggestedBundlePrice(prices, pick) {
  const combo = cheapestCombination(prices, pick);
  if (combo == null) return null;
  return { low: floor100(combo * SAFE_LOW), high: floor100(combo * SAFE_HIGH), combo };
}

/** The shopper's saving on the cheapest combination, as a fraction. */
function bundleSaving(prices, pick, price) {
  const combo = cheapestCombination(prices, pick);
  if (combo == null || !combo) return null;
  return { combo, saving: (combo - Number(price)) / combo };
}

// ── the publish checks (rules 1.8) ───────────────────────────────────────────
/**
 * @param offer   { offer_type, sub_type, starts_on, ends_on, offer_config_json }
 * @param pool    { buy: [{ id, name, price, leaf_id, leaf_name }],
 *                  gift: [{ kind:'product'|'gift_item', id, name, value, stock }],
 *                  conflicts: [{ name, offer_name, ends_on }] }   — products another offer holds
 * @param today   'YYYY-MM-DD'
 * @returns { ok, checks: [{ key, ok, text }] }
 */
function publishChecks(offer, pool, today) {
  const checks = [];
  const add = (key, ok, text) => checks.push({ key, ok: !!ok, text });
  const sub = offer.sub_type;
  const c = normaliseConfig(sub, offer.offer_config_json);
  const buy = (pool && pool.buy) || [];
  const gift = (pool && pool.gift) || [];
  const conflicts = (pool && pool.conflicts) || [];

  // Type and sub-type
  if (!isValidSubType(offer.offer_type, sub)) add('sub_type', false, 'Choose the sub-type.');

  // Name
  const name = String(offer.name || '').trim();
  add('name', !!name && name !== 'Untitled offer', name && name !== 'Untitled offer' ? 'The offer has a name' : 'Give the offer a name.');

  // Dates
  if (!offer.starts_on || !offer.ends_on) {
    add('dates', false, 'Set both the start and the end date.');
  } else {
    const after = daysBetween(offer.starts_on, offer.ends_on) > 0;
    add('dates', after, after ? 'End date is after start date' : 'The end date must be after the start date.');
    const notPassed = daysBetween(today, offer.ends_on) >= 0;
    add('not_passed', notPassed, notPassed ? 'End date hasn\'t passed' : `This offer's end date (${longDay(offer.ends_on)}) has already passed.`);
  }

  // The pool and the lock
  add('pool', buy.length > 0, buy.length > 0 ? `Pool has ${buy.length} product${buy.length > 1 ? 's' : ''}` : 'Add at least one product to the pool.');
  if (!conflicts.length) add('lock', true, 'No product is in another offer on these dates');
  else {
    for (const k of conflicts) {
      add('lock', false, `${q(k.name)} is in ${q(k.offer_name)} until ${dayMonth(k.ends_on)}. Remove it from this pool or change the dates.`);
    }
  }

  // The numbers
  for (const p of numberProblems(sub, offer.offer_config_json)) add(`numbers.${p.field}`, false, p.text);

  const prices = buy.map((b) => Number(b.price)).filter((p) => p > 0);
  const cheapest = prices.length ? Math.min(...prices) : null;
  const costliest = prices.length ? Math.max(...prices) : null;
  const cheapestItem = cheapest != null ? buy.find((b) => Number(b.price) === cheapest) : null;

  switch (sub) {
    case 'flat':
      if (c.amount != null && cheapestItem) {
        const ok = c.amount < cheapest;
        add('flat_below_cheapest', ok, ok
          ? `₹ off (${inr(c.amount)}) is less than your cheapest item (${cheapestItem.name}, ${inr(cheapest)})`
          : `Must be less than your cheapest item in the pool (${cheapestItem.name}, ${inr(cheapest)}).`);
      }
      break;
    case 'quantity':
      if (c.reward === 'amount' && cheapest != null) {
        c.tiers.forEach((t, i) => {
          if (t.at != null && t.value != null && !(t.value < t.at * cheapest)) {
            add('tier_amount', false, `Tier ${i + 1}'s ₹ off must be less than ${t.at} of your cheapest item (${inr(t.at * cheapest)}).`);
          }
        });
      }
      break;
    case 'pick_any':
    case 'mix_match': {
      if (c.pick != null) {
        const enough = buy.length >= c.pick;
        add('pool_pick', enough, enough ? `Pool has at least ${c.pick} products for "pick ${c.pick}"` : `The pool needs at least ${c.pick} products for "pick ${c.pick}".`);
      }
      if (cheapest != null && buy.length >= 2) {
        const inBand = costliest <= BAND_RATIO * cheapest;
        add('band', inBand, inBand
          ? `Price band: costliest ${inr(costliest)} ≤ 1.5 × cheapest ${inr(cheapest)}`
          : `The costliest item (${inr(costliest)}) is more than 1.5 × the cheapest (${inr(cheapest)}).`);
      }
      if (c.pick != null && c.price != null && buy.length >= c.pick) {
        const s = bundleSaving(prices, c.pick, c.price);
        const safe = suggestedBundlePrice(prices, c.pick);
        const word = c.pick === 2 ? 'pair' : `${c.pick}`;
        const ok = s.saving >= MIN_SAVING - 1e-9;
        add('saving', ok, ok
          ? `Cheapest ${word} ${inr(s.combo)} → ${inr(c.price)} saves ${Math.floor(s.saving * 100)}% (needs 10%)`
          : `The cheapest ${word} must save at least 10%. Try ${inr(safe.high)} or less.`);
      }
      if (sub === 'pick_any') {
        const leaves = [...new Map(buy.map((b) => [b.leaf_id || 'none', b.leaf_name || 'no category'])).values()];
        if (buy.length) {
          add('one_category', leaves.length === 1, leaves.length === 1
            ? `All products are from one category (${leaves[0]})`
            : `Pick-any bundles stay in one category. This pool has ${leaves.join(', ')}. For several categories, choose Mix & match.`);
        }
      }
      break;
    }
    case 'fixed': {
      const total = round2(buy.reduce((s, b) => s + Number(b.price || 0) * (c.quantities[b.id] || 1), 0));
      const units = buy.reduce((s, b) => s + (c.quantities[b.id] || 1), 0);
      add('fixed_items', units >= 2, units >= 2 ? `${units} items in the bundle` : 'A fixed bundle needs at least 2 items.');
      if (c.price != null && buy.length) {
        const ok = c.price < total;
        const save = round2(total - c.price);
        add('fixed_below_total', ok, ok
          ? `Shopper saves ${inr(save)} (${Math.round((save / total) * 100)}%). The bundle price is below the total (${inr(total)})`
          : `The bundle price must be below the total price of its items (${inr(total)}).`);
      }
      break;
    }
    case 'spend':
    case 'buy_x': {
      add('gift_pool', gift.length > 0, gift.length > 0 ? `Gift pool has ${gift.length} gift${gift.length > 1 ? 's' : ''}` : 'Add at least one gift.');
      if (c.gift_count != null && gift.length) {
        const ok = c.gift_count >= 1 && c.gift_count <= gift.length;
        add('gift_count', ok, ok ? `The shopper gets ${c.gift_count} of ${gift.length}` : `Gifts the shopper gets must be between 1 and ${gift.length}.`);
      }
      // Buy and gift pools share nothing.
      const buyIds = new Set(buy.map((b) => b.id));
      const shared = gift.filter((g) => g.kind === 'product' && buyIds.has(g.id));
      if (shared.length) for (const g of shared) add('disjoint', false, `${q(g.name)} is in both the buy pool and the gift pool.`);
      else if (gift.length) add('disjoint', true, 'The buy pool and the gift pool share no product');
      // Every gift has a stock limit.
      const limits = normaliseConfig(sub, offer.offer_config_json).gift_limits || {};
      const noLimit = gift.filter((g) => g.kind === 'product' && !limits[g.id]);
      const noStock = gift.filter((g) => g.kind === 'gift_item' && !(Number(g.stock) > 0));
      for (const g of noLimit) add('gift_limit', false, `Set a gift stock limit for ${q(g.name)}.`);
      for (const g of noStock) add('gift_limit', false, `${q(g.name)} has no stock. Restock it in Gift items.`);
      if (gift.length && !noLimit.length && !noStock.length) add('gift_limit', true, 'Every gift has a stock limit');
      // The costliest gift combination is below the minimum qualifying purchase.
      const minPurchase = sub === 'spend' ? c.min_spend : (c.buy_qty != null && cheapest != null ? c.buy_qty * cheapest : null);
      if (minPurchase != null && gift.length && c.gift_count) {
        const values = gift.map((g) => Number(g.value || 0)).sort((a, b) => b - a);
        const top = round2(values.slice(0, c.gift_count).reduce((s, v) => s + v, 0));
        const what = sub === 'spend' ? 'minimum spend' : 'minimum purchase';
        const giftWord = c.gift_count === 1 ? 'Costliest gift' : `Costliest ${c.gift_count} gifts`;
        const ok = top < minPurchase;
        add('gift_threshold', ok, ok
          ? `${giftWord} (${inr(top)}) is below the ${what} (${inr(minPurchase)})`
          : `${giftWord} (${inr(top)}) must be below the ${what} (${inr(minPurchase)}).`);
      }
      break;
    }
    case 'bogo':
      add('bogo', true, 'BOGO has no price checks');
      break;
    default: break;
  }

  return { ok: checks.every((k) => k.ok), checks };
}

/** Extra lines for step 5: the example price, the suggested safe price, the fixed total. */
function numbersHelp(offer, pool) {
  const c = normaliseConfig(offer.sub_type, offer.offer_config_json);
  const buy = (pool && pool.buy) || [];
  const prices = buy.map((b) => Number(b.price)).filter((p) => p > 0);
  const out = {};
  if ((offer.sub_type === 'percentage' || offer.sub_type === 'flat') && buy.length) {
    const top = buy.reduce((m, b) => (Number(b.price) > Number(m.price) ? b : m), buy[0]);
    const d = discountedPrice(offer, top.price);
    if (d) out.example = `${top.name} ${inr(top.price)} → shopper pays ${inr(d.pays)}${d.capped ? ` (${inr(c.max_off)} cap reached)` : ''}`;
  }
  if ((offer.sub_type === 'pick_any' || offer.sub_type === 'mix_match') && c.pick) {
    const s = suggestedBundlePrice(prices, c.pick);
    if (s) out.safe_price = s;
  }
  if (offer.sub_type === 'fixed') {
    out.total = round2(buy.reduce((s, b) => s + Number(b.price || 0) * (c.quantities[b.id] || 1), 0));
  }
  return out;
}

// ── What the CREATOR reads (Level 2, rules 2.11; creator-terms-v2 C2, C3) ──────
const pctOff = (p) => `${pctText(p)} off`;

/** The deal in her words: "20% off each item, up to ₹400" · "Shopper picks any 2 of 15". */
function creatorDeal(offer, poolCount, giftCount) {
  const c = normaliseConfig(offer.sub_type, offer.offer_config_json);
  switch (offer.sub_type) {
    case 'percentage': return c.max_off ? `${pctOff(c.pct)} each item, up to ${inr(c.max_off)}` : `${pctOff(c.pct)} each item`;
    case 'flat': return `${inr(c.amount)} off each item`;
    case 'bogo': return 'Buy one, get the same product free';
    case 'quantity':
    case 'value': return c.tiers.map((t) => (offer.sub_type === 'quantity' ? `Buy ${t.at}` : `Spend ${inr(t.at)}`)
      + ` → ${c.reward === 'amount' ? `${inr(t.value)} off` : pctOff(t.value)}`).join(' · ');
    case 'pick_any':
    case 'mix_match': return `Shopper picks any ${c.pick} of ${poolCount} for ${inr(c.price)}`;
    case 'fixed': return `The set of ${poolCount} for ${inr(c.price)}`;
    case 'spend': return `Spend ${inr(c.min_spend)}, get ${c.gift_count || 1} free gift${(c.gift_count || 1) > 1 ? 's' : ''}${giftCount > 1 ? ` of ${giftCount}` : ''}`;
    case 'buy_x': return `Buy ${c.buy_qty}, get ${c.gift_count || 1} free gift${(c.gift_count || 1) > 1 ? 's' : ''}${giftCount > 1 ? ` of ${giftCount}` : ''}`;
    default: return dealLine(offer, poolCount, giftCount) || '';
  }
}

/** "How it works for shoppers" (C3). Every offer applies within one post (rules M4). */
function shopperHow(offer, pool) {
  const c = normaliseConfig(offer.sub_type, offer.offer_config_json);
  const n = ((pool && pool.buy) || []).length;
  const g = ((pool && pool.gift) || []).length;
  const tiers = () => c.tiers.map((t) => (offer.sub_type === 'quantity' ? `buy ${t.at}` : `spend ${inr(t.at)}`)
    + ` → ${c.reward === 'amount' ? `${inr(t.value)} off` : pctOff(t.value)}`).join(', ');
  switch (offer.sub_type) {
    case 'percentage': return `Every product is ${pctText(c.pct)} off${c.max_off ? ` (at most ${inr(c.max_off)} off an item)` : ''} when bought from your post.`;
    case 'flat': return `Every product is ${inr(c.amount)} off when bought from your post.`;
    case 'bogo': return 'They buy a product from your post and get the same product free, in any size or colour.';
    case 'quantity': return `The more they buy from your post, the more they save: ${tiers()}. Tiers replace each other; they never add up.`;
    case 'value': return `The more they spend on your post's products, the more they save: ${tiers()}. Tiers replace each other; they never add up.`;
    case 'pick_any':
    case 'mix_match': return `They pick any ${c.pick} of these ${n} products from your post and pay ${inr(c.price)} together. All ${c.pick} must come from the same post.`;
    case 'fixed': return `They buy the whole set from your post for ${inr(c.price)} and only choose size and colour.`;
    case 'spend': return `They spend ${inr(c.min_spend)} on these products from your post and ${g > 1 ? `choose ${c.gift_count || 1} free gift${(c.gift_count || 1) > 1 ? 's' : ''} from ${g}` : 'get the gift free'}.`;
    case 'buy_x': return `They buy ${c.buy_qty} of these products from your post and ${g > 1 ? `choose ${c.gift_count || 1} free gift${(c.gift_count || 1) > 1 ? 's' : ''} from ${g}` : 'get the gift free'}.`;
    default: return '';
  }
}

/**
 * The same ten deals, said TO THE SHOPPER (shopper-walk-fixes · board table T; founder, 3 Oct 2026:
 * "it looks like this is saying to creator… not related to shopper or customer who is buying").
 * `shopperHow` above is the creator's sentence ("They buy… from your post") and stays hers; the
 * shopper app shows this one — on "Products in this post" and at the top of the deal page.
 */
function shopperSays(offer, pool) {
  const c = normaliseConfig(offer.sub_type, offer.offer_config_json);
  const n = ((pool && pool.buy) || []).length;
  const g = ((pool && pool.gift) || []).length;
  const count = c.gift_count || 1;
  const tiers = () => c.tiers.map((t) => (offer.sub_type === 'quantity' ? `buy ${t.at}` : `spend ${inr(t.at)}`)
    + ` → ${c.reward === 'amount' ? `${inr(t.value)} off` : pctOff(t.value)}`).join(', ');
  const gift = g > 1 ? `choose ${count} free gift${count > 1 ? 's' : ''} from ${g}` : 'get the gift free';
  switch (offer.sub_type) {
    case 'percentage': return `Every product in this post is ${pctText(c.pct)} off${c.max_off ? ` (at most ${inr(c.max_off)} off an item)` : ''}.`;
    case 'flat': return `Every product in this post is ${inr(c.amount)} off.`;
    case 'bogo': return 'Buy any product in this post and get the same one free, in any size or colour.';
    case 'quantity': return `The more you buy from this post, the more you save: ${tiers()}. Only the highest one applies.`;
    case 'value': return `The more you spend on this post's products, the more you save: ${tiers()}. Only the highest one applies.`;
    case 'pick_any':
    case 'mix_match': return `Pick any ${c.pick} of these ${n} products and pay ${inr(c.price)} for them together.`;
    case 'fixed': return `Buy the whole set for ${inr(c.price)}. You only choose size and colour.`;
    case 'spend': return `Spend ${inr(c.min_spend)} on these products and ${gift}.`;
    case 'buy_x': return `Buy ${c.buy_qty} of these products and ${gift}.`;
    default: return '';
  }
}

/**
 * What she earns on one example purchase (founder Q3: "worked out on the offer's example price,
 * labelled You earn"). Commission is on what the shopper pays (rules M3).
 * @returns { pays, earns, line } or null when there's nothing to work it out on.
 */
function exampleEarning(offer, pool, commissionPct) {
  const pct = Number(commissionPct);
  if (!(pct > 0)) return null;
  const c = normaliseConfig(offer.sub_type, offer.offer_config_json);
  const prices = ((pool && pool.buy) || []).map((b) => Number(b.price)).filter((p) => p > 0);
  if (!prices.length && !['pick_any', 'mix_match', 'fixed', 'spend', 'value'].includes(offer.sub_type)) return null;
  const top = prices.length ? Math.max(...prices) : 0;
  const low = prices.length ? Math.min(...prices) : 0;
  const t1 = c.tiers && c.tiers[0];
  let pays = null;
  switch (offer.sub_type) {
    case 'percentage':
    case 'flat': { const d = discountedPrice(offer, top); pays = d ? d.pays : null; break; }
    case 'bogo': pays = top; break;
    case 'quantity': if (t1) { const base = t1.at * low; pays = c.reward === 'amount' ? base - t1.value : base * (1 - t1.value / 100); } break;
    case 'value': if (t1) pays = c.reward === 'amount' ? t1.at - t1.value : t1.at * (1 - t1.value / 100); break;
    case 'pick_any': case 'mix_match': case 'fixed': pays = c.price; break;
    case 'spend': pays = c.min_spend; break;
    case 'buy_x': pays = c.buy_qty && low ? c.buy_qty * low : null; break;
    default: pays = null;
  }
  if (pays == null || !(pays > 0)) return null;
  pays = round2(pays);
  const earns = Math.round((pays * pct) / 100);
  return { pays, earns, line: `${pctText(pct)} of ${inr(pays)} = ${inr(earns)}` };
}

module.exports = {
  creatorDeal, shopperHow, shopperSays, exampleEarning,
  SUB_TYPES, TYPES, TYPE_LABEL, SUB_LABEL, MAX_TIERS,
  typeLabel, isValidSubType, normaliseConfig, numberProblems,
  dealLine, discountedPrice, displayStatus,
  cheapestCombination, suggestedBundlePrice, bundleSaving,
  publishChecks, numbersHelp,
  inr, dayMonth, longDay,
};
