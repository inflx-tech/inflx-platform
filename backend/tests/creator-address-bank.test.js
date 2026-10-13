'use strict';

/**
 * creator-address-bank-save — her delivery address in her profile, and her bank account in full.
 * Contract: features/creator-address-bank-save · 03-expected-outputs.md (A1–A9, K1–K8)
 *
 * Everything goes through the real API.
 */

const { query, api, creator, brand } = require('./helpers/item3');
const { createAdminUser } = require('./helpers/factories');
const w10 = require('./helpers/item10');
const { MSG } = require('../src/services/productionCopy');

const A = '/influencers/me/delivery-address';
const err = (r) => (r.body && r.body.error) || {};

let city; let other;
beforeAll(async () => {
  ({ rows: [city] } = await query(`SELECT id, state_id, name FROM ref_cities WHERE name = 'Guntur' LIMIT 1`));
  ({ rows: [other] } = await query(`SELECT id, state_id, name FROM ref_cities WHERE name = 'Hyderabad' LIMIT 1`));
});

const HOME = (over = {}) => ({
  name: 'Tanvi Suresh', phone: '9876511111',
  street: 'Flat 302, Sai Residency, Road No 3, Brodipet', pincode: '522002',
  stateId: city.state_id, cityId: city.id, note: 'Opposite the park gate',
  ...over,
});

/** A signed Remote collaboration, as item 11's own tests make one. */
async function remoteWorld() {
  const w = await w10.signedByBoth('conversion', { mode: 'shipment', wallet: 500000 });
  await query(`UPDATE influencers SET city_id = $2, state_id = $3 WHERE id = $1`, [w.cr.influencerId, other.id, other.state_id]);
  return w;
}
const C = (w) => `/influencers/me/invitations/${w.ciId}/remote`;

/* ═══════════════════════════════════════════ her delivery address, in her profile */

describe('her delivery address in her profile (A1–A5)', () => {
  it('A1 · with nothing kept, the form starts from her name, her login number and her profile city', async () => {
    const c = await creator({ name: 'Tanvi Suresh' });
    await query(`UPDATE influencers SET city_id = $2, state_id = $3 WHERE id = $1`, [c.influencerId, city.id, city.state_id]);
    const r = await api.get(A, c.token);
    expect(r.status).toBe(200);
    expect(r.body.data.address).toBeNull();
    expect(r.body.data.prefill).toMatchObject({ name: 'Tanvi Suresh', stateId: city.state_id, cityId: city.id, cityName: 'Guntur' });
    expect(r.body.data.prefill.phone).toMatch(/^\d{10}$/);
  });

  it('A2 · she saves it, reads it back, changes it — there is only ever one', async () => {
    const c = await creator();
    let r = await api.put(A, c.token, HOME());
    expect(r.status).toBe(200);
    expect(r.body.data.address).toMatchObject({
      name: 'Tanvi Suresh', phone: '9876511111', street: 'Flat 302, Sai Residency, Road No 3, Brodipet', pincode: '522002',
      stateId: city.state_id, cityId: city.id, cityName: 'Guntur', note: 'Opposite the park gate',
    });
    expect(r.body.data.address.stateName).toBeTruthy();
    expect((await api.get(A, c.token)).body.data.address).toMatchObject({ street: 'Flat 302, Sai Residency, Road No 3, Brodipet' });

    r = await api.put(A, c.token, HOME({ street: '14 Temple Street, Arundelpet', pincode: '522003', note: '' }));
    expect(r.body.data.address).toMatchObject({ street: '14 Temple Street, Arundelpet', pincode: '522003', note: '' });
    const { rows } = await query(`SELECT street FROM creator_delivery_addresses WHERE influencer_id = $1`, [c.influencerId]);
    expect(rows).toEqual([{ street: '14 Temple Street, Arundelpet' }]);
  });

  it('A3 · it is checked the way a Remote address is, in the same words', async () => {
    const c = await creator();
    const bad = async (over, field, message) => {
      const r = await api.put(A, c.token, HOME(over));
      expect(r.status).toBe(422);
      expect(err(r)).toMatchObject({ field, message });
    };
    await bad({ name: '' }, 'name', MSG.NAME_REQUIRED);
    await bad({ phone: '12345' }, 'phone', MSG.PHONE_REQUIRED);
    await bad({ street: '' }, 'street', MSG.STREET_REQUIRED);
    await bad({ street: 'x'.repeat(191) }, 'street', MSG.STREET_LONG);
    await bad({ pincode: '5220' }, 'pincode', MSG.PINCODE_REQUIRED);
    await bad({ stateId: null }, 'stateId', MSG.STATE_REQUIRED);
    await bad({ cityId: null }, 'cityId', MSG.CITY_REQUIRED);
    await bad({ cityId: other.id }, 'cityId', MSG.CITY_REQUIRED);          // a city from another state
    await bad({ note: 'x'.repeat(201) }, 'note', MSG.NOTE_LONG);
    expect((await api.get(A, c.token)).body.data.address).toBeNull();        // nothing was half-saved
  });

  it('A4 · she can remove it', async () => {
    const c = await creator();
    await api.put(A, c.token, HOME());
    const r = await api.del(A, c.token);
    expect(r.status).toBe(200);
    expect(r.body.data.address).toBeNull();
    expect((await api.get(A, c.token)).body.data.address).toBeNull();
  });

  it('A5 · it is hers alone — no brand, no other creator, and it is not on her profile record', async () => {
    const c = await creator();
    await api.put(A, c.token, HOME());
    const b = await brand();
    const otherCreator = await creator();
    expect((await api.get(A, b.token)).status).toBe(403);
    expect((await api.put(A, b.token, HOME())).status).toBe(403);
    expect((await api.get(A, otherCreator.token)).body.data.address).toBeNull();
    expect((await api.get(A, null)).status).toBe(401);

    const me = await api.get('/influencers/me', c.token);
    expect(JSON.stringify(me.body)).not.toMatch(/Sai Residency|522002/);
    const seen = await api.get(`/influencers/${c.influencerId}`, b.token);
    expect(JSON.stringify(seen.body)).not.toMatch(/Sai Residency|522002|9876511111/);
  });
});

/* ═══════════════════════════════════════════ the Remote form starts from it */

describe('a Remote collaboration starts from it (A6–A9)', () => {
  it('A6 · the form arrives filled with the address she keeps, whole', async () => {
    const w = await remoteWorld();
    await api.put(A, w.cr.token, HOME());
    const r = await api.get(C(w), w.cr.token);
    expect(r.body.data.shoot.prefill).toEqual({
      name: 'Tanvi Suresh', phone: '9876511111', street: 'Flat 302, Sai Residency, Road No 3, Brodipet', pincode: '522002',
      stateId: city.state_id, cityId: city.id, stateName: expect.any(String), cityName: 'Guntur',
      note: 'Opposite the park gate', fromProfile: true,
    });
  });

  it('A7 · with nothing kept it arrives as before — name, number, profile city — and says so', async () => {
    const w = await remoteWorld();
    const p = (await api.get(C(w), w.cr.token)).body.data.shoot.prefill;
    expect(p).toMatchObject({ stateId: other.state_id, cityId: other.id, fromProfile: false });
    expect(p.street).toBeUndefined();
    expect(p.pincode).toBeUndefined();
  });

  it('A8 · she changes it for one parcel: the brand gets the changed one, her profile keeps its own', async () => {
    const w = await remoteWorld();
    await api.put(A, w.cr.token, HOME());
    const sent = await api.post(`${C(w)}/address`, w.cr.token, HOME({ street: "C/o Lakshmi, 9 Mother's Lane", pincode: '522006', sizes: 'Top M', keepInProfile: true }));
    expect(sent.status).toBe(200);
    expect(sent.body.data.shoot.address).toMatchObject({ street: "C/o Lakshmi, 9 Mother's Lane", pincode: '522006' });
    // "Keep in my profile" never overwrites an address she already keeps.
    expect((await api.get(A, w.cr.token)).body.data.address).toMatchObject({ street: 'Flat 302, Sai Residency, Road No 3, Brodipet', pincode: '522002' });

    // …and changing her profile afterwards changes nothing that was sent (§28: a snapshot).
    await api.put(A, w.cr.token, HOME({ street: '14 Temple Street, Arundelpet' }));
    const again = (await api.get(C(w), w.cr.token)).body.data.shoot;
    expect(again.address).toMatchObject({ street: "C/o Lakshmi, 9 Mother's Lane", pincode: '522006' });
    const brandSees = (await api.get(`${w.url}/invitations/${w.ciId}/remote`, w.b.token)).body.data.shoot;
    expect(brandSees.address).toMatchObject({ street: "C/o Lakshmi, 9 Mother's Lane" });
  });

  it('A9 · "Keep this address in my profile" fills an empty profile; left unticked it does not', async () => {
    const w = await remoteWorld();
    let r = await api.post(`${C(w)}/address`, w.cr.token, HOME({ sizes: 'Top M', keepInProfile: true }));
    expect(r.status).toBe(200);
    expect((await api.get(A, w.cr.token)).body.data.address).toMatchObject({
      name: 'Tanvi Suresh', phone: '9876511111', street: 'Flat 302, Sai Residency, Road No 3, Brodipet', pincode: '522002', cityId: city.id, note: 'Opposite the park gate',
    });

    const w2 = await remoteWorld();
    r = await api.post(`${C(w2)}/address`, w2.cr.token, HOME({ sizes: 'Top M' }));
    expect(r.status).toBe(200);
    expect((await api.get(A, w2.cr.token)).body.data.address).toBeNull();

    // An address the courier cannot reach is refused — and is not kept either.
    const w3 = await remoteWorld();
    r = await api.post(`${C(w3)}/address`, w3.cr.token, HOME({ pincode: '522999', keepInProfile: true }));
    expect(r.status).toBe(422);
    expect((await api.get(A, w3.cr.token)).body.data.address).toBeNull();
  });
});

/* ═══════════════════════════════════════════ her bank account, in full */

const BANK = (over = {}) => ({
  bank_holder_name: 'Tanvi Suresh K', bank_account_no: '50100234567891', bank_account_no_confirm: '50100234567891',
  bank_ifsc: 'hdfc0001234', bank_name: 'HDFC Bank', bank_branch: 'Brodipet, Guntur',
  ...over,
});
const bankRow = async (id) => (await query(
  `SELECT bank_account_no, bank_ifsc, bank_holder_name, bank_name, bank_branch FROM influencers WHERE id = $1`, [id])).rows[0];

describe('her bank account (K1–K8)', () => {
  it('K1 · all five parts save together; the number is stored encrypted and nothing is sent back', async () => {
    const c = await creator();
    const r = await api.patch('/influencers/me', c.token, BANK());
    expect(r.status).toBe(200);
    const row = await bankRow(c.influencerId);
    expect(row).toMatchObject({ bank_ifsc: 'HDFC0001234', bank_holder_name: 'Tanvi Suresh K', bank_name: 'HDFC Bank', bank_branch: 'Brodipet, Guntur' });
    expect(row.bank_account_no).not.toContain('50100234567891');
    expect(row.bank_account_no).toContain(':');
    const inf = r.body.data.influencer;
    expect(inf.has_bank_account).toBe(true);
    expect(JSON.stringify(r.body)).not.toMatch(/50100234567891|Tanvi Suresh K|HDFC Bank|Brodipet, Guntur/);
    expect(JSON.stringify((await api.get('/influencers/me', c.token)).body)).not.toMatch(/50100234567891|Tanvi Suresh K|HDFC Bank|Brodipet, Guntur/);
  });

  it('K2 · the account number typed twice must agree', async () => {
    const c = await creator();
    let r = await api.patch('/influencers/me', c.token, BANK({ bank_account_no_confirm: '50100234567819' }));
    expect(r.status).toBe(422);
    expect(err(r)).toMatchObject({ field: 'bank_account_no_confirm', message: "The two account numbers don't match." });
    r = await api.patch('/influencers/me', c.token, BANK({ bank_account_no_confirm: undefined }));
    expect(err(r)).toMatchObject({ field: 'bank_account_no_confirm', message: 'Enter the account number again.' });
    expect((await bankRow(c.influencerId)).bank_account_no).toBeNull();
    // spaces typed into either box do not make them differ
    r = await api.patch('/influencers/me', c.token, BANK({ bank_account_no: '5010 0234 5678 91' }));
    expect(r.status).toBe(200);
  });

  it('K3 · every part is asked for, each with its own line', async () => {
    const c = await creator();
    const bad = async (over, field, message) => {
      const r = await api.patch('/influencers/me', c.token, BANK(over));
      expect(r.status).toBe(422);
      expect(err(r)).toMatchObject({ field, message });
    };
    await bad({ bank_holder_name: ' ' }, 'bank_holder_name', "Enter the account holder's name.");
    await bad({ bank_account_no: '', bank_account_no_confirm: '' }, 'bank_account_no', 'Enter the account number.');
    await bad({ bank_ifsc: '' }, 'bank_ifsc', 'Enter the IFSC.');
    await bad({ bank_name: '' }, 'bank_name', 'Enter the bank name.');
    await bad({ bank_branch: '' }, 'bank_branch', 'Enter the branch.');
    await bad({ bank_name: 'x'.repeat(81) }, 'bank_name', 'Keep it under 80 characters.');
    // the old two-part entry is no longer enough
    const old = await api.patch('/influencers/me', c.token, { bank_account_no: '50100234567891', bank_ifsc: 'HDFC0001234' });
    expect(old.status).toBe(422);
    expect((await bankRow(c.influencerId)).bank_account_no).toBeNull();
  });

  it('K4 · saving a new entry replaces the old one whole; other profile saves leave it alone', async () => {
    const c = await creator();
    await api.patch('/influencers/me', c.token, BANK());
    const before = await bankRow(c.influencerId);
    expect((await api.patch('/influencers/me', c.token, { bio: 'Sarees and street food' })).status).toBe(200);
    expect(await bankRow(c.influencerId)).toEqual(before);

    await api.patch('/influencers/me', c.token, BANK({ bank_holder_name: 'T Suresh', bank_account_no: '919010012345', bank_account_no_confirm: '919010012345', bank_ifsc: 'UTIB0000123', bank_name: 'Axis Bank', bank_branch: 'Lakshmipuram' }));
    expect(await bankRow(c.influencerId)).toMatchObject({ bank_ifsc: 'UTIB0000123', bank_holder_name: 'T Suresh', bank_name: 'Axis Bank', bank_branch: 'Lakshmipuram' });
  });

  it('K5 · her UPI and PAN save as before, and do not touch the bank entry', async () => {
    const c = await creator();
    await api.patch('/influencers/me', c.token, BANK());
    const before = await bankRow(c.influencerId);
    expect((await api.patch('/influencers/me', c.token, { upi_id: 'tanvi@okhdfc' })).status).toBe(200);
    expect((await api.patch('/influencers/me', c.token, { pan_number: 'ABCDE1234F' })).status).toBe(200);
    expect(await bankRow(c.influencerId)).toEqual(before);
  });
});

describe('a withdrawal carries the full bank entry to INFLX (K6–K8)', () => {
  const M = '/admin/money';
  async function withMoney() {
    const c = await creator({ name: 'Tanvi Suresh' });
    await query(`UPDATE influencers SET wallet_balance = 4000 WHERE id = $1`, [c.influencerId]);
    return c;
  }

  it('K6 · INFLX sees the name on the account, the bank and the branch beside the number and IFSC', async () => {
    const c = await withMoney();
    await api.patch('/influencers/me', c.token, BANK());
    const r = await api.post('/influencers/me/wallet/withdraw', c.token, { amount: 2500, method: 'bank' });
    expect(r.status).toBe(201);
    expect(r.body.data.withdrawal).toMatchObject({ amount: 2500, method: 'bank', sendTo: '··7891 · HDFC0001234', status: 'requested' });
    expect(JSON.stringify(r.body)).not.toMatch(/50100234567891/);

    const admin = await createAdminUser();
    const list = (await api.get(`${M}/withdrawals`, admin.token)).body.data;
    const mine = list.rows.find((x) => x.ownerId === c.influencerId);
    expect(mine).toMatchObject({ payeeName: 'Tanvi Suresh K', ifsc: 'HDFC0001234', bankName: 'HDFC Bank', bankBranch: 'Brodipet, Guntur' });
    expect(mine.account).toBeUndefined();                                   // the full number only on the one request
    const one = (await api.get(`${M}/withdrawals/${mine.id}`, admin.token)).body.data;
    expect(one).toMatchObject({ payeeName: 'Tanvi Suresh K', account: '50100234567891', ifsc: 'HDFC0001234', bankName: 'HDFC Bank', bankBranch: 'Brodipet, Guntur' });
  });

  it('K7 · a request keeps the details it was made with, whatever she saves afterwards', async () => {
    const c = await withMoney();
    await api.patch('/influencers/me', c.token, BANK());
    await api.post('/influencers/me/wallet/withdraw', c.token, { amount: 1000, method: 'bank' });
    await api.patch('/influencers/me', c.token, BANK({ bank_holder_name: 'T Suresh', bank_account_no: '919010012345', bank_account_no_confirm: '919010012345', bank_ifsc: 'UTIB0000123', bank_name: 'Axis Bank', bank_branch: 'Lakshmipuram' }));
    const { rows: [w] } = await query(`SELECT payee_name, ifsc, bank_name, bank_branch FROM withdrawal_requests WHERE influencer_id = $1`, [c.influencerId]);
    expect(w).toEqual({ payee_name: 'Tanvi Suresh K', ifsc: 'HDFC0001234', bank_name: 'HDFC Bank', bank_branch: 'Brodipet, Guntur' });
  });

  it('K8 · an account saved before this (number and IFSC only) still withdraws, under her profile name', async () => {
    const c = await withMoney();
    const { encrypt } = require('../src/utils/encrypt');
    await query(`UPDATE influencers SET bank_account_no = $2, bank_ifsc = 'SBIN0001234' WHERE id = $1`, [c.influencerId, encrypt('30211234567')]);
    const o = (await api.get('/influencers/me/wallet/withdraw', c.token)).body.data;
    expect(o.blocked).toBeNull();
    const r = await api.post('/influencers/me/wallet/withdraw', c.token, { amount: 500, method: 'bank' });
    expect(r.status).toBe(201);
    const { rows: [w] } = await query(`SELECT payee_name, bank_name, bank_branch FROM withdrawal_requests WHERE influencer_id = $1`, [c.influencerId]);
    expect(w).toEqual({ payee_name: 'Tanvi Suresh', bank_name: null, bank_branch: null });

    // a UPI request carries no bank at all
    const u = await withMoney();
    await api.patch('/influencers/me', u.token, BANK());
    await api.patch('/influencers/me', u.token, { upi_id: 'tanvi@okhdfc' });
    await api.post('/influencers/me/wallet/withdraw', u.token, { amount: 500, method: 'upi' });
    const { rows: [x] } = await query(`SELECT method, payee_name, account_enc, bank_name, bank_branch FROM withdrawal_requests WHERE influencer_id = $1`, [u.influencerId]);
    expect(x).toEqual({ method: 'upi', payee_name: 'Tanvi Suresh', account_enc: null, bank_name: null, bank_branch: null });
  });
});
