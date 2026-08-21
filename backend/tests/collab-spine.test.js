'use strict';

/**
 * Stage 0 — the two server-side numbers, and the doorways onto them.
 * Contract: features/stage-0-clear-the-decks
 *
 * WHY THIS FILE EXISTS AT ALL
 * collabStep.service.js and collabCounts.service.js shipped in Phase 0 (commit a8cf50f)
 * with no route, no controller and NO TEST. They were correct and unreachable. This file
 * is the first thing that has ever exercised either of them.
 *
 * The rule both modules exist to protect: the same collaboration must report the same
 * step number to the brand and to the creator. Check S4 is the one that matters — it
 * reads the same assignment through both doorways and asserts the numbers agree.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser,
  createInfluencerUser,
  registerBrand,
  registerInfluencer,
} = require('./helpers/factories');

const step = require('../src/services/collabStep.service');
const counts = require('../src/services/collabCounts.service');

beforeEach(async () => {
  await truncateAll();
});

async function approve(userId) {
  await query(`UPDATE users SET status = 'approved' WHERE id = $1`, [userId]);
}

/**
 * brand → campaign → set → assigned creator, at a chosen assignment status.
 * Returns both tokens plus the ids, so one collaboration can be read through both
 * doorways and compared.
 */
async function setupCollaboration({ ciStatus = 'accepted', goal = 'conversion' } = {}) {
  const brand = await createBrandUser();
  await approve(brand.user.id);
  const brandRow = await registerBrand(brand.token);

  const creator = await createInfluencerUser();
  await approve(creator.user.id);
  const creatorRow = await registerInfluencer(creator.token);

  const { rows: [campaign] } = await query(
    `INSERT INTO campaigns (brand_id, name, status, start_date)
     VALUES ($1, 'Stage 0 practice campaign', 'active', now()) RETURNING id`,
    [brandRow.id]
  );
  const { rows: [set] } = await query(
    `INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode)
     VALUES ($1, 'Set 1', $2, 'handpick') RETURNING id`,
    [campaign.id, goal]
  );
  const { rows: [ci] } = await query(
    `INSERT INTO campaign_influencers (set_id, influencer_id, status)
     VALUES ($1, $2, $3) RETURNING id`,
    [set.id, creatorRow.id, ciStatus]
  );

  return {
    brandToken: brand.token,
    creatorToken: creator.token,
    brandId: brandRow.id,
    influencerId: creatorRow.id,
    campaignId: campaign.id,
    setId: set.id,
    ciId: ci.id,
  };
}

// ─── S1 · S8 — the brand doorway, extended not replaced ──────────────────────

describe('S1/S8 — brand summary is extended, never broken', () => {
  test('returns every original counter AND the new needs-you tree', async () => {
    const { brandToken } = await setupCollaboration();

    const res = await request(app)
      .get('/v1/brands/me/inbox-summary')
      .set('Authorization', `Bearer ${brandToken}`);

    expect(res.status).toBe(200);

    // S8 — a phone that has not updated must keep working. Every key the old build
    // reads is still present, at the same name.
    for (const key of [
      'pending_negotiations',
      'pending_reviews',
      'pending_signatures',
      'contracts_failed',
      'pdf_failed',
      'pending_applications',
    ]) {
      expect(res.body.data.summary).toHaveProperty(key);
    }

    // S1 — and the new block is there alongside it.
    expect(res.body.data.needs_you).toBeDefined();
    expect(typeof res.body.data.needs_you.total).toBe('number');
    expect(Array.isArray(res.body.data.needs_you.campaigns)).toBe(true);
  });
});

// ─── S2 — the roll-up reconciles at every level ──────────────────────────────

describe('S2 — every badge equals what is beneath it plus its own', () => {
  test('campaign total = own + sum of set totals; set total = own + sum of creators', async () => {
    const { brandId } = await setupCollaboration({ ciStatus: 'accepted' });

    const tree = await counts.forBrand(brandId);

    for (const campaign of tree.campaigns) {
      const setSum = campaign.sets.reduce((n, s) => n + s.total, 0);
      expect(campaign.total).toBe(campaign.own + setSum);

      for (const s of campaign.sets) {
        const creatorSum = s.creators.reduce((n, cr) => n + cr.own, 0);
        expect(s.total).toBe(s.own + creatorSum);
      }
    }

    // And the headline is the creators tab plus every campaign underneath it.
    const campaignSum = tree.campaigns.reduce((n, c) => n + c.total, 0);
    expect(tree.total).toBe(tree.creators_tab + campaignSum);
  });
});

// ─── S3 — the creator doorway ────────────────────────────────────────────────

describe('S3 — the creator can ask what needs her', () => {
  test('returns a total, the itemised counts, and her collaborations with steps', async () => {
    const { creatorToken } = await setupCollaboration();

    const res = await request(app)
      .get('/v1/influencers/me/needs-you')
      .set('Authorization', `Bearer ${creatorToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.total).toBe('number');
    expect(res.body.data.items).toHaveProperty('invitations');
    expect(res.body.data.items).toHaveProperty('contracts_to_sign');
    expect(Array.isArray(res.body.data.collaborations)).toBe(true);
    expect(res.body.data.collaborations.length).toBe(1);

    const collab = res.body.data.collaborations[0];
    expect(collab.step).toBeGreaterThanOrEqual(1);
    expect(collab.step).toBeLessThanOrEqual(6);
    expect(collab.step_label).toBeTruthy();
    expect(collab.brand_name).toBeTruthy();
  });
});

// ─── S4 — THE point of the whole stage ───────────────────────────────────────

describe('S4 — one collaboration, one step number, both sides', () => {
  test('the brand and the creator are told the identical step', async () => {
    const { brandId, influencerId, ciId } = await setupCollaboration({ ciStatus: 'accepted' });

    const brandTree = await counts.forBrand(brandId);
    const creatorList = await counts.stepsForCreator(influencerId);

    // Find the same assignment through each side's own doorway.
    const brandSide = brandTree.campaigns
      .flatMap(c => c.sets)
      .flatMap(s => s.creators)
      .find(cr => cr.campaign_influencer_id === ciId);
    const creatorSide = creatorList.find(c => c.campaign_influencer_id === ciId);

    expect(brandSide).toBeDefined();
    expect(creatorSide).toBeDefined();

    // If this ever fails, the brand's phone and the creator's phone are about to
    // disagree about the same collaboration — the exact failure Phase 0 existed to
    // prevent, and which went unguarded because neither module had a test.
    expect(creatorSide.step).toBe(brandSide.step);
    expect(creatorSide.turn).toBe(brandSide.turn);
  });

  test('they still agree once the shoot is done', async () => {
    const { brandId, influencerId, ciId } = await setupCollaboration({ ciStatus: 'active' });

    const { rows: [contract] } = await query(
      `INSERT INTO contracts (campaign_influencer_id, status)
       VALUES ($1, 'active') RETURNING id`,
      [ciId]
    );
    await query(
      `INSERT INTO production_events (contract_id, mode, status, visit_completed_at)
       VALUES ($1, 'visit', 'completed', now())`,
      [contract.id]
    );

    const brandSide = (await counts.forBrand(brandId)).campaigns
      .flatMap(c => c.sets).flatMap(s => s.creators)
      .find(cr => cr.campaign_influencer_id === ciId);
    const creatorSide = (await counts.stepsForCreator(influencerId))
      .find(c => c.campaign_influencer_id === ciId);

    expect(creatorSide.step).toBe(brandSide.step);
    // Shoot complete means the collaboration has moved past step 3.
    expect(creatorSide.step).toBeGreaterThan(step.STEP.SHOOT);
  });
});

// ─── S5 — the step rules themselves ──────────────────────────────────────────

describe('S5 — the step calculation', () => {
  test('signed with the shoot unfinished sits at step 3', () => {
    const d = step.stepForCollaboration(
      { status: 'active' },
      { track: 'sales', contractSignedByBoth: true, shootDone: false, socialState: 'none' }
    );
    expect(d.step).toBe(step.STEP.SHOOT);
  });

  test('shoot done moves it past step 3', () => {
    const d = step.stepForCollaboration(
      { status: 'active' },
      { track: 'sales', contractSignedByBoth: true, shootDone: true, socialState: 'none' }
    );
    expect(d.step).toBeGreaterThan(step.STEP.SHOOT);
  });

  test('completed is step 6 and closed', () => {
    const d = step.stepForCollaboration({ status: 'completed' }, { track: 'sales' });
    expect(d.step).toBe(step.STEP.COMPLETE);
    expect(d.closed).toBe(true);
  });

  test('declined is closed and owes nobody anything', () => {
    const d = step.stepForCollaboration({ status: 'declined' }, { track: 'sales' });
    expect(d.closed).toBe(true);
    expect(step.owes(d, step.TURN.YOU_BRAND)).toBe(0);
    expect(step.owes(d, step.TURN.YOU_CREATOR)).toBe(0);
  });
});

// ─── S6 — whose turn it is ───────────────────────────────────────────────────

describe('S6 — a node counts only for the side whose turn it is', () => {
  test('owes() answers for one side at a time', () => {
    const brandTurn = { step: 3, turn: step.TURN.YOU_BRAND };
    expect(step.owes(brandTurn, step.TURN.YOU_BRAND)).toBe(1);
    expect(step.owes(brandTurn, step.TURN.YOU_CREATOR)).toBe(0);

    const creatorTurn = { step: 3, turn: step.TURN.YOU_CREATOR };
    expect(step.owes(creatorTurn, step.TURN.YOU_CREATOR)).toBe(1);
    expect(step.owes(creatorTurn, step.TURN.YOU_BRAND)).toBe(0);

    const nobody = { step: 4, turn: step.TURN.NOBODY };
    expect(step.owes(nobody, step.TURN.YOU_BRAND)).toBe(0);
    expect(step.owes(nobody, step.TURN.YOU_CREATOR)).toBe(0);
  });

  test('rollUp is own plus the children, never just the children', () => {
    expect(step.rollUp({ own: 1, children: [{ own: 2 }, { own: 0 }] })).toBe(3);
    expect(step.rollUp({ own: 0, children: [] })).toBe(0);
  });
});

// ─── S7 — the doorways are locked to the right role ──────────────────────────

describe('S7 — each doorway rejects the other role', () => {
  test('a creator cannot read the brand summary', async () => {
    const { creatorToken } = await setupCollaboration();
    const res = await request(app)
      .get('/v1/brands/me/inbox-summary')
      .set('Authorization', `Bearer ${creatorToken}`);
    expect(res.status).toBe(403);
  });

  test('a brand cannot read the creator needs-you', async () => {
    const { brandToken } = await setupCollaboration();
    const res = await request(app)
      .get('/v1/influencers/me/needs-you')
      .set('Authorization', `Bearer ${brandToken}`);
    expect(res.status).toBe(403);
  });

  test('neither doorway is open without a token', async () => {
    expect((await request(app).get('/v1/influencers/me/needs-you')).status).toBe(401);
    expect((await request(app).get('/v1/brands/me/inbox-summary')).status).toBe(401);
  });
});
