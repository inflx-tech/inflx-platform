'use strict';

/**
 * Item 2 — the endpoints (prompt §2.2): settings GET/PUT with the §4 messages, blocks,
 * reference lists, the public summaries, and the wiring into pitch-create and invite-create.
 * Privacy is asserted on every response the other side can read.
 * Contract: features/item2-pitch-invitation-settings
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createInfluencerUser, registerBrand, registerInfluencer } = require('./helpers/factories');
const ref = require('../src/services/referenceLists.service');

beforeEach(async () => { await truncateAll(); ref.invalidate(); });

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function brand(over = {}) {
  const { token, user } = await createBrandUser();
  const b = await registerBrand(token, { category: 'fashion', sub_categories: ['WOMEN'], city: 'Hyderabad', state: 'Telangana', ...over });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  return { token, userId: user.id, brandId: b.id };
}
async function creator(over = {}) {
  const { token, user } = await createInfluencerUser();
  const inf = await registerInfluencer(token, { instagram_handle: `c_${Math.random().toString(36).slice(2, 8)}`, name: 'Priya Sharma', city: 'Hyderabad' });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  await query(`UPDATE influencers SET followers_count=$2, engagement_rate=$3, niche=$4, language=$5 WHERE id=$1`,
    [inf.id, over.ig ?? 48000, over.er ?? 4.2, over.niche || ['fashion'], over.language || ['Telugu']]);
  return { token, userId: user.id, influencerId: inf.id };
}
const LEAK = /min_followers|minFollowers|threshold|niche_codes|nicheCodes|city_ids|cityIds|language_codes|blocked|block_|min_fee|minFee|commission/i;

describe('A1 — brand pitch settings', () => {
  it('GET returns all defaults for a brand that never saved, with saved:false', async () => {
    const b = await brand();
    const r = await request(app).get('/v1/brands/me/pitch-settings').set(auth(b.token));
    expect(r.status).toBe(200);
    const s = r.body.data.settings;
    expect(s.saved).toBe(false);
    expect(s.accepting).toBe(true);
    expect(s.acceptedAims).toEqual(['conversion', 'engagement', 'hybrid']);
    expect(s.acceptedModes).toEqual(['visit', 'shipment']);
    expect(s.nicheCodes).toBeNull();
    expect(s.allowPastCreators).toBe(true);
    expect(r.body.data.openPitches).toBe(0);
  });

  it('PUT validates every §4 rule with the exact message and field (check 2)', async () => {
    const b = await brand();
    const r = await request(app).put('/v1/brands/me/pitch-settings').set(auth(b.token)).send({
      acceptedAims: [], acceptedModes: [], minFollowersInstagram: 'ten', minFollowersYoutube: -1, minEngagementRate: 140,
    });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
    expect(r.body.error.field).toBe('acceptedAims');
    const byField = Object.fromEntries(r.body.error.details.fields.map(f => [f.field, f.message]));
    expect(byField.acceptedAims).toBe('Pick at least one Aim. To stop all pitches, turn off Accepting pitches instead.');
    expect(byField.acceptedModes).toBe('Pick at least one mode of work.');
    expect(byField.minFollowersInstagram).toBe('Enter a whole number.');
    expect(byField.minFollowersYoutube).toBe('Enter a whole number.');
    expect(byField.minEngagementRate).toBe('Enter a rate between 0 and 100.');
  });

  it('PUT saves, sets paused_at when turned off and clears it when turned on (check 5)', async () => {
    const b = await brand();
    let r = await request(app).put('/v1/brands/me/pitch-settings').set(auth(b.token)).send({
      accepting: false, acceptedAims: ['conversion', 'hybrid'], acceptedModes: ['visit'], minFollowersInstagram: 10000, minEngagementRate: 2.5,
      nicheCodes: ['fashion'], languageCodes: ['Telugu'], cityIds: [await ref.cityIdForName('Hyderabad')], allowPastCreators: false,
    });
    expect(r.status).toBe(200);
    expect(r.body.data.settings.saved).toBe(true);
    expect(r.body.data.settings.pausedAt).toBeTruthy();
    expect(r.body.data.settings.minEngagementRate).toBe(2.5);
    expect(r.body.data.cityCounts).toEqual({ cities: 1, states: 1 });
    r = await request(app).put('/v1/brands/me/pitch-settings').set(auth(b.token)).send({ accepting: true });
    expect(r.body.data.settings.pausedAt).toBeNull();
    expect(r.body.data.settings.acceptedAims).toEqual(['conversion', 'hybrid']);   // unchanged fields kept
  });

  it('PUT refuses a code that is not on the reference list', async () => {
    const b = await brand();
    const r = await request(app).put('/v1/brands/me/pitch-settings').set(auth(b.token)).send({ nicheCodes: ['not_a_niche'] });
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('nicheCodes');
  });

  it('is brand-only', async () => {
    const c = await creator();
    expect((await request(app).get('/v1/brands/me/pitch-settings').set(auth(c.token))).status).toBe(403);
  });
});

describe('A2 — creator invitation settings', () => {
  it('GET defaults: visit cities default to her profile city, one row-less commission list', async () => {
    const c = await creator();
    const r = await request(app).get('/v1/influencers/me/invitation-settings').set(auth(c.token));
    expect(r.status).toBe(200);
    const s = r.body.data.settings;
    expect(s.saved).toBe(false);
    expect(s.visitCityIds).toEqual([await ref.cityIdForName('Hyderabad')]);
    expect(s.visitCitiesDefaulted).toBe(true);
    expect(s.minCommissions).toEqual([]);
  });

  it('PUT validates the §4 rules (check 9)', async () => {
    const c = await creator();
    const r = await request(app).put('/v1/influencers/me/invitation-settings').set(auth(c.token)).send({
      acceptedAims: [], acceptedModes: ['visit'], visitCityIds: [], minFeeEngagement: 12.5, minFeeHybrid: 'x',
      minCommissions: [{ aim: 'conversion', categoryCode: 'WOMEN', pct: 150 }],
    });
    expect(r.status).toBe(422);
    const byField = Object.fromEntries(r.body.error.details.fields.map(f => [f.field, f.message]));
    expect(byField.acceptedAims).toBe('Pick at least one Aim. To stop all invitations, turn off Open to invitations instead.');
    expect(byField.visitCityIds).toBe('Pick at least one city, or turn off Store Visit.');
    expect(byField.minFeeEngagement).toBe('Enter an amount in whole rupees.');
    expect(byField.minFeeHybrid).toBe('Enter an amount in whole rupees.');
    expect(byField['minCommissions[0].pct']).toBe('Commission must be between 1 and 100%.');
  });

  it('saves the founder\'s example; turning Hybrid off and on keeps ₹5,000 and 10% (check 8)', async () => {
    const c = await creator();
    let r = await request(app).put('/v1/influencers/me/invitation-settings').set(auth(c.token)).send({
      acceptedAims: ['conversion', 'engagement', 'hybrid'], brandCategoryCodes: ['WOMEN', 'IMITATION_JEWELLERY'],
      minFeeEngagement: 8000, minFeeHybrid: 5000,
      minCommissions: [{ aim: 'conversion', categoryCode: 'WOMEN', pct: 12 }, { aim: 'hybrid', categoryCode: 'WOMEN', pct: 10 }],
    });
    expect(r.status).toBe(200);
    expect(r.body.data.settings.minCommissions).toEqual(expect.arrayContaining([
      { aim: 'conversion', categoryCode: 'WOMEN', pct: 12 }, { aim: 'hybrid', categoryCode: 'WOMEN', pct: 10 }]));
    // Hybrid off
    r = await request(app).put('/v1/influencers/me/invitation-settings').set(auth(c.token)).send({ acceptedAims: ['conversion', 'engagement'] });
    expect(r.body.data.settings.minFeeHybrid).toBe(5000);
    expect(r.body.data.settings.minCommissions.find(x => x.aim === 'hybrid').pct).toBe(10);
    // Hybrid back on
    r = await request(app).put('/v1/influencers/me/invitation-settings').set(auth(c.token)).send({ acceptedAims: ['conversion', 'engagement', 'hybrid'] });
    expect(r.body.data.settings.acceptedAims).toContain('hybrid');
    expect(r.body.data.settings.minFeeHybrid).toBe(5000);
    // Unselecting a category keeps its row
    r = await request(app).put('/v1/influencers/me/invitation-settings').set(auth(c.token)).send({ brandCategoryCodes: ['IMITATION_JEWELLERY'] });
    expect(r.body.data.settings.minCommissions.find(x => x.aim === 'conversion' && x.categoryCode === 'WOMEN').pct).toBe(12);
    // pct null deletes a row
    r = await request(app).put('/v1/influencers/me/invitation-settings').set(auth(c.token)).send({ minCommissions: [{ aim: 'conversion', categoryCode: 'WOMEN', pct: null }] });
    expect(r.body.data.settings.minCommissions.find(x => x.aim === 'conversion' && x.categoryCode === 'WOMEN')).toBeUndefined();
  });
});

describe('A3/A4 — blocks', () => {
  it('brand blocks a creator: listed with name and date; unblock removes; no notification row is written (check 6)', async () => {
    const b = await brand(); const c = await creator();
    const before = (await query(`SELECT count(*)::int AS n FROM notifications`)).rows[0].n;
    let r = await request(app).post('/v1/brands/me/blocked-creators').set(auth(b.token)).send({ influencerId: c.influencerId });
    expect(r.status).toBe(201);
    r = await request(app).post('/v1/brands/me/blocked-creators').set(auth(b.token)).send({ influencerId: c.influencerId });
    expect(r.status).toBe(200);   // idempotent
    r = await request(app).get('/v1/brands/me/blocked-creators').set(auth(b.token));
    expect(r.body.data.blocked).toHaveLength(1);
    expect(r.body.data.blocked[0]).toEqual(expect.objectContaining({ influencerId: c.influencerId, name: 'Priya Sharma' }));
    expect(r.body.data.blocked[0].blockedAt).toBeTruthy();
    expect((await query(`SELECT count(*)::int AS n FROM notifications`)).rows[0].n).toBe(before);
    r = await request(app).delete(`/v1/brands/me/blocked-creators/${c.influencerId}`).set(auth(b.token));
    expect(r.status).toBe(200);
    r = await request(app).get('/v1/brands/me/blocked-creators').set(auth(b.token));
    expect(r.body.data.blocked).toHaveLength(0);
  });

  it('creator blocks a brand and the settings GET counts it', async () => {
    const b = await brand(); const c = await creator();
    let r = await request(app).post('/v1/influencers/me/blocked-brands').set(auth(c.token)).send({ brandId: b.brandId });
    expect(r.status).toBe(201);
    r = await request(app).get('/v1/influencers/me/invitation-settings').set(auth(c.token));
    expect(r.body.data.blockedCount).toBe(1);
    r = await request(app).get('/v1/influencers/me/blocked-brands').set(auth(c.token));
    expect(r.body.data.blocked[0].brandId).toBe(b.brandId);
    r = await request(app).delete(`/v1/influencers/me/blocked-brands/${b.brandId}`).set(auth(c.token));
    expect(r.status).toBe(200);
  });
});

describe('A8 — reference lists', () => {
  it('serves niches (20), languages (10), the 8 categories and states with nested cities', async () => {
    const c = await creator();
    const [n, l, k, s] = await Promise.all([
      request(app).get('/v1/reference/creator-niches').set(auth(c.token)),
      request(app).get('/v1/reference/languages').set(auth(c.token)),
      request(app).get('/v1/reference/brand-categories').set(auth(c.token)),
      request(app).get('/v1/reference/states').set(auth(c.token)),
    ]);
    expect(n.body.data.items).toHaveLength(20);
    expect(l.body.data.items).toHaveLength(10);
    expect(k.body.data.items.map(x => x.code)).toEqual(['MEN', 'WOMEN', 'KIDS', 'PLUS_SIZE', 'WATCHES', 'IMITATION_JEWELLERY', 'FOOTWEAR', 'BAGS_ACCESSORIES']);
    expect(s.body.data.items).toHaveLength(17);
    const tg = s.body.data.items.find(x => x.name === 'Telangana');
    expect(tg.cities.map(x => x.name)).toContain('Hyderabad');
    expect(s.body.data.items.reduce((a, x) => a + x.cities.length, 0)).toBe(63);
  });
});

describe('A5/A6 — what the other side sees', () => {
  it('brand overview for a creator: pitchSummary only, no thresholds; paused and blocked identical (checks 1, 4, 5, 6)', async () => {
    const b = await brand(); const c = await creator({ ig: 100 });
    let r = await request(app).get(`/v1/brands/${b.brandId}/public`).set(auth(c.token));
    expect(r.status).toBe(200);
    expect(r.body.data.pitchSummary).toEqual({ acceptingLabelState: 'accepting', aims: ['conversion', 'engagement', 'hybrid'], modes: ['visit', 'shipment'], canPitch: true, reason: 'OK' });
    await request(app).put('/v1/brands/me/pitch-settings').set(auth(b.token)).send({ minFollowersInstagram: 10000 });
    r = await request(app).get(`/v1/brands/${b.brandId}/public`).set(auth(c.token));
    expect(r.body.data.pitchSummary.reason).toBe('NOT_MATCHING');
    expect(JSON.stringify(r.body)).not.toMatch(LEAK);
    expect(JSON.stringify(r.body)).not.toMatch(/10000/);
    await request(app).post('/v1/brands/me/blocked-creators').set(auth(b.token)).send({ influencerId: c.influencerId });
    const blocked = (await request(app).get(`/v1/brands/${b.brandId}/public`).set(auth(c.token))).body.data.pitchSummary;
    await request(app).delete(`/v1/brands/me/blocked-creators/${c.influencerId}`).set(auth(b.token));
    await request(app).put('/v1/brands/me/pitch-settings').set(auth(b.token)).send({ accepting: false });
    const paused = (await request(app).get(`/v1/brands/${b.brandId}/public`).set(auth(c.token))).body.data.pitchSummary;
    expect(blocked).toEqual(paused);
    expect(paused).toEqual({ acceptingLabelState: 'paused', aims: ['conversion', 'engagement', 'hybrid'], modes: ['visit', 'shipment'], canPitch: false, reason: 'NOT_ACCEPTING' });
  });

  it('the old proposal-criteria endpoint no longer hands out the filters', async () => {
    const b = await brand(); const c = await creator();
    await query(`UPDATE brands SET proposal_filters = '{"min_engagement_rate": 7, "allowed_niches": ["food"]}' WHERE id=$1`, [b.brandId]);
    const r = await request(app).get(`/v1/brands/${b.brandId}/proposal-criteria`).set(auth(c.token));
    expect(r.status).toBe(200);
    expect(r.body.data.pitchSummary.reason).toBe('OK');
    expect(JSON.stringify(r.body)).not.toMatch(/proposal_filters|min_engagement_rate|allowed_niches/);
  });

  it('creator profile for a brand: inviteSummary only; NOT_MATCHING never says why', async () => {
    const b = await brand({ sub_categories: ['WATCHES'] }); const c = await creator();
    await request(app).put('/v1/influencers/me/invitation-settings').set(auth(c.token)).send({ brandCategoryCodes: ['WOMEN'], minFeeEngagement: 8000 });
    const r = await request(app).get(`/v1/influencers/${c.influencerId}`).set(auth(b.token));
    expect(r.status).toBe(200);
    expect(r.body.data.inviteSummary).toEqual({ openLabelState: 'open', aims: ['conversion', 'engagement', 'hybrid'], modes: ['visit', 'shipment'], canInvite: false, reason: 'NOT_MATCHING' });
    expect(JSON.stringify(r.body.data.inviteSummary)).not.toMatch(/WOMEN|8000/);
  });
});

describe('A7 — enforced on send', () => {
  const pitchBody = (brandId, extra = {}) => ({ brand_id: brandId, pitch_title: 'Hi', pitch_message: 'Let us work', goal: 'conversion', ...extra });

  it('a pitch to a brand whose filter she fails is refused with NOT_MATCHING and no threshold (check 4)', async () => {
    const b = await brand(); const c = await creator({ ig: 8000 });
    await request(app).put('/v1/brands/me/pitch-settings').set(auth(b.token)).send({ minFollowersInstagram: 10000 });
    const r = await request(app).post('/v1/influencers/me/proposals').set(auth(c.token)).send(pitchBody(b.brandId));
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('NOT_MATCHING');
    expect(r.body.error.message).toBe("You don't match this brand's pitch criteria.");
    expect(JSON.stringify(r.body)).not.toMatch(/10000|followers/i);
  });

  it('paused or blocked → NOT_ACCEPTING; an accepted pitch is 201 and carries its mode; the wrong mode is refused', async () => {
    const b = await brand(); const c = await creator();
    await request(app).post('/v1/brands/me/blocked-creators').set(auth(b.token)).send({ influencerId: c.influencerId });
    let r = await request(app).post('/v1/influencers/me/proposals').set(auth(c.token)).send(pitchBody(b.brandId));
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('NOT_ACCEPTING');
    await request(app).delete(`/v1/brands/me/blocked-creators/${c.influencerId}`).set(auth(b.token));
    await request(app).put('/v1/brands/me/pitch-settings').set(auth(b.token)).send({ acceptedModes: ['visit'] });
    r = await request(app).post('/v1/influencers/me/proposals').set(auth(c.token)).send(pitchBody(b.brandId, { shoot_mode: 'shipment' }));
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('NOT_MATCHING');
    r = await request(app).post('/v1/influencers/me/proposals').set(auth(c.token)).send(pitchBody(b.brandId, { shoot_mode: 'visit' }));
    expect(r.status).toBe(201);
    expect(r.body.data.proposal.shoot_mode).toBe('visit');
  });

  it('changing settings after a pitch is sent does not touch the pitch (check 13)', async () => {
    const b = await brand(); const c = await creator();
    const sent = await request(app).post('/v1/influencers/me/proposals').set(auth(c.token)).send(pitchBody(b.brandId));
    expect(sent.status).toBe(201);
    await request(app).put('/v1/brands/me/pitch-settings').set(auth(b.token)).send({ accepting: false });
    await request(app).post('/v1/brands/me/blocked-creators').set(auth(b.token)).send({ influencerId: c.influencerId });
    const { rows } = await query(`SELECT status FROM influencer_proposals WHERE id=$1`, [sent.body.data.proposal.id]);
    expect(rows[0].status).toBe('sent');
    const settings = await request(app).get('/v1/brands/me/pitch-settings').set(auth(b.token));
    expect(settings.body.data.openPitches).toBe(1);      // still needs the brand's answer
  });

  async function setUp(b, goal, shoot_mode) {
    const camp = await request(app).post('/v1/campaigns').set(auth(b.token)).send({ name: 'Festive', total_budget: 50000, start_date: '2026-10-01', end_date: '2026-10-31' });
    expect(camp.status).toBe(201);
    const cid = camp.body.data.campaign.id;
    const set = await request(app).post(`/v1/campaigns/${cid}/sets`).set(auth(b.token)).send({ name: 'Set A', goal, assignment_mode: 'handpick', set_budget: 20000, shoot_mode });
    expect(set.status).toBe(201);
    return { cid, sid: set.body.data.set.id };
  }

  it('an invitation to a creator who is not open to the set is refused; warnings ride on a successful one (checks 10, 11)', async () => {
    const b = await brand({ sub_categories: ['WATCHES'] }); const c = await creator();
    await request(app).put('/v1/influencers/me/invitation-settings').set(auth(c.token)).send({ brandCategoryCodes: ['WOMEN'], minFeeEngagement: 8000 });
    const { cid, sid } = await setUp(b, 'engagement', 'shipment');
    let r = await request(app).post(`/v1/campaigns/${cid}/sets/${sid}/invite`).set(auth(b.token)).send({ influencer_id: c.influencerId, agreed_fee: 6000 });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('NOT_MATCHING');
    expect(r.body.error.message).toBe("This creator isn't open to this set.");
    expect(JSON.stringify(r.body)).not.toMatch(/WOMEN|8000/);
    // brand now sells Women too → allowed, but the fee is below her minimum → warning, not a block
    await request(app).patch('/v1/brands/me').set(auth(b.token)).send({ sub_categories: ['WATCHES', 'WOMEN'] });
    r = await request(app).post(`/v1/campaigns/${cid}/sets/${sid}/invite`).set(auth(b.token)).send({ influencer_id: c.influencerId, agreed_fee: 6000 });
    expect(r.status).toBe(201);
    expect(r.body.data.eligibility_warnings).toEqual(['BELOW_MIN_FEE']);
  });

  it('a paused creator cannot be invited; her existing invitation stays as it was (check 13)', async () => {
    const b = await brand(); const c = await creator(); const d = await creator();
    const { cid, sid } = await setUp(b, 'engagement', 'shipment');
    const first = await request(app).post(`/v1/campaigns/${cid}/sets/${sid}/invite`).set(auth(b.token)).send({ influencer_id: c.influencerId, agreed_fee: 9000 });
    expect(first.status).toBe(201);
    await request(app).put('/v1/influencers/me/invitation-settings').set(auth(c.token)).send({ open: false });
    const { rows } = await query(`SELECT status FROM campaign_influencers WHERE id=$1`, [first.body.data.campaign_influencer.id]);
    expect(rows[0].status).toBe('invited');
    await request(app).post('/v1/influencers/me/blocked-brands').set(auth(d.token)).send({ brandId: b.brandId });
    const r = await request(app).post(`/v1/campaigns/${cid}/sets/${sid}/invite`).set(auth(b.token)).send({ influencer_id: d.influencerId, agreed_fee: 9000 });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('NOT_ACCEPTING');
    expect(r.body.error.message).toBe("This creator isn't taking invitations right now.");
  });
});

describe('the two in-scope additions', () => {
  it('check 15: a new brand cannot finish registration without a sub-category; unknown codes are refused', async () => {
    const { token } = await createBrandUser();
    const base = { name: 'Owner', business_name: 'Urban Threads', category: 'fashion', address_line: '1 Road', city: 'Hyderabad', state: 'Telangana', pincode: '500001' };
    let r = await request(app).post('/v1/brands/register').set(auth(token)).send(base);
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('sub_categories');
    r = await request(app).post('/v1/brands/register').set(auth(token)).send({ ...base, sub_categories: ['SHOES'] });
    expect(r.status).toBe(422);
    r = await request(app).post('/v1/brands/register').set(auth(token)).send({ ...base, sub_categories: ['women', 'FOOTWEAR'] });
    expect(r.status).toBe(201);
    expect(r.body.data.brand.sub_categories).toEqual(['WOMEN', 'FOOTWEAR']);
  });

  it('check 16: a creator cannot save her profile without exactly one niche from the list', async () => {
    const c = await creator();
    let r = await request(app).patch('/v1/influencers/me').set(auth(c.token)).send({ niche: [] });
    expect(r.status).toBe(422);
    expect(r.body.error.field).toBe('niche');
    r = await request(app).patch('/v1/influencers/me').set(auth(c.token)).send({ niche: ['fashion', 'comedy'] });
    expect(r.status).toBe(422);
    r = await request(app).patch('/v1/influencers/me').set(auth(c.token)).send({ niche: 'underwater_basket_weaving' });
    expect(r.status).toBe(422);
    r = await request(app).patch('/v1/influencers/me').set(auth(c.token)).send({ niche: 'comedy' });
    expect(r.status).toBe(200);
    expect(r.body.data.influencer.niche).toEqual(['comedy']);
  });

  it('Business details can set the sub-categories, never to an empty list', async () => {
    const b = await brand();
    let r = await request(app).patch('/v1/brands/me').set(auth(b.token)).send({ sub_categories: [] });
    expect(r.status).toBe(422);
    r = await request(app).patch('/v1/brands/me').set(auth(b.token)).send({ sub_categories: ['MEN', 'KIDS'] });
    expect(r.status).toBe(200);
    expect(r.body.data.brand.sub_categories).toEqual(['MEN', 'KIDS']);
  });
});
