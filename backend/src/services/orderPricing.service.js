'use strict';

/**
 * orderPricing.service.js — every price a shopper pays, and how each rupee of it splits.
 * Contract: features/shopper-ordering (S1) · rules v1.13 §6.4 (offers in the bag), §6.13 (money).
 *
 * ONE engine answers the deal page's sticky bar, the review, the bag, and Place order, so what
 * she sees is what she pays (R5). The phone never computes money.
 *
 * A GROUP is the lines of one post: the post fixes the brand, the creator's collaboration (her
 * commission %), and the offer (R1, R2). `priceGroup` is pure — no database — so every rule is
 * testable on its own; `loadContexts` reads what it needs.
 *
 * Money is worked in PAISE inside, rupees outside (CLAUDE.md: all rupees in the DB and the API).
 * Rounding (6.4): a % comes off each unit, rounded to the rupee. A shared price (bundle set,
 * volume ₹ reward) is split in proportion to normal price, each part rounded to the rupee, and the
 * leftover goes to the costliest unit, so the parts always add up. The three-way split (6.13) is
 * worked to the paisa per line; any leftover paisa is the brand's.
 */

const db = require('../config/db');
const rules = require('./offerRules');
const { todayInIndia, calendarDay } = require('../utils/indiaDay');

const inr = rules.inr;
const P = (rupees) => Math.round(Number(rupees || 0) * 100);    // rupees → paise
const R = (paise) => Math.round(paise) / 100;                    // paise → rupees
const toRupee = (paise) => Math.round(paise / 100) * 100;        // round paise to a whole rupee
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const pctText = (p) => `${Number(p) % 1 === 0 ? Number(p) : Number(p).toFixed(1)}%`;

const MAX_QTY = 5;

/* ───────────────────────────────────────────── variants (colour · size · price · stock) */

function asObj(v) {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
}
const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
const stockOf = (s) => (s && s.stock != null && s.stock !== '' && Number.isFinite(Number(s.stock)) ? Number(s.stock) : null);
const priceOf = (s) => (s && s.price != null && s.price !== '' && Number(s.price) > 0 ? Number(s.price) : null);

/** The product's choices: [{ colour, images, sizes: [{ size, stock, price }] }]. Colour null = none. */
function choicesOf(product) {
  const vj = asObj(product.variants_json);
  const out = [];
  const colors = vj && Array.isArray(vj.colors) ? vj.colors : [];
  for (const c of colors) {
    const colour = String((c && (c.color ?? c.name)) || '').trim() || null;
    const sizes = (Array.isArray(c && c.sizes) ? c.sizes : [])
      .map((s) => ({ size: String((s && (s.size ?? s.name)) || '').trim(), stock: stockOf(s), price: priceOf(s) }))
      .filter((s) => s.size);
    out.push({ colour, images: (Array.isArray(c && c.images) ? c.images : []).map((u) => (typeof u === 'string' ? u : u && u.url)).filter(Boolean), sizes });
  }
  if (!colors.length && vj && Array.isArray(vj.sizes) && vj.sizes.length) {
    out.push({ colour: null, images: [], sizes: vj.sizes.map((s) => (typeof s === 'object'
      ? { size: String(s.size ?? s.name ?? '').trim(), stock: stockOf(s), price: priceOf(s) }
      : { size: String(s).trim(), stock: null, price: null })).filter((s) => s.size) });
  }
  return out;
}

/**
 * One colour + size of a product: { ok, price, stock, needsChoice }. A product with no sizes at
 * all is one variant whose stock is `brand_products.stock` (null = not tracked, never blocks).
 */
function variantOf(product, colour, size) {
  const base = Number(product.price) || 0;
  const choices = choicesOf(product);
  const withSizes = choices.filter((c) => c.sizes.length);
  if (!withSizes.length) {
    const st = product.stock != null && product.stock !== '' ? Number(product.stock) : null;
    return { ok: true, price: base, stock: st, needsChoice: false };
  }
  if (!size) return { ok: false, needsChoice: true, price: base, stock: null };
  const colourRow = withSizes.length === 1 && !withSizes[0].colour ? withSizes[0]
    : withSizes.find((c) => same(c.colour, colour));
  if (!colourRow) return { ok: false, needsChoice: true, price: base, stock: null };
  const s = colourRow.sizes.find((x) => same(x.size, size));
  if (!s) return { ok: false, needsChoice: true, price: base, stock: null };
  return { ok: true, price: s.price || base, stock: s.stock, needsChoice: false, colour: colourRow.colour, size: s.size };
}

/* ───────────────────────────────────────────── sharing and splitting */

/**
 * Share `totalPaise` across weights, each part a whole rupee, leftover on the heaviest (6.13).
 * Returns paise per weight. Weights of 0 get 0 unless every weight is 0 (then equal parts).
 */
function shareByWeight(totalPaise, weights) {
  if (!weights.length) return [];
  const sum = weights.reduce((s, w) => s + w, 0);
  const ws = sum > 0 ? weights : weights.map(() => 1);
  const wsum = sum > 0 ? sum : weights.length;
  const parts = ws.map((w) => toRupee((totalPaise * w) / wsum));
  let top = 0;
  ws.forEach((w, i) => { if (w > ws[top]) top = i; });
  parts[top] += totalPaise - parts.reduce((s, p) => s + p, 0);
  return parts;
}

/**
 * The three shares of what she paid for a line (6.13): creator's at her collaboration %, INFLX's at
 * the admin rate, the brand the rest. To the paisa; the three always add up to `paidPaise`.
 */
function splitPaid(paidPaise, commissionPct, feePct) {
  const c = Math.round((paidPaise * (Number(commissionPct) || 0)) / 100);
  const f = Math.round((paidPaise * (Number(feePct) || 0)) / 100);
  const brand = paidPaise - c - f;
  return { commission: c, platform_fee: f, brand_net: brand };
}

/* ───────────────────────────────────────────── the engine, per group */

/**
 * @param ctx   { post_id, brand_id, live, offer: { id, offer_type, sub_type, offer_config_json } | null,
 *                offer_live, buyPool: Set<productId> | null, gifts: Map<key, gift>, products: Map<id, product>,
 *                commission_pct, fee_pct, fee_source }
 *              gift = { key, pool_item_id, kind: 'product'|'gift_item', id, name, value, image_url, left }
 * @param input [{ product_id, gift_item_id, colour, size, qty, role, price_seen, ref }]
 * @returns the priced group (see bottom).
 */
function priceGroup(ctx, input) {
  const offer = ctx.offer && ctx.offer_live ? ctx.offer : null;
  const sub = offer ? offer.sub_type : null;
  const cfg = offer ? rules.normaliseConfig(sub, offer.offer_config_json) : {};
  const inPool = (pid) => !!offer && (!ctx.buyPool || ctx.buyPool.has(pid));
  const groupProblems = [];
  if (!ctx.live) groupProblems.push({ code: 'offer_ended', text: 'No longer available with this offer' });

  // 1 · resolve every line
  const lines = input.map((l, i) => {
    const out = {
      ref: l.ref != null ? l.ref : i, product_id: l.product_id || null, gift_item_id: l.gift_item_id || null,
      colour: l.colour || null, size: l.size || null, qty: Math.trunc(Number(l.qty) || 1),
      role: l.role === 'gift' ? 'gift' : l.role === 'free' ? 'free' : 'buy',
      name: null, image_url: null, normal_unit: 0, stock: null, problems: [], pool_item_id: null, gift_kind: null,
    };
    if (!(out.qty >= 1 && out.qty <= MAX_QTY)) out.problems.push({ code: 'qty', text: `Choose 1 to ${MAX_QTY}` });
    if (out.role === 'gift') {
      const g = ctx.gifts.get(out.gift_item_id ? `g:${out.gift_item_id}` : `p:${out.product_id}`);
      if (!g) { out.problems.push({ code: 'gift_gone', text: 'This gift is no longer offered' }); return out; }
      out.name = g.name; out.image_url = g.image_url; out.pool_item_id = g.pool_item_id; out.gift_kind = g.kind;
      out.normal_unit = P(g.value);
      if (g.left != null && g.left < out.qty) out.problems.push({ code: 'gift_gone', text: 'All given' });
      if (g.kind === 'product') {
        const prod = ctx.products.get(g.id);
        if (prod) {
          const v = variantOf(prod, out.colour, out.size);
          if (v.needsChoice) out.problems.push({ code: 'choose', text: 'Choose a colour and size' });
          else { out.stock = v.stock; if (v.stock != null && v.stock < out.qty) out.problems.push({ code: 'sold_out', text: 'Sold out in this size. Change size' }); }
        }
      }
      return out;
    }
    const prod = ctx.products.get(out.product_id);
    if (!prod) { out.problems.push({ code: 'not_sold', text: 'No longer available' }); return out; }
    out.name = prod.name; out.image_url = prod.image_url;
    if (!prod.on_sale) out.problems.push({ code: 'not_sold', text: 'No longer available' });
    const v = variantOf(prod, out.colour, out.size);
    out.normal_unit = P(v.price);
    if (v.needsChoice) out.problems.push({ code: 'choose', text: 'Choose a colour and size' });
    else {
      out.stock = v.stock;
      if (v.stock != null && v.stock < out.qty) out.problems.push({ code: 'sold_out', text: v.stock > 0 ? `Only ${v.stock} left in this size` : 'Sold out in this size. Change size' });
    }
    if (l.price_seen != null && P(l.price_seen) !== out.normal_unit) {
      out.price_was = Number(l.price_seen);
      out.notes = [...(out.notes || []), { code: 'price_changed', text: `Price changed from ${inr(l.price_seen)}` }];
    }
    if (out.role === 'free' && sub !== 'bogo') out.role = 'buy';
    return out;
  });

  // 2 · units of the lines that can be priced (a blocked line is shown, never priced into a deal)
  const blocked = (l) => groupProblems.length > 0 || l.problems.length > 0;
  const units = [];
  lines.forEach((l, li) => {
    if (l.role === 'gift' || blocked(l)) return;
    for (let k = 0; k < l.qty; k++) units.push({ li, pid: l.product_id, normal: l.normal_unit, role: l.role, pool: inPool(l.product_id), paid: l.normal_unit, deal: null });
  });
  const poolUnits = units.filter((u) => u.pool);
  const normalOfPool = poolUnits.reduce((s, u) => s + u.normal, 0);

  let progress = null;         // { text, done, next }
  let dealProblems = [];
  let giftState = null;
  // shopper-deal-orders (C5): the bag's sentence for items of this post that are in no completed
  // deal — what completing the offer would give her. Null when nothing is outside a deal.
  let aloneNudge = null;

  // 3 · the offer
  switch (sub) {
    case 'percentage':
    case 'flat':
      for (const u of poolUnits) {
        const d = rules.discountedPrice(offer, R(u.normal));
        if (d) u.paid = P(d.pays);
      }
      break;

    case 'bogo': {
      // Every paid unit may take one free unit of the same product, up to max_free (6.4).
      const maxFree = cfg.max_free || Infinity;
      let freeLeft = maxFree;
      const byProduct = new Map();
      for (const u of poolUnits) { if (!byProduct.has(u.pid)) byProduct.set(u.pid, []); byProduct.get(u.pid).push(u); }
      let pairNo = 0;
      for (const [, us] of byProduct) {
        const paid = us.filter((u) => u.role !== 'free');
        const free = us.filter((u) => u.role === 'free');
        free.forEach((u, i) => {
          if (i < paid.length && freeLeft > 0) {
            pairNo += 1; freeLeft -= 1;
            u.paid = 0; u.deal = `pair-${pairNo}`; paid[i].deal = `pair-${pairNo}`;
          } else {
            u.role = 'buy';                      // a free unit with nothing to pair: it pays
            dealProblems.push({ code: 'free_unpaired', text: i >= paid.length ? 'Each free one needs one you pay for' : `At most ${plural(maxFree, 'free item')} per order` });
          }
        });
      }
      progress = pairNo ? { text: `${plural(pairNo, 'pair')}${Number.isFinite(maxFree) ? ` · up to ${maxFree} free` : ''}`, done: true }
        : { text: 'Pick one to pay for and its free one', done: false };
      break;
    }

    case 'quantity':
    case 'value': {
      const tiers = (cfg.tiers || []).filter((t) => t.at != null && t.value != null).sort((a, b) => a.at - b.at);
      const measure = sub === 'quantity' ? poolUnits.length : R(normalOfPool);
      const reached = tiers.filter((t) => measure >= t.at).pop() || null;
      const next = tiers.find((t) => measure < t.at) || null;
      const reward = (t) => (cfg.reward === 'amount' ? `${inr(t.value)} off` : `${pctText(t.value)} off`);
      if (reached) {
        for (const u of poolUnits) u.deal = 'volume';
        if (cfg.reward === 'amount') {
          const offP = Math.min(P(reached.value), normalOfPool);
          const shares = shareByWeight(offP, poolUnits.map((u) => u.normal));
          poolUnits.forEach((u, i) => { u.paid = Math.max(0, u.normal - shares[i]); });
        } else {
          for (const u of poolUnits) u.paid = toRupee(u.normal * (1 - reached.value / 100));
        }
      }
      const now = sub === 'quantity' ? `${plural(poolUnits.length, 'item')}` : `${inr(R(normalOfPool))} spent`;
      const nextText = next ? (sub === 'quantity' ? `${next.at - poolUnits.length} more → ${reward(next)}` : `Spend ${inr(next.at - R(normalOfPool))} more → ${reward(next)}`) : null;
      progress = { text: reached ? `${now} · ${reward(reached)}` : now, done: !!reached, next: nextText, tier: reached ? reached.at : null };
      break;
    }

    case 'pick_any':
    case 'mix_match': {
      const pick = cfg.pick || 0;
      const price = P(cfg.price);
      const sorted = [...poolUnits].sort((a, b) => b.normal - a.normal);   // costliest fill sets first
      const sets = pick ? Math.floor(sorted.length / pick) : 0;
      let saved = 0;
      for (let s = 0; s < sets; s++) {
        const us = sorted.slice(s * pick, (s + 1) * pick);
        const normal = us.reduce((x, u) => x + u.normal, 0);
        const setPrice = Math.min(price, normal);
        saved += normal - setPrice;
        shareByWeight(setPrice, us.map((u) => u.normal)).forEach((p, i) => { us[i].paid = p; us[i].deal = `set-${s + 1}`; });
      }
      const rest = pick ? sorted.length % pick : 0;
      if (pick && sorted.length && !sets) aloneNudge = `Add ${pick - sorted.length} more from this post and get all ${pick} for ${inr(cfg.price)}`;
      else if (pick && rest) aloneNudge = `Add ${pick - rest} more to complete another set of ${pick} for ${inr(cfg.price)}`;
      if (!sets) progress = { text: `${poolUnits.length} of ${pick} picked`, done: false, next: `Pick ${pick - poolUnits.length} more to complete the set` };
      else if (rest) progress = { text: `${plural(sets, 'set')} complete`, done: true, next: `Add ${pick - rest} more to complete another set of ${pick} for ${inr(cfg.price)}` };
      else progress = { text: `${sets > 1 ? `${sets} sets complete` : 'Set complete'} · you save ${inr(R(saved))}`, done: true };
      break;
    }

    case 'fixed': {
      // Sold only whole (6.4): each set = every product × its quantity.
      const need = new Map();
      const qs = cfg.quantities || {};
      for (const pid of (ctx.buyPool ? [...ctx.buyPool] : [])) need.set(pid, Number(qs[pid]) || 1);
      const have = new Map();
      for (const u of poolUnits) { if (!have.has(u.pid)) have.set(u.pid, []); have.get(u.pid).push(u); }
      const sets = need.size ? Math.min(...[...need].map(([pid, n]) => Math.floor(((have.get(pid) || []).length) / n))) : 0;
      const setUnits = [];
      for (let s = 0; s < sets; s++) {
        const us = [];
        for (const [pid, n] of need) us.push(...have.get(pid).slice(s * n, (s + 1) * n));
        setUnits.push(us);
        const normal = us.reduce((x, u) => x + u.normal, 0);
        shareByWeight(Math.min(P(cfg.price), normal), us.map((u) => u.normal)).forEach((p, i) => { us[i].paid = p; us[i].deal = `set-${s + 1}`; });
      }
      const inSets = new Set(setUnits.flat());
      const outside = poolUnits.filter((u) => !inSets.has(u));
      if (cfg.pieces_alone) {
        // C3: the brand lets a piece be bought alone — it pays its normal price (already so) and
        // blocks nothing. Whole sets among her picks still cost the set's price.
        const setSize = [...need.values()].reduce((x, n) => x + n, 0);
        if (outside.length && setSize) aloneNudge = `Take the whole set of ${setSize} and pay ${inr(cfg.price)}`;
      } else if (outside.length || !sets) {
        dealProblems.push({ code: 'incomplete_set', text: 'Sold only as the whole set' });
      }
      const chosen = [...need.keys()].filter((pid) => (have.get(pid) || []).length >= need.get(pid) * Math.max(1, sets)).length;
      progress = sets ? { text: `${plural(sets, 'set')}`, done: true } : { text: `${chosen} of ${need.size} chosen`, done: false };
      break;
    }

    case 'spend':
    case 'buy_x': {
      const count = cfg.gift_count || 1;
      const reached = sub === 'spend' ? R(normalOfPool) >= (cfg.min_spend || Infinity) : poolUnits.length >= (cfg.buy_qty || Infinity);
      const giftLines = lines.filter((l) => l.role === 'gift');
      const available = [...ctx.gifts.values()].filter((g) => g.left == null || g.left > 0);
      // One gift in the pool is added by itself when she reaches it (G5).
      if (reached && !giftLines.length && ctx.gifts.size === 1 && available.length === 1) {
        const g = available[0];
        const needsSize = g.kind === 'product' && ctx.products.get(g.id) && choicesOf(ctx.products.get(g.id)).some((c) => c.sizes.length);
        if (!needsSize) {
          lines.push({ ref: 'auto-gift', product_id: g.kind === 'product' ? g.id : null, gift_item_id: g.kind === 'gift_item' ? g.id : null,
            colour: null, size: null, qty: 1, role: 'gift', name: g.name, image_url: g.image_url, normal_unit: P(g.value),
            stock: null, problems: [], pool_item_id: g.pool_item_id, gift_kind: g.kind, auto: true });
        }
      }
      const gifts = lines.filter((l) => l.role === 'gift');
      const giftQty = gifts.reduce((s, l) => s + l.qty, 0);
      if (!reached) for (const l of gifts) l.problems.push({ code: 'gift_locked', text: 'Unlocks when you reach the offer' });
      else if (giftQty > count) for (const l of gifts) l.problems.push({ code: 'too_many_gifts', text: `Choose ${count} gift${count > 1 ? 's' : ''}` });
      const short = sub === 'spend' ? `spend ${inr(Math.max(0, (cfg.min_spend || 0) - R(normalOfPool)))} more to unlock your gift`
        : `pick ${Math.max(0, (cfg.buy_qty || 0) - poolUnits.length)} more to unlock your gift`;
      const now = sub === 'spend' ? `${inr(R(normalOfPool))} of ${inr(cfg.min_spend)}` : `${poolUnits.length} of ${cfg.buy_qty} bought`;
      progress = reached ? { text: giftQty ? 'Gift unlocked' : `Gift unlocked · choose ${count}`, done: true } : { text: `${now} · ${short}`, done: false };
      giftState = { state: !reached ? 'locked' : giftQty ? 'chosen' : available.length ? 'choose' : 'given_out', count, available: available.length };
      for (const u of poolUnits) if (reached) u.deal = 'gift-deal';
      for (const l of gifts) l.deal = 'gift';
      break;
    }
    default: break;
  }

  // 4 · back to lines: units of one line with one deal key become one priced line
  const priced = [];
  lines.forEach((l, li) => {
    const base = {
      ref: l.ref, product_id: l.product_id, gift_item_id: l.gift_item_id, pool_item_id: l.pool_item_id, gift_kind: l.gift_kind,
      name: l.name, image_url: l.image_url, colour: l.colour, size: l.size, role: l.role,
      normal_unit: R(l.normal_unit), stock: l.stock, problems: l.problems, notes: l.notes || [], price_was: l.price_was, auto: !!l.auto,
    };
    if (l.role === 'gift') {
      priced.push({ ...base, qty: l.qty, deal_key: 'gift', normal_total: R(l.normal_unit * l.qty), paid_total: 0,
        commission: 0, platform_fee: 0, brand_net: 0 });
      return;
    }
    const mine = units.filter((u) => u.li === li);
    if (!mine.length) {
      priced.push({ ...base, qty: l.qty, deal_key: null, normal_total: R(l.normal_unit * l.qty), paid_total: R(l.normal_unit * l.qty),
        commission: 0, platform_fee: 0, brand_net: 0 });
      return;
    }
    const byDeal = new Map();
    for (const u of mine) { const k = `${u.deal || ''}|${u.role}`; if (!byDeal.has(k)) byDeal.set(k, []); byDeal.get(k).push(u); }
    for (const [, us] of byDeal) {
      const paid = us.reduce((s, u) => s + u.paid, 0);
      const split = splitPaid(paid, ctx.commission_pct, ctx.fee_pct);
      priced.push({ ...base, role: us[0].role, qty: us.length, deal_key: us[0].deal, normal_total: R(us.length * l.normal_unit), paid_total: R(paid),
        commission: R(split.commission), platform_fee: R(split.platform_fee), brand_net: R(split.brand_net) });
    }
  });

  const counted = priced.filter((l) => l.role !== 'gift' && !l.problems.length && !groupProblems.length);
  const normal = counted.reduce((s, l) => s + P(l.normal_total), 0);
  const paid = counted.reduce((s, l) => s + P(l.paid_total), 0);
  const problems = [...groupProblems, ...dealProblems];
  const buyable = !problems.length && priced.length > 0 && priced.every((l) => !l.problems.length) && counted.length > 0;
  return {
    post_id: ctx.post_id, brand_id: ctx.brand_id,
    // `alone`: one product of this offer may be bought on its own (rules.aloneAllowed) — the bag then
    // shows what is outside a completed deal as ordinary rows.
    offer: ctx.offer ? { id: ctx.offer.id, type: ctx.offer.offer_type, sub_type: ctx.offer.sub_type, line: rules.dealLine(ctx.offer), alone: !!offer && rules.aloneAllowed(offer) } : null,
    lines: priced,
    normal_total: R(normal), paid_total: R(paid), savings: R(normal - paid),
    gift_value: R(priced.filter((l) => l.role === 'gift' && !l.problems.length).reduce((s, l) => s + P(l.normal_total), 0)),
    progress, gift: giftState, problems, buyable, alone_nudge: aloneNudge,
    commission_pct: Number(ctx.commission_pct) || 0, fee_pct: Number(ctx.fee_pct) || 0, fee_source: ctx.fee_source || null,
  };
}

/**
 * shopper-deal-orders (B1, B4): what ONE unit of a product costs when it is the only thing she has
 * from the post — the amount "Buy this alone · ₹X" must say. Asked of the engine itself, so it is
 * what the bag and Place order will charge. It is the normal price for a bundle, a set, buy one get
 * one and a gift offer; a buy-more ladder whose first step is "buy 1" already lowers it.
 * `normal` is that unit's own normal price in rupees (a size can have its own).
 */
function aloneUnitPrice(ctx, productId, normal) {
  const p = ctx.products.get(productId);
  if (!p) return Number(normal);
  const one = new Map([[productId, { ...p, price: Number(normal), variants_json: null, stock: null, on_sale: true }]]);
  const g = priceGroup({ ...ctx, live: true, products: one }, [{ product_id: productId, qty: 1 }]);
  const l = g.lines.find((x) => x.role !== 'gift' && x.product_id === productId);
  return l && !l.problems.length ? l.paid_total : Number(normal);
}

/* ───────────────────────────────────────────── what the engine needs, from the database */

/** INFLX's rate for a sale through a creator's post (6.13): the brand's own rate, else its category's Path B. */
async function feeRatesFor(brandIds, conn = db) {
  const pricing = require('./pricing.service');
  const out = new Map();
  for (const id of [...new Set(brandIds)]) out.set(id, await pricing.feeRateForPostSale(conn, id));
  return out;
}

/**
 * Everything `priceGroup` needs for these posts. Posts that are not live come back with
 * live=false (their lines then say "No longer available with this offer").
 * @returns Map<postId, ctx>
 */
async function loadContexts(postIds, conn = db, today = todayInIndia()) {
  const ids = [...new Set((postIds || []).filter(Boolean))];
  const out = new Map();
  if (!ids.length) return out;
  const shopperPosts = require('./shopperPosts.service');
  const live = new Set((await shopperPosts.livePool({ ids, limit: ids.length, today })).map((p) => p.id));

  const { rows: posts } = await conn.query(
    `SELECT cp.id, cp.brand_id, cp.offer_id, cp.post_kind, cp.campaign_influencer_id, cp.influencer_id, cp.own_brand,
            ci.commission_pct, cs.campaign_id, ci.set_id
       FROM creator_posts cp
       -- item 20: a post for the creator's own brand has no collaboration (loose joins); it is
       -- priced with no commission, and its offer is the brand's own.
       LEFT JOIN campaign_influencers ci ON ci.id = cp.campaign_influencer_id
       LEFT JOIN campaign_sets cs ON cs.id = ci.set_id
      WHERE cp.id = ANY($1::uuid[]) AND cp.v2`, [ids]);
  const offerIds = [...new Set(posts.map((p) => p.offer_id).filter(Boolean))];
  const { rows: offers } = offerIds.length ? await conn.query(`SELECT * FROM brand_offers WHERE id = ANY($1::uuid[])`, [offerIds]) : { rows: [] };
  const offerById = new Map(offers.map((o) => [o.id, o]));
  const { rows: links } = posts.length ? await conn.query(
    `SELECT campaign_influencer_id, offer_id FROM collab_offers
      WHERE campaign_influencer_id = ANY($1::uuid[]) AND dropped_at IS NULL`, [posts.map((p) => p.campaign_influencer_id).filter(Boolean)]) : { rows: [] };
  const linked = new Set(links.map((l) => `${l.campaign_influencer_id}|${l.offer_id}`));
  const { rows: poolRows } = offerIds.length ? await conn.query(
    `SELECT i.id, i.offer_id, i.pool, i.product_id, i.gift_item_id, i.gift_limit, i.gifts_given,
            gi.name AS g_name, gi.value AS g_value, gi.stock AS g_stock, gi.photo_url AS g_photo,
            bp.name AS p_name, bp.price AS p_price, bp.image_url AS p_image
       FROM offer_pool_items i
       LEFT JOIN gift_items gi ON gi.id = i.gift_item_id
       LEFT JOIN brand_products bp ON bp.id = i.product_id
      WHERE i.offer_id = ANY($1::uuid[]) AND i.removed_at IS NULL`, [offerIds]) : { rows: [] };
  const { rows: prodRows } = await conn.query(
    `SELECT pp.post_id, bp.id, bp.name, bp.price, bp.image_url, bp.variants_json, bp.stock, bp.category_node_id,
            bp.description, bp.facets, (bp.is_active AND bp.pushed_to_store) AS on_sale
       FROM post_products pp JOIN brand_products bp ON bp.id = pp.product_id
      WHERE pp.post_id = ANY($1::uuid[])`, [ids]);
  const giftProductIds = poolRows.filter((r) => r.pool === 'gift' && r.product_id).map((r) => r.product_id);
  const { rows: giftProds } = giftProductIds.length ? await conn.query(
    `SELECT id, name, price, image_url, variants_json, stock, category_node_id, description, facets,
            (is_active AND pushed_to_store) AS on_sale FROM brand_products WHERE id = ANY($1::uuid[])`, [giftProductIds]) : { rows: [] };
  const fees = await feeRatesFor(posts.map((p) => p.brand_id), conn);
  const offerLiveToday = (o) => o && rules.displayStatus({ ...o, starts_on: calendarDay(o.starts_on), ends_on: calendarDay(o.ends_on) }, today) === 'live';

  for (const p of posts) {
    const o = p.offer_id ? offerById.get(p.offer_id) : null;
    // The offer applies when it is one this post may promise: linked to its collaboration, or — for
    // an own-brand post (item 20) — an offer of the very brand the post is for.
    const mayUse = !!o && (p.own_brand ? o.brand_id === p.brand_id : linked.has(`${p.campaign_influencer_id}|${o.id}`));
    const offerLive = !!o && o.engine === 2 && offerLiveToday(o) && mayUse;
    const products = new Map();
    for (const r of prodRows) if (r.post_id === p.id) products.set(r.id, { ...r, price: Number(r.price) || 0 });
    for (const r of giftProds) if (!products.has(r.id)) products.set(r.id, { ...r, price: Number(r.price) || 0, gift_only: true });
    const pool = poolRows.filter((r) => o && r.offer_id === o.id);
    const buyPool = o ? new Set(pool.filter((r) => r.pool === 'buy').map((r) => r.product_id)) : null;
    const gifts = new Map();
    for (const r of pool.filter((x) => x.pool === 'gift')) {
      const given = Number(r.gifts_given) || 0;
      if (r.gift_item_id) {
        const left = Math.max(0, Number(r.g_stock) || 0);
        gifts.set(`g:${r.gift_item_id}`, { key: `g:${r.gift_item_id}`, pool_item_id: r.id, kind: 'gift_item', id: r.gift_item_id,
          name: r.g_name, value: Number(r.g_value) || 0, image_url: r.g_photo || null, left });
      } else {
        const limitLeft = r.gift_limit != null ? Math.max(0, Number(r.gift_limit) - given) : null;
        gifts.set(`p:${r.product_id}`, { key: `p:${r.product_id}`, pool_item_id: r.id, kind: 'product', id: r.product_id,
          name: r.p_name, value: Number(r.p_price) || 0, image_url: r.p_image || null, left: limitLeft });
      }
    }
    const fee = fees.get(p.brand_id) || { fee_pct: 0, source: null };
    out.set(p.id, {
      post_id: p.id, brand_id: p.brand_id, live: live.has(p.id) && (p.post_kind !== 'offer' || offerLive),
      offer: o ? { ...o, offer_config_json: o.offer_config_json || {} } : null, offer_live: offerLive,
      buyPool, gifts, products,
      campaign_influencer_id: p.campaign_influencer_id, influencer_id: p.influencer_id,
      campaign_id: p.campaign_id, set_id: p.set_id,
      // item 20 (O6): a sale through a post for the creator's own brand carries no commission.
      commission_pct: p.own_brand || p.commission_pct == null ? 0 : Number(p.commission_pct),
      own_brand: !!p.own_brand,
      fee_pct: fee.fee_pct, fee_source: fee.source,
    });
  }
  for (const id of ids) if (!out.has(id)) out.set(id, { post_id: id, brand_id: null, live: false, offer: null, offer_live: false, buyPool: null, gifts: new Map(), products: new Map(), commission_pct: 0, fee_pct: 0 });
  return out;
}


/**
 * Price a whole bag (or a checkout): lines grouped by post, each group through the engine.
 * `lines` = [{ post_id, product_id, gift_item_id, colour, size, qty, role, price_seen, ticked, ref }].
 * Unticked lines are returned as they are, never priced into a deal (6.6).
 */
async function priceLines(lines, conn = db) {
  const all = Array.isArray(lines) ? lines : [];
  const ticked = all.filter((l) => l.ticked !== false);
  const ctxs = await loadContexts(all.map((l) => l.post_id), conn);
  const byPost = new Map();
  for (const l of ticked) { if (!byPost.has(l.post_id)) byPost.set(l.post_id, []); byPost.get(l.post_id).push(l); }
  const groups = [];
  for (const [postId, ls] of byPost) {
    const ctx = ctxs.get(postId);
    const g = priceGroup(ctx, ls);
    g.campaign_influencer_id = ctx.campaign_influencer_id || null;
    g.influencer_id = ctx.influencer_id || null;
    g.campaign_id = ctx.campaign_id || null;
    g.set_id = ctx.set_id || null;
    groups.push(g);
  }
  const P2 = (n) => P(n);
  const normal = groups.reduce((s, g) => s + P2(g.normal_total), 0);
  const paid = groups.reduce((s, g) => s + P2(g.paid_total), 0);
  return {
    groups,
    // Unticked items stay in the bag (6.6): shown with their name, photo and normal price, each on
    // its own, never counted into a deal.
    unticked: all.filter((l) => l.ticked === false).map((l) => {
      const one = priceGroup(ctxs.get(l.post_id), [{ ...l, ticked: true }]).lines[0] || {};
      return { ...l, name: one.name || null, image_url: one.image_url || null, normal_unit: one.normal_unit || 0, problems: one.problems || [] };
    }),
    items_normal: R(normal), savings: R(normal - paid), items_total: R(paid),
    buyable: groups.length > 0 && groups.every((g) => g.buyable),
    contexts: ctxs,
  };
}

module.exports = {
  MAX_QTY, priceGroup, priceLines, loadContexts, splitPaid, shareByWeight, choicesOf, variantOf, aloneUnitPrice, P, R,
};
