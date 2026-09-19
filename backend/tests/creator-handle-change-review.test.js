'use strict';

/**
 * creator-handle-change-review — checks 1–6 of 03-expected-outputs.md.
 * Contract: features/creator-handle-change-review
 */

const { truncateAll } = require('./helpers/db');
const { query, api, resetReference } = require('./helpers/item3');
const { createInfluencerUser, createAdminUser, completeCreatorProfile } = require('./helpers/factories');
const apify = require('../src/services/apifyRuns.service');

beforeEach(async () => { await truncateAll(); await resetReference(); if (apify.setMockResolver) apify.setMockResolver(null); });

const rnd = () => Math.random().toString(36).slice(2, 8);
const state = async (influencerId) => (await query(
  `SELECT platform, handle_norm, state, ownership, replaced_at FROM creator_social_accounts WHERE influencer_id = $1 ORDER BY platform, created_at`, [influencerId])).rows;

async function pendingCreator({ ig, yt } = {}) {
  const { token, user } = await createInfluencerUser();
  const r = await api.post('/influencers/register', token, { name: 'Somepalli Anusha', state: 'Telangana', city: 'Hyderabad', instagram_handle: ig, ...(yt ? { youtube_handle: yt } : {}) });
  if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  const influencerId = r.body.data.influencer.id;
  await completeCreatorProfile(influencerId);
  const { rows: [cp] } = await query(`SELECT id FROM creator_profiles WHERE linked_influencer_id = $1`, [influencerId]);
  return { token, userId: user.id, influencerId, profileId: cp.id };
}

describe('the queue row (checks 1, 2)', () => {
  it('unchanged: current accounts listed, nothing changed; changed: old → new per platform, current accounts waiting', async () => {
    const A = `anusha9somepalli_${rnd()}`;
    const c = await pendingCreator({ ig: A });
    const admin = await createAdminUser('superadmin');
    let q = await api.get('/admin/creator-verifications?status=claimed', admin.token);
    expect(q.status).toBe(200);
    let row = q.body.data.verifications.find(v => v.linked_influencer_id === c.influencerId);
    expect(row.changed).toEqual([]);
    expect(row.current_accounts).toEqual([expect.objectContaining({ platform: 'instagram', handle_norm: A, state: 'waiting_approval' })]);

    const B = `stories_by_srilok_${rnd()}`;
    const C = `stories_yt_${rnd()}`;
    let r = await api.patch('/influencers/me', c.token, { instagram_handle: B, youtube_handle: `@${C}` });
    expect(r.status).toBe(200);
    q = await api.get('/admin/creator-verifications?status=claimed', admin.token);
    row = q.body.data.verifications.find(v => v.linked_influencer_id === c.influencerId);
    expect(row.ig_handle).toBe(A);                                            // the claimed profile still names A
    expect(row.changed).toEqual([
      { platform: 'instagram', from: A, to: B },
      { platform: 'youtube', from: null, to: C },
    ]);
    expect(row.current_accounts.map(a => [a.platform, a.handle_norm, a.state])).toEqual([['instagram', B, 'waiting_approval'], ['youtube', C, 'waiting_approval']]);
  });
});

describe('verify (checks 3, 4, 5)', () => {
  it('approves and measures the current channels and renames the claimed profile to them; A stays in history', async () => {
    const A = `a_${rnd()}`, B = `b_${rnd()}`, C = `c_${rnd()}`;
    const c = await pendingCreator({ ig: A });
    await api.patch('/influencers/me', c.token, { instagram_handle: B, youtube_handle: C });
    const admin = await createAdminUser('superadmin');
    const r = await api.post(`/admin/creator-verifications/${c.profileId}/verify`, admin.token);
    expect(r.status).toBe(200);
    expect(r.body.data.record_renamed).toBe(true);
    expect(r.body.data.verified).toMatchObject({ ig_handle: B, youtube_handle: C, verification_status: 'verified' });
    expect((await query(`SELECT status FROM users WHERE id = $1`, [c.userId])).rows[0].status).toBe('approved');
    const acc = await state(c.influencerId);
    expect(acc.find(a => a.handle_norm === A)).toMatchObject({ replaced_at: expect.anything() });
    expect(acc.filter(a => !a.replaced_at).map(a => [a.platform, a.handle_norm, a.state, a.ownership]))
      .toEqual([['instagram', B, 'measuring', 'confirmed'], ['youtube', C, 'measuring', 'confirmed']]);
    // gone from the pending queue
    const q = await api.get('/admin/creator-verifications?status=claimed', admin.token);
    expect(q.body.data.verifications.find(v => v.id === c.profileId)).toBeUndefined();
  });

  it('when another scraped profile already carries the new Instagram handle, the record keeps A and says so; accounts still confirmed', async () => {
    const A = `a_${rnd()}`, B = `b_${rnd()}`;
    const c = await pendingCreator({ ig: A });
    await query(`INSERT INTO creator_profiles (ig_handle, verification_status) VALUES ($1, 'unclaimed')`, [B]);
    await api.patch('/influencers/me', c.token, { instagram_handle: B });
    const admin = await createAdminUser('superadmin');
    const r = await api.post(`/admin/creator-verifications/${c.profileId}/verify`, admin.token);
    expect(r.status).toBe(200);
    expect(r.body.data.record_renamed).toBe(false);
    expect(r.body.data.verified.ig_handle).toBe(A);
    expect((await state(c.influencerId)).filter(a => !a.replaced_at)).toEqual([expect.objectContaining({ handle_norm: B, state: 'measuring', ownership: 'confirmed' })]);
  });

  it('an incomplete profile is refused first; nothing renamed, nothing confirmed', async () => {
    const A = `a_${rnd()}`, B = `b_${rnd()}`;
    const c = await pendingCreator({ ig: A });
    await api.patch('/influencers/me', c.token, { instagram_handle: B });
    await query(`UPDATE influencers SET bio = NULL, age = NULL WHERE id = $1`, [c.influencerId]);
    const admin = await createAdminUser('superadmin');
    const r = await api.post(`/admin/creator-verifications/${c.profileId}/verify`, admin.token);
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('PROFILE_INCOMPLETE');
    expect((await query(`SELECT ig_handle, verification_status FROM creator_profiles WHERE id = $1`, [c.profileId])).rows[0]).toEqual({ ig_handle: A, verification_status: 'claimed' });
    expect((await state(c.influencerId)).filter(a => !a.replaced_at)[0].state).toBe('waiting_approval');
  });
});

describe('handle checks (check 6)', () => {
  it('an approved creator who changes a handle still lands on Handle checks with old_handle', async () => {
    const A = `a_${rnd()}`, B = `b_${rnd()}`;
    const c = await pendingCreator({ ig: A });
    const admin = await createAdminUser('superadmin');
    expect((await api.post(`/admin/creator-verifications/${c.profileId}/verify`, admin.token)).status).toBe(200);
    expect((await api.patch('/influencers/me', c.token, { instagram_handle: B })).status).toBe(200);
    const h = await api.get('/admin/social/handle-checks', admin.token);
    expect(h.status).toBe(200);
    expect(h.body.data.checks.find(x => x.influencer_id === c.influencerId)).toMatchObject({ handle_norm: B, old_handle: A });
  });
});
