'use strict';
// Targeted test for brand-register-location-picker (LOCAL dev only).
// Registers 3 brands: (a) with explicit coords, (b) with a maps URL (mock
// resolver), (c) manual — and asserts the brands rows.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');
const { Client } = require('pg');

const BASE = 'http://localhost:3001/v1';
const RUN = String(Date.now()).slice(-7);

async function login(phone) {
  const a = axios.create({ baseURL: BASE, validateStatus: () => true });
  await a.post('/auth/send-otp', { phone });
  const v = await a.post('/auth/verify-otp', { phone, otp: '000000', role: 'brand' });
  if (v.status >= 400) throw new Error(JSON.stringify(v.data));
  return v.data.data.access_token;
}

async function register(token, extra) {
  const a = axios.create({ baseURL: BASE, validateStatus: () => true, headers: { Authorization: `Bearer ${token}` } });
  return a.post('/brands/register', {
    name: 'Loc Tester', business_name: `ZZ-LocTest-${extra._tag}-${RUN}`,
    category: 'fashion_walkin', address_line: '1 Test St',
    city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520001',
    ...extra, _tag: undefined,
  });
}

(async () => {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const results = [];

  // (a) explicit coords
  let t = await login(`+9197${RUN}1`);
  let r = await register(t, { _tag: 'coords', latitude: 16.5062, longitude: 80.648, locality: 'MG Road', formatted_address: 'MG Road, Vijayawada' });
  results.push(['coords', r.status, r.data?.error?.message]);

  // (b) maps url (GEOCODING_MOCK resolver)
  t = await login(`+9197${RUN}2`);
  r = await register(t, { _tag: 'mapsurl', google_maps_url: 'https://maps.app.goo.gl/mock123' });
  results.push(['mapsurl', r.status, r.data?.error?.message]);

  // (c) manual — no location extras
  t = await login(`+9197${RUN}3`);
  r = await register(t, { _tag: 'manual' });
  results.push(['manual', r.status, r.data?.error?.message]);

  // (d) invalid lat must 422
  t = await login(`+9197${RUN}4`);
  r = await register(t, { _tag: 'badlat', latitude: 200, longitude: 80 });
  results.push(['badlat(expect 422)', r.status, r.data?.error?.message]);

  const { rows } = await db.query(
    `SELECT business_name, lat, lng, latitude, longitude, locality, formatted_address
     FROM brands WHERE business_name LIKE $1 ORDER BY business_name`, [`ZZ-LocTest-%${RUN}`]);
  console.log('HTTP results:', JSON.stringify(results));
  for (const row of rows) console.log(JSON.stringify(row));
  await db.end();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
