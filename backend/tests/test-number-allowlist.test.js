'use strict';

/**
 * Stage 0, job D — login codes: real for real numbers, fixed for test ones.
 * Contract: features/stage-0-clear-the-decks
 *
 * Replaces the OTP_MOCK switch. That switch was global, so it was off when it was
 * needed and on when it was not — and on 19 Aug it was left on in production, which
 * meant every account on the platform could be signed into with 000000 until it was
 * noticed a day later.
 *
 * The rule these tests hold in place: membership of the allowlist is the ONLY way to
 * get a fixed code, and nothing can grant one to a number that is not on it.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');

const TEST_NUMBER = '+919000000801';
const REAL_NUMBER = '+919000000802';

beforeEach(async () => {
  await truncateAll();
  await query(
    `INSERT INTO test_phone_numbers (phone, note) VALUES ($1, 'practice creator')`,
    [TEST_NUMBER]
  );
});

async function codeIssuedTo(phone) {
  await request(app).post('/v1/auth/send-otp').send({ phone });
  const { rows } = await query(
    `SELECT code FROM otp_codes WHERE phone = $1 ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  return rows[0] && rows[0].code;
}

describe('the test-number allowlist', () => {
  test('a number on the list gets the fixed code', async () => {
    expect(await codeIssuedTo(TEST_NUMBER)).toBe('000000');
  });

  test('a number NOT on the list gets a real, random code', async () => {
    const code = await codeIssuedTo(REAL_NUMBER);
    expect(code).toMatch(/^\d{6}$/);
    expect(code).not.toBe('000000');
  });

  test('two real numbers do not get the same code', async () => {
    const a = await codeIssuedTo('+919000000803');
    const b = await codeIssuedTo('+919000000804');
    expect(a).not.toBe(b);
  });

  test('removing a number from the list restores real codes to it', async () => {
    expect(await codeIssuedTo(TEST_NUMBER)).toBe('000000');

    await query(`DELETE FROM test_phone_numbers WHERE phone = $1`, [TEST_NUMBER]);

    const after = await codeIssuedTo(TEST_NUMBER);
    expect(after).not.toBe('000000');
    expect(after).toMatch(/^\d{6}$/);
  });

  test('no environment setting can hand a fixed code to a real number', async () => {
    // The failure mode this whole job exists to remove. OTP_MOCK used to do exactly
    // this; setting it must now change nothing at all.
    const previous = process.env.OTP_MOCK;
    process.env.OTP_MOCK = 'true';
    try {
      const code = await codeIssuedTo(REAL_NUMBER);
      expect(code).not.toBe('000000');
    } finally {
      if (previous === undefined) delete process.env.OTP_MOCK;
      else process.env.OTP_MOCK = previous;
    }
  });

  test('an allow-listed number can actually sign in with the fixed code', async () => {
    await request(app).post('/v1/auth/send-otp').send({ phone: TEST_NUMBER });
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone: TEST_NUMBER, otp: '000000', role: 'influencer' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('influencer');
  });

  test('a real number cannot sign in by guessing the fixed code', async () => {
    await request(app).post('/v1/auth/send-otp').send({ phone: REAL_NUMBER });
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone: REAL_NUMBER, otp: '000000', role: 'brand' });

    expect(res.status).toBe(401);
  });
});
