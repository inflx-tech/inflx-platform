'use strict';

/**
 * publishGate.service.js — what must be true before a campaign may be published.
 * Contract: features/stage-2-build-a-campaign-from-the-phone (slice 2)
 * Board: 04-preview/mockups/stage2-screens.html panel ⑨ · action ledger #63
 *
 * WHAT WAS THERE BEFORE
 * campaign.controller.publish enforced exactly ONE of the five blockers the board names —
 * the wallet. Read line by line on 2026-08-25. Everything else published happily, and the
 * consequences are not cosmetic:
 *
 *   · a creator with no allocation is contracted and INVISIBLE in the shopping app. Since
 *     Part 4, having something to sell is the gate for appearing at all, so she has a
 *     signed contract and literally nothing to sell.
 *   · a sales set with no offer gives a shopper no reason to buy through her rather than
 *     walk into the shop, which is the entire proposition of a sales collaboration.
 *   · an offer scoped to a product the brand does not list can never fire.
 *
 * WHY A SERVICE AND NOT MORE LINES INSIDE publish()
 * The Review screen has to show these before the brand presses Publish, and publish has to
 * enforce them. Two expressions of the same list is exactly how the screen and the server
 * end up disagreeing about whether a campaign is publishable — the recurring fault this
 * programme has already had to fix four times. One list, two callers.
 *
 * WARNINGS ARE NOT BLOCKERS. Drift from an agreed term is warned, never blocked: a brand
 * may have a good reason to change a term. What must never happen is changing it silently.
 */

// db and offerResolution are required LAZILY inside evaluate(), for the same reason
// campaignRollup does it: the rules are the part worth pinning, and pinning them must not
// need a booted database config. evaluate() takes its connection as an argument, so the
// whole blocker list can be executed against a stubbed catalogue — which is why
// qa/unit/stage2-publish-gate.spec.ts proves the BEHAVIOUR rather than asserting that a
// source file contains a string.
const offerConfig = require('./offerConfig.validator');
// One definition of what a selling set is. It was written out three times by 2026-08-26 —
// here, in collabOwedItems, and inline in campaign.controller.invite. Three copies of one
// rule is how they drift, which is the fault this programme keeps having to fix.
const { SELLING_GOALS } = require('./collabOwedItems.service');

/** A creator row that is out of the running carries no obligations. */
const DEAD_STATUSES = ['declined', 'expired', 'rejected_by_brand', 'slots_filled'];

const blocker = (code, message, field, meta) => ({ code, message, field: field || null, ...(meta || {}) });

/**
 * Every reason this campaign cannot be published, in the order a brand would fix them.
 * Returns { blockers: [], warnings: [] }. Empty blockers means publishable.
 *
 * Read-only. Never throws for a business reason — the caller decides whether to refuse
 * (publish) or to render (the Review screen).
 */
async function evaluate(campaignId, brandId, conn = null) {
  // eslint-disable-next-line global-require
  if (!conn) conn = require('../config/db');
  // eslint-disable-next-line global-require
  const offerResolution = require('./offerResolution.service');

  const blockers = [];
  const warnings = [];

  const { rows: sets } = await conn.query(
    `SELECT id, name, goal, influencer_mode, set_budget
       FROM campaign_sets WHERE campaign_id = $1 ORDER BY name`,
    [campaignId]
  );
  if (!sets.length) {
    blockers.push(blocker('NO_SETS', 'This campaign has no sets yet. Add at least one before publishing.'));
    return { blockers, warnings };
  }

  const setIds = sets.map(s => s.id);
  const { rows: cis } = await conn.query(
    `SELECT ci.id, ci.set_id, ci.status, ci.influencer_id, ci.agreement_id,
            ci.alloc_scope, ci.alloc_product_ids, ci.alloc_category_node_id,
            ci.offer_type, ci.offer_config_json, ci.brand_offer_id, ci.offer_valid_until,
            u.name AS influencer_name,
            a.status AS agreement_status, a.expires_at AS agreement_expires_at
       FROM campaign_influencers ci
       JOIN influencers i ON i.id = ci.influencer_id
       JOIN users u       ON u.id = i.user_id
       LEFT JOIN collab_agreements a ON a.id = ci.agreement_id
      WHERE ci.set_id = ANY($1)
        AND ci.status <> ALL($2::campaign_influencer_status[])`,
    [setIds, DEAD_STATUSES]
  );

  const setById = new Map(sets.map(s => [s.id, s]));
  const sellingSets = sets.filter(s => SELLING_GOALS.includes(s.goal));

  // Global offers reach ANY creator who has the products allocated (Part 4 §4.3), so a
  // brand running a storewide discount has already given every creator a shopper reason.
  // Asking for a per-creator offer on top would be a rule the shopping app does not have.
  // Read through the SAME connection the rest of this evaluation uses, so a stubbed
  // catalogue in a test is not half-real.
  const liveGlobalOffers = sellingSets.length
    ? await offerResolution.fetchLiveGlobalOffers(brandId, conn)
    : [];

  // ── 1 · A creator on a selling set has nothing to sell ─────────────────────
  // Part 4: alloc_scope NULL means the resolver returns no products and she is not
  // surfaced. Publishing her is contracting someone who cannot appear in the shop.
  for (const ci of cis) {
    const set = setById.get(ci.set_id);
    if (!set || !SELLING_GOALS.includes(set.goal)) continue;
    if (!ci.alloc_scope) {
      blockers.push(blocker(
        'NO_ALLOCATION',
        `${ci.influencer_name} has nothing to sell. She would be contracted and invisible in the shopping app — set what she can sell in "${set.name}".`,
        'alloc_scope',
        { set_id: set.id, set_name: set.name, campaign_influencer_id: ci.id, influencer_name: ci.influencer_name }
      ));
    } else if (ci.alloc_scope === 'products' && !(Array.isArray(ci.alloc_product_ids) && ci.alloc_product_ids.length)) {
      blockers.push(blocker(
        'EMPTY_ALLOCATION',
        `${ci.influencer_name} is set to specific products but none were chosen. Pick at least one in "${set.name}".`,
        'alloc_product_ids',
        { set_id: set.id, set_name: set.name, campaign_influencer_id: ci.id, influencer_name: ci.influencer_name }
      ));
    } else if (ci.alloc_scope === 'category' && !ci.alloc_category_node_id) {
      blockers.push(blocker(
        'EMPTY_ALLOCATION',
        `${ci.influencer_name} is set to a category but none was chosen. Pick one in "${set.name}".`,
        'alloc_category_node_id',
        { set_id: set.id, set_name: set.name, campaign_influencer_id: ci.id, influencer_name: ci.influencer_name }
      ));
    }
  }

  // ── 2 · A selling set with no shopper offer anywhere ───────────────────────
  for (const set of sellingSets) {
    const members = cis.filter(ci => ci.set_id === set.id);
    if (!members.length) continue;                       // emptiness is caught below
    const someoneHasOwn = members.some(ci => ci.offer_type || ci.brand_offer_id);
    if (!someoneHasOwn && liveGlobalOffers.length === 0) {
      blockers.push(blocker(
        'NO_SHOPPER_OFFER',
        `"${set.name}" has no shopper offer. Nothing gives a shopper a reason to buy through a creator rather than walk into your shop.`,
        'offer',
        { set_id: set.id, set_name: set.name }
      ));
    }
  }

  // ── 3 · An agreement that is no longer live ────────────────────────────────
  // The common case — an agreement lapsing between being ticked in the wizard and the
  // campaign being published — is refused earlier, by invite, which requires status
  // 'ready'. This catches the rest: an assignment pointing at an agreement that has since
  // been cancelled, or at a row that no longer exists at all. Publishing either would
  // contract someone against terms nobody can now produce.
  for (const ci of cis) {
    if (!ci.agreement_id) continue;                       // a cold invite is unchanged
    if (ci.agreement_status == null) {
      blockers.push(blocker(
        'AGREEMENT_MISSING',
        `${ci.influencer_name}'s agreement no longer exists. Remove her, or agree terms again from the Creators tab.`,
        'agreement_id',
        { campaign_influencer_id: ci.id, influencer_name: ci.influencer_name }
      ));
    } else if (!['ready', 'consumed'].includes(ci.agreement_status)) {
      blockers.push(blocker(
        'AGREEMENT_NOT_LIVE',
        `${ci.influencer_name}'s agreement is ${ci.agreement_status} — the terms are no longer live. Send her back to Talking and agree again.`,
        'agreement_id',
        { campaign_influencer_id: ci.id, influencer_name: ci.influencer_name, agreement_status: ci.agreement_status }
      ));
    }
  }

  // ── 4 · An offer covering products the brand does not list ─────────────────
  // You cannot discount what you do not list. Checked at offer WRITE time already, but
  // a product can be unpublished or deleted between attaching the offer and publishing.
  const withOffers = cis.filter(ci => ci.offer_type && ci.offer_config_json);
  if (withOffers.length) {
    const wanted = new Set();
    const perCi = new Map();
    for (const ci of withOffers) {
      let ids = [];
      try {
        // collectProductIds is (offerType, config) — it switches on the type, because a
        // bundle keeps its products somewhere different from a free gift. And the type is
        // normalised first: an offer written by an older mobile build carries a legacy
        // type word, and an unrecognised type would silently collect nothing, which would
        // turn this blocker into a no-op rather than a failure.
        const type = offerConfig.normalizeOfferType(ci.offer_type);
        ids = offerConfig.collectProductIds(type, ci.offer_config_json || {}) || [];
      } catch { ids = []; }
      ids = ids.map(String).filter(Boolean);
      perCi.set(ci.id, ids);
      ids.forEach(id => wanted.add(id));
    }
    if (wanted.size) {
      const { rows: live } = await conn.query(
        `SELECT id::text AS id FROM brand_products
          WHERE brand_id = $1 AND id::text = ANY($2) AND is_active = true`,
        [brandId, [...wanted]]
      );
      const liveIds = new Set(live.map(r => r.id));
      for (const ci of withOffers) {
        const missing = (perCi.get(ci.id) || []).filter(id => !liveIds.has(id));
        if (missing.length) {
          blockers.push(blocker(
            'OFFER_ON_UNLISTED_PRODUCT',
            `${ci.influencer_name}'s offer covers ${missing.length} product${missing.length === 1 ? '' : 's'} that ${missing.length === 1 ? 'is' : 'are'} not live in your store. You can't discount what you don't list.`,
            'offer_config_json',
            { campaign_influencer_id: ci.id, influencer_name: ci.influencer_name, product_ids: missing }
          ));
        }
      }
    }
  }

  // ── Emptiness, and the expiry warning ──────────────────────────────────────
  //
  // EMPTY_SET IS A WARNING, NOT A BLOCKER — and it was a blocker for about an hour.
  //
  // I added it as a sixth refusal on top of the five the board locks. Auditing the
  // contract afterwards caught what that breaks: `invite` has NO draft guard, so a brand
  // can publish a campaign and invite creators into it afterwards. That is a real,
  // existing workflow — it is how an open-ended sales campaign gets topped up — and
  // refusing to publish an empty set would have taken it away.
  //
  // The wizard still refuses it, because a set you pencilled nobody into is a set you did
  // not finish. That is a CLIENT rule about a half-built wizard, not a server rule about
  // what a campaign may be. The two are different questions and the server must answer the
  // narrower one.
  for (const set of sets) {
    const members = cis.filter(ci => ci.set_id === set.id);
    if (!members.length && (set.influencer_mode || 'handpick') === 'handpick') {
      warnings.push({
        code: 'EMPTY_SET',
        message: `"${set.name}" has no creators in it yet. You can publish and invite them afterwards, but nothing happens in this set until you do.`,
        set_id: set.id,
        set_name: set.name,
      });
    }
  }

  // A warning, deliberately: an agreement close to lapsing is still live, and refusing to
  // publish because of it would be the platform inventing a deadline nobody agreed to.
  const soon = Date.now() + 14 * 24 * 60 * 60 * 1000;
  for (const ci of cis) {
    if (ci.agreement_status === 'ready' && ci.agreement_expires_at
        && new Date(ci.agreement_expires_at).getTime() < soon) {
      const days = Math.max(0, Math.ceil((new Date(ci.agreement_expires_at) - Date.now()) / 86400000));
      warnings.push({
        code: 'AGREEMENT_EXPIRING',
        message: `${ci.influencer_name}'s agreement expires in ${days} day${days === 1 ? '' : 's'}. If it lapses before you publish she drops out, and you would have to ask her again from the start.`,
        campaign_influencer_id: ci.id,
        influencer_name: ci.influencer_name,
      });
    }
  }

  return { blockers, warnings };
}

module.exports = { evaluate, SELLING_GOALS, DEAD_STATUSES };
