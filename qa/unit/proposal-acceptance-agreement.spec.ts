import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: W13, W14 — accepting a pitch produces an agreement, not a campaign.
 * Contract: features/collab-part2-precampaign-handshake.
 *
 * THE BEHAVIOUR REMOVED. proposal.controller's acceptedFlow used to INSERT a campaign, a
 * set, a campaign_influencer and a contract draft, because there was nowhere else to put
 * the result of an acceptance. Consequences, all real:
 *
 *   · the campaign was created with only (brand_id, name, status, created_at) — which is
 *     why one-person DATELESS campaigns exist in production today
 *   · the agreed creator never entered a real campaign; they got a stub carrying none of
 *     the campaign's offer, coupon prefix, product allocation or brief
 *   · a contract was drafted against a campaign that did not meaningfully exist
 *   · the founder's sequence — agree first, then build properly — was exactly what the
 *     code skipped
 *
 * These tests read the controller source, because the point is the ABSENCE of four
 * INSERTs. A behavioural test can show an agreement appearing; only this shows that
 * nothing else does. It is the single most likely thing to be quietly restored later by
 * someone "fixing" a missing campaign.
 */

process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const H = require('../../backend/src/services/handshake.service');

const src: string = fs.readFileSync(
  path.join(__dirname, '../../backend/src/controllers/proposal.controller.js'), 'utf8');

test.describe('WORKFLOW: the campaign fabricator is gone (W14)', () => {
  test('P1 — acceptance no longer inserts a campaign, set, assignment or contract', () => {
    expect(src).not.toContain('INSERT INTO campaigns');
    expect(src).not.toContain('INSERT INTO campaign_sets');
    expect(src).not.toContain('INSERT INTO campaign_influencers');
    expect(src).not.toContain('contractService.autoCreate');
  });

  test('P2 — the contract service is not even imported any more', () => {
    // A dangling import of the thing we deliberately stopped calling would be
    // misleading to the next reader.
    expect(src).not.toContain("require('../services/contract.service')");
  });

  test('P3 — it creates an agreement instead', () => {
    expect(src).toContain('handshake.acceptIntoAgreement');
    expect(src).toContain("source: 'proposal'");
  });

  test('P4 — the stub campaign name is gone with it', () => {
    // "Proposal: <title>" is how the fabricated campaigns are identifiable in prod.
    expect(src).not.toContain('`Proposal: ${proposal.pitch_title}`');
  });
});

test.describe('WORKFLOW: nothing points at a campaign that does not exist', () => {
  test('P5 — resulting_campaign_influencer_id is not reported at acceptance', () => {
    // It stays null until the agreement is briefed. Returning an id here would point the
    // app at a campaign that is not there — precisely what the old stub was.
    expect(src).toContain('resulting_campaign_influencer_id: null');
  });

  test('P6 — the creator notification no longer deep-links to campaign_detail', () => {
    // The old copy also promised "the contract is being prepared", which was untrue the
    // moment contract creation moved to the campaign stage.
    expect(src).not.toContain("{ screen: 'campaign_detail', campaign_influencer_id: ci.id }");
    expect(src).not.toContain('The contract is being prepared');
    expect(src).toContain("screen: 'agreement_detail'");
  });
});

test.describe('WORKFLOW: the pitch bridges into the shared terms model (W13)', () => {
  test('P7 — a conversion pitch maps to commission and a post-by date', () => {
    // A pitch only carries a window, so the window END becomes the post-by: that is the
    // date the creator committed to having posted by. Conversion has no duration.
    const terms = H.termsFromProposal({
      goal: 'conversion', proposed_commission_pct: 12,
      proposed_posting_window_start: '2026-09-01', proposed_posting_window_end: '2026-09-20',
    });
    expect(terms.aim).toBe('conversion');
    expect(terms.money).toEqual({ commission_pct: 12 });
    expect(terms.time).toEqual({ post_by: '2026-09-20' });
    expect(H.validateProposalTerms({
      goal: 'conversion', proposed_commission_pct: 12, proposed_posting_window_end: '2026-09-20',
    })).toEqual({ ok: true });
  });

  test('P8 — an engagement pitch maps to a fee and a window', () => {
    const terms = H.termsFromProposal({
      goal: 'engagement', proposed_fee: 25000,
      proposed_posting_window_start: '2026-09-10', proposed_posting_window_end: '2026-09-24',
    });
    expect(terms.money).toEqual({ fee: 25000 });
    expect(terms.time).toEqual({ window_start: '2026-09-10', window_end: '2026-09-24' });
  });

  test('P9 — the pitch goal needs no translation', () => {
    // The reason the terms model was aligned to the campaign_goal enum rather than
    // inventing 'sales' | 'content' | 'both': the pitch column already IS that enum, so
    // this boundary is a pass-through instead of a mapping that could drift.
    for (const goal of ['conversion', 'engagement', 'hybrid']) {
      expect(H.termsFromProposal({ goal }).aim).toBe(goal);
    }
  });

  test('P10 — what the creator ASKS for is a preference, not an ultimatum', () => {
    // A creator naming products or deliverables is stating intent. Marking it a
    // requirement would make their own pitch un-counterable by the brand.
    const terms = H.termsFromProposal({
      goal: 'conversion', proposed_commission_pct: 10, proposed_posting_window_end: '2026-09-20',
      scope_level: 'category', scope_ref_json: { category: 'Ethnic' },
      proposed_deliverables: [{ type: 'reel', count: 2 }],
    });
    expect(terms.importance.scope).toBe('preference');
    expect(terms.importance.deliverables).toBe('preference');
  });

  test('P11 — an incomplete pitch cannot become an agreement', () => {
    // Money and time are primary on BOTH sides. The pitch form currently allows them to
    // be blank, so this is the guard that stops a half-filled pitch being "accepted"
    // into an agreement that says nothing.
    const r = H.validateProposalTerms({ goal: 'conversion' });
    expect(r.ok).toBe(false);
    expect(r.field).toContain('money');
  });
});
