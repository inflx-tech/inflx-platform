'use strict';

/**
 * Item 4 — campaigns and sets against the real database: the §7 messages, the seven-day rule,
 * the calculated cutoff, the lock, the two delete rules, duplicate (settings only), the counts,
 * the cross-set fix, the invite refusals, the expiry job in both directions and its idempotency,
 * 404 for another brand on the new endpoints, and the branch-in-use refusal.
 * Contract: features/item4-campaigns-sets · prompt §12.1 checks 2–17, 20 · APPROVAL.md checks 21–24, 26
 */

const { truncateAll } = require('./helpers/db');
const { query, brand, creator, api, resetReference } = require('./helpers/item3');
const { MSG, longDate } = require('../src/services/campaignCopy');
const state = require('../src/services/campaignState.service');
const setShape = require('../src/services/setShape.model');
const setExpiry = require('../src/jobs/set-expiry.job');
const { todayInIndia, addDays, calendarDay } = require('../src/utils/indiaDay');
// Raw DATE columns arrive as instants (local midnight); read them as India calendar days, never by slicing.
const dayOf = (v) => (v == null ? null : calendarDay(v instanceof Date ? v : new Date(v)));

beforeEach(async () => { await truncateAll(); await resetReference(); });

const today = () => todayInIndia();
const day = (n) => addDays(today(), n);
const branchOf = async (brandId) => (await query(`SELECT id, city_id FROM brand_branches WHERE brand_id = $1 AND is_main ORDER BY created_at LIMIT 1`, [brandId])).rows[0];

async function campaign(b, over = {}) {
  const r = await api.post('/campaigns', b.token, { name: 'Diwali Edit 2026', ...over });
  if (r.status !== 201) throw new Error(`campaign: ${JSON.stringify(r.body)}`);
  return r.body.data.campaign;
}
async function set(b, campaignId, over = {}) {
  const body = { name: 'Set A · Ethnic wear', goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(10), ...over };
  const r = await api.post(`/campaigns/${campaignId}/sets`, b.token, body);
  if (r.status !== 201) throw new Error(`set: ${JSON.stringify(r.body)}`);
  return r.body.data.set;
}
const inviteRow = async (setId, influencerId, status = 'invited') =>
  (await query(`INSERT INTO campaign_influencers (set_id, influencer_id, status) VALUES ($1,$2,$3) RETURNING id`, [setId, influencerId, status])).rows[0].id;
const signBoth = (ciId) => query(
  `INSERT INTO contracts (campaign_influencer_id, influencer_fee, status, influencer_signed_at, brand_signed_at) VALUES ($1, 1000, 'active', now(), now())`, [ciId]);
const setRow = async (id) => (await query(`SELECT * FROM campaign_sets WHERE id = $1`, [id])).rows[0];

describe('rules on the server: the exact §7 messages', () => {
  it('campaign: name required and ≤ 60, description ≤ 200; a group it started from is remembered (check 2, 15)', async () => {
    const b = await brand();
    let r = await api.post('/campaigns', b.token, { name: '   ' });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.CAMPAIGN_NAME); expect(r.body.error.field).toBe('name');
    r = await api.post('/campaigns', b.token, { name: 'x'.repeat(61) });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.CAMPAIGN_NAME);
    r = await api.post('/campaigns', b.token, { name: 'Diwali', brief: 'y'.repeat(201) });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.CAMPAIGN_DESC_LONG); expect(r.body.error.field).toBe('brief');
    r = await api.post('/campaigns', b.token, { name: 'Diwali' });
    expect(r.status).toBe(201);
    expect(r.body.data.campaign.status).toBe('draft');
    expect(r.body.data.dateRules).toMatchObject({ minDaysAhead: 7, cutoffDaysBefore: 3, earliestPostingDate: day(7) });

    const g = await api.post('/brands/me/influencer-groups', b.token, { name: 'Diwali shortlist' });
    expect(g.status).toBe(201);
    const gid = g.body.data.group ? g.body.data.group.id : g.body.data.id;
    r = await api.post('/campaigns', b.token, { name: 'From group', started_from_group_id: gid });
    expect(r.status).toBe(201);
    const s = await api.get(`/campaigns/${r.body.data.campaign.id}/summary`, b.token);
    expect(s.body.data.campaign.startedFromGroup).toEqual({ id: gid, name: 'Diwali shortlist' });
    // another brand's group cannot be named
    const other = await brand();
    r = await api.post('/campaigns', other.token, { name: 'Steal', started_from_group_id: gid });
    expect(r.status).toBe(404);
  });

  it('set: name, Aim, mode, branch for Store Visit, posting date; seven days; the cutoff is calculated (checks 3, 4, 5)', async () => {
    const b = await brand();
    const c = await campaign(b);
    const post = (body) => api.post(`/campaigns/${c.id}/sets`, b.token, body);
    const good = { name: 'Set A', goal: 'conversion', shoot_mode: 'shipment', go_live_date: day(10) };
    let r = await post({ ...good, name: '' });        expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.SET_NAME);
    r = await post({ ...good, name: 'x'.repeat(61) }); expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.SET_NAME);
    r = await post({ ...good, goal: undefined });      expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.AIM);
    r = await post({ ...good, shoot_mode: undefined }); expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.MODE);
    r = await post({ ...good, shoot_mode: 'remote' }); expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.MODE);
    r = await post({ ...good, shoot_mode: 'visit' });  expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.BRANCH);
    r = await post({ ...good, go_live_date: undefined }); expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.DATE);
    // a date sent straight to the API, earlier than allowed, is refused (check 5)
    r = await post({ ...good, go_live_date: day(6) }); expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.DATE_TOO_SOON); expect(r.body.error.field).toBe('go_live_date');
    expect(setShape.MIN_DAYS_TO_GO_LIVE).toBe(7);
    r = await post({ ...good, go_live_date: day(7) }); expect(r.status).toBe(201);
    expect(r.body.data.cutoff).toBe(day(4));
    expect(dayOf(r.body.data.set.invites_close_at)).toBe(day(4));
    expect(r.body.data.set.branch_id).toBeNull();
    // a client-sent cutoff is ignored, the calculated one wins
    r = await post({ ...good, name: 'Set B', go_live_date: day(20), invites_close_at: day(19) });
    expect(r.status).toBe(201); expect(r.body.data.cutoff).toBe(day(17));
    // Store Visit with this brand's branch
    const br = await branchOf(b.brandId);
    r = await post({ ...good, name: 'Set C', shoot_mode: 'visit', branch_id: br.id });
    expect(r.status).toBe(201); expect(r.body.data.set.branch_id).toBe(br.id);
    // another brand's branch is refused
    const other = await brand();
    const obr = await branchOf(other.brandId);
    r = await post({ ...good, name: 'Set D', shoot_mode: 'visit', branch_id: obr.id });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.BRANCH);
  });
});

describe('locks, deletes and duplicate', () => {
  it('after the first invitation Aim, date, mode and branch are refused with the exact message; rename still works (check 7)', async () => {
    const b = await brand(); const c = await campaign(b); const s = await set(b, c.id);
    const cr = await creator();
    const patch = (body) => api.patch(`/campaigns/${c.id}/sets/${s.id}`, b.token, body);
    // draft: everything changes
    let r = await patch({ goal: 'engagement', go_live_date: day(12) }); expect(r.status).toBe(200);
    expect(dayOf(r.body.data.set.invites_close_at)).toBe(day(9));
    await inviteRow(s.id, cr.influencerId);
    for (const body of [{ goal: 'hybrid' }, { go_live_date: day(15) }, { shoot_mode: 'visit', branch_id: (await branchOf(b.brandId)).id }, { invites_close_at: day(1) }]) {
      r = await patch(body);
      expect(r.status).toBe(422); expect(r.body.error.code).toBe('LOCKED'); expect(r.body.error.message).toBe(MSG.LOCKED);
    }
    // sending the locked fields back UNCHANGED is not a change
    r = await patch({ name: 'Set A · renamed', goal: 'engagement', go_live_date: day(12), shoot_mode: 'shipment' });
    expect(r.status).toBe(200); expect(r.body.data.set.name).toBe('Set A · renamed');
    const sum = await api.get(`/campaigns/${c.id}/sets/${s.id}/summary`, b.token);
    expect(sum.body.data.set.locked).toBe(true);
    expect(sum.body.data.set.lockedFields).toEqual(expect.arrayContaining(['goal', 'go_live_date', 'shoot_mode', 'branch_id']));
  });

  it('a draft set and its campaign can be deleted; with any invitation neither can, and no contract is ever destroyed (checks 6, 8, 23)', async () => {
    const b = await brand(); const c = await campaign(b); const s1 = await set(b, c.id); const s2 = await set(b, c.id, { name: 'Set B' });
    let r = await api.del(`/campaigns/${c.id}/sets/${s2.id}`, b.token); expect(r.status).toBe(200);
    const cr = await creator();
    const ci = await inviteRow(s1.id, cr.influencerId, 'contracted'); await signBoth(ci);
    r = await api.del(`/campaigns/${c.id}/sets/${s1.id}`, b.token);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.DELETE_SET);
    r = await api.del(`/campaigns/${c.id}`, b.token);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.DELETE_CAMPAIGN);
    expect((await query(`SELECT count(*)::int n FROM contracts`)).rows[0].n).toBe(1);
    // a set whose creator DECLINED still counts as "has invitations": it stays
    await query(`UPDATE campaign_influencers SET status = 'declined' WHERE id = $1`, [ci]);
    r = await api.del(`/campaigns/${c.id}/sets/${s1.id}`, b.token); expect(r.status).toBe(422);
    // an empty draft campaign deletes cleanly
    const c2 = await campaign(b, { name: 'Empty' });
    r = await api.del(`/campaigns/${c2.id}`, b.token); expect(r.status).toBe(200);
  });

  it('duplicate copies Aim, mode, branch and channels into a new dated draft; never creators; unique name; rollup recomputed (checks 14, 26)', async () => {
    const b = await brand(); const c = await campaign(b);
    const br = await branchOf(b.brandId);
    const s = await set(b, c.id, { name: 'Set A · Ethnic wear', goal: 'conversion', shoot_mode: 'visit', branch_id: br.id, channels_json: { instagram: ['reel'] } });
    const cr = await creator();
    await inviteRow(s.id, cr.influencerId, 'contracted');
    let r = await api.post(`/campaigns/${c.id}/sets/${s.id}/duplicate`, b.token, {});
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.DATE);
    r = await api.post(`/campaigns/${c.id}/sets/${s.id}/duplicate`, b.token, { go_live_date: day(3) });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.DATE_TOO_SOON);
    r = await api.post(`/campaigns/${c.id}/sets/${s.id}/duplicate`, b.token, { name: 'Set A · Ethnic wear (copy)', go_live_date: day(30) });
    expect(r.status).toBe(201);
    const d = r.body.data.set;
    expect(d).toMatchObject({ name: 'Set A · Ethnic wear (copy)', goal: 'conversion', shoot_mode: 'visit', branch_id: br.id, campaign_id: c.id });
    expect(d.channels_json).toEqual({ instagram: ['reel'] });
    expect(dayOf(d.go_live_date)).toBe(day(30)); expect(r.body.data.cutoff).toBe(day(27));
    expect(r.body.data.campaign_derived).toBeDefined();
    expect((await query(`SELECT count(*)::int n FROM campaign_influencers WHERE set_id = $1`, [d.id])).rows[0].n).toBe(0);
    // no name → "(copy)" is taken, so "(copy 2)"; an explicit duplicate name is refused
    r = await api.post(`/campaigns/${c.id}/sets/${s.id}/duplicate`, b.token, { go_live_date: day(30) });
    expect(r.status).toBe(201); expect(r.body.data.set.name).toBe('Set A · Ethnic wear (copy 2)');
    r = await api.post(`/campaigns/${c.id}/sets/${s.id}/duplicate`, b.token, { name: 'Set A · Ethnic wear (copy)', go_live_date: day(30) });
    expect(r.status).toBe(409);
    // the letter rule never reuses a letter after a delete
    expect(state.nextSetLetterName(['Set A', 'Set C', 'Other'])).toBe('Set D');
    expect(state.nextSetLetterName([])).toBe('Set A');
    const sum = await api.get(`/campaigns/${c.id}/sets/${d.id}/summary`, b.token);
    expect(sum.body.data.set.state).toBe('draft'); expect(sum.body.data.set.branch.name).toBeTruthy();
  });
});

describe('counts, states and the two lists', () => {
  it('invited counts everyone; signed = both signatures; accepted is waiting; declined+expired shown; campaign and list roll up (checks 9, 21)', async () => {
    const b = await brand(); const c = await campaign(b); const s = await set(b, c.id);
    const cs = await Promise.all([creator(), creator(), creator(), creator(), creator()]);
    await signBoth(await inviteRow(s.id, cs[0].influencerId, 'contracted'));
    await signBoth(await inviteRow(s.id, cs[1].influencerId, 'active'));
    await inviteRow(s.id, cs[2].influencerId, 'accepted');
    await inviteRow(s.id, cs[3].influencerId, 'invited');
    await inviteRow(s.id, cs[4].influencerId, 'declined');
    const want = { invited: 5, signed: 2, waiting: 2, declined: 1 };
    const sum = await api.get(`/campaigns/${c.id}/sets/${s.id}/summary`, b.token);
    expect(sum.status).toBe(200); expect(sum.body.data.set.counts).toEqual(want); expect(sum.body.data.set.state).toBe('live');
    expect(sum.body.data.set.cutoff).toBe(day(7)); expect(sum.body.data.set.daysToCutoff).toBe(7);
    expect(sum.body.data.set.canInvite.ok).toBe(true);
    const cam = await api.get(`/campaigns/${c.id}/summary`, b.token);
    expect(cam.body.data.campaign.counts).toEqual(want); expect(cam.body.data.campaign.state).toBe('live');
    expect(cam.body.data.sets.current).toHaveLength(1); expect(cam.body.data.sets.past).toHaveLength(0);
    expect(cam.body.data.dateRules.earliestPostingDate).toBe(day(7));
    const list = await api.get('/campaigns/summary?state=live', b.token);
    expect(list.body.data.campaigns).toHaveLength(1);
    expect(list.body.data.campaigns[0]).toMatchObject({ id: c.id, state: 'live', setCount: 1, nextPostingDate: day(10), counts: want });
    expect(list.body.data.tabs).toEqual({ live: 1, draft: 0, past: 0 });
    // a draft campaign shows under Drafts with no invitations
    const c2 = await campaign(b, { name: 'Festive Jewellery' }); await set(b, c2.id);
    const drafts = await api.get('/campaigns/summary?state=draft', b.token);
    expect(drafts.body.data.campaigns.map(x => x.name)).toEqual(['Festive Jewellery']);
    expect(drafts.body.data.campaigns[0].counts.invited).toBe(0);
  });

  it('a draft whose date passed is flagged and refuses invites; Completed is the stand-in rule (checks 13, 12)', async () => {
    const b = await brand(); const c = await campaign(b); const s = await set(b, c.id, { goal: 'engagement' });
    await query(`UPDATE campaign_sets SET go_live_date = $2, invites_close_at = $3 WHERE id = $1`, [s.id, day(-1), day(-4)]);
    const sum = await api.get(`/campaigns/${c.id}/sets/${s.id}/summary`, b.token);
    expect(sum.body.data.set).toMatchObject({ state: 'draft', datePassed: true });
    expect(sum.body.data.set.canInvite).toEqual({ ok: false, reason: 'date_passed', message: MSG.INVITE_DATE_PASSED });
    const cr = await creator();
    let r = await api.post(`/campaigns/${c.id}/sets/${s.id}/invite`, b.token, { influencer_id: cr.influencerId, agreed_fee: 5000 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.INVITE_DATE_PASSED);
    // choose a new date → inviting works again
    r = await api.patch(`/campaigns/${c.id}/sets/${s.id}`, b.token, { go_live_date: day(10) }); expect(r.status).toBe(200);
    // Completed: every creator row terminal
    const ci = await inviteRow(s.id, cr.influencerId, 'completed');
    let st = await api.get(`/campaigns/${c.id}/sets/${s.id}/summary`, b.token);
    expect(st.body.data.set.state).toBe('completed'); expect(st.body.data.set.isPast).toBe(true);
    const cam = await api.get(`/campaigns/${c.id}/summary`, b.token);
    expect(cam.body.data.campaign.state).toBe('completed'); expect(cam.body.data.sets.past).toHaveLength(1);
    expect((await api.get('/campaigns/summary?state=past', b.token)).body.data.campaigns).toHaveLength(1);
    // one row still waiting → live again
    await query(`UPDATE campaign_influencers SET status = 'accepted' WHERE id = $1`, [ci]);
    st = await api.get(`/campaigns/${c.id}/sets/${s.id}/summary`, b.token);
    expect(st.body.data.set.state).toBe('live');
  });

  it('the same creator may be in several sets of one campaign; only a LIVE row in THIS set refuses her (check 22, rules v1.21 §148 §268)', async () => {
    /**
     * ⚠️ REWRITTEN 2026-09-17. This test used to assert the opposite of the rules.
     *
     * It required a 409 when a creator live in Set A was invited to Set B. Rules v1.21:
     *   §148 "The same Creator may belong to multiple Sets within the same Campaign, for
     *         example for different Aims or different negotiated arrangements."
     *   §268 "A Creator who is live in this Set cannot be chosen again. A Creator whose earlier
     *         invitation ended … may be invited again, to this Set or to another Set of the
     *         same Campaign, while there is still time."
     *
     * The founder hit the real thing at Review and send: a Pay for Sale set refused because the
     * creator was already on a Pay for Content set of the same campaign — the exact case §148
     * names as allowed. The campaign-wide block was legacy, never in the rules; item 4 only
     * narrowed it (APPROVAL Q6 excluded the dead statuses) rather than questioning it.
     *
     * So this now asserts BOTH halves of §268, where it used to assert one and get it backwards.
     */
    const b = await brand(); const c = await campaign(b);
    const a = await set(b, c.id, { name: 'Set A', goal: 'engagement' }); const s2 = await set(b, c.id, { name: 'Set B', goal: 'engagement' });
    const cr = await creator();
    const invite = (setId) => api.post(`/campaigns/${c.id}/sets/${setId}/invite`, b.token, { influencer_id: cr.influencerId, agreed_fee: 5000 });

    // Live in Set A, invited to Set B — ALLOWED. §148.
    const rowA = await inviteRow(a.id, cr.influencerId, 'invited');
    let r = await invite(s2.id);
    expect([201, 403]).toContain(r.status);   // 403 only if her own settings refuse
    expect(r.status).not.toBe(409);

    // Live in Set B, invited to Set B again — REFUSED. §268, first sentence.
    await query(`DELETE FROM campaign_influencers WHERE set_id = $1`, [s2.id]);
    await inviteRow(s2.id, cr.influencerId, 'invited');
    r = await invite(s2.id);
    expect(r.status).toBe(409);

    // An ended row in Set A never blocked Set B, and still does not.
    for (const st of ['declined', 'expired', 'deferred', 'rejected_by_brand', 'slots_filled']) {
      await query(`UPDATE campaign_influencers SET status = $2 WHERE id = $1`, [rowA, st]);
      await query(`DELETE FROM campaign_influencers WHERE set_id = $1`, [s2.id]);
      r = await invite(s2.id);
      expect([201, 403]).toContain(r.status);
      expect(r.status).not.toBe(409);
    }
  });

  it('invitations after the cutoff are refused with the date (check 7 rules §25)', async () => {
    const b = await brand(); const c = await campaign(b); const s = await set(b, c.id, { goal: 'engagement' });
    await query(`UPDATE campaign_sets SET go_live_date = $2, invites_close_at = $3 WHERE id = $1`, [s.id, day(2), day(-1)]);
    const cr = await creator();
    const r = await api.post(`/campaigns/${c.id}/sets/${s.id}/invite`, b.token, { influencer_id: cr.influencerId, agreed_fee: 5000 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.INVITE_CLOSED(day(-1)));
    expect(MSG.INVITE_CLOSED('2026-10-17')).toBe('Invitations for this set closed on 17 Oct 2026.');
    expect(longDate('2026-01-05')).toBe('5 Jan 2026');
  });
});

describe('the expiry job', () => {
  it('nobody signed by the cutoff → set expired, open invitations expired, creators see them so; idempotent (checks 10, 12)', async () => {
    const b = await brand(); const c = await campaign(b); const s = await set(b, c.id);
    const cs = await Promise.all([creator(), creator(), creator()]);
    const r1 = await inviteRow(s.id, cs[0].influencerId, 'invited');
    const r2 = await inviteRow(s.id, cs[1].influencerId, 'accepted');
    const r3 = await inviteRow(s.id, cs[2].influencerId, 'declined');
    // not due yet: cutoff is day(7)
    let out = await setExpiry.run();
    expect(out).toMatchObject({ checked: 0, expired: 0 });
    // move the posting date so the cutoff day ended yesterday
    await query(`UPDATE campaign_sets SET go_live_date = $2, invites_close_at = $3 WHERE id = $1`, [s.id, day(2), day(-1)]);
    out = await setExpiry.run();
    expect(out).toMatchObject({ checked: 1, expired: 1, kept: 0, invitationsClosed: 2 });
    const row = await setRow(s.id); expect(row.expired_at).toBeTruthy();
    const statuses = (await query(`SELECT id, status FROM campaign_influencers WHERE set_id = $1`, [s.id])).rows.reduce((m, x) => ({ ...m, [x.id]: x.status }), {});
    expect(statuses).toEqual({ [r1]: 'expired', [r2]: 'expired', [r3]: 'declined' });
    // creator-facing: her invitation reads as expired
    const mine = await api.get('/influencers/me/offers', cs[0].token);
    if (mine.status === 200) {
      const list = mine.body.data.offers || mine.body.data.items || mine.body.data || [];
      const hit = (Array.isArray(list) ? list : []).find(o => o.id === r1 || o.campaign_influencer_id === r1);
      if (hit) expect(hit.status).toBe('expired');
    }
    // the screens: Expired, under past, cutoff message
    const sum = await api.get(`/campaigns/${c.id}/sets/${s.id}/summary`, b.token);
    expect(sum.body.data.set.state).toBe('expired'); expect(sum.body.data.set.counts.declined).toBe(3);
    expect(sum.body.data.set.canInvite.ok).toBe(false);
    const cam = await api.get(`/campaigns/${c.id}/summary`, b.token);
    expect(cam.body.data.campaign.state).toBe('expired'); expect(cam.body.data.sets.past).toHaveLength(1);
    expect((await api.get('/campaigns/summary?state=past', b.token)).body.data.tabs).toEqual({ live: 0, draft: 0, past: 1 });
    // second run: nothing to do, nothing changes
    const before = await setRow(s.id);
    out = await setExpiry.run();
    expect(out).toMatchObject({ checked: 0, expired: 0, invitationsClosed: 0 });
    expect((await setRow(s.id)).expired_at.getTime()).toBe(before.expired_at.getTime());
  });

  it('one creator signed → the set stays live and only unanswered invitations are left to the offer clock (check 11)', async () => {
    const b = await brand(); const c = await campaign(b); const s = await set(b, c.id);
    const cs = await Promise.all([creator(), creator()]);
    await signBoth(await inviteRow(s.id, cs[0].influencerId, 'contracted'));
    const open = await inviteRow(s.id, cs[1].influencerId, 'invited');
    await query(`UPDATE campaign_sets SET go_live_date = $2, invites_close_at = $3 WHERE id = $1`, [s.id, day(2), day(-1)]);
    const out = await setExpiry.run();
    expect(out).toMatchObject({ checked: 1, expired: 0, kept: 1, invitationsClosed: 0 });
    expect((await setRow(s.id)).expired_at).toBeNull();
    expect((await query(`SELECT status FROM campaign_influencers WHERE id = $1`, [open])).rows[0].status).toBe('invited');
    const sum = await api.get(`/campaigns/${c.id}/sets/${s.id}/summary`, b.token);
    expect(sum.body.data.set.state).toBe('live');
    // a set without a date (built before item 4) is never expired
    const legacy = (await query(`INSERT INTO campaign_sets (campaign_id, name, goal) VALUES ($1, 'Legacy', 'conversion') RETURNING id`, [c.id])).rows[0];
    await inviteRow(legacy.id, cs[1].influencerId, 'invited');
    expect((await setExpiry.run()).checked).toBe(1);
    expect((await setRow(legacy.id)).expired_at).toBeNull();
  });
});

describe('privacy and branches', () => {
  it('another brand gets 404 on the three new endpoints and 403 on the old ones; creators never see drafts or descriptions (checks 16, 17)', async () => {
    const b = await brand(); const other = await brand();
    const c = await campaign(b, { brief: 'Only my team sees this' }); const s = await set(b, c.id);
    for (const p of [`/campaigns/${c.id}/summary`, `/campaigns/${c.id}/sets/${s.id}/summary`]) {
      const r = await api.get(p, other.token); expect(r.status).toBe(404);
    }
    expect((await api.get(`/campaigns/${c.id}`, other.token)).status).toBe(403);
    expect((await api.get(`/campaigns/${c.id}/summary`, b.token)).status).toBe(200);
    expect((await api.get('/campaigns/summary', other.token)).body.data.campaigns).toHaveLength(0);
    // a creator cannot read any of it
    const cr = await creator();
    for (const p of ['/campaigns/summary', `/campaigns/${c.id}/summary`]) {
      expect([401, 403]).toContain((await api.get(p, cr.token)).status);
    }
  });

  it('a branch a set still names cannot be removed, with a readable message (check 24)', async () => {
    const b = await brand(); const c = await campaign(b);
    const main = await branchOf(b.brandId);
    const second = (await query(
      `INSERT INTO brand_branches (brand_id, name, city_id, state_id, is_main) SELECT $1, 'Banjara Hills', city_id, state_id, false FROM brand_branches WHERE id = $2 RETURNING id`,
      [b.brandId, main.id])).rows[0];
    await set(b, c.id, { shoot_mode: 'visit', branch_id: second.id });
    let r = await api.del(`/brands/me/branches/${second.id}`, b.token);
    expect(r.status).toBe(422); expect(r.body.error.code).toBe('BRANCH_IN_USE'); expect(r.body.error.message).toBe(MSG.BRANCH_IN_USE);
    expect((await query(`SELECT count(*)::int n FROM brand_branches WHERE id = $1`, [second.id])).rows[0].n).toBe(1);
  });
});
