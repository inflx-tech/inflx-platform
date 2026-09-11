'use strict';

/**
 * Item 3 — Worked with (W1) and the collaboration lines on a creator's profile (P1/P2):
 * both signatures or nothing, grouped per creator, newest signature first, this brand's
 * collaborations only on P2, the INFLX-wide signed count on P1 hidden at zero.
 * Contract: features/item3-discovery-profiles-groups · founder Q5
 */

const { truncateAll } = require('./helpers/db');
const { query, resetReference, brand, creator, collab, api } = require('./helpers/item3');
const collabState = require('../src/services/collabState');

beforeEach(async () => { await truncateAll(); await resetReference(); });

const worked = (b, q = {}) => api.get(`/brands/me/worked-with?${new URLSearchParams(q).toString()}`, b.token);
const days = (n) => new Date(Date.now() - n * 86400000);

describe('W1 — worked with', () => {
  it('only creators with a contract signed by BOTH sides; one-sided or unsigned do not count', async () => {
    const b = await brand();
    const both = await creator({ name: 'Both Signed' });
    const brandOnly = await creator({ name: 'Brand Only' });
    const creatorOnly = await creator({ name: 'Creator Only' });
    const none = await creator({ name: 'No Contract' });
    await collab(b.brandId, both.influencerId, { signed: 'both' });
    await collab(b.brandId, brandOnly.influencerId, { signed: 'brand' });
    await collab(b.brandId, creatorOnly.influencerId, { signed: 'creator' });
    await collab(b.brandId, none.influencerId, { signed: 'none' });
    const r = await worked(b);
    expect(r.status).toBe(200);
    expect(r.body.data.total).toBe(1);
    expect(r.body.data.rows).toHaveLength(1);
    expect(r.body.data.rows[0]).toMatchObject({ influencerId: both.influencerId, name: 'Both Signed', collaborations: 1 });
  });

  it('groups per creator with the count and the latest signature; newest first; search by name or handle', async () => {
    const b = await brand();
    const a = await creator({ name: 'Anita Rao', handle: 'anita_r' });
    const z = await creator({ name: 'Zoya Khan', handle: 'zoya_k' });
    await collab(b.brandId, a.influencerId, { signedAt: days(30) });
    await collab(b.brandId, a.influencerId, { signedAt: days(20) });
    await collab(b.brandId, a.influencerId, { signedAt: days(2) });
    await collab(b.brandId, z.influencerId, { signedAt: days(5) });
    const r = await worked(b);
    expect(r.body.data.rows.map(x => x.influencerId)).toEqual([a.influencerId, z.influencerId]);
    expect(r.body.data.rows[0].collaborations).toBe(3);
    expect(new Date(r.body.data.rows[0].lastSignedAt).getTime()).toBeGreaterThan(new Date(r.body.data.rows[1].lastSignedAt).getTime());
    expect((await worked(b, { search: 'zoya' })).body.data.rows.map(x => x.influencerId)).toEqual([z.influencerId]);
    expect((await worked(b, { search: '@anita' })).body.data.rows.map(x => x.influencerId)).toEqual([a.influencerId]);
  });

  it('another brand\'s signatures do not show; a suspended creator disappears until reinstated', async () => {
    const b = await brand();
    const other = await brand();
    const mine = await creator({ name: 'Mine' });
    const theirs = await creator({ name: 'Theirs' });
    await collab(b.brandId, mine.influencerId);
    await collab(other.brandId, theirs.influencerId);
    expect((await worked(b)).body.data.rows.map(x => x.influencerId)).toEqual([mine.influencerId]);
    await query(`UPDATE users SET status='suspended' WHERE id=$1`, [mine.userId]);
    expect((await worked(b)).body.data.total).toBe(0);
    await query(`UPDATE users SET status='approved' WHERE id=$1`, [mine.userId]);
    expect((await worked(b)).body.data.total).toBe(1);
  });
});

describe('P1 · P2 — the profile\'s collaboration lines (founder Q5)', () => {
  it('P1 counts both-signed collaborations across ALL brands and hides the line at zero (check 30)', async () => {
    const b = await brand();
    const other = await brand();
    const c = await creator();
    let r = await api.get(`/influencers/${c.influencerId}`, b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.signedCollaborations).toBe(0);
    expect(r.body.data.signedCollaborationsLabel).toBeNull();
    await collab(other.brandId, c.influencerId);
    await collab(other.brandId, c.influencerId, { signed: 'brand' });
    r = await api.get(`/influencers/${c.influencerId}`, b.token);
    expect(r.body.data.signedCollaborations).toBe(1);
    expect(r.body.data.signedCollaborationsLabel).toBe('1 collaboration signed on INFLX');
    await collab(b.brandId, c.influencerId);
    r = await api.get(`/influencers/${c.influencerId}`, b.token);
    expect(r.body.data.signedCollaborationsLabel).toBe('2 collaborations signed on INFLX');
  });

  it('P2 lists only THIS brand\'s both-signed collaborations, newest first, with the state family and label', async () => {
    const b = await brand();
    const other = await brand();
    const c = await creator();
    await collab(other.brandId, c.influencerId, { campaignName: 'Not mine' });
    await collab(b.brandId, c.influencerId, { campaignName: 'Diwali', setName: 'Reels', aim: 'engagement', status: 'completed', signedAt: days(40) });
    await collab(b.brandId, c.influencerId, { campaignName: 'Summer', setName: 'Stories', aim: 'conversion', status: 'active', signedAt: days(3) });
    await collab(b.brandId, c.influencerId, { campaignName: 'Unsigned', signed: 'brand' });
    const r = await api.get(`/influencers/${c.influencerId}`, b.token);
    const rows = r.body.data.collaborationsWithYou;
    expect(rows.map(x => x.campaignName)).toEqual(['Summer', 'Diwali']);
    expect(rows[0]).toMatchObject({ setName: 'Stories', aim: 'conversion', status: 'active', stateFamily: 'active', stateLabel: collabState.FAMILY_LABEL.active });
    expect(rows[1]).toMatchObject({ stateFamily: 'completed', stateLabel: collabState.FAMILY_LABEL.completed });
    expect(JSON.stringify(rows)).not.toMatch(/Not mine|Unsigned/);
  });

  it('the P1 count sits behind one switch so it can later become "completed" without touching callers', () => {
    expect(collabState.P1_COUNT_MODE).toBe('signed');
    expect(collabState.P1_COUNT_LABEL(1)).toBe('1 collaboration signed on INFLX');
    expect(collabState.P1_COUNT_LABEL(3)).toBe('3 collaborations signed on INFLX');
    expect(collabState.familyOf('invited')).toBe('yourMove');
    expect(collabState.familyOf('negotiating')).toBe('waiting');
    expect(collabState.familyOf('contracted')).toBe('active');
    expect(collabState.familyOf('expired')).toBe('ended');
    expect(collabState.familyOf('declined')).toBe('declined');
  });
});
