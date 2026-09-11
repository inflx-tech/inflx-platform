'use strict';

/**
 * Item 3 — creator groups (G1–G7, rules §5A): names (1–40, unique per brand, case-insensitive),
 * the 100 cap with the exact message, approved-only membership (a suspended creator is hidden
 * but kept, a rejected creator's rows are deleted), per-brand isolation, the for-creator
 * read/write, counts, avatars and ordering. Contract: features/item3-discovery-profiles-groups
 */

const { truncateAll } = require('./helpers/db');
const { query, resetReference, brand, creator, setCreatorInvite, api } = require('./helpers/item3');
const groupsCtrl = require('../src/controllers/influencerGroup.controller');

beforeEach(async () => { await truncateAll(); await resetReference(); });

const create = (b, name, ids) => api.post('/brands/me/influencer-groups', b.token, ids ? { name, influencer_ids: ids } : { name });

/** 100 approved creators straight into the tables — the cap test must not make 300 HTTP calls. */
async function bulkCreators(n) {
  const { rows } = await query(
    `WITH u AS (
       INSERT INTO users (phone, role, status, name)
       SELECT '+9190' || lpad(g::text, 8, '0'), 'influencer', 'approved', 'Bulk ' || g FROM generate_series(1, $1) g RETURNING id, name
     )
     INSERT INTO influencers (user_id, full_name, instagram_handle, niche, language)
     SELECT id, name, 'bulk_' || replace(id::text, '-', ''), ARRAY['fashion'], ARRAY['Hindi'] FROM u RETURNING id`, [n]);
  return rows.map(r => r.id);
}

describe('G3 — names', () => {
  it('empty, over 40 and duplicate (case-insensitive, trimmed) names are refused with the exact messages', async () => {
    const b = await brand();
    let r = await create(b, '   ');
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('name'); expect(r.body.error.message).toBe('Enter a group name.');
    r = await create(b, 'x'.repeat(41));
    expect(r.status).toBe(422); expect(r.body.error.message).toBe('Keep it under 40 characters.');
    r = await create(b, 'Diwali shortlist');
    expect(r.status).toBe(201);
    r = await create(b, '  diwali SHORTLIST ');
    expect(r.status).toBe(422); expect(r.body.error.message).toBe('You already have a group with this name.');
    // Another brand may use the same name (groups are per brand — founder Q12).
    const other = await brand();
    expect((await create(other, 'Diwali shortlist')).status).toBe(201);
    // Rename obeys the same rules.
    const g2 = (await create(b, 'Second')).body.data.group.id;
    r = await api.patch(`/brands/me/influencer-groups/${g2}`, b.token, { name: 'DIWALI shortlist' });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe('You already have a group with this name.');
    r = await api.patch(`/brands/me/influencer-groups/${g2}`, b.token, { name: 'Renamed' });
    expect(r.status).toBe(200); expect(r.body.data.group.name).toBe('Renamed');
  });
});

describe('G4 · G5 — members, cap, approved-only', () => {
  it('add returns added/skipped/capacityLeft; already-in creators are skipped; the 101st is refused with the exact message', async () => {
    const b = await brand();
    const g = (await create(b, 'Big')).body.data.group.id;
    const ids = await bulkCreators(101);
    let r = await api.post(`/brands/me/influencer-groups/${g}/members`, b.token, { influencer_ids: ids.slice(0, 99) });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ added: 99, skipped: 0, capacityLeft: 1 });
    r = await api.post(`/brands/me/influencer-groups/${g}/members`, b.token, { influencer_ids: [ids[0], ids[99]] });
    expect(r.body.data).toMatchObject({ added: 1, skipped: 1, capacityLeft: 0 });
    r = await api.post(`/brands/me/influencer-groups/${g}/members`, b.token, { influencer_ids: [ids[100]] });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('GROUP_FULL');
    expect(r.body.error.message).toBe('Big is full (100 creators). Remove someone or use another group.');
    const got = await api.get(`/brands/me/influencer-groups/${g}?page=all`, b.token);
    expect(got.body.data.group.memberCount).toBe(100);
    expect(got.body.data.memberIds).toHaveLength(100);
    expect(got.body.data.group.capacityLeft).toBe(0);
  });

  it('a suspended creator is hidden from the group (detail, counts, avatars) but her row stays; she cannot be added; reinstating brings her back (check 27)', async () => {
    const b = await brand();
    const a = await creator({ name: 'Anita' });
    const s = await creator({ name: 'Suspended Soon' });
    const g = (await create(b, 'Team', [a.influencerId, s.influencerId])).body.data.group.id;
    expect((await api.get('/brands/me/influencer-groups', b.token)).body.data.groups[0].memberCount).toBe(2);
    await query(`UPDATE users SET status='suspended' WHERE id=$1`, [s.userId]);
    const list = (await api.get('/brands/me/influencer-groups', b.token)).body.data.groups[0];
    expect(list.memberCount).toBe(1);
    expect(list.avatars.map(x => x.id)).toEqual([a.influencerId]);
    const det = await api.get(`/brands/me/influencer-groups/${g}`, b.token);
    expect(det.body.data.members.rows.map(x => x.id)).toEqual([a.influencerId]);
    expect((await query(`SELECT count(*)::int AS n FROM influencer_group_members WHERE group_id=$1`, [g])).rows[0].n).toBe(2);
    const g2 = (await create(b, 'Other')).body.data.group.id;
    const r = await api.post(`/brands/me/influencer-groups/${g2}/members`, b.token, { influencer_ids: [s.influencerId] });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('NOT_APPROVED');
    await query(`UPDATE users SET status='approved' WHERE id=$1`, [s.userId]);
    expect((await api.get(`/brands/me/influencer-groups/${g}`, b.token)).body.data.members.rows).toHaveLength(2);
  });

  it('a rejected creator\'s member rows are deleted (check 27)', async () => {
    const b = await brand();
    const c = await creator();
    const g = (await create(b, 'Team', [c.influencerId])).body.data.group.id;
    await query(`UPDATE users SET status='rejected' WHERE id=$1`, [c.userId]);
    await groupsCtrl.dropFromAllGroups(c.influencerId);
    expect((await query(`SELECT count(*)::int AS n FROM influencer_group_members WHERE group_id=$1`, [g])).rows[0].n).toBe(0);
  });

  it('remove a member; openCount counts members open to THIS brand; deleting a group leaves the creators alone', async () => {
    const b = await brand();
    const open = await creator(); const paused = await creator();
    await setCreatorInvite(paused.influencerId, { open: false });
    const g = (await create(b, 'Team', [open.influencerId, paused.influencerId])).body.data.group.id;
    let det = await api.get(`/brands/me/influencer-groups/${g}`, b.token);
    expect(det.body.data.group).toMatchObject({ memberCount: 2, openCount: 1 });
    const r = await api.del(`/brands/me/influencer-groups/${g}/members/${paused.influencerId}`, b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.group.memberCount).toBe(1);
    expect((await api.del(`/brands/me/influencer-groups/${g}`, b.token)).status).toBe(200);
    expect((await api.get(`/brands/me/influencer-groups/${g}`, b.token)).status).toBe(404);
    expect((await query(`SELECT count(*)::int AS n FROM influencers WHERE id = ANY($1::uuid[])`, [[open.influencerId, paused.influencerId]])).rows[0].n).toBe(2);
  });

  it('groups are per brand: another brand cannot read, rename, add to or delete them (founder Q12)', async () => {
    const b = await brand(); const other = await brand();
    const c = await creator();
    const g = (await create(b, 'Mine')).body.data.group.id;
    expect((await api.get(`/brands/me/influencer-groups/${g}`, other.token)).status).toBe(404);
    expect((await api.patch(`/brands/me/influencer-groups/${g}`, other.token, { name: 'Stolen' })).status).toBe(404);
    expect((await api.post(`/brands/me/influencer-groups/${g}/members`, other.token, { influencer_ids: [c.influencerId] })).status).toBe(404);
    expect((await api.del(`/brands/me/influencer-groups/${g}`, other.token)).status).toBe(404);
    expect((await api.get('/brands/me/influencer-groups', other.token)).body.data.groups).toEqual([]);
  });
});

describe('G1 · G6 — list order and the for-creator sheet', () => {
  it('lists recently updated first with counts, avatars (≤4) and the updated/created flag', async () => {
    const b = await brand();
    const cs = [];
    for (let i = 0; i < 5; i += 1) cs.push(await creator({ name: `C${i}` }));
    const older = (await create(b, 'Older', cs.map(c => c.influencerId))).body.data.group.id;
    const newer = (await create(b, 'Newer')).body.data.group.id;
    let list = (await api.get('/brands/me/influencer-groups', b.token)).body.data.groups;
    expect(list.map(g => g.id)).toEqual([newer, older]);
    expect(list[1]).toMatchObject({ memberCount: 5, changed: false });
    expect(list[1].avatars).toHaveLength(4);
    expect(list[0]).toMatchObject({ memberCount: 0, openCount: 0, changed: false });
    // Adding a member bumps updated_at → first, and marks it changed.
    await query(`UPDATE influencer_groups SET updated_at = now() - interval '1 hour', created_at = now() - interval '1 hour' WHERE id = $1`, [older]);
    await api.post(`/brands/me/influencer-groups/${older}/members`, b.token, { influencer_ids: [] }).catch(() => {});
    const c6 = await creator();
    await api.post(`/brands/me/influencer-groups/${older}/members`, b.token, { influencer_ids: [c6.influencerId] });
    list = (await api.get('/brands/me/influencer-groups', b.token)).body.data.groups;
    expect(list[0].id).toBe(older);
    expect(list[0].changed).toBe(true);
    // Superset for the website: the old keys are still there.
    expect(list[0].members).toBeDefined();
    expect(list[0].influencer_ids).toBeDefined();
    expect(list[0].member_count).toBe(6);
  });

  it('GET/PUT for-creator: which groups she is in, capacity per group, and the added/removed diff', async () => {
    const b = await brand();
    const c = await creator();
    const a = (await create(b, 'A', [c.influencerId])).body.data.group.id;
    const bb = (await create(b, 'B')).body.data.group.id;
    let r = await api.get(`/brands/me/influencer-groups/for-creator/${c.influencerId}`, b.token);
    expect(r.status).toBe(200);
    const by = Object.fromEntries(r.body.data.groups.map(g => [g.id, g]));
    expect(by[a]).toMatchObject({ name: 'A', memberCount: 1, contains: true, capacityLeft: 99 });
    expect(by[bb]).toMatchObject({ name: 'B', memberCount: 0, contains: false, capacityLeft: 100 });
    r = await api.put(`/brands/me/influencer-groups/for-creator/${c.influencerId}`, b.token, { groupIds: [bb] });
    expect(r.status).toBe(200);
    expect(r.body.data.added.map(g => g.name)).toEqual(['B']);
    expect(r.body.data.removed.map(g => g.name)).toEqual(['A']);
    const prof = await api.get(`/influencers/${c.influencerId}`, b.token);
    expect(prof.body.data.groups.map(g => g.name)).toEqual(['B']);
    // A pending creator cannot be put into a group.
    const pend = await creator({ status: 'pending' });
    expect((await api.put(`/brands/me/influencer-groups/for-creator/${pend.influencerId}`, b.token, { groupIds: [bb] })).status).toBe(422);
  });
});
