'use strict';

/**
 * Item 10 — shared fixtures for the shoot-plan suite.
 * Contract: features/item10-store-visit
 *
 * Everything goes through the real API: a brand, a campaign, a Store Visit set on a branch WITH
 * a street address, a creator, an invitation she accepts, the agreement sent and signed by both.
 * That is the state every item 10 door acts on. The money moves for real (test database), so
 * the funded half of the gate is proved against escrow rows, not a flag.
 */

const { query, brand, creator, api } = require('./item3');
const { todayInIndia, addDays } = require('../../src/utils/indiaDay');

const day = (n) => addDays(todayInIndia(), n);

const SALE = { commissionPct: 12, scope: 'store' };
const CONTENT = { fee: 9000, deliverables: [{ type: 'reel', count: 1 }, { type: 'story', count: 2 }] };
const HYBRID = { fee: 5000, commissionPct: 10, scope: 'store' };
const SIG = { typedName: 'Tanvi Suresh', ticks: [true, true] };
const BSIG = { typedName: 'Ravi Menon', ticks: [true, true] };

/** A branch straight into the table. `address: null` makes one the item 10 rules refuse. */
async function branch(brandId, { name = 'Banjara Hills', address = 'Road No. 12, Banjara Hills, Hyderabad, Telangana 500034, India', city = 'Hyderabad', main = false } = {}) {
  const { rows: [c] } = await query(`SELECT id, state_id FROM ref_cities WHERE name = $1 LIMIT 1`, [city]);
  const { rows: [b] } = await query(
    `INSERT INTO brand_branches (brand_id, name, formatted_address, pincode, lat, lng, city_id, state_id, is_main)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [brandId, name, address, address ? '500034' : null, address ? 17.41 : null, address ? 78.44 : null, c ? c.id : null, c ? c.state_id : null, main]
  );
  return b;
}

async function campaign(b, over = {}) {
  const r = await api.post('/campaigns', b.token, { name: 'Diwali Edit 2026', ...over });
  if (r.status !== 201) throw new Error(`campaign: ${JSON.stringify(r.body)}`);
  return r.body.data.campaign;
}
async function set(b, campaignId, over = {}) {
  const r = await api.post(`/campaigns/${campaignId}/sets`, b.token, { name: 'Set A', goal: 'engagement', shoot_mode: 'visit', go_live_date: day(12), ...over });
  if (r.status !== 201) throw new Error(`set: ${JSON.stringify(r.body)}`);
  return r.body.data.set;
}

/**
 * A brand, a campaign, a Store Visit set on an addressed branch, a creator, one accepted
 * invitation, and the brand's wallet loaded. `mode: 'shipment'` makes a Remote one.
 */
async function world(goal = 'engagement', { terms = null, setOver = {}, mode = 'visit', wallet = 500000, branchOver = {} } = {}) {
  const b = await brand();
  const br = await branch(b.brandId, branchOver);
  const c = await campaign(b);
  const s = await set(b, c.id, { goal, shoot_mode: mode, ...(mode === 'visit' ? { branch_id: br.id } : {}), ...setOver });
  const cr = await creator({ name: 'Tanvi Suresh' });
  // creator-terms-v2: selling terms are offers + products without offers (helpers/sell.js).
  const t = await require('./sell').sellable(b.brandId, terms || (goal === 'engagement' ? CONTENT : goal === 'hybrid' ? HYBRID : SALE));
  const r = await api.post(`/campaigns/${c.id}/sets/${s.id}/invitations`, b.token, { creators: [{ influencerId: cr.influencerId, terms: t }] });
  if (r.status !== 201) throw new Error(`invite: ${JSON.stringify(r.body)}`);
  const ciId = r.body.data.rows[0].id;
  await api.post(`/influencers/me/invitations/${ciId}/accept`, cr.token);
  await query(`UPDATE brands SET wallet_balance = $2 WHERE id = $1`, [b.brandId, wallet]);
  return { b, br, c, s, cr, ciId, brandId: b.brandId, url: `/campaigns/${c.id}/sets/${s.id}`, goal, mode };
}

const send = (w) => api.post(`${w.url}/invitations/${w.ciId}/agreement/send`, w.b.token);
const herSign = (w) => api.post(`/influencers/me/invitations/${w.ciId}/agreement/sign`, w.cr.token, SIG);
const brandSign = (w) => api.post(`${w.url}/invitations/${w.ciId}/agreement/sign`, w.b.token, BSIG);

/** Sent, signed by her, signed by the brand — money locked and tranche 1 out where the aim has money. */
async function signedByBoth(goal = 'engagement', opts = {}) {
  const w = await world(goal, opts);
  const s = await send(w); if (s.status !== 201) throw new Error(`send: ${JSON.stringify(s.body)}`);
  const h = await herSign(w); if (h.status !== 200) throw new Error(`herSign: ${JSON.stringify(h.body)}`);
  const bs = await brandSign(w); if (bs.status !== 200) throw new Error(`brandSign: ${JSON.stringify(bs.body)}`);
  const con = (await query(`SELECT * FROM contracts WHERE campaign_influencer_id = $1`, [w.ciId])).rows[0];
  const pe = (await query(`SELECT * FROM production_events WHERE contract_id = $1`, [con.id])).rows[0] || null;
  return { ...w, con, pe };
}

/** Sent and signed by her only — a contract exists, the brand has not signed, nothing is locked. */
async function signedByHer(goal = 'engagement', opts = {}) {
  const w = await world(goal, opts);
  await send(w); await herSign(w);
  const con = (await query(`SELECT * FROM contracts WHERE campaign_influencer_id = $1`, [w.ciId])).rows[0];
  return { ...w, con, pe: null };
}

const con = async (ciId) => (await query(`SELECT * FROM contracts WHERE campaign_influencer_id = $1`, [ciId])).rows[0];
const pe = async (contractId) => (await query(`SELECT * FROM production_events WHERE contract_id = $1`, [contractId])).rows[0] || null;
const escrow = async (ciId) => (await query(`SELECT * FROM escrow_entries WHERE campaign_influencer_id = $1 ORDER BY tranche_number`, [ciId])).rows;

/** Everything money: balances and the ledgers, as one comparable object. */
async function moneySnapshot(w) {
  const b = (await query(`SELECT wallet_balance FROM brands WHERE id = $1`, [w.brandId])).rows[0];
  const i = (await query(`SELECT wallet_balance, pending_balance, total_earned FROM influencers WHERE id = $1`, [w.cr.influencerId])).rows[0];
  const e = (await query(`SELECT tranche_number, amount, status, released_at FROM escrow_entries WHERE campaign_influencer_id = $1 ORDER BY tranche_number`, [w.ciId])).rows;
  const t = (await query(`SELECT type, amount, direction FROM wallet_transactions WHERE brand_id = $1 ORDER BY created_at, type`, [w.brandId])).rows;
  const l = (await query(`SELECT count(*)::int n FROM influencer_transactions WHERE influencer_id = $1`, [w.cr.influencerId]).catch(() => ({ rows: [{ n: null }] }))).rows[0];
  return JSON.stringify({ b, i, e, t, l });
}

module.exports = { day, SALE, CONTENT, HYBRID, SIG, BSIG, branch, campaign, set, world, send, herSign, brandSign, signedByBoth, signedByHer, con, pe, escrow, moneySnapshot };
