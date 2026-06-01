'use strict';

/**
 * QA — referral-agency-admin. Asserts GET /admin/agencies (directory list with
 * status filter, search, wallet/earnings/code/active-edge count, RBAC, empty)
 * per features/referral-agency-admin/03-expected-outputs.md. Approve/reject is
 * the C3a PATCH (re-asserted here via the list moving rows between filters).
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { loginUser, createAdminUser, createBrandUser, registerBrand } = require('./helpers/factories');
const referralService = require('../src/services/referral.service');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
let seq = 0;
const agencyPhone = () => `+9196${String(seq += 1).padStart(8, '0')}`;

async function makeAgency(name = 'Vizag Media Partners') {
  const { token, user } = await loginUser(agencyPhone(), 'agency', name);
  const res = await request(app).post('/v1/agencies/register').set(auth(token))
    .send({ agency_name: name, contact_person: 'Ravi', city: 'Visakhapatnam' });
  return { token, user, agency: res.body.data.agency };
}
async function adminToken() { return (await createAdminUser('reviewer')).token; }
async function approve(agencyId, tk) {
  return request(app).patch(`/v1/admin/agencies/${agencyId}/status`).set(auth(tk)).send({ status: 'approved' });
}

beforeEach(async () => { await truncateAll(); });

describe('GET /admin/agencies', () => {
  test('empty → [] + zero total', async () => {
    const tk = await adminToken();
    const res = await request(app).get('/v1/admin/agencies').set(auth(tk));
    expect(res.status).toBe(200);
    expect(res.body.data.agencies).toEqual([]);
    expect(res.body.meta.total).toBe(0);
  });

  test('lists pending agency; approve moves it between status filters', async () => {
    const tk = await adminToken();
    const { agency } = await makeAgency();

    const pend = await request(app).get('/v1/admin/agencies?status=pending').set(auth(tk));
    expect(pend.body.meta.total).toBe(1);
    expect(pend.body.data.agencies[0].user_status).toBe('pending');

    await approve(agency.id, tk);

    const stillPending = await request(app).get('/v1/admin/agencies?status=pending').set(auth(tk));
    expect(stillPending.body.meta.total).toBe(0);
    const approved = await request(app).get('/v1/admin/agencies?status=approved').set(auth(tk));
    expect(approved.body.meta.total).toBe(1);
    expect(approved.body.data.agencies[0].id).toBe(agency.id);
  });

  test('approved row carries wallet, earnings, code, active_edges', async () => {
    const tk = await adminToken();
    const { agency } = await makeAgency();
    await approve(agency.id, tk);

    // seed a code + an active edge to a brand + a settled accrual
    await referralService.getOrCreateCode('agency', agency.id);
    const { token: bt, user: bu } = await createBrandUser();
    await registerBrand(bt);
    await query(`UPDATE users SET status='approved' WHERE id=$1`, [bu.id]);
    const { rows: br } = await query(`SELECT id FROM brands WHERE user_id=$1`, [bu.id]);
    await referralService.createEdge({
      referrerType: 'agency', referrerId: agency.id,
      referredType: 'brand', referredId: br[0].id, pct: 25, source: 'admin',
    });
    await referralService.accrue({
      source: 'subscription', sourceRefId: '00000000-0000-0000-0000-00000000ad01',
      referredType: 'brand', referredId: br[0].id, baseAmount: 10000,
    });

    const res = await request(app).get('/v1/admin/agencies?status=approved').set(auth(tk));
    const row = res.body.data.agencies[0];
    expect(parseFloat(row.wallet_balance)).toBe(2500);
    expect(parseFloat(row.referral_earned_total)).toBe(2500);
    expect(row.referral_code).toMatch(/^INFLX-/);
    expect(row.active_edges).toBe(1);
  });

  test('search filters by agency name', async () => {
    const tk = await adminToken();
    await makeAgency('Vizag Media Partners');
    await makeAgency('Coastal Reach Agency');
    const res = await request(app).get('/v1/admin/agencies?search=Coastal').set(auth(tk));
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data.agencies[0].agency_name).toBe('Coastal Reach Agency');
  });

  test('RBAC: non-admin (brand) → 403; any admin role can view', async () => {
    const { token: brandTok } = await createBrandUser();
    const forbidden = await request(app).get('/v1/admin/agencies').set(auth(brandTok));
    expect(forbidden.status).toBe(403);

    const fin = (await createAdminUser('finance')).token;
    const ok = await request(app).get('/v1/admin/agencies').set(auth(fin));
    expect(ok.status).toBe(200);
  });
});
