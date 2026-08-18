import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: the three corrections that symmetric negotiation arms.
 * Contract: features/collab-phase0-foundations — checks T19, T20, T21.
 *
 * WHY THESE EXIST
 * Until Phase 0 a creator could not counter back on her own pitch: the brand countered,
 * and her only replies were accept or decline. Three behaviours were correct ONLY
 * because of that limitation, and each becomes a live defect the moment she can counter:
 *
 *   T19  Brand acceptance was hard-wired to the creator's ORIGINAL terms
 *        (`acceptedFlow(proposal, /* useCounterTerms *​/ false)`) and refused any pitch
 *        in status 'countered'. Give her a counter-back and the brand hits a dead end —
 *        it cannot accept her ₹14,000 at all.
 *   T20  The brand's counter was UNBOUNDED. brand→creator has always been capped at
 *        handshake_settings.counter_rounds_per_side; the pitch direction had no cap, so
 *        a brand could counter forever and grind a creator down.
 *   T21  respondToCounter guarded on `status === 'countered'` alone. Once she can
 *        counter, that is also true when SHE countered — so she could accept the terms
 *        she herself just proposed and produce an agreement the brand never consented to.
 *
 * These read the source, deliberately. Each correction is the ABSENCE of a wrong branch
 * or the PRESENCE of a specific guard, and all three sit behind auth on records that do
 * not exist in production yet (influencer_proposals holds zero rows). A behavioural test
 * would need a whole fixture chain to assert a one-line guard; the source is the evidence.
 *
 * Fail-first was demonstrated by stashing the implementation and re-running: all three
 * fail against the pre-Phase-0 source and pass against it. Recorded in 06-diff/notes.md.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

const CTRL: string = fs.readFileSync(
  path.join(__dirname, '../../backend/src/controllers/proposal.controller.js'), 'utf8');
const SVC: string = fs.readFileSync(
  path.join(__dirname, '../../backend/src/services/proposal.service.js'), 'utf8');
const ROUTES: string = fs.readFileSync(
  path.join(__dirname, '../../backend/src/routes/proposal.routes.js'), 'utf8');

/** Body of a named async function, so a guard can be asserted in ITS scope, not the file's. */
function bodyOf(src: string, decl: string): string {
  const start = src.indexOf(decl);
  expect(start, `could not find "${decl}"`).toBeGreaterThan(-1);
  // Walk braces from the first '{' after the declaration.
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  throw new Error(`unbalanced braces after "${decl}"`);
}

test.describe('T19 — brand acceptance settles the LATEST terms', () => {
  test('T19a — acceptedFlow no longer takes a useCounterTerms flag from its caller', () => {
    // The bug was the caller deciding. Every acceptance in either direction is an
    // acceptance of whatever is currently on the table.
    expect(CTRL).toContain('async function acceptedFlow(proposal)');
    expect(CTRL).not.toMatch(/acceptedFlow\s*\(\s*proposal\s*,/);
  });

  test('T19b — it uses counter_terms whenever one exists', () => {
    const body = bodyOf(CTRL, 'async function acceptedFlow(proposal)');
    expect(body).toMatch(/const counterTerms = proposal\.counter_terms/);
    // The old guard read `useCounterTerms && proposal.counter_terms`.
    expect(body).not.toContain('useCounterTerms');
  });

  test('T19c — the brand can accept HER counter', () => {
    const body = bodyOf(CTRL, 'const acceptProposal = asyncHandler');
    expect(body).toContain("proposal.counter_by === 'creator'");
    expect(body).toMatch(/answeringHerCounter/);
  });

  test('T19d — but never its own counter', () => {
    const body = bodyOf(CTRL, 'const acceptProposal = asyncHandler');
    expect(body).toContain("proposal.counter_by === 'brand'");
    expect(body).toMatch(/cannot accept your own counter/i);
  });
});

test.describe('T20 — the brand\'s counters on a pitch are capped', () => {
  test('T20a — counter() reads the admin-set round limit', () => {
    const body = bodyOf(SVC, 'async function counter(proposalId, counterTerms, message)');
    expect(body).toContain('counter_rounds_per_side');
    expect(body).toMatch(/brand_rounds_used/);
  });

  test('T20b — and refuses once they are spent', () => {
    const body = bodyOf(SVC, 'async function counter(proposalId, counterTerms, message)');
    expect(body).toMatch(/used >= cfg\.counter_rounds_per_side/);
    expect(body).toMatch(/used both of your/i);
  });

  test('T20c — the limit is the shared admin setting, not a new constant', () => {
    // A second hardcoded number here is how the two directions drift apart.
    expect(SVC).toContain("require('./handshakeSettings.service')");
    const body = bodyOf(SVC, 'async function counter(proposalId, counterTerms, message)');
    expect(body).not.toMatch(/>=\s*\d+\s*\)/);
  });

  test('T20d — a successful counter records who sent it and increments that side', () => {
    const body = bodyOf(SVC, 'async function counter(proposalId, counterTerms, message)');
    expect(body).toMatch(/counter_by = 'brand'/);
    expect(body).toMatch(/brand_rounds_used = brand_rounds_used \+ 1/);
  });
});

test.describe('T21 — nobody accepts their own counter', () => {
  test('T21a — respondToCounter refuses when SHE countered', () => {
    const body = bodyOf(CTRL, 'const respondToCounter = asyncHandler');
    expect(body).toContain("proposal.counter_by === 'creator'");
    expect(body).toMatch(/cannot answer your own counter/i);
  });

  test('T21b — the status check alone is no longer the only guard', () => {
    const body = bodyOf(CTRL, 'const respondToCounter = asyncHandler');
    const statusIdx = body.indexOf("proposal.status !== 'countered'");
    const ownIdx = body.indexOf("proposal.counter_by === 'creator'");
    expect(statusIdx).toBeGreaterThan(-1);
    expect(ownIdx).toBeGreaterThan(statusIdx);   // the new guard runs after, not instead
  });
});

test.describe('T15–T18 — the creator can counter back', () => {
  test('T15a — the route exists, creator-only', () => {
    expect(ROUTES).toMatch(
      /router\.post\s*\(\s*'\/influencers\/me\/proposals\/:id\/counter'[\s\S]*?requireRole\('influencer'\)[\s\S]*?creatorCounterProposal/);
  });

  test('T15b — the service refuses unless the BRAND is the one being answered', () => {
    const body = bodyOf(SVC, 'async function creatorCounter(proposalId, counterTerms)');
    expect(body).toMatch(/counter_by !== 'brand'/);
    expect(body).toMatch(/brand..s turn/i);   // source escapes the apostrophe
  });

  test('T17 — she runs out of counters, with the real reason', () => {
    const body = bodyOf(SVC, 'async function creatorCounter(proposalId, counterTerms)');
    expect(body).toMatch(/creator_rounds_used/);
    expect(body).toMatch(/used >= cfg\.counter_rounds_per_side/);
    expect(body).toMatch(/accept or decline/i);
  });

  test('T18 — a required term is refused server-side by the shared validator', () => {
    const body = bodyOf(SVC, 'async function creatorCounter(proposalId, counterTerms)');
    // Same module the brand→creator direction uses — not a second implementation.
    expect(body).toContain('terms.validateCounter');
    expect(SVC).toContain("require('./collabTerms.model')");
  });

  test('T16 — the brand is notified that she answered', () => {
    const body = bodyOf(CTRL, 'const creatorCounterProposal = asyncHandler');
    expect(body).toContain('proposal.countered_by_creator');
  });

  test('T15c — countering writes a diary entry showing what moved', () => {
    const body = bodyOf(CTRL, 'const creatorCounterProposal = asyncHandler');
    expect(body).toContain('events.record');
    expect(body).toContain('events.diffTerms');
    expect(body).toMatch(/step: events\.STEP\.AGREE/);
  });
});
