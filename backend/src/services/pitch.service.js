'use strict';

/**
 * Item 8 — the creator's pitch. ONE service behind every door.
 * Rules v1.21 §8 (with §7B, §8A, §25). Mockups T1–T14.
 * Contract: features/item8-pitch
 *
 * A creator proposes a deal to a brand. The brand accepts, counters or rejects.
 * **Accepting agrees the money and creates NOTHING ELSE** — she joins the
 * brand's pool and waits for a set, exactly like a creator who asked to be
 * moved in item 6. From there it is the ordinary path: item 4's set, item 5's
 * invitation, item 7's agreement. Item 8 adds a front door and no new machinery.
 *
 * Three things this service refuses to invent:
 *   · a second set of term rules — it calls item 5's validator, the same
 *     function with the same messages;
 *   · a second negotiation engine — counters go through item 6's thread with
 *     her pitch as turn zero, and the thread's own accept/decline write the
 *     pitch row;
 *   · a second way into a collaboration — acceptance stops at the pool.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const notificationService = require('./notification.service');
const eligibility = require('./collabEligibility.service');
const settings = require('./platformSettings.service');
const pool = require('./pool.service');
const negotiation = require('./negotiation.service');
const socialAccounts = require('./socialAccounts.service');
const setShape = require('./setShape.model');
const { validateTerms } = require('./invitationTerms.service');
const { deliverablesInWords } = require('./invitationCopy');
const { MSG, AIMS, AIM_LABEL, MODE_LABEL, ENDING, CREATOR, BRAND, NOTIFY } = require('./pitchCopy');
const { calendarDay, istDayOf, todayInIndia, isBefore, daysBetween } = require('../utils/indiaDay');

/**
 * Open means the brand has not answered and she has not taken it back.
 * The same three the partial unique index uses, so the database and the service
 * cannot disagree about what "open" counts as.
 */
const OPEN = negotiation.OPEN_PITCH_STATUSES;
const MAX_OPEN_PER_BRAND = 3;

const jsonObj = (v) => {
  if (v && typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
};
const jsonArr = (v) => { const o = jsonObj(v); return Array.isArray(o) ? o : []; };
/** A timestamptz to the Indian calendar day it fell on. */
const dayOf = (ts) => (ts ? istDayOf(ts) : null);
const leftFrom = (today, ts) => { const d = daysBetween(today, dayOf(ts)); return d == null ? null : Math.max(0, d); };

/* ─────────────────────────────────────────────────────────── reading */

const SELECT = `
  SELECT p.*,
         b.business_name AS brand_name, bu.id AS brand_user_id,
         COALESCE(i.full_name, u.name) AS creator_name, i.instagram_handle, i.niche,
         u.id AS creator_user_id, u.city AS creator_city,
         n.id AS neg_id, n.outcome AS neg_outcome, n.current_turn AS neg_turn
    FROM influencer_proposals p
    JOIN brands b ON b.id = p.brand_id JOIN users bu ON bu.id = b.user_id
    JOIN influencers i ON i.id = p.influencer_id JOIN users u ON u.id = i.user_id
    LEFT JOIN negotiations n ON n.pitch_id = p.id`;

/** Her terms, in the shape item 5 and item 6 both already speak. */
function termsOf(row) {
  const fee = row.proposed_fee != null ? Number(row.proposed_fee) : null;
  const pct = row.proposed_commission_pct != null ? Number(row.proposed_commission_pct) : null;
  if (row.goal === 'engagement') return { fee, deliverables: jsonArr(row.proposed_deliverables) };
  if (row.goal === 'hybrid') return { fee, commissionPct: pct };
  return { commissionPct: pct };
}

const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const pctOf = (p) => `${Number(p) % 1 === 0 ? Number(p) : Number(p).toFixed(1)}%`;

/** "14%" · "₹12,000 · 1 reel, 2 stories" · "₹5,000 + 10%" */
function termsLine(row) {
  const t = termsOf(row);
  if (row.goal === 'engagement') {
    return [t.fee != null ? inr(t.fee) : null, deliverablesInWords(jsonArr(row.proposed_deliverables))].filter(Boolean).join(' · ');
  }
  if (row.goal === 'hybrid') {
    return [t.fee != null ? inr(t.fee) : null, t.commissionPct != null ? pctOf(t.commissionPct) : null].filter(Boolean).join(' + ');
  }
  return t.commissionPct != null ? pctOf(t.commissionPct) : '';
}

/** Which of T13/T14's states this pitch is in. */
function groupOf(row) {
  if (row.status === 'accepted') return 'agreed';
  if (row.status === 'rejected') return 'rejected';
  if (row.status === 'withdrawn') return 'withdrawn';
  if (row.status === 'expired') return row.closed_reason === 'date_passed' ? 'datePassed' : 'noReply';
  if (row.neg_id && !row.neg_outcome) return 'talking';
  return 'waiting';
}

/** The one sentence T13/T14 shows under the card, whichever state it is in. */
function creatorLine(row, group, today) {
  switch (group) {
    case 'waiting': return row.response_due_at ? CREATOR.waitingUntil(row.response_due_at, leftFrom(today, row.response_due_at)) : null;
    case 'agreed': return CREATOR.agreedBody(row.proposed_go_live_date);
    case 'rejected': return ENDING.rejected(row.brand_response_message);
    case 'withdrawn': return ENDING.withdrawn(row.updated_at);
    case 'datePassed': return ENDING.datePassed(row.proposed_go_live_date, row.updated_at);
    case 'noReply': return ENDING.noReply(row.brand_name, row.response_due_at);
    default: return null;
  }
}

function creatorCard(row, today) {
  const group = groupOf(row);
  return {
    id: row.id,
    brand: { id: row.brand_id, name: row.brand_name },
    goal: row.goal,
    aimLabel: AIM_LABEL[row.goal] || row.goal,
    termsLine: termsLine(row),
    proposedGoLiveDate: calendarDay(row.proposed_go_live_date),
    shootMode: row.shoot_mode,
    modeLabel: MODE_LABEL[row.shoot_mode] || null,
    sentAt: row.created_at,
    group,
    responseDueAt: row.response_due_at || null,
    daysLeft: row.response_due_at ? leftFrom(today, row.response_due_at) : null,
    line: creatorLine(row, group, today),
    // She is told when she may try again on the card that ended, not elsewhere.
    cooldownUntil: row.cooldown_until || null,
    cooldownLine: row.cooldown_until ? CREATOR.cooldownLine(row.brand_name, row.cooldown_until) : null,
    negotiation: row.neg_id ? { id: row.neg_id, open: !row.neg_outcome, whoseMove: row.neg_outcome ? null : row.neg_turn } : null,
  };
}

async function brandCard(row, today) {
  const numbers = await socialAccounts.brandView(row.influencer_id).catch(() => null);
  const ig = numbers && numbers.instagram ? numbers.instagram : null;
  const yt = numbers && numbers.youtube ? numbers.youtube : null;
  return {
    id: row.id,
    creator: {
      id: row.influencer_id,
      name: row.creator_name,
      handle: row.instagram_handle || null,
      niche: Array.isArray(row.niche) ? row.niche[0] || null : row.niche || null,
      city: row.creator_city || null,
    },
    // T5 and T6 lead with her numbers, because that is the first thing a brand
    // decides on. Not measured stays null and shows as a dash, never as a zero —
    // and never `undefined`, which JSON drops so the phone cannot tell the
    // difference between "nobody has measured her" and "we forgot to send it".
    numbers: {
      instagramFollowers: (ig && ig.followers != null) ? ig.followers : null,
      youtubeSubscribers: (yt && yt.subscribers != null) ? yt.subscribers : null,
      engagement: (ig && ig.engagement != null) ? ig.engagement : null,
    },
    goal: row.goal,
    aimLabel: AIM_LABEL[row.goal] || row.goal,
    termsLine: termsLine(row),
    terms: termsOf(row),
    proposedGoLiveDate: calendarDay(row.proposed_go_live_date),
    shootMode: row.shoot_mode,
    modeLabel: MODE_LABEL[row.shoot_mode] || null,
    message: row.pitch_message,
    sentAt: row.created_at,
    agedDays: BRAND.agedDays(Math.max(0, daysBetween(dayOf(row.created_at), today) || 0)),
    unread: !row.viewed_at,
    group: groupOf(row),
    responseDueAt: row.response_due_at || null,
    daysLeft: row.response_due_at ? leftFrom(today, row.response_due_at) : null,
    replyBy: row.response_due_at ? BRAND.replyBy(row.response_due_at, leftFrom(today, row.response_due_at)) : null,
    negotiation: row.neg_id ? { id: row.neg_id, open: !row.neg_outcome, whoseMove: row.neg_outcome ? null : row.neg_turn } : null,
  };
}

/* ─────────────────────────────────────────────────────────── guards */

async function load(pitchId, { influencerId = null, brandId = null }, conn = db) {
  const scope = influencerId ? 'p.influencer_id = $2' : 'p.brand_id = $2';
  const { rows } = await conn.query(`${SELECT} WHERE p.id = $1 AND ${scope}`, [pitchId, influencerId || brandId]);
  return rows[0] || null;
}

/**
 * The brand may still answer this.
 *
 * The response clock governs the FIRST answer only (approval Q2). Once the
 * brand has answered — which is what a thread means — the clock has done its
 * job, and the conversation runs to the early close instead. A brand that
 * counters on day 28 must not leave her with two days.
 */
function assertAnswerable(row) {
  if (!OPEN.includes(row.status)) throw new AppError('VALIDATION_ERROR', MSG.ANSWERED_TWICE, 422, 'status');
  const firstAnswerStillDue = !row.neg_id;
  if (firstAnswerStillDue && row.response_due_at && new Date(row.response_due_at) <= new Date()) {
    throw new AppError('VALIDATION_ERROR', MSG.CLOSED(row.response_due_at), 422, 'status');
  }
}

/** A thread open on her move is hers to answer, not the brand's to end. */
function assertBrandsMove(row) {
  if (row.neg_id && !row.neg_outcome && row.neg_turn !== 'brand') {
    throw new AppError('WRONG_TURN', `It isn't your move yet.`, 422, 'status');
  }
}

const openPitches = async (influencerId, brandId, conn = db) => Number((await conn.query(
  `SELECT count(*)::int AS n FROM influencer_proposals WHERE influencer_id = $1 AND brand_id = $2 AND status = ANY($3)`,
  [influencerId, brandId, OPEN]
)).rows[0].n);

const cooldownFor = async (influencerId, brandId, conn = db) => {
  const { rows } = await conn.query(
    `SELECT cooldown_until FROM proposal_cooldowns WHERE influencer_id = $1 AND brand_id = $2 AND cooldown_until > now()`,
    [influencerId, brandId]
  );
  return rows[0] ? rows[0].cooldown_until : null;
};

/* ─────────────────────────────────────────────────────────── T2 · the form */

/**
 * What this brand accepts, and her own minimums for the hints.
 * Only the Aims and modes the brand takes are offered, so the first choice can
 * never be refused later (T2).
 */
async function formFor(brandId, influencerId) {
  const { rows } = await db.query(`SELECT business_name, sub_categories FROM brands WHERE id = $1`, [brandId]);
  if (!rows[0]) throw new AppError('NOT_FOUND', 'Not found', 404, 'brandId');
  const brandName = rows[0].business_name;

  const brandSettings = await eligibility.loadBrandPitchSettings(brandId);
  const mine = await eligibility.loadCreatorInvitationSettings(influencerId);
  const gate = await eligibility.canCreatorPitchBrand({ influencerId, brandId });
  const cool = await cooldownFor(influencerId, brandId);
  const open = await openPitches(influencerId, brandId);
  // The number the form quotes must be the number the send will stamp, so it
  // is read here rather than hardcoded on the phone.
  const responseDays = Number(await settings.get('pitch_response_days'));

  return {
    brand: { id: brandId, name: brandName },
    responseDays,
    acceptedAims: brandSettings.accepted_aims || [],
    acceptedModes: brandSettings.accepted_modes || [],
    canPitch: gate.ok && !cool && open < MAX_OPEN_PER_BRAND,
    reason: cool ? 'COOLDOWN' : (!gate.ok ? gate.reason : (open >= MAX_OPEN_PER_BRAND ? 'LIMIT' : 'OK')),
    cooldownUntil: cool || null,
    cooldownLine: cool ? CREATOR.cooldownLine(brandName, cool) : null,
    // Her own minimums, shown to her as a reminder, never as a rule.
    minimums: {
      feeEngagement: mine.min_fee_engagement != null ? Number(mine.min_fee_engagement) : null,
      feeHybrid: mine.min_fee_hybrid != null ? Number(mine.min_fee_hybrid) : null,
      commission: eligibility.minCommissionFor(mine, 'conversion', rows[0].sub_categories),
      commissionHybrid: eligibility.minCommissionFor(mine, 'hybrid', rows[0].sub_categories),
    },
    openPitches: open,
    maxOpen: MAX_OPEN_PER_BRAND,
    limitLine: CREATOR.limitLine(Math.min(open + 1, MAX_OPEN_PER_BRAND), MAX_OPEN_PER_BRAND),
    limitReachedLine: open >= MAX_OPEN_PER_BRAND ? ENDING.limitReached(MAX_OPEN_PER_BRAND, brandName) : null,
    earliestGoLiveDate: setShape.earliestGoLiveDay(),
  };
}

/* ─────────────────────────────────────────────────────────── T3 · send */

async function send(influencerId, body) {
  const brandId = body.brandId || body.brand_id;
  if (!brandId) throw new AppError('VALIDATION_ERROR', 'Pick a brand.', 422, 'brandId');
  const goal = String(body.goal || '').toLowerCase();
  if (!AIMS.includes(goal)) throw new AppError('VALIDATION_ERROR', 'Pick what kind of deal.', 422, 'goal');

  const { rows: brandRows } = await db.query(`SELECT business_name FROM brands WHERE id = $1`, [brandId]);
  if (!brandRows[0]) throw new AppError('NOT_FOUND', 'Not found', 404, 'brandId');
  const brandName = brandRows[0].business_name;
  const brandSettings = await eligibility.loadBrandPitchSettings(brandId);

  // ── The mode. Item 2 added the column and left it optional "until item 8".
  //    "Remote" is what she reads; `shipment` is what the column has held since
  //    migration 169, so it is normalised once, here, and stored that way.
  const mode = eligibility.normaliseMode(body.shootMode || body.shoot_mode);
  if (!mode) throw new AppError('VALIDATION_ERROR', MSG.MODE_REQUIRED, 422, 'shootMode');
  if (!(brandSettings.accepted_modes || []).includes(mode)) {
    throw new AppError('NOT_MATCHING', MSG.MODE_NOT_TAKEN(brandName), 422, 'shootMode');
  }
  if (!(brandSettings.accepted_aims || []).includes(goal)) {
    throw new AppError('NOT_MATCHING', MSG.AIM_NOT_TAKEN(brandName), 422, 'goal');
  }

  // ── Item 2's settings, on send, server-side (§8A). A hidden button is not a
  //    switch-off, so every one of them is re-checked here.
  const gate = await eligibility.canCreatorPitchBrand({ influencerId, brandId, aim: goal, mode });
  if (!gate.ok) {
    const message = gate.reason === 'NOT_ACCEPTING' ? MSG.NOT_ACCEPTING(brandName) : MSG.NOT_MATCHING(brandName);
    throw new AppError(gate.reason, message, 403, 'brandId');
  }

  // ── The cooldown. A pause, not a refusal — the message says when it lifts.
  const cool = await cooldownFor(influencerId, brandId);
  if (cool) throw new AppError('VALIDATION_ERROR', MSG.IN_COOLDOWN(brandName, cool), 422, 'brandId');

  // ── The limits. Three open to one brand; one open per Aim is the index.
  if (await openPitches(influencerId, brandId) >= MAX_OPEN_PER_BRAND) {
    throw new AppError('VALIDATION_ERROR', MSG.TOO_MANY_OPEN(MAX_OPEN_PER_BRAND, brandName), 422, 'brandId');
  }

  // ── The terms. ITEM 5'S VALIDATOR — the same function, the same messages.
  const terms = validateTerms(goal, body, { mode: 'strict' });

  // ── Her date. Item 4's floor, reused; three sevens would be two too many.
  const wanted = body.proposedGoLiveDate || body.proposed_go_live_date;
  const day = calendarDay(wanted);
  if (!day) throw new AppError('VALIDATION_ERROR', 'Choose when you could post.', 422, 'proposedGoLiveDate');
  if (isBefore(day, setShape.earliestGoLiveDay())) {
    throw new AppError('VALIDATION_ERROR', MSG.DATE_TOO_SOON, 422, 'proposedGoLiveDate');
  }

  // ── Her message.
  const message = String(body.message || body.pitch_message || '').trim();
  if (!message) throw new AppError('VALIDATION_ERROR', MSG.MESSAGE_REQUIRED, 422, 'message');
  if (message.length > 500) throw new AppError('VALIDATION_ERROR', MSG.MESSAGE_LONG, 422, 'message');

  // ── The response period, stamped now so a later admin change never moves a
  //    pitch already in flight.
  const days = Number(await settings.get('pitch_response_days'));

  let created;
  try {
    const { rows } = await db.query(
      `INSERT INTO influencer_proposals
         (influencer_id, brand_id, goal, pitch_title, pitch_message, shoot_mode,
          proposed_fee, proposed_commission_pct, proposed_deliverables, proposed_go_live_date,
          status, expires_at, response_due_at, response_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::date,
               'sent', now() + make_interval(days => $11::int), now() + make_interval(days => $11::int), $11)
       RETURNING id`,
      [influencerId, brandId, goal, `${AIM_LABEL[goal]} pitch`, message, mode,
        terms.fee != null ? terms.fee : null,
        terms.commissionPct != null ? terms.commissionPct : null,
        terms.deliverables ? JSON.stringify(terms.deliverables) : null,
        day, days]
    );
    created = rows[0];
  } catch (e) {
    // One open pitch per brand per Aim is a partial unique index, so the
    // database refuses the second and we turn it into her own words.
    if (e.code === '23505' && String(e.constraint || '').includes('uq_pitch_open_per_aim')) {
      throw new AppError('VALIDATION_ERROR', MSG.SAME_AIM_OPEN(AIM_LABEL[goal], brandName), 422, 'goal');
    }
    throw e;
  }

  const row = await load(created.id, { influencerId });
  await notifyBrand(row, NOTIFY.SENT, `${row.creator_name} pitched you ${termsLine(row)}.`);
  return creatorDetail(row);
}

/* ─────────────────────────────────────────────────────────── T13 · her list */

async function listForCreator(influencerId) {
  const today = todayInIndia();
  const { rows } = await db.query(`${SELECT} WHERE p.influencer_id = $1 ORDER BY p.created_at DESC`, [influencerId]);
  const cards = rows.map((r) => creatorCard(r, today));
  return {
    rows: cards,
    total: cards.length,
    groups: {
      waiting: cards.filter((c) => c.group === 'waiting' || c.group === 'talking'),
      agreed: cards.filter((c) => c.group === 'agreed'),
      ended: cards.filter((c) => ['rejected', 'withdrawn', 'noReply', 'datePassed'].includes(c.group)),
    },
  };
}

const creatorDetail = (row) => ({
  ...creatorCard(row, todayInIndia()),
  message: row.pitch_message,
  terms: termsOf(row),
});

async function detailForCreator(pitchId, influencerId) {
  const row = await load(pitchId, { influencerId });
  if (!row) throw new AppError('NOT_FOUND', 'Not found', 404);
  return creatorDetail(row);
}

/* ─────────────────────────────────────────────────────────── T4 · withdraw */

async function withdraw(pitchId, influencerId, actorUserId) {
  const row = await load(pitchId, { influencerId });
  if (!row) throw new AppError('NOT_FOUND', 'Not found', 404);
  if (row.status === 'accepted') {
    // After acceptance, withdrawing means leaving the pool — which item 6
    // already lets either side do.
    throw new AppError('VALIDATION_ERROR', 'This is already agreed. Leave the pool instead.', 422, 'status');
  }
  if (!OPEN.includes(row.status)) throw new AppError('VALIDATION_ERROR', MSG.ANSWERED_TWICE, 422, 'status');

  await db.withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE influencer_proposals SET status = 'withdrawn', closed_reason = 'withdrawn', updated_at = now()
        WHERE id = $1 AND status = ANY($2) RETURNING id`, [pitchId, OPEN]
    );
    if (!rows[0]) throw new AppError('VALIDATION_ERROR', MSG.ANSWERED_TWICE, 422, 'status');
    await negotiation.endThread(tx, row.neg_id, 'declined_by_creator', actorUserId);
  });

  // No cooldown. She took it back; that is not a rejection.
  const after = await load(pitchId, { influencerId });
  await notifyBrand(after, NOTIFY.WITHDRAWN, `${after.creator_name} withdrew her pitch.`);
  return creatorDetail(after);
}

/* ─────────────────────────────────────────────────────────── T5/T6 · the brand */

async function listForBrand(brandId) {
  const today = todayInIndia();
  const { rows } = await db.query(
    `${SELECT} WHERE p.brand_id = $1 AND p.status = ANY($2) ORDER BY p.created_at DESC`, [brandId, OPEN]
  );
  const cards = await Promise.all(rows.map((r) => brandCard(r, today)));
  // Grouped by whose move it is, the way every other list in the product is.
  const talking = cards.filter((c) => c.negotiation && c.negotiation.open);
  const fresh = cards.filter((c) => !c.negotiation || !c.negotiation.open);
  return {
    groups: {
      new: { key: 'new', title: 'New', count: fresh.length, rows: fresh },
      talking: { key: 'talking', title: 'Talking', count: talking.length, rows: talking },
    },
    order: ['new', 'talking'],
    total: cards.length,
    unread: cards.filter((c) => c.unread).length,
  };
}

async function detailForBrand(pitchId, brandId) {
  let row = await load(pitchId, { brandId });
  if (!row) throw new AppError('NOT_FOUND', 'Not found', 404);
  // Opening it marks it read, which is what the unread dot on T5 means.
  if (!row.viewed_at) {
    await db.query(
      `UPDATE influencer_proposals
          SET viewed_at = now(), status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
        WHERE id = $1 AND viewed_at IS NULL`, [pitchId]
    );
    row = await load(pitchId, { brandId });
  }
  const card = await brandCard(row, todayInIndia());
  const answerable = OPEN.includes(row.status) && (!row.neg_id || !!row.neg_outcome || row.neg_turn === 'brand');
  const cooldownDays = Number(await settings.get('pitch_cooldown_days'));
  const wouldEnd = new Date(Date.now() + cooldownDays * 86400000).toISOString();
  return {
    ...card,
    can: { accept: answerable, counter: answerable, reject: answerable },
    // The brand sees the cooldown date BEFORE it taps Reject, not afterwards (T8).
    cooldownDays,
    cooldownWouldEnd: wouldEnd,
    rejectCooldownLine: BRAND.rejectCooldown(String(card.creator.name || '').split(' ')[0], wouldEnd),
    rejectBlockHint: BRAND.rejectBlockHint,
    acceptBody: BRAND.acceptBody(row.proposed_go_live_date),
  };
}

/* ─────────────────────────────────────────────────────────── T7 · accept */

/**
 * Accepting agrees the money and creates NOTHING ELSE.
 * No campaign, no set, no invitation, no contract, no money. She joins the
 * brand's pool and waits for a set (rules v1.21 §8, approval item 6 of §3).
 */
async function accept(pitchId, brandId, actorUserId) {
  const row = await load(pitchId, { brandId });
  if (!row) throw new AppError('NOT_FOUND', 'Not found', 404);
  assertAnswerable(row);
  assertBrandsMove(row);

  let agreed = termsOf(row);
  if (row.neg_id && !row.neg_outcome) {
    // Through the thread, so the accepted terms are the last counter's, and the
    // engine writes the pitch row and ends the thread.
    const ctx = await negotiation.loadPitchContext(pitchId, { brandId });
    const out = await negotiation.accept({ ctx, by: 'brand', actorUserId });
    if (out && out.agreedTerms) agreed = out.agreedTerms;
  } else {
    const { rowCount } = await db.query(
      `UPDATE influencer_proposals
          SET status = 'accepted', brand_response_at = now(), answered_by = $2, updated_at = now()
        WHERE id = $1 AND status = ANY($3)`, [pitchId, actorUserId || null, OPEN]
    );
    if (!rowCount) throw new AppError('VALIDATION_ERROR', MSG.ANSWERED_TWICE, 422, 'status');
  }

  // The whole outcome: one pool entry.
  const entry = await db.withTransaction(async (tx) => {
    const e = await pool.create({
      brandId,
      influencerId: row.influencer_id,
      goal: row.goal,
      agreedTerms: agreed,
      wantsGoLiveDate: calendarDay(row.proposed_go_live_date),
      wantsShootMode: row.shoot_mode,
      note: row.pitch_message,
      // Provenance: this entry came from her own pitch (T11's tag), and the
      // mode that was agreed, so item 5's send can tell a matching set from a
      // differing one (§7B, as amended).
      fromPitchId: pitchId,
      matchedShootMode: row.shoot_mode,
    }, tx);
    await tx.query(`UPDATE influencer_proposals SET pool_entry_id = $2, updated_at = now() WHERE id = $1`, [pitchId, e.id]);
    return e;
  });

  // The engine already told her when the acceptance came through the thread.
  if (!row.neg_id) {
    await notifyCreator(row, NOTIFY.AGREED,
      `${row.brand_name} agreed your terms. ${CREATOR.agreedBody(row.proposed_go_live_date)}`);
  }
  return { pitch: await detailForBrand(pitchId, brandId), poolEntryId: entry.id };
}

/* ─────────────────────────────────────────────────────────── T8 · reject */

async function reject(pitchId, brandId, body, actorUserId) {
  const row = await load(pitchId, { brandId });
  if (!row) throw new AppError('NOT_FOUND', 'Not found', 404);
  assertAnswerable(row);
  assertBrandsMove(row);

  const reason = body && body.reason != null ? String(body.reason).trim() : '';
  if (reason.length > 200) throw new AppError('VALIDATION_ERROR', MSG.REJECT_REASON_LONG, 422, 'reason');

  // Stamped at rejection from the admin number, so a later change never moves it.
  const days = Number(await settings.get('pitch_cooldown_days'));

  if (row.neg_id && !row.neg_outcome) {
    // Through the thread: the engine records the decline turn, writes the pitch
    // row and ends the thread. The cooldown is stamped here, once, afterwards.
    const ctx = await negotiation.loadPitchContext(pitchId, { brandId });
    await negotiation.decline({ ctx, by: 'brand', note: reason || null, actorUserId });
  } else {
    const { rowCount } = await db.query(
      `UPDATE influencer_proposals
          SET status = 'rejected', brand_response_at = now(), answered_by = $2,
              brand_response_message = $3, updated_at = now()
        WHERE id = $1 AND status = ANY($4)`,
      [pitchId, actorUserId || null, reason || null, OPEN]
    );
    if (!rowCount) throw new AppError('VALIDATION_ERROR', MSG.ANSWERED_TWICE, 422, 'status');
  }

  const until = await db.withTransaction(async (tx) => {
    const { rows } = await tx.query(
      `UPDATE influencer_proposals
          SET cooldown_days = $2, cooldown_until = now() + make_interval(days => $2::int), updated_at = now()
        WHERE id = $1 RETURNING cooldown_until`, [pitchId, days]
    );
    // The cooldown is per BRAND, not per Aim, so it lives on the pair.
    await tx.query(
      `INSERT INTO proposal_cooldowns (influencer_id, brand_id, cooldown_until, reason)
       VALUES ($1, $2, $3, 'pitch_rejected')
       ON CONFLICT (influencer_id, brand_id)
       DO UPDATE SET cooldown_until = EXCLUDED.cooldown_until, reason = EXCLUDED.reason`,
      [row.influencer_id, brandId, rows[0].cooldown_until]
    );
    return rows[0].cooldown_until;
  });

  await notifyCreator(row, NOTIFY.REJECTED,
    `${row.brand_name} declined your pitch.${reason ? ` "${reason}"` : ''} ${CREATOR.cooldownLine(row.brand_name, until)}`);
  return detailForBrand(pitchId, brandId);
}

/* ─────────────────────────────────────────────────────────── the job */

/**
 * Three lanes, all idempotent, all safe to run twice:
 *   · remind the brand at 7 days and at 21, once each, while it still owes the
 *     FIRST answer;
 *   · close a pitch the brand never answered at its response deadline;
 *   · close a pitch early when her proposed date comes within item 4's floor,
 *     because no set can be built for it after that.
 */
async function housekeeping({ now = null } = {}) {
  const out = { reminded: 0, expired: 0, closedEarly: 0 };
  const today = todayInIndia();

  // ── The two reminders, only while the brand still owes the first answer.
  const { rows: waiting } = await db.query(
    `${SELECT} WHERE p.status = ANY($1) AND n.id IS NULL AND p.response_due_at IS NOT NULL
        AND (p.reminder_7d_sent_at IS NULL OR p.reminder_21d_sent_at IS NULL)`, [OPEN]
  );
  for (const r of waiting) {
    const age = Math.floor((Date.now() - new Date(r.created_at).getTime()) / 86400000);
    const which = age >= 21 && !r.reminder_21d_sent_at ? 'reminder_21d_sent_at'
      : (age >= 7 && !r.reminder_7d_sent_at ? 'reminder_7d_sent_at' : null);
    if (!which) continue;
    const { rowCount } = await db.query(
      `UPDATE influencer_proposals SET ${which} = now() WHERE id = $1 AND ${which} IS NULL`, [r.id]
    );
    if (!rowCount) continue;
    out.reminded += 1;
    await notifyBrand(r, NOTIFY.REMINDER,
      `${r.creator_name} pitched you ${termsLine(r)} and is still waiting. ${BRAND.replyBy(r.response_due_at, leftFrom(today, r.response_due_at))}.`);
  }

  // ── No reply by the deadline. Only ever a pitch the brand never answered.
  const { rows: lapsed } = await db.query(
    `${SELECT} WHERE p.status = ANY($1) AND n.id IS NULL AND p.response_due_at IS NOT NULL
        AND p.response_due_at <= COALESCE($2::timestamptz, now())`, [OPEN, now]
  );
  for (const r of lapsed) {
    const { rowCount } = await db.query(
      `UPDATE influencer_proposals SET status = 'expired', closed_reason = 'no_reply', updated_at = now()
        WHERE id = $1 AND status = ANY($2)`, [r.id, OPEN]
    );
    if (!rowCount) continue;
    out.expired += 1;
    // She may pitch that brand again immediately. No cooldown.
    await notifyCreator(r, NOTIFY.EXPIRED, ENDING.noReply(r.brand_name, r.response_due_at));
  }

  // ── Her date has come too close for a set to be built for it at all.
  const floor = setShape.earliestGoLiveDay(today);
  const { rows: tooClose } = await db.query(
    `${SELECT} WHERE p.status = ANY($1) AND p.proposed_go_live_date IS NOT NULL AND p.proposed_go_live_date < $2::date`,
    [OPEN, floor]
  );
  for (const r of tooClose) {
    const closed = await db.withTransaction(async (tx) => {
      const { rowCount } = await tx.query(
        `UPDATE influencer_proposals SET status = 'expired', closed_reason = 'date_passed', updated_at = now()
          WHERE id = $1 AND status = ANY($2)`, [r.id, OPEN]
      );
      if (!rowCount) return false;
      await negotiation.endThread(tx, r.neg_id, 'expired', null);
      return true;
    });
    if (!closed) continue;
    out.closedEarly += 1;
    await notifyCreator(r, NOTIFY.CLOSED, ENDING.datePassed(r.proposed_go_live_date, today));
    await notifyBrand(r, NOTIFY.CLOSED, `${r.creator_name}'s pitch closed: the date she offered is now too close for a set.`);
  }

  return out;
}

/* ─────────────────────────────────────────────────────────── notifications */

async function notifyBrand(row, key, body) {
  if (!row || !row.brand_user_id) return;
  await notificationService.send({
    userId: row.brand_user_id, type: key.type, title: key.title, body,
    data: { screen: 'brand_pitch', pitch_id: row.id }, sendSms: false,
  }).catch((e) => console.error(`[NOTIFICATION] ${key.type} failed:`, e.message));
}

async function notifyCreator(row, key, body) {
  if (!row || !row.creator_user_id) return;
  await notificationService.send({
    userId: row.creator_user_id, type: key.type, title: key.title, body,
    data: { screen: 'my_pitch', pitch_id: row.id }, sendSms: false,
  }).catch((e) => console.error(`[NOTIFICATION] ${key.type} failed:`, e.message));
}

module.exports = {
  OPEN, MAX_OPEN_PER_BRAND,
  formFor, send, listForCreator, detailForCreator, withdraw,
  listForBrand, detailForBrand, accept, reject, housekeeping,
  termsOf, termsLine, groupOf, cooldownFor, openPitches, load,
};
