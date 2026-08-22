'use strict';

/**
 * Stage 0, job C — one number, many roles.
 * Contract: features/stage-0-clear-the-decks
 *
 * The founder's rule, exactly: a number may hold one account PER ROLE. It can be a
 * brand and a creator and a follower and an admin — but never two brands, so a single
 * brand is never reachable on two different numbers.
 *
 * The case that nearly shipped a break, and is asserted here first: brand-web is one
 * door for brands AND admins and cannot know which is arriving. It used to send
 * role:'brand' for everyone and rely on the lookup ignoring it. Under a per-role
 * lookup that would have signed every admin in as a brand-new pending brand — locking
 * the founder out of his own admin dashboard.
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll, query } = require('./helpers/db');
const { latestOtp } = require('./helpers/factories');

beforeEach(async () => {
  await truncateAll();
});

const PHONE = '+919000000777';

/** Sign in the way a phone app does: the build flavour IS the role. */
async function signInAsApp(phone, role, name) {
  await request(app).post('/v1/auth/send-otp').send({ phone });
  const otp = await latestOtp(phone);
  return request(app).post('/v1/auth/verify-otp').send({ phone, otp, role, ...(name && { name }) });
}

/** Sign in the way brand-web does: a shared door that only supplies a fallback. */
async function signInAsWeb(phone, name) {
  await request(app).post('/v1/auth/send-otp').send({ phone });
  const otp = await latestOtp(phone);
  return request(app)
    .post('/v1/auth/verify-otp')
    .send({ phone, otp, default_role: 'brand', ...(name && { name }) });
}

describe('one number, many roles', () => {
  test('the same number becomes a separate account in each app', async () => {
    const asBrand = await signInAsApp(PHONE, 'brand');
    expect(asBrand.status).toBe(200);
    expect(asBrand.body.data.user.role).toBe('brand');

    // The creator app: same number, and it must be treated as brand new.
    const asCreator = await signInAsApp(PHONE, 'influencer');
    expect(asCreator.status).toBe(200);
    expect(asCreator.body.data.user.role).toBe('influencer');

    // Genuinely separate accounts, not one row relabelled.
    expect(asCreator.body.data.user.id).not.toBe(asBrand.body.data.user.id);

    const { rows } = await query(
      `SELECT role FROM users WHERE phone = $1 ORDER BY role`, [PHONE]
    );
    expect(rows.map(r => r.role)).toEqual(['brand', 'influencer']);
  });

  test('a returning number reaches its existing account, not a new one', async () => {
    const first  = await signInAsApp(PHONE, 'brand');
    const second = await signInAsApp(PHONE, 'brand');

    expect(second.body.data.user.id).toBe(first.body.data.user.id);

    const { rows } = await query(`SELECT count(*)::int AS n FROM users WHERE phone = $1`, [PHONE]);
    expect(rows[0].n).toBe(1);
  });

  test('the database refuses a second account in the same role', async () => {
    await signInAsApp(PHONE, 'brand');
    await expect(
      query(`INSERT INTO users (phone, role, name, status) VALUES ($1,'brand','Dupe','pending')`, [PHONE])
    ).rejects.toThrow();
  });

  test('a new number in the creator app starts as pending, awaiting approval', async () => {
    const res = await signInAsApp('+919000000778', 'influencer');
    expect(res.body.data.user.status).toBe('pending');
  });

  test('a follower is created and approved in one step', async () => {
    const res = await signInAsApp('+919000000779', 'follower');
    expect(res.body.data.user.role).toBe('follower');
    expect(res.body.data.user.status).toBe('approved');
  });
});

describe('the shared web door', () => {
  test('AN ADMIN SIGNING IN ON THE WEB STAYS AN ADMIN', async () => {
    // The regression this whole test file exists for.
    await query(
      `INSERT INTO users (phone, role, name, status) VALUES ($1,'admin','Founder','approved')`,
      [PHONE]
    );

    const res = await signInAsWeb(PHONE);

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');

    // And no stray brand account was conjured underneath them.
    const { rows } = await query(`SELECT role FROM users WHERE phone = $1`, [PHONE]);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('admin');
  });

  test('a number with no account at all becomes a brand', async () => {
    const res = await signInAsWeb(PHONE, 'Brand User');
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('brand');
  });

  test('a number holding several accounts is asked which, never guessed', async () => {
    await signInAsApp(PHONE, 'brand');
    await signInAsApp(PHONE, 'influencer');

    const res = await signInAsWeb(PHONE);

    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/2 accounts/);
    // Both roles named, so the caller can offer a real choice.
    expect(res.body.error.message).toMatch(/brand/);
    expect(res.body.error.message).toMatch(/influencer/);
  });
});

describe('each door knows who is arriving', () => {
  // Reported from the live admin dashboard: signing in at admin.inflx.in with a
  // number holding three accounts asked "choose which one" — a question the page had
  // already answered by existing at that address. Every door knows its own role: the
  // admin subdomain, the brand workspace, and each phone app's build flavour.

  async function signInAtDoor(phone, doorRole) {
    await request(app).post('/v1/auth/send-otp').send({ phone });
    const otp = await latestOtp(phone);
    return request(app).post('/v1/auth/verify-otp').send({ phone, otp, role: doorRole });
  }

  test('THE ADMIN DOOR NEVER ASKS, even with three accounts on the number', async () => {
    await query(
      `INSERT INTO users (phone, role, name, status) VALUES ($1,'admin','Aveen','approved')`,
      [PHONE]
    );
    await signInAsApp(PHONE, 'brand');
    await signInAsApp(PHONE, 'influencer');

    const res = await signInAtDoor(PHONE, 'admin');

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('admin');
  });

  test('the brand door signs the same number into its brand account', async () => {
    await query(
      `INSERT INTO users (phone, role, name, status) VALUES ($1,'admin','Aveen','approved')`,
      [PHONE]
    );
    await signInAsApp(PHONE, 'brand');
    await signInAsApp(PHONE, 'influencer');

    const res = await signInAtDoor(PHONE, 'brand');

    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('brand');
  });

  test('the admin door REFUSES a number with no admin account, and creates nothing', async () => {
    await signInAsApp(PHONE, 'brand');

    const res = await signInAtDoor(PHONE, 'admin');

    expect(res.status).toBe(401);

    // The important half: asking for admin must never mint an admin.
    const { rows } = await query(
      `SELECT role FROM users WHERE phone = $1 ORDER BY role`, [PHONE]
    );
    expect(rows.map(r => r.role)).toEqual(['brand']);
  });

  test('nobody can hand themselves admin by asking for it at sign-in', async () => {
    const res = await signInAtDoor('+919000000791', 'admin');

    expect(res.status).toBe(401);
    const { rows } = await query(
      `SELECT count(*)::int AS n FROM users WHERE phone = $1`, ['+919000000791']
    );
    expect(rows[0].n).toBe(0);
  });
});

describe('role validation', () => {
  test('an unknown role is refused', async () => {
    await request(app).post('/v1/auth/send-otp').send({ phone: PHONE });
    const otp = await latestOtp(PHONE);
    const res = await request(app)
      .post('/v1/auth/verify-otp')
      .send({ phone: PHONE, otp, role: 'superuser' });

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('role');
  });

  test('a brand-new number with no role given is refused rather than guessed', async () => {
    await request(app).post('/v1/auth/send-otp').send({ phone: PHONE });
    const otp = await latestOtp(PHONE);
    const res = await request(app).post('/v1/auth/verify-otp').send({ phone: PHONE, otp });

    expect(res.status).toBe(422);
    expect(res.body.error.field).toBe('role');
  });
});
