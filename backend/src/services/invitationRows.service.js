'use strict';

/**
 * Item 5 — the read shapes: a set's creators grouped for the brand (I9), one invitation for the
 * brand (I10), the creator's Invites / Done lists (I11, I15) and one invitation for the creator
 * (I12, I13). Item 6 adds "Your move" and "Negotiating" as the first two groups (N20), the pool
 * states on the creator's cards (N12, N17) and why Counter is hidden (N19). Nothing here writes.
 * Contract: features/item5-invitations · features/item6-negotiation · prompt §5 A9, A10, A13, A14
 *
 * PRIVACY. The creator shapes select exactly what she may see: the brand's name and logo, the
 * campaign and set names, the set's Aim / mode / city / dates, HER terms, the note. Never the
 * campaign description, the budgets, the group she came from, who sent it, other creators, or
 * the brand's warnings. The brand shapes never carry the reason a creator failed eligibility.
 */

const db = require('../config/db');
const { resolveAvatars } = require('../utils/avatarResolver');
const campaignState = require('./campaignState.service');
const paymentConfigSvc = require('./paymentConfig.service');
const { SIGNED_CONTRACT_SQL } = require('./collabState');
const { DEAD_STATUSES } = require('./collabOwedItems.service');
const { calendarDay, todayInIndia, daysBetween, isBefore, endOfIndiaDay } = require('../utils/indiaDay');
const { MIN_SHOPPABLE_POSTS } = require('../config/platformRules');
const { deliverablesInWords, usageInWords, declineLabel } = require('./invitationCopy');
const { splitAmount } = require('../utils/money');
// Item 7 — the agreement's own sentences. Contract: features/item7-agreement
const { BRAND: BRAND7, CREATOR: CREATOR7 } = require('./agreementCopy');
// Item 10 — the store visit's stage and one-line sentence for her Active card (V4).
const shootPlan = require('./shootPlan.service');

/* ────────────────────────────────────────────────────────── grouping */

/** The N20 / I9 groups in display order. */
const GROUP_ORDER = ['yourMove', 'negotiating', 'accepted', 'signed', 'waiting', 'deferred', 'declined', 'expired', 'withdrawn'];
const GROUP_TITLE = {
  yourMove: 'Your move', negotiating: 'Negotiating', accepted: 'Accepted, waiting for the agreement', signed: 'Signed',
  waiting: 'Waiting to answer', deferred: 'Moved to your pool', declined: 'Declined', expired: 'Expired', withdrawn: 'Withdrawn and closed',
};
const STATUS_GROUP = {
  invited: 'waiting', applied: 'waiting', negotiating: 'negotiating',
  accepted: 'accepted', contracted: 'accepted', active: 'accepted', completed: 'accepted',
  deferred: 'deferred', declined: 'declined', rejected_by_brand: 'declined',
  expired: 'expired', slots_filled: 'expired', withdrawn: 'withdrawn', removed: 'withdrawn',
};
/**
 * Item 6: a row is the brand's move when an open thread waits on the brand or a move request is
 * unanswered; an open thread waiting on the creator is "Negotiating" (blue, Waiting chip).
 */
function groupOf(r) {
  if (r.signed_both) return 'signed';
  const threadOpen = !!r.neg_id && !r.neg_outcome;
  const movePending = !!r.move_requested_at && !r.move_answer && ['invited', 'negotiating'].includes(r.status);
  // Item 7 (P1): TWO different "your move"s sit together — one creator needs an
  // agreement sent, another has signed and is waiting for the brand.
  const agreementOwed = r.contract_status === 'draft' && ['accepted', 'applied'].includes(r.status);
  const hersSigned = !!r.creator_signed_at && !r.brand_signed_at && r.contract_status === 'pending_brand';
  if (movePending || hersSigned || agreementOwed || (threadOpen && r.neg_turn === 'brand')) return 'yourMove';
  if (threadOpen) return 'negotiating';
  // An agreement out and unsigned is her move, not a dead row: "Waiting for the creator".
  if (r.contract_status === 'pending_influencer') return 'waiting';
  return STATUS_GROUP[r.status] || 'waiting';
}
const PER_GROUP = 50;

/* ─────────────────────────────────────────────────────────── helpers */

const inr = (n) => (n == null ? null : Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }));
const pctText = (p) => (p == null ? null : `${Number(p) % 1 === 0 ? Number(p) : Number(p).toFixed(1)}%`);
const jsonArr = (v) => (Array.isArray(v) ? v : (typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch (_) { return []; } })() : []));
const jsonObj = (v) => (v && typeof v === 'object' ? v : (typeof v === 'string' ? (() => { try { return JSON.parse(v); } catch (_) { return null; } })() : null));

/** "whole store" / "Sarees" / "3 products" */
function scopeWords(r, products) {
  if (r.alloc_scope === 'category') return r.alloc_category || 'a category';
  if (r.alloc_scope === 'products') { const n = (products && products.length) || jsonArr(r.alloc_product_ids).length; return `${n} ${n === 1 ? 'product' : 'products'}`; }
  return 'whole store';
}
function offerWords(r) {
  if (r.brand_offer_id) return r.offer_name || 'saved offer';
  if (r.offer_type) return 'special offer';
  return 'no offer';
}
/** The one-line terms summary the brand reads on I8 / I9. */
function termsLine(r, goal) {
  if (goal === 'engagement') return [r.agreed_fee != null ? `₹${inr(r.agreed_fee)}` : null, deliverablesInWords(jsonArr(r.formats_json))].filter(Boolean).join(' · ');
  const money = goal === 'hybrid' ? [r.agreed_fee != null ? `₹${inr(r.agreed_fee)}` : null, pctText(r.commission_pct)].filter(Boolean).join(' + ') : pctText(r.commission_pct);
  return [money, scopeWords(r), offerWords(r)].filter(Boolean).join(' · ');
}
/** A turn snapshot as one line ("13%", "₹12,000 · 1 reel, 1 story", "₹5,000 + 10%"). */
function snapshotLine(goal, s) {
  if (!s) return null;
  if (goal === 'engagement') return [s.fee != null ? `₹${inr(s.fee)}` : null, deliverablesInWords(s.deliverables)].filter(Boolean).join(' · ');
  if (goal === 'hybrid') return [s.fee != null ? `₹${inr(s.fee)}` : null, pctText(s.commissionPct)].filter(Boolean).join(' + ');
  return pctText(s.commissionPct);
}

async function productNames(ids) {
  const list = jsonArr(ids).filter(Boolean);
  if (!list.length) return [];
  const { rows } = await db.query(`SELECT id, name, price FROM brand_products WHERE id = ANY($1::uuid[])`, [list]);
  const by = new Map(rows.map(r => [r.id, r]));
  return list.map(id => ({ id, name: by.get(id) ? by.get(id).name : null, price: by.get(id) && by.get(id).price != null ? Number(by.get(id).price) : null }));
}

/** The terms exactly as sent — the same block for the brand's I10 and the creator's I12/I13. */
async function termsBlock(r, goal) {
  const usage = jsonObj(r.usage_rights_json);
  const selling = goal === 'conversion' || goal === 'hybrid';
  const products = r.alloc_scope === 'products' ? await productNames(r.alloc_product_ids) : [];
  return {
    goal,
    commissionPct: selling && r.commission_pct != null ? Number(r.commission_pct) : null,
    fee: goal !== 'conversion' && r.agreed_fee != null ? Number(r.agreed_fee) : null,
    scope: selling ? { kind: r.alloc_scope || 'store', categoryName: r.alloc_category || null, categoryNodeId: r.alloc_category_node_id || null, products, words: scopeWords(r, products) } : null,
    offer: selling ? {
      kind: r.brand_offer_id ? 'library' : (r.offer_type ? 'special' : 'none'),
      name: r.brand_offer_id ? (r.offer_name || null) : (r.offer_type ? 'Special offer' : null),
      offerType: r.offer_type || null, config: jsonObj(r.offer_config_json),
      validFrom: r.offer_valid_from || null, validUntil: r.offer_valid_until || null,
    } : null,
    // Item 6: the minimum stamped at send (rules §7B); the constant for rows sent before it.
    shoppablePostsMin: selling ? (r.min_shoppable_posts != null ? Number(r.min_shoppable_posts) : MIN_SHOPPABLE_POSTS) : null,
    deliverables: goal === 'engagement' ? jsonArr(r.formats_json).map(d => ({ type: d.type, count: Number(d.count) || 1 })) : null,
    deliverablesWords: goal === 'engagement' ? deliverablesInWords(jsonArr(r.formats_json)) : null,
    usageRights: goal === 'engagement' && usage && usage.on ? { on: true, durationDays: usage.duration_days == null ? null : Number(usage.duration_days), places: usage.places || [], words: usageInWords(usage) } : null,
    note: r.brand_note || null,
  };
}

const NEG_JOIN = `
    LEFT JOIN LATERAL (
      SELECT n.id AS neg_id, n.current_turn AS neg_turn, n.outcome AS neg_outcome, n.round_limit AS neg_round_limit, n.ended_at AS neg_ended_at,
             (SELECT count(*)::int FROM negotiation_turns t WHERE t.negotiation_id = n.id AND t.kind = 'counter') AS neg_counters,
             lc.terms_json AS neg_last_terms, lc.sent_by AS neg_last_by, lc.created_at AS neg_last_at
        FROM negotiations n
        LEFT JOIN LATERAL (SELECT t.terms_json, t.sent_by, t.created_at FROM negotiation_turns t WHERE t.negotiation_id = n.id AND t.kind = 'counter' ORDER BY t.created_at DESC LIMIT 1) lc ON true
       WHERE n.campaign_influencer_id = ci.id LIMIT 1
    ) neg ON true`;

const ROW_SELECT = `
  SELECT ci.id, ci.influencer_id, ci.status, ci.agreed_fee, ci.commission_pct,
         ci.alloc_scope, ci.alloc_category, ci.alloc_category_node_id, ci.alloc_product_ids,
         ci.offer_type, ci.offer_config_json, ci.brand_offer_id, ci.offer_valid_from, ci.offer_valid_until,
         ci.formats_json, ci.brand_note, ci.usage_rights_json, ci.agreement_id, ci.min_shoppable_posts, ci.pool_entry_id,
         ci.invited_at, ci.created_at, ci.answered_at, ci.declined_reason, ci.declined_note,
         ci.deferred_go_live_date, ci.deferred_shoot_mode, ci.deferred_at, ci.deferred_note, ci.move_requested_at, ci.move_answer, ci.move_answered_at,
         ci.withdrawn_at, ci.removed_at,
         ci.source, ci.source_group_id, g.name AS source_group_name,
         COALESCE(i.full_name, u.name) AS name, i.profile_image_r2_key, i.instagram_handle,
         bo.name AS offer_name,
         con.signed_both, con.signed_at, con.contract_id, con.contract_status,
         con.agreement_sent_at, con.reference_no, con.creator_signed_at, con.brand_signed_at,
         neg.*
    FROM campaign_influencers ci
    JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
    LEFT JOIN brand_offers bo ON bo.id = ci.brand_offer_id
    LEFT JOIN influencer_groups g ON g.id = ci.source_group_id
    LEFT JOIN LATERAL (
      SELECT con.id AS contract_id, con.status AS contract_status,
             (${SIGNED_CONTRACT_SQL}) AS signed_both,
             GREATEST(con.influencer_signed_at, con.brand_signed_at) AS signed_at,
             -- Item 7: the set screen needs to tell "sent and waiting" from
             -- "she signed, your move" from "signed by both".
             con.sent_at AS agreement_sent_at, con.reference_no,
             con.influencer_signed_at AS creator_signed_at, con.brand_signed_at,
             -- What the brand's signature actually moved. released_amount is written by
             -- contractSign.brandSignInTx at the moment the first tranche is paid, so it is the
             -- money itself and not a recalculation of it.
             con.released_amount, con.locked_amount, con.influencer_fee
        FROM contracts con WHERE con.campaign_influencer_id = ci.id ORDER BY con.created_at DESC LIMIT 1
    ) con ON true
    ${NEG_JOIN}`;

function negotiationOf(r, goal) {
  if (!r.neg_id) return null;
  const last = jsonObj(r.neg_last_terms);
  return {
    id: r.neg_id, open: !r.neg_outcome, whoseMove: r.neg_outcome ? null : r.neg_turn, outcome: r.neg_outcome || null, endedAt: r.neg_ended_at || null,
    roundLimit: r.neg_round_limit != null ? Number(r.neg_round_limit) : null, countersUsed: Number(r.neg_counters || 0),
    lastCounter: last ? { by: r.neg_last_by, at: r.neg_last_at, line: snapshotLine(goal, last) } : null,
  };
}
function moveRequestOf(r) {
  if (!r.move_requested_at) return null;
  return { goLiveDate: r.deferred_go_live_date ? calendarDay(r.deferred_go_live_date) : null, shootMode: r.deferred_shoot_mode || null, note: r.deferred_note || null, requestedAt: r.move_requested_at, answer: r.move_answer || null, answeredAt: r.move_answered_at || null };
}

function brandRow(r, goal) {
  const group = groupOf(r);
  return {
    id: r.id, influencerId: r.influencer_id, name: r.name, avatarUrl: r.avatar_url || null, instagramHandle: r.instagram_handle || null,
    status: r.status, group,
    termsLine: termsLine(r, goal),
    sentAt: r.invited_at || r.created_at, answeredAt: r.answered_at || null, signedAt: r.signed_at || null,
    declineReason: r.declined_reason || null, declineReasonLabel: declineLabel(r.declined_reason), declineNote: r.declined_note || null,
    deferredGoLiveDate: r.deferred_go_live_date ? calendarDay(r.deferred_go_live_date) : null, deferredShootMode: r.deferred_shoot_mode || null, deferredAt: r.deferred_at || null,
    withdrawnAt: r.withdrawn_at || null, removedAt: r.removed_at || null,
    source: r.source || null, sourceGroup: r.source_group_id ? { id: r.source_group_id, name: r.source_group_name || null } : null,
    negotiation: negotiationOf(r, goal), moveRequest: moveRequestOf(r),
    actions: {
      withdraw: r.status === 'invited' && !r.move_requested_at,
      // Every pre-signed status, deferred and applied included (founder Q10); never a dead row.
      remove: !r.signed_both && !DEAD_STATUSES.includes(r.status),
      viewTerms: true,
      thread: !!r.neg_id || !!r.move_requested_at,
      // Item 7 (P1) — the brand's two agreement moves, and the one thing it
      // may still take back. Only one of these is ever true at a time.
      sendAgreement: r.contract_status === 'draft' && ['accepted', 'applied'].includes(r.status) && !r.signed_both,
      signAgreement: r.contract_status === 'pending_brand' && !!r.creator_signed_at && !r.brand_signed_at,
      withdrawAgreement: r.contract_status === 'pending_influencer' && !r.creator_signed_at,
      viewAgreement: !!r.contract_id && !!r.agreement_sent_at,
      downloadAgreement: !!r.signed_both,
    },
    // Item 7 — the line under the row, in the brand's words (P1).
    agreement: r.contract_id ? {
      reference: r.reference_no || null,
      status: r.contract_status,
      sentAt: r.agreement_sent_at || null,
      creatorSignedAt: r.creator_signed_at || null,
      brandSignedAt: r.brand_signed_at || null,
      line: r.signed_both ? BRAND7.signedByBoth(r.brand_signed_at)
        : r.creator_signed_at ? BRAND7.sheSignedYouComplete(r.name, r.creator_signed_at)
        : r.agreement_sent_at ? BRAND7.agreementSent(r.agreement_sent_at)
        : null,
    } : null,
  };
}

/** A9 — the set's creators grouped in the N20 order, at most 50 per group with the real count. */
async function creatorsForSet(setId, goal) {
  const { rows } = await db.query(`${ROW_SELECT} WHERE ci.set_id = $1 ORDER BY ci.created_at DESC`, [setId]);
  await resolveAvatars(rows, { urlField: 'avatar_url', keyField: 'profile_image_r2_key' });
  const groups = {};
  for (const key of GROUP_ORDER) groups[key] = { key, title: GROUP_TITLE[key], count: 0, rows: [], more: 0 };
  for (const r of rows) {
    const shaped = brandRow(r, goal);
    const g = groups[shaped.group];
    g.count += 1;
    if (g.rows.length < PER_GROUP) g.rows.push(shaped); else g.more += 1;
  }
  return { order: GROUP_ORDER, groups, total: rows.length };
}

/** A10 — one invitation as the brand sees it: the row, the terms as sent, the timeline. */
async function invitationForBrand(ciId, setId, goal) {
  const { rows } = await db.query(`${ROW_SELECT} WHERE ci.id = $1 AND ci.set_id = $2`, [ciId, setId]);
  if (!rows[0]) return null;
  await resolveAvatars(rows, { urlField: 'avatar_url', keyField: 'profile_image_r2_key' });
  const r = rows[0];
  return { ...brandRow(r, goal), terms: await termsBlock(r, goal), contract: r.contract_id ? { id: r.contract_id, status: r.contract_status, signedByBoth: !!r.signed_both } : null };
}

/* ───────────────────────────────────────────────────── creator side */

const CREATOR_SELECT = `
  SELECT ci.id, ci.status, ci.agreed_fee, ci.commission_pct, ci.agreement_id, ci.min_shoppable_posts, ci.pool_entry_id,
         ci.alloc_scope, ci.alloc_category, ci.alloc_category_node_id, ci.alloc_product_ids,
         ci.offer_type, ci.offer_config_json, ci.brand_offer_id, ci.offer_valid_from, ci.offer_valid_until,
         ci.formats_json, ci.brand_note, ci.usage_rights_json,
         ci.invited_at, ci.created_at, ci.answered_at, ci.declined_reason, ci.declined_note, ci.withdrawn_at, ci.removed_at, ci.deferred_at,
         ci.deferred_go_live_date, ci.deferred_shoot_mode, ci.deferred_note, ci.move_requested_at, ci.move_answer, ci.move_answered_at,
         cs.id AS set_id, cs.name AS set_name, cs.goal, cs.shoot_mode, cs.go_live_date, cs.expired_at, cs.influencer_mode,
         c.id AS campaign_id, c.name AS campaign_name, c.allow_negotiation,
         b.business_name AS brand_name, b.logo_url AS brand_logo_url,
         rc.name AS city_name,
         bo.name AS offer_name,
         con.signed_both, con.contract_id, con.contract_status, con.reference_no,
         con.agreement_sent_at, con.creator_signed_at, con.brand_signed_at,
         -- The money itself, so her card can say what the signature moved rather than zero.
         con.released_amount, con.influencer_fee,
         -- Item 10: the shoot's stage inputs (the lateral below); the projection is explicit, so name them.
         pe.shoot_id, pe.pe_shoot_mode, pe.shoot_status, pe.visit_scheduled_at,
         pe.plan_sent_at, pe.time_agreed_at, pe.influencer_completed_at, pe.brand_completed_at, pe.auto_confirmed_at,
         neg.*,
         pf.state AS pool_from_state, pf.expires_at AS pool_from_expires_at, pf.lifetime_days AS pool_from_lifetime, pf.id AS pool_from_id,
         ps.agreed_at AS pool_sent_agreed_at, ps.wants_go_live_date AS pool_sent_wants_date, ps.agreed_terms_json AS pool_sent_terms,
         ps.from_pitch_id AS pool_sent_from_pitch
    FROM campaign_influencers ci
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN brands b ON b.id = c.brand_id
    LEFT JOIN brand_branches bb ON bb.id = cs.branch_id
    LEFT JOIN ref_cities rc ON rc.id = bb.city_id
    LEFT JOIN brand_offers bo ON bo.id = ci.brand_offer_id
    LEFT JOIN LATERAL (
      SELECT (${SIGNED_CONTRACT_SQL}) AS signed_both,
             -- Item 7: her card has to know whether the agreement has arrived,
             -- whether she has signed it, and whether the brand has.
             con.id AS contract_id, con.status AS contract_status, con.reference_no,
             con.sent_at AS agreement_sent_at,
             con.influencer_signed_at AS creator_signed_at, con.brand_signed_at,
             -- What the brand's signature actually moved. released_amount is written by
             -- contractSign.brandSignInTx at the moment the first tranche is paid, so it is the
             -- money itself and not a recalculation of it.
             con.released_amount, con.locked_amount, con.influencer_fee
        FROM contracts con WHERE con.campaign_influencer_id = ci.id ORDER BY con.created_at DESC LIMIT 1
    ) con ON true
    -- Item 10: the shoot, so her Active card can carry the one line that matters (V4).
    LEFT JOIN LATERAL (
      SELECT pe.id AS shoot_id, pe.mode AS pe_shoot_mode, pe.status AS shoot_status, pe.visit_scheduled_at,
             pe.plan_sent_at, pe.time_agreed_at, pe.influencer_completed_at, pe.brand_completed_at, pe.auto_confirmed_at
        FROM production_events pe WHERE pe.contract_id = con.contract_id
    ) pe ON true
    ${NEG_JOIN}
    LEFT JOIN brand_creator_pool pf ON pf.from_ci_id = ci.id
    LEFT JOIN brand_creator_pool ps ON ps.id = ci.pool_entry_id`;

/** Ended, withdrawn and closed cards stay for seven days, then move to Done (APPROVAL.md §4.11). */
const DONE_AFTER_DAYS = 7;

/**
 * The creator's view of one row: her group, when it ended, whether she can still act, and why
 * Counter is hidden when it is (N19: the switch; the rounds; a briefed agreement; an open thread
 * waiting on the brand).
 *   invited · yourMove · negotiating · accepted · pooled · deferred · declined · expired · withdrawn · closed
 */
function creatorState(r, today) {
  const postingDate = r.go_live_date ? calendarDay(r.go_live_date) : null;
  const cutoff = campaignState.cutoffFor(postingDate);
  const closedByCutoff = !!(r.expired_at || (cutoff && isBefore(cutoff, today)));
  const threadOpen = !!r.neg_id && !r.neg_outcome;
  let group;
  let endedAt = null;
  switch (r.status) {
    case 'invited': group = closedByCutoff ? 'expired' : 'invited'; endedAt = closedByCutoff ? (r.expired_at || endOfIndiaDay(cutoff)) : null; break;
    case 'applied': group = closedByCutoff ? 'expired' : 'invited'; endedAt = closedByCutoff ? (r.expired_at || endOfIndiaDay(cutoff)) : null; break;
    case 'negotiating': group = closedByCutoff ? 'expired' : (threadOpen && r.neg_turn === 'influencer' ? 'yourMove' : 'negotiating'); endedAt = closedByCutoff ? (r.expired_at || endOfIndiaDay(cutoff)) : null; break;
    case 'accepted':
      // Item 7 (P4): once the agreement is out it is HER move, and the card says
      // so. Before it arrives she is simply waiting for it.
      if (closedByCutoff && !r.signed_both) { group = 'expired'; endedAt = r.expired_at || endOfIndiaDay(cutoff); }
      else if (r.contract_status === 'pending_influencer' && !r.creator_signed_at) group = 'toSign';
      else if (r.contract_status === 'pending_brand' && r.creator_signed_at) group = 'signedWaiting';
      else group = 'accepted';
      break;
    case 'deferred':
      // Item 6: moved to the pool — waiting there while the entry lives, closed once it expired or was removed.
      group = r.pool_from_state === 'waiting' ? 'pooled' : (r.pool_from_state ? 'closed' : 'deferred');
      endedAt = r.pool_from_state && r.pool_from_state !== 'waiting' ? (r.pool_from_expires_at || r.deferred_at) : null;
      break;
    case 'declined': group = 'declined'; endedAt = r.answered_at || null; break;
    case 'expired': case 'slots_filled': group = 'expired'; endedAt = r.expired_at || (cutoff ? endOfIndiaDay(cutoff) : null); break;
    case 'withdrawn': group = 'withdrawn'; endedAt = r.withdrawn_at; break;
    case 'removed': case 'rejected_by_brand': group = 'closed'; endedAt = r.removed_at || r.move_answered_at || r.neg_ended_at || r.answered_at || null; break;
    default: group = 'signed'; // contracted / active / completed — item 7's Active tab
  }
  const daysLeft = cutoff && !closedByCutoff ? daysBetween(today, cutoff) : null;
  const canAnswer = (r.status === 'invited' || (r.status === 'negotiating' && threadOpen && r.neg_turn === 'influencer')) && !closedByCutoff;
  const roundLimit = r.neg_round_limit != null ? Number(r.neg_round_limit) : null;
  const counters = Number(r.neg_counters || 0);
  let counterHiddenReason = null;
  if (!canAnswer) counterHiddenReason = 'closed';
  else if (r.agreement_id) counterHiddenReason = 'agreement';
  else if (r.influencer_mode === 'open_group') counterHiddenReason = 'open_group';
  else if (!r.neg_id && r.allow_negotiation === false) counterHiddenReason = 'switch_off';
  else if (r.neg_id && roundLimit != null && counters >= roundLimit) counterHiddenReason = 'rounds';
  const canCounter = canAnswer && !counterHiddenReason;
  const canMoveRequest = canAnswer && !r.move_requested_at;
  return { group, endedAt, postingDate, cutoff, daysLeft, canAnswer, canCounter, counterHiddenReason, canMoveRequest, closedByCutoff, threadOpen };
}

function creatorCard(r, today) {
  const st = creatorState(r, today);
  const last = jsonObj(r.neg_last_terms);
  return {
    id: r.id, status: r.status, group: st.group,
    brand: { name: r.brand_name, logoUrl: r.brand_logo_url || null },
    campaignName: r.campaign_name, setName: r.set_name,
    goal: r.goal, shootMode: r.shoot_mode, cityName: r.city_name || null,
    postingDate: st.postingDate, cutoff: st.cutoff, daysLeft: st.daysLeft,
    commissionPct: r.goal !== 'engagement' && r.commission_pct != null ? Number(r.commission_pct) : null,
    fee: r.goal !== 'conversion' && r.agreed_fee != null ? Number(r.agreed_fee) : null,
    sentAt: r.invited_at || r.created_at, answeredAt: r.answered_at || null, endedAt: st.endedAt,
    canAnswer: st.canAnswer, canCounter: st.canCounter, counterHiddenReason: st.counterHiddenReason, canMoveRequest: st.canMoveRequest,
    switchOn: r.allow_negotiation !== false,
    negotiation: r.neg_id ? { id: r.neg_id, open: st.threadOpen, whoseMove: st.threadOpen ? r.neg_turn : null, outcome: r.neg_outcome || null, roundLimit: r.neg_round_limit != null ? Number(r.neg_round_limit) : null, countersUsed: Number(r.neg_counters || 0), lastCounter: last ? { by: r.neg_last_by, at: r.neg_last_at, line: snapshotLine(r.goal, last) } : null } : null,
    moveRequest: moveRequestOf(r),
    pool: r.pool_from_id ? { entryId: r.pool_from_id, state: r.pool_from_state, expiresAt: r.pool_from_expires_at, lifetimeDays: r.pool_from_lifetime, wantsGoLiveDate: r.deferred_go_live_date ? calendarDay(r.deferred_go_live_date) : null } : null,
    // Item 10 (V4): the store visit, in one line, once a plan has been sent. Derived from the
    // timestamps by the same function the shoot screens use, so the card and the screen agree.
    shoot: r.shoot_id && r.pe_shoot_mode === 'visit' && r.plan_sent_at ? {
      stage: shootPlan.stageOf({ id: r.shoot_id, status: r.shoot_status, plan_sent_at: r.plan_sent_at, time_agreed_at: r.time_agreed_at, influencer_completed_at: r.influencer_completed_at, brand_completed_at: r.brand_completed_at, auto_confirmed_at: r.auto_confirmed_at }),
      line: shootPlan.lineFor({ id: r.shoot_id, status: r.shoot_status, visit_scheduled_at: r.visit_scheduled_at, plan_sent_at: r.plan_sent_at, time_agreed_at: r.time_agreed_at, influencer_completed_at: r.influencer_completed_at, brand_completed_at: r.brand_completed_at, auto_confirmed_at: r.auto_confirmed_at }),
      visitAt: r.visit_scheduled_at || null,
      delayed: !!r.delayed_at,
    } : null,
    // N17: sent from the pool — the terms she agreed, and whether this set's date is the one she asked for (APPROVAL §3.3).
    fromPool: r.pool_entry_id ? {
      agreedAt: r.pool_sent_agreed_at,
      sameDate: !!(r.pool_sent_wants_date && st.postingDate && calendarDay(r.pool_sent_wants_date) === st.postingDate),
      termsLine: snapshotLine(r.goal, jsonObj(r.pool_sent_terms)),
      // Item 8 (T12): the green line on the invitation her own pitch became.
      // She has never seen this SET, so she still accepts it — but the numbers
      // should be familiar, and the line says why they are.
      fromPitch: !!r.pool_sent_from_pitch,
      pitchLine: r.pool_sent_from_pitch && st.postingDate
        ? require('./pitchCopy').CREATOR.fromPitch(snapshotLine(r.goal, jsonObj(r.pool_sent_terms)), r.pool_sent_agreed_at, st.postingDate)
        : null,
    } : null,
    /**
     * ⚠️ WHAT THE SIGNATURE ACTUALLY MOVED, ON THE CARD SHE READS.
     *
     * Found in production 2026-09-17: Asha signed, ₹3,000 was released into her wallet that
     * second, contracts.released_amount read 3000 and so did her wallet_balance — and her
     * Collabs card said "₹0 is in your wallet". The money was right. The number was never put
     * in the payload the card reads, so the screen fell back to zero and told her she had
     * nothing. Computed is not delivered.
     *
     * hasUpfrontMoney is the second half: a commission-only collaboration pays nothing at the
     * signature, and must not be described as having paid zero. She earns when she sells.
     * Contract: features/creator-wallet-and-first-payment
     */
    firstPayment: r.released_amount == null ? null : Number(r.released_amount),
    hasUpfrontMoney: Number(r.influencer_fee || 0) > 0,

    // Item 7 — the agreement, in her words (P4, P7, P16).
    agreement: r.contract_id && r.agreement_sent_at ? {
      reference: r.reference_no || null,
      status: r.contract_status,
      sentAt: r.agreement_sent_at,
      signedAt: r.creator_signed_at || null,
      bothSignedAt: r.signed_both ? r.brand_signed_at : null,
      line: r.signed_both ? null
        : r.creator_signed_at ? CREATOR7.waitingForBrand(r.brand_name, st.cutoff)
        : CREATOR7.readyToSign(st.cutoff),
      canSign: st.group === 'toSign',
      canDownload: !!r.signed_both,
    } : null,
  };
}

/** A13 — Invites (live, plus ended within seven days) or Done (ended earlier). Signed rows are item 7's. */
async function invitationsForCreator(influencerId, tab = 'invites', today = null) {
  const t = today || todayInIndia();
  const { rows } = await db.query(`${CREATOR_SELECT} WHERE ci.influencer_id = $1 ORDER BY COALESCE(ci.invited_at, ci.created_at) DESC`, [influencerId]);
  const all = rows.map(r => creatorCard(r, t));
  // Item 7 (P16): the Active tab is real now. A signed collaboration leaves
  // Invites the moment both names are on the agreement — that signature is
  // what moves it, not any status.
  if (tab === 'active') {
    const live = all.filter(c => c.group === 'signed' && c.status !== 'completed');
    return { tab: 'active', rows: live, total: live.length };
  }
  const cards = all.filter(c => c.group !== 'signed');
  const now = Date.now();
  const isDone = (c) => !!c.endedAt && (now - new Date(c.endedAt).getTime()) > DONE_AFTER_DAYS * 86400000;
  const list = tab === 'done' ? cards.filter(isDone) : cards.filter(c => !isDone(c));
  return { tab: tab === 'done' ? 'done' : 'invites', rows: list, total: list.length };
}

/** A14 — one invitation as the creator sees it. Null when it is not hers. */
async function invitationForCreator(ciId, influencerId, today = null) {
  const t = today || todayInIndia();
  const { rows } = await db.query(`${CREATOR_SELECT} WHERE ci.id = $1 AND ci.influencer_id = $2`, [ciId, influencerId]);
  if (!rows[0]) return null;
  const r = rows[0];
  const card = creatorCard(r, t);
  const terms = await termsBlock(r, r.goal);
  let paySplit = null;
  if (terms.fee != null) {
    const cfg = await paymentConfigSvc.getConfig();
    // Item 7, approval 4.4 — the ONE shared splitter, the same call the escrow
    // writer makes, so what she is shown before signing is what is written.
    const [t1, t2, t3] = splitAmount(terms.fee, [cfg.tranche1Pct, cfg.tranche2Pct, cfg.tranche3Pct]);
    paySplit = { t1Pct: cfg.tranche1Pct, t2Pct: cfg.tranche2Pct, t3Pct: cfg.tranche3Pct, t1, t2, t3 };
  }
  return {
    ...card,
    set: { name: r.set_name, goal: r.goal, shootMode: r.shoot_mode, cityName: r.city_name || null, postingDate: card.postingDate, cutoff: card.cutoff },
    terms: { ...terms, paySplit },
    note: r.brand_note || null,
    declineReason: r.declined_reason || null, declineReasonLabel: declineLabel(r.declined_reason),
    withdrawnAt: r.withdrawn_at || null, removedAt: r.removed_at || null,
  };
}

module.exports = {
  GROUP_ORDER, GROUP_TITLE, groupOf, termsLine, termsBlock, snapshotLine,
  creatorsForSet, invitationForBrand, invitationsForCreator, invitationForCreator, creatorState, DONE_AFTER_DAYS,
};
