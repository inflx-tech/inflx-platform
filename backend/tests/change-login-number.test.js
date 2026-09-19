'use strict';

/**
 * change-login-number — checks 1–12 of 03-expected-outputs.md.
 * Contract: features/change-login-number
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const { query } = require('./helpers/db');
const { createBrandUser, createInfluencerUser, latestOtp } = require('./helpers/factories');
const changePhone = require('../src/controllers/changePhone.controller');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const post = (path, token, body) => request(app).post(`/v1${path}`).set(token ? auth(token) : {}).send(body || {});
let n = 0;
const freshPhone = () => `+9198765${String(10000 + (n += 1)).slice(-5)}`;

beforeEach(async () => { await truncateAll(); changePhone._attempts.clear(); });

/** Walk the first two steps for a user; returns the change token. */
async function verifiedOld(u) {
  let r = await post('/auth/change-phone/start', u.token);
  expect(r.status).toBe(200);
  const code = await latestOtp(u.user.phone);
  r = await post('/auth/change-phone/verify-old', u.token, { otp: code });
  expect(r.status).toBe(200);
  return r.body.data.change_token;
}

describe('the old number first (checks 1–3)', () => {
  it('start sends a code to the current number; unauthenticated is refused', async () => {
    const u = await createBrandUser();
    expect((await post('/auth/change-phone/start')).status).toBe(401);
    const r = await post('/auth/change-phone/start', u.token);
    expect(r.status).toBe(200);
    expect(r.body.data.sent_to).toBe(u.user.phone);
    expect(await latestOtp(u.user.phone)).toMatch(/^\d{6}$/);
  });

  it('a wrong code is refused; five wrong codes end the attempt; the right code hands over a change token once', async () => {
    const u = await createBrandUser();
    await post('/auth/change-phone/start', u.token);
    for (let i = 1; i <= 4; i += 1) {
      const r = await post('/auth/change-phone/verify-old', u.token, { otp: '000001' });
      expect([i, r.status]).toEqual([i, 401]);
    }
    let r = await post('/auth/change-phone/verify-old', u.token, { otp: '000001' });
    expect(r.status).toBe(429); expect(r.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    // start again
    await post('/auth/change-phone/start', u.token);
    const code = await latestOtp(u.user.phone);
    r = await post('/auth/change-phone/verify-old', u.token, { otp: code });
    expect(r.status).toBe(200); expect(r.body.data.change_token).toBeTruthy(); expect(r.body.data.expires_in).toBe(900);
    r = await post('/auth/change-phone/verify-old', u.token, { otp: code });
    expect(r.status).toBe(401);                                       // no replay
  });
});

describe('the new number (checks 4–8)', () => {
  it('needs a live change token, a valid different number that no account of this role holds', async () => {
    const u = await createBrandUser();
    let r = await post('/auth/change-phone/send-new', u.token, { new_phone: freshPhone() });
    expect(r.status).toBe(401); expect(r.body.error.code).toBe('CHANGE_EXPIRED');
    const token = await verifiedOld(u);
    r = await post('/auth/change-phone/send-new', u.token, { change_token: token, new_phone: u.user.phone });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('new_phone'); expect(r.body.error.message).toBe("That's already your number.");
    r = await post('/auth/change-phone/send-new', u.token, { change_token: token, new_phone: '12345' });
    expect(r.status).toBe(422); expect(r.body.error.message).toBe('Enter a valid Indian mobile number.');
    const other = await createBrandUser({ phone: freshPhone() });
    r = await post('/auth/change-phone/send-new', u.token, { change_token: token, new_phone: other.user.phone });
    expect(r.status).toBe(409); expect(r.body.error.code).toBe('PHONE_TAKEN');
    expect(r.body.error.message).toBe('This number already has a brand account. Sign in with it instead.');
    // a number that holds a CREATOR account is fine for a brand — one number, many roles
    const creatorOnly = await createInfluencerUser({ phone: freshPhone() });
    r = await post('/auth/change-phone/send-new', u.token, { change_token: token, new_phone: `${creatorOnly.user.phone.slice(0, 3)} ${creatorOnly.user.phone.slice(3)}` });
    expect(r.status).toBe(200);
    expect(r.body.data.sent_to).toBe(creatorOnly.user.phone);
    expect(await latestOtp(creatorOnly.user.phone)).toMatch(/^\d{6}$/);
  });

  it('a creator is told "creator account" when the number is taken by a creator', async () => {
    const u = await createInfluencerUser();
    const token = await verifiedOld(u);
    const other = await createInfluencerUser({ phone: freshPhone() });
    const r = await post('/auth/change-phone/send-new', u.token, { change_token: token, new_phone: other.user.phone });
    expect(r.status).toBe(409); expect(r.body.error.message).toBe('This number already has a creator account. Sign in with it instead.');
  });
});

describe('confirming (checks 9–12)', () => {
  it('rewrites the number for this role only, audits it, revokes every old session and issues a fresh one', async () => {
    const u = await createBrandUser();
    const sameNumberCreator = await createInfluencerUser({ phone: u.user.phone });
    const oldRefresh = u.refreshToken;
    const token = await verifiedOld(u);
    const newPhone = freshPhone();
    let r = await post('/auth/change-phone/send-new', u.token, { change_token: token, new_phone: newPhone });
    const token2 = r.body.data.change_token;
    r = await post('/auth/change-phone/confirm', u.token, { change_token: token2, otp: '000001' });
    expect(r.status).toBe(401);
    r = await post('/auth/change-phone/confirm', u.token, { change_token: token, otp: await latestOtp(newPhone) });
    expect(r.status).toBe(401); expect(r.body.error.code).toBe('CHANGE_EXPIRED');   // the stage-1 token cannot confirm
    r = await post('/auth/change-phone/confirm', u.token, { change_token: token2, otp: await latestOtp(newPhone) });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ phone: newPhone, message: `Your login number is now ${newPhone}.` });
    expect(r.body.data.access_token && r.body.data.refresh_token).toBeTruthy();

    const { rows: [me] } = await query(`SELECT phone, role FROM users WHERE id = $1`, [u.user.id]);
    expect(me).toEqual({ phone: newPhone, role: 'brand' });
    const { rows: [creator] } = await query(`SELECT phone FROM users WHERE id = $1`, [sameNumberCreator.user.id]);
    expect(creator.phone).toBe(u.user.phone);                            // the other role keeps the old number
    const { rows: audit } = await query(`SELECT role, old_phone, new_phone FROM phone_changes WHERE user_id = $1`, [u.user.id]);
    expect(audit).toEqual([{ role: 'brand', old_phone: u.user.phone, new_phone: newPhone }]);

    expect(oldRefresh).toBeTruthy();
    const old = await post('/auth/refresh', null, { refresh_token: oldRefresh });
    expect(old.status).toBe(401);
    const fresh = await post('/auth/refresh', null, { refresh_token: r.body.data.refresh_token });
    expect(fresh.status).toBe(200);
    // the new access token works
    expect((await request(app).get('/v1/brands/me').set(auth(r.body.data.access_token))).status).not.toBe(401);

    // check 10: sign-in with the old number + brand role starts a fresh account; the new number finds this one
    await post('/auth/send-otp', null, { phone: newPhone });
    const s1 = await post('/auth/verify-otp', null, { phone: newPhone, otp: await latestOtp(newPhone), role: 'brand' });
    expect(s1.status).toBe(200); expect(s1.body.data.user.id).toBe(u.user.id);
    await post('/auth/send-otp', null, { phone: u.user.phone });
    const s2 = await post('/auth/verify-otp', null, { phone: u.user.phone, otp: await latestOtp(u.user.phone), role: 'brand' });
    expect(s2.status).toBe(200); expect(s2.body.data.user.id).not.toBe(u.user.id);
  });

  it('a pending account may change its number; an expired token is refused (checks 11, 12)', async () => {
    const u = await createBrandUser();
    await query(`UPDATE users SET status = 'pending' WHERE id = $1`, [u.user.id]);
    const token = await verifiedOld(u);
    const newPhone = freshPhone();
    let r = await post('/auth/change-phone/send-new', u.token, { change_token: token, new_phone: newPhone });
    expect(r.status).toBe(200);
    // simulate the 15 minutes passing: the attempt is forgotten
    changePhone._attempts.clear();
    r = await post('/auth/change-phone/confirm', u.token, { change_token: r.body.data.change_token, otp: await latestOtp(newPhone) });
    expect(r.status).toBe(401); expect(r.body.error.code).toBe('CHANGE_EXPIRED');
    expect(r.body.error.message).toBe('Time\'s up. Start again from "Change number" — you have 15 minutes end to end.');
    expect((await query(`SELECT phone FROM users WHERE id = $1`, [u.user.id])).rows[0].phone).toBe(u.user.phone);
  });
});
