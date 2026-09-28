'use strict';

/**
 * offerLife — an offer from draft to ended. Contract: features/offer-builder-v2
 * Rules: Docs/OFFER_TERMS_POSTS_RULES.md §1.2–§1.11.
 *
 *   draft ──publish──▶ published (Scheduled / Live / Ended from the dates, India time)
 *     │                    ├── remove products (freed at once; creators told)
 *   delete                 └── end now ──▶ ended (products free from today; creators told)
 *
 * Only a draft can change. A published offer's name, type, numbers, dates and pool are frozen
 * (rules 1.10); it can't be deleted, only ended (rules 1.9).
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const { calendarDay, todayInIndia, addDays, daysBetween } = require('../utils/indiaDay');
const rules = require('./offerRules');
const pool = require('./offerPool.service');
const { NOTIFY } = require('./offerCopy');
const notificationService = require('./notification.service');

const LIVE_CI = `('invited','applied','accepted','negotiating','contracted','active','completed')`;
const OFFER_COLS = `o.id, o.brand_id, o.engine, o.name, o.offer_type, o.sub_type, o.offer_config_json, o.status,
  o.starts_on, o.ends_on, o.auto_add, o.excluded_product_ids, o.published_at, o.ended_at, o.created_at, o.updated_at`;

function shape(r) {
  return {
    ...r,
    starts_on: calendarDay(r.starts_on),
    ends_on: calendarDay(r.ends_on),
    excluded_product_ids: r.excluded_product_ids || [],
    offer_config_json: r.offer_config_json || {},
  };
}

async function brandIdFor(userId) {
  const { rows } = await db.query(`SELECT id FROM brands WHERE user_id = $1`, [userId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Brand profile not found', 404);
  return rows[0].id;
}

/** The brand's own new-builder offer, or 404 (another brand's offer is never found). */
async function getOwn(brandId, offerId, { tx = db, forUpdate = false } = {}) {
  if (!/^[0-9a-f-]{36}$/i.test(String(offerId || ''))) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  const { rows } = await tx.query(
    `SELECT ${OFFER_COLS} FROM brand_offers o WHERE o.id = $1 AND o.brand_id = $2 AND o.engine = 2 ${forUpdate ? 'FOR UPDATE' : ''}`,
    [offerId, brandId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Offer not found', 404);
  return shape(rows[0]);
}

function assertDraft(offer) {
  if (offer.status !== 'draft') {
    throw new AppError('OFFER_LOCKED', 'A published offer can\'t be changed. To change the deal, end it and build a new one.', 409);
  }
}

// ── creating and editing a draft ─────────────────────────────────────────────
async function createDraft(brandId, body = {}) {
  const type = String(body.offer_type || '');
  if (!rules.TYPES.includes(type)) throw new AppError('VALIDATION_ERROR', 'Choose the offer type.', 422, 'offer_type');
  let sub = body.sub_type || null;
  if (type === 'bogo') sub = 'bogo';                 // BOGO has one kind; step 2 is skipped
  if (sub && !rules.isValidSubType(type, sub)) throw new AppError('VALIDATION_ERROR', 'That sub-type doesn\'t belong to this offer type.', 422, 'sub_type');
  const productIds = Array.isArray(body.product_ids) ? body.product_ids : [];
  return db.withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `INSERT INTO brand_offers (brand_id, engine, name, offer_type, sub_type, offer_config_json, status, availing_modes)
       VALUES ($1, 2, 'Untitled offer', $2, $3, '{}'::jsonb, 'draft', '{}')
       RETURNING id`, [brandId, type, sub]);
    const id = rows[0].id;
    // "Put in offer" (O8): the ticked products wait as one line; they're checked for locks once
    // the dates are set (a line can't be resolved before then).
    if (productIds.length) {
      const found = await pool.productsByIds(brandId, productIds, tx);
      if (!found.length) throw new AppError('VALIDATION_ERROR', 'None of those products are in your published listings.', 422, 'product_ids');
      await tx.query(
        `INSERT INTO offer_pool_sources (offer_id, pool, method, product_ids) VALUES ($1, 'buy', 'picked', $2::uuid[])`,
        [id, found.map((p) => p.id)]);
    }
    return getOwn(brandId, id, { tx });
  });
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Autosave of a draft: type / sub-type, name, dates, numbers, auto-add, taken-out products.
 * Every field optional. Changing type or sub-type drops pool lines the new kind can't use.
 */
async function updateDraft(brandId, offerId, body = {}) {
  return db.withTransaction(async (tx) => {
    const offer = await getOwn(brandId, offerId, { tx, forUpdate: true });
    assertDraft(offer);
    const sets = [], params = [];
    const set = (col, v) => { params.push(v); sets.push(`${col} = $${params.length}`); };
    const notes = [];

    let type = offer.offer_type, sub = offer.sub_type;
    if (body.offer_type !== undefined && body.offer_type !== type) {
      if (!rules.TYPES.includes(body.offer_type)) throw new AppError('VALIDATION_ERROR', 'Choose the offer type.', 422, 'offer_type');
      type = body.offer_type; sub = type === 'bogo' ? 'bogo' : null;
      set('offer_type', type); set('offer_config_json', '{}');
    }
    if (body.sub_type !== undefined && body.sub_type !== sub) {
      if (!rules.isValidSubType(type, body.sub_type)) throw new AppError('VALIDATION_ERROR', 'That sub-type doesn\'t belong to this offer type.', 422, 'sub_type');
      sub = body.sub_type;
      if (body.offer_config_json === undefined) set('offer_config_json', '{}');
    } else if (type === 'bogo') sub = 'bogo';
    if (sub !== offer.sub_type) set('sub_type', sub);

    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (name.length > 150) throw new AppError('VALIDATION_ERROR', 'Keep the name under 150 characters.', 422, 'name');
      set('name', name || 'Untitled offer');
    }
    let starts = offer.starts_on, ends = offer.ends_on;
    if (body.starts_on !== undefined) {
      if (body.starts_on !== null && !DATE_RE.test(String(body.starts_on))) throw new AppError('VALIDATION_ERROR', 'Pick a start date.', 422, 'starts_on');
      starts = body.starts_on || null; set('starts_on', starts);
    }
    if (body.ends_on !== undefined) {
      if (body.ends_on !== null && !DATE_RE.test(String(body.ends_on))) throw new AppError('VALIDATION_ERROR', 'Pick an end date.', 422, 'ends_on');
      ends = body.ends_on || null; set('ends_on', ends);
    }
    if (starts && ends && !(daysBetween(starts, ends) > 0)) {
      throw new AppError('VALIDATION_ERROR', 'The end date must be after the start date.', 422, 'ends_on');
    }
    if (body.offer_config_json !== undefined) set('offer_config_json', JSON.stringify(rules.normaliseConfig(sub, body.offer_config_json)));
    if (body.auto_add !== undefined) set('auto_add', !!body.auto_add);
    if (body.excluded_product_ids !== undefined) {
      const ids = Array.isArray(body.excluded_product_ids) ? [...new Set(body.excluded_product_ids.filter((x) => /^[0-9a-f-]{36}$/i.test(String(x))))] : [];
      params.push(ids); sets.push(`excluded_product_ids = $${params.length}::uuid[]`);
    }
    if (sets.length) {
      sets.push('updated_at = now()');
      params.push(offer.id);
      await tx.query(`UPDATE brand_offers SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    }

    // Pool lines the (new) kind can't use.
    if (type !== 'free_gift') {
      const { rowCount } = await tx.query(`DELETE FROM offer_pool_sources WHERE offer_id = $1 AND pool = 'gift'`, [offer.id]);
      if (rowCount) notes.push('The gift pool was cleared: only a free gift offer has one.');
    }
    if (sub === 'fixed') {
      const { rowCount } = await tx.query(
        `DELETE FROM offer_pool_sources WHERE offer_id = $1 AND method IN ('category_all','category_filter')`, [offer.id]);
      if (rowCount) notes.push('Category lines were removed: a fixed bundle takes exact products.');
    }
    const fresh = await getOwn(brandId, offer.id, { tx });
    return { offer: fresh, notes };
  });
}

async function deleteDraft(brandId, offerId) {
  const offer = await getOwn(brandId, offerId);
  if (offer.status !== 'draft') throw new AppError('OFFER_LOCKED', 'A published offer can\'t be deleted. End it instead.', 409);
  await db.query(`DELETE FROM brand_offers WHERE id = $1 AND brand_id = $2 AND status = 'draft' AND engine = 2`, [offer.id, brandId]);
  return { deleted: true };
}

async function addSource(brandId, offerId, body) {
  return db.withTransaction(async (tx) => {
    const offer = await getOwn(brandId, offerId, { tx, forUpdate: true });
    assertDraft(offer);
    const src = await pool.addSource(offer, body, tx);
    await tx.query(`UPDATE brand_offers SET updated_at = now() WHERE id = $1`, [offer.id]);
    return src;
  });
}

async function removeSource(brandId, offerId, sourceId) {
  const offer = await getOwn(brandId, offerId);
  assertDraft(offer);
  const { rowCount } = await db.query(`DELETE FROM offer_pool_sources WHERE id = $1 AND offer_id = $2`, [sourceId, offer.id]);
  if (!rowCount) throw new AppError('NOT_FOUND', 'That pool line is not on this offer.', 404);
  return { removed: true };
}

// ── creators given the offer (collab_offers, written by Level 2) ─────────────
async function creatorsOf(offerIds, tx = db) {
  const ids = Array.isArray(offerIds) ? offerIds : [offerIds];
  if (!ids.length) return [];
  const { rows } = await tx.query(
    `SELECT co.offer_id, ci.id AS campaign_influencer_id, ci.status::text AS status, i.id AS influencer_id,
            u.id AS user_id, COALESCE(u.name, i.instagram_handle) AS creator_name, i.instagram_handle,
            cs.name AS set_name, c.name AS campaign_name
       FROM collab_offers co
       JOIN campaign_influencers ci ON ci.id = co.campaign_influencer_id
       JOIN influencers i ON i.id = ci.influencer_id
       JOIN users u ON u.id = i.user_id
       JOIN campaign_sets cs ON cs.id = ci.set_id
       JOIN campaigns c ON c.id = cs.campaign_id
      WHERE co.offer_id = ANY($1::uuid[]) AND co.dropped_at IS NULL AND ci.status::text IN ${LIVE_CI}
      ORDER BY u.name`, [ids]);
  return rows;
}

async function brandName(brandId, tx = db) {
  const { rows } = await tx.query(`SELECT business_name FROM brands WHERE id = $1`, [brandId]);
  return rows[0] ? rows[0].business_name : 'The brand';
}

/** Tell every creator given the offer. Never fails the caller. */
async function tellCreators(offerId, message, data = {}) {
  let creators = [];
  try { creators = await creatorsOf(offerId); } catch (e) { console.error('[offers] creators lookup failed:', e.message); return 0; }
  const seen = new Set();
  for (const c of creators) {
    if (seen.has(c.user_id)) continue;
    seen.add(c.user_id);
    await notificationService.send({
      userId: c.user_id, type: message.type, title: message.title, body: message.body, sendSms: false,
      data: { screen: 'creator_offer', offer_id: offerId, campaign_influencer_id: c.campaign_influencer_id, ...data },
    }).catch((e) => console.error('[offers] notify failed:', e.message));
  }
  return seen.size;
}

// ── reading an offer ─────────────────────────────────────────────────────────
async function poolFor(offer, tx = db) {
  if (offer.status === 'draft') return pool.resolveDraftPool(offer, tx);
  const frozen = await pool.frozenPool(offer.id, tx);
  return { ...frozen, sources: (await pool.listSources(offer.id, tx)).map((s) => ({ id: s.id, pool: s.pool, method: s.method })), locked: [], conflicts: [], duplicates: 0, excluded: 0 };
}

/** Everything the builder, review and offer page need. */
async function view(brandId, offerId, { today = todayInIndia() } = {}) {
  const offer = await getOwn(brandId, offerId);
  const p = await poolFor(offer);
  const status = rules.displayStatus(offer, today);
  const creators = offer.status === 'draft' ? [] : await creatorsOf(offer.id);
  const checks = offer.status === 'draft' ? rules.publishChecks(offer, p, today) : null;
  const giftCount = p.gift.length;
  return {
    offer: {
      ...offer,
      display_status: status,
      type_label: rules.typeLabel(offer.offer_type, offer.sub_type),
      deal: rules.dealLine(offer, p.buy.length, giftCount),
      days_left: status === 'live' ? daysBetween(today, offer.ends_on) + 1 : null,
      starts_in: status === 'scheduled' ? daysBetween(today, offer.starts_on) : null,
    },
    pool: {
      buy: p.buy, gift: p.gift, sources: p.sources, locked: p.locked, conflicts: p.conflicts,
      duplicates: p.duplicates, excluded: p.excluded,
      counts: { buy: p.buy.length, gift: giftCount },
    },
    numbers: { problems: offer.status === 'draft' ? rules.numberProblems(offer.sub_type, offer.offer_config_json) : [], help: rules.numbersHelp(offer, p) },
    checks,
    creators: creators.map((c) => ({ campaign_influencer_id: c.campaign_influencer_id, name: c.creator_name, handle: c.instagram_handle, set_name: c.set_name, campaign_name: c.campaign_name, status: c.status, posts: 0, sales: null })),
    posts: { live: 0, note: 'Shoppable posts come next. Posts using this offer will show here.' },
    // creator-terms-v2 (founder Q1): the warning before ending it.
    unsigned_invitations: offer.status === 'draft' ? 0 : await require('./creatorTerms.service').unsignedWith(offer.id),
  };
}

/** Listings → Offers (O1). */
async function list(brandId, { type, q, status, on } = {}, { today = todayInIndia() } = {}) {
  const where = ['o.brand_id = $1', 'o.engine = 2'];
  const params = [brandId];
  if (type && rules.TYPES.includes(type)) { params.push(type); where.push(`o.offer_type = $${params.length}`); }
  if (q) { params.push(`%${String(q).trim()}%`); where.push(`o.name ILIKE $${params.length}`); }
  if (on && DATE_RE.test(String(on))) { params.push(on); where.push(`o.starts_on <= $${params.length}::date AND o.ends_on >= $${params.length}::date`); }
  const { rows } = await db.query(
    `SELECT ${OFFER_COLS},
            (SELECT count(*)::int FROM offer_pool_items i WHERE i.offer_id = o.id AND i.pool = 'buy' AND i.removed_at IS NULL) AS buy_items,
            (SELECT count(*)::int FROM offer_pool_items i WHERE i.offer_id = o.id AND i.pool = 'gift' AND i.removed_at IS NULL) AS gift_items
       FROM brand_offers o WHERE ${where.join(' AND ')}
      ORDER BY o.created_at DESC`, params);
  const offers = rows.map(shape);
  const creators = await creatorsOf(offers.map((o) => o.id));
  const creatorCount = new Map();
  for (const c of creators) creatorCount.set(c.offer_id, (creatorCount.get(c.offer_id) || 0) + 1);

  const out = [];
  for (const o of offers) {
    let buy = o.buy_items, gift = o.gift_items;
    if (o.status === 'draft') {
      const p = await pool.resolveDraftPool(o);
      buy = p.buy.length; gift = p.gift.length;
    }
    const ds = rules.displayStatus(o, today);
    out.push({
      id: o.id, name: o.name, offer_type: o.offer_type, sub_type: o.sub_type,
      type_label: rules.typeLabel(o.offer_type, o.sub_type),
      deal: rules.dealLine(o, buy, gift),
      starts_on: o.starts_on, ends_on: o.ends_on, ended_at: o.ended_at,
      status: o.status, display_status: ds,
      products: buy, gifts: gift,
      creators: o.status === 'draft' ? null : (creatorCount.get(o.id) || 0),
      updated_at: o.updated_at,
    });
  }
  const counts = { all: out.length, live: 0, scheduled: 0, draft: 0, ended: 0 };
  for (const o of out) counts[o.display_status] = (counts[o.display_status] || 0) + 1;
  const filtered = status && counts[status] !== undefined && status !== 'all' ? out.filter((o) => o.display_status === status) : out;
  return { offers: filtered, counts, today };
}

// ── publishing (rules 1.5, 1.8) ──────────────────────────────────────────────
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Publish a draft. One transaction under a brand-level advisory lock; the exclusion constraints
 * are the backstop. `seenProductIds`: the buy products the brand's review screen showed — if any
 * is now locked, or the pool changed, publishing is refused and says why (spec D6).
 */
async function publish(brandId, offerId, { seenProductIds = null, today = todayInIndia() } = {}) {
  try {
    return await db.withTransaction(async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext('offer-pool:' || $1::text))`, [brandId]);
      const offer = await getOwn(brandId, offerId, { tx, forUpdate: true });
      if (offer.status !== 'draft') throw new AppError('OFFER_LOCKED', 'This offer is already published.', 409);

      const p = await pool.resolveDraftPool(offer, tx);
      const conflicts = [...p.conflicts];
      if (Array.isArray(seenProductIds)) {
        const lockedById = new Map(p.locked.map((l) => [l.id, l]));
        for (const id of seenProductIds) {
          const l = lockedById.get(id);
          if (l && !conflicts.some((c) => c.id === id)) conflicts.push({ id, name: l.name, offer_name: l.offer_name, ends_on: l.until });
        }
      }
      const checks = rules.publishChecks(offer, { buy: p.buy, gift: p.gift, conflicts }, today);
      if (!checks.ok) {
        // Lead with a taken product when there is one: it's the reason the brand can act on.
        const first = checks.checks.find((c) => !c.ok && c.key === 'lock') || checks.checks.find((c) => !c.ok);
        throw Object.assign(new AppError('PUBLISH_BLOCKED', first.text, 422), { details: checks });
      }
      if (Array.isArray(seenProductIds) && !sameSet(p.buy.map((b) => b.id), [...new Set(seenProductIds)])) {
        throw new AppError('POOL_CHANGED', `The pool changed since you reviewed it (it now has ${p.buy.length} product${p.buy.length === 1 ? '' : 's'}). Check it again, then publish.`, 409);
      }

      const cfg = rules.normaliseConfig(offer.sub_type, offer.offer_config_json);
      const range = [offer.starts_on, addDays(offer.ends_on, 1)];
      for (const b of p.buy) {
        await tx.query(
          `INSERT INTO offer_pool_items (offer_id, brand_id, pool, product_id, source_id, quantity, price_at_publish, lock_days)
           VALUES ($1,$2,'buy',$3,$4,$5,$6, daterange($7::date, $8::date, '[)'))`,
          [offer.id, brandId, b.id, b.source_id, offer.sub_type === 'fixed' ? (cfg.quantities[b.id] || 1) : 1, b.price, range[0], range[1]]);
      }
      for (const g of p.gift) {
        await tx.query(
          `INSERT INTO offer_pool_items (offer_id, brand_id, pool, product_id, gift_item_id, source_id, gift_limit, price_at_publish, lock_days)
           VALUES ($1,$2,'gift',$3,$4,$5,$6,$7, daterange($8::date, $9::date, '[)'))`,
          [offer.id, brandId, g.kind === 'product' ? g.id : null, g.kind === 'gift_item' ? g.id : null, g.source_id,
            g.kind === 'product' ? (cfg.gift_limits[g.id] || null) : null, g.kind === 'product' ? g.price : g.value, range[0], range[1]]);
      }
      await tx.query(
        `UPDATE brand_offers SET status = 'published', published_at = now(), offer_config_json = $2::jsonb, updated_at = now() WHERE id = $1`,
        [offer.id, JSON.stringify(cfg)]);
      return { offer_id: offer.id, products: p.buy.length, gifts: p.gift.length, display_status: rules.displayStatus({ ...offer, status: 'published' }, today) };
    });
  } catch (e) {
    // The database's lock refused an item another publish took in the same moment (spec D4).
    if (e && e.code === '23P01') {
      const offer = await getOwn(brandId, offerId);
      const p = await pool.resolveDraftPool(offer);
      const named = p.locked[0];
      throw new AppError('PRODUCT_LOCKED', named
        ? `"${named.name}" was just added to "${named.offer_name}". Remove it from this pool or change the dates.`
        : 'A product in this pool was just put into another offer. Check the pool again.', 409);
    }
    throw e;
  }
}

// ── ending early (rules 1.10) ────────────────────────────────────────────────
async function endNow(brandId, offerId, { today = todayInIndia() } = {}) {
  const res = await db.withTransaction(async (tx) => {
    const offer = await getOwn(brandId, offerId, { tx, forUpdate: true });
    const ds = rules.displayStatus(offer, today);
    if (offer.status === 'draft') throw new AppError('OFFER_LOCKED', 'A draft isn\'t running. Delete it instead.', 409);
    if (ds === 'ended') throw new AppError('OFFER_LOCKED', 'This offer has already ended.', 409);
    await tx.query(`UPDATE brand_offers SET status = 'ended', ended_at = now(), updated_at = now() WHERE id = $1`, [offer.id]);
    // Free from today. A Scheduled offer's range becomes empty: nothing was ever locked in use.
    const { rowCount } = await tx.query(
      `UPDATE offer_pool_items SET lock_days = daterange(lower(lock_days), GREATEST(lower(lock_days), $2::date), '[)')
        WHERE offer_id = $1 AND removed_at IS NULL`, [offer.id, today]);
    return { offer, freed: rowCount };
  });
  const brand = await brandName(brandId);
  // creator-terms-v2 (rules 2.8, founder Q1): first it drops out of UNSIGNED invitations (those
  // creators are told, an invitation left empty is withdrawn); then every signed creator is told.
  const drop = await require('./creatorTerms.service').dropEndedOffer(res.offer.id, { offerName: res.offer.name, brandName: brand });
  const told = await tellCreators(res.offer.id, NOTIFY.ended(res.offer.name, brand));
  return { ended: true, freed: res.freed, creators_told: told + drop.dropped, invitations_dropped: drop.dropped, invitations_withdrawn: drop.withdrawn };
}

// ── removing products (rules 1.10; guards: spec D8) ──────────────────────────
async function removalPlan(offer, productIds, tx = db) {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  if (!ids.length) throw new AppError('VALIDATION_ERROR', 'Tick the products to remove.', 422, 'product_ids');
  const frozen = await pool.frozenPool(offer.id, tx);
  const all = [...frozen.buy.map((b) => ({ ...b, pool: 'buy' })), ...frozen.gift.filter((g) => g.kind === 'product').map((g) => ({ ...g, pool: 'gift' }))];
  const byId = new Map(all.map((x) => [x.id, x]));
  const giftItemsById = new Map(frozen.gift.filter((g) => g.kind === 'gift_item').map((g) => [g.id, g]));
  const targets = ids.map((id) => byId.get(id) || (giftItemsById.get(id) && { ...giftItemsById.get(id), pool: 'gift' })).filter(Boolean);
  if (targets.length !== ids.length) throw new AppError('VALIDATION_ERROR', 'One or more of those products are not in this offer.', 422, 'product_ids');

  const buyLeft = frozen.buy.filter((b) => !ids.includes(b.id));
  const giftLeft = frozen.gift.filter((g) => !ids.includes(g.id));
  const cfg = rules.normaliseConfig(offer.sub_type, offer.offer_config_json);
  const refuse = (text) => { throw new AppError('REMOVE_REFUSED', text, 422); };
  if (offer.sub_type === 'fixed' && targets.some((t) => t.pool === 'buy')) refuse('A fixed bundle is exactly these products. To change it, end the offer and build a new one.');
  if (frozen.buy.length && !buyLeft.length) refuse('That would leave the offer with no products. End the offer instead.');
  if ((offer.sub_type === 'pick_any' || offer.sub_type === 'mix_match') && cfg.pick && buyLeft.length < cfg.pick) {
    refuse(`"Pick ${cfg.pick}" needs at least ${cfg.pick} products. End the offer instead.`);
  }
  if (offer.offer_type === 'free_gift' && frozen.gift.length && !giftLeft.length) refuse('That would leave no gifts. End the offer instead.');
  if (offer.offer_type === 'free_gift' && cfg.gift_count && giftLeft.length < cfg.gift_count) {
    refuse(`The shopper gets ${cfg.gift_count} gift${cfg.gift_count > 1 ? 's' : ''}, so at least ${cfg.gift_count} must stay. End the offer instead.`);
  }
  return { targets, buyLeft: buyLeft.length };
}

/** O11 preview: what removing these products touches. */
async function removePreview(brandId, offerId, productIds, { today = todayInIndia() } = {}) {
  const offer = await getOwn(brandId, offerId);
  if (offer.status === 'draft' || rules.displayStatus(offer, today) === 'ended') throw new AppError('OFFER_LOCKED', 'Only a scheduled or live offer can lose products.', 409);
  const plan = await removalPlan(offer, productIds);
  const creators = await creatorsOf(offer.id);
  return {
    products: plan.targets.map((t) => ({ id: t.id, name: t.name })),
    creators: [...new Set(creators.map((c) => c.creator_name))],
    posts: { live: 0, emptied: 0 },
    products_left: plan.buyLeft,
  };
}

async function removeProducts(brandId, offerId, productIds, { today = todayInIndia() } = {}) {
  const res = await db.withTransaction(async (tx) => {
    const offer = await getOwn(brandId, offerId, { tx, forUpdate: true });
    if (offer.status === 'draft' || rules.displayStatus(offer, today) === 'ended') throw new AppError('OFFER_LOCKED', 'Only a scheduled or live offer can lose products.', 409);
    const plan = await removalPlan(offer, productIds, tx);
    const ids = plan.targets.map((t) => t.id);
    await tx.query(
      `UPDATE offer_pool_items SET removed_at = now()
        WHERE offer_id = $1 AND removed_at IS NULL AND (product_id = ANY($2::uuid[]) OR gift_item_id = ANY($2::uuid[]))`,
      [offer.id, ids]);
    await tx.query(`UPDATE brand_offers SET updated_at = now() WHERE id = $1`, [offer.id]);
    return { offer, names: plan.targets.map((t) => t.name) };
  });
  const brand = await brandName(brandId);
  const told = await tellCreators(res.offer.id, NOTIFY.productsRemoved(res.offer.name, brand, res.names), { removed: res.names });
  return { removed: res.names.length, creators_told: told };
}

// ── a product's price changes (rules 1.11) ───────────────────────────────────
/** The live or scheduled offer holding this product now or next, if any. */
async function heldBy(brandId, productId, today, tx = db) {
  const { rows } = await tx.query(
    `SELECT o.id FROM offer_pool_items i JOIN brand_offers o ON o.id = i.offer_id
      WHERE i.brand_id = $1 AND i.product_id = $2 AND i.removed_at IS NULL AND NOT isempty(i.lock_days)
        AND upper(i.lock_days) > $3::date
      ORDER BY lower(i.lock_days) LIMIT 1`, [brandId, productId, today]);
  return rows[0] ? getOwn(brandId, rows[0].id, { tx }) : null;
}

const PRICE_CHECK_KEYS = new Set(['flat_below_cheapest', 'band', 'saving', 'fixed_below_total', 'gift_threshold', 'tier_amount']);

/** O12: before saving a new price, what it touches. Nothing is blocked. */
async function priceImpact(brandId, productId, newPrice, { today = todayInIndia() } = {}) {
  const { rows } = await db.query(`SELECT id, name, price FROM brand_products WHERE id = $1 AND brand_id = $2`, [productId, brandId]);
  const product = rows[0];
  if (!product) throw new AppError('NOT_FOUND', 'Product not found', 404);
  const price = Number(newPrice);
  if (!(price > 0)) throw new AppError('VALIDATION_ERROR', 'Enter a price above ₹0.', 422, 'price');
  const offer = await heldBy(brandId, product.id, today);
  if (!offer) return { product: { id: product.id, name: product.name, price: Number(product.price) }, offer: null };

  const frozen = await pool.frozenPool(offer.id);
  const swap = (list) => list.map((x) => (x.id === product.id ? { ...x, price, value: x.kind === 'product' ? price : x.value } : x));
  const after = rules.publishChecks(offer, { buy: swap(frozen.buy), gift: swap(frozen.gift), conflicts: [] }, today);
  const breaks = after.checks.filter((c) => PRICE_CHECK_KEYS.has(c.key) && !c.ok).map((c) => c.text);
  const creators = await creatorsOf(offer.id);
  const lines = [];
  const d = rules.discountedPrice(offer, price);
  if (d) lines.push(`Shoppers will pay ${rules.inr(d.pays)} with the offer.`);
  const cfg = rules.normaliseConfig(offer.sub_type, offer.offer_config_json);
  if ((offer.sub_type === 'pick_any' || offer.sub_type === 'mix_match') && cfg.price != null) {
    lines.push(`The bundle price stays ${rules.inr(cfg.price)} for any ${cfg.pick}.`);
  }
  if (offer.sub_type === 'fixed' && cfg.price != null) lines.push(`The bundle price stays ${rules.inr(cfg.price)}.`);
  const inGift = frozen.gift.some((g) => g.kind === 'product' && g.id === product.id);
  return {
    product: { id: product.id, name: product.name, price: Number(product.price), new_price: price },
    offer: {
      id: offer.id, name: offer.name, type_label: rules.typeLabel(offer.offer_type, offer.sub_type),
      display_status: rules.displayStatus(offer, today), starts_on: offer.starts_on, ends_on: offer.ends_on,
      as_gift: inGift,
    },
    creators: creators.length,
    posts: 0,
    lines,
    breaks,
  };
}

/** After a price is saved: tell each creator given the offer (rules 1.11 step 3). Never throws. */
async function afterPriceChange(brandId, productId, oldPrice, newPrice, { today = todayInIndia() } = {}) {
  try {
    if (oldPrice == null || newPrice == null || Number(oldPrice) === Number(newPrice)) return 0;
    const offer = await heldBy(brandId, productId, today);
    if (!offer) return 0;
    const { rows } = await db.query(`SELECT name FROM brand_products WHERE id = $1`, [productId]);
    return await tellCreators(offer.id, NOTIFY.priceChanged(rows[0] ? rows[0].name : 'A product', oldPrice, newPrice, offer.name),
      { product_id: productId, old_price: Number(oldPrice), new_price: Number(newPrice) });
  } catch (e) {
    console.error('[offers] price-change notice failed:', e.message);
    return 0;
  }
}

// ── auto-add (rules 1.4; spec D9) ────────────────────────────────────────────
/**
 * A product was just listed. It joins every published, not-ended offer of its brand that has
 * auto-add on and a category-all / filter line matching it — from today (or the start date) —
 * unless it's excluded or another offer holds it. Never throws.
 */
async function autoAddProduct(productId, { today = todayInIndia() } = {}) {
  try {
    const { rows: prow } = await db.query(
      `SELECT bp.id, bp.brand_id, bp.category_node_id, bp.price FROM brand_products bp WHERE bp.id = $1 AND ${pool.LIVE}`, [productId]);
    const product = prow[0];
    if (!product || !product.category_node_id) return 0;
    const { rows: offers } = await db.query(
      `SELECT ${OFFER_COLS} FROM brand_offers o
        WHERE o.brand_id = $1 AND o.engine = 2 AND o.status = 'published' AND o.auto_add = true
          AND o.ends_on >= $2::date AND o.sub_type <> 'fixed'`, [product.brand_id, today]);
    let added = 0;
    for (const raw of offers) {
      const offer = shape(raw);
      if (offer.excluded_product_ids.includes(product.id)) continue;
      const sources = (await pool.listSources(offer.id)).filter((s) => s.pool === 'buy' && pool.CATEGORY_LIVE.has(s.method));
      let match = null;
      for (const s of sources) {
        const found = s.method === 'category_all'
          ? await pool.productsUnder(offer.brand_id, s.category_node_id, {})
          : await pool.productsUnder(offer.brand_id, s.category_node_id, s.filters);
        if (found.some((p) => p.id === product.id)) { match = s; break; }
      }
      if (!match) continue;
      if (offer.sub_type === 'pick_any') {
        const frozen = await pool.frozenPool(offer.id);
        if (frozen.buy.length && frozen.buy[0].leaf_id !== product.category_node_id) continue;
      }
      const from = daysBetween(offer.starts_on, today) > 0 ? today : offer.starts_on;
      const { rowCount } = await db.query(
        `INSERT INTO offer_pool_items (offer_id, brand_id, pool, product_id, source_id, price_at_publish, lock_days, added_by)
         VALUES ($1,$2,'buy',$3,$4,$5, daterange($6::date, $7::date, '[)'), 'auto_add')
         ON CONFLICT DO NOTHING`,
        [offer.id, offer.brand_id, product.id, match.id, product.price, from, addDays(offer.ends_on, 1)]);
      added += rowCount;
    }
    return added;
  } catch (e) {
    console.error('[offers] auto-add failed:', e.message);
    return 0;
  }
}

module.exports = {
  brandIdFor, getOwn, createDraft, updateDraft, deleteDraft, addSource, removeSource,
  creatorsOf, view, list, publish, endNow, removePreview, removeProducts,
  priceImpact, afterPriceChange, autoAddProduct, tellCreators,
};
