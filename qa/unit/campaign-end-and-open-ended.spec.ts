import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Part 5 §2–§4 — the explicit End, and the open-ended state being real everywhere.
 * Contract: features/collab-part5-sales-aim-separation
 *
 * Source-level assertions where a live DB is not available in this lane. Each one pins an
 * invariant that, if lost, breaks something the founder was promised — not the location of
 * code, which moves.
 */

const ROOT = path.resolve(__dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/**
 * Strip comments before asserting a string is ABSENT from code.
 *
 * Without this, a comment explaining why a label was removed makes the removal look
 * incomplete — and worse, deleting that explanation would be what makes the test pass.
 * These assertions are about code, not about the prose around it.
 */
const BLOCK_COMMENT = new RegExp('/\\*[\\s\\S]*?\\*/', 'g');   // also covers JSX {/* … */}
const LINE_COMMENT = new RegExp('^[ \\t]*//.*$', 'gm');
const codeOnly = (src: string) => src.replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '');

const controller = read('backend/src/controllers/campaign.controller.js');
const routes = read('backend/src/routes/campaign.routes.js');
const wizard = read('Packages/brand-web/app/dashboard/campaigns/new/page.js');
const detail = read('Packages/brand-web/app/dashboard/campaigns/[id]/page.js');
const sectionRules = read('backend/src/services/sectionRules.service.js');

/* ── The route and its guards ─────────────────────────────────────────────── */

test('B9 — POST /campaigns/:id/end exists and is brand-authenticated', () => {
  expect(routes).toMatch(/router\.post\('\/:id\/end',\s*\.\.\.brandAuth,\s*ctrl\.endCampaign\)/);
});

test('B9 — end completes the campaign; it does NOT reuse cancel', () => {
  const body = controller.slice(controller.indexOf('const endCampaign = asyncHandler'));
  const handler = body.slice(0, body.indexOf('\r\n// ───'));
  expect(handler).toContain("status = 'completed'");
  expect(handler).toContain('completed_at = NOW()');
  // The whole point: a deliberate finish must never be filed as an abort.
  expect(handler).not.toContain("'cancelled'");
  // And it must not touch the brand's wallet — nothing is refunded by ending.
  expect(handler).not.toContain('wallet_balance');
});

test('B10 — the response reports the row that was actually written', () => {
  const body = controller.slice(controller.indexOf('const endCampaign = asyncHandler'));
  const handler = body.slice(0, body.indexOf('\r\n// ───'));
  // Read-back after the UPDATE, rather than echoing the status we intended.
  expect(handler).toMatch(/SELECT id, status, completed_at FROM campaigns WHERE id = \$1/);
  expect(handler).toContain('after[0].status');
});

test('B11 — money still owed blocks the end, and the guard uses real escrow statuses', () => {
  expect(controller).toContain('ESCROW_OWED_STATUSES');
  // Verified against the prod enum: locked, queued, processing, released, disputed,
  // refunded. Anything not paid-out and not returned is still in flight.
  expect(controller).toMatch(/ESCROW_OWED_STATUSES = \['locked', 'queued', 'processing', 'disputed'\]/);
  // 'released' is paid and 'refunded' has gone back — neither may block.
  const decl = controller.slice(controller.indexOf('ESCROW_OWED_STATUSES ='));
  const line = decl.slice(0, decl.indexOf('\n'));
  expect(line).not.toContain('released');
  expect(line).not.toContain('refunded');
});

test('B12 — work awaiting the brand blocks the end', () => {
  expect(controller).toMatch(/DELIVERABLE_AWAITING_BRAND = \['submitted', 'under_review'\]/);
});

test('B11/B12 — both refusals throw BEFORE the campaign is updated', () => {
  const body = controller.slice(controller.indexOf('const endCampaign = asyncHandler'));
  const handler = body.slice(0, body.indexOf('\r\n// ───'));
  const escrowThrow = handler.indexOf('escrow_pending');
  const deliverableThrow = handler.indexOf('deliverables_awaiting_review');
  const update = handler.indexOf("UPDATE campaigns SET status = 'completed'");
  expect(escrowThrow).toBeGreaterThan(-1);
  expect(deliverableThrow).toBeGreaterThan(-1);
  // Ordering is the guarantee: a refusal cannot leave a half-ended campaign.
  expect(escrowThrow).toBeLessThan(update);
  expect(deliverableThrow).toBeLessThan(update);
});

test('B13 — only live campaigns can be ended, and a draft is told to delete instead', () => {
  const body = controller.slice(controller.indexOf('const endCampaign = asyncHandler'));
  const handler = body.slice(0, body.indexOf('\r\n// ───'));
  expect(handler).toMatch(/ENDABLE = \['published', 'active', 'live'\]/);
  expect(handler).toContain('still a draft');
});

test('B16 — creators are notified, and only real participants', () => {
  const body = controller.slice(controller.indexOf('const endCampaign = asyncHandler'));
  const handler = body.slice(0, body.indexOf('\r\n// ───'));
  expect(handler).toContain("ci.status IN ('contracted','active','completed')");
  expect(handler).toContain("type:     'campaign.ended'");
  expect(handler).toContain('creators_notified');
});

/* ── The open-ended state stays visible ───────────────────────────────────── */

test('D2 — LIVE_COLLAB_WHERE still tolerates a NULL end date (the invariant)', () => {
  // This is the clause that makes open-ended selling work. If an edit ever drops it, every
  // open-ended campaign vanishes from the follower app — the dead-offer-join failure shape.
  expect(sectionRules).toContain('(c.end_date IS NULL OR c.end_date >= CURRENT_DATE)');
  const chain = sectionRules.slice(
    sectionRules.indexOf('const LIVE_COLLAB_WHERE'),
    sectionRules.indexOf('function liveOfferExists')
  );
  expect(chain).toContain('c.end_date IS NULL');
});

test('D4 — completing a campaign removes it from discovery (the documented consequence)', () => {
  const chain = sectionRules.slice(
    sectionRules.indexOf('const LIVE_COLLAB_WHERE'),
    sectionRules.indexOf('function liveOfferExists')
  );
  // Ending sets status='completed', which is deliberately NOT in this list. Asserted so the
  // consequence stated in the End confirmation stays true.
  expect(chain).toContain("c.status  IN ('published','active','live')");
  const campaignStatusClause = chain.match(new RegExp('c\\.status\\s+IN \\([^)]*\\)'))![0];
  expect(campaignStatusClause).not.toContain('completed');
  // ci.status DOES include 'completed' — a creator who finished their post keeps selling.
  expect(chain).toContain("ci.status IN ('contracted','active','completed')");
});

test('B19 — the cron still cannot auto-complete an open-ended campaign', () => {
  const job = read('backend/src/jobs/campaign-status.job.js');
  // A NULL end_date never satisfies this, which is why the explicit End had to exist.
  expect(job).toContain('c.end_date < CURRENT_DATE');
});

test('B20 — tranche 3 is timed from triggered_at, never from the campaign end date', () => {
  // This is what makes an undated paid campaign safe: payments do not depend on campaign
  // dates, so a mixed campaign staying open-ended cannot delay anyone's money.
  const job = read('backend/src/jobs/tranche-3-release.job.js');
  expect(job).toContain('ee.triggered_at');
  expect(job).not.toContain('end_date');
});

/* ── The two questions are gone from the wizard ───────────────────────────── */

test('P1/P2 — neither an end-date nor a campaign-total input remains in the wizard', () => {
  expect(codeOnly(wizard)).not.toContain('Total campaign budget');
  expect(codeOnly(wizard)).not.toMatch(/flbl">End date</);
  // The state that backed them is gone too, so nothing can drift from the derived truth.
  expect(wizard).not.toMatch(/const \[totalBudget, setTotalBudget\]/);
  expect(wizard).not.toMatch(/const \[endDate, setEndDate\]/);
});

test('P4b — the two dissolved error classes are unreachable', () => {
  const code = codeOnly(wizard);
  expect(code).not.toContain('exceed campaign budget');
  expect(code).not.toContain('Cannot be after campaign end');
  expect(code).not.toContain('Budget exceeded');
});

test('the wizard stops sending values the server derives', () => {
  const createCall = wizard.slice(wizard.indexOf('campaignApi.create({'));
  const oneLine = createCall.slice(0, createCall.indexOf('\n'));
  expect(oneLine).not.toContain('end_date');
  expect(oneLine).not.toContain('total_budget');
});

test('P5 — the wizard review says Ongoing when there is no derived end date', () => {
  expect(wizard).toContain("'Ongoing'");
  expect(wizard).toContain('endLabel()');
});

test('the wizard mirrors the server rule, including sales-keeps-it-open', () => {
  // Two implementations of one rule is a drift risk; the server is authoritative and
  // recomputes on every set write, but the wizard preview must not contradict it.
  const derived = wizard.slice(wizard.indexOf('const derivedEndDate'), wizard.indexOf('const endLabel'));
  expect(derived).toContain('hasSalesSet()');
  expect(derived).toContain('needsBudget(s.goal)');
});

/* ── Ongoing + End on the other surfaces ──────────────────────────────────── */

test('P7/P9 — campaign detail shows Ongoing and offers End only when live', () => {
  expect(detail).toContain("campaign.end_date ? formatDate(campaign.end_date) : 'Ongoing'");
  expect(detail).toMatch(/canEnd = \['published', 'active', 'live'\]\.includes\(campaign\.status\)/);
  expect(detail).toContain('campaignApi.end(id)');
});

test('P9 — the confirmation states the consequence the brand needs to know', () => {
  expect(detail).toContain('leave the shopping app');
  expect(detail).toContain('stop earning');
  expect(detail).toContain('Completed, not cancelled');
});

test('P8 — list and dashboard both say Ongoing', () => {
  expect(read('Packages/brand-web/app/dashboard/campaigns/page.js')).toContain("'Ongoing'");
  expect(read('Packages/brand-web/app/dashboard/page.js')).toContain('Ongoing');
});

test('M1/M2/M3 — mobile shows Ongoing on both sides and can End', () => {
  const brandDetail = read('Packages/Mobile/src/screens/brand/BrandCampaignDetailScreen.js');
  const collabDetail = read('Packages/Mobile/src/screens/influencer/CollabDetailScreen.js');
  expect(brandDetail).toContain("campaign.end_date ? formatDate(campaign.end_date) : 'Ongoing'");
  expect(brandDetail).toContain('brandApi.endCampaign');
  expect(brandDetail).toContain('END CAMPAIGN');
  // The creator's screen matters most: Ongoing is what tells them their links still work.
  expect(collabDetail).toContain("c.end_date ? fmtDate(c.end_date) : 'Ongoing'");
  expect(read('Packages/Mobile/src/services/api.js')).toContain('endCampaign:');
  // The notification has somewhere to land.
  expect(read('Packages/Mobile/src/screens/influencer/NotificationsScreen.js')).toContain("case 'campaign.ended'");
});

/* ── Truthfulness ─────────────────────────────────────────────────────────── */

test('T1 — the visit-window fallback stops claiming a campaign always has an end date', () => {
  const prod = read('backend/src/services/production.service.js');
  expect(prod).not.toContain('Should never happen — campaign always has an end_date');
  expect(prod).toContain('open-ended');
});

test('B1 — creating a campaign no longer demands an end date', () => {
  const create = controller.slice(
    controller.indexOf('const create = asyncHandler'),
    controller.indexOf('const list = asyncHandler')
  );
  expect(create).not.toContain("'end_date is required'");
  // start_date is still required — only the end date became derived.
  expect(create).toContain("'start_date is required'");
  // B2: the ordering check survives for anyone who still sends a date.
  expect(create).toContain('end_date must be after start_date');
});

test('the derivation runs on every set mutation, not just creation', () => {
  // If a brand switches a set from paid to sales, or deletes the last sales set, the
  // campaign's dates and total must follow. Three write paths, three recomputes.
  expect((controller.match(/campaignRollup\.recompute/g) || []).length).toBe(3);
});

test('campaign PATCH no longer accepts the derived fields', () => {
  const update = controller.slice(
    controller.indexOf('const update = asyncHandler'),
    controller.indexOf('const createSet = asyncHandler')
  );
  expect(update).toMatch(/allowed = \['name', 'start_date', 'brief', 'allow_negotiation'\]/);
  // Deliberately NOT recomputing here: renaming a live campaign must never silently
  // change when it ends. Existing rows keep their stored dates until a set is touched.
  expect(codeOnly(update)).not.toContain('recompute');
});
