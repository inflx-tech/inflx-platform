'use strict';

/**
 * Item 5 — choosing creators, terms and invitations, against the real database: the §7
 * messages per Aim, the all-or-nothing send, the derived lock, withdraw and remove, the
 * grouped set, the creator's list / detail / accept / decline, privacy, deferred, the two
 * offer fixes, and 404 for another brand or creator on every new endpoint.
 * Contract: features/item5-invitations · PROMPT.md §12.1 · APPROVAL.md §5 (checks 36–42)
 */

const { truncateAll } = require('./helpers/db');
const { query, brand, creator, api, resetReference, setCreatorInvite, product } = require('./helpers/item3');
const { MSG, DECLINE_REASONS, declineLabel } = require('../src/services/invitationCopy');
const { validateTerms } = require('../src/services/invitationTerms.service');
const state = require('../src/services/campaignState.service');
const setExpiry = require('../src/jobs/set-expiry.job');
const offerResolution = require('../src/services/offerResolution.service');
const txnService = require('../src/services/transaction.service');
const { MIN_SHOPPABLE_POSTS } = require('../src/config/platformRules');
const { todayInIndia, addDays } = require('../src/utils/indiaDay');

beforeEach(async () => { await truncateAll(); await resetReference(); });

const today = () => todayInIndia();
const day = (n) => addDays(today(), n);
const LEAK = /brief|total_budget|set_budget|per_influencer_budget|coupon_prefix|source_group|sourceGroup|invited_by|invitedBy|warnings|minimums|formatted_address|street/i;

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
/** A brand with one campaign and one set of the given Aim. */
async function world(goal = 'conversion', setOver = {}) {
  const b = await brand();
  const c = await campaign(b);
  const s = await set(b, c.id, { goal, ...setOver });
  return { b, c, s, url: `/campaigns/${c.id}/sets/${s.id}` };
}
const SALE = { commissionPct: 10, scope: 'store' };
const CONTENT = { fee: 8000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] };
// creator-terms-v2: selling terms become offers + products without offers (helpers/sell.js).
const send = async (w, creators, extra = {}) => api.post(`${w.url}/invitations`, w.b.token, {
  creators: await Promise.all(creators.map(async (c) => ({ ...c, terms: await require('./helpers/sell').sellable(w.b.brandId, c.terms) }))), ...extra });
const one = (cr, terms = SALE, extra = {}) => ({ influencerId: cr.influencerId, terms, ...extra });
const notifs = async (userId) => (await query(`SELECT type, title, body FROM notifications WHERE user_id = $1 ORDER BY created_at`, [userId])).rows;
const ciRow = async (id) => (await query(`SELECT * FROM campaign_influencers WHERE id = $1`, [id])).rows[0];
const signBoth = (ciId) => query(`INSERT INTO contracts (campaign_influencer_id, influencer_fee, status, influencer_signed_at, brand_signed_at) VALUES ($1, 1000, 'active', now(), now())`, [ciId]);
const draftContract = (ciId) => query(`INSERT INTO contracts (campaign_influencer_id, influencer_fee, status) VALUES ($1, 1000, 'draft')`, [ciId]);
const moveSetTo = (setId, postingDay) => query(`UPDATE campaign_sets SET go_live_date = $2, invites_close_at = $3 WHERE id = $1`, [setId, postingDay, state.cutoffFor(postingDay)]);

/* ───────────────────────────────────────────────── the terms rules (unit) */

describe('the terms validator — every §7 message, per Aim (checks 6–9, 41)', () => {
  const bad = (goal, terms, message, field) => {
    let err = null;
    try { validateTerms(goal, terms); } catch (e) { err = e; }
    expect(err && err.message).toBe(message);
    if (field) expect(err.field).toBe(field);
  };
  it('Pay for Sale: commission required, 0 < x ≤ 100, one decimal; scope lists must not be empty', () => {
    bad('conversion', {}, MSG.COMMISSION_REQUIRED, 'commission_pct');
    bad('conversion', { commissionPct: 'abc' }, MSG.COMMISSION_REQUIRED);
    bad('conversion', { commissionPct: 0 }, MSG.COMMISSION_RANGE);
    bad('conversion', { commissionPct: 100.1 }, MSG.COMMISSION_RANGE);
    bad('conversion', { commissionPct: 10, scope: 'category' }, MSG.SCOPE_CATEGORIES, 'alloc_category_node_id');
    bad('conversion', { commissionPct: 10, scope: 'products', productIds: [] }, MSG.SCOPE_PRODUCTS, 'alloc_product_ids');
    const t = validateTerms('conversion', { commissionPct: 12.34, deliverables: [{ type: 'reel', count: 1 }], fee: 5000 });
    expect(t.commissionPct).toBe(12.3);
    expect(t.scope).toBe('store');
    expect(t.fee).toBeNull();          // Pay for Sale has no fee
    expect(t.deliverables).toBeNull(); // and no content package
    // above 50 is accepted by the server (the app asks once; check 41)
    expect(validateTerms('conversion', { commissionPct: 60 }).commissionPct).toBe(60);
    expect(validateTerms('conversion', { commissionPct: 100 }).commissionPct).toBe(100);
  });
  it('Pay for Content: fee whole rupees > 0; deliverables ≥ 1, 1–20, no duplicate type; note ≤ 300; usage rights need a place', () => {
    bad('engagement', {}, MSG.FEE_REQUIRED, 'agreed_fee');
    bad('engagement', { fee: 0 }, MSG.FEE_REQUIRED);
    bad('engagement', { fee: 8000.5 }, MSG.FEE_REQUIRED);
    bad('engagement', { fee: 8000 }, MSG.DELIVERABLES_EMPTY, 'formats_json');
    bad('engagement', { fee: 8000, deliverables: [] }, MSG.DELIVERABLES_EMPTY);
    bad('engagement', { fee: 8000, deliverables: [{ type: 'reel', count: 0 }] }, MSG.DELIVERABLE_COUNT);
    bad('engagement', { fee: 8000, deliverables: [{ type: 'reel', count: 21 }] }, MSG.DELIVERABLE_COUNT);
    bad('engagement', { fee: 8000, deliverables: [{ type: 'reel', count: 1 }, { type: 'reel', count: 2 }] }, MSG.DELIVERABLE_DUP);
    bad('engagement', { ...CONTENT, note: 'x'.repeat(301) }, MSG.NOTE_LONG, 'brand_note');
    bad('engagement', { ...CONTENT, usageRights: { on: true, durationDays: 60, places: [] } }, MSG.USAGE_PLACE, 'usage_rights_json');
    bad('engagement', { ...CONTENT, usageRights: { on: true, durationDays: 45, places: ['ads'] } }, MSG.USAGE_PLACE);
    const t = validateTerms('engagement', { ...CONTENT, note: '  Loved your reels  ', usageRights: { on: true, durationDays: null, places: ['social', 'ads'] }, commissionPct: 10 });
    expect(t.fee).toBe(8000);
    expect(t.deliverables).toEqual([{ type: 'reel', count: 1 }, { type: 'story', count: 2 }]);
    expect(t.note).toBe('Loved your reels');
    expect(t.usageRights).toEqual({ on: true, duration_days: null, places: ['social', 'ads'] });
    expect(t.commissionPct).toBeNull();
    expect(validateTerms('engagement', { ...CONTENT, usageRights: { on: false } }).usageRights).toBeNull();
  });
  it('Hybrid: a fixed fee that is never ₹0, plus everything for Pay for Sale, no content package', () => {
    bad('hybrid', { commissionPct: 10 }, MSG.HYBRID_FEE, 'agreed_fee');
    bad('hybrid', { commissionPct: 10, fee: 0 }, MSG.HYBRID_FEE);
    bad('hybrid', { fee: 5000 }, MSG.COMMISSION_REQUIRED);
    const t = validateTerms('hybrid', { fee: 5000, commissionPct: 10, deliverables: [{ type: 'reel', count: 1 }], usageRights: { on: true, durationDays: 30, places: ['ads'] } });
    expect(t).toMatchObject({ fee: 5000, commissionPct: 10, scope: 'store', deliverables: null, usageRights: null });
  });
  it('the legacy brief door holds what is present to the rules and does not demand what is absent', () => {
    expect(validateTerms('conversion', {}, { mode: 'legacy' }).commissionPct).toBeNull();
    expect(validateTerms('engagement', { agreed_fee: 6000 }, { mode: 'legacy' })).toMatchObject({ fee: 6000, deliverables: null });
    bad('conversion', { commission_pct: 140 }, MSG.COMMISSION_RANGE);
    let err = null; try { validateTerms('conversion', { commission_pct: 140 }, { mode: 'legacy' }); } catch (e) { err = e; }
    expect(err && err.message).toBe(MSG.COMMISSION_RANGE);
  });
});

/* ────────────────────────────────────────────────────────── the send */

describe('sending — one action, all or nothing (checks 17, 18, 20, 38)', () => {
  it('sends n rows, notifies n creators, stamps invited_at / invited_by / source, and the set goes live and locked', async () => {
    const w = await world('conversion');
    const [p, s2, d] = [await creator({ name: 'Priya Sharma' }), await creator({ name: 'Sneha N.' }), await creator({ name: 'Divya R.' })];
    const r = await send(w, [one(p), one(s2, { commissionPct: 12, scope: 'store' }), one(d, { commissionPct: 10, scope: 'store' }, { note: 'Loved your Diwali reels.' })]);
    expect(r.status).toBe(201);
    expect(r.body.data.sent).toBe(3);
    expect(r.body.data.rows.map(x => x.status)).toEqual(['invited', 'invited', 'invited']);
    expect(r.body.data.set.state).toBe('live');
    expect(r.body.data.set.locked).toBe(true);
    const rows = (await query(`SELECT * FROM campaign_influencers WHERE set_id = $1 ORDER BY created_at`, [w.s.id])).rows;
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.invited_at).toBeTruthy();
      expect(row.invited_by).toBe(w.b.userId);
      expect(row.source).toBe('brand_picker');
      expect(Number(row.commission_pct)).toBeGreaterThan(0);
      // creator-terms-v2 (rules 2.2): what she can sell is offers + products, never a store scope.
      expect(row.sell_v2).toBe(true);
      expect(row.alloc_scope).toBeNull();
    }
    expect(rows.find(x => x.influencer_id === d.influencerId).brand_note).toBe('Loved your Diwali reels.');
    for (const cr of [p, s2, d]) {
      const n = await notifs(cr.userId);
      expect(n.map(x => x.type)).toEqual(['offer.invited']);
      expect(n[0].body).toContain(w.s.name);
    }
    // the set is locked: Aim, date, mode refused
    const patch = await api.patch(w.url, w.b.token, { goal: 'engagement' });
    expect(patch.status).toBe(422); expect(patch.body.error.code).toBe('LOCKED');
    const summary = await api.get(`${w.url}/summary`, w.b.token);
    expect(summary.body.data.set).toMatchObject({ state: 'live', locked: true, counts: { invited: 3, signed: 0, waiting: 3, declined: 0 } });
    expect(summary.body.data.creators.groups.waiting.count).toBe(3);
  });

  it('when one creator cannot be invited, nothing is written and every failure is named', async () => {
    const w = await world('conversion');
    const ok = await creator({ name: 'Priya Sharma' });
    const paused = await creator({ name: 'Ritu V.' });
    await setCreatorInvite(paused.influencerId, { open: false });
    const noCommission = await creator({ name: 'Kavya D.' });
    const r = await send(w, [one(ok), one(paused), one(noCommission, { scope: 'store' })]);
    expect(r.status).toBe(422);
    expect(r.body.error.details.sent).toBe(0);
    const failures = r.body.error.details.failures;
    expect(failures.map(f => f.influencerId).sort()).toEqual([paused.influencerId, noCommission.influencerId].sort());
    // ui-walk-fixes, founder decision D2 (2 Oct 2026): the refusal says WHY, in the picker's
    // own words. It used to be MSG.INELIGIBLE('Ritu V.') — "Ritu V. can no longer be invited to
    // this set." (drift: features/ui-walk-fixes/06-diff/drift/SB.md)
    expect(failures.find(f => f.influencerId === paused.influencerId)).toMatchObject({
      code: 'NOT_ACCEPTING', field: 'influencer_id',
      message: "Ritu isn't taking invitations right now.", label: 'Not taking invitations', detail: 'not_accepting',
    });
    // a refusal that is not one of her invitation rules carries no reason line
    expect(failures.find(f => f.influencerId === noCommission.influencerId)).toMatchObject({ message: MSG.COMMISSION_REQUIRED, label: null, detail: null });
    expect((await query(`SELECT count(*)::int n FROM campaign_influencers WHERE set_id = $1`, [w.s.id])).rows[0].n).toBe(0);
    expect(await notifs(ok.userId)).toEqual([]);
    // "Remove {n} and send the rest" — the same request without the failed ones succeeds
    const again = await send(w, [one(ok)]);
    expect(again.status).toBe(201); expect(again.body.data.sent).toBe(1);
  });

  it('nobody picked; a live duplicate; a second brand\'s set is 404', async () => {
    const w = await world('conversion');
    const p = await creator({ name: 'Priya Sharma' });
    let r = await send(w, []);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.NOBODY_PICKED);
    r = await send(w, [one(p)]); expect(r.status).toBe(201);
    r = await send(w, [one(p)]);
    expect(r.status).toBe(422);
    expect(r.body.error.details.failures[0].message).toBe(MSG.DUPLICATE('Priya Sharma'));
    const other = await brand();
    r = await api.post(`${w.url}/invitations`, other.token, { creators: [one(p)] });
    expect(r.status).toBe(404);
    for (const path of [`${w.url}/pickable`, `${w.url}/eligibility`, `${w.url}/invitations/${r.body.id || '00000000-0000-0000-0000-000000000000'}`]) {
      const g = path.endsWith('eligibility') ? await api.post(path, other.token, { creators: [one(p)] }) : await api.get(path, other.token);
      expect(g.status).toBe(404);
    }
  });

  it('set-level refusals with the exact messages: no date, expired, date passed, cutoff passed (check 19)', async () => {
    const w = await world('conversion');
    const p = await creator();
    await query(`UPDATE campaign_sets SET go_live_date = NULL, invites_close_at = NULL WHERE id = $1`, [w.s.id]);
    let r = await send(w, [one(p)]);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.NO_DATE);
    await moveSetTo(w.s.id, day(-1));
    r = await send(w, [one(p)]);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.DATE_PASSED);
    await moveSetTo(w.s.id, day(2)); // cutoff = yesterday
    r = await send(w, [one(p)]);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.INVITE_CLOSED(day(-1)));
    await query(`UPDATE campaign_sets SET expired_at = now() WHERE id = $1`, [w.s.id]);
    r = await send(w, [one(p)]);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.SET_EXPIRED);
  });

  it('Pay for Content terms, usage rights and the note are stored; a special offer with "save to my offers" becomes a library row and a snapshot (checks 12–14)', async () => {
    const w = await world('engagement');
    const p = await creator({ name: 'Priya Sharma' });
    let r = await send(w, [one(p, { ...CONTENT, usageRights: { on: true, durationDays: 60, places: ['social', 'ads'] }, note: 'See you at the store.' })]);
    expect(r.status).toBe(201);
    const row = await ciRow(r.body.data.rows[0].id);
    expect(Number(row.agreed_fee)).toBe(8000);
    expect(row.formats_json).toEqual([{ type: 'reel', count: 1 }, { type: 'story', count: 2 }]);
    expect(row.usage_rights_json).toEqual({ on: true, duration_days: 60, places: ['social', 'ads'] });
    expect(row.brand_note).toBe('See you at the store.');

    // creator-terms-v2 (rules 1.13, 2.2): the special offer and "Also save to my offers" are retired.
    // A Hybrid invitation sent with one alongside the new terms stores offers + products only: no
    // library row is made and nothing is copied onto the invitation.
    const w2 = await world('hybrid');
    const pid = await product(w2.b.brandId, { price: 2400 });
    const libBefore = (await query(`SELECT count(*)::int n FROM brand_offers WHERE brand_id = $1`, [w2.b.brandId])).rows[0].n;
    r = await api.post(`${w2.url}/invitations`, w2.b.token, { creators: [{ influencerId: p.influencerId, terms: {
      fee: 5000, commissionPct: 10, productsWithoutOffers: { mode: 'chosen', productIds: [pid] },
      offer: { offerType: 'discount', offerConfigJson: { sub_type: 'pct', value: 12, scope: 'store' }, name: 'Festive 12', saveToLibrary: true } } }] });
    expect(r.status).toBe(201);
    const row2 = await ciRow(r.body.data.rows[0].id);
    expect(row2).toMatchObject({ sell_v2: true, sell_mode: 'chosen', sell_product_ids: [pid], brand_offer_id: null, offer_type: null, alloc_scope: null });
    expect((await query(`SELECT count(*)::int n FROM brand_offers WHERE brand_id = $1`, [w2.b.brandId])).rows[0].n).toBe(libBefore);
  });

  it('a group send remembers the group, never shown to the creator', async () => {
    const w = await world('conversion');
    const p = await creator();
    const g = await api.post('/brands/me/influencer-groups', w.b.token, { name: 'Diwali shortlist', influencer_ids: [p.influencerId] });
    const gid = g.body.data.group ? g.body.data.group.id : g.body.data.id;
    const r = await send(w, [one(p)], { sourceGroupId: gid });
    expect(r.status).toBe(201);
    const row = await ciRow(r.body.data.rows[0].id);
    expect(row.source).toBe('group'); expect(row.source_group_id).toBe(gid);
    const mine = await api.get(`/influencers/me/invitations/${row.id}`, p.token);
    expect(JSON.stringify(mine.body)).not.toMatch(LEAK);
  });

  /**
   * features/one-basket-add-creators. The picker can now hold a group, the pool and
   * hand-picked creators at once, so one label for the whole batch would be false for most of
   * the rows. The group rides on the creator; the batch-level field is the fallback.
   */
  it('one send, several sources: the group is recorded per creator (one-basket check 10)', async () => {
    const w = await world('conversion');
    const inGroup = await creator(); const byHand = await creator(); const alsoGroup = await creator();
    const g = await api.post('/brands/me/influencer-groups', w.b.token, { name: 'Diwali shortlist', influencer_ids: [inGroup.influencerId, alsoGroup.influencerId] });
    const gid = g.body.data.group ? g.body.data.group.id : g.body.data.id;

    const r = await send(w, [
      one(inGroup, SALE, { sourceGroupId: gid }),
      one(alsoGroup, SALE, { sourceGroupId: gid }),
      one(byHand),
    ]);
    expect(r.status).toBe(201);

    const rows = {};
    for (const x of r.body.data.rows) { const row = await ciRow(x.id); rows[row.influencer_id] = row; }
    expect(rows[inGroup.influencerId].source).toBe('group');
    expect(rows[inGroup.influencerId].source_group_id).toBe(gid);
    expect(rows[alsoGroup.influencerId].source).toBe('group');
    expect(rows[byHand.influencerId].source).toBe('brand_picker');
    expect(rows[byHand.influencerId].source_group_id).toBeNull();
  });

  it('a source group belonging to another brand is dropped, not obeyed (one-basket check 11)', async () => {
    const w = await world('conversion');
    const other = await brand();
    const p = await creator();
    const g = await api.post('/brands/me/influencer-groups', other.token, { name: 'Not yours', influencer_ids: [p.influencerId] });
    const gid = g.body.data.group ? g.body.data.group.id : g.body.data.id;

    const r = await send(w, [one(p, SALE, { sourceGroupId: gid })]);
    expect(r.status).toBe(201);
    const row = await ciRow(r.body.data.rows[0].id);
    expect(row.source).toBe('brand_picker');
    expect(row.source_group_id).toBeNull();
  });

  it('the old shape still works: a batch-level group applies to everyone (one-basket check 12)', async () => {
    const w = await world('conversion');
    const a = await creator(); const b2 = await creator();
    const g = await api.post('/brands/me/influencer-groups', w.b.token, { name: 'Old bundle', influencer_ids: [a.influencerId, b2.influencerId] });
    const gid = g.body.data.group ? g.body.data.group.id : g.body.data.id;

    const r = await send(w, [one(a), one(b2)], { sourceGroupId: gid });
    expect(r.status).toBe(201);
    for (const x of r.body.data.rows) {
      const row = await ciRow(x.id);
      expect(row.source).toBe('group');
      expect(row.source_group_id).toBe(gid);
    }
  });
});

/* ─────────────────────────────────────────── picker, group check, eligibility */

describe('picking (checks 2–5, 10)', () => {
  it('pickable rows carry ok / ineligible / invited; a dead row can be picked again', async () => {
    const w = await world('conversion');
    const ok = await creator({ name: 'Priya Sharma' });
    const notOpen = await creator({ name: 'Kavya D.' });
    await setCreatorInvite(notOpen.influencerId, { aims: ['engagement'] });
    const invited = await creator({ name: 'Arjun Kumar' });
    await send(w, [one(invited)]);
    const declined = await creator({ name: 'Divya R.' });
    await query(`INSERT INTO campaign_influencers (set_id, influencer_id, status, invited_at) VALUES ($1, $2, 'declined', now())`, [w.s.id, declined.influencerId]);
    const r = await api.get(`${w.url}/pickable?openOnly=false`, w.b.token);
    expect(r.status).toBe(200);
    const by = new Map(r.body.data.rows.map(x => [x.id, x.pick]));
    expect(by.get(ok.influencerId)).toEqual({ state: 'ok', label: null, reason: 'OK', inSet: 'none' });
    // ui-walk-fixes D2: she has Pay for Sale switched off and this is a Pay for Sale set, so her
    // row says so. It used to read 'Not open to this set' (drift: 06-diff/drift/SB.md).
    expect(by.get(notOpen.influencerId)).toEqual({
      state: 'ineligible', reason: 'NOT_MATCHING', detail: 'aim',
      label: 'Not taking Pay for Sale', message: "Kavya isn't taking Pay for Sale collaborations.", inSet: 'none',
    });
    // "Already in this set" is unchanged, field for field
    expect(by.get(invited.influencerId)).toEqual({ state: 'invited', label: 'Already in this set', reason: null, inSet: 'live' });
    expect(by.get(declined.influencerId)).toMatchObject({ state: 'ok', inSet: 'dead' });
    expect(JSON.stringify(r.body)).not.toMatch(/min_fee|minFee|threshold/i);
  });

  // ui-walk-fixes · frame B4 ("Show 14 creators") · check 5. The Filters pop-up — since board B
  // the only way to filter in Add creators — asks THIS endpoint for the number on its yellow
  // button. A count answer carries no rows; the handler mapped over them anyway and answered 500,
  // which the phone printed as "Show 0 creators" for every choice (live since item 5; no test
  // asked for the count here — the Creators tab's own count was the only one covered).
  it('the Filters pop-up\'s count: countOnly answers the list\'s own total — with a filter and without — and no rows', async () => {
    const w = await world('conversion');
    await creator({ name: 'Priya Sharma', ig: 90000 });
    await creator({ name: 'Sneha N.', ig: 12000 });
    const paused = await creator({ name: 'Ritu V.', ig: 90000 });
    await setCreatorInvite(paused.influencerId, { open: false });
    /** The list and the count for the same choice: both answer, and the count is the list's total. */
    const both = async (q = '') => {
      const list = await api.get(`${w.url}/pickable?tab=all${q}`, w.b.token);
      const count = await api.get(`${w.url}/pickable?tab=all${q}&countOnly=1`, w.b.token);
      expect(list.status).toBe(200);
      expect(count.status).toBe(200);
      expect(count.body.data).toEqual({ tab: 'all', total: list.body.data.total });
      expect(list.body.data.rows).toHaveLength(list.body.data.total);   // one page holds them all here
      return count.body.data.total;
    };
    expect(await both()).toBe(2);                                        // the picker's default: open to this brand
    expect(await both('&openOnly=false')).toBe(3);
    expect(await both('&minInstagram=50000')).toBe(1);
    expect(await both('&openOnly=false&minInstagram=50000')).toBe(2);
    expect(await both('&search=sneha')).toBe(1);
    expect(await both('&minInstagram=50000&search=sneha')).toBe(0);      // nobody matches: 0 is now a true 0
    // the phone's own spelling of the call (no tab = All creators), and the string form of the flag
    expect((await api.get(`${w.url}/pickable?countOnly=true&minInstagram=50000`, w.b.token)).body).toMatchObject({ success: true, data: { tab: 'all', total: 1 } });
    // and it is the number the Creators tab's count gives for the same choice
    expect((await api.get('/brands/me/discover-creators?minInstagram=50000&countOnly=1', w.b.token)).body.data).toEqual({ total: 1 });
    // Worked with and Pool have no Filters pop-up and never returned a bare count: unchanged
    for (const t of ['worked', 'pool']) {
      const r = await api.get(`${w.url}/pickable?tab=${t}&countOnly=1`, w.b.token);
      expect(r.status).toBe(200);
      expect(r.body.data).toMatchObject({ tab: t, total: 0, rows: [], set: { id: w.s.id } });
    }
  });

  it('a group against a set: "{k} of {n} can be invited" with the three labels', async () => {
    const w = await world('conversion');
    const a = await creator({ name: 'A' }), b2 = await creator({ name: 'B' }), c2 = await creator({ name: 'C' }), d2 = await creator({ name: 'D' });
    await setCreatorInvite(b2.influencerId, { open: false });
    await setCreatorInvite(c2.influencerId, { modes: ['visit'] });
    await send(w, [one(d2)]);
    const g = await api.post('/brands/me/influencer-groups', w.b.token, { name: 'Shortlist', influencer_ids: [a.influencerId, b2.influencerId, c2.influencerId, d2.influencerId] });
    const gid = g.body.data.group ? g.body.data.group.id : g.body.data.id;
    const r = await api.get(`${w.url}/group-check/${gid}`, w.b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.counts).toEqual({ can: 1, cannot: 3, total: 4 });
    expect(r.body.data.can.map(x => x.id)).toEqual([a.influencerId]);
    const labels = Object.fromEntries(r.body.data.cannot.map(x => [x.id, x.label]));
    expect(labels[b2.influencerId]).toBe('Not taking invitations');
    // ui-walk-fixes D2: she takes Store Visit only and this set is Remote, so the label says
    // that. It used to read 'Not open to this set' (drift: 06-diff/drift/SB.md).
    expect(labels[c2.influencerId]).toBe('Not taking Remote');
    expect(labels[d2.influencerId]).toBe('Already in this set');
    // the sentence and the rule ride beside the label, and inside `pick`
    const cannot = Object.fromEntries(r.body.data.cannot.map(x => [x.id, x]));
    expect(cannot[b2.influencerId]).toMatchObject({ detail: 'not_accepting', message: "B isn't taking invitations right now." });
    expect(cannot[c2.influencerId]).toMatchObject({ detail: 'mode', message: "C isn't taking Remote collaborations." });
    expect(cannot[c2.influencerId].pick).toEqual({ state: 'ineligible', reason: 'NOT_MATCHING', detail: 'mode', label: 'Not taking Remote', message: "C isn't taking Remote collaborations.", inSet: 'none' });
    expect(cannot[d2.influencerId]).toMatchObject({ detail: null, message: null });
    expect(cannot[d2.influencerId].pick).toEqual({ state: 'invited', label: 'Already in this set', reason: null, inSet: 'live' });
  });

  it('eligibility returns her minimums to the brand; below-minimum warns and still sends', async () => {
    const w = await world('conversion');
    const p = await creator({ name: 'Priya Sharma' });
    await setCreatorInvite(p.influencerId, { categories: ['WOMEN'] });
    await query(`INSERT INTO creator_min_commissions (influencer_id, aim, category_code, pct) VALUES ($1, 'conversion', 'WOMEN', 12)`, [p.influencerId]);
    const r = await api.post(`${w.url}/eligibility`, w.b.token, { creators: [{ influencerId: p.influencerId, commissionPct: 10 }] });
    expect(r.status).toBe(200);
    expect(r.body.data.results[0]).toMatchObject({ ok: true, warnings: ['BELOW_MIN_COMMISSION'], minimums: { commissionPct: 12 } });
    const sent = await send(w, [one(p)]);
    expect(sent.status).toBe(201);
    expect(sent.body.data.rows[0].warnings).toEqual(['BELOW_MIN_COMMISSION']);
  });
});

/* ───────────────────────── why a creator can't be invited (ui-walk-fixes, D2) */

/**
 * features/ui-walk-fixes · founder decision D2 (2 Oct 2026) · checks 6a and 6b · board B
 * frames B1, B2, B6, B10. Every brand list that marks a creator "Can't invite" now carries
 * the short reason (`label`), the full sentence (`message`) and which rule it was (`detail`).
 * This reverses item 5's "the brand is never sent a reason"; what it must NOT change is
 * pinned beside it: paused = blocked, minimums are never a reason, creators are sent nothing.
 */
describe("why a creator can't be invited — the brand is told (ui-walk-fixes D2, checks 6a, 6b)", () => {
  const D2_WORDS = /Not taking|isn't taking|doesn't do store visits|No store visits|Not open to this set|isn't open to this set|"detail"/;
  const picks = async (w, q = 'openOnly=false') => {
    const r = await api.get(`${w.url}/pickable?${q}`, w.b.token);
    if (r.status !== 200) throw new Error(`pickable: ${JSON.stringify(r.body)}`);
    return { body: r.body, rows: new Map(r.body.data.rows.map(x => [x.id, x])), by: new Map(r.body.data.rows.map(x => [x.id, x.pick])) };
  };
  /** A Hyderabad brand with a Store Visit set at its main branch. */
  async function visitWorld(goal = 'conversion') {
    const b = await brand({ city: 'Hyderabad', state: 'Telangana' });
    const c = await campaign(b);
    const { rows: [branch] } = await query(`SELECT id FROM brand_branches WHERE brand_id = $1 AND is_main`, [b.brandId]);
    const s = await set(b, c.id, { goal, shoot_mode: 'visit', branch_id: branch.id });
    return { b, c, s, url: `/campaigns/${c.id}/sets/${s.id}` };
  }
  const { ref, block, collab } = require('./helpers/item3');

  it('the set picker: each of the five causes shows its own short line and sentence; the city is this set\'s branch city (B1, B2, B10)', async () => {
    const w = await visitWorld('conversion');
    const open = await creator({ name: 'Priya Sharma' });
    const aim = await creator({ name: 'Asha K.' });
    await setCreatorInvite(aim.influencerId, { aims: ['engagement', 'hybrid'] });
    const mode = await creator({ name: 'Meera Rao' });
    await setCreatorInvite(mode.influencerId, { modes: ['shipment'] });
    const category = await creator({ name: 'Kavya D.' });
    await setCreatorInvite(category.influencerId, { categories: ['MEN'] });
    const city = await creator({ name: 'Chitra S.' });
    await setCreatorInvite(city.influencerId, { visitCityIds: [await ref.cityIdForName('Chennai')] });
    const paused = await creator({ name: 'Ritu V.' });
    await setCreatorInvite(paused.influencerId, { open: false });

    const { body, by } = await picks(w);
    expect(body.data.set).toMatchObject({ goal: 'conversion', shootMode: 'visit', branchCity: 'Hyderabad' });
    expect(by.get(open.influencerId)).toEqual({ state: 'ok', label: null, reason: 'OK', inSet: 'none' });
    expect(by.get(aim.influencerId)).toEqual({
      state: 'ineligible', reason: 'NOT_MATCHING', detail: 'aim', inSet: 'none',
      label: 'Not taking Pay for Sale', message: "Asha isn't taking Pay for Sale collaborations.",
    });
    expect(by.get(mode.influencerId)).toEqual({
      state: 'ineligible', reason: 'NOT_MATCHING', detail: 'mode', inSet: 'none',
      label: 'Not taking Store Visit', message: "Meera isn't taking Store Visit collaborations.",
    });
    expect(by.get(category.influencerId)).toEqual({
      state: 'ineligible', reason: 'NOT_MATCHING', detail: 'category', inSet: 'none',
      label: 'Not taking your category', message: "Kavya isn't taking invitations from brands in your category.",
    });
    expect(by.get(city.influencerId)).toEqual({
      state: 'ineligible', reason: 'NOT_MATCHING', detail: 'visit_city', inSet: 'none',
      label: 'No store visits in Hyderabad', message: "Chitra doesn't do store visits in Hyderabad.",
    });
    expect(by.get(paused.influencerId)).toEqual({
      state: 'ineligible', reason: 'NOT_ACCEPTING', detail: 'not_accepting', inSet: 'none',
      label: 'Not taking invitations', message: "Ritu isn't taking invitations right now.",
    });
    // her own lists and numbers are still never part of the page
    expect(JSON.stringify(body)).not.toMatch(/min_fee|minFee|threshold|Chennai|visit_city_ids|visitCityIds|brand_category_codes|brandCategoryCodes/i);

    // the same set as Pay for Content names Pay for Content (frame B1's own example)
    const w2 = await visitWorld('engagement');
    await setCreatorInvite(aim.influencerId, { aims: ['conversion'] });
    expect((await picks(w2)).by.get(aim.influencerId)).toMatchObject({ detail: 'aim', label: 'Not taking Pay for Content', message: "Asha isn't taking Pay for Content collaborations." });
  });

  it('PRIVACY 1 — a creator who paused and a creator who blocked this brand produce byte-identical label, detail and message, on every list', async () => {
    const w = await world('conversion');
    // the same name on purpose: the sentence carries her first name and nothing else of her
    const paused = await creator({ name: 'Asha K.' });
    await setCreatorInvite(paused.influencerId, { open: false, aims: ['engagement'], modes: ['visit'], categories: ['MEN'] });
    const blocked = await creator({ name: 'Asha K.' });
    await setCreatorInvite(blocked.influencerId, { aims: ['engagement'], modes: ['visit'], categories: ['MEN'] });
    await block('creator', blocked.influencerId, 'brand', w.b.brandId);

    // the set picker
    const { by, rows } = await picks(w);
    expect(by.get(paused.influencerId)).toEqual({
      state: 'ineligible', reason: 'NOT_ACCEPTING', detail: 'not_accepting', inSet: 'none',
      label: 'Not taking invitations', message: "Asha isn't taking invitations right now.",
    });
    expect(JSON.stringify(by.get(blocked.influencerId))).toBe(JSON.stringify(by.get(paused.influencerId)));
    expect(rows.get(blocked.influencerId).status).toBe(rows.get(paused.influencerId).status);
    // a blocked brand learns nothing else about her: no Aim, mode or category is named
    expect(JSON.stringify(by.get(blocked.influencerId))).not.toMatch(/block|Pay for|Store Visit|Remote|category/i);

    // the group check
    const g = await api.post('/brands/me/influencer-groups', w.b.token, { name: 'Shortlist', influencer_ids: [paused.influencerId, blocked.influencerId] });
    const gid = g.body.data.group ? g.body.data.group.id : g.body.data.id;
    const check = await api.get(`${w.url}/group-check/${gid}`, w.b.token);
    const cannot = Object.fromEntries(check.body.data.cannot.map(x => [x.id, x]));
    const said = (x) => JSON.stringify({ label: x.label, message: x.message, detail: x.detail, pick: x.pick });
    expect(said(cannot[blocked.influencerId])).toBe(said(cannot[paused.influencerId]));

    // the eligibility check
    const el = await api.post(`${w.url}/eligibility`, w.b.token, { creators: [{ influencerId: paused.influencerId }, { influencerId: blocked.influencerId }] });
    const strip = ({ influencerId, ...rest }) => JSON.stringify(rest);
    expect(strip(el.body.data.results[1])).toBe(strip(el.body.data.results[0]));

    // the refusal after Review and send
    const r = await send(w, [one(paused), one(blocked)]);
    expect(r.status).toBe(422);
    const [f1, f2] = r.body.error.details.failures;
    expect(strip(f2)).toBe(strip(f1));
    expect(f1).toMatchObject({ code: 'NOT_ACCEPTING', detail: 'not_accepting', label: 'Not taking invitations', message: "Asha isn't taking invitations right now." });
  });

  it('the "Open to invitations only" filter treats paused and blocked alike: both hidden when on, both shown when off', async () => {
    const w = await world('conversion');
    const open = await creator({ name: 'Priya Sharma' });
    const paused = await creator({ name: 'Asha K.' });
    await setCreatorInvite(paused.influencerId, { open: false });
    const blocked = await creator({ name: 'Asha K.' });
    await block('creator', blocked.influencerId, 'brand', w.b.brandId);
    const on = await picks(w, '');                 // the picker's default: only creators open to this brand
    expect([...on.by.keys()]).toEqual([open.influencerId]);
    expect(on.body.data.total).toBe(1);
    const off = await picks(w, 'openOnly=false');
    expect([...off.by.keys()].sort()).toEqual([open.influencerId, paused.influencerId, blocked.influencerId].sort());
    expect(off.body.data.total).toBe(3);
    // and with the filter off, nothing on the row tells the two apart
    const row = (id) => { const { id: _i, instagramHandle: _h, avatarUrl: _a, ...rest } = off.rows.get(id); return JSON.stringify(rest); };
    expect(row(blocked.influencerId)).toBe(row(paused.influencerId));
  });

  it('PRIVACY 2 — her minimum fee, minimum commission and follower count never produce a reason: she is pickable, and they stay warnings', async () => {
    const w = await world('conversion');
    const p = await creator({ name: 'Priya Sharma', ig: 12 });
    await setCreatorInvite(p.influencerId, { minFeeEng: 80000, minFeeHyb: 50000 });
    await query(`INSERT INTO creator_min_commissions (influencer_id, aim, category_code, pct) VALUES ($1, 'conversion', 'ALL', 40)`, [p.influencerId]);
    expect((await picks(w)).by.get(p.influencerId)).toEqual({ state: 'ok', label: null, reason: 'OK', inSet: 'none' });
    const el = await api.post(`${w.url}/eligibility`, w.b.token, { creators: [{ influencerId: p.influencerId, commissionPct: 1 }] });
    expect(el.body.data.results[0]).toMatchObject({ ok: true, reason: 'OK', warnings: ['BELOW_MIN_COMMISSION'], detail: null, label: null, message: null });
    // Pay for Content, below her minimum fee: the same
    const w2 = await world('engagement');
    expect((await picks(w2)).by.get(p.influencerId)).toEqual({ state: 'ok', label: null, reason: 'OK', inSet: 'none' });
    const el2 = await api.post(`${w2.url}/eligibility`, w2.b.token, { creators: [{ influencerId: p.influencerId, fee: 1 }] });
    expect(el2.body.data.results[0]).toMatchObject({ ok: true, warnings: ['BELOW_MIN_FEE'], detail: null, label: null, message: null });
    // and the invitation still goes
    const sent = await send(w, [one(p, { commissionPct: 1, scope: 'store' })]);
    expect(sent.status).toBe(201);
    expect(sent.body.data.rows[0].warnings).toEqual(['BELOW_MIN_COMMISSION']);
  });

  it('the eligibility check and the refusal after Review and send say the same line and sentence as the picker', async () => {
    const w = await world('conversion');
    const ok = await creator({ name: 'Priya Sharma' });
    const asha = await creator({ name: 'Asha K.' });
    await setCreatorInvite(asha.influencerId, { aims: ['engagement'] });
    const pick = (await picks(w)).by.get(asha.influencerId);
    expect(pick).toMatchObject({ detail: 'aim', label: 'Not taking Pay for Sale', message: "Asha isn't taking Pay for Sale collaborations." });

    // A4 — a name in the request body is the client's and is not what the sentence uses
    const el = await api.post(`${w.url}/eligibility`, w.b.token, { creators: [{ influencerId: ok.influencerId }, { influencerId: asha.influencerId, name: 'Somebody Else' }] });
    expect(el.status).toBe(200);
    expect(el.body.data.results[0]).toMatchObject({ ok: true, detail: null, label: null, message: null });
    expect(el.body.data.results[1]).toMatchObject({ ok: false, reason: 'NOT_MATCHING', detail: pick.detail, label: pick.label, message: pick.message, inSet: 'none', alreadyIn: false });

    // A8 — nothing is written, and the failure names her reason
    const r = await send(w, [one(ok), one(asha)]);
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe(pick.message);
    expect(r.body.error.details.sent).toBe(0);
    expect(r.body.error.details.failures).toEqual([{
      influencerId: asha.influencerId, name: null, code: 'NOT_MATCHING', field: 'influencer_id',
      message: pick.message, label: pick.label, detail: pick.detail,
    }]);
    expect((await query(`SELECT count(*)::int n FROM campaign_influencers WHERE set_id = $1`, [w.s.id])).rows[0].n).toBe(0);
  });

  it('Worked with and Pool carry the same pick state; PRIVACY 5 — from her own agreed pitch she is exempt on a matching set, an ordinary pick on a differing one, and never exempt from a pause', async () => {
    const b = await brand();
    const c = await campaign(b);
    const content = await set(b, c.id, { goal: 'engagement', shoot_mode: 'shipment' });
    const sale = await set(b, c.id, { name: 'Set B', goal: 'conversion', shoot_mode: 'shipment' });
    const url = (s) => `/campaigns/${c.id}/sets/${s.id}`;
    const tab = async (s, t) => new Map((await api.get(`${url(s)}/pickable?tab=${t}`, b.token)).body.data.rows.map(x => [x.id, x.pick]));

    // Worked with: a signed collaboration, then she switches Pay for Sale off
    const worked = await creator({ name: 'Divya R.' });
    await collab(b.brandId, worked.influencerId);
    await setCreatorInvite(worked.influencerId, { aims: ['engagement'] });
    expect((await tab(sale, 'worked')).get(worked.influencerId)).toEqual({
      state: 'ineligible', reason: 'NOT_MATCHING', detail: 'aim', inSet: 'none',
      label: 'Not taking Pay for Sale', message: "Divya isn't taking Pay for Sale collaborations.",
    });
    expect((await tab(content, 'worked')).get(worked.influencerId)).toEqual({ state: 'ok', label: null, reason: 'OK', inSet: 'none' });
    // the tab's search still finds her, and a name that matches nobody finds nobody
    const found = await api.get(`${url(sale)}/pickable?tab=worked&search=divya`, b.token);
    expect(found.status).toBe(200);
    expect(found.body.data).toMatchObject({ tab: 'worked', total: 1 });
    expect(found.body.data.rows[0]).toMatchObject({ id: worked.influencerId, name: 'Divya R.', collaborations: 1, pick: { detail: 'aim' } });
    expect((await api.get(`${url(sale)}/pickable?tab=worked&search=nobody`, b.token)).body.data).toMatchObject({ total: 0, rows: [] });

    // Pool: she pitched this brand Pay for Content · Remote and it agreed
    const p = await creator({ name: 'Priya Sharma' });
    const pitched = await api.post('/influencers/me/pitches', p.token, {
      brandId: b.brandId, shootMode: 'shipment', proposedGoLiveDate: day(20), goal: 'engagement', fee: 9000,
      deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }],
      message: 'I shoot ethnic wear every week and my saves are strong. I would love to work with you.',
    });
    expect(pitched.status).toBe(201);
    expect((await api.post(`/brands/me/pitches/${pitched.body.data.pitch.id}/accept`, b.token, {})).status).toBe(200);
    // she then closes herself to everything the matching set is
    await setCreatorInvite(p.influencerId, { aims: ['conversion'], modes: ['visit'], categories: ['MEN'], minFeeEng: 99999 });
    // the matching set (same Aim, same mode): her own settings are not turned against her
    expect((await tab(content, 'pool')).get(p.influencerId)).toEqual({ state: 'ok', label: null, reason: 'OK', inSet: 'none' });
    // a set of another Aim: an ordinary pick, and the first rule that fails is named
    expect((await tab(sale, 'pool')).get(p.influencerId)).toEqual({
      state: 'ineligible', reason: 'NOT_MATCHING', detail: 'mode', inSet: 'none',
      label: 'Not taking Remote', message: "Priya isn't taking Remote collaborations.",
    });
    // paused always applies, whatever was agreed
    await setCreatorInvite(p.influencerId, { open: false, aims: ['conversion'], modes: ['visit'], categories: ['MEN'] });
    expect((await tab(content, 'pool')).get(p.influencerId)).toEqual({
      state: 'ineligible', reason: 'NOT_ACCEPTING', detail: 'not_accepting', inSet: 'none',
      label: 'Not taking invitations', message: "Priya isn't taking invitations right now.",
    });
  });

  it('PRIVACY 3 — nothing of it reaches the creator: her lists, her invitation, her settings, the brand she sees and her bell', async () => {
    const w = await world('conversion');
    const asha = await creator({ name: 'Asha K.' });
    // an invitation she holds, so her list and detail have something in them
    const other = await set(w.b, w.c.id, { name: 'Set B', goal: 'engagement' });
    const inv = await send({ b: w.b, url: `/campaigns/${w.c.id}/sets/${other.id}` }, [one(asha, CONTENT)]);
    expect(inv.status).toBe(201);
    const ciId = inv.body.data.rows[0].id;
    // she is refused for the Pay for Sale set, on every brand surface
    await setCreatorInvite(asha.influencerId, { aims: ['engagement'] });
    expect((await picks(w)).by.get(asha.influencerId).detail).toBe('aim');
    await api.post(`${w.url}/eligibility`, w.b.token, { creators: [{ influencerId: asha.influencerId }] });
    expect((await send(w, [one(asha)])).status).toBe(422);

    for (const path of [
      '/influencers/me/invitations', '/influencers/me/invitations?tab=done', `/influencers/me/invitations/${ciId}`,
      '/influencers/me/invitation-settings', '/influencers/me/find-brands?canPitchOnly=false', `/brands/${w.b.brandId}/public`,
    ]) {
      const r = await api.get(path, asha.token);
      expect(r.status).toBe(200);
      expect(JSON.stringify(r.body)).not.toMatch(D2_WORDS);
    }
    // the refusals told her nothing: her bell holds only the invitation she was sent
    const bell = await notifs(asha.userId);
    expect(bell.map(n => n.type)).toEqual(['offer.invited']);
    expect(JSON.stringify(bell)).not.toMatch(D2_WORDS);
  });
});

/* ──────────────────────────────────────────────── after sending: the brand */

describe('after sending (checks 21–24, 36, 39)', () => {
  it('withdraw only before an answer; the creator sees Withdrawn with no reason; she can be invited again (check 22)', async () => {
    const w = await world('conversion');
    const p = await creator({ name: 'Priya Sharma' });
    const s1 = await send(w, [one(p)]);
    const ciId = s1.body.data.rows[0].id;
    let r = await api.post(`${w.url}/invitations/${ciId}/withdraw`, w.b.token);
    expect(r.status).toBe(200); expect(r.body.data.status).toBe('withdrawn');
    const row = await ciRow(ciId);
    expect(row.withdrawn_at).toBeTruthy(); expect(row.withdrawn_by).toBe(w.b.userId);
    const n = await notifs(p.userId);
    expect(n[n.length - 1]).toMatchObject({ type: 'invitation.withdrawn', body: `${w.b.name} withdrew this invitation.` });
    expect(n[n.length - 1].body).not.toMatch(/reason/i);
    const mine = await api.get(`/influencers/me/invitations/${ciId}`, p.token);
    expect(mine.body.data.invitation).toMatchObject({ status: 'withdrawn', group: 'withdrawn', canAnswer: false });
    // twice → already answered wording; after acceptance too
    r = await api.post(`${w.url}/invitations/${ciId}/withdraw`, w.b.token);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.WITHDRAW_ANSWERED('Priya Sharma'));
    const s2 = await send(w, [one(p, { commissionPct: 15, scope: 'store' })]);
    expect(s2.status).toBe(201);
    const ci2 = s2.body.data.rows[0].id;
    await api.post(`/influencers/me/invitations/${ci2}/accept`, p.token);
    r = await api.post(`${w.url}/invitations/${ci2}/withdraw`, w.b.token);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.WITHDRAW_ANSWERED('Priya Sharma'));
    const summary = await api.get(`${w.url}/summary`, w.b.token);
    const g = summary.body.data.creators.groups;
    // Item 7 (P1): the accepted creator now sits under "Your move", because
    // the brand owes her an agreement.
    expect(g.withdrawn.count).toBe(1); expect(g.yourMove.count).toBe(1); expect(g.accepted.count).toBe(0);
    expect(summary.body.data.set.counts).toMatchObject({ invited: 2, waiting: 1 });
  });

  it('remove works until both signatures and never after; an unsigned contract is withdrawn, a signed one untouched (check 23)', async () => {
    const w = await world('conversion');
    const p = await creator({ name: 'Priya Sharma' }), q2 = await creator({ name: 'Tanvi S.' });
    const s1 = await send(w, [one(p), one(q2)]);
    const [ciP, ciQ] = s1.body.data.rows.map(x => x.id);
    await api.post(`/influencers/me/invitations/${ciP}/accept`, p.token);
    expect((await query(`SELECT count(*)::int n FROM contracts WHERE campaign_influencer_id = $1`, [ciP])).rows[0].n).toBe(1);
    let r = await api.post(`${w.url}/invitations/${ciP}/remove`, w.b.token);
    expect(r.status).toBe(200); expect(r.body.data.status).toBe('removed');
    // Item 7 (approval Q8): nothing deletes a contract row. The unsigned
    // agreement is marked withdrawn so its ending can still be named.
    const gone = await query(`SELECT status, withdrawn_at FROM contracts WHERE campaign_influencer_id = $1`, [ciP]);
    expect(gone.rows.length).toBe(1);
    expect(gone.rows[0].status).toBe('withdrawn');
    expect(gone.rows[0].withdrawn_at).not.toBeNull();
    const n = await notifs(p.userId);
    expect(n[n.length - 1]).toMatchObject({ type: 'invitation.removed', body: `${w.b.name} is no longer going ahead with this collaboration.` });
    const mine = await api.get(`/influencers/me/invitations/${ciP}`, p.token);
    expect(mine.body.data.invitation.group).toBe('closed');
    // signed by both → refused, contract untouched
    await signBoth(ciQ);
    r = await api.post(`${w.url}/invitations/${ciQ}/remove`, w.b.token);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.REMOVE_SIGNED('Tanvi S.'));
    expect((await query(`SELECT count(*)::int n FROM contracts WHERE campaign_influencer_id = $1`, [ciQ])).rows[0].n).toBe(1);
    // the legacy cancel route is the same remove now (it used to write an invalid status)
    const w2 = await world('conversion');
    const s3 = await send(w2, [one(p)]);
    r = await api.post(`/campaigns/${w2.c.id}/influencers/${s3.body.data.rows[0].id}/cancel`, w2.b.token);
    expect(r.status).toBe(200); expect(r.body.data.status).toBe('removed');
  });

  it('sent terms are never edited, on a new row or a legacy row (checks 24, 39)', async () => {
    const w = await world('conversion');
    const p = await creator();
    const s1 = await send(w, [one(p)]);
    let r = await api.patch(`${w.url}/influencers/${s1.body.data.rows[0].id}`, w.b.token, { commission_pct: 20 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.SENT_LOCKED);
    const legacy = (await query(`INSERT INTO campaign_influencers (set_id, influencer_id, status) VALUES ($1, $2, 'invited') RETURNING id`, [w.s.id, (await creator()).influencerId])).rows[0].id;
    await query(`UPDATE campaign_influencers SET invited_at = created_at, source = 'legacy' WHERE invited_at IS NULL`); // the migration's backfill
    expect((await ciRow(legacy)).invited_at).toBeTruthy();
    r = await api.patch(`${w.url}/influencers/${legacy}`, w.b.token, { commission_pct: 20 });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.SENT_LOCKED);
    expect(Number((await ciRow(s1.body.data.rows[0].id)).commission_pct)).toBe(10);
  });

  it('the set groups creators in the I9 order; a creator who asked for another date is her own group, not waiting, and survives the cutoff (checks 21, 36)', async () => {
    const w = await world('conversion');
    const cs = await Promise.all(['Priya', 'Tanvi', 'Sneha', 'Ritu', 'Divya', 'Meera'].map(name => creator({ name })));
    const s1 = await send(w, cs.map(c => one(c)));
    const ids = Object.fromEntries(s1.body.data.rows.map(x => [x.name, x.id]));
    await api.post(`/influencers/me/invitations/${ids.Sneha}/accept`, cs[2].token);
    await query(`UPDATE campaign_influencers SET status = 'deferred', deferred_at = now(), deferred_go_live_date = $2 WHERE id = $1`, [ids.Ritu, day(17)]);
    await api.post(`/influencers/me/invitations/${ids.Divya}/decline`, cs[4].token, { reason: 'fee_too_low' });
    await signBoth(ids.Meera);
    let summary = await api.get(`${w.url}/summary`, w.b.token);
    let g = summary.body.data.creators.groups;
    // Item 6 (N20) put "Your move" and "Negotiating" first; "Asked for another date" became "Moved to your pool".
    expect(summary.body.data.creators.order).toEqual(['yourMove', 'negotiating', 'accepted', 'signed', 'waiting', 'deferred', 'declined', 'expired', 'withdrawn']);
    // Item 7 (P1): the accepted creator is the brand's move — an agreement is owed.
    expect(g.waiting.count).toBe(2); expect(g.yourMove.count).toBe(1); expect(g.accepted.count).toBe(0);
    expect(g.signed.count).toBe(1); expect(g.deferred.count).toBe(1); expect(g.declined.count).toBe(1);
    expect(g.deferred.rows[0]).toMatchObject({ name: 'Ritu', deferredGoLiveDate: day(17), actions: { withdraw: false, remove: true } });
    expect(g.declined.rows[0]).toMatchObject({ declineReason: 'fee_too_low', declineReasonLabel: 'Fee too low' });
    // creator-terms-v2 (T7): "10% · N products at normal price" — the fixture gives all products without offers.
    expect(g.waiting.rows[0].termsLine).toMatch(/^10% · \d+ products? at normal price$/);
    expect(summary.body.data.set.counts).toEqual({ invited: 6, signed: 1, waiting: 3, declined: 1 });
    // the cutoff passes with one signed: the set stays; the offer clock, not this job, handles the rest
    // and on a set nobody signed, deferred is never closed
    const w2 = await world('conversion');
    const [x, y] = [await creator(), await creator()];
    const s2 = await send(w2, [one(x), one(y)]);
    await query(`UPDATE campaign_influencers SET status = 'deferred', deferred_at = now() WHERE id = $1`, [s2.body.data.rows[1].id]);
    await moveSetTo(w2.s.id, day(2));
    const out = await setExpiry.run({ today: today() });
    expect(out.expired).toBeGreaterThanOrEqual(1);
    expect((await ciRow(s2.body.data.rows[0].id)).status).toBe('expired');
    expect((await ciRow(s2.body.data.rows[1].id)).status).toBe('deferred');
    summary = await api.get(`/campaigns/${w2.c.id}/sets/${w2.s.id}/summary`, w2.b.token);
    g = summary.body.data.creators.groups;
    expect(g.deferred.count).toBe(1); expect(g.expired.count).toBe(1); expect(g.waiting.count).toBe(0);
  });

  // ui-walk-fixes U6(a), board F6, check 23: an agreement the brand TOOK BACK is owed again, as a
  // draft is. A contract marked 'withdrawn' because she was removed or moved is a different thing
  // and stays where it was. The groups and their order are untouched — no server group was added.
  it('a withdrawn agreement returns an accepted creator to "Your move" with Send agreement; one who was removed or moved stays put (ui-walk-fixes check 23)', async () => {
    const w = await world('conversion');
    const cs = await Promise.all(['Priya', 'Tanvi', 'Ritu'].map(name => creator({ name })));
    const s1 = await send(w, cs.map(c => one(c)));
    const ids = Object.fromEntries(s1.body.data.rows.map(x => [x.name, x.id]));
    for (const [i, name] of ['Priya', 'Tanvi', 'Ritu'].entries()) {
      expect((await api.post(`/influencers/me/invitations/${ids[name]}/accept`, cs[i].token)).status).toBe(200);
    }
    // Priya: the agreement went out and the brand withdrew it.
    expect((await api.post(`${w.url}/invitations/${ids.Priya}/agreement/send`, w.b.token)).status).toBe(201);
    let summary = await api.get(`${w.url}/summary`, w.b.token);
    expect(summary.body.data.creators.groups.waiting.rows.map(x => x.name)).toEqual(['Priya']);
    expect((await api.post(`${w.url}/invitations/${ids.Priya}/agreement/withdraw`, w.b.token)).status).toBe(200);
    // Tanvi: removed from the set — her unsigned contract is marked withdrawn too (check 23 above).
    expect((await api.post(`${w.url}/invitations/${ids.Tanvi}/remove`, w.b.token)).status).toBe(200);
    // Ritu: moved to the pool, which leaves the same mark on her contract (negotiation.moveAnswer).
    await query(`UPDATE campaign_influencers SET status = 'deferred', deferred_at = now() WHERE id = $1`, [ids.Ritu]);
    await query(`UPDATE contracts SET status = 'withdrawn', withdrawn_at = now() WHERE campaign_influencer_id = $1`, [ids.Ritu]);
    const marks = await query(`SELECT status FROM contracts WHERE campaign_influencer_id = ANY($1::uuid[])`, [[ids.Priya, ids.Tanvi, ids.Ritu]]);
    expect(marks.rows.map(x => x.status)).toEqual(['withdrawn', 'withdrawn', 'withdrawn']);

    summary = await api.get(`${w.url}/summary`, w.b.token);
    const g = summary.body.data.creators.groups;
    expect(summary.body.data.creators.order).toEqual(['yourMove', 'negotiating', 'accepted', 'signed', 'waiting', 'deferred', 'declined', 'expired', 'withdrawn']);
    expect(g.yourMove.rows.map(x => x.name)).toEqual(['Priya']);
    expect(g.yourMove.rows[0]).toMatchObject({ status: 'accepted', group: 'yourMove', actions: { sendAgreement: true, signAgreement: false, withdrawAgreement: false, viewAgreement: false, remove: true } });
    expect(g.yourMove.title).toBe('Your move');
    expect(g.accepted.count).toBe(0); expect(g.waiting.count).toBe(0);
    expect(g.withdrawn.rows.map(x => x.name)).toEqual(['Tanvi']);
    expect(g.withdrawn.rows[0].actions.sendAgreement).toBe(false);
    expect(g.deferred.rows.map(x => x.name)).toEqual(['Ritu']);
    expect(g.deferred.rows[0].actions.sendAgreement).toBe(false);
    // The brand's view of that one invitation agrees with its row.
    const one1 = await api.get(`${w.url}/invitations/${ids.Priya}`, w.b.token);
    expect(one1.body.data.invitation).toMatchObject({ group: 'yourMove', actions: { sendAgreement: true }, contract: { status: 'withdrawn', signedByBoth: false } });
  });

  it('the brand\'s view of one invitation carries the terms as sent and the timeline; another brand is 404', async () => {
    const w = await world('engagement');
    const p = await creator({ name: 'Priya Sharma' });
    const s1 = await send(w, [one(p, { ...CONTENT, note: 'Hi', usageRights: { on: true, durationDays: 90, places: ['website'] } })]);
    const ciId = s1.body.data.rows[0].id;
    const r = await api.get(`${w.url}/invitations/${ciId}`, w.b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.invitation).toMatchObject({ name: 'Priya Sharma', status: 'invited', group: 'waiting', termsLine: '₹8,000 · 1 Instagram reel, 2 Instagram stories' });
    expect(r.body.data.invitation.terms).toMatchObject({ fee: 8000, deliverablesWords: '1 Instagram reel, 2 Instagram stories', note: 'Hi', usageRights: { durationDays: 90, places: ['website'], words: '90 days · website' } });
    expect(r.body.data.invitation.sentAt).toBeTruthy();
    const other = await brand();
    expect((await api.get(`${w.url}/invitations/${ciId}`, other.token)).status).toBe(404);
    expect((await api.post(`${w.url}/invitations/${ciId}/withdraw`, other.token)).status).toBe(404);
    expect((await api.post(`${w.url}/invitations/${ciId}/remove`, other.token)).status).toBe(404);
  });
});

/* ─────────────────────────────────────────────────────────── the creator */

describe('the creator (checks 25–33, 37, 42)', () => {
  it('Invites lists the card with Aim, mode, date, money and days left; the detail has the two blocks and never the brief, budgets, group or address', async () => {
    const w = await world('conversion');
    await query(`UPDATE campaigns SET brief = 'SECRET brief', total_budget = 99999 WHERE id = $1`, [w.c.id]);
    await query(`UPDATE campaign_sets SET set_budget = 55555, per_influencer_budget = 4444, coupon_prefix = 'DIW' WHERE id = $1`, [w.s.id]);
    const p = await creator({ name: 'Priya Sharma' });
    const pid = await product(w.b.brandId, { name: 'Silk saree', price: 2400 });
    const s1 = await send(w, [one(p, { commissionPct: 10, productsWithoutOffers: { mode: 'chosen', productIds: [pid] } }, { note: 'Loved your reels.' })]);
    const ciId = s1.body.data.rows[0].id;
    const list = await api.get('/influencers/me/invitations', p.token);
    expect(list.status).toBe(200);
    expect(list.body.data.rows).toHaveLength(1);
    expect(list.body.data.rows[0]).toMatchObject({ id: ciId, group: 'invited', goal: 'conversion', shootMode: 'shipment', postingDate: day(10), cutoff: day(7), daysLeft: 7, commissionPct: 10, canAnswer: true, canCounter: true, setName: 'Set A · Ethnic wear', campaignName: 'Diwali Edit 2026' });
    expect(list.body.data.rows[0].brand.name).toBe(w.b.name);
    expect(JSON.stringify(list.body)).not.toMatch(LEAK);
    const d = await api.get(`/influencers/me/invitations/${ciId}`, p.token);
    expect(d.status).toBe(200);
    const inv = d.body.data.invitation;
    expect(inv.set).toMatchObject({ goal: 'conversion', shootMode: 'shipment', postingDate: day(10), cutoff: day(7) });
    // creator-terms-v2 (C1): one row, offers + products; no old scope, no shopper offer.
    expect(inv.terms).toMatchObject({ commissionPct: 10, shoppablePostsMin: MIN_SHOPPABLE_POSTS,
      sell: { offers: [], products: { mode: 'chosen', count: 1 }, words: '1 product at normal price' }, scope: null, offer: null });
    expect(inv.note).toBe('Loved your reels.');
    expect(JSON.stringify(d.body)).not.toMatch(LEAK);
    expect(JSON.stringify(d.body)).not.toContain('SECRET');
    expect(JSON.stringify(d.body)).not.toContain('55555');
    expect(JSON.stringify(d.body)).not.toContain('DIW');
    // the legacy creator endpoints no longer leak either (check 42)
    const legacyDetail = await api.get(`/offers/${ciId}`, p.token);
    expect(legacyDetail.status).toBe(200);
    expect(JSON.stringify(legacyDetail.body)).not.toMatch(/brief|total_budget|set_budget|per_influencer_budget|coupon_prefix/);
    expect(JSON.stringify(legacyDetail.body)).not.toContain('SECRET');
    const legacyInbox = await api.get('/offers/inbox', p.token);
    expect(JSON.stringify(legacyInbox.body)).not.toMatch(/set_budget|per_influencer_budget|brief/);
    // another creator: 404 everywhere
    const other = await creator();
    expect((await api.get(`/influencers/me/invitations/${ciId}`, other.token)).status).toBe(404);
    expect((await api.post(`/influencers/me/invitations/${ciId}/accept`, other.token)).status).toBe(404);
    expect((await api.post(`/influencers/me/invitations/${ciId}/decline`, other.token, { reason: 'other' })).status).toBe(404);
  });

  it('a Pay for Content invitation spells out the deliverables and the 25/25/50 split in rupees (check 27)', async () => {
    const w = await world('engagement');
    const p = await creator();
    const s1 = await send(w, [one(p, { ...CONTENT, usageRights: { on: true, durationDays: 60, places: ['social', 'ads'] } })]);
    const d = await api.get(`/influencers/me/invitations/${s1.body.data.rows[0].id}`, p.token);
    expect(d.body.data.invitation.terms).toMatchObject({ fee: 8000, deliverablesWords: '1 Instagram reel, 2 Instagram stories', usageRights: { words: '60 days · social and ads' }, paySplit: { t1: 2000, t2: 2000, t3: 4000 } });
    expect(d.body.data.invitation.terms.commissionPct).toBeNull();
  });

  it('accept moves both sides to accepted, drafts the contract and tells the brand; twice is refused (check 28)', async () => {
    const w = await world('conversion');
    const p = await creator({ name: 'Priya Sharma' });
    const s1 = await send(w, [one(p)]);
    const ciId = s1.body.data.rows[0].id;
    let r = await api.post(`/influencers/me/invitations/${ciId}/accept`, p.token);
    expect(r.status).toBe(200);
    expect(r.body.data.invitation).toMatchObject({ status: 'accepted', group: 'accepted', canAnswer: false });
    const row = await ciRow(ciId);
    expect(row.answered_at).toBeTruthy();
    expect((await query(`SELECT count(*)::int n FROM contracts WHERE campaign_influencer_id = $1`, [ciId])).rows[0].n).toBe(1);
    const n = await notifs(w.b.userId);
    const accepted = n.find(x => x.type === 'offer.accepted');
    expect(accepted).toBeTruthy();
    expect(accepted.body).toContain('Priya Sharma');
    r = await api.post(`/influencers/me/invitations/${ciId}/accept`, p.token);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.ANSWERED_TWICE);
    const summary = await api.get(`${w.url}/summary`, w.b.token);
    // Item 7 (P1): an accepted creator with a draft agreement is the BRAND's
    // move — "Your move" holds both "Send agreement" and "Sign".
    expect(summary.body.data.creators.groups.yourMove.rows[0]).toMatchObject({ name: 'Priya Sharma', actions: { sendAgreement: true } });
  });

  it('decline needs one of the five reasons, keeps the note (≤ 200), tells the brand both (check 29)', async () => {
    const w = await world('conversion');
    const p = await creator({ name: 'Priya Sharma' });
    const s1 = await send(w, [one(p)]);
    const ciId = s1.body.data.rows[0].id;
    let r = await api.post(`/influencers/me/invitations/${ciId}/decline`, p.token, {});
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.DECLINE_REASON);
    r = await api.post(`/influencers/me/invitations/${ciId}/decline`, p.token, { reason: 'already_partnered' });
    expect(r.status).toBe(422);
    r = await api.post(`/influencers/me/invitations/${ciId}/decline`, p.token, { reason: 'too_much_work', note: 'x'.repeat(201) });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.DECLINE_NOTE_LONG);
    r = await api.post(`/influencers/me/invitations/${ciId}/decline`, p.token, { reason: 'schedule_conflict', note: 'Travelling that week.' });
    expect(r.status).toBe(200);
    expect(r.body.data.invitation).toMatchObject({ status: 'declined', group: 'declined', declineReasonLabel: "Dates don't suit" });
    const row = await ciRow(ciId);
    expect(row).toMatchObject({ declined_reason: 'schedule_conflict', declined_note: 'Travelling that week.' });
    expect(row.answered_at).toBeTruthy();
    const n = await notifs(w.b.userId);
    expect(n[n.length - 1].type).toBe('offer.declined');
    expect(n[n.length - 1].body).toContain("Dates don't suit");
    expect(n[n.length - 1].body).toContain('Travelling that week.');
    const summary = await api.get(`${w.url}/summary`, w.b.token);
    expect(summary.body.data.creators.groups.declined.rows[0]).toMatchObject({ declineReasonLabel: "Dates don't suit", declineNote: 'Travelling that week.' });
    expect(DECLINE_REASONS.map(x => x.label)).toEqual(['Fee too low', "Dates don't suit", 'Not my kind of brand', 'Too much work', 'Other']);
    expect(declineLabel('already_partnered')).toBe('Already partnered');
  });

  it('after the cutoff nothing can be answered and the card reads as expired; Counter is hidden when negotiation is off (checks 30, 31, 37)', async () => {
    const w = await world('conversion');
    const p = await creator();
    const s1 = await send(w, [one(p)]);
    const ciId = s1.body.data.rows[0].id;
    await moveSetTo(w.s.id, day(2));
    const list = await api.get('/influencers/me/invitations', p.token);
    expect(list.body.data.rows[0]).toMatchObject({ group: 'expired', canAnswer: false, canCounter: false, daysLeft: null });
    let r = await api.post(`/influencers/me/invitations/${ciId}/accept`, p.token);
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.ANSWER_CLOSED(day(-1)));
    r = await api.post(`/influencers/me/invitations/${ciId}/decline`, p.token, { reason: 'other' });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe(MSG.ANSWER_CLOSED(day(-1)));
    // negotiation switched off on the campaign → canCounter false while everything else stands
    const w2 = await world('conversion');
    await query(`UPDATE campaigns SET allow_negotiation = false WHERE id = $1`, [w2.c.id]);
    const s2 = await send(w2, [one(p)]);
    const d = await api.get(`/influencers/me/invitations/${s2.body.data.rows[0].id}`, p.token);
    expect(d.body.data.invitation).toMatchObject({ canAnswer: true, canCounter: false });
    // Item 8 gave the thread a second anchor, so a global count would also catch
    // a pitch thread that has nothing to do with this switch. Scope it to the
    // invitation this test is actually about.
    expect((await query(
      `SELECT count(*)::int n FROM negotiations WHERE campaign_influencer_id = $1`,
      [s2.body.data.rows[0].id]
    )).rows[0].n).toBe(0);
  });

  it('ended invitations stay in Invites for seven days, then move to Done', async () => {
    const w = await world('conversion');
    const p = await creator();
    const s1 = await send(w, [one(p), one(await creator())]);
    const ciId = s1.body.data.rows[0].id;
    await api.post(`${w.url}/invitations/${ciId}/withdraw`, w.b.token);
    let list = await api.get('/influencers/me/invitations?tab=invites', p.token);
    expect(list.body.data.rows.map(x => x.group)).toEqual(['withdrawn']);
    expect((await api.get('/influencers/me/invitations?tab=done', p.token)).body.data.rows).toHaveLength(0);
    await query(`UPDATE campaign_influencers SET withdrawn_at = now() - interval '8 days' WHERE id = $1`, [ciId]);
    list = await api.get('/influencers/me/invitations?tab=invites', p.token);
    expect(list.body.data.rows).toHaveLength(0);
    expect((await api.get('/influencers/me/invitations?tab=done', p.token)).body.data.rows.map(x => x.group)).toEqual(['withdrawn']);
  });
});

/* ────────────────────────────────────────────────── the two offer fixes */

describe('offer fixes riding along (checks 15, 16)', () => {
  it('Gap B — a creator offer never applies before its start date, and stops after its end', async () => {
    const future = { offer_type: 'discount', offer_config_json: { sub_type: 'pct', value: 10, scope: 'store' }, offer_valid_from: new Date(Date.now() + 86400000).toISOString() };
    expect(offerResolution.creatorOfferNotYetLive(future)).toBe(true);
    expect(offerResolution.creatorOfferNotYetLive({ ...future, offer_valid_from: new Date(Date.now() - 1000).toISOString() })).toBe(false);
    const w = await world('conversion');
    const pid = await product(w.b.brandId, { price: 1000 });
    const items = [{ product_id: pid, variant_id: null, quantity: 1 }];
    const priceMap = new Map([[pid, 1000]]);
    const notYet = await offerResolution.resolveBestOffer({ ci: future, brandId: w.b.brandId, items, priceMap, variantPriceMap: new Map(), productMetaMap: new Map(), billAmount: 1000 });
    expect(Number(notYet.discount_amount || 0)).toBe(0);
    const live = await offerResolution.resolveBestOffer({ ci: { ...future, offer_valid_from: new Date(Date.now() - 1000).toISOString() }, brandId: w.b.brandId, items, priceMap, variantPriceMap: new Map(), productMetaMap: new Map(), billAmount: 1000 });
    expect(Number(live.discount_amount)).toBe(100);
    expect(live.offer_source).toBe('creator');
  });

  it('Gap A — the tracking record now carries the creator\'s library offer id and start date, so the sale can record which offer produced it', async () => {
    const w = await world('conversion');
    const p = await creator();
    const pid = await product(w.b.brandId, { price: 1000 });
    // The offer starts yesterday, not on the posting day, so it is live for this sale.
    // creator-terms-v2: the send no longer copies offers (rules 2.3), so this OLD-style collaboration
    // — a library offer copied onto the row, as older invitations carry it — is written as it exists.
    const { rows: [lib] } = await query(
      `INSERT INTO brand_offers (brand_id, name, offer_type, offer_config_json, status, engine)
       VALUES ($1, 'Old library 15%', 'discount', '{"sub_type":"pct","value":15,"scope":"store"}', 'active', 1) RETURNING id`, [w.b.brandId]);
    const { rows: [old] } = await query(
      `INSERT INTO campaign_influencers (set_id, influencer_id, status, commission_pct, alloc_scope, brand_offer_id, offer_type, offer_config_json, offer_valid_from, allocation)
       VALUES ($1, $2, 'invited', 10, 'store', $3, 'discount', '{"sub_type":"pct","value":15,"scope":"store"}', $4, 'commissioned') RETURNING id`,
      [w.s.id, p.influencerId, lib.id, new Date(Date.now() - 86400000).toISOString()]);
    const ciId = old.id;
    const row = await ciRow(ciId);
    await query(`UPDATE campaigns SET status = 'active' WHERE id = $1`, [w.c.id]);
    await query(`UPDATE campaign_influencers SET status = 'active' WHERE id = $1`, [ciId]);
    const record = await txnService.validateTracking(w.c.id, w.s.id, ciId, null);
    expect(record.brand_offer_id).toBe(row.brand_offer_id);
    expect(record.offer_valid_from).toBeTruthy();
    const best = await offerResolution.resolveBestOffer({ ci: record, brandId: w.b.brandId, items: [{ product_id: pid, variant_id: null, quantity: 1 }], priceMap: new Map([[pid, 1000]]), variantPriceMap: new Map(), productMetaMap: new Map(), billAmount: 1000 });
    expect(best.offer_id).toBe(row.brand_offer_id);
    expect(Number(best.discount_amount)).toBe(150);
  });
});
