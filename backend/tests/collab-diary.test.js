'use strict';

/**
 * Stage 1 — "what happened here", readable at last.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * The founder's test case: ask 15%, she counters 22%, settle at 18% — and every one of
 * those three offers is still visible to BOTH sides afterwards. Today only the 18%
 * survives on the record itself; the rest has been written to the diary since migration
 * 152 and nothing could ever read it back.
 *
 * The other half these tests hold in place is access. A conversation is readable by the
 * brand that sent it and the creator it went to, and by nobody else — answered as a 404
 * rather than a 403, so a stranger cannot use the response to learn it exists.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const {
  createBrandUser, createInfluencerUser, registerBrand, registerInfluencer,
} = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

async function approvedBrand(name) {
  const { token, user } = await createBrandUser();
  const brand = await registerBrand(token, { business_name: name || 'Kanchi Silks' });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  return { token, brandId: brand.id };
}

async function approvedCreator(handle) {
  const { token, user } = await createInfluencerUser();
  const inf = await registerInfluencer(token, { instagram_handle: handle, name: 'Asha M.' });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  return { token, influencerId: inf.id };
}

const TERMS = { aim: 'conversion', money: { commission_pct: 15 }, time: { post_by: '2026-08-24' } };

/** Ask, counter, counter back, accept — the founder's exact example. */
async function walkANegotiation(brandToken, creatorToken, influencerId) {
  const sent = await request(app)
    .post('/v1/brands/me/collab-requests')
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ influencer_id: influencerId, terms: TERMS, message: 'Work with us?' });
  expect(sent.status).toBe(201);
  const reqId = sent.body.data.requests[0].id;

  // She reads it, then counters 15% -> 22%.
  await request(app).get('/v1/influencers/me/collab-requests')
    .set('Authorization', `Bearer ${creatorToken}`);
  const counter = await request(app)
    .post(`/v1/influencers/me/collab-requests/${reqId}/counter`)
    .set('Authorization', `Bearer ${creatorToken}`)
    .send({ terms: { money: { commission_pct: 22 } } });
  expect(counter.status).toBe(200);

  // The brand counters back to 18%.
  await request(app)
    .post(`/v1/brands/me/collab-requests/${reqId}/counter`)
    .set('Authorization', `Bearer ${brandToken}`)
    .send({ terms: { money: { commission_pct: 18 } } });

  // She accepts.
  await request(app)
    .post(`/v1/influencers/me/collab-requests/${reqId}/accept`)
    .set('Authorization', `Bearer ${creatorToken}`);

  return reqId;
}

describe('every offer that was ever on the table', () => {
  test('all three offers survive — 15, 22 and 18', async () => {
    const { token: bt } = await approvedBrand();
    const { token: ct, influencerId } = await approvedCreator('asha_diary');
    const reqId = await walkANegotiation(bt, ct, influencerId);

    const res = await request(app)
      .get(`/v1/collab-diary/request/${reqId}`)
      .set('Authorization', `Bearer ${ct}`);

    expect(res.status).toBe(200);
    const entries = res.body.data.entries;

    // Asked, opened, countered, countered back, accepted — the shape of the story.
    expect(entries.length).toBeGreaterThanOrEqual(4);
    expect(entries.map(e => e.action)).toEqual(
      expect.arrayContaining(['asked', 'countered', 'accepted'])
    );

    // The movement itself, not merely that something moved.
    const moves = JSON.stringify(entries.map(e => e.changed));
    expect(moves).toContain('22');
    expect(moves).toContain('18');

    // And the opening 15% is still readable, which is what vanishes today.
    expect(JSON.stringify(entries.map(e => e.terms))).toContain('15');
  });

  test('it reads oldest first, so it reads as a story', async () => {
    const { token: bt } = await approvedBrand();
    const { token: ct, influencerId } = await approvedCreator('asha_order');
    const reqId = await walkANegotiation(bt, ct, influencerId);

    const res = await request(app)
      .get(`/v1/collab-diary/request/${reqId}`)
      .set('Authorization', `Bearer ${ct}`);

    const times = res.body.data.entries.map(e => new Date(e.at).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(res.body.data.entries[0].action).toBe('asked');
  });

  test('each entry names who moved, and which round it was', async () => {
    const { token: bt } = await approvedBrand();
    const { token: ct, influencerId } = await approvedCreator('asha_rounds');
    const reqId = await walkANegotiation(bt, ct, influencerId);

    const res = await request(app)
      .get(`/v1/collab-diary/request/${reqId}`)
      .set('Authorization', `Bearer ${ct}`);
    const entries = res.body.data.entries;

    expect(entries.every(e => ['brand', 'creator', 'admin', 'system'].includes(e.who))).toBe(true);

    const herCounter = entries.find(e => e.action === 'countered' && e.who === 'creator');
    expect(herCounter.round_of).toBe(1);
    expect(herCounter.round_max).toBeGreaterThanOrEqual(1);
  });

  test('BOTH SIDES SEE THE IDENTICAL PAGE', async () => {
    // The reason a shared diary exists at all: two internally-consistent stories about
    // one negotiation is the failure it prevents.
    const { token: bt } = await approvedBrand();
    const { token: ct, influencerId } = await approvedCreator('asha_both');
    const reqId = await walkANegotiation(bt, ct, influencerId);

    const asBrand = await request(app)
      .get(`/v1/collab-diary/request/${reqId}`).set('Authorization', `Bearer ${bt}`);
    const asCreator = await request(app)
      .get(`/v1/collab-diary/request/${reqId}`).set('Authorization', `Bearer ${ct}`);

    expect(asBrand.status).toBe(200);
    expect(asCreator.status).toBe(200);
    expect(asBrand.body.data.entries).toEqual(asCreator.body.data.entries);
    expect(asBrand.body.data.conversation.settled)
      .toEqual(asCreator.body.data.conversation.settled);
  });

  test('a conversation nobody has answered yet still has its opening move', async () => {
    const { token: bt } = await approvedBrand();
    const { token: ct, influencerId } = await approvedCreator('asha_fresh');

    const sent = await request(app)
      .post('/v1/brands/me/collab-requests')
      .set('Authorization', `Bearer ${bt}`)
      .send({ influencer_id: influencerId, terms: TERMS });

    const res = await request(app)
      .get(`/v1/collab-diary/request/${sent.body.data.requests[0].id}`)
      .set('Authorization', `Bearer ${ct}`);

    expect(res.status).toBe(200);
    expect(res.body.data.entries).toHaveLength(1);
    expect(res.body.data.entries[0].action).toBe('asked');
  });
});

describe('who may read it', () => {
  test('a stranger gets nothing, and cannot tell it exists', async () => {
    const { token: bt } = await approvedBrand();
    const { token: ct, influencerId } = await approvedCreator('asha_priv');
    const reqId = await walkANegotiation(bt, ct, influencerId);

    const { token: otherBrand } = await approvedBrand('Rival Label');
    const res = await request(app)
      .get(`/v1/collab-diary/request/${reqId}`)
      .set('Authorization', `Bearer ${otherBrand}`);

    // 404, not 403 — a 403 would confirm the conversation is real.
    expect(res.status).toBe(404);
  });

  test('an uninvolved creator gets nothing', async () => {
    const { token: bt } = await approvedBrand();
    const { token: ct, influencerId } = await approvedCreator('asha_p2');
    const reqId = await walkANegotiation(bt, ct, influencerId);

    const { token: otherCreator } = await approvedCreator('nosy_one');
    const res = await request(app)
      .get(`/v1/collab-diary/request/${reqId}`)
      .set('Authorization', `Bearer ${otherCreator}`);

    expect(res.status).toBe(404);
  });

  test('it is not open without a token', async () => {
    const res = await request(app).get('/v1/collab-diary/request/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  test('an unknown conversation is a 404, not a crash', async () => {
    const { token: ct } = await approvedCreator('asha_404');
    const res = await request(app)
      .get('/v1/collab-diary/request/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${ct}`);
    expect(res.status).toBe(404);
  });
});
