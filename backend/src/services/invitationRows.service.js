'use strict';

/**
 * Item 5 — the read shapes: a set's creators grouped for the brand (I9), one invitation for the
 * brand (I10), the creator's Invites / Done lists (I11, I15) and one invitation for the creator
 * (I12, I13). Nothing here writes.
 * Contract: features/item5-invitations · prompt §5 A9, A10, A13, A14 · §6.7–§6.10 · D14 privacy
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

/* ────────────────────────────────────────────────────────── grouping */

/** The I9 groups in display order. */
const GROUP_ORDER = ['waiting', 'negotiating', 'accepted', 'signed', 'deferred', 'declined', 'expired', 'withdrawn'];
const GROUP_TITLE = {
  waiting: 'Waiting to answer', negotiating: 'Negotiating', accepted: 'Accepted, waiting for the agreement', signed: 'Signed',
  deferred: 'Asked for another date', declined: 'Declined', expired: 'Expired', withdrawn: 'Withdrawn and closed',
};
const STATUS_GROUP = {
  invited: 'waiting', applied: 'waiting', negotiating: 'negotiating',
  accepted: 'accepted', contracted: 'accepted', active: 'accepted', completed: 'accepted',
  deferred: 'deferred', declined: 'declined', rejected_by_brand: 'declined',
  expired: 'expired', slots_filled: 'expired', withdrawn: 'withdrawn', removed: 'withdrawn',
};
const groupOf = (status, signedBoth) => (signedBoth ? 'signed' : (STATUS_GROUP[status] || 'waiting'));
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
    shoppablePostsMin: selling ? MIN_SHOPPABLE_POSTS : null,
    deliverables: goal === 'engagement' ? jsonArr(r.formats_json).map(d => ({ type: d.type, count: Number(d.count) || 1 })) : null,
    deliverablesWords: goal === 'engagement' ? deliverablesInWords(jsonArr(r.formats_json)) : null,
    usageRights: goal === 'engagement' && usage && usage.on ? { on: true, durationDays: usage.duration_days == null ? null : Number(usage.duration_days), places: usage.places || [], words: usageInWords(usage) } : null,
    note: r.brand_note || null,
  };
}

const ROW_SELECT = `
  SELECT ci.id, ci.influencer_id, ci.status, ci.agreed_fee, ci.commission_pct,
         ci.alloc_scope, ci.alloc_category, ci.alloc_category_node_id, ci.alloc_product_ids,
         ci.offer_type, ci.offer_config_json, ci.brand_offer_id, ci.offer_valid_from, ci.offer_valid_until,
         ci.formats_json, ci.brand_note, ci.usage_rights_json, ci.agreement_id,
         ci.invited_at, ci.created_at, ci.answered_at, ci.declined_reason, ci.declined_note,
         ci.deferred_go_live_date, ci.deferred_shoot_mode, ci.deferred_at, ci.withdrawn_at, ci.removed_at,
         ci.source, ci.source_group_id, g.name AS source_group_name,
         COALESCE(i.full_name, u.name) AS name, i.profile_image_r2_key, i.instagram_handle,
         bo.name AS offer_name,
         con.signed_both, con.signed_at, con.contract_id, con.contract_status,
         EXISTS (SELECT 1 FROM negotiations n WHERE n.campaign_influencer_id = ci.id) AS has_negotiation
    FROM campaign_influencers ci
    JOIN influencers i ON i.id = ci.influencer_id JOIN users u ON u.id = i.user_id
    LEFT JOIN brand_offers bo ON bo.id = ci.brand_offer_id
    LEFT JOIN influencer_groups g ON g.id = ci.source_group_id
    LEFT JOIN LATERAL (
      SELECT con.id AS contract_id, con.status AS contract_status,
             (${SIGNED_CONTRACT_SQL}) AS signed_both,
             GREATEST(con.influencer_signed_at, con.brand_signed_at) AS signed_at
        FROM contracts con WHERE con.campaign_influencer_id = ci.id ORDER BY con.created_at DESC LIMIT 1
    ) con ON true`;

function brandRow(r, goal) {
  const group = groupOf(r.status, r.signed_both);
  return {
    id: r.id, influencerId: r.influencer_id, name: r.name, avatarUrl: r.avatar_url || null, instagramHandle: r.instagram_handle || null,
    status: r.status, group,
    termsLine: termsLine(r, goal),
    sentAt: r.invited_at || r.created_at, answeredAt: r.answered_at || null, signedAt: r.signed_at || null,
    declineReason: r.declined_reason || null, declineReasonLabel: declineLabel(r.declined_reason), declineNote: r.declined_note || null,
    deferredGoLiveDate: r.deferred_go_live_date ? calendarDay(r.deferred_go_live_date) : null, deferredShootMode: r.deferred_shoot_mode || null, deferredAt: r.deferred_at || null,
    withdrawnAt: r.withdrawn_at || null, removedAt: r.removed_at || null,
    source: r.source || null, sourceGroup: r.source_group_id ? { id: r.source_group_id, name: r.source_group_name || null } : null,
    actions: {
      withdraw: r.status === 'invited',
      // Every pre-signed status, deferred and applied included (founder Q10); never a dead row.
      remove: !r.signed_both && !DEAD_STATUSES.includes(r.status),
      viewTerms: true,
      sendAgreement: group === 'accepted' && !r.signed_both, // item 7's button
    },
  };
}

/** A9 — the set's creators grouped in the I9 order, at most 50 per group with the real count. */
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
  SELECT ci.id, ci.status, ci.agreed_fee, ci.commission_pct, ci.agreement_id,
         ci.alloc_scope, ci.alloc_category, ci.alloc_category_node_id, ci.alloc_product_ids,
         ci.offer_type, ci.offer_config_json, ci.brand_offer_id, ci.offer_valid_from, ci.offer_valid_until,
         ci.formats_json, ci.brand_note, ci.usage_rights_json,
         ci.invited_at, ci.created_at, ci.answered_at, ci.declined_reason, ci.withdrawn_at, ci.removed_at, ci.deferred_at,
         cs.id AS set_id, cs.name AS set_name, cs.goal, cs.shoot_mode, cs.go_live_date, cs.expired_at, cs.influencer_mode,
         c.id AS campaign_id, c.name AS campaign_name, c.allow_negotiation,
         b.business_name AS brand_name, b.logo_url AS brand_logo_url,
         rc.name AS city_name,
         bo.name AS offer_name,
         con.signed_both,
         EXISTS (SELECT 1 FROM negotiations n WHERE n.campaign_influencer_id = ci.id) AS has_negotiation
    FROM campaign_influencers ci
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN brands b ON b.id = c.brand_id
    LEFT JOIN brand_branches bb ON bb.id = cs.branch_id
    LEFT JOIN ref_cities rc ON rc.id = bb.city_id
    LEFT JOIN brand_offers bo ON bo.id = ci.brand_offer_id
    LEFT JOIN LATERAL (
      SELECT (${SIGNED_CONTRACT_SQL}) AS signed_both
        FROM contracts con WHERE con.campaign_influencer_id = ci.id ORDER BY con.created_at DESC LIMIT 1
    ) con ON true`;

/** Ended, withdrawn and closed cards stay for seven days, then move to Done (APPROVAL.md §4.11). */
const DONE_AFTER_DAYS = 7;

/**
 * The creator's view of one row: her group, when it ended, whether she can still act.
 *   invited · negotiating · accepted · deferred · declined · expired · withdrawn · closed
 */
function creatorState(r, today) {
  const postingDate = r.go_live_date ? calendarDay(r.go_live_date) : null;
  const cutoff = campaignState.cutoffFor(postingDate);
  const closedByCutoff = !!(r.expired_at || (cutoff && isBefore(cutoff, today)));
  let group;
  let endedAt = null;
  switch (r.status) {
    case 'invited': group = closedByCutoff ? 'expired' : 'invited'; endedAt = closedByCutoff ? (r.expired_at || endOfIndiaDay(cutoff)) : null; break;
    case 'applied': group = closedByCutoff ? 'expired' : 'invited'; endedAt = closedByCutoff ? (r.expired_at || endOfIndiaDay(cutoff)) : null; break;
    case 'negotiating': group = closedByCutoff ? 'expired' : 'negotiating'; endedAt = closedByCutoff ? (r.expired_at || endOfIndiaDay(cutoff)) : null; break;
    case 'accepted': group = closedByCutoff && !r.signed_both ? 'expired' : 'accepted'; endedAt = group === 'expired' ? (r.expired_at || endOfIndiaDay(cutoff)) : null; break;
    case 'deferred': group = 'deferred'; break;
    case 'declined': group = 'declined'; endedAt = r.answered_at || null; break;
    case 'expired': case 'slots_filled': group = 'expired'; endedAt = r.expired_at || (cutoff ? endOfIndiaDay(cutoff) : null); break;
    case 'withdrawn': group = 'withdrawn'; endedAt = r.withdrawn_at; break;
    case 'removed': case 'rejected_by_brand': group = 'closed'; endedAt = r.removed_at || r.answered_at || null; break;
    default: group = 'signed'; // contracted / active / completed — item 7's Active tab
  }
  const daysLeft = cutoff && !closedByCutoff ? daysBetween(today, cutoff) : null;
  const canAnswer = r.status === 'invited' && !closedByCutoff;
  const canCounter = canAnswer && !r.agreement_id && r.allow_negotiation !== false && r.influencer_mode !== 'open_group' && !r.has_negotiation;
  return { group, endedAt, postingDate, cutoff, daysLeft, canAnswer, canCounter, closedByCutoff };
}

function creatorCard(r, today) {
  const st = creatorState(r, today);
  return {
    id: r.id, status: r.status, group: st.group,
    brand: { name: r.brand_name, logoUrl: r.brand_logo_url || null },
    campaignName: r.campaign_name, setName: r.set_name,
    goal: r.goal, shootMode: r.shoot_mode, cityName: r.city_name || null,
    postingDate: st.postingDate, cutoff: st.cutoff, daysLeft: st.daysLeft,
    commissionPct: r.goal !== 'engagement' && r.commission_pct != null ? Number(r.commission_pct) : null,
    fee: r.goal !== 'conversion' && r.agreed_fee != null ? Number(r.agreed_fee) : null,
    sentAt: r.invited_at || r.created_at, answeredAt: r.answered_at || null, endedAt: st.endedAt,
    canAnswer: st.canAnswer, canCounter: st.canCounter,
  };
}

/** A13 — Invites (live, plus ended within seven days) or Done (ended earlier). Signed rows are item 7's. */
async function invitationsForCreator(influencerId, tab = 'invites', today = null) {
  const t = today || todayInIndia();
  const { rows } = await db.query(`${CREATOR_SELECT} WHERE ci.influencer_id = $1 ORDER BY COALESCE(ci.invited_at, ci.created_at) DESC`, [influencerId]);
  const cards = rows.map(r => creatorCard(r, t)).filter(c => c.group !== 'signed');
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
    const part = (p) => Math.round(Number(terms.fee) * Number(p) / 100);
    paySplit = { t1Pct: cfg.tranche1Pct, t2Pct: cfg.tranche2Pct, t3Pct: cfg.tranche3Pct, t1: part(cfg.tranche1Pct), t2: part(cfg.tranche2Pct), t3: Number(terms.fee) - part(cfg.tranche1Pct) - part(cfg.tranche2Pct) };
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
  GROUP_ORDER, GROUP_TITLE, groupOf, termsLine, termsBlock,
  creatorsForSet, invitationForBrand, invitationsForCreator, invitationForCreator, creatorState, DONE_AFTER_DAYS,
};
