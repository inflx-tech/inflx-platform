'use strict';

/**
 * QA — referral-agency-mobile (Contract 3b): the ota.controller FLAVORS
 * allowlist must accept the new `agency` flavor (so the agency app's OTA
 * publish + update-check work) while still rejecting unknown flavors.
 *
 * Note: the manifest endpoint's downstream status (200/204/500) depends on R2
 * configuration, which is identical across all valid flavors in this env. The
 * allowlist's job — and this contract's change — is purely "valid flavor → not
 * a 422 VALIDATION_ERROR; unknown flavor → 422". So we assert agency is treated
 * the SAME as a known-valid flavor (brand), and that an unknown flavor is 422.
 */

const request = require('supertest');
const app = require('../src/app');

const manifest = (flavor) => request(app).get(`/v1/ota/manifest?flavor=${flavor}&runtime=2`);

describe('OTA manifest flavor allowlist (Contract 3b: +agency)', () => {
  test('agency is treated as a valid flavor — same status as brand, never 422', async () => {
    const agency = await manifest('agency');
    const brand = await manifest('brand');
    expect(agency.status).not.toBe(422);
    expect(agency.status).toBe(brand.status); // agency behaves like an existing valid flavor
  });

  test('all existing flavors still accepted (not 422)', async () => {
    for (const f of ['brand', 'influencer', 'follower']) {
      const res = await manifest(f);
      expect(res.status).not.toBe(422);
    }
  });

  test('unknown flavor still rejected with 422 VALIDATION_ERROR', async () => {
    const res = await manifest('bogus');
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
