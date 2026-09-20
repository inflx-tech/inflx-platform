'use strict';

/**
 * retire-google — item 6 of Docs/NEXT_ROUND_2026-09-19.md. No Google service anywhere: the
 * place and geocode routes are gone; "where am I" answers from our own city coordinates.
 * Contract: features/retire-google
 */

const request = require('supertest');
const app = require('../src/app');
const { truncateAll } = require('./helpers/db');
const { query, resetReference, brand, api } = require('./helpers/item3');
const { createFollowerUser } = require('./helpers/factories');
const ref = require('../src/services/referenceLists.service');

beforeEach(async () => { await truncateAll(); await resetReference(); });

describe('the Google routes are gone', () => {
  it('places, geocode and the Maps-link resolver answer 404 — the routes no longer exist', async () => {
    // /follower/* is guarded router-wide by a sibling router (returns), so an unknown follower
    // path answers 401 without a token and 403 with the wrong role — a follower's own token is
    // the honest probe there; the other paths have no guard left, so no token.
    const f = await createFollowerUser();
    for (const [m, p] of [
      ['get', '/follower/places/autocomplete?q=vij'], ['get', '/follower/places/details?place_id=x'], ['get', '/follower/geocode?q=vij'],
      ['post', '/places/resolve'], ['post', '/internal/geocode-maps-url'], ['get', '/internal/geocode-health'], ['get', '/internal/places-health'],
    ]) {
      const req = request(app)[m](`/v1${p}`);
      if (p.startsWith('/follower/')) req.set({ Authorization: `Bearer ${f.token}` });
      const r = await req.send(m === 'post' ? { google_maps_url: 'https://maps.app.goo.gl/x', place_id: 'x' } : undefined);
      expect([p, r.status]).toEqual([p, 404]);
    }
    // and the one that stays is public and answers from our own list
    expect((await request(app).get('/v1/follower/reverse-geocode?lat=16.51&lng=80.65')).status).toBe(200);
  });

  it('no module requires a Google service any more', () => {
    const fs = require('fs'); const path = require('path');
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    const src = walk(path.join(__dirname, '..', 'src')).filter(f => f.endsWith('.js'));
    const offenders = src.filter(f => /geocoding\.service|places\.service|maps\.googleapis\.com|GOOGLE_PLACES_API_KEY|GOOGLE_GEOCODING_API_KEY/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
    expect(fs.existsSync(path.join(__dirname, '..', 'src', 'services', 'places.service.js'))).toBe(false);
    expect(fs.existsSync(path.join(__dirname, '..', 'src', 'services', 'geocoding.service.js'))).toBe(false);
  });
});

describe('where am I, from our own coordinates', () => {
  it('a point in Vijayawada → Vijayawada; a point between Guntur and Vijayawada → the nearer one; the sea → nothing', async () => {
    let r = await request(app).get('/v1/follower/reverse-geocode?lat=16.51&lng=80.65');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ area_name: 'Vijayawada', city: 'Vijayawada', state: 'Andhra Pradesh' });
    expect(r.body.data.city_id).toBeTruthy();
    expect(r.body.data.km).toBeLessThan(5);
    r = await request(app).get('/v1/follower/reverse-geocode?lat=16.32&lng=80.45');
    expect(r.body.data.city).toBe('Guntur');
    r = await request(app).get('/v1/follower/reverse-geocode?lat=0&lng=0');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ area_name: null, city: null, city_id: null });
    r = await request(app).get('/v1/follower/reverse-geocode?lat=abc');
    expect(r.status).toBe(422);
    const near = await ref.nearestCity(12.97, 77.59);
    expect(near).toMatchObject({ name: 'Bengaluru', stateName: 'Karnataka' });
  });

  it('a follower address typed with a listed city gets that city\'s centre; an unknown city with no pin is refused', async () => {
    const f = await createFollowerUser();
    let r = await api.post('/follower/addresses', f.token, { label: 'Home', line1: '12 MG Road', city: 'Guntur', pincode: '522001' });
    expect(r.status).toBe(201);
    const { rows: [a] } = await query(`SELECT lat, lng FROM follower_addresses WHERE line1 = '12 MG Road'`);
    expect(Number(a.lat)).toBeCloseTo(16.3067, 2); expect(Number(a.lng)).toBeCloseTo(80.4365, 2);
    r = await api.post('/follower/addresses', f.token, { label: 'Work', line1: '1 Nowhere St', city: 'Atlantis', pincode: '000000' });
    expect(r.status).toBe(422); expect(r.body.error.field).toBe('city');
    r = await api.post('/follower/addresses', f.token, { label: 'Pin', line1: '1 Pin St', city: 'Atlantis', pincode: '000000', lat: 16.5, lng: 80.6 });
    expect(r.status).toBe(201);
  });
});
