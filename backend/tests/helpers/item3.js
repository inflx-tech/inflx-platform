'use strict';

/**
 * Item 3 — shared fixtures for the discovery / profile / groups suites.
 * Contract: features/item3-discovery-profiles-groups
 *
 * Everything here goes through the real API or plain SQL against the test database. Google
 * is the one thing mocked: `mockPlaces({...})` makes places.details answer from a fixture so
 * a test can hand the server a place id and check what the server does with the answer.
 */

const request = require('supertest');
const app = require('../../src/app');
const { query } = require('./db');
const { createBrandUser, createInfluencerUser, registerBrand, registerInfluencer } = require('./factories');
const ref = require('../../src/services/referenceLists.service');
const places = require('../../src/services/places.service');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const rnd = () => Math.random().toString(36).slice(2, 8);

/** Reference rows tests may have added (Google-sourced cities, unknown-state log) — clear them. */
async function resetReference() {
  await query(`DELETE FROM ref_cities WHERE source = 'google'`);
  await query(`DELETE FROM ref_unknown_states`);
  ref.invalidate();
  ref.resetResolveState();
}

async function brand(over = {}) {
  const { token, user } = await createBrandUser();
  const b = await registerBrand(token, { business_name: over.business_name || `Brand ${rnd()}`, category: 'fashion', sub_categories: over.sub_categories || ['WOMEN'], city: over.city || 'Hyderabad', state: over.state || 'Telangana', ...over.register });
  await query(`UPDATE users SET status=$2 WHERE id=$1`, [user.id, over.status || 'approved']);
  if (over.approvedAt) await query(`UPDATE brands SET approved_at=$2 WHERE id=$1`, [b.id, over.approvedAt]);
  // Item 10 (founder Q6): a Store Visit set now needs a branch WITH a street address. The
  // registration path builds the Main Branch from the typed address, which these fixtures
  // never supply — so give it one here, the way a real brand's would have one. Pass
  // `over.mainAddress: null` to get a brand whose main branch has no address.
  if (over.mainAddress !== null) {
    await query(`UPDATE brand_branches SET formatted_address = COALESCE(formatted_address, $2) WHERE brand_id = $1 AND is_main`,
      [b.id, over.mainAddress || `Road No. 12, Banjara Hills, ${over.city || 'Hyderabad'}, ${over.state || 'Telangana'} 500034, India`]);
  }
  return { token, userId: user.id, brandId: b.id, name: b.business_name };
}

async function creator(over = {}) {
  const { token, user } = await createInfluencerUser();
  const inf = await registerInfluencer(token, { instagram_handle: over.handle || `c_${rnd()}`, name: over.name || 'Priya Sharma', city: over.city || 'Hyderabad' });
  await query(`UPDATE users SET status=$2 WHERE id=$1`, [user.id, over.status || 'approved']);
  await query(
    `UPDATE influencers SET followers_count=$2, youtube_subscribers=$3, engagement_rate=$4, niche=$5, language=$6, youtube_handle=$7 WHERE id=$1`,
    [inf.id, over.ig ?? 48000, over.yt ?? null, over.er ?? 4.2, over.niche || ['fashion'], over.language || ['Telugu', 'English'], over.ytHandle || null]
  );
  if (over.cityName) {
    const id = await ref.cityIdForName(over.cityName);
    await query(`UPDATE influencers SET city_id=$2, city=$3 WHERE id=$1`, [inf.id, id, over.cityName]);
  }
  return { token, userId: user.id, influencerId: inf.id, name: over.name || 'Priya Sharma', handle: inf.instagram_handle };
}

const setBrandPitch = (brandId, patch) => query(
  `INSERT INTO brand_pitch_settings (brand_id, accepting, accepted_aims, accepted_modes, niche_codes, min_followers_instagram, min_followers_youtube, min_engagement_rate, language_codes, city_ids, allow_past_creators)
   VALUES ($1, COALESCE($2,true), COALESCE($3,ARRAY['conversion','engagement','hybrid']), COALESCE($4,ARRAY['visit','shipment']), $5, $6, $7, $8, $9, $10, COALESCE($11,true))
   ON CONFLICT (brand_id) DO UPDATE SET accepting=EXCLUDED.accepting, accepted_aims=EXCLUDED.accepted_aims, accepted_modes=EXCLUDED.accepted_modes,
     niche_codes=EXCLUDED.niche_codes, min_followers_instagram=EXCLUDED.min_followers_instagram, min_followers_youtube=EXCLUDED.min_followers_youtube,
     min_engagement_rate=EXCLUDED.min_engagement_rate, language_codes=EXCLUDED.language_codes, city_ids=EXCLUDED.city_ids, allow_past_creators=EXCLUDED.allow_past_creators`,
  [brandId, patch.accepting ?? null, patch.aims || null, patch.modes || null, patch.niches || null, patch.minIg ?? null, patch.minYt ?? null,
   patch.minEr ?? null, patch.languages || null, patch.cityIds || null, patch.allowPast ?? null]
);
const setCreatorInvite = (influencerId, patch) => query(
  `INSERT INTO creator_invitation_settings (influencer_id, open, accepted_aims, accepted_modes, visit_city_ids, brand_category_codes, min_fee_engagement, min_fee_hybrid)
   VALUES ($1, COALESCE($2,true), COALESCE($3,ARRAY['conversion','engagement','hybrid']), COALESCE($4,ARRAY['visit','shipment']), COALESCE($5,'{}'::int[]), $6, $7, $8)
   ON CONFLICT (influencer_id) DO UPDATE SET open=EXCLUDED.open, accepted_aims=EXCLUDED.accepted_aims, accepted_modes=EXCLUDED.accepted_modes,
     visit_city_ids=EXCLUDED.visit_city_ids, brand_category_codes=EXCLUDED.brand_category_codes, min_fee_engagement=EXCLUDED.min_fee_engagement, min_fee_hybrid=EXCLUDED.min_fee_hybrid`,
  [influencerId, patch.open ?? null, patch.aims || null, patch.modes || null, patch.visitCityIds || null, patch.categories || null, patch.minFeeEng ?? null, patch.minFeeHyb ?? null]
);
const block = (blockerType, blockerId, blockedType, blockedId) => query(
  `INSERT INTO collab_blocks (blocker_type, blocker_id, blocked_type, blocked_id) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
  [blockerType, blockerId, blockedType, blockedId]);

/**
 * A collaboration between a brand and a creator. `signed: 'both'` (default) sets both
 * signatures, 'brand' / 'creator' only one, 'none' neither. `status` is the
 * campaign_influencers status; `aim` the set goal; `signedAt` the signature time.
 */
async function collab(brandId, influencerId, { signed = 'both', status = 'active', aim = 'conversion', signedAt = null, campaignName = 'Campaign', setName = 'Set' } = {}) {
  const { rows: [c] } = await query(`INSERT INTO campaigns (brand_id, name, status) VALUES ($1,$2,'active') RETURNING id`, [brandId, campaignName]);
  const { rows: [s] } = await query(`INSERT INTO campaign_sets (campaign_id, name, goal, assignment_mode) VALUES ($1,$2,$3,'handpick') RETURNING id`, [c.id, setName, aim]);
  const { rows: [ci] } = await query(`INSERT INTO campaign_influencers (set_id, influencer_id, status) VALUES ($1,$2,$3) RETURNING id`, [s.id, influencerId, status]);
  const at = signedAt || new Date();
  const inf = signed === 'both' || signed === 'creator' ? at : null;
  const br = signed === 'both' || signed === 'brand' ? at : null;
  if (signed !== 'none') {
    await query(`INSERT INTO contracts (campaign_influencer_id, influencer_signed_at, brand_signed_at, status) VALUES ($1,$2,$3,'active')`, [ci.id, inf, br]);
  }
  return { campaignId: c.id, setId: s.id, campaignInfluencerId: ci.id };
}

async function product(brandId, over = {}) {
  const { rows: [p] } = await query(
    `INSERT INTO brand_products (brand_id, name, price, image_url, is_active, pushed_to_store, stock, variants_json, description)
     VALUES ($1,$2,$3,$4,COALESCE($5,true),COALESCE($6,true),$7,$8,$9) RETURNING id`,
    [brandId, over.name || `Product ${rnd()}`, over.price ?? 999, over.image_url || null, over.is_active ?? null, over.pushed_to_store ?? null,
     over.stock === undefined ? null : over.stock, over.variants_json ? JSON.stringify(over.variants_json) : null, over.description || null]
  );
  return p.id;
}

/** Make Google answer from a fixture: { [placeId]: detailsObject | null }. Returns the spy. */
function mockPlaces(fixture) {
  return jest.spyOn(places, 'details').mockImplementation(async (placeId) => (Object.prototype.hasOwnProperty.call(fixture, placeId) ? fixture[placeId] : null));
}
const PLACE = {
  hyd: { lat: 17.41, lng: 78.44, formatted_address: 'Road No 12, Banjara Hills, Hyderabad, Telangana 500034, India', name: 'Store', area_name: 'Banjara Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034' },
  delhi: { lat: 28.63, lng: 77.22, formatted_address: 'Connaught Place, New Delhi, Delhi 110001, India', name: 'Store', area_name: 'Connaught Place', city: 'New Delhi', state: 'NCT of Delhi', pincode: '110001' },
  newCity: { lat: 15.5, lng: 80.05, formatted_address: 'Main Rd, Ongolu Town, Andhra Pradesh 523001, India', name: 'Store', area_name: 'Ongolu Town', city: 'Ongolu Town', state: 'Andhra Pradesh', pincode: '523001' },
  unknownState: { lat: 1.3, lng: 103.8, formatted_address: 'Orchard Rd, Singapore', name: 'Store', area_name: 'Orchard', city: 'Singapore', state: 'Central Region', pincode: '238801' },
};

const api = {
  get: (path, token) => request(app).get(`/v1${path}`).set(auth(token)),
  post: (path, token, body) => request(app).post(`/v1${path}`).set(auth(token)).send(body || {}),
  put: (path, token, body) => request(app).put(`/v1${path}`).set(auth(token)).send(body || {}),
  patch: (path, token, body) => request(app).patch(`/v1${path}`).set(auth(token)).send(body || {}),
  del: (path, token) => request(app).delete(`/v1${path}`).set(auth(token)),
};

module.exports = { app, request, auth, query, ref, resetReference, brand, creator, setBrandPitch, setCreatorInvite, block, collab, product, mockPlaces, PLACE, api, rnd };
