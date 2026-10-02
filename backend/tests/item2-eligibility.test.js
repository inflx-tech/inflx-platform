'use strict';

/**
 * Item 2 — the eligibility rules (prompt §3), one test per rule, plus the named cases.
 * Contract: features/item2-pitch-invitation-settings · rules v1.10 §8A
 *
 * These call the service directly against a real database. The API wiring (pitch-create,
 * invite-create) is covered in item2-settings-api.test.js.
 */

const { truncateAll, query } = require('./helpers/db');
const { createBrandUser, createInfluencerUser, registerBrand, registerInfluencer } = require('./helpers/factories');
const elig = require('../src/services/collabEligibility.service');
const ref = require('../src/services/referenceLists.service');

beforeEach(async () => { await truncateAll(); ref.invalidate(); });

async function brand(over = {}) {
  const { token, user } = await createBrandUser();
  const b = await registerBrand(token, { category: 'fashion', sub_categories: ['WOMEN'], city: 'Hyderabad', state: 'Telangana', ...over });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  return { token, userId: user.id, brandId: b.id };
}
async function creator(over = {}) {
  const { token, user } = await createInfluencerUser();
  const inf = await registerInfluencer(token, { instagram_handle: over.handle || `c_${Math.random().toString(36).slice(2, 8)}`, name: over.name || 'Priya Sharma', city: over.city || 'Hyderabad' });
  await query(`UPDATE users SET status='approved' WHERE id=$1`, [user.id]);
  await query(
    `UPDATE influencers SET followers_count=$2, youtube_subscribers=$3, engagement_rate=$4, niche=$5, language=$6 WHERE id=$1`,
    [inf.id, over.ig ?? 48000, over.yt ?? null, over.er ?? 4.2, over.niche || ['fashion'], over.language || ['Telugu', 'English']]
  );
  return { token, userId: user.id, influencerId: inf.id };
}
const setBrand = (brandId, patch) => query(
  `INSERT INTO brand_pitch_settings (brand_id, accepting, accepted_aims, accepted_modes, niche_codes, min_followers_instagram, min_followers_youtube, min_engagement_rate, language_codes, city_ids, allow_past_creators)
   VALUES ($1, COALESCE($2,true), COALESCE($3,ARRAY['conversion','engagement','hybrid']), COALESCE($4,ARRAY['visit','shipment']), $5, $6, $7, $8, $9, $10, COALESCE($11,true))
   ON CONFLICT (brand_id) DO UPDATE SET accepting=EXCLUDED.accepting, accepted_aims=EXCLUDED.accepted_aims, accepted_modes=EXCLUDED.accepted_modes,
     niche_codes=EXCLUDED.niche_codes, min_followers_instagram=EXCLUDED.min_followers_instagram, min_followers_youtube=EXCLUDED.min_followers_youtube,
     min_engagement_rate=EXCLUDED.min_engagement_rate, language_codes=EXCLUDED.language_codes, city_ids=EXCLUDED.city_ids, allow_past_creators=EXCLUDED.allow_past_creators`,
  [brandId, patch.accepting ?? null, patch.aims || null, patch.modes || null, patch.niches || null, patch.minIg ?? null, patch.minYt ?? null,
   patch.minEr ?? null, patch.languages || null, patch.cityIds || null, patch.allowPast ?? null]
);
const setCreator = (influencerId, patch) => query(
  `INSERT INTO creator_invitation_settings (influencer_id, open, accepted_aims, accepted_modes, visit_city_ids, brand_category_codes, min_fee_engagement, min_fee_hybrid)
   VALUES ($1, COALESCE($2,true), COALESCE($3,ARRAY['conversion','engagement','hybrid']), COALESCE($4,ARRAY['visit','shipment']), COALESCE($5,'{}'::int[]), $6, $7, $8)
   ON CONFLICT (influencer_id) DO UPDATE SET open=EXCLUDED.open, accepted_aims=EXCLUDED.accepted_aims, accepted_modes=EXCLUDED.accepted_modes,
     visit_city_ids=EXCLUDED.visit_city_ids, brand_category_codes=EXCLUDED.brand_category_codes, min_fee_engagement=EXCLUDED.min_fee_engagement, min_fee_hybrid=EXCLUDED.min_fee_hybrid`,
  [influencerId, patch.open ?? null, patch.aims || null, patch.modes || null, patch.visitCityIds || null, patch.categories || null, patch.minFeeEng ?? null, patch.minFeeHyb ?? null]
);
const setCommission = (influencerId, aim, cat, pct) => query(
  `INSERT INTO creator_min_commissions (influencer_id, aim, category_code, pct) VALUES ($1,$2,$3,$4)
   ON CONFLICT (influencer_id, aim, category_code) DO UPDATE SET pct=EXCLUDED.pct`, [influencerId, aim, cat, pct]);
const block = (blockerType, blockerId, blockedType, blockedId) => query(
  `INSERT INTO collab_blocks (blocker_type, blocker_id, blocked_type, blocked_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
  [blockerType, blockerId, blockedType, blockedId]);
const cityId = (name) => ref.cityIdForName(name);

/** A contract with both signatures between the two — "previously signed" (founder Q3). */
async function signedContractBetween(brandId, influencerId) {
  const { rows: [c] } = await query(`INSERT INTO campaigns (brand_id, name, status) VALUES ($1,'Old one','completed') RETURNING id`, [brandId]);
  const { rows: [s] } = await query(`INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1,'Set','conversion','handpick') RETURNING id`, [c.id]);
  const { rows: [ci] } = await query(`INSERT INTO campaign_influencers (set_id, influencer_id, status) VALUES ($1,$2,'completed') RETURNING id`, [s.id, influencerId]);
  await query(`INSERT INTO contracts (campaign_influencer_id, influencer_signed_at, brand_signed_at, status) VALUES ($1, now(), now(), 'active')`, [ci.id]);
}

const pitch = (c, b, aim, mode) => elig.canCreatorPitchBrand({ influencerId: c.influencerId, brandId: b.brandId, aim, mode });
const invite = (b, c, set, terms) => elig.canBrandInviteCreator({ brandId: b.brandId, influencerId: c.influencerId, set, proposedTerms: terms });

describe('§3.1 creator → brand', () => {
  it('a brand with no saved row is fully open: OK for any aim and mode', async () => {
    const b = await brand(); const c = await creator();
    expect(await pitch(c, b, 'conversion', 'visit')).toEqual({ ok: true, reason: 'OK' });
  });

  it('1. paused → NOT_ACCEPTING; blocked → NOT_ACCEPTING, never a block-specific code (check 6)', async () => {
    const b = await brand(); const c = await creator();
    await setBrand(b.brandId, { accepting: false });
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('NOT_ACCEPTING');
    await setBrand(b.brandId, { accepting: true });
    await block('brand', b.brandId, 'creator', c.influencerId);
    const r = await pitch(c, b, 'conversion', 'visit');
    expect(r).toEqual({ ok: false, reason: 'NOT_ACCEPTING' });
    expect(JSON.stringify(r)).not.toMatch(/block/i);
  });

  it('2. aim or mode the brand does not accept → NOT_MATCHING', async () => {
    const b = await brand(); const c = await creator();
    await setBrand(b.brandId, { aims: ['conversion', 'hybrid'], modes: ['visit'] });
    expect((await pitch(c, b, 'engagement', 'visit')).reason).toBe('NOT_MATCHING');
    expect((await pitch(c, b, 'conversion', 'shipment')).reason).toBe('NOT_MATCHING');
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('OK');
  });

  it('3. allow-past-creators skips the private filters but never pause, block, aim or mode (check 7)', async () => {
    const b = await brand(); const c = await creator({ ig: 1000 });
    await setBrand(b.brandId, { minIg: 100000, allowPast: true });
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('NOT_MATCHING');
    await signedContractBetween(b.brandId, c.influencerId);
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('OK');
    await setBrand(b.brandId, { minIg: 100000, allowPast: true, aims: ['engagement'] });
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('NOT_MATCHING');
    await setBrand(b.brandId, { minIg: 100000, allowPast: true, accepting: false });
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('NOT_ACCEPTING');
    await setBrand(b.brandId, { minIg: 100000, allowPast: false });
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('NOT_MATCHING');
  });

  it('4. niches: at least one of hers must be in the brand list', async () => {
    const b = await brand(); const c = await creator({ niche: ['fashion'] });
    await setBrand(b.brandId, { niches: ['comedy', 'gaming'] });
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('NOT_MATCHING');
    await setBrand(b.brandId, { niches: ['comedy', 'fashion'] });
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('OK');
  });

  it('4. followers: either platform is enough, but only a platform with a minimum counts (check 3)', async () => {
    const b = await brand(); const c = await creator({ ig: 8000, yt: 12000 });
    await setBrand(b.brandId, { minIg: 10000 });                  // no YouTube minimum → she fails
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('NOT_MATCHING');
    await setBrand(b.brandId, { minIg: 10000, minYt: 10000 });    // YouTube minimum set → she passes on YouTube
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('OK');
    const d = await creator({ ig: 8000, yt: 6000 });              // the prompt's example: 10,000 / 5,000
    await setBrand(b.brandId, { minIg: 10000, minYt: 5000 });
    expect((await pitch(d, b, 'conversion', 'visit')).reason).toBe('OK');
    const e = await creator({ ig: 8000, yt: null });              // never measured = 0 (Q16)
    // Item 8, approval §2.1: she still FAILS — a number nobody has cannot admit
    // her — but the reason she is given is the true one. She can wait this out;
    // "you don't match" would have told her something untrue about herself.
    expect((await pitch(e, b, 'conversion', 'visit')).ok).toBe(false);
    expect((await pitch(e, b, 'conversion', 'visit')).reason).toBe('BEING_MEASURED');
  });

  it('4. engagement, languages and city', async () => {
    const b = await brand(); const c = await creator({ er: 4.2, language: ['Telugu'], city: 'Hyderabad' });
    await setBrand(b.brandId, { minEr: 5 });
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('NOT_MATCHING');
    await setBrand(b.brandId, { minEr: 4.2, languages: ['Hindi'] });
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('NOT_MATCHING');
    await setBrand(b.brandId, { languages: ['Hindi', 'Telugu'], cityIds: [await cityId('Chennai')] });
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('NOT_MATCHING');
    await setBrand(b.brandId, { languages: ['Hindi', 'Telugu'], cityIds: [await cityId('Chennai'), await cityId('Hyderabad')] });
    expect((await pitch(c, b, 'conversion', 'visit')).reason).toBe('OK');
  });

  it('a pitch without a mode skips only the mode check (item 8 makes it mandatory)', async () => {
    const b = await brand(); const c = await creator();
    await setBrand(b.brandId, { modes: ['visit'] });
    expect((await pitch(c, b, 'conversion', undefined)).reason).toBe('OK');
  });
});

describe('§3.2 brand → creator', () => {
  const visitSet = { goal: 'conversion', shoot_mode: 'visit' };
  const remoteSet = { goal: 'conversion', shoot_mode: 'shipment' };

  it('a creator with no saved row is open; her profile city is her default visit city', async () => {
    const b = await brand({ city: 'Hyderabad' }); const c = await creator({ city: 'Hyderabad' });
    expect((await invite(b, c, visitSet, {})).reason).toBe('OK');
    expect((await invite(b, c, remoteSet, {})).reason).toBe('OK');
  });

  // ui-walk-fixes, founder decision D2 (2 Oct 2026): a refusal now says which rule it was, as
  // a short line and a sentence. The exact-shape assertion moved with it (drift: 06-diff/drift/SB.md).
  // What it protects is unchanged — paused and blocked are the SAME object, word for word.
  it('1. paused → NOT_ACCEPTING; blocked → NOT_ACCEPTING, identical', async () => {
    const b = await brand(); const c = await creator();
    const notTaking = {
      ok: false, reason: 'NOT_ACCEPTING', warnings: [],
      detail: 'not_accepting', label: 'Not taking invitations', message: "Priya isn't taking invitations right now.",
    };
    await setCreator(c.influencerId, { open: false });
    const paused = await invite(b, c, remoteSet, {});
    expect(paused).toEqual(notTaking);
    await setCreator(c.influencerId, { open: true });
    await block('creator', c.influencerId, 'brand', b.brandId);
    const blocked = await invite(b, c, remoteSet, {});
    expect(blocked).toEqual(notTaking);
    expect(JSON.stringify(blocked)).toBe(JSON.stringify(paused));
    expect(JSON.stringify(blocked)).not.toMatch(/block/i);
  });

  it("2. the set's aim or mode she does not accept → NOT_MATCHING; 'remote' (no shoot) counts as Remote; no mode skips", async () => {
    const b = await brand(); const c = await creator();
    await setCreator(c.influencerId, { aims: ['engagement'], modes: ['visit'], visitCityIds: [await cityId('Hyderabad')] });
    expect((await invite(b, c, { goal: 'conversion', shoot_mode: 'visit' }, {})).reason).toBe('NOT_MATCHING');
    expect((await invite(b, c, { goal: 'engagement', shoot_mode: 'shipment' }, {})).reason).toBe('NOT_MATCHING');
    expect((await invite(b, c, { goal: 'engagement', shoot_mode: 'remote' }, {})).reason).toBe('NOT_MATCHING');
    expect((await invite(b, c, { goal: 'engagement', shoot_mode: null }, {})).reason).toBe('OK');
  });

  it('3. brand categories: a Watches brand does not match a creator who picked only Women (check 10)', async () => {
    const b = await brand({ sub_categories: ['WATCHES'] }); const c = await creator();
    await setCreator(c.influencerId, { categories: ['WOMEN'] });
    expect((await invite(b, c, remoteSet, {})).reason).toBe('NOT_MATCHING');
    const w = await brand({ sub_categories: ['WOMEN', 'WATCHES'] });
    expect((await invite(w, c, remoteSet, {})).reason).toBe('OK');
  });

  it('3. a brand with no sub-categories does not match a creator who picked categories, until it sets them (check 17)', async () => {
    const b = await brand(); const c = await creator();
    await query(`UPDATE brands SET sub_categories = NULL WHERE id = $1`, [b.brandId]);   // a brand from before item 2
    await setCreator(c.influencerId, { categories: ['WOMEN'] });
    expect((await invite(b, c, remoteSet, {})).reason).toBe('NOT_MATCHING');
    const d = await creator();                                                             // picked none → unaffected
    expect((await invite(b, d, remoteSet, {})).reason).toBe('OK');
    await query(`UPDATE brands SET sub_categories = ARRAY['WOMEN'] WHERE id = $1`, [b.brandId]);
    expect((await invite(b, c, remoteSet, {})).reason).toBe('OK');
  });

  it('4. Store Visit needs one of the brand\'s branch cities in her visit list (founder Q1)', async () => {
    const b = await brand({ city: 'Hyderabad' }); const c = await creator({ city: 'Chennai' });
    await setCreator(c.influencerId, { visitCityIds: [await cityId('Chennai')] });
    expect((await invite(b, c, visitSet, {})).reason).toBe('NOT_MATCHING');
    expect((await invite(b, c, remoteSet, {})).reason).toBe('OK');
    await setCreator(c.influencerId, { visitCityIds: [await cityId('Chennai'), await cityId('Hyderabad')] });
    expect((await invite(b, c, visitSet, {})).reason).toBe('OK');
    // Item 3: branch cities come from brand_branches (registration seeds the main branch; more
    // branches are added on the phone). A branch typed into listing_data no longer counts once
    // the brand has branch rows. Contract: features/item3-discovery-profiles-groups
    const b2 = await brand({ city: 'Mumbai', state: 'Maharashtra' });
    await query(`UPDATE brands SET listing_data = '{"branches":[{"name":"Main Branch","city":"Mumbai"},{"name":"T Nagar","city":"Chennai"}]}'::jsonb WHERE id=$1`, [b2.brandId]);
    await setCreator(c.influencerId, { visitCityIds: [await cityId('Chennai')] });
    expect((await invite(b2, c, visitSet, {})).reason).toBe('NOT_MATCHING');
    await query(
      `INSERT INTO brand_branches (brand_id, name, city_id, state_id, is_main)
       SELECT $1, 'T Nagar', rc.id, rc.state_id, false FROM ref_cities rc WHERE rc.id = $2`, [b2.brandId, await cityId('Chennai')]);
    expect((await invite(b2, c, visitSet, {})).reason).toBe('OK');
  });

  it('5. BELOW_MIN_FEE warns and never blocks (check 11)', async () => {
    const b = await brand(); const c = await creator();
    await setCreator(c.influencerId, { minFeeEng: 8000, minFeeHyb: 5000 });
    const r = await invite(b, c, { goal: 'engagement', shoot_mode: 'shipment' }, { fee: 6000 });
    // Item 5 added `minimums` (her numbers, for the brand's terms screen) to the same result.
    expect(r).toMatchObject({ ok: true, reason: 'OK', warnings: ['BELOW_MIN_FEE'], minimums: { fee: 8000 } });
    expect((await invite(b, c, { goal: 'engagement', shoot_mode: 'shipment' }, { fee: 8000 })).warnings).toEqual([]);
    expect((await invite(b, c, { goal: 'hybrid', shoot_mode: 'shipment' }, { fee: 4999, commissionPct: 20 })).warnings).toEqual(['BELOW_MIN_FEE']);
    expect((await invite(b, c, { goal: 'conversion', shoot_mode: 'shipment' }, { fee: 1 })).warnings).toEqual([]);
  });

  it('5. BELOW_MIN_COMMISSION uses the brand\'s category row when she picked categories, the ALL row when she picked none (check 12)', async () => {
    const women = await brand({ sub_categories: ['WOMEN'] });
    const jewel = await brand({ sub_categories: ['IMITATION_JEWELLERY'] });
    const foot = await brand({ sub_categories: ['FOOTWEAR'] });
    const c = await creator();
    await setCreator(c.influencerId, { categories: ['WOMEN', 'IMITATION_JEWELLERY'] });
    await setCommission(c.influencerId, 'conversion', 'WOMEN', 12);
    expect((await invite(women, c, remoteSet, { commissionPct: 8 })).warnings).toEqual(['BELOW_MIN_COMMISSION']);
    expect((await invite(women, c, remoteSet, { commissionPct: 12 })).warnings).toEqual([]);
    expect((await invite(jewel, c, remoteSet, { commissionPct: 8 })).warnings).toEqual([]);     // no row = no minimum
    const d = await creator();                                                                    // picked none, ALL 5%
    await setCommission(d.influencerId, 'conversion', 'ALL', 5);
    expect((await invite(foot, d, remoteSet, { commissionPct: 4 })).warnings).toEqual(['BELOW_MIN_COMMISSION']);
    expect((await invite(foot, d, remoteSet, { commissionPct: 5 })).warnings).toEqual([]);
  });

  it('rows for an unselected category or a turned-off Aim are kept but ignored', async () => {
    const women = await brand({ sub_categories: ['WOMEN'] }); const c = await creator();
    await setCreator(c.influencerId, { categories: ['WOMEN'] });
    await setCommission(c.influencerId, 'conversion', 'WOMEN', 12);
    await setCommission(c.influencerId, 'conversion', 'MEN', 30);
    expect((await invite(women, c, remoteSet, { commissionPct: 8 })).warnings).toEqual(['BELOW_MIN_COMMISSION']);
    await setCreator(c.influencerId, { categories: ['MEN'] });
    const men = await brand({ sub_categories: ['MEN'] });
    expect((await invite(men, c, remoteSet, { commissionPct: 29 })).warnings).toEqual(['BELOW_MIN_COMMISSION']);
    expect((await invite(women, c, remoteSet, { commissionPct: 8 })).reason).toBe('NOT_MATCHING');
    const s = await elig.loadCreatorInvitationSettings(c.influencerId);
    expect(s.min_commissions.map(r => r.category_code).sort()).toEqual(['MEN', 'WOMEN']);
  });
});

/**
 * ui-walk-fixes · founder decision D2 (2 Oct 2026) · checks 6a and 6b.
 * The brand is told WHICH of her rules ruled a set out: `detail`, a short `label` for her row
 * and a full `message` for when the brand taps her. What must not move is pinned here too.
 */
describe('D2 — a brand is told which rule a creator failed (ui-walk-fixes 6a, 6b)', () => {
  const words = (r) => ({ ok: r.ok, reason: r.reason, detail: r.detail, label: r.label, message: r.message });
  const mainBranch = async (b) => (await query(`SELECT id FROM brand_branches WHERE brand_id = $1 AND is_main`, [b.brandId])).rows[0].id;
  const many = (b, set, creators, names) => elig.canBrandInviteMany({ brandId: b.brandId, set, creators: creators.map(c => ({ influencerId: c.influencerId })), names });

  it('Aim: the short line and the sentence name the SET\'s Aim in its display name, for all three Aims', async () => {
    const b = await brand(); const c = await creator({ name: 'Asha K.' });
    await setCreator(c.influencerId, { aims: ['hybrid'] });
    expect(words(await invite(b, c, { goal: 'conversion', shoot_mode: 'shipment' }, {}))).toEqual({
      ok: false, reason: 'NOT_MATCHING', detail: 'aim',
      label: 'Not taking Pay for Sale', message: "Asha isn't taking Pay for Sale collaborations.",
    });
    expect(words(await invite(b, c, { goal: 'engagement', shoot_mode: 'shipment' }, {}))).toEqual({
      ok: false, reason: 'NOT_MATCHING', detail: 'aim',
      label: 'Not taking Pay for Content', message: "Asha isn't taking Pay for Content collaborations.",
    });
    await setCreator(c.influencerId, { aims: ['conversion'] });
    expect(words(await invite(b, c, { goal: 'hybrid', shoot_mode: 'shipment' }, {}))).toEqual({
      ok: false, reason: 'NOT_MATCHING', detail: 'aim',
      label: 'Not taking Hybrid', message: "Asha isn't taking Hybrid collaborations.",
    });
  });

  it('mode: Store Visit and Remote in their display names ("remote", no shoot, reads as Remote)', async () => {
    const b = await brand(); const c = await creator({ name: 'Asha K.' });
    await setCreator(c.influencerId, { modes: ['shipment'] });
    expect(words(await invite(b, c, { goal: 'conversion', shoot_mode: 'visit' }, {}))).toEqual({
      ok: false, reason: 'NOT_MATCHING', detail: 'mode',
      label: 'Not taking Store Visit', message: "Asha isn't taking Store Visit collaborations.",
    });
    await setCreator(c.influencerId, { modes: ['visit'] });
    const remote = { ok: false, reason: 'NOT_MATCHING', detail: 'mode', label: 'Not taking Remote', message: "Asha isn't taking Remote collaborations." };
    expect(words(await invite(b, c, { goal: 'conversion', shoot_mode: 'shipment' }, {}))).toEqual(remote);
    expect(words(await invite(b, c, { goal: 'conversion', shoot_mode: 'remote' }, {}))).toEqual(remote);
  });

  it('her brand categories: the brand is told it is its category — and never which categories she picked', async () => {
    const b = await brand({ sub_categories: ['WATCHES'] }); const c = await creator({ name: 'Asha K.' });
    await setCreator(c.influencerId, { categories: ['WOMEN', 'MEN'] });
    const r = await invite(b, c, { goal: 'conversion', shoot_mode: 'shipment' }, {});
    expect(words(r)).toEqual({
      ok: false, reason: 'NOT_MATCHING', detail: 'category',
      label: 'Not taking your category', message: "Asha isn't taking invitations from brands in your category.",
    });
    expect(JSON.stringify(r)).not.toMatch(/WOMEN|MEN|WATCHES/);
  });

  it('her visit cities: the city named is the city of THIS SET\'s branch; unknown, the no-city wording — and her own cities are never sent', async () => {
    const b = await brand({ city: 'Hyderabad' }); const c = await creator({ name: 'Asha K.', city: 'Chennai' });
    await setCreator(c.influencerId, { visitCityIds: [await cityId('Chennai')] });
    // the set names its branch → that branch's city is named
    const withBranch = await invite(b, c, { goal: 'conversion', shoot_mode: 'visit', branch_id: await mainBranch(b) }, {});
    expect(words(withBranch)).toEqual({
      ok: false, reason: 'NOT_MATCHING', detail: 'visit_city',
      label: 'No store visits in Hyderabad', message: "Asha doesn't do store visits in Hyderabad.",
    });
    expect(JSON.stringify(withBranch)).not.toMatch(/Chennai/);
    // a set that names no branch is judged on every branch city, so no single city is known
    const noCity = { ok: false, reason: 'NOT_MATCHING', detail: 'visit_city', label: 'Not taking store visits at your branch', message: "Asha doesn't do store visits at your branch's city." };
    expect(words(await invite(b, c, { goal: 'conversion', shoot_mode: 'visit' }, {}))).toEqual(noCity);
    // a branch with no city on it → the same no-city wording
    await query(`UPDATE brand_branches SET city_id = NULL WHERE brand_id = $1`, [b.brandId]);
    expect(words(await invite(b, c, { goal: 'conversion', shoot_mode: 'visit', branch_id: await mainBranch(b) }, {}))).toEqual(noCity);
    // Remote is never city-bound, so the same creator has no reason at all there
    expect((await invite(b, c, { goal: 'conversion', shoot_mode: 'shipment' }, {})).ok).toBe(true);
  });

  it('ONLY ONE reason, the first that fails: paused/blocked, then Aim, mode, category, visit city', async () => {
    const b = await brand({ city: 'Hyderabad', sub_categories: ['WATCHES'] }); const c = await creator({ name: 'Asha K.', city: 'Chennai' });
    const set = { goal: 'conversion', shoot_mode: 'visit', branch_id: await mainBranch(b) };
    const chennai = [await cityId('Chennai')];
    // she fails all four of her own rules at once
    await setCreator(c.influencerId, { aims: ['engagement'], modes: ['shipment'], categories: ['WOMEN'], visitCityIds: chennai });
    expect((await invite(b, c, set, {})).detail).toBe('aim');
    await setCreator(c.influencerId, { modes: ['shipment'], categories: ['WOMEN'], visitCityIds: chennai });
    expect((await invite(b, c, set, {})).detail).toBe('mode');
    await setCreator(c.influencerId, { categories: ['WOMEN'], visitCityIds: chennai });
    expect((await invite(b, c, set, {})).detail).toBe('category');
    await setCreator(c.influencerId, { visitCityIds: chennai });
    expect((await invite(b, c, set, {})).detail).toBe('visit_city');
    await setCreator(c.influencerId, {});
    expect((await invite(b, c, set, {})).ok).toBe(true);
    // every result holds one detail, one line and one sentence — never a list of them
    await setCreator(c.influencerId, { aims: ['engagement'], modes: ['shipment'], categories: ['WOMEN'], visitCityIds: chennai });
    const r = await invite(b, c, set, {});
    expect(Object.keys(r).sort()).toEqual(['detail', 'label', 'message', 'ok', 'reason', 'warnings']);
    expect(r.message).toBe("Asha isn't taking Pay for Sale collaborations.");
    expect(r.message).not.toMatch(/Store Visit|category|Hyderabad/);
  });

  it('PRIVACY 1 — paused and blocked are byte-identical in label, detail and message, even when her other settings would fail too', async () => {
    const b = await brand({ city: 'Hyderabad', sub_categories: ['WATCHES'] }); const c = await creator({ name: 'Asha K.', city: 'Chennai' });
    const set = { goal: 'conversion', shoot_mode: 'visit', branch_id: await mainBranch(b) };
    const closed = { aims: ['engagement'], modes: ['shipment'], categories: ['WOMEN'], visitCityIds: [await cityId('Chennai')] };

    await setCreator(c.influencerId, { ...closed, open: false });
    const paused = await invite(b, c, set, {});
    const pausedList = (await many(b, set, [c]))[0];

    await setCreator(c.influencerId, { ...closed, open: true });
    await block('creator', c.influencerId, 'brand', b.brandId);
    const blocked = await invite(b, c, set, {});
    const blockedList = (await many(b, set, [c]))[0];

    expect(words(paused)).toEqual({ ok: false, reason: 'NOT_ACCEPTING', detail: 'not_accepting', label: 'Not taking invitations', message: "Asha isn't taking invitations right now." });
    expect(JSON.stringify(blocked)).toBe(JSON.stringify(paused));
    expect(JSON.stringify(blockedList)).toBe(JSON.stringify(pausedList));
    // a blocked brand learns none of her other settings: nothing about Aim, mode, category or city
    for (const r of [blocked, blockedList]) {
      expect(JSON.stringify(r)).not.toMatch(/block|Pay for|Store Visit|Remote|category|Hyderabad|Chennai/i);
    }
    // …and a creator who is BOTH paused and blocking reads the same again
    await setCreator(c.influencerId, { ...closed, open: false });
    expect(JSON.stringify(await invite(b, c, set, {}))).toBe(JSON.stringify(paused));
  });

  it('PRIVACY 2 — her minimum fee and commission never produce a reason: they stay warnings and she can be invited', async () => {
    const b = await brand(); const c = await creator({ name: 'Asha K.', ig: 10 });   // 10 followers: no reason either
    await setCreator(c.influencerId, { minFeeEng: 8000, minFeeHyb: 5000 });
    await setCommission(c.influencerId, 'conversion', 'ALL', 15);
    await setCommission(c.influencerId, 'hybrid', 'ALL', 15);
    const cases = [
      [{ goal: 'engagement', shoot_mode: 'shipment' }, { fee: 1 }, ['BELOW_MIN_FEE']],
      [{ goal: 'conversion', shoot_mode: 'shipment' }, { commissionPct: 1 }, ['BELOW_MIN_COMMISSION']],
      [{ goal: 'hybrid', shoot_mode: 'shipment' }, { fee: 1, commissionPct: 1 }, ['BELOW_MIN_FEE', 'BELOW_MIN_COMMISSION']],
    ];
    for (const [set, terms, warnings] of cases) {
      const r = await invite(b, c, set, terms);
      expect(r).toMatchObject({ ok: true, reason: 'OK', warnings });
      expect(r).not.toHaveProperty('detail');
      expect(r).not.toHaveProperty('label');
      expect(r).not.toHaveProperty('message');
      const [l] = await elig.canBrandInviteMany({ brandId: b.brandId, set, creators: [{ influencerId: c.influencerId, ...terms }] });
      expect(l).toMatchObject({ ok: true, reason: 'OK', warnings, detail: null, label: null, message: null });
    }
  });

  it('PRIVACY 4 — the pitch direction is untouched: a creator still gets the coarse code and nothing else', async () => {
    const b = await brand(); const c = await creator({ ig: 100 });
    const shapes = [];
    await setBrand(b.brandId, { accepting: false });
    shapes.push(await pitch(c, b, 'conversion', 'visit'));                       // paused
    await setBrand(b.brandId, { aims: ['engagement'] });
    shapes.push(await pitch(c, b, 'conversion', 'visit'));                       // Aim
    await setBrand(b.brandId, { modes: ['shipment'] });
    shapes.push(await pitch(c, b, 'conversion', 'visit'));                       // mode
    await setBrand(b.brandId, { minIg: 100000, niches: ['comedy'], cityIds: [1] });
    shapes.push(await pitch(c, b, 'conversion', 'visit'));                       // private filters
    await setBrand(b.brandId, {});
    await block('brand', b.brandId, 'creator', c.influencerId);
    shapes.push(await pitch(c, b, 'conversion', 'visit'));                       // blocked
    expect(shapes).toEqual([
      { ok: false, reason: 'NOT_ACCEPTING' },
      { ok: false, reason: 'NOT_MATCHING' },
      { ok: false, reason: 'NOT_MATCHING' },
      { ok: false, reason: 'NOT_MATCHING' },
      { ok: false, reason: 'NOT_ACCEPTING' },
    ]);
    // the words a creator is given are the ones she was given before D2
    expect(elig.MESSAGE.pitch).toEqual({
      NOT_ACCEPTING: "This brand isn't accepting pitches right now.",
      NOT_MATCHING: "You don't match this brand's pitch criteria.",
      BEING_MEASURED: 'Your numbers are still being measured.',
    });
    const pitchCopy = require('../src/services/pitchCopy');
    expect(pitchCopy.MSG.NOT_ACCEPTING('Kalamkari Co')).toBe("Kalamkari Co aren't taking pitches right now.");
    expect(pitchCopy.MSG.NOT_MATCHING('Kalamkari Co')).toBe("You don't meet what Kalamkari Co are looking for.");
    expect(pitchCopy.MSG.AIM_NOT_TAKEN('Kalamkari Co')).toBe("Kalamkari Co aren't taking that kind of pitch.");
    expect(pitchCopy.MSG.MODE_NOT_TAKEN('Kalamkari Co')).toBe("Kalamkari Co aren't taking that way of working.");
    // and the summary a creator reads of a brand carries no detail, line or sentence
    const s = await elig.pitchSummaryFor(b.brandId, c.influencerId);
    expect(Object.keys(s).sort()).toEqual(['acceptingLabelState', 'aims', 'canPitch', 'cooldownLine', 'cooldownUntil', 'modes', 'reason']);
  });

  it('PRIVACY 5 — invited from her own agreed pitch she is still exempt from Aim, mode, category and city; paused and blocked still apply', () => {
    // The rule itself, with the facts in hand (decideInvite is pure). The pool lookup that
    // sets herOwnPitch is exercised end to end in item5-invitations and item8-pitch.
    const closed = { ...elig.CREATOR_DEFAULTS, accepted_aims: ['engagement'], accepted_modes: ['shipment'], brand_category_codes: ['MEN'], visit_city_ids: [999], min_fee_engagement: 99999, min_commissions: [{ aim: 'conversion', category_code: 'ALL', pct: 90 }] };
    const facts = { subCategories: ['WATCHES'], branchCityIds: [1], setBranchCity: 'Hyderabad' };
    const set = { goal: 'conversion', shoot_mode: 'visit' };
    const ask = (over) => elig.decideInvite({ settings: closed, blocked: false, herOwnPitch: true, brand: facts, set, proposedTerms: { commissionPct: 1 }, ...over });
    // exactly today's answer: OK, no warnings, no minimums, marked as from her pitch — and no reason
    expect(ask({})).toEqual({ ok: true, reason: 'OK', warnings: [], minimums: null, fromHerPitch: true });
    // the same creator as an ordinary pick fails her first rule
    expect(ask({ herOwnPitch: false })).toEqual({ ok: false, reason: 'NOT_MATCHING', detail: 'aim', warnings: [] });
    // the two absolutes survive her pitch, and read the same as each other
    const paused = ask({ settings: { ...closed, open: false } });
    const blocked = ask({ blocked: true });
    expect(paused).toEqual({ ok: false, reason: 'NOT_ACCEPTING', detail: 'not_accepting', warnings: [] });
    expect(blocked).toEqual(paused);
  });

  it('anything that is not one of her rules keeps the old line: "Not open to this set"', async () => {
    const c = await creator({ name: 'Asha K.' });
    // the brand's own facts are missing (no such brand)
    const ghost = '00000000-0000-4000-8000-000000000000';
    const r = await elig.canBrandInviteCreator({ brandId: ghost, influencerId: c.influencerId, set: { goal: 'conversion', shoot_mode: 'shipment' } });
    expect(words(r)).toEqual({ ok: false, reason: 'NOT_MATCHING', detail: null, label: 'Not open to this set', message: "Asha isn't open to this set." });
    const [l] = await elig.canBrandInviteMany({ brandId: ghost, set: { goal: 'conversion', shoot_mode: 'shipment' }, creators: [{ influencerId: c.influencerId }] });
    expect(words(l)).toEqual(words(r));
    // pure: no brand facts → no detail, whatever else is true of her
    expect(elig.decideInvite({ settings: { ...elig.CREATOR_DEFAULTS }, blocked: false, herOwnPitch: false, brand: null, set: { goal: 'conversion' } }))
      .toEqual({ ok: false, reason: 'NOT_MATCHING', detail: null, warnings: [] });
  });

  it('one copy of the rule: the list answer and the single answer are the same words for every reason', async () => {
    const b = await brand({ city: 'Hyderabad', sub_categories: ['WATCHES'] });
    const set = { goal: 'conversion', shoot_mode: 'visit', branch_id: await mainBranch(b) };
    const mk = async (name, patch, blockIt) => {
      const c = await creator({ name, city: 'Chennai' });
      if (patch) await setCreator(c.influencerId, patch);
      if (blockIt) await block('creator', c.influencerId, 'brand', b.brandId);
      return c;
    };
    const chennai = [await cityId('Chennai')];
    const cs = [
      await mk('Open Olivia'),
      await mk('Paused Padma', { open: false }),
      await mk('Blocking Bhanu', null, true),
      await mk('Aim Asha', { aims: ['engagement'] }),
      await mk('Mode Meera', { modes: ['shipment'] }),
      await mk('Category Kavya', { categories: ['WOMEN'] }),
      await mk('City Chitra', { visitCityIds: chennai }),
    ];
    const list = await many(b, set, cs);
    expect(list.map(x => x.influencerId)).toEqual(cs.map(c => c.influencerId));     // input order kept
    expect(list.map(x => x.detail)).toEqual([null, 'not_accepting', 'not_accepting', 'aim', 'mode', 'category', 'visit_city']);
    expect(list.map(x => x.label)).toEqual([null, 'Not taking invitations', 'Not taking invitations', 'Not taking Pay for Sale', 'Not taking Store Visit', 'Not taking your category', 'No store visits in Hyderabad']);
    for (let i = 0; i < cs.length; i += 1) {
      const single = await invite(b, cs[i], set, {});
      expect({ ok: list[i].ok, reason: list[i].reason, detail: list[i].detail, label: list[i].label, message: list[i].message })
        .toEqual({ ok: single.ok, reason: single.reason, detail: single.detail || null, label: single.label || null, message: single.message || null });
    }
    // the first name in the sentence is hers, looked up when the caller does not hand it over…
    expect(list[3].message).toBe("Aim isn't taking Pay for Sale collaborations.");
    // …and taken from the caller's own rows when it does (a Map or a plain object)
    const named = await many(b, set, [cs[3]], new Map([[cs[3].influencerId, 'Asha Kumari']]));
    expect(named[0].message).toBe("Asha isn't taking Pay for Sale collaborations.");
    const namedObj = await many(b, set, [cs[4]], { [cs[4].influencerId]: 'Meera R.' });
    expect(namedObj[0].message).toBe("Meera isn't taking Store Visit collaborations.");
  });

  it('the Aim and mode names are the ones the apps print', () => {
    const copy = require('../src/services/invitationCopy');
    const pitchCopy = require('../src/services/pitchCopy');
    expect(copy.AIM_NAME).toEqual(pitchCopy.AIM_LABEL);
    expect(copy.MODE_NAME).toEqual(pitchCopy.MODE_LABEL);
    expect(copy.CANT_INVITE_DETAILS.slice().sort()).toEqual(Object.values(elig.DETAIL).sort());
    // a creator with no name on file still gets a sentence
    expect(copy.cantInvite({ detail: 'not_accepting', name: null }).message).toBe("She isn't taking invitations right now.");
  });
});

describe('summaries never leak', () => {
  it('pitchSummaryFor carries only status, aims, modes, canPitch and a coarse reason; blocked = paused', async () => {
    const b = await brand(); const c = await creator({ ig: 100 });
    await setBrand(b.brandId, { minIg: 10000, niches: ['comedy'], cityIds: [1], minEr: 9 });
    const s = await elig.pitchSummaryFor(b.brandId, c.influencerId);
    // Item 8 adds the cooldown date to this card, and nothing else. It is hers
    // — her own pause, with the day it lifts — never a threshold of the brand’s.
    expect(Object.keys(s).sort()).toEqual(['acceptingLabelState', 'aims', 'canPitch', 'cooldownLine', 'cooldownUntil', 'modes', 'reason']);
    expect(s.reason).toBe('NOT_MATCHING');
    await block('brand', b.brandId, 'creator', c.influencerId);
    const blocked = await elig.pitchSummaryFor(b.brandId, c.influencerId);
    await setBrand(b.brandId, { accepting: false });
    await query(`DELETE FROM collab_blocks`);
    const paused = await elig.pitchSummaryFor(b.brandId, c.influencerId);
    expect(blocked).toEqual(paused);
    expect(blocked.acceptingLabelState).toBe('paused');
  });

  it('inviteSummaryFor likewise', async () => {
    const b = await brand({ sub_categories: ['WATCHES'] }); const c = await creator();
    await setCreator(c.influencerId, { categories: ['WOMEN'], minFeeEng: 8000 });
    const s = await elig.inviteSummaryFor(c.influencerId, b.brandId);
    expect(Object.keys(s).sort()).toEqual(['aims', 'canInvite', 'modes', 'openLabelState', 'reason']);
    expect(s.reason).toBe('NOT_MATCHING');
    expect(JSON.stringify(s)).not.toMatch(/8000|WOMEN|fee/);
  });
});
