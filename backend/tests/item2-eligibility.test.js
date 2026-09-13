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
    expect((await pitch(e, b, 'conversion', 'visit')).reason).toBe('NOT_MATCHING');
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

  it('1. paused → NOT_ACCEPTING; blocked → NOT_ACCEPTING, identical', async () => {
    const b = await brand(); const c = await creator();
    await setCreator(c.influencerId, { open: false });
    expect(await invite(b, c, remoteSet, {})).toEqual({ ok: false, reason: 'NOT_ACCEPTING', warnings: [] });
    await setCreator(c.influencerId, { open: true });
    await block('creator', c.influencerId, 'brand', b.brandId);
    expect(await invite(b, c, remoteSet, {})).toEqual({ ok: false, reason: 'NOT_ACCEPTING', warnings: [] });
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

describe('summaries never leak', () => {
  it('pitchSummaryFor carries only status, aims, modes, canPitch and a coarse reason; blocked = paused', async () => {
    const b = await brand(); const c = await creator({ ig: 100 });
    await setBrand(b.brandId, { minIg: 10000, niches: ['comedy'], cityIds: [1], minEr: 9 });
    const s = await elig.pitchSummaryFor(b.brandId, c.influencerId);
    expect(Object.keys(s).sort()).toEqual(['acceptingLabelState', 'aims', 'canPitch', 'modes', 'reason']);
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
