'use strict';

/**
 * Item 3 — Discover creators (D1/D2): approved only, the live status per creator, "Blocked
 * by you" shown not hidden, every filter, the three sorts, search, paging and the count.
 * Also the website-facing side effects: /influencers/search hides pending creators and
 * /influencers/:id is gated for brand callers. Contract: features/item3-discovery-profiles-groups
 */

const { truncateAll } = require('./helpers/db');
const { query, ref, resetReference, brand, creator, setBrandPitch, setCreatorInvite, block, collab, api } = require('./helpers/item3');

beforeEach(async () => { await truncateAll(); await resetReference(); });

const discover = (b, q = {}) => api.get(`/brands/me/discover-creators?${new URLSearchParams(q).toString()}`, b.token);
const ids = (r) => {
  if (!r.body.data || !r.body.data.rows) throw new Error(`discover answered ${r.status}: ${JSON.stringify(r.body)}`);
  return r.body.data.rows.map(x => x.id);
};

describe('D1 — who appears and with which status', () => {
  it('only approved creators; pending, suspended and rejected never appear (check 14)', async () => {
    const b = await brand();
    const ok = await creator();
    await creator({ status: 'pending' }); await creator({ status: 'suspended' }); await creator({ status: 'rejected' });
    const r = await discover(b, { openOnly: '0' });
    expect(r.status).toBe(200);
    expect(ids(r)).toEqual([ok.influencerId]);
    expect(r.body.data.total).toBe(1);
  });

  it('status: OK · NOT_ACCEPTING (paused, or she blocked this brand) · NOT_MATCHING (her categories miss this brand)', async () => {
    const b = await brand({ sub_categories: ['WOMEN'] });
    const open = await creator({ name: 'Open One' });
    const paused = await creator({ name: 'Paused One' });
    const blocker = await creator({ name: 'Blocker One' });
    const mismatch = await creator({ name: 'Mismatch One' });
    await setCreatorInvite(paused.influencerId, { open: false });
    await block('creator', blocker.influencerId, 'brand', b.brandId);
    await setCreatorInvite(mismatch.influencerId, { categories: ['KIDS'] });
    const r = await discover(b, { openOnly: '0' });
    const by = Object.fromEntries(r.body.data.rows.map(x => [x.id, x.status]));
    expect(by[open.influencerId]).toBe('OK');
    expect(by[paused.influencerId]).toBe('NOT_ACCEPTING');
    expect(by[blocker.influencerId]).toBe('NOT_ACCEPTING');
    expect(by[mismatch.influencerId]).toBe('NOT_MATCHING');
    // Nothing tells the brand it was blocked.
    expect(JSON.stringify(r.body)).not.toMatch(/blocked_us|blockedUs|"blocked":true/);
  });

  it('"Open to invitations" is on by default and keeps only OK; a creator this brand blocked still appears with blockedByYou (check 31)', async () => {
    const b = await brand();
    const open = await creator();
    const paused = await creator();
    const blocked = await creator();
    await setCreatorInvite(paused.influencerId, { open: false });
    await block('brand', b.brandId, 'creator', blocked.influencerId);
    let r = await discover(b);
    expect(ids(r).sort()).toEqual([open.influencerId, blocked.influencerId].sort());
    const row = r.body.data.rows.find(x => x.id === blocked.influencerId);
    expect(row.blockedByYou).toBe(true);
    expect(row.status).toBe('OK');
    expect(r.body.data.rows.find(x => x.id === open.influencerId).blockedByYou).toBe(false);
    r = await discover(b, { openOnly: '0' });
    expect(ids(r)).toHaveLength(3);
  });

  it('a row carries exactly the D1 card fields and nothing private', async () => {
    const b = await brand();
    const c = await creator({ ig: 48200, yt: 12000, er: 4.2, language: ['Telugu'], cityName: 'Hyderabad', ytHandle: 'priyavlogs' });
    const r = await discover(b);
    const row = r.body.data.rows[0];
    expect(row).toMatchObject({ id: c.influencerId, name: 'Priya Sharma', instagram: 48200, youtube: 12000, engagement: 4.2, nicheCode: 'fashion', cityName: 'Hyderabad', stateName: 'Telangana', languages: ['Telugu'], status: 'OK', blockedByYou: false });
    expect(row.acceptedAims).toEqual(['conversion', 'engagement', 'hybrid']);
    expect(row.acceptedModes).toEqual(['visit', 'shipment']);
    expect(JSON.stringify(row)).not.toMatch(/phone|email|upi|bank|pan_|min_fee|minFee|commission/i);
  });
});

describe('D2 — filters, sorts, search, paging', () => {
  it('niche, followers (either platform), engagement, city, language', async () => {
    const b = await brand();
    const a = await creator({ name: 'A', niche: ['fashion'], ig: 50000, er: 5, cityName: 'Hyderabad', language: ['Telugu'] });
    const c = await creator({ name: 'C', niche: ['comedy'], ig: 800, yt: 20000, er: 2, cityName: 'Chennai', language: ['Tamil'] });
    expect(ids(await discover(b, { nicheCodes: 'comedy' }))).toEqual([c.influencerId]);
    expect(ids(await discover(b, { minInstagram: '10000' }))).toEqual([a.influencerId]);
    expect(ids(await discover(b, { minYoutube: '10000' }))).toEqual([c.influencerId]);
    expect(ids(await discover(b, { minEngagement: '4' }))).toEqual([a.influencerId]);
    expect(ids(await discover(b, { cityIds: String(await ref.cityIdForName('Chennai')) }))).toEqual([c.influencerId]);
    expect(ids(await discover(b, { languageCodes: 'Telugu' }))).toEqual([a.influencerId]);
    expect(ids(await discover(b, { nicheCodes: 'fashion,comedy' })).sort()).toEqual([a.influencerId, c.influencerId].sort());
  });

  it('aims and modes: at least one of the chosen values must be accepted (founder Q2)', async () => {
    const b = await brand();
    const a = await creator({ name: 'A' });
    const c = await creator({ name: 'C' });
    await setCreatorInvite(a.influencerId, { aims: ['conversion'], modes: ['visit'] });
    await setCreatorInvite(c.influencerId, { aims: ['engagement', 'hybrid'], modes: ['shipment'] });
    expect(ids(await discover(b, { aims: 'conversion' }))).toEqual([a.influencerId]);
    expect(ids(await discover(b, { aims: 'conversion,hybrid' })).sort()).toEqual([a.influencerId, c.influencerId].sort());
    expect(ids(await discover(b, { modes: 'shipment' }))).toEqual([c.influencerId]);
  });

  it('sorts: most followers = higher of IG/YT (founder Q1); highest engagement; newest = approved_at else created_at', async () => {
    const b = await brand();
    const igBig = await creator({ name: 'IG', ig: 90000, yt: 0, er: 1 });
    const ytBig = await creator({ name: 'YT', ig: 1000, yt: 120000, er: 9 });
    const mid = await creator({ name: 'Mid', ig: 50000, yt: 60000, er: 5 });
    expect(ids(await discover(b, { sort: 'followers' }))).toEqual([ytBig.influencerId, igBig.influencerId, mid.influencerId]);
    expect(ids(await discover(b, { sort: 'engagement' }))).toEqual([ytBig.influencerId, mid.influencerId, igBig.influencerId]);
    await query(`UPDATE influencers SET approved_at = now() - interval '10 days' WHERE id = $1`, [ytBig.influencerId]);
    await query(`UPDATE influencers SET approved_at = now() WHERE id = $1`, [igBig.influencerId]);
    await query(`UPDATE influencers SET approved_at = NULL WHERE id = $1`, [mid.influencerId]);
    await query(`UPDATE users SET created_at = now() - interval '30 days' WHERE id = $1`, [mid.userId]);
    expect(ids(await discover(b, { sort: 'newest' }))).toEqual([igBig.influencerId, ytBig.influencerId, mid.influencerId]);
  });

  it('search matches name or @handle; countOnly returns just the total; pages are 20 long', async () => {
    const b = await brand();
    const p = await creator({ name: 'Priya Sharma', handle: 'priya_styles' });
    await creator({ name: 'Rahul Verma', handle: 'rahulv' });
    expect(ids(await discover(b, { search: 'priya' }))).toEqual([p.influencerId]);
    expect(ids(await discover(b, { search: '@priya_st' }))).toEqual([p.influencerId]);
    const cnt = await discover(b, { countOnly: '1' });
    expect(cnt.body.data.total).toBe(2);
    expect(cnt.body.data.rows).toBeUndefined();
    for (let i = 0; i < 20; i += 1) await creator({ name: `Bulk ${i}` }); // 22 total
    const p1 = await discover(b, { page: '1' });
    const p2 = await discover(b, { page: '2' });
    expect(p1.body.data.rows).toHaveLength(20);
    expect(p2.body.data.rows).toHaveLength(2);
    expect(p1.body.data.total).toBe(22);
  });

  it('withGroups adds the group ids this brand has her in', async () => {
    const b = await brand();
    const c = await creator();
    const g = await api.post('/brands/me/influencer-groups', b.token, { name: 'Diwali', influencer_ids: [c.influencerId] });
    const r = await discover(b, { withGroups: '1' });
    expect(r.body.data.rows[0].groupIds).toEqual([g.body.data.group.id]);
  });
});

describe('Website-facing side effects of the approved-only rule', () => {
  it('/influencers/search no longer lists pending creators (check 14)', async () => {
    const b = await brand();
    const ok = await creator();
    await creator({ status: 'pending' });
    const r = await api.get('/influencers/search', b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.creators.map(x => x.linked_influencer_id || x.id)).toEqual([ok.influencerId]);
  });

  it('/influencers/:id is 404 for a brand when she is not approved; an admin still sees her', async () => {
    const { createAdminUser } = require('./helpers/factories');
    const b = await brand();
    const admin = await createAdminUser('superadmin');
    const pend = await creator({ status: 'pending' });
    expect((await api.get(`/influencers/${pend.influencerId}`, b.token)).status).toBe(404);
    expect((await api.get(`/influencers/${pend.influencerId}`, admin.token)).status).toBe(200);
  });

  it('a signed collaboration does not bring a suspended creator back into Discover', async () => {
    const b = await brand();
    const c = await creator();
    await collab(b.brandId, c.influencerId);
    await query(`UPDATE users SET status='suspended' WHERE id=$1`, [c.userId]);
    expect(ids(await discover(b, { openOnly: '0' }))).toEqual([]);
  });
});
