'use strict';

/**
 * contentFlow.service.js — the Pay for Content step, from the package to the second payment.
 * Contract: features/item12-content · rules v1.29 §12.2 · G1, G4–G11 · approval §2, §3
 *
 *   read (G1) · caption (G4) · submit (G5) · approve (G6) · changes (G7)
 *   proof (G8) · posted (G9) · confirmLive (G10) · report (G11) · openMove (Needs You, reminders)
 *
 * Every path asks the content gate first (ownership → gate → Aim → shoot → rows). Every WRITE
 * then takes the content row FOR UPDATE and asks `assertNotFrozen` — the one guard for a brand's
 * report (approval §2.7). Every write is a compare-and-swap, so two taps or two devices give one
 * submission, one verdict, one confirmation, one release (check 20). Notifications and the diary
 * go after commit, so neither can ever undo or block what they describe.
 */

const db = require('../config/db');
const AppError = require('../utils/AppError');
const contentGate = require('./contentGate.service');
const content = require('./content.service');
const contentMoney = require('./contentMoney.service');
const platformSettings = require('./platformSettings.service');
const notificationService = require('./notification.service');
const events = require('./collabEvents.service');
const { MSG, NOTIFY12, HOSTS, DELAYED_STAGE_LABEL } = require('./contentCopy');
const { DELAYED_STAGE_LABEL: ALL_DELAYED_LABELS, shortDay } = require('./productionCopy');
const { istDayOf, addDays, startOfIndiaDay, todayInIndia, daysBetween, calendarDay } = require('../utils/indiaDay');

const refuse = (code, message, status = 422, field = null) => { throw new AppError(code, message, status, field); };
const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'She';
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const ENDED_CI = ['removed', 'withdrawn', 'declined', 'expired', 'rejected_by_brand'];
const ENDED_CONTRACT = ['withdrawn', 'declined', 'expired'];

/* ───────────────────────────────────────────────────────────── loading */

/** Everything the step holds, for one content row. `conn` joins a caller's transaction. */
async function snapshot(conn, ciId, cc) {
  const q = async (sql, p) => (await conn.query(sql, p)).rows;
  const none = [];
  return {
    rounds: cc ? await content.roundsOf(cc.id, conn) : none,
    files: cc ? await q(`SELECT * FROM content_files WHERE content_id = $1 AND deleted_at IS NULL ORDER BY uploaded_at, id`, [cc.id]) : none,
    notes: cc ? await q(`SELECT * FROM content_file_notes WHERE content_id = $1 ORDER BY round_no, created_at`, [cc.id]) : none,
    captions: cc ? await q(`SELECT row_key, caption FROM content_captions WHERE content_id = $1`, [cc.id]) : none,
    proofs: cc ? await q(`SELECT * FROM content_proofs WHERE content_id = $1 ORDER BY row_key, slot`, [cc.id]) : none,
    escrow: await q(`SELECT id, tranche_number, amount, status, released_at, release_due_at FROM escrow_entries WHERE campaign_influencer_id = $1 ORDER BY tranche_number`, [ciId]),
  };
}

/** The files of the draft in one row: sent-or-not, verified, not taken out. */
const draftFiles = (s, rowKey) => s.files.filter((f) => f.purpose === 'content' && f.row_key === rowKey
  && f.removed_round == null && f.verified_at);

/** What is still missing before the package can be sent — per row, the count short. */
function missingOf(rows, s) {
  return rows.map((r) => ({ key: r.key, label: r.label, need: r.count, have: draftFiles(s, r.key).length }))
    .filter((x) => x.have < x.need).map((x) => ({ ...x, short: x.need - x.have }));
}

/** Every proof slot, filled or not (approval §2.3: one slot per unit of the count). */
function slotsOf(rows, s) {
  const out = [];
  for (const r of rows) {
    for (let slot = 1; slot <= r.count; slot += 1) {
      const p = s.proofs.find((x) => x.row_key === r.key && x.slot === slot);
      out.push({ rowKey: r.key, slot, isStory: r.isStory, url: p ? p.url : null, screenshotFileId: p ? p.screenshot_file_id : null, filled: !!p });
    }
  }
  return out;
}

/**
 * Whose move it is, and since when — ONE rule for Needs You and the 48-hour reminders (J2b).
 * null when nobody owes anything: live, complete, or held by a brand's report.
 */
function openMove(stage, cc, rounds, shootDoneAt) {
  if (cc && cc.brand_reported_at) return null;
  const last = rounds[rounds.length - 1] || null;
  switch (stage) {
    case 'draft':     return { key: 'send_content', side: 'creator', since: shootDoneAt };
    case 'changes':   return { key: 'make_changes', side: 'creator', since: last && last.verdict_at };
    case 'in_review': return { key: 'review_content', side: 'brand', since: last && last.submitted_at };
    case 'approved':  return { key: 'post_and_link', side: 'creator', since: cc.approved_at };
    case 'posted':    return { key: 'confirm_live', side: 'brand', since: cc.posted_at };
    default:          return null;
  }
}

/**
 * The same rule as openMove, in SQL, for lists (Needs You, the brand inbox, the step on a card).
 * `ci` is the campaign_influencers alias. Evaluates to one of the five moves, 'live', 'reported',
 * or NULL when the collaboration is not a Pay for Content one with its shoot done.
 */
const CONTENT_MOVE_SQL = (ci) => `(
  SELECT CASE
           WHEN cc.id IS NULL THEN 'send_content'
           WHEN cc.brand_reported_at IS NOT NULL THEN 'reported'
           WHEN cc.live_confirmed_at IS NOT NULL THEN 'live'
           WHEN cc.posted_at IS NOT NULL THEN 'confirm_live'
           WHEN cc.approved_at IS NOT NULL THEN 'post_and_link'
           WHEN EXISTS (SELECT 1 FROM content_rounds cr
                         WHERE cr.content_id = cc.id AND cr.round_no = cc.current_round AND cr.verdict IS NULL) THEN 'review_content'
           WHEN cc.current_round > 1 THEN 'make_changes'
           ELSE 'send_content'
         END
    FROM contracts cn
    JOIN production_events pee ON pee.contract_id = cn.id AND pee.status = 'completed'
    JOIN campaign_sets css ON css.id = ${ci}.set_id AND css.goal = 'engagement'
    LEFT JOIN collab_content cc ON cc.campaign_influencer_id = ${ci}.id
   WHERE cn.campaign_influencer_id = ${ci}.id
     AND cn.influencer_signed_at IS NOT NULL AND cn.brand_signed_at IS NOT NULL
   LIMIT 1)`;

/** collabStep's vocabulary for the content move (step 5, whose turn it is). */
const SOCIAL_STATE_OF_MOVE = {
  review_content: 'submitted', make_changes: 'changes_asked', post_and_link: 'approved',
  confirm_live: 'posted', live: 'confirmed', reported: 'none', send_content: 'none',
};

/** The Delayed stage for a content-step stage (§12.2, v1.29). null once the content is live. */
function delayedStageFor(stage) {
  return {
    draft: 'content_not_submitted', changes: 'content_changes_requested', in_review: 'content_in_review',
    approved: 'content_not_posted', posted: 'content_not_confirmed',
  }[stage] || null;
}

/* ───────────────────────────────────────────────────────────── G1 — the state */

/**
 * The content step, as one side sees it. The brand sees only what she has SENT (the latest
 * submitted package, and proof once she says she posted); she sees her draft. Both see every
 * round — what was sent, the verdict, the reason, the notes (approval §2.2, check 37).
 */
async function read(ciId, scope) {
  const g = await contentGate.assertContentOpen(ciId, scope, db, { allowShootNotDone: true });
  const cc = g.shootDone ? await content.contentRow(ciId) : null;
  const s = await snapshot(db, ciId, cc);
  const settingRounds = await platformSettings.get('content_change_rounds');
  const settingWait = await platformSettings.get('final_payment_wait_days');
  return shape(g, cc, s, scope.side, settingRounds, settingWait);
}

function shape(g, cc, s, side, settingRounds, settingWait = 7) {
  const r = g.r;
  const terms = r.terms_json || {};
  const money = terms.money || {};
  const stage = !g.shootDone ? 'shoot_not_done' : content.stageOf(cc, s.rounds);
  const frozen = !!(cc && cc.brand_reported_at);
  const allowed = cc && cc.rounds_allowed != null ? cc.rounds_allowed : settingRounds;
  const current = cc ? cc.current_round : 1;
  const lastRound = s.rounds[s.rounds.length - 1] || null;
  const showDraft = side === 'creator' && ['draft', 'changes'].includes(stage);
  const pkgRow = (key) => (lastRound && lastRound.package_json && (lastRound.package_json.rows || []).find((x) => x.key === key)) || null;
  const captionOf = (key) => { const c = s.captions.find((x) => x.row_key === key); return c ? c.caption : ''; };
  // The notes she is working from: those pinned on the last round that asked for changes.
  const noteRound = lastRound && lastRound.verdict === 'changes' ? lastRound.round_no : null;
  const fileOut = (f) => ({
    ...content.fileOut(f),
    notes: s.notes.filter((n) => n.file_id === f.id).map((n) => ({ round: n.round_no, note: n.note })),
    pinnedNote: noteRound ? ((s.notes.find((n) => n.file_id === f.id && n.round_no === noteRound)) || {}).note || null : null,
  });
  const proofsVisible = side === 'creator' || !!(cc && cc.posted_at);
  const slots = slotsOf(g.rows, s);

  const rows = g.rows.map((row) => {
    let files;
    let caption;
    if (showDraft) {
      files = draftFiles(s, row.key).map(fileOut);
      caption = captionOf(row.key);
    } else {
      const p = pkgRow(row.key);
      const ids = p ? p.fileIds || [] : [];
      files = ids.map((id) => s.files.find((f) => f.id === id)).filter(Boolean).map(fileOut);
      caption = p ? p.caption || '' : '';
    }
    return {
      ...row, caption, files, have: files.length,
      proofs: proofsVisible ? slots.filter((x) => x.rowKey === row.key).map(({ slot, url, screenshotFileId, filled }) => ({ slot, url, screenshotFileId, filled })) : [],
    };
  });

  const esc = (n) => s.escrow.find((e) => e.tranche_number === n) || null;
  const t = (n, pct) => {
    const e = esc(n);
    const split = money.split || {};
    return { amount: e ? Number(e.amount) : Number(split[`t${n}`] || 0), pct, status: e ? e.status : null, paidAt: e && e.status === 'released' ? e.released_at : null, dueAt: e ? e.release_due_at : null };
  };
  const moneyOut = {
    fee: Number(money.fee || 0),
    t1: t(1, 25), t2: t(2, 25), t3: t(3, 50),
    stillLocked: contentMoney.stillLockedOf(s.escrow),
    // "After {n} days · 50%": the number stamped at the confirmation, or today's setting before it.
    waitDays: cc && cc.final_wait_days != null ? cc.final_wait_days : settingWait,
    // The campaign fee is the brand's alone (§3, v1.29) — it never reaches her screen.
    ...(side === 'brand' ? { campaignFee: Number(money.campaignFee || 0) } : {}),
  };

  const move = g.shootDone ? openMove(stage, cc, s.rounds, g.shootDoneAt) : null;
  const liveStage = delayedStageFor(stage);
  const delayed = r.delayed_at ? {
    at: r.delayed_at,
    stage: g.shootDone && liveStage ? liveStage : r.delayed_stage,
    label: ALL_DELAYED_LABELS[g.shootDone && liveStage ? liveStage : r.delayed_stage] || null,
  } : null;
  const today = todayInIndia();
  const postingDate = calendarDay(r.go_live_date);
  const reportFrom = cc && cc.report_after_at ? cc.report_after_at : null;

  const inReview = stage === 'in_review';
  const can = side === 'creator' ? {
    upload: !frozen && ['draft', 'changes'].includes(stage),
    submit: !frozen && ['draft', 'changes'].includes(stage) && missingOf(g.rows, s).length === 0,
    addProof: !frozen && stage === 'approved',
    markPosted: !frozen && stage === 'approved' && slots.every((x) => x.filled),
    report: !frozen && stage === 'posted' && !(cc && cc.creator_reported_at) && !!reportFrom && new Date(reportFrom) <= new Date(),
  } : {
    approve: !frozen && inReview,
    askChanges: !frozen && inReview && current <= allowed,
    confirmLive: !frozen && stage === 'posted',
    reportRoundsUsed: !frozen && inReview && current > allowed,
    reportPostedWrong: !frozen && stage === 'posted',
  };

  return {
    invitationId: r.ci_id, contentId: cc ? cc.id : null,
    campaignName: r.campaign_name, setName: r.set_name, mode: r.pe_mode || r.set_mode,
    brand: { name: r.brand_name }, creator: { name: r.creator_name },
    stage, frozen,
    shootDoneAt: g.shootDoneAt, postingDate, daysToPosting: postingDate ? daysBetween(today, postingDate) : null,
    rows,
    missing: side === 'creator' && showDraft ? missingOf(g.rows, s) : [],
    proofsLeft: side === 'creator' && stage === 'approved' ? slots.filter((x) => !x.filled).map(({ rowKey, slot, isStory }) => ({ rowKey, slot, isStory })) : [],
    round: { current, allowed, isLast: current === allowed, used: current > allowed, stamped: !!(cc && cc.rounds_allowed != null) },
    rounds: s.rounds.map((rd) => ({
      no: rd.round_no, submittedAt: rd.submitted_at, verdict: rd.verdict, verdictAt: rd.verdict_at, reason: rd.reason,
      rows: ((rd.package_json && rd.package_json.rows) || []).map((x) => ({ key: x.key, caption: x.caption || '', fileIds: x.fileIds || [] })),
      notes: s.notes.filter((n) => n.round_no === rd.round_no).map((n) => ({ fileId: n.file_id, note: n.note })),
    })),
    changesAsked: s.rounds.filter((rd) => rd.verdict === 'changes').length,
    approvedAt: cc ? cc.approved_at : null,
    postedAt: cc ? cc.posted_at : null,
    reportFrom,
    liveConfirmedAt: cc ? cc.live_confirmed_at : null,
    finalDueAt: (esc(3) && esc(3).release_due_at) || (cc ? cc.final_due_at : null),
    completedAt: cc ? cc.completed_at : null,
    proofCount: s.proofs.length,
    money: moneyOut,
    usageRights: (terms.work && terms.work.usageRights) || null,
    reported: {
      brand: cc && cc.brand_reported_at ? { at: cc.brand_reported_at, kind: cc.brand_report_kind } : null,
      creator: cc && cc.creator_reported_at ? { at: cc.creator_reported_at } : null,
    },
    delayed,
    yourMove: !!(move && move.side === side),
    move: move ? { key: move.key, side: move.side, since: move.since } : null,
    can,
    steps: [
      { key: 'signed', label: 'Agreement signed', state: 'done', at: g.gate.signed.at },
      { key: 'shoot', label: 'Shoot', state: g.shootDone ? 'done' : 'now', at: g.shootDoneAt },
      { key: 'content', label: 'Content', state: ['live', 'complete'].includes(stage) ? 'done' : g.shootDone ? 'now' : 'later', at: cc ? cc.live_confirmed_at : null },
      { key: 'live', label: 'Live and paid', state: stage === 'complete' ? 'done' : stage === 'live' ? 'now' : 'later', at: cc ? cc.completed_at : null, postingDate },
    ],
  };
}

/* ───────────────────────────────────────────────────────────── notifications (after commit) */

function notifyCreator(r, key, body) {
  return notificationService.send({
    userId: r.creator_user_id, type: key.type, title: key.title, body, sendSms: false,
    data: { screen: 'my_content', campaign_influencer_id: r.ci_id },
  }).catch((e) => console.error(`[NOTIFICATION] ${key.type} failed:`, e.message));
}
function notifyBrand(r, key, body) {
  return notificationService.send({
    userId: r.brand_user_id, type: key.type, title: key.title, body, sendSms: false,
    data: { screen: 'brand_content', campaign_influencer_id: r.ci_id, campaign_id: r.campaign_id, set_id: r.set_id },
  }).catch((e) => console.error(`[NOTIFICATION] ${key.type} failed:`, e.message));
}
const diary = (r, side, userId, action, meta = {}) => events.record({
  campaignInfluencerId: r.ci_id, step: events.STEP.GO_LIVE, actorRole: side, actorUserId: userId || null, action, meta,
});

/* ───────────────────────────────────────────────────────────── the writes */

/** Open, locked and not frozen: the preamble of every write. */
async function lockedOpen(client, g) {
  const cc = await content.ensureContent(client, g);
  content.assertNotFrozen(cc);
  const s = await snapshot(client, g.r.ci_id, cc);
  return { cc, s, stage: content.stageOf(cc, s.rounds) };
}
const creatorOnly = (scope) => { if (scope.side !== 'creator') refuse('NOT_FOUND', 'Not found', 404); };
const brandOnly = (scope) => { if (scope.side !== 'brand') refuse('NOT_FOUND', 'Not found', 404); };

/** G4 — her caption for one row. Optional; ≤ 500. */
async function caption(ciId, scope, rowKey, text) {
  creatorOnly(scope);
  const g = await contentGate.assertContentOpen(ciId, scope);
  const row = g.rows.find((x) => x.key === rowKey);
  if (!row) refuse('UNKNOWN_ROW', MSG.UNKNOWN_ROW, 422, 'rowKey');
  const value = String(text == null ? '' : text);
  if (value.length > 500) refuse('CAPTION_TOO_LONG', MSG.CAPTION_TOO_LONG, 422, 'caption');
  await db.withTransaction(async (client) => {
    const { cc, s } = await lockedOpen(client, g);
    content.assertDraftOpen(cc, s.rounds, g.r.brand_name);
    if (value.trim() === '') await client.query(`DELETE FROM content_captions WHERE content_id = $1 AND row_key = $2`, [cc.id, row.key]);
    else {
      await client.query(
        `INSERT INTO content_captions (content_id, row_key, caption) VALUES ($1,$2,$3)
         ON CONFLICT (content_id, row_key) DO UPDATE SET caption = EXCLUDED.caption, updated_at = now()`, [cc.id, row.key, value]);
    }
  });
  return read(ciId, scope);
}

/**
 * G5 — send the package. Every row at its count, or nothing (§22, check 4). The rounds limit is
 * stamped here, at her FIRST submission, and never again (check 8). `round` is the round her
 * screen showed: a second tap or a second device finds it already sent (check 20).
 */
async function submit(ciId, scope, { round } = {}) {
  creatorOnly(scope);
  const g = await contentGate.assertContentOpen(ciId, scope);
  const settingRounds = await platformSettings.get('content_change_rounds');
  const out = await db.withTransaction(async (client) => {
    const { cc, s, stage } = await lockedOpen(client, g);
    if (stage === 'in_review') refuse('ALREADY_SUBMITTED', MSG.ALREADY_SUBMITTED(g.r.brand_name), 422, 'status');
    if (!['draft', 'changes'].includes(stage)) refuse('ALREADY_APPROVED', MSG.ALREADY_APPROVED, 422, 'status');
    if (round != null && Number(round) !== cc.current_round) refuse('ALREADY_SUBMITTED', MSG.ALREADY_SUBMITTED(g.r.brand_name), 422, 'round');
    if (missingOf(g.rows, s).length) refuse('PACKAGE_INCOMPLETE', MSG.PACKAGE_INCOMPLETE, 422, 'rows');

    const captions = Object.fromEntries(s.captions.map((c) => [c.row_key, c.caption]));
    const pkg = { rows: g.rows.map((row) => ({ key: row.key, type: row.type, count: row.count, caption: captions[row.key] || '', fileIds: draftFiles(s, row.key).map((f) => f.id) })) };
    try {
      await client.query(
        `INSERT INTO content_rounds (content_id, round_no, submitted_by, package_json) VALUES ($1,$2,$3,$4)`,
        [cc.id, cc.current_round, scope.userId, JSON.stringify(pkg)]);
    } catch (e) {
      if (e.code === '23505') refuse('ALREADY_SUBMITTED', MSG.ALREADY_SUBMITTED(g.r.brand_name), 422, 'round');
      throw e;
    }
    if (cc.rounds_allowed == null) {
      await client.query(
        `UPDATE collab_content SET rounds_allowed = $2, first_submitted_at = now(), updated_at = now()
          WHERE id = $1 AND rounds_allowed IS NULL`, [cc.id, settingRounds]);
    } else {
      await client.query(`UPDATE collab_content SET updated_at = now() WHERE id = $1`, [cc.id]);
    }
    return { round: cc.current_round };
  });
  const key = out.round === 1 ? NOTIFY12.SUBMITTED : NOTIFY12.RESUBMITTED;
  notifyBrand(g.r, key, out.round === 1
    ? `${first(g.r.creator_name)} sent her content. Review it before she posts anything.`
    : `${first(g.r.creator_name)} sent her changes. Round ${out.round} is with you.`);
  diary(g.r, 'creator', scope.userId, out.round === 1 ? 'submitted' : 'resubmitted', { round: out.round });
  return read(ciId, scope);
}

/** A verdict is only on the round that is in review now. */
function assertReviewable(g, cc, stage, round) {
  if (['approved', 'posted', 'live', 'complete'].includes(stage)) refuse('ALREADY_APPROVED', MSG.ALREADY_APPROVED, 422, 'status');
  if (stage !== 'in_review') refuse('NOTHING_TO_REVIEW', MSG.NOTHING_TO_REVIEW(first(g.r.creator_name)), 422, 'status');
  if (round != null && Number(round) !== cc.current_round) refuse('STALE', MSG.STALE, 422, 'round');
}

/** G6 — approve the package, whole. Works with no rounds used, after one, after the last (check 6). */
async function approve(ciId, scope, { round } = {}) {
  brandOnly(scope);
  const g = await contentGate.assertContentOpen(ciId, scope);
  const out = await db.withTransaction(async (client) => {
    const { cc, stage } = await lockedOpen(client, g);
    assertReviewable(g, cc, stage, round);
    const { rowCount } = await client.query(
      `UPDATE content_rounds SET verdict = 'approved', verdict_at = now(), verdict_by = $3
        WHERE content_id = $1 AND round_no = $2 AND verdict IS NULL`, [cc.id, cc.current_round, scope.userId]);
    if (rowCount !== 1) refuse('ALREADY_APPROVED', MSG.ALREADY_APPROVED, 422, 'status');
    await client.query(
      `UPDATE collab_content SET approved_at = now(), approved_by = $2, approved_round = $3, updated_at = now()
        WHERE id = $1 AND approved_at IS NULL`, [cc.id, scope.userId, cc.current_round]);
    return { round: cc.current_round };
  });
  notifyCreator(g.r, NOTIFY12.APPROVED, `${g.r.brand_name} approved your content. Post it now — this is the version they approved.`);
  diary(g.r, 'brand', scope.userId, 'approved', { round: out.round });
  return read(ciId, scope);
}

/**
 * G7 — ask for changes: a reason (required, ≤ 500), notes pinned to files of THIS round (≤ 300).
 * Refused beyond the stamped rounds (check 10) — only approve or report remain.
 */
async function askChanges(ciId, scope, { round, reason, notes } = {}) {
  brandOnly(scope);
  const why = String(reason == null ? '' : reason).trim();
  if (!why) refuse('REASON_REQUIRED', MSG.REASON_REQUIRED, 422, 'reason');
  if (why.length > 500) refuse('REASON_TOO_LONG', MSG.REASON_TOO_LONG, 422, 'reason');
  const pins = Array.isArray(notes) ? notes : [];
  for (const n of pins) {
    const t = String((n && n.note) || '').trim();
    if (!t || t.length > 300) refuse('NOTE_TOO_LONG', MSG.NOTE_TOO_LONG, 422, 'notes');
  }
  const g = await contentGate.assertContentOpen(ciId, scope);
  const out = await db.withTransaction(async (client) => {
    const { cc, s, stage } = await lockedOpen(client, g);
    assertReviewable(g, cc, stage, round);
    const allowed = cc.rounds_allowed;
    if (cc.current_round > allowed) refuse('ROUNDS_USED', MSG.ROUNDS_USED(allowed), 422, 'status');
    const cur = s.rounds.find((x) => x.round_no === cc.current_round);
    const sent = new Set(((cur.package_json && cur.package_json.rows) || []).flatMap((x) => x.fileIds || []));
    for (const n of pins) if (!sent.has(n.fileId)) refuse('FILE_NOT_FOUND', MSG.FILE_NOT_FOUND, 422, 'notes');

    const { rowCount } = await client.query(
      `UPDATE content_rounds SET verdict = 'changes', verdict_at = now(), verdict_by = $3, reason = $4
        WHERE content_id = $1 AND round_no = $2 AND verdict IS NULL`, [cc.id, cc.current_round, scope.userId, why]);
    if (rowCount !== 1) refuse('STALE', MSG.STALE, 422, 'round');
    for (const n of pins) {
      await client.query(
        `INSERT INTO content_file_notes (content_id, file_id, round_no, note, created_by) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (file_id, round_no) DO UPDATE SET note = EXCLUDED.note`,
        [cc.id, n.fileId, cc.current_round, String(n.note).trim(), scope.userId]);
    }
    const { rowCount: moved } = await client.query(
      `UPDATE collab_content SET current_round = current_round + 1, updated_at = now() WHERE id = $1 AND current_round = $2`,
      [cc.id, cc.current_round]);
    if (moved !== 1) refuse('STALE', MSG.STALE, 422, 'round');
    return { round: cc.current_round, allowed };
  });
  notifyCreator(g.r, NOTIFY12.CHANGES, `${g.r.brand_name} asked for changes: "${why.length > 120 ? `${why.slice(0, 117)}…` : why}"`);
  diary(g.r, 'brand', scope.userId, 'changes_asked', { round: out.round, reason: why, notes: pins.length });
  return read(ciId, scope);
}

/** A public link to a post on the row's platform. Shape only; never fetched (Q15–Q29). */
function validLink(raw, platform) {
  const s = String(raw || '').trim();
  if (!s || s.length > 500) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (!(HOSTS[platform] || []).includes(u.hostname.toLowerCase())) return null;
  if (!u.pathname || u.pathname === '/' ) return null;
  return u.toString();
}

/** G8 — the proof for one slot: a link, or for a Story a screenshot already uploaded (§2.3, §2.6). */
async function setProof(ciId, scope, rowKey, slotRaw, { url, screenshotFileId } = {}) {
  creatorOnly(scope);
  const g = await contentGate.assertContentOpen(ciId, scope);
  const row = g.rows.find((x) => x.key === rowKey);
  const slot = Number(slotRaw);
  if (!row || !Number.isInteger(slot) || slot < 1 || slot > row.count) refuse('UNKNOWN_SLOT', MSG.UNKNOWN_SLOT, 422, 'slot');
  await db.withTransaction(async (client) => {
    const { cc } = await lockedOpen(client, g);
    if (!cc.approved_at) refuse('NOT_APPROVED', MSG.NOT_APPROVED(g.r.brand_name), 422, 'status');
    if (cc.posted_at) refuse('ALREADY_POSTED', MSG.ALREADY_POSTED, 422, 'status');
    let link = null; let shot = null;
    if (row.isStory) {
      if (!screenshotFileId) refuse('SCREENSHOT_ONLY', MSG.SCREENSHOT_ONLY, 422, 'screenshotFileId');
      const { rows: [f] } = await client.query(
        `SELECT id FROM content_files WHERE id = $1 AND content_id = $2 AND purpose = 'story_proof' AND row_key = $3
            AND verified_at IS NOT NULL AND deleted_at IS NULL`, [screenshotFileId, cc.id, row.key]);
      if (!f) refuse('FILE_NOT_FOUND', MSG.FILE_NOT_FOUND, 422, 'screenshotFileId');
      const { rows: [used] } = await client.query(
        `SELECT 1 FROM content_proofs WHERE screenshot_file_id = $1 AND NOT (row_key = $2 AND slot = $3)`, [f.id, row.key, slot]);
      if (used) refuse('FILE_NOT_FOUND', MSG.FILE_NOT_FOUND, 422, 'screenshotFileId');
      shot = f.id;
    } else {
      if (screenshotFileId && !url) refuse('LINK_ONLY', MSG.LINK_ONLY, 422, 'url');
      link = validLink(url, row.platform);
      if (!link) refuse('LINK_INVALID', MSG.LINK_INVALID, 422, 'url');
    }
    await client.query(
      `INSERT INTO content_proofs (content_id, row_key, slot, url, screenshot_file_id) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (content_id, row_key, slot) DO UPDATE SET url = EXCLUDED.url, screenshot_file_id = EXCLUDED.screenshot_file_id, updated_at = now()`,
      [cc.id, row.key, slot, link, shot]);
  });
  return read(ciId, scope);
}

/** G8 — clear one slot before she says she posted. */
async function clearProof(ciId, scope, rowKey, slotRaw) {
  creatorOnly(scope);
  const g = await contentGate.assertContentOpen(ciId, scope);
  const row = g.rows.find((x) => x.key === rowKey);
  if (!row) refuse('UNKNOWN_SLOT', MSG.UNKNOWN_SLOT, 422, 'slot');
  await db.withTransaction(async (client) => {
    const { cc } = await lockedOpen(client, g);
    if (cc.posted_at) refuse('ALREADY_POSTED', MSG.ALREADY_POSTED, 422, 'status');
    await client.query(`DELETE FROM content_proofs WHERE content_id = $1 AND row_key = $2 AND slot = $3`, [cc.id, row.key, Number(slotRaw)]);
  });
  return read(ciId, scope);
}

/** G9 — she has posted: every slot of every row proved (check 12, 38); the silence period stamped. */
async function markPosted(ciId, scope) {
  creatorOnly(scope);
  const g = await contentGate.assertContentOpen(ciId, scope);
  const days = await platformSettings.get('content_report_silence_days');
  const out = await db.withTransaction(async (client) => {
    const { cc, s } = await lockedOpen(client, g);
    if (!cc.approved_at) refuse('NOT_APPROVED', MSG.NOT_APPROVED(g.r.brand_name), 422, 'status');
    if (cc.posted_at) refuse('ALREADY_POSTED', MSG.ALREADY_POSTED, 422, 'status');
    if (slotsOf(g.rows, s).some((x) => !x.filled)) refuse('PROOF_INCOMPLETE', MSG.PROOF_INCOMPLETE, 422, 'proofs');
    const now = new Date();
    const after = startOfIndiaDay(addDays(istDayOf(now), days));
    const { rowCount } = await client.query(
      `UPDATE collab_content SET posted_at = $2, posted_by = $3, report_silence_days = $4, report_after_at = $5, updated_at = now()
        WHERE id = $1 AND posted_at IS NULL`, [cc.id, now, scope.userId, days, after]);
    if (rowCount !== 1) refuse('ALREADY_POSTED', MSG.ALREADY_POSTED, 422, 'status');
    return { links: s.proofs.length };
  });
  notifyBrand(g.r, NOTIFY12.POSTED, `${first(g.r.creator_name)} posted everything. Open the links and confirm the content is live.`);
  diary(g.r, 'creator', scope.userId, 'posted', { proofs: out.links });
  return read(ciId, scope);
}

/**
 * G10 — the brand confirms the content is live. A MONEY WRITE (approval §2.4): the escrow rows
 * FOR UPDATE inside this transaction, idempotent on live_confirmed_at IS NULL, refused for a
 * collaboration that has ended or that the brand has reported. Releases the second 25% of her
 * fee through contentMoney and stamps the waiting period. `amount` is the figure the button
 * named; if it no longer matches, nothing moves.
 */
async function confirmLive(ciId, scope, { amount } = {}) {
  brandOnly(scope);
  const g = await contentGate.assertContentOpen(ciId, scope);
  const at = new Date();
  const out = await db.withTransaction(async (client) => {
    const { cc } = await lockedOpen(client, g);
    const { rows: [st] } = await client.query(
      `SELECT ci.status AS ci_status, con.status AS contract_status, c.status AS campaign_status
         FROM campaign_influencers ci JOIN contracts con ON con.campaign_influencer_id = ci.id
         JOIN campaign_sets cs ON cs.id = ci.set_id JOIN campaigns c ON c.id = cs.campaign_id WHERE ci.id = $1`, [ciId]);
    if (!st || ENDED_CI.includes(st.ci_status) || ENDED_CONTRACT.includes(st.contract_status) || st.campaign_status === 'cancelled') {
      refuse('COLLAB_ENDED', MSG.COLLAB_ENDED, 422, 'status');
    }
    if (cc.live_confirmed_at) refuse('ALREADY_CONFIRMED', MSG.ALREADY_CONFIRMED, 422, 'status');
    if (!cc.posted_at) refuse('NOT_POSTED', MSG.NOT_POSTED(first(g.r.creator_name)), 422, 'status');
    const { rows: [t2] } = await client.query(
      `SELECT amount FROM escrow_entries WHERE campaign_influencer_id = $1 AND tranche_number = 2`, [ciId]);
    if (amount != null && (!t2 || Math.round(Number(amount) * 100) !== Math.round(Number(t2.amount) * 100))) {
      refuse('AMOUNT_CHANGED', MSG.AMOUNT_CHANGED, 422, 'amount');
    }
    const { rowCount } = await client.query(
      `UPDATE collab_content SET live_confirmed_at = $2, live_confirmed_by = $3, updated_at = now()
        WHERE id = $1 AND live_confirmed_at IS NULL AND posted_at IS NOT NULL AND brand_reported_at IS NULL`,
      [cc.id, at, scope.userId]);
    if (rowCount !== 1) refuse('ALREADY_CONFIRMED', MSG.ALREADY_CONFIRMED, 422, 'status');
    const m = await contentMoney.releaseSecond(client, {
      ciId, influencerId: g.r.influencer_id, brandId: g.r.brand_id, campaignId: g.r.campaign_id, at,
    });
    await client.query(
      `UPDATE collab_content SET t2_released_at = $2, final_wait_days = $3, final_due_at = $4, updated_at = now() WHERE id = $1`,
      [cc.id, at, m.waitDays, m.dueAt]);
    return m;
  });
  notifyCreator(g.r, NOTIFY12.LIVE_CONFIRMED,
    `${g.r.brand_name} confirmed your content is live. ${rupees(out.secondAmount)} is in your wallet. The last ${rupees(out.finalAmount)} arrives on ${shortDay(out.dueAt)}.`);
  diary(g.r, 'brand', scope.userId, 'confirmed_live', { second: out.secondAmount, final_due_at: out.dueAt });
  return read(ciId, scope);
}

/**
 * G11 — report to INFLX (§26), recorded for item 18; no money moves.
 *   brand:   'rounds_used'  — only once the rounds are used, in review;
 *            'posted_wrong' — only after she posted, before any confirmation.
 *            Either FREEZES the step (v1.29, approval Q10).
 *   creator: 'brand_silent' — only from the stamped date; freezes nothing, and tells the brand
 *            (approval §2.5), who may still confirm and pay.
 */
async function report(ciId, scope, { kind, note } = {}) {
  const g = await contentGate.assertContentOpen(ciId, scope);
  const text = note == null ? null : String(note).trim() || null;
  if (text && text.length > 500) refuse('REASON_TOO_LONG', MSG.REASON_TOO_LONG, 422, 'note');
  const out = await db.withTransaction(async (client) => {
    const cc = await content.ensureContent(client, g);
    const s = await snapshot(client, ciId, cc);
    const stage = content.stageOf(cc, s.rounds);
    if (scope.side === 'brand') {
      if (cc.brand_reported_at) refuse('ALREADY_REPORTED', MSG.ALREADY_REPORTED, 422, 'status');
      const ok = (kind === 'rounds_used' && stage === 'in_review' && cc.rounds_allowed != null && cc.current_round > cc.rounds_allowed)
        || (kind === 'posted_wrong' && stage === 'posted');
      if (!ok) refuse('REPORT_NOT_OPEN', MSG.REPORT_NOT_OPEN, 422, 'kind');
      const { rowCount } = await client.query(
        `UPDATE collab_content SET brand_reported_at = now(), brand_reported_by = $2, brand_report_kind = $3, brand_report_note = $4, updated_at = now()
          WHERE id = $1 AND brand_reported_at IS NULL`, [cc.id, scope.userId, kind, text]);
      if (rowCount !== 1) refuse('ALREADY_REPORTED', MSG.ALREADY_REPORTED, 422, 'status');
      return { side: 'brand', kind };
    }
    content.assertNotFrozen(cc);
    if (kind !== 'brand_silent' || stage !== 'posted') refuse('REPORT_NOT_OPEN', MSG.REPORT_NOT_OPEN, 422, 'kind');
    if (cc.creator_reported_at) refuse('ALREADY_REPORTED', MSG.ALREADY_REPORTED, 422, 'status');
    if (!cc.report_after_at || new Date(cc.report_after_at) > new Date()) {
      refuse('REPORT_TOO_EARLY', MSG.REPORT_TOO_EARLY(shortDay(cc.report_after_at)), 422, 'status');
    }
    const { rowCount } = await client.query(
      `UPDATE collab_content SET creator_reported_at = now(), creator_reported_by = $2, creator_report_note = $3, updated_at = now()
        WHERE id = $1 AND creator_reported_at IS NULL`, [cc.id, scope.userId, text]);
    if (rowCount !== 1) refuse('ALREADY_REPORTED', MSG.ALREADY_REPORTED, 422, 'status');
    return { side: 'creator', kind: 'brand_silent' };
  });
  if (out.side === 'brand') {
    const body = MSG.REPORTED_BY_BRAND(g.r.brand_name);
    notifyCreator(g.r, NOTIFY12.REPORTED, body);
    notifyBrand(g.r, NOTIFY12.REPORTED, body);
  } else {
    notifyBrand(g.r, NOTIFY12.REPORTED, MSG.REPORTED_BY_CREATOR(first(g.r.creator_name)));
  }
  diary(g.r, out.side, scope.userId, 'reported', { kind: out.kind, note: text });
  return read(ciId, scope);
}

module.exports = {
  read, shape, snapshot, caption, submit, approve, askChanges, setProof, clearProof, markPosted, confirmLive, report,
  openMove, delayedStageFor, validLink, missingOf, slotsOf, draftFiles, DELAYED_STAGE_LABEL,
  CONTENT_MOVE_SQL, SOCIAL_STATE_OF_MOVE,
};
