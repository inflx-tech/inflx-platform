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
const { MSG, NOTIFY12, NOTIFY14, HOSTS, DELAYED_STAGE_LABEL, SALE_TYPES } = require('./contentCopy');
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

/**
 * Item 14: the rows that make up the package. A Pay for Sale `outside` row (a post shared after
 * the package was first sent) is links only and never part of it. Item 12's rows have no
 * `outside`, so for Pay for Content this is every row, exactly as before.
 */
const pkgRows = (rows) => rows.filter((r) => !r.outside);
const isSale = (g) => g && g.aim === 'sale';
const sale = () => require('./saleLive.service');

/** What is still missing before the package can be sent — per row, the count short. */
function missingOf(rows, s) {
  return pkgRows(rows).map((r) => ({ key: r.key, label: r.label, need: r.count, have: draftFiles(s, r.key).length }))
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
function openMove(stage, cc, rounds, shootDoneAt, posts = null) {
  if (cc && cc.brand_reported_at) return null;
  const last = rounds[rounds.length - 1] || null;
  switch (stage) {
    // Item 21: Path 2 is locked until INFLX approves her first shoppable post; once live, the final
    // 50% waits for the agreed number (D3, D4). Either way the move is hers: make the posts.
    case 'posts':     return { key: 'make_posts', side: 'creator', since: shootDoneAt };
    case 'live':      return posts && !posts.met ? { key: 'make_posts', side: 'creator', since: cc.live_confirmed_at } : null;
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
           -- Item 21: with shoppable posts on the terms, the package waits for the first approved post.
           WHEN ${ci}.sell_v2 AND ${ci}.shoppable_posts_n IS NOT NULL AND (cc.id IS NULL OR cc.first_submitted_at IS NULL)
                AND NOT EXISTS (SELECT 1 FROM creator_posts cpx WHERE cpx.campaign_influencer_id = ${ci}.id AND cpx.v2 AND cpx.approved_at IS NOT NULL) THEN 'make_posts'
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
  confirm_live: 'posted', live: 'confirmed', reported: 'none', send_content: 'none', make_posts: 'none',
};

/**
 * The Delayed stage for a content-step stage (§12.2, v1.29). null once the content is live —
 * unless (item 21, v1.34) the collaboration is still short of its agreed shoppable posts.
 */
function delayedStageFor(stage, posts = null) {
  if (stage === 'posts' || (stage === 'live' && posts && !posts.met)) return 'posts_not_approved';
  return {
    draft: 'content_not_submitted', changes: 'content_changes_requested', in_review: 'content_in_review',
    approved: 'content_not_posted', posted: 'content_not_confirmed',
  }[stage] || null;
}

/**
 * Item 21 — item 12's stage, with `posts` in front of it while Path 2 is locked: shoppable posts on
 * the terms, none approved yet, nothing ever sent. ONE rule for the screen, Needs You, the jobs.
 */
function stageWithPosts(stage, cc, posts) {
  if (stage === 'draft' && posts && !posts.open && !(cc && cc.first_submitted_at)) return 'posts';
  return stage;
}

/* ───────────────────────────────────────────────────────────── G1 — the state */

/**
 * The content step, as one side sees it. The brand sees only what she has SENT (the latest
 * submitted package, and proof once she says she posted); she sees her draft. Both see every
 * round — what was sent, the verdict, the reason, the notes (approval §2.2, check 37).
 */
async function read(ciId, scope) {
  const g = await contentGate.assertContentOpen(ciId, scope, db, { allowShootNotDone: true, allowOldTerms: true });
  const cc = g.shootDone && !g.oldTerms ? await content.contentRow(ciId) : null;
  const s = await snapshot(db, ciId, cc);
  const settingRounds = await platformSettings.get('content_change_rounds');
  const settingWait = await platformSettings.get('final_payment_wait_days');
  // Item 21: Path 1 of a Pay for Content collaboration with shoppable posts, counted against the
  // brand's number (saleLive draws the list; the number is the terms', never the admin minimum).
  const p1 = !isSale(g) && g.posts ? await sale().path1(ciId, g.r, db, { min: g.posts.n }) : null;
  const base = shape(g, cc, s, scope.side, settingRounds, settingWait, p1);
  const out = !isSale(g) ? base : shapeSale(g, cc, s, scope.side, base, g.oldTerms ? null : await sale().saleExtra(g, cc, s, scope.side));
  // post-performance-v2: every proof carries its social numbers (`stats`), the same words on both sides.
  return postStats().decorateRead(out, cc ? cc.id : null);
}
const postStats = () => require('./postStats.service');

/**
 * Item 14 — the same step, as a Pay for Sale collaboration reads it (board v2, S4–S24). Item 12's
 * shape is kept for what is shared (rows, files, rounds, proofs, reports) and the rest is Pay for
 * Sale's own: the two paths, no money, the self-confirmation date, completion, the sales.
 */
function shapeSale(g, cc, s, side, base, x) {
  const r = g.r;
  if (!x) {
    return { ...base, aim: 'sale', hybrid: !!g.hybrid, stage: 'old_terms', rows: [], money: null, move: null, yourMove: false, can: {}, path1: null, steps: [] };
  }
  const stage = x.stage;
  const frozen = !!(cc && cc.brand_reported_at);
  const rows = base.rows.map((row) => {
    const p = x.byId.get(row.postId) || null;
    // An outside row's link is reporting: the brand sees it as soon as she adds it (S21).
    const proofs = row.outside && side === 'brand'
      ? slotsOf([row], s).map(({ slot, url, screenshotFileId, filled }) => ({ slot, url, screenshotFileId, filled })) : row.proofs;
    return { ...row, proofs, post: p ? { id: p.id, title: p.title, code: p.code, cover: p.cover, state: p.state } : null };
  });
  const pkg = pkgRows(rows);
  // The brand reads what she SENT (item 12's rule): the last package's rows, and her outside links.
  const lastRound = s.rounds[s.rounds.length - 1] || null;
  const sentKeys = new Set(((lastRound && lastRound.package_json && lastRound.package_json.rows) || []).map((z) => z.key));
  const visibleRows = side === 'brand' ? rows.filter((row) => row.outside || sentKeys.has(row.key)) : rows;
  const slots = slotsOf(pkgRows(g.rows), s);
  let move = g.shootDone ? sale().saleMove(stage, cc, s.rounds, g.shootDoneAt) : null;
  // Confirmed and the minimum met: nobody owes a move (Hybrid waits for its final payment).
  if (stage === 'live' && x.p1.met) move = null;
  const liveStage = g.shootDone ? sale().delayedStageForSale(stage, x.p1) : null;
  const delayed = r.delayed_at ? {
    at: r.delayed_at,
    stage: liveStage || r.delayed_stage,
    label: ALL_DELAYED_LABELS[liveStage || r.delayed_stage] || null,
  } : null;
  const editing = !frozen && ['draft', 'changes'].includes(stage);
  const inReview = stage === 'in_review';
  const round = base.round;
  const postingPassed = x.postingDate ? todayInIndia() > x.postingDate : false;
  const can = side === 'creator' ? {
    addRows: editing && x.p1.open,
    removeRow: editing,
    upload: editing,
    submit: editing && pkg.length > 0 && missingOf(g.rows, s).length === 0,
    addProof: !frozen && stage === 'approved',
    markPosted: !frozen && stage === 'approved' && slots.every((z) => z.filled),
    addOutside: x.outsideOpen,
    // Item 15: on Hybrid she may tell INFLX about brand silence (item 12's rule); never on Pay for Sale.
    report: g.hybrid ? !!base.can.report : false,
  } : {
    approve: !frozen && inReview,
    askChanges: !frozen && inReview && round.current <= round.allowed,
    confirmLive: !frozen && stage === 'posted' && !base.settledByInflx,
    reportRoundsUsed: !frozen && inReview && round.current > round.allowed,
    reportPosted: !frozen && stage === 'posted',
    reportNotPosted: !frozen && (stage === 'posted' || (stage === 'approved' && postingPassed)),
  };
  const confirmed = !!(cc && cc.live_confirmed_at);
  return {
    ...base,
    aim: 'sale',
    stage, frozen, rows: visibleRows,
    missing: side === 'creator' && editing ? missingOf(g.rows, s) : [],
    proofsLeft: side === 'creator' && stage === 'approved' ? slots.filter((z) => !z.filled).map(({ rowKey, slot, isStory }) => ({ rowKey, slot, isStory })) : [],
    // Item 15: Hybrid's fixed amount — item 12's money block (25/25/50 of the fixed amount alone).
    money: g.hybrid ? base.money : null,
    hybrid: !!g.hybrid,
    paidInFull: !!(g.hybrid && s.escrow.length && s.escrow.every((e) => e.status === 'released')),
    path1: {
      min: x.p1.min, approved: x.p1.approved, short: x.p1.short, met: x.p1.met, late: x.p1.late,
      inReview: x.p1.inReview, sentBack: x.p1.sentBack, open: x.p1.open,
      posts: x.p1.posts.map((p) => ({ ...p, inPackage: pkg.some((row) => row.postId === p.id) })),
    },
    notShared: side === 'brand' ? x.notShared.filter((n) => n.overdue) : x.notShared,
    sales: x.sales,
    autoconfirmAt: cc ? cc.autoconfirm_at : null,
    liveConfirmedAuto: !!(cc && cc.live_confirmed_auto),
    waitingOnPosts: confirmed && !(cc && cc.completed_at),
    postingDate: x.postingDate, daysToPosting: x.daysToPosting,
    delayed,
    yourMove: !!(move && move.side === side),
    move: move ? { key: move.key, side: move.side, since: move.since } : null,
    can,
    destinations: Object.keys(SALE_TYPES).map((k) => ({ type: k, label: SALE_TYPES[k].label, platform: SALE_TYPES[k].platform, isStory: k === 'story' })),
    steps: [
      { key: 'signed', label: 'Agreement signed', state: 'done', at: g.gate.signed.at },
      { key: 'shoot', label: 'Shoot', state: g.shootDone ? 'done' : 'now', at: g.shootDoneAt },
      { key: 'posts', label: 'Shoppable posts', state: x.p1.met ? 'done' : g.shootDone ? 'now' : 'later', detail: `${x.p1.approved} of ${x.p1.min}` },
      { key: 'social', label: 'Social media', state: confirmed ? 'done' : x.p1.open && g.shootDone ? 'now' : 'later', at: cc ? cc.live_confirmed_at : null },
      { key: 'complete', label: 'Completed', state: stage === 'complete' ? 'done' : 'later', at: cc ? cc.completed_at : null, postingDate: x.postingDate },
    ],
  };
}

function shape(g, cc, s, side, settingRounds, settingWait = 7, p1 = null) {
  const r = g.r;
  const terms = r.terms_json || {};
  const money = terms.money || {};
  // Item 21: the posts term (null on old terms and on sale collaborations, which have their own shape).
  const posts = !isSale(g) && g.posts ? g.posts : null;
  const locked = !!(posts && !posts.open);
  const stage = !g.shootDone ? 'shoot_not_done' : stageWithPosts(content.stageOf(cc, s.rounds), cc, posts);
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
    // A date is promised only for a payment that is actually QUEUED — never for one INFLX returned to the brand.
    return { amount: e ? Number(e.amount) : Number(split[`t${n}`] || 0), pct, status: e ? e.status : null, paidAt: e && e.status === 'released' ? e.released_at : null, dueAt: e && e.status === 'queued' ? e.release_due_at : null };
  };
  // Item 17: what INFLX returned to the brand when it settled a dispute (those payments will never be made).
  const returned = Math.round(s.escrow.filter((e) => e.status === 'refunded').reduce((a, e) => a + Number(e.amount || 0), 0) * 100) / 100;
  // She has posted, the brand never confirmed, and INFLX has since released or returned a payment by
  // hand: the brand's Confirm has nothing left to pay (confirmLive refuses it), so the screens must
  // not offer it or promise what it would pay.
  const settledByInflx = stage === 'posted' && !!(esc(2) && esc(3) && (esc(2).status !== 'locked' || esc(3).status !== 'locked'));
  const moneyOut = {
    fee: Number(money.fee || 0),
    t1: t(1, 25), t2: t(2, 25), t3: t(3, 50),
    stillLocked: contentMoney.stillLockedOf(s.escrow),
    returned,
    // "After {n} days · 50%": the number stamped at the confirmation, or today's setting before it.
    waitDays: cc && cc.final_wait_days != null ? cc.final_wait_days : settingWait,
    // The campaign fee is the brand's alone (§3, v1.29) — it never reaches her screen.
    ...(side === 'brand' ? { campaignFee: Number(money.campaignFee || 0) } : {}),
  };

  const move = g.shootDone ? openMove(stage, cc, s.rounds, g.shootDoneAt, posts) : null;
  const liveStage = delayedStageFor(stage, posts);
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
    confirmLive: !frozen && stage === 'posted' && !settledByInflx,
    reportRoundsUsed: !frozen && inReview && current > allowed,
    reportPostedWrong: !frozen && stage === 'posted',
    // Item 21 (R7): once the posting date has passed and she is short of her posts.
    reportPostsNotMade: !frozen && !!posts && !posts.met && postingPassed(postingDate) && stage !== 'complete',
  };
  // Item 21 (D3): the final 50% is queued, its date may have passed, and her posts are short.
  const finalHeldForPosts = !!(posts && !posts.met && esc(3) && esc(3).status === 'queued');

  return {
    invitationId: r.ci_id, contentId: cc ? cc.id : null,
    // Item 21 — Path 1 and the lock on Path 2 (null on old terms: the one-path step of item 12).
    path1: p1 ? { min: p1.min, approved: p1.approved, short: p1.short, met: p1.met, late: p1.late, inReview: p1.inReview, sentBack: p1.sentBack, open: p1.open, posts: p1.posts } : null,
    path2Locked: locked,
    finalHeldForPosts,
    postsShort: posts ? posts.short : 0,
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
    settledByInflx,
    liveConfirmedAt: cc ? cc.live_confirmed_at : null,
    // Who confirmed: the brand; nobody (Pay for Sale confirms itself after the stamped days); or INFLX,
    // standing in for a brand that stayed silent (item 17) — the screens must not say "You confirmed".
    liveConfirmedBy: cc && cc.live_confirmed_at ? (cc.live_confirmed_auto ? 'auto' : cc.live_confirmed_by ? 'brand' : 'inflx') : null,
    finalDueAt: esc(3) && esc(3).status === 'refunded' ? null : ((esc(3) && esc(3).release_due_at) || (cc ? cc.final_due_at : null)),
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
      // Item 21: the posts step sits between the shoot and the content, counted against the terms.
      ...(posts ? [{ key: 'posts', label: 'Shoppable posts', state: posts.met ? 'done' : g.shootDone ? 'now' : 'later', detail: `${posts.approved} of ${posts.n}` }] : []),
      { key: 'content', label: 'Content', state: ['live', 'complete'].includes(stage) ? 'done' : g.shootDone && !locked ? 'now' : 'later', at: cc ? cc.live_confirmed_at : null },
      { key: 'live', label: 'Live and paid', state: stage === 'complete' ? 'done' : stage === 'live' ? 'now' : 'later', at: cc ? cc.completed_at : null, postingDate },
    ],
  };
}

/** Has the posting date passed, in India? */
const postingPassed = (postingDate) => !!(postingDate && todayInIndia() > postingDate);

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
  if (!row || row.outside) refuse('UNKNOWN_ROW', MSG.UNKNOWN_ROW, 422, 'rowKey');
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
    // Item 14: at least one post and place (§12.1: she names at least one social deliverable).
    if (isSale(g) && !pkgRows(g.rows).length) refuse('NO_SOCIAL_ROWS', MSG.SALE_NO_ROWS, 422, 'rows');
    if (missingOf(g.rows, s).length) refuse('PACKAGE_INCOMPLETE', MSG.PACKAGE_INCOMPLETE, 422, 'rows');

    const captions = Object.fromEntries(s.captions.map((c) => [c.row_key, c.caption]));
    const pkg = { rows: pkgRows(g.rows).map((row) => ({
      key: row.key, type: row.type, count: row.count, caption: captions[row.key] || '', fileIds: draftFiles(s, row.key).map((f) => f.id),
      ...(isSale(g) ? { postId: row.postId } : {}),
    })) };
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
  if (isSale(g)) {
    sale().tell(g.r, 'brand', out.round === 1 ? NOTIFY14.SUBMITTED : NOTIFY14.RESUBMITTED, out.round === 1
      ? `${first(g.r.creator_name)} sent what she'll share on social media. Approve it before she posts.`
      : `${first(g.r.creator_name)} sent her changes. Round ${out.round} is with you.`);
    diary(g.r, 'creator', scope.userId, out.round === 1 ? 'social_submitted' : 'social_resubmitted', { round: out.round });
    return read(ciId, scope);
  }
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
  if (isSale(g)) sale().tell(g.r, 'creator', NOTIFY14.APPROVED, `${g.r.brand_name} approved what you'll share. Post it now and add the links.`);
  else notifyCreator(g.r, NOTIFY12.APPROVED, `${g.r.brand_name} approved your content. Post it now — this is the version they approved.`);
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
  const asked = `${g.r.brand_name} asked for changes: "${why.length > 120 ? `${why.slice(0, 117)}…` : why}"`;
  if (isSale(g)) sale().tell(g.r, 'creator', NOTIFY14.CHANGES, asked);
  else notifyCreator(g.r, NOTIFY12.CHANGES, asked);
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
    // Item 14: an outside row (a post shared after the package) takes its link at any time (S17).
    if (!row.outside) {
      if (!cc.approved_at) refuse('NOT_APPROVED', MSG.NOT_APPROVED(g.r.brand_name), 422, 'status');
      if (cc.posted_at) refuse('ALREADY_POSTED', MSG.ALREADY_POSTED, 422, 'status');
    }
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
    // post-performance-v2 (P2): an outside row's link is final at save — tracked now; a replaced link
    // closes the old row and opens a new one. Package rows wait for "I've posted everything".
    if (row.outside && link) await postStats().trackOne(client, cc.id, row.key, slot, link);
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
    if (cc.posted_at && !row.outside) refuse('ALREADY_POSTED', MSG.ALREADY_POSTED, 422, 'status');
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
    if (slotsOf(pkgRows(g.rows), s).some((x) => !x.filled)) refuse('PROOF_INCOMPLETE', MSG.PROOF_INCOMPLETE, 422, 'proofs');
    const now = new Date();
    if (isSale(g) && !g.hybrid) {
      // D3: Pay for Sale confirms itself after the Admin days, stamped now and never re-read.
      // Item 15: never Hybrid — its confirmation pays money; it stamps item 12's silence date below.
      // There is no "tell INFLX about silence" on Pay for Sale — the silence ends by itself.
      const stamp = await sale().autoconfirmStamp(now);
      const { rowCount } = await client.query(
        `UPDATE collab_content SET posted_at = $2, posted_by = $3, autoconfirm_days = $4, autoconfirm_at = $5, updated_at = now()
          WHERE id = $1 AND posted_at IS NULL`, [cc.id, now, scope.userId, stamp.days, stamp.at]);
      if (rowCount !== 1) refuse('ALREADY_POSTED', MSG.ALREADY_POSTED, 422, 'status');
      // post-performance-v2 (P2): her package links are final now — tracked, in the same transaction.
      await postStats().trackRows(client, cc.id, pkgRows(g.rows), { trackedFrom: now });
      return { links: s.proofs.length, sale: stamp };
    }
    const after = startOfIndiaDay(addDays(istDayOf(now), days));
    const { rowCount } = await client.query(
      `UPDATE collab_content SET posted_at = $2, posted_by = $3, report_silence_days = $4, report_after_at = $5, updated_at = now()
        WHERE id = $1 AND posted_at IS NULL`, [cc.id, now, scope.userId, days, after]);
    if (rowCount !== 1) refuse('ALREADY_POSTED', MSG.ALREADY_POSTED, 422, 'status');
    await postStats().trackRows(client, cc.id, pkgRows(g.rows), { trackedFrom: now });
    return { links: s.proofs.length };
  });
  if (out.sale) {
    sale().tell(g.r, 'brand', NOTIFY14.POSTED,
      `${first(g.r.creator_name)} has posted. Open the links and confirm it's live. If you don't answer, it confirms itself on ${shortDay(out.sale.at)}.`);
    diary(g.r, 'creator', scope.userId, 'posted', { proofs: out.links, autoconfirm_at: out.sale.at });
    return read(ciId, scope);
  }
  if (g.hybrid) sale().tell(g.r, 'brand', NOTIFY14.POSTED, `${first(g.r.creator_name)} has posted. Open the links and confirm it's live — that pays her second instalment.`);
  else notifyBrand(g.r, NOTIFY12.POSTED, `${first(g.r.creator_name)} posted everything. Open the links and confirm the content is live.`);
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
    if (isSale(g) && !g.hybrid) {
      // Item 14: NO MONEY on Pay for Sale (§21). Confirmed once for the collaboration (D2), then
      // Completed if Path 1's minimum is already met — otherwise when it is (§19, S19).
      const { rowCount } = await client.query(
        `UPDATE collab_content SET live_confirmed_at = $2, live_confirmed_by = $3, updated_at = now()
          WHERE id = $1 AND live_confirmed_at IS NULL AND posted_at IS NOT NULL AND brand_reported_at IS NULL`,
        [cc.id, at, scope.userId]);
      if (rowCount !== 1) refuse('ALREADY_CONFIRMED', MSG.ALREADY_CONFIRMED, 422, 'status');
      const done = await sale().completeIfDue(client, ciId);
      return { sale: true, completed: !!(done && done.completed) };
    }
    const { rows: esc } = await client.query(
      `SELECT tranche_number, amount, status FROM escrow_entries WHERE campaign_influencer_id = $1 AND tranche_number IN (2, 3)`, [ciId]);
    const t2 = esc.find((e) => e.tranche_number === 2);
    const t3 = esc.find((e) => e.tranche_number === 3);
    // Item 17: INFLX can settle a dispute by hand — release the second 25% itself, or return what
    // is locked to the brand. After either, there is nothing for this confirmation to pay, and
    // contentMoney.releaseSecond would throw. Say so plainly instead.
    if (t2 && t3 && (t2.status !== 'locked' || t3.status !== 'locked')) {
      refuse('SETTLED_BY_INFLX', 'INFLX has already settled this payment, and will settle the rest of this collaboration. If something looks wrong, tell INFLX.', 422, 'status');
    }
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
  if (out.sale) {
    sale().tell(g.r, 'creator', NOTIFY14.LIVE_CONFIRMED, out.completed
      ? `${g.r.brand_name} confirmed it's live. Your collaboration is complete, and your posts keep selling.`
      : `${g.r.brand_name} confirmed it's live. It completes when INFLX has approved your minimum number of shoppable posts.`);
    if (out.completed) sale().tell(g.r, 'brand', NOTIFY14.COMPLETED, `Your collaboration with ${first(g.r.creator_name)} is complete. Her posts keep selling.`);
    diary(g.r, 'brand', scope.userId, 'confirmed_live', { completed: out.completed });
    return read(ciId, scope);
  }
  if (g.hybrid) {
    // Item 15: the second 25% of her fixed amount is in; the final 50% has its date.
    sale().tell(g.r, 'creator', NOTIFY14.LIVE_CONFIRMED,
      `${g.r.brand_name} confirmed it's live. ${rupees(out.secondAmount)} is in your wallet. The last ${rupees(out.finalAmount)} arrives on ${shortDay(out.dueAt)}.`);
    diary(g.r, 'brand', scope.userId, 'confirmed_live', { second: out.secondAmount, final_due_at: out.dueAt });
    return read(ciId, scope);
  }
  // Item 21 (D3): the last payment also waits for the agreed shoppable posts, when she is short.
  const postsLine = g.posts && !g.posts.met ? ` — once INFLX has approved ${g.posts.short} more shoppable post${g.posts.short === 1 ? '' : 's'}` : '';
  notifyCreator(g.r, NOTIFY12.LIVE_CONFIRMED,
    `${g.r.brand_name} confirmed your content is live. ${rupees(out.secondAmount)} is in your wallet. The last ${rupees(out.finalAmount)} arrives on ${shortDay(out.dueAt)}${postsLine}.`);
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
  // Item 21: the brand may report "she hasn't made her shoppable posts" while Path 2 is still locked.
  const g = await contentGate.assertContentOpen(ciId, scope, db, { allowLocked: scope.side === 'brand' });
  const text = note == null ? null : String(note).trim() || null;
  if (text && text.length > 500) refuse('REASON_TOO_LONG', MSG.REASON_TOO_LONG, 422, 'note');
  const out = await db.withTransaction(async (client) => {
    const cc = await content.ensureContent(client, g);
    const s = await snapshot(client, ciId, cc);
    const stage = content.stageOf(cc, s.rounds);
    if (isSale(g) && !g.hybrid && scope.side !== 'brand') refuse('REPORT_NOT_OPEN', MSG.REPORT_NOT_OPEN, 422, 'kind');
    if (scope.side === 'brand') {
      if (cc.brand_reported_at) refuse('ALREADY_REPORTED', MSG.ALREADY_REPORTED, 422, 'status');
      const roundsUsed = kind === 'rounds_used' && stage === 'in_review' && cc.rounds_allowed != null && cc.current_round > cc.rounds_allowed;
      const postingPassed = !!(g.r.go_live_date && todayInIndia() > calendarDay(g.r.go_live_date));
      // Item 14 (S23): three reasons once she has posted; "she hasn't posted" also once she was
      // approved and the posting date has passed. Pay for Content keeps its two, unchanged.
      // Item 21 (R7): on Pay for Content with shoppable posts, "she hasn't made her posts" once the
      // posting date has passed and she is short — at any stage before Completed.
      const postsNotMade = !isSale(g) && kind === 'posts_not_made' && !!g.posts && !g.posts.met && postingPassed && stage !== 'complete';
      const ok = isSale(g)
        ? roundsUsed || (['posted_wrong', 'missing', 'not_posted'].includes(kind) && stage === 'posted')
          || (kind === 'not_posted' && stage === 'approved' && postingPassed)
        : roundsUsed || (kind === 'posted_wrong' && stage === 'posted') || postsNotMade;
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
  if (out.side === 'brand' && isSale(g)) {
    // S23/S24: the step stops; her shop posts do not (§13 — the two are separate).
    const body = `${g.r.brand_name} reported this to INFLX. INFLX will contact you. Your shop posts keep selling.`;
    sale().tell(g.r, 'creator', NOTIFY14.REPORTED, body);
    sale().tell(g.r, 'brand', NOTIFY14.REPORTED, 'You told INFLX. Nothing moves here until INFLX settles it. Her posts stay in the shop.');
  } else if (out.side === 'brand') {
    const body = MSG.REPORTED_BY_BRAND(g.r.brand_name);
    notifyCreator(g.r, NOTIFY12.REPORTED, body);
    notifyBrand(g.r, NOTIFY12.REPORTED, body);
  } else if (g.hybrid) {
    sale().tell(g.r, 'brand', NOTIFY14.REPORTED, `${first(g.r.creator_name)} told INFLX you haven't confirmed it's live yet. You can still confirm it.`);
  } else {
    notifyBrand(g.r, NOTIFY12.REPORTED, MSG.REPORTED_BY_CREATOR(first(g.r.creator_name)));
  }
  diary(g.r, out.side, scope.userId, 'reported', { kind: out.kind, note: text });
  return read(ciId, scope);
}

module.exports = {
  read, shape, snapshot, caption, submit, approve, askChanges, setProof, clearProof, markPosted, confirmLive, report,
  openMove, delayedStageFor, stageWithPosts, validLink, missingOf, slotsOf, draftFiles, DELAYED_STAGE_LABEL,
  CONTENT_MOVE_SQL, SOCIAL_STATE_OF_MOVE,
};
