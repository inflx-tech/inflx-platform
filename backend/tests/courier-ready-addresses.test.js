'use strict';

/**
 * Courier-ready addresses — a store's address is held to what a courier will accept.
 * Contract: features/courier-ready-addresses · checks 1–8, 12, 13
 *
 * Shiprocket refuses a pickup address shorter than 10 characters or with no number in it. On
 * 6 Oct 2026 that was ten of the fourteen store branches on the live platform. So the rule is
 * applied where a store address is TYPED (registration, Add / Edit branch, the website's
 * profile), and where it MATTERS (pricing and booking a parcel) — each time with a sentence
 * that says what to add.
 */

const { query, api, ref, brand } = require('./helpers/item3');
const { createBrandUser } = require('./helpers/factories');
const w10 = require('./helpers/item10');
const branches = require('../src/services/brandBranches.service');
const { MSG } = require('../src/services/productionCopy');

const NO_NUMBER = 'Add the shop or door number. Couriers need it to find the store.';
const TOO_SHORT = 'Add the shop or door number, building and street. A courier has to find it.';

const place = async (city = 'Vijayawada') => {
  const { rows: [c] } = await query(`SELECT id, state_id FROM ref_cities WHERE name = $1 LIMIT 1`, [city]);
  return { city_id: c.id, state_id: c.state_id };
};
const branchesOf = async (b) => (await api.get('/brands/me/branches', b.token)).body.data.branches;
const mainOf = async (b) => (await branchesOf(b)).find((x) => x.isMain);
/** A brand whose Main Branch carries an address typed BEFORE the rule existed. */
async function brandWithOldAddress(text) {
  const b = await brand();
  await query(`UPDATE brand_branches SET formatted_address = $2 WHERE brand_id = $1 AND is_main`, [b.brandId, text]);
  return b;
}
const walletOf = async (id) => Number((await query(`SELECT wallet_balance FROM brands WHERE id=$1`, [id])).rows[0].wallet_balance);

/* ═════════════════════════════════════════ the rule itself (check 1) */

describe('1 · what a courier can find', () => {
  const ok = (t) => expect(branches.streetProblem(t)).toBeNull();
  const bad = (t, code) => expect(branches.streetProblem(t)).toBe(code);

  it('a shop, door, plot or road number makes an address', () => {
    ok('Shop 12, Sri Sai Complex, Road No 3, KPHB Phase 1, Kukatpally');
    ok('5-38-62/A, Pandaripuram, Brodipet');
    ok('Plot 8, Road 36');
    ok('6th lane 19th cross road brodipet');
    ok('D.No 40-1-52, MG Road, Benz Circle, Vijayawada 520010');
  });

  it('the live addresses a courier would have refused are refused', () => {
    bad('Benz Circle, Vijayawada', 'BRANCH_ADDRESS_NUMBER');
    bad('Guntur, Andhra Pradesh, India', 'BRANCH_ADDRESS_NUMBER');
    bad('Karnal, Haryana, India', 'BRANCH_ADDRESS_NUMBER');
    bad('Vsn mall, Besides SBI NRI branch,near benz circle, Gayatri nagar', 'BRANCH_ADDRESS_NUMBER');
    bad('Dhuri', 'BRANCH_ADDRESS_SHORT');
    bad('', 'BRANCH_ADDRESS_REQUIRED');
    bad('   ', 'BRANCH_ADDRESS_REQUIRED');
  });

  it('a pincode is not a shop number', () => {
    bad('MG Road, Vijayawada 520010', 'BRANCH_ADDRESS_NUMBER');
    bad('MG Road, Vijayawada - 520010, India', 'BRANCH_ADDRESS_NUMBER');
    ok('12 MG Road, Vijayawada 520010');
  });

  it('10 to 140 characters', () => {
    expect('Shop 4, MG'.length).toBe(10);
    ok('Shop 4, MG');                                        // exactly ten, and it has its number
    bad('Shop 4 MG', 'BRANCH_ADDRESS_SHORT');                // nine
    const at140 = `Shop 12, ${'A'.repeat(131)}`;
    expect(at140.length).toBe(140);
    ok(at140);
    bad(`${at140}B`, 'BRANCH_ADDRESS_LONG');
  });

  it('each refusal has its own sentence', () => {
    expect(branches.streetMessage('BRANCH_ADDRESS_NUMBER')).toBe(NO_NUMBER);
    expect(branches.streetMessage('BRANCH_ADDRESS_SHORT')).toBe(TOO_SHORT);
    expect(branches.streetMessage('BRANCH_ADDRESS_LONG')).toBe('Keep the address under 140 characters.');
    expect(branches.streetMessage('BRANCH_ADDRESS_REQUIRED')).toBe('Enter the street address.');
  });

  it('an address written before the rule is not refused for its length alone', () => {
    const long = `Shop 12, ${'A'.repeat(180)}`;                // 189 — legal when it was saved
    expect(branches.streetProblem(long)).toBe('BRANCH_ADDRESS_LONG');
    expect(branches.courierProblem({ formatted_address: long, pincode: '500072' })).toBeNull();
  });
});

/* ═════════════════════════════════════════ registration (checks 2, 3) */

describe('registration', () => {
  const body = async (over = {}) => ({
    name: 'Ravi Kumar', business_name: `Label ${Math.random().toString(36).slice(2, 8)}`,
    sub_categories: ['WOMEN'], pincode: '520010', ...(await place()), ...over,
  });

  it('2 · a store address with no shop or door number is refused, in that sentence, and nothing is created', async () => {
    const { token, user } = await createBrandUser();
    const r = await api.post('/brands/register', token, await body({ address_line: 'Benz Circle, Vijayawada' }));
    expect(r.status).toBe(422);
    expect(r.body.error).toMatchObject({ code: 'VALIDATION_ERROR', field: 'address_line', message: NO_NUMBER });
    expect((await query(`SELECT 1 FROM brands WHERE user_id = $1`, [user.id])).rows).toHaveLength(0);

    const short = await api.post('/brands/register', token, await body({ address_line: 'Dhuri' }));
    expect(short.status).toBe(422);
    expect(short.body.error.message).toBe(TOO_SHORT);
    expect((await query(`SELECT 1 FROM brands WHERE user_id = $1`, [user.id])).rows).toHaveLength(0);
  });

  it('3 · a complete address registers, and the Main Branch carries it', async () => {
    const { token } = await createBrandUser();
    const r = await api.post('/brands/register', token, await body({ address_line: 'Shop 4, MG Road, Benz Circle' }));
    expect(r.status).toBe(201);
    const main = (await api.get('/brands/me/branches', token)).body.data.branches.find((x) => x.isMain);
    expect(main).toMatchObject({
      name: 'Main Branch', formattedAddress: 'Shop 4, MG Road, Benz Circle', pincode: '520010',
      landmark: null, phone: null, courierReady: true, courierProblem: null,
    });
  });
});

/* ═════════════════════════════════════════ Add / Edit branch (checks 4, 5, 6, 13) */

describe('Add and Edit branch', () => {
  it('4 · adding a branch with no shop or door number is refused; a complete one saves', async () => {
    const b = await brand();
    const p = await place('Guntur');
    const bad = await api.post('/brands/me/branches', b.token, { name: 'Guntur store', address_text: 'Guntur, Andhra Pradesh, India', pincode: '522006', ...p, is_main: false });
    expect(bad.status).toBe(422);
    expect(bad.body.error).toMatchObject({ field: 'address_text', message: NO_NUMBER });
    expect(bad.body.error.details.fields[0].code).toBe('BRANCH_ADDRESS_NUMBER');
    expect(await branchesOf(b)).toHaveLength(1);

    const good = await api.post('/brands/me/branches', b.token, { name: 'Guntur store', address_text: '5-38-62/A, Pandaripuram, Brodipet', pincode: '522002', ...p, is_main: false });
    expect(good.status).toBe(201);
    expect(good.body.data.branch).toMatchObject({ formattedAddress: '5-38-62/A, Pandaripuram, Brodipet', courierReady: true });
  });

  it('4 · editing a branch is held to the same rule — an old address must be completed to be saved again', async () => {
    const b = await brandWithOldAddress('Benz Circle, Vijayawada');
    const main = await mainOf(b);
    expect(main).toMatchObject({ courierReady: false, courierProblem: 'Needs a shop or door number' });

    const same = await api.put(`/brands/me/branches/${main.id}`, b.token, { name: 'Flagship', address_text: main.formattedAddress, pincode: '520010' });
    expect(same.status).toBe(422);
    expect(same.body.error.message).toBe(NO_NUMBER);
    expect((await mainOf(b)).name).toBe('Main Branch');           // nothing was half-saved

    const fixed = await api.put(`/brands/me/branches/${main.id}`, b.token, { name: 'Flagship', address_text: 'D.No 40-1-52, MG Road, Benz Circle', pincode: '520010' });
    expect(fixed.status).toBe(200);
    expect(fixed.body.data.branch).toMatchObject({ name: 'Flagship', courierReady: true, courierProblem: null });
  });

  it('5 · a landmark and a store phone save and come back', async () => {
    const b = await brand();
    const main = await mainOf(b);
    const r = await api.put(`/brands/me/branches/${main.id}`, b.token, { landmark: '  Opposite JNTU metro station ', phone: '+91 98765 43210' });
    expect(r.status).toBe(200);
    expect(r.body.data.branch).toMatchObject({ landmark: 'Opposite JNTU metro station', phone: '9876543210' });
    expect(await mainOf(b)).toMatchObject({ landmark: 'Opposite JNTU metro station', phone: '9876543210' });
  });

  it('5 · an app that sends neither leaves both as they are; sending them empty clears them', async () => {
    const b = await brand();
    const main = await mainOf(b);
    await api.put(`/brands/me/branches/${main.id}`, b.token, { landmark: 'Near the clock tower', phone: '9876543210' });

    // What a phone on the previous app version sends: the four parts and the name, nothing else.
    const old = await api.put(`/brands/me/branches/${main.id}`, b.token, { name: 'Main Branch', address_text: main.formattedAddress, pincode: main.pincode, state_id: main.stateId, city_id: main.cityId });
    expect(old.status).toBe(200);
    expect(old.body.data.branch).toMatchObject({ landmark: 'Near the clock tower', phone: '9876543210' });

    const cleared = await api.put(`/brands/me/branches/${main.id}`, b.token, { landmark: '', phone: '' });
    expect(cleared.body.data.branch).toMatchObject({ landmark: null, phone: null });
  });

  it('5 · a landmark that is too long and a phone that is not a mobile are refused in words', async () => {
    const b = await brand();
    const main = await mainOf(b);
    const long = await api.put(`/brands/me/branches/${main.id}`, b.token, { landmark: 'L'.repeat(46) });
    expect(long.status).toBe(422);
    expect(long.body.error).toMatchObject({ field: 'landmark', message: 'Keep the landmark under 45 characters.' });
    expect((await api.put(`/brands/me/branches/${main.id}`, b.token, { landmark: 'L'.repeat(45) })).status).toBe(200);

    for (const phone of ['12345', '1234567890', '98765432109876', 'not a number']) {
      const r = await api.put(`/brands/me/branches/${main.id}`, b.token, { phone });
      expect(r.status).toBe(422);
      expect(r.body.error).toMatchObject({ field: 'phone', message: 'Enter a 10-digit mobile number.' });
    }
  });

  it('6 · every branch says whether a courier would collect from it, and if not, why', async () => {
    const none = await brandWithOldAddress(null);
    expect(await mainOf(none)).toMatchObject({ courierReady: false, courierProblem: 'Needs a street address and pincode' });

    const vague = await brandWithOldAddress('Guntur, Andhra Pradesh, India');
    expect(await mainOf(vague)).toMatchObject({ courierReady: false, courierProblem: 'Needs a shop or door number' });

    const fine = await brand();
    expect(await mainOf(fine)).toMatchObject({ courierReady: true, courierProblem: null });
  });

  it('13 · the city refusal asks for the city, not the "nearest major city"', async () => {
    const b = await brand();
    const r = await api.post('/brands/me/branches', b.token, { name: 'Second', address_text: 'Shop 9, Station Road', pincode: '522002', is_main: false });
    expect(r.status).toBe(422);
    expect(r.body.error.message).toBe('Pick the state, then the city.');
    expect(JSON.stringify(branches.MSG)).not.toMatch(/nearest major city/i);
  });
});

/* ═════════════════════════════════════════ the website's profile save (check 7) */

describe('7 · the brand profile (the website and the app share it)', () => {
  it('a new address is held to the rule', async () => {
    const b = await brand();
    const p = await place('Guntur');
    const bad = await api.patch('/brands/me', b.token, { address_line: 'Guntur, Andhra Pradesh, India', pincode: '522006', ...p });
    expect(bad.status).toBe(422);
    expect(bad.body.error.message).toBe(NO_NUMBER);

    const good = await api.patch('/brands/me', b.token, { address_line: 'Shop 9, Station Road, Brodipet', pincode: '522002', ...p });
    expect(good.status).toBe(200);
    expect((await mainOf(b)).formattedAddress).toBe('Shop 9, Station Road, Brodipet');
  });

  it('…but a brand with an old address can still change everything else', async () => {
    const b = await brandWithOldAddress('Benz Circle, Vijayawada');
    const r = await api.patch('/brands/me', b.token, { about: 'Handloom sarees since 1998.' });
    expect(r.status).toBe(200);
    expect((await mainOf(b)).formattedAddress).toBe('Benz Circle, Vijayawada');     // untouched, not re-judged
  });
});

/* ═════════════════════════════════════════ pricing and booking a parcel (check 8) */

describe('8 · a parcel is not booked from an address a courier cannot find', () => {
  async function world() {
    const w = await w10.signedByBoth('engagement', { mode: 'shipment', wallet: 500000 });
    const { rows: [city] } = await query(`SELECT id, state_id FROM ref_cities WHERE name = 'Guntur' LIMIT 1`);
    await query(`UPDATE influencers SET city_id = $2, state_id = $3 WHERE id = $1`, [w.cr.influencerId, city.id, city.state_id]);
    const { rows: [p] } = await query(
      `INSERT INTO brand_products (brand_id, name, price, sku, is_active, pushed_to_store)
       VALUES ($1,'Indigo Chanderi Saree',2400,$2,true,true) RETURNING *`, [w.brandId, `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`]);
    const B = `${w.url}/invitations/${w.ciId}/remote`;
    const C = `/influencers/me/invitations/${w.ciId}/remote`;
    await api.post(`${C}/address`, w.cr.token, { name: 'Tanvi Suresh', phone: '9876511111', street: '11 Gandhi Road, Brodipet', pincode: '522002', stateId: city.state_id, cityId: city.id });
    await api.put(`${B}/lines`, w.b.token, { lines: [{ productId: p.id, quantity: 1, disposition: 'gift' }] });
    return { ...w, B, C, city };
  }
  const ask = { boxPreset: 'medium', weightKg: 1.2 };

  it('pricing and booking both refuse, naming the branch and the fix; nothing is charged', async () => {
    const w = await world();
    await query(`UPDATE brand_branches SET formatted_address = 'Guntur, Andhra Pradesh, India' WHERE id = $1`, [w.br.id]);
    const before = await walletOf(w.brandId);
    const sentence = MSG.BRANCH_ADDRESS_INCOMPLETE(w.br.name);
    expect(sentence).toMatch(/Add the shop or door number to .+ first — the courier needs it to find the store\./);

    const quote = await api.post(`${w.B}/quote`, w.b.token, { branchId: w.br.id, ...ask });
    expect(quote.status).toBe(422);
    expect(quote.body.error).toMatchObject({ code: 'BRANCH_ADDRESS_INCOMPLETE', field: 'branchId', message: sentence });

    const book = await api.post(`${w.B}/book`, w.b.token, { branchId: w.br.id, ...ask });
    expect(book.status).toBe(422);
    expect(book.body.error.code).toBe('BRANCH_ADDRESS_INCOMPLETE');
    expect(await walletOf(w.brandId)).toBe(before);
    expect((await query(`SELECT 1 FROM shipments s JOIN production_events pe ON pe.id = s.production_event_id WHERE pe.contract_id = $1`, [w.con.id])).rows).toHaveLength(0);
  });

  it('once the branch is completed, the same button books — and the parcel carries the store’s phone and landmark', async () => {
    const w = await world();
    await query(`UPDATE brand_branches SET formatted_address = 'Guntur, Andhra Pradesh, India' WHERE id = $1`, [w.br.id]);
    expect((await api.post(`${w.B}/book`, w.b.token, { branchId: w.br.id, ...ask })).status).toBe(422);

    const fixed = await api.put(`/brands/me/branches/${w.br.id}`, w.b.token, { address_text: 'Shop 9, Station Road, Brodipet', pincode: '522002', landmark: 'Opposite the head post office', phone: '9000012345' });
    expect(fixed.status).toBe(200);

    const book = await api.post(`${w.B}/book`, w.b.token, { branchId: w.br.id, ...ask });
    expect(book.status).toBe(200);
    const { rows: [parcel] } = await query(
      `SELECT s.* FROM shipments s JOIN production_events pe ON pe.id = s.production_event_id WHERE pe.contract_id = $1`, [w.con.id]);
    expect(parcel.from_street).toBe('Shop 9, Station Road, Brodipet, Opposite the head post office');
    expect(parcel.from_phone).toBe('9000012345');
  });

  it('a branch with no store phone of its own goes on using the brand’s login number', async () => {
    const w = await world();
    const { rows: [u] } = await query(`SELECT u.phone FROM users u JOIN brands b ON b.user_id = u.id WHERE b.id = $1`, [w.brandId]);
    expect((await api.post(`${w.B}/book`, w.b.token, { branchId: w.br.id, ...ask })).status).toBe(200);
    const { rows: [parcel] } = await query(
      `SELECT s.* FROM shipments s JOIN production_events pe ON pe.id = s.production_event_id WHERE pe.contract_id = $1`, [w.con.id]);
    expect(parcel.from_phone).toBe(u.phone);
  });
});

/* ═════════════════════════════════════════ the creator's street (check 12) */

describe('12 · a creator’s delivery street stops at what a courier keeps', () => {
  it('190 characters are accepted, 191 are refused in words', async () => {
    const w = await w10.signedByBoth('engagement', { mode: 'shipment', wallet: 500000 });
    const { rows: [city] } = await query(`SELECT id, state_id FROM ref_cities WHERE name = 'Guntur' LIMIT 1`);
    const C = `/influencers/me/invitations/${w.ciId}/remote`;
    const base = { name: 'Tanvi Suresh', phone: '9876511111', pincode: '522002', stateId: city.state_id, cityId: city.id };

    const over = await api.post(`${C}/address`, w.cr.token, { ...base, street: `Flat 302, ${'A'.repeat(181)}` });
    expect(`Flat 302, ${'A'.repeat(181)}`.length).toBe(191);
    expect(over.status).toBe(422);
    expect(over.body.error).toMatchObject({ field: 'street', message: 'Keep it under 190 characters.' });
    expect(MSG.STREET_LONG).toBe('Keep it under 190 characters.');

    const at = await api.post(`${C}/address`, w.cr.token, { ...base, street: `Flat 302, ${'A'.repeat(180)}` });
    expect(at.status).toBe(200);
  });
});

// `ref` is imported so the reference lists are warm for `place()` on a cold database.
void ref;
