'use strict';

/**
 * Item 7 — the terms snapshot. THE SPINE OF THE ITEM.
 * Rules v1.20 §9. Contract: features/item7-agreement · gap report §8
 *
 * Before this, a contract row held the fee and the posting date and nothing
 * else: every other term — the commission, the deliverables, the usage rights,
 * the selling scope, the note — was re-joined live from the invitation every
 * time the agreement was read or the PDF was rendered. Editing an upstream row
 * silently rewrote an agreement that had already been signed.
 *
 * Now the whole agreed term set is copied ONCE, at send, into
 * `contracts.terms_json`, and the agreement and its document read only from
 * there. The invitation may change afterwards; the signed page cannot.
 *
 * The three admin numbers it depends on — the campaign fee percentage, the
 * sales-commission return window and the Remote return window — are stamped
 * into the snapshot at the same moment, exactly as item 6 stamps the round
 * limit and the pool lifetime (approval 4.2).
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const platformSettings = require('./platformSettings.service');
const paymentConfigSvc = require('./paymentConfig.service');
const standardTerms = require('./standardTerms.service');
const campaignState = require('./campaignState.service');
const { splitAmount } = require('../utils/money');
const { deliverablesInWords, usageInWords } = require('./invitationCopy');
const { MIN_SHOPPABLE_POSTS } = require('../config/platformRules');

const jsonObj = (v) => (v && typeof v === 'object' ? v : (() => { try { return JSON.parse(v); } catch { return null; } })());
const jsonArr = (v) => { const o = jsonObj(v); return Array.isArray(o) ? o : []; };
const num = (v) => (v == null ? null : Number(v));

/**
 * Everything the agreement needs, in one query.
 * NOTE the branch: `bb.name` and the city only. `bb.formatted_address` is the
 * street address and must never reach an agreement (rules §5B — the exact
 * address goes with the shoot plan, not before).
 *
 * registration-and-profile §8: the agreement gains the brand's GSTIN, the creator's PAN and
 * both REGISTERED addresses (the brand's main branch — street, pincode, city, state; the
 * creator's city and state), read from whatever is on file when it is generated. A missing
 * value prints empty. The set's shoot branch (bb) stays city-only as before.
 */
const { decrypt } = require('../utils/encrypt');
function decryptQuiet(v) { if (!v) return ''; try { return decrypt(v) || ''; } catch (_) { return ''; } }

const CONTEXT_SQL = `
  SELECT ci.id, ci.status, ci.influencer_id, ci.agreed_fee, ci.commission_pct,
         ci.formats_json, ci.usage_rights_json, ci.brand_note, ci.min_shoppable_posts, ci.shoppable_posts_n,
         ci.alloc_scope, ci.alloc_category, ci.alloc_category_node_id, ci.alloc_product_ids,
         ci.sell_v2, ci.sell_mode, ci.sell_product_ids,
         ci.answered_at,
         cs.id AS set_id, cs.name AS set_name, cs.goal, cs.shoot_mode, cs.go_live_date, cs.branch_id,
         c.id AS campaign_id, c.name AS campaign_name, c.brand_id,
         b.business_name AS brand_name, bu.id AS brand_user_id, bu.name AS brand_user_name,
         -- Item 9: this brand's own campaign fee, or NULL to follow the platform number.
         b.platform_fee_pct AS brand_campaign_fee_pct,
         bu.city AS brand_city, bu.state AS brand_state,
         b.gstin AS brand_gstin,
         mb.formatted_address AS brand_street, mb.pincode AS brand_pincode,
         COALESCE(mrc.name, bu.city) AS brand_reg_city, COALESCE(mrs.name, bu.state) AS brand_reg_state,
         i.full_name AS creator_name, i.instagram_handle, i.city AS creator_city, i.state AS creator_state,
         i.pan_number AS creator_pan_enc,
         COALESCE(irc.name, i.city) AS creator_reg_city, COALESCE(irs.name, i.state) AS creator_reg_state,
         iu.id AS creator_user_id, iu.name AS creator_user_name,
         bb.name AS branch_name, rc.name AS branch_city,
         con.id AS contract_id, con.status AS contract_status, con.reference_no, con.terms_json,
         con.terms_version, con.sent_at, con.sent_by,
         con.influencer_signed_at, con.influencer_signed_name, con.influencer_signed_ip, con.influencer_signed_device,
         con.brand_signed_at, con.brand_signed_name, con.brand_signed_by, con.brand_signed_ip, con.brand_signed_device,
         con.withdrawn_at, con.declined_at, con.decline_reason, con.decline_note, con.expired_at,
         con.locked_amount, con.campaign_fee_amount, con.released_amount, con.money_at,
         con.pdf_url, con.pdf_generated_at, con.pdf_sha256,
         -- Founder, item 9: "still locked" was wrong from the second payment onwards.
         --
         -- contracts.released_amount is written once, at the signature, and never
         -- again — which is right for the ONE thing that reads it as "what the
         -- signature moved" (her Collabs card), and wrong for the other, which
         -- subtracted it from the locked amount and called the result "still
         -- locked". One field was doing two jobs and only one of them worked.
         --
         -- The escrow rows are the ledger, so the running total is taken from them
         -- and nothing has to be kept in step by hand.
         (SELECT COALESCE(SUM(e.amount), 0) FROM escrow_entries e
           WHERE e.campaign_influencer_id = ci.id AND e.status = 'released') AS released_so_far,
         -- Item 12 (Q1, v1.29): what is STILL LOCKED is her fee still in escrow, from the rows —
         -- never locked_amount − released, because locked_amount carries the campaign fee.
         (SELECT COALESCE(SUM(e.amount), 0) FROM escrow_entries e
           WHERE e.campaign_influencer_id = ci.id AND e.status NOT IN ('released', 'refunded')) AS fee_in_escrow
    FROM campaign_influencers ci
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN brands b ON b.id = c.brand_id
    JOIN users bu ON bu.id = b.user_id
    JOIN influencers i ON i.id = ci.influencer_id
    JOIN users iu ON iu.id = i.user_id
    LEFT JOIN brand_branches bb ON bb.id = cs.branch_id
    LEFT JOIN ref_cities rc ON rc.id = bb.city_id
    LEFT JOIN brand_branches mb ON mb.brand_id = b.id AND mb.is_main
    LEFT JOIN ref_cities mrc ON mrc.id = mb.city_id
    LEFT JOIN ref_states mrs ON mrs.id = mb.state_id
    LEFT JOIN ref_cities irc ON irc.id = i.city_id
    LEFT JOIN ref_states irs ON irs.id = COALESCE(i.state_id, irc.state_id)
    LEFT JOIN contracts con ON con.campaign_influencer_id = ci.id
   WHERE ci.id = $1`;

/** Load the row behind an agreement, or null. `client` may be a transaction. */
async function loadContext(ciId, client = db) {
  const { rows } = await client.query(CONTEXT_SQL, [ciId]);
  return rows[0] || null;
}

/** The products named in a "chosen products" selling scope. */
async function productNames(ids, client = db) {
  const list = jsonArr(ids);
  if (!list.length) return [];
  const { rows } = await client.query(
    `SELECT name FROM brand_products WHERE id = ANY($1::uuid[]) ORDER BY name`, [list]
  );
  return rows.map(r => r.name);
}

function scopeWords(scope, categoryName, products) {
  if (scope === 'category') return categoryName ? `Anything in ${categoryName}` : 'One category';
  if (scope === 'products') return products.length ? products.join(', ') : 'Chosen products';
  return 'Anything in the store';
}

/**
 * INFLX-2026-00123. From a sequence, so two simultaneous sends can never
 * collide and no number is ever reused. Gaps are fine; duplicates are not.
 */
async function nextReference(client = db) {
  const { rows } = await client.query(`SELECT nextval('contract_reference_seq') AS n`);
  const n = String(rows[0].n).padStart(5, '0');
  return `INFLX-${new Date().getFullYear()}-${n}`;
}

/**
 * What the brand's signature will cost, and what she will be paid.
 * Rules v1.20 §3 and §9, and §10's funding gate.
 *
 *   Pay for Content — the fee PLUS the INFLX campaign fee, locked together.
 *   Hybrid          — the fixed fee alone. No campaign fee on a Hybrid amount.
 *   Pay for Sale    — nothing. No fixed money, so no gate at all.
 *
 * The creator's three payments always sum EXACTLY to the fee, and nothing is
 * ever deducted from them.
 */
function moneyFor(goal, fee, campaignFeePct, tranchePcts) {
  const f = Number(fee) || 0;
  if (goal === 'conversion' || f <= 0) {
    return { gate: false, fee: 0, campaignFeePct: 0, campaignFee: 0, totalToLock: 0, split: null, splitPct: tranchePcts };
  }
  // No campaign fee is charged on a Hybrid fixed amount (rules §3, §10).
  const pct = goal === 'engagement' ? Number(campaignFeePct) || 0 : 0;
  const campaignFee = Math.round(f * pct) / 100;
  const [t1, t2, t3] = splitAmount(f, tranchePcts);
  return {
    gate: true,
    fee: f,
    campaignFeePct: pct,
    campaignFee,
    totalToLock: Math.round((f + campaignFee) * 100) / 100,
    split: { t1, t2, t3 },
    splitPct: tranchePcts,
  };
}

/**
 * Item 9 — the campaign fee that applies to one brand.
 *
 * A brand may carry its own percentage, set by an admin. NULL means it has none
 * and follows the platform-wide number, which is the ordinary case.
 *
 * ONE function, because two doors ask this question — the agreement, and the
 * older website pre-check that tells a brand what it must have in its wallet.
 * Before item 9 they answered differently: the website read the brand column and
 * the agreement ignored it, so an override would have been quoted and then never
 * charged. Nobody had used one, which is the only reason it never showed.
 */
function campaignFeePctFor(brandOverridePct, settings) {
  if (brandOverridePct !== null && brandOverridePct !== undefined && brandOverridePct !== '') {
    return Number(brandOverridePct);
  }
  return Number(settings.campaign_fee_pct.value);
}

/**
 * What a brand must have available to sign this collaboration, answered once for
 * every door. Pay for Sale locks nothing; Hybrid locks the fixed fee with no
 * campaign fee; Pay for Content locks the fee plus the campaign fee (rules §10).
 */
async function totalToLockFor(goal, fee, brandOverridePct) {
  const [settings, cfg] = await Promise.all([platformSettings.getAll(), paymentConfigSvc.getConfig()]);
  const money = moneyFor(
    goal, fee,
    campaignFeePctFor(brandOverridePct, settings),
    [cfg.tranche1Pct, cfg.tranche2Pct, cfg.tranche3Pct]
  );
  return { totalToLock: money.totalToLock, campaignFee: money.campaignFee, campaignFeePct: money.campaignFeePct, gate: money.gate };
}

/**
 * Build the snapshot from the invitation. Pure of side effects — the caller
 * decides whether to store it (send) or merely show it (preview).
 */
async function buildSnapshot(ctx, client = db) {
  const goal = ctx.goal;
  const selling = goal === 'conversion' || goal === 'hybrid';
  const settings = await platformSettings.getAll();
  const cfg = await paymentConfigSvc.getConfig();
  const terms = await standardTerms.current();

  // Item 9: the brand's own campaign fee when an admin has set one, the
  // platform-wide number otherwise. NULL means "no override" — see migration 186.
  // Whichever wins is STAMPED into the snapshot below, so a later change to
  // either number never moves a collaboration that is already signed.
  const campaignFeePct = campaignFeePctFor(ctx.brand_campaign_fee_pct, settings);
  const tranchePcts = [cfg.tranche1Pct, cfg.tranche2Pct, cfg.tranche3Pct];
  const money = moneyFor(goal, ctx.agreed_fee, campaignFeePct, tranchePcts);

  const products = ctx.alloc_scope === 'products' ? await productNames(ctx.alloc_product_ids, client) : [];
  // creator-terms-v2 (rules 2.7): her offers as of signing + her products without offers.
  // Item 21 (rules v1.34 §9): a Pay for Content collaboration names what she posts about the same way.
  const sellV2 = (selling || goal === 'engagement') && ctx.sell_v2
    ? await require('./creatorTerms.service').agreementSell({ id: ctx.id, sell_v2: true, sell_mode: ctx.sell_mode, sell_product_ids: ctx.sell_product_ids })
    : null;
  const usage = jsonObj(ctx.usage_rights_json);
  const deliverables = jsonArr(ctx.formats_json).map(d => ({ type: d.type, count: Number(d.count) || 1 }));
  const cutoff = campaignState.cutoffFor(ctx.go_live_date);
  const remote = ctx.shoot_mode === 'shipment' || ctx.shoot_mode === 'remote';

  return {
    // ---- always -------------------------------------------------------
    aim: goal,
    campaignName: ctx.campaign_name,
    setName: ctx.set_name,
    postingDate: ctx.go_live_date,
    cutoff,
    shootMode: ctx.shoot_mode,
    // Store Visit names the branch and its city. NEVER the street address.
    branchName: remote ? null : (ctx.branch_name || null),
    branchCity: remote ? null : (ctx.branch_city || null),
    parties: {
      brand: {
        name: ctx.brand_name,
        city: ctx.brand_city || null,
        state: ctx.brand_state || null,
        // registration-and-profile §8 — printed when on file, empty when not. No gate.
        gstin: ctx.brand_gstin || '',
        address: [ctx.brand_street, ctx.brand_reg_city, ctx.brand_reg_state, ctx.brand_pincode].filter(Boolean).join(', '),
      },
      creator: {
        name: ctx.creator_name || ctx.creator_user_name || null,
        city: ctx.creator_city || null,
        state: ctx.creator_state || null,
        handle: ctx.instagram_handle || null,
        pan: decryptQuiet(ctx.creator_pan_enc),
        address: [ctx.creator_reg_city, ctx.creator_reg_state].filter(Boolean).join(', '),
      },
    },

    // ---- the money ----------------------------------------------------
    money: {
      fee: money.fee || null,
      commissionPct: selling && ctx.commission_pct != null ? Number(ctx.commission_pct) : null,
      campaignFeePct: money.campaignFeePct,
      campaignFee: money.campaignFee,
      totalToLock: money.totalToLock,
      split: money.split,
      splitPct: money.splitPct,
      // Pay for Sale and Hybrid: when commission actually reaches her.
      // shopper-walk-fixes (W13): the return window is in hours now (INFLX's admin may set hours or
      // days). The sentence is written here, once, and stamped with the agreement; the day count is
      // kept (rounded up) for a phone that has not updated yet.
      commissionAfterDays: selling ? Math.max(1, Math.ceil(Number(cfg.returnWindowHours) / 24)) : null,
      commissionAfterHours: selling ? Number(cfg.returnWindowHours) : null,
      commissionPaidWords: selling ? `After the ${require('./returnWindow.service').adjective(cfg.returnWindowHours)} return window` : null,
    },

    // ---- the work -----------------------------------------------------
    work: {
      deliverables: goal === 'engagement' ? deliverables : null,
      deliverablesWords: goal === 'engagement' ? deliverablesInWords(jsonArr(ctx.formats_json)) : null,
      usageRights: goal === 'engagement' && usage && usage.on
        ? { on: true, durationDays: usage.duration_days == null ? null : Number(usage.duration_days), places: usage.places || [], words: usageInWords(usage) }
        : null,
      minShoppablePosts: selling
        ? (ctx.min_shoppable_posts != null ? Number(ctx.min_shoppable_posts) : MIN_SHOPPABLE_POSTS)
        : null,
      // Item 21 (rules v1.34 §7A, §12.2): the number of shoppable posts the brand asked for, frozen here.
      shoppablePosts: goal === 'engagement' && ctx.sell_v2 && ctx.shoppable_posts_n != null ? Number(ctx.shoppable_posts_n) : null,
    },

    // ---- what she may sell (Pay for Sale and Hybrid) --------------------
    sell: sellV2 ? sellV2 : selling ? {
      scope: ctx.alloc_scope || 'store',
      categoryName: ctx.alloc_category || null,
      products,
      words: scopeWords(ctx.alloc_scope || 'store', ctx.alloc_category, products),
    } : null,

    // ---- Remote return terms -------------------------------------------
    returnTerms: remote ? {
      days: settings.remote_return_days.value,
      brandPaysShipping: true,
    } : null,

    // ---- the brand's own note, when there is one ------------------------
    note: ctx.brand_note || null,

    // ---- stamped ---------------------------------------------------------
    termsVersion: terms.version,
    generatedAt: new Date().toISOString(),
    // The follower offer, the campaign description and the branch street
    // address are DELIBERATELY absent. Rules §9: "The Follower Offer never
    // appears." They are excluded here, at snapshot time, so no renderer can
    // reintroduce them by accident.
    // creator-terms-v2: for the NEW terms, rules 2.7 replaces that rule: the agreement lists her
    // offers as of signing (sell.offers), with the "offers end" line. Old rows are unchanged.
  };
}

module.exports = {
  loadContext, buildSnapshot, moneyFor, nextReference, scopeWords, CONTEXT_SQL,
  campaignFeePctFor, totalToLockFor,
};
