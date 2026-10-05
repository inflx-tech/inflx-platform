'use strict';

/**
 * shopperOrders.service.js — the deal page's data, my orders, cancelling, and the brand's parcels.
 * Contract: features/shopper-ordering (S2, S8, S9, S10) · rules v1.13 §6.5, §6.11–6.14.
 *
 * Cancelling (6.12) undoes an item completely, in one transaction: the item (and the rest of its
 * deal, and a gift that no longer qualifies) is cancelled, its stock goes back, the creator's share
 * leaves her pending earnings (the return claw-back's own columns and ledger), INFLX's share is not
 * taken, the brand is not paid for it. Then an online payment is refunded for exactly what was paid
 * for those items; cash on delivery has nothing to refund.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const pricing = require('./orderPricing.service');
const stock = require('./stock.service');
const rules = require('./offerRules');
const txService = require('./transaction.service');
const notificationService = require('./notification.service');
const { appendInfluencerLedger } = require('./ledger.service');
const brandProducts = require('./brandProducts.service');
const productDetails = require('./productDetails.service');
const returnWindow = require('./returnWindow.service');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const inr = rules.inr;
const P = pricing.P;
const R = pricing.R;
const notFound = (m = 'Not found') => new AppError('NOT_FOUND', m, 404);

const REASONS = [
  'Incorrect size ordered', 'Not needed any more', 'Ordered by mistake', 'Want a different style or colour',
  'Delivery is taking too long', 'Found a better price', 'Other',
];
const STATUS_WORD = { confirmed: 'Confirmed', packed: 'Packed', dispatched: 'Shipped', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled' };
const FORWARD = ['confirmed', 'packed', 'dispatched', 'out_for_delivery', 'delivered'];
const CANCELLABLE = new Set(['confirmed', 'packed']);
const TOGETHER = /^(pair|set)-\d+$|^volume$/;         // deal items that cancel together (6.12)

/* ───────────────────────────────────────────── the deal page (S2) */

async function dealPage(postId, who = {}) {
  if (!UUID.test(String(postId || ''))) throw notFound('This post is no longer in the shop');
  const ctx = (await pricing.loadContexts([postId])).get(postId);
  if (!ctx || !ctx.live) throw notFound('This post is no longer in the shop');
  const card = await require('./shopperPosts.service').one(postId, who);
  const offer = ctx.offer_live ? ctx.offer : null;
  const cfg = offer ? rules.normaliseConfig(offer.sub_type, offer.offer_config_json) : {};
  const leafIds = [...new Set([...ctx.products.values()].map((p) => p.category_node_id).filter(Boolean))];
  const { rows: leaves } = leafIds.length ? await db.query(`SELECT id, name FROM category_nodes WHERE id = ANY($1::uuid[])`, [leafIds]) : { rows: [] };
  const leafName = new Map(leaves.map((l) => [l.id, l.name]));
  // shopper-walk-fixes (O3): everything the brand entered when listing, in one fixed order.
  const [defs, paths] = await Promise.all([productDetails.definitions(), productDetails.categoryPaths(leafIds)]);

  const productOut = (p) => {
    const colours = pricing.choicesOf(p).map((c) => ({
      colour: c.colour, images: c.images,
      // shopper-app-fixes (F10): a size that has its own price says what she pays for THAT size —
      // the phone showed the product's base price and the bag then said "Price changed".
      sizes: c.sizes.map((s) => {
        const normal = s.price || Number(p.price);
        const off = offer && offer.offer_type === 'discount' ? rules.discountedPrice(offer, normal) : null;
        return { size: s.size, price: normal, shopper_price: off ? off.pays : normal,
          left: s.stock != null && s.stock <= 3 ? Math.max(0, s.stock) : null, sold_out: s.stock != null && s.stock <= 0 };
      }),
    }));
    const soldOut = colours.length ? colours.every((c) => c.sizes.length && c.sizes.every((s) => s.sold_out)) : (p.stock != null && Number(p.stock) <= 0);
    const discounted = offer && offer.offer_type === 'discount' ? rules.discountedPrice(offer, p.price) : null;
    return {
      id: p.id, name: p.name, price: Number(p.price), shopper_price: discounted ? discounted.pays : Number(p.price),
      images: brandProducts.allImages(p), image_url: p.image_url,
      in_deal: !!offer && (!ctx.buyPool || ctx.buyPool.has(p.id)),
      category: p.category_node_id ? { id: p.category_node_id, name: leafName.get(p.category_node_id) || null } : null,
      colours, sold_out: soldOut,
      details: p.description || null,
      // O3 (board S3, S4): the brand it is listed under, its category in words, and the listing's
      // details as rows. Empty ones are left out; nothing is invented (no rating, no tax line).
      brand_label: productDetails.brandLabelOf(p),
      category_path: p.category_node_id ? paths.get(p.category_node_id) || null : null,
      specs: productDetails.specsOf(p, defs),
      size_chart: (p.variants_json && (p.variants_json.size_chart || p.variants_json.sizeChart)) || null,
      set_qty: offer && offer.sub_type === 'fixed' ? (Number((cfg.quantities || {})[p.id]) || 1) : null,
    };
  };
  const products = [...ctx.products.values()].filter((p) => !p.gift_only && p.on_sale).map(productOut)
    .sort((a, b) => Number(a.sold_out) - Number(b.sold_out));
  const gifts = [...ctx.gifts.values()].map((g) => {
    const prod = g.kind === 'product' ? ctx.products.get(g.id) : null;
    return {
      kind: g.kind, id: g.id, name: g.name, worth: g.value, image_url: g.image_url,
      left: g.left != null && g.left <= 3 ? g.left : null, all_given: g.left != null && g.left <= 0,
      colours: prod ? productOut(prod).colours : [], images: prod ? brandProducts.allImages(prod) : (g.image_url ? [g.image_url] : []),
    };
  });
  return {
    post: { id: card.id, code: card.code, title: card.title, creator: card.creator, brand: card.brand },
    offer: offer ? {
      id: offer.id, type: offer.offer_type, sub_type: offer.sub_type, config: cfg, ends_on: card.offer ? card.offer.ends_on : null,
      // Said to the SHOPPER, with the real number of products and gifts (board table T).
      line: rules.dealLine(offer, products.filter((p) => p.in_deal).length, gifts.length),
      how: rules.shopperSays(offer, { buy: products.filter((p) => p.in_deal), gift: gifts }),
      badge: card.offer ? card.offer.badge : null,
    } : null,
    deal_page: !!offer && offer.offer_type !== 'discount',
    // shopper-deal-orders (C1–C4): on a deal post, may one product be bought alone at its normal price?
    buy_alone: !!offer && offer.offer_type !== 'discount' && rules.aloneAllowed(offer),
    // W11: INFLX's one return window, as the product page says it ("Within 7 days of delivery").
    returns: await returnWindow.forShopper(),
    products, gifts,
    categories: leaves.map((l) => ({ id: l.id, name: l.name, count: products.filter((p) => p.category && p.category.id === l.id).length })),
  };
}

/** The sticky bar and the review (D4): one post's picks, priced by the one engine. */
async function priceDeal(postId, rawLines) {
  const checkout = require('./shopperCheckout.service');
  const lines = checkout.cleanLines((rawLines || []).map((l) => ({ ...l, post_id: postId })));
  const bag = await checkout.priceBag(lines);
  const { _contexts, ...rest } = bag;
  return rest;
}

/* ───────────────────────────────────────────── my orders (O13–O15) */

function lineOut(r, back = null) {
  // shopper-walk-fixes (W14): an item that came back is a cancelled line whose `cancelled_by` is
  // 'return'; the order screens call it Returned. `back` is what shopperReturns.decorate says of it.
  const returned = r.status === 'cancelled' && r.cancelled_by === 'return';
  return {
    ...(back || {}),
    id: r.id, order_id: r.order_id, checkout_id: r.checkout_id, post_id: r.post_id,
    name: r.name, image_url: r.image_url, colour: r.colour, size: r.size, qty: r.qty, role: r.role, deal_key: r.deal_key,
    paid: Number(r.paid_total), normal: Number(r.normal_total),
    status: returned ? 'returned' : r.status === 'cancelled' ? 'cancelled' : r.order_status,
    status_word: returned ? 'Returned' : r.status === 'cancelled' ? 'Cancelled' : STATUS_WORD[r.order_status] || r.order_status,
    arrives_by: r.estimated_delivery_date, placed_at: r.created_at,
    brand: { id: r.brand_id, name: r.brand_name },
    creator: r.creator_name ? { id: r.influencer_id, name: r.creator_name } : null,
    can_cancel: r.status === 'active' && CANCELLABLE.has(r.order_status),
    payment_method: r.payment_method === 'cod' ? 'cod' : 'online',
    refund: r.refund_status ? { status: r.refund_status, amount: r.refund_amount == null ? null : Number(r.refund_amount) } : null,
  };
}

const LINE_SQL = `
  SELECT l.*, o.order_status, o.estimated_delivery_date, o.payment_method, o.courier_name, o.tracking_number,
         o.packed_at, o.dispatched_at, o.out_for_delivery_at, o.delivered_at, o.cancelled_at AS parcel_cancelled_at,
         o.address_snapshot, b.business_name AS brand_name, COALESCE(i.full_name, u.name) AS creator_name,
         ft.created_at AS tx_created_at, ft.return_window_ends_at
    FROM order_lines l
    JOIN follower_orders o ON o.id = l.order_id
    JOIN follower_transactions ft ON ft.id = l.transaction_id
    JOIN brands b ON b.id = l.brand_id
    JOIN influencers i ON i.id = l.influencer_id JOIN users u ON u.id = i.user_id`;

async function listOrders(followerId, { status = null, days = null, q = null, page = 1 } = {}) {
  const where = ['l.follower_id = $1'];
  const params = [followerId];
  const add = (v) => { params.push(v); return `$${params.length}`; };
  // W14: an item that came back is called Returned, so it is under "Returned", not under "Cancelled".
  if (status === 'cancelled') where.push(`l.status = 'cancelled' AND l.cancelled_by IS DISTINCT FROM 'return'`);
  else if (status === 'returned') where.push(`l.status = 'cancelled' AND l.cancelled_by = 'return'`);
  else if (status && STATUS_WORD[status]) where.push(`l.status = 'active' AND o.order_status = ${add(status)}::order_status`);
  if (Number(days) > 0) where.push(`l.created_at >= now() - make_interval(days => ${add(Math.min(3650, Number(days)))})`);
  if (q && String(q).trim()) where.push(`(l.name ILIKE ${add(`%${String(q).trim().slice(0, 60)}%`)} OR b.business_name ILIKE $${params.length})`);
  const lim = 20;
  const off = (Math.max(1, Number(page) || 1) - 1) * lim;
  const { rows } = await db.query(`${LINE_SQL} WHERE ${where.join(' AND ')} ORDER BY l.created_at DESC, l.id LIMIT ${lim + 1} OFFSET ${off}`, params);
  const page1 = rows.slice(0, lim);
  const back = await require('./shopperReturns.service').decorate(page1);
  return { items: page1.map((r) => lineOut(r, back.get(r.id))), more: rows.length > lim };
}

async function lineDetail(followerId, lineId) {
  if (!UUID.test(String(lineId || ''))) throw notFound();
  const { rows } = await db.query(`${LINE_SQL} WHERE l.id = $1 AND l.follower_id = $2`, [lineId, followerId]);
  const r = rows[0];
  if (!r) throw notFound();
  const at = (k) => (r[k] ? new Date(r[k]).toISOString() : null);
  const timeline = [
    { status: 'confirmed', word: 'Confirmed', at: new Date(r.created_at).toISOString() },
    { status: 'packed', word: 'Packed', at: at('packed_at') },
    { status: 'dispatched', word: 'Shipped', at: at('dispatched_at') },
    { status: 'out_for_delivery', word: 'Out for delivery', at: at('out_for_delivery_at') },
    { status: 'delivered', word: 'Delivered', at: at('delivered_at') },
  ];
  const { rows: post } = await db.query(`SELECT id, post_code FROM creator_posts WHERE id = $1`, [r.post_id]);
  const { rows: deal } = r.deal_key && TOGETHER.test(r.deal_key)
    ? await db.query(`SELECT id, name, size FROM order_lines WHERE transaction_id = $1 AND deal_key = $2 AND id <> $3`, [r.transaction_id, r.deal_key, r.id])
    : { rows: [] };
  const back = (await require('./shopperReturns.service').decorate([r])).get(r.id);
  const returned = r.status === 'cancelled' && r.cancelled_by === 'return';
  return {
    ...lineOut(r, back),
    timeline: r.status === 'cancelled' ? [...timeline.filter((t) => t.at), { status: returned ? 'returned' : 'cancelled', word: returned ? 'Returned' : 'Cancelled', at: at('cancelled_at') }] : timeline,
    courier: r.courier_name ? { name: r.courier_name, tracking: r.tracking_number } : null,
    address: r.address_snapshot,
    post: post[0] ? { id: post[0].id, code: post[0].post_code } : null,
    parcel: await parcelOf(r),
    deal_items: deal,
    cancel_reason: r.cancel_reason, cancelled_by: r.cancelled_by,
  };
}

/**
 * shopper-app-fixes (small fault S3): what the courier collects for a cash-on-delivery parcel is the
 * PARCEL's amount — every item still on it, its delivery and the cash fee — not one item's price.
 * `says` is the sentence for Order details while the parcel is not yet delivered; null otherwise.
 */
async function parcelOf(r) {
  const { rows: [o] } = await db.query(
    `SELECT o.cod_fee, o.delivery_fee,
            (SELECT count(*)::int FROM order_lines l WHERE l.order_id = o.id AND l.status = 'active') AS items,
            (SELECT COALESCE(sum(l.paid_total), 0) FROM order_lines l WHERE l.order_id = o.id AND l.status = 'active') AS items_total
       FROM follower_orders o WHERE o.id = $1`, [r.order_id]);
  if (!o) return null;
  const cod = r.payment_method === 'cod';
  const items = P(o.items_total);
  const delivery = P(o.delivery_fee);
  const fee = cod ? P(o.cod_fee) : 0;
  const toPay = cod && o.items > 0 ? items + delivery + fee : 0;
  const parts = [`${o.items} item${o.items === 1 ? '' : 's'} ${inr(R(items))}`, delivery > 0 ? `delivery ${inr(R(delivery))}` : null,
    fee > 0 ? `cash on delivery fee ${inr(R(fee))}` : null].filter(Boolean);
  const waiting = cod && o.items > 0 && r.order_status !== 'delivered' && r.status === 'active';
  return {
    items: o.items, items_total: R(items), delivery_fee: R(delivery), cod_fee: R(fee), to_pay: R(toPay),
    says: waiting ? `For this parcel you pay ${inr(R(toPay))} on delivery${parts.length > 1 || o.items > 1 ? `: ${parts.join(' + ')}` : ''}.` : null,
  };
}

/** The Order placed screen (O13). */
async function checkoutDetail(followerId, checkoutId) {
  if (!UUID.test(String(checkoutId || ''))) throw notFound();
  const { rows: [co] } = await db.query(`SELECT * FROM checkouts WHERE id = $1 AND follower_id = $2`, [checkoutId, followerId]);
  if (!co) throw notFound();
  const { rows: parcels } = await db.query(
    `SELECT o.id, o.estimated_delivery_date, b.business_name AS brand_name,
            (SELECT count(*)::int FROM order_lines l WHERE l.order_id = o.id) AS items
       FROM follower_orders o JOIN brands b ON b.id = o.brand_id WHERE o.checkout_id = $1 ORDER BY o.created_at`, [co.id]);
  return {
    id: co.id, status: co.status, total: Number(co.total), payment_method: co.payment_method,
    savings: Number(co.savings), placed_at: co.placed_at,
    parcels: parcels.map((p) => ({ id: p.id, brand: p.brand_name, arrives_by: p.estimated_delivery_date, items: p.items })),
  };
}

/* ───────────────────────────────────────────── cancelling (S8) */

/**
 * Which lines one cancel takes: the line, the rest of its deal (a BOGO pair, a bundle set, a volume
 * deal), and a gift whose threshold the rest no longer reaches (6.12).
 */
async function cancelSet(conn, line) {
  const { rows: all } = await conn.query(
    `SELECT * FROM order_lines WHERE transaction_id = $1 AND status = 'active' ORDER BY created_at, id FOR UPDATE`, [line.transaction_id]);
  const take = new Set([line.id]);
  if (line.deal_key && TOGETHER.test(line.deal_key)) for (const l of all) if (l.deal_key === line.deal_key) take.add(l.id);
  const gifts = all.filter((l) => l.role === 'gift' && !take.has(l.id));
  if (gifts.length && line.offer_id) {
    const { rows: [o] } = await conn.query(`SELECT sub_type, offer_config_json FROM brand_offers WHERE id = $1`, [line.offer_id]);
    const cfg = o ? rules.normaliseConfig(o.sub_type, o.offer_config_json) : {};
    const left = all.filter((l) => !take.has(l.id) && l.role !== 'gift' && l.deal_key === 'gift-deal');
    const still = o && o.sub_type === 'spend' ? left.reduce((s, l) => s + Number(l.normal_total), 0) >= (cfg.min_spend || Infinity)
      : o && o.sub_type === 'buy_x' ? left.reduce((s, l) => s + Number(l.qty), 0) >= (cfg.buy_qty || Infinity) : true;
    if (!still) for (const g of gifts) take.add(g.id);
  }
  if (line.role === 'gift') take.add(line.id);
  return all.filter((l) => take.has(l.id));
}

/** What a cancel would take, for the warning before she confirms (O16). */
async function cancelPreview(followerId, lineId) {
  const { line } = await lineForCancel({ followerId, lineId });
  const set = await cancelSet(db, line);
  const paid = set.reduce((s, l) => s + P(l.paid_total), 0);
  const { rows: [o] } = await db.query(`SELECT payment_method FROM follower_orders WHERE id = $1`, [line.order_id]);
  return {
    lines: set.map((l) => ({ id: l.id, name: l.name, size: l.size, role: l.role })),
    warning: set.length > 1 ? `This is part of a deal. Cancelling cancels ${set.length} items together.` : null,
    refund: o.payment_method === 'cod' ? { amount: 0, text: 'A refund is not needed; this was pay on delivery' }
      : { amount: R(paid), text: `Refund of ${inr(R(paid))} to your original payment method in 5–7 working days` },
    reasons: REASONS,
  };
}

async function lineForCancel({ followerId = null, brandId = null, lineId }) {
  if (!UUID.test(String(lineId || ''))) throw notFound();
  const { rows } = await db.query(
    `SELECT l.*, o.order_status FROM order_lines l JOIN follower_orders o ON o.id = l.order_id WHERE l.id = $1`, [lineId]);
  const line = rows[0];
  if (!line || (followerId && line.follower_id !== followerId) || (brandId && line.brand_id !== brandId)) throw notFound();
  if (line.status === 'cancelled') throw new AppError('CONFLICT', 'Already cancelled', 409);
  if (!CANCELLABLE.has(line.order_status)) throw new AppError('CONFLICT', 'It has shipped. You can return it once delivered.', 409);
  return { line };
}

/**
 * Cancel an item (6.12). actor: 'shopper' | 'brand' | 'admin'.
 * @returns { cancelled: [ids], refund: { amount, status } }
 */
async function cancel({ actor, followerId = null, brandId = null, lineId, reason, note = null }) {
  const why = String(reason || '').trim();
  if (!why) throw new AppError('VALIDATION_ERROR', 'Choose a reason', 400, 'reason');
  if (actor === 'shopper' && !REASONS.includes(why)) throw new AppError('VALIDATION_ERROR', 'Choose a reason', 400, 'reason');
  if (why === 'Other' && !String(note || '').trim()) throw new AppError('VALIDATION_ERROR', 'Write a note', 400, 'note');
  await lineForCancel({ followerId, brandId, lineId });

  let refundAmount = 0;
  let paymentId = null;
  let online = false;
  let cancelledIds = [];
  let parcelGone = false;
  let orderId = null;
  await db.withTransaction(async (conn) => {
    const { rows: [line] } = await conn.query(
      `SELECT l.*, o.order_status, o.payment_method, o.delivery_fee, c.razorpay_payment_id
         FROM order_lines l JOIN follower_orders o ON o.id = l.order_id JOIN checkouts c ON c.id = l.checkout_id
        WHERE l.id = $1 FOR UPDATE OF o`, [lineId]);
    if (line.status === 'cancelled') throw new AppError('CONFLICT', 'Already cancelled', 409);
    if (!CANCELLABLE.has(line.order_status)) throw new AppError('CONFLICT', 'It has shipped. You can return it once delivered.', 409);
    orderId = line.order_id;
    online = line.payment_method !== 'cod';
    paymentId = line.razorpay_payment_id;
    const set = await cancelSet(conn, line);
    cancelledIds = set.map((l) => l.id);
    const sum = (k) => set.reduce((s, l) => s + P(l[k]), 0);
    const paid = sum('paid_total');

    await conn.query(
      `UPDATE order_lines SET status = 'cancelled', cancel_reason = $2, cancel_note = $3, cancelled_by = $4, cancelled_at = now(),
              refund_amount = paid_total, refund_status = $5
        WHERE id = ANY($1::uuid[])`,
      [cancelledIds, why, note ? String(note).slice(0, 500) : null, actor, online && paid > 0 ? 'pending' : 'not_needed']);

    // Stock and gifts back (R6).
    await stock.giveBack(conn, {
      products: set.filter((l) => l.role !== 'gift' && l.product_id).map((l) => ({ product_id: l.product_id, colour: l.colour, size: l.size, qty: l.qty })),
      gifts: set.filter((l) => l.role === 'gift').map((l) => ({ pool_item_id: l.pool_item_id, gift_item_id: l.gift_item_id, product_id: l.product_id, colour: l.colour, size: l.size, qty: l.qty })),
    });

    // Money (6.13): the three shares of these items are undone.
    const { rows: [tx] } = await conn.query(`SELECT * FROM follower_transactions WHERE id = $1 FOR UPDATE`, [line.transaction_id]);
    // Item 17: once a sale's shares are in the wallets they may already be locked, on hold or
    // withdrawn — a refund here would leave INFLX out of pocket. The money jobs never add a sale
    // while its parcel is still Confirmed/Packed (the only states this function allows), so this is
    // the backstop for the two running at the same instant: everything above rolls back.
    if (tx.brand_settlement_status === 'settled' || tx.commission_confirmed_at) {
      throw new AppError('CONFLICT', 'This order has already been settled. Please contact INFLX and we will sort it out.', 409, 'status');
    }
    const c = sum('commission'); const f = sum('platform_fee'); const b = sum('brand_net');
    await conn.query(
      `UPDATE follower_transactions SET commission_reversed = COALESCE(commission_reversed,0) + $2,
              brand_net_reversed = COALESCE(brand_net_reversed,0) + $3, platform_fee_reversed = platform_fee_reversed + $4
        WHERE id = $1`, [tx.id, R(c), R(b), R(f)]);
    if (c > 0) {
      const confirmed = !!tx.commission_confirmed_at;
      const field = confirmed ? 'wallet_balance' : 'pending_balance';
      const { rows: [inf] } = await conn.query(
        `UPDATE influencers SET ${field} = GREATEST(0, ${field} - $1), total_earned = GREATEST(0, total_earned - $1)
          WHERE id = $2 RETURNING ${field} AS bal`, [R(c), line.influencer_id]);
      await appendInfluencerLedger({ client: conn, influencerId: line.influencer_id, type: 'cancel_clawback', amount: R(c),
        direction: 'debit', balanceField: field, balanceAfter: inf ? Number(inf.bal) : null, source: 'order_cancel',
        sourceRefId: line.id, note: `Cancelled by ${actor}: ${why}` });
    }
    const { rows: [left] } = await conn.query(`SELECT count(*)::int AS n FROM order_lines WHERE transaction_id = $1 AND status = 'active'`, [tx.id]);
    if (left.n === 0) {
      await conn.query(`UPDATE follower_transactions SET status = 'refunded', brand_settlement_status = 'reversed' WHERE id = $1 AND brand_settlement_status <> 'settled'`, [tx.id]);
    }
    const { rows: [pl] } = await conn.query(`SELECT count(*)::int AS n FROM order_lines WHERE order_id = $1 AND status = 'active'`, [line.order_id]);
    parcelGone = pl.n === 0;
    if (parcelGone) await conn.query(`UPDATE follower_orders SET order_status = 'cancelled', cancelled_at = now() WHERE id = $1`, [line.order_id]);
    refundAmount = online ? paid + (parcelGone ? P(line.delivery_fee) : 0) : 0;
  });

  // The refund, after the money rows are safe (6.12).
  let refund = { amount: 0, status: 'not_needed' };
  if (online && refundAmount > 0) {
    try {
      const id = await txService.refundPayment(paymentId, R(refundAmount), { order_id: orderId, reason: why });
      await db.query(`UPDATE order_lines SET refund_status = 'issued', refund_id = $2 WHERE id = ANY($1::uuid[])`, [cancelledIds, id]);
      refund = { amount: R(refundAmount), status: 'issued', id };
    } catch (e) {
      console.error(`[orders] REFUND FAILED for order ${orderId}: ${e.message}`);
      await db.query(`UPDATE order_lines SET refund_status = 'failed' WHERE id = ANY($1::uuid[])`, [cancelledIds]);
      refund = { amount: R(refundAmount), status: 'failed' };
    }
  }
  await notifyCancelled({ actor, lineIds: cancelledIds, refund }).catch((e) => console.error('[orders] notify', e.message));
  return { cancelled: cancelledIds, parcel_cancelled: parcelGone, refund };
}

async function notifyCancelled({ actor, lineIds, refund }) {
  const { rows } = await db.query(
    `SELECT l.name, f.user_id AS shopper, b.user_id AS brand_user FROM order_lines l JOIN followers f ON f.id = l.follower_id
       JOIN brands b ON b.id = l.brand_id WHERE l.id = ANY($1::uuid[]) LIMIT 1`, [lineIds]);
  const r = rows[0];
  if (!r) return;
  const money = refund.status === 'issued' ? ` Refund of ${inr(refund.amount)} is on its way.` : '';
  await notificationService.send({ userId: r.shopper, type: 'order_cancelled', title: 'Cancelled',
    body: `${r.name}${lineIds.length > 1 ? ` and ${lineIds.length - 1} more` : ''} cancelled${actor === 'brand' ? ' by the store' : ''}.${money}`, data: { screen: 'order', line_id: lineIds[0] } });
  if (actor !== 'brand') {
    await notificationService.send({ userId: r.brand_user, type: 'brand_order_cancelled', title: 'Item cancelled',
      body: `The shopper cancelled ${r.name}. Don't ship it.`, data: { line_id: lineIds[0] } });
  }
}

/* ───────────────────────────────────────────── the brand's parcels (S10) */

async function brandParcels(brandId, { status = null, page = 1 } = {}) {
  const params = [brandId];
  let filter = '';
  if (status && STATUS_WORD[status]) { params.push(status); filter = `AND o.order_status = $2::order_status`; }
  const lim = 30;
  const off = (Math.max(1, Number(page) || 1) - 1) * lim;
  const { rows: parcels } = await db.query(
    `SELECT o.id, o.order_status, o.created_at, o.estimated_delivery_date, o.payment_method, o.cod_fee, o.delivery_fee,
            o.courier_name, o.tracking_number, o.address_snapshot
       FROM follower_orders o WHERE o.brand_id = $1 AND o.checkout_id IS NOT NULL ${filter}
      ORDER BY o.created_at DESC LIMIT ${lim + 1} OFFSET ${off}`, params);
  const ids = parcels.slice(0, lim).map((p) => p.id);
  const { rows: lines } = ids.length ? await db.query(
    `SELECT l.id, l.order_id, l.name, l.image_url, l.colour, l.size, l.qty, l.role, l.deal_key, l.status, l.cancel_reason, l.cancelled_by,
            l.paid_total, l.commission, l.commission_pct, l.platform_fee, l.fee_pct, l.brand_net, l.post_id,
            cp.post_code, COALESCE(i.full_name, u.name) AS creator_name
       FROM order_lines l JOIN creator_posts cp ON cp.id = l.post_id
       JOIN influencers i ON i.id = l.influencer_id JOIN users u ON u.id = i.user_id
      WHERE l.order_id = ANY($1::uuid[]) ORDER BY l.created_at, l.id`, [ids]) : { rows: [] };
  const back = await returnsOfLines(lines.map((l) => l.id));
  return {
    parcels: parcels.slice(0, lim).map((p) => {
      const mine = lines.filter((l) => l.order_id === p.id);
      const active = mine.filter((l) => l.status === 'active');
      const tot = (k) => R(active.reduce((s, l) => s + P(l[k]), 0));
      return {
        id: p.id, status: p.order_status, status_word: STATUS_WORD[p.order_status], placed_at: p.created_at,
        arrives_by: p.estimated_delivery_date, payment_method: p.payment_method === 'cod' ? 'cod' : 'online',
        courier: p.courier_name ? { name: p.courier_name, tracking: p.tracking_number } : null,
        ship_to: p.address_snapshot,
        items: mine.map((l) => ({
          id: l.id, name: l.name, image_url: l.image_url, colour: l.colour, size: l.size, qty: l.qty, role: l.role,
          status: l.status, cancel_reason: l.cancel_reason, cancelled_by: l.cancelled_by,
          // W14: a return on this item — the brand sees it; INFLX decides it.
          return: back.get(l.id) || null,
          post: { id: l.post_id, code: l.post_code }, creator: l.creator_name,
          money: { paid: Number(l.paid_total), creator_share: Number(l.commission), creator_pct: Number(l.commission_pct),
            inflx_share: Number(l.platform_fee), inflx_pct: Number(l.fee_pct), brand_share: Number(l.brand_net) },
        })),
        money: { paid: tot('paid_total'), creator_share: tot('commission'), inflx_share: tot('platform_fee'), brand_share: tot('brand_net') },
        next: nextStatus(p.order_status),
      };
    }),
    more: parcels.length > lim,
  };
}

/** shopper-walk-fixes (W14): the latest return of each item, for the brand's parcels (read-only for the brand). */
async function returnsOfLines(lineIds) {
  const out = new Map();
  if (!lineIds.length) return out;
  const { rows } = await db.query(
    `SELECT DISTINCT ON (order_line_id) order_line_id, return_status FROM follower_returns
      WHERE order_line_id = ANY($1::uuid[]) ORDER BY order_line_id, created_at DESC, id`, [lineIds]);
  const WORD = { requested: 'Return requested', approved: 'Return approved — collect it', received: 'Return received', rejected: 'Return not accepted', refunded: 'Returned' };
  for (const r of rows) out.set(r.order_line_id, { status: r.return_status, word: WORD[r.return_status] || r.return_status });
  return out;
}

function nextStatus(s) {
  const i = FORWARD.indexOf(s);
  return i >= 0 && i < FORWARD.length - 1 ? FORWARD[i + 1] : null;
}

/**
 * The brand (or admin) moves a parcel forward only (6.10): Packed → Shipped (courier + tracking)
 * → Out for delivery → Delivered. Cancelling is the cancel step, never a status.
 */
async function setParcelStatus({ brandId = null, orderId, status: st, order_status, courier_name, tracking_number }) {
  const status = st || order_status;
  if (!UUID.test(String(orderId || ''))) throw notFound();
  if (status === 'cancelled') throw new AppError('VALIDATION_ERROR', 'Cancel an item with a reason instead', 400, 'status');
  if (!FORWARD.includes(status)) throw new AppError('VALIDATION_ERROR', 'Unknown status', 400, 'status');
  const { rows: [o] } = await db.query(`SELECT id, brand_id, order_status, checkout_id FROM follower_orders WHERE id = $1`, [orderId]);
  if (!o || (brandId && o.brand_id !== brandId)) throw notFound();
  // Forward only, one step at a time up to Shipped (it needs the courier); after Shipped, "Out for
  // delivery" may be skipped (the brand marks Delivered straight away, as before).
  const from = FORWARD.indexOf(o.order_status);
  const to = FORWARD.indexOf(status);
  const shipped = FORWARD.indexOf('dispatched');
  if (from < 0 || !(to > from) || (from < shipped && to !== from + 1)) {
    throw new AppError('CONFLICT', `It is ${STATUS_WORD[o.order_status] || o.order_status}; the next step is ${STATUS_WORD[nextStatus(o.order_status)] || 'none'}`, 409, 'status');
  }
  const courier = String(courier_name || '').trim().slice(0, 80);
  const tracking = String(tracking_number || '').trim().slice(0, 120);
  if (status === 'dispatched' && (!courier || !tracking)) throw new AppError('VALIDATION_ERROR', 'Add the courier and tracking number', 400, 'tracking_number');
  const stamp = { packed: 'packed_at', dispatched: 'dispatched_at', out_for_delivery: 'out_for_delivery_at', delivered: 'delivered_at' }[status];
  const { rowCount } = await db.query(
    `UPDATE follower_orders SET order_status = $2::order_status, ${stamp} = now(),
            courier_name = COALESCE($4, courier_name), tracking_number = COALESCE($5, tracking_number)
      WHERE id = $1 AND order_status = $3::order_status`,
    [o.id, status, o.order_status, courier || null, tracking || null]);
  if (!rowCount) throw new AppError('CONFLICT', 'The order changed; refresh', 409);
  if (o.checkout_id && status !== 'packed') {
    const { rows: [s] } = await db.query(
      `SELECT f.user_id, (SELECT name FROM order_lines WHERE order_id = $1 AND status = 'active' ORDER BY created_at LIMIT 1) AS name,
              (SELECT id FROM order_lines WHERE order_id = $1 AND status = 'active' ORDER BY created_at LIMIT 1) AS line_id
         FROM follower_orders o JOIN checkouts c ON c.id = o.checkout_id JOIN followers f ON f.id = c.follower_id WHERE o.id = $1`, [o.id]);
    if (s) await notificationService.send({ userId: s.user_id, type: `order_${status}`, title: STATUS_WORD[status],
      body: `${s.name || 'Your order'}: ${STATUS_WORD[status].toLowerCase()}${status === 'dispatched' ? ` with ${courier} (${tracking})` : ''}.`, data: s.line_id ? { screen: 'order', line_id: s.line_id, order_id: o.id } : { screen: 'orders', order_id: o.id } })
      .catch((e) => console.error('[orders] notify', e.message));
  }
  return { id: o.id, status, status_word: STATUS_WORD[status] };
}

module.exports = {
  REASONS, STATUS_WORD, dealPage, priceDeal, listOrders, lineDetail, checkoutDetail,
  cancelPreview, cancel, cancelSet, brandParcels, setParcelStatus,
};
