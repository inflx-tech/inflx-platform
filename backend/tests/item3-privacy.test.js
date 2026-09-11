'use strict';

/**
 * Item 3 — the four privacy leaks the item-2 report found, all closed (founder decision):
 *   1. /brands/:id/public no longer carries the street address (covered again here);
 *   2. the shopper store's listing_data is a whitelist — never branches, phones, addresses;
 *   3. creator search and detail are approved-only, with no hard-coded "verified" flag;
 *   4. the find-brands facets no longer expose accepts_proposals.
 * Contract: features/item3-discovery-profiles-groups
 */

const { truncateAll } = require('./helpers/db');
const { query, resetReference, brand, creator, product, api } = require('./helpers/item3');
const followerService = require('../src/services/follower.service');

beforeEach(async () => { await truncateAll(); await resetReference(); });

describe('privacy', () => {
  it('1. the brand overview has no address, pincode, phone, GSTIN, email or contact person', async () => {
    const b = await brand();
    const c = await creator();
    const r = await api.get(`/brands/${b.brandId}/public`, c.token);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(/address_line|formatted_address|"pincode"|gstin|"phone"|login_phone|business_phone|email|contact_person|listing_data/i);
  });

  it('2. the shopper store whitelists listing_data — branches, phones and addresses never reach a shopper (check 26)', async () => {
    const b = await brand();
    await product(b.brandId);
    await query(
      `UPDATE brands SET listing_data = $2::jsonb, phone = '+911234567890' WHERE id = $1`,
      [b.brandId, JSON.stringify({
        contact_person_name: 'Kiran Rao',
        branches: [{ name: 'Main Branch', address: '12 Secret Lane', phone: '+919999999999', pincode: '500001', city: 'Hyderabad' }],
        hours_json: { mon: '10-8' }, cuisines: ['x'], cost_for_two: 500, description: 'Public words',
      })]);
    const store = await followerService.resolveBusinessStore(b.brandId);
    expect(store).toBeTruthy();
    const brandBlob = JSON.stringify(store.brand || store);
    expect(brandBlob).not.toMatch(/Secret Lane|9999999999|contact_person_name|"branches"/);
    const ld = (store.brand && store.brand.listing_data) || store.listing_data || {};
    expect(ld.branches).toBeUndefined();
    expect(ld.contact_person_name).toBeUndefined();
  });

  it('3. creator search lists approved creators only and never a hard-coded verified flag for the unapproved', async () => {
    const b = await brand();
    const ok = await creator({ name: 'Approved One' });
    await creator({ name: 'Pending One', status: 'pending' });
    await creator({ name: 'Suspended One', status: 'suspended' });
    const r = await api.get('/influencers/search', b.token);
    expect(r.status).toBe(200);
    expect(r.body.data.creators.map(x => x.linked_influencer_id || x.id)).toEqual([ok.influencerId]);
    const detail = await api.get(`/influencers/${ok.influencerId}`, b.token);
    expect(detail.status).toBe(200);
    expect(detail.body.data.influencer.is_inflx_verified).toBe(true);
    expect(detail.body.data.influencer.verification_status).toBe('approved');
    expect(JSON.stringify(detail.body)).not.toMatch(/upi_id|bank_account_no|pan_number|"email"|"phone"/i);
  });

  it('4. the legacy find-brands facets carry no accepts_proposals', async () => {
    const c = await creator();
    await brand();
    const r = await api.get('/influencers/me/discover-brands', c.token);
    expect(r.status).toBe(200);
    expect(JSON.stringify(r.body)).not.toMatch(/accepts_proposals|acceptsProposals/);
  });
});
