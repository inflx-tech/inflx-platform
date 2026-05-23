#!/usr/bin/env node
'use strict';

/**
 * seed-meals-e2e.mjs — seed the LOCAL dev stack for the INFLX Meals
 * customer E2E (mobile). Uses the existing "QA Test Diner" restaurant +
 * "Dummy Follower". Sets the launch cuisine (Hyderabadi / Biryani), a
 * biryani menu, Meals config, Lunch + Dinner slots, and active offers
 * across party sizes — via the REAL API (minted brand JWT) so it
 * exercises the same endpoints the app uses.
 *
 * Run: node qa/scripts/seed-meals-e2e.mjs
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(path.join(ROOT, 'backend', 'package.json'));
require('dotenv').config({ path: path.join(ROOT, 'backend', '.env') });
const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const DEV_URL = 'postgresql://postgres:dev@localhost:5433/inflx_dev';
const API = 'http://localhost:3001/v1';
const CUISINE = ['Biryani', 'Hyderabadi'];

const MENU = [
  { name: 'Chicken Biryani', price: 300, veg_flag: 'non_veg', section: 'Biryani' },
  { name: 'Veg Biryani', price: 220, veg_flag: 'veg', section: 'Biryani' },
  { name: 'Paneer Biryani', price: 260, veg_flag: 'veg', section: 'Biryani' },
  { name: 'Mutton Biryani', price: 420, veg_flag: 'non_veg', section: 'Biryani' },
  { name: 'Raita', price: 40, veg_flag: 'veg', section: 'Sides' },
  { name: 'Gulab Jamun', price: 60, veg_flag: 'veg', section: 'Dessert' },
];

async function api(method, pathname, token, body) {
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${pathname} → ${res.status} ${JSON.stringify(json.error || json)}`);
  }
  return json.data;
}

async function main() {
  const c = new Client({ connectionString: DEV_URL });
  await c.connect();

  const b = (await c.query(
    `SELECT b.id, b.user_id FROM brands b WHERE b.business_name = 'QA Test Diner' LIMIT 1`)).rows[0];
  if (!b) throw new Error('QA Test Diner not found');
  const f = (await c.query(
    `SELECT u.phone FROM followers fo JOIN users u ON u.id = fo.user_id WHERE u.name = 'Dummy Follower' LIMIT 1`)).rows[0];
  console.log(`[seed] restaurant=${b.id} follower_phone=${f ? f.phone : 'n/a'}`);

  // 1. Cuisine + locality (display) — direct SQL into listing_data.
  await c.query(
    `UPDATE brands SET listing_data = COALESCE(listing_data,'{}'::jsonb)
       || jsonb_build_object('cuisines', $2::jsonb, 'restaurant_description', $3::text),
       locality = COALESCE(locality, 'Jubilee Hills')
     WHERE id = $1`,
    [b.id, JSON.stringify(CUISINE), 'Hyderabadi biryani, planned-meal ready.']);
  console.log(`[seed] cuisine set: ${CUISINE.join(' / ')}`);

  // 2. Menu (brand_products) — idempotent on (brand_id, name).
  for (const m of MENU) {
    await c.query(
      `INSERT INTO brand_products (brand_id, name, price, veg_flag, section, is_active)
       SELECT $1::uuid, $2::varchar, $3::numeric, $4::veg_flag, $5::varchar, true
       WHERE NOT EXISTS (SELECT 1 FROM brand_products WHERE brand_id=$1::uuid AND name=$2::varchar)`,
      [b.id, m.name, m.price, m.veg_flag, m.section]);
  }
  console.log(`[seed] menu seeded: ${MENU.length} dishes`);

  // mint brand access token (HS256, JWT_SECRET) — same as the app login.
  const token = jwt.sign({ sub: b.user_id, role: 'brand' }, process.env.JWT_SECRET, { expiresIn: '30m' });

  // 3. Meals config (enabled + editable discount clock).
  await api('PUT', '/meals/config', token, {
    enabled: true, delivery_radius_km: 5, max_discount_pct: 25, never_below_cost: true,
    auto_offer: true, discount_clock: [{ unit: 'day', n: 1, pct: 12 }, { unit: 'hour', n: 2, pct: 5 }],
  });
  console.log('[seed] meals config enabled');

  // 4. Slots — Lunch + Dinner (idempotent: skip if already present).
  const existingSlots = (await c.query(`SELECT label FROM meal_slots WHERE brand_id=$1`, [b.id])).rows.map((r) => r.label);
  const slots = {};
  for (const s of [{ label: 'Lunch', serve_time: '13:00' }, { label: 'Dinner', serve_time: '20:00' }]) {
    if (existingSlots.includes(s.label)) continue;
    const slot = await api('POST', '/meals/slots', token, { ...s, cutoff_minutes_before: 120, capacity: 40 });
    slots[s.label] = slot.slot.id;
  }
  const lunchId = slots.Lunch || (await c.query(`SELECT id FROM meal_slots WHERE brand_id=$1 AND label='Lunch' LIMIT 1`, [b.id])).rows[0]?.id;
  console.log(`[seed] slots ready (Lunch=${lunchId ? 'ok' : 'missing'})`);

  // 5. Active offer rules across party sizes (skip if any active rule exists).
  const ruleCount = (await c.query(`SELECT count(*)::int n FROM meal_offer_rules WHERE brand_id=$1`, [b.id])).rows[0].n;
  if (ruleCount === 0) {
    const rules = [
      { name: 'First-Timer Solo', party_size: 'single', offer_kind: 'free_addon', base_price: 300, freebies_json: ['Masala Soda'], items_json: [{ name: 'Chicken Biryani', qty: 1, price: 300 }] },
      { name: 'Duo Combo', party_size: 'duo', offer_kind: 'mixed', base_price: 640, discount_type: 'flat', discount_value: 60, items_json: [{ name: 'Chicken Biryani', qty: 1, price: 300 }, { name: 'Veg Biryani', qty: 1, price: 220 }] },
      { name: 'Trio Lunch Pack', party_size: 'trio', offer_kind: 'discount', base_price: 860, discount_type: 'flat', discount_value: 120, items_json: [{ name: 'Chicken Biryani', qty: 2, price: 300 }, { name: 'Veg Biryani', qty: 1, price: 220 }] },
      { name: 'Family Mixed Pack', party_size: 'family', offer_kind: 'mixed', base_price: 1040, discount_type: 'flat', discount_value: 90, freebies_json: ['Raita x2'], items_json: [{ name: 'Chicken Biryani', qty: 2, price: 300 }, { name: 'Veg Biryani', qty: 2, price: 220 }] },
      { name: 'Corporate Pre-book', party_size: 'office', offer_kind: 'early_order', base_price: 3360, discount_type: 'flat', discount_value: 240, items_json: [{ name: 'Chicken Biryani', qty: 12, price: 280 }] },
    ];
    for (const r of rules) {
      await api('POST', '/meals/offer-rules', token, { ...r, slot_id: lunchId, status: 'active' });
    }
    console.log(`[seed] ${rules.length} active offer rules created`);
  } else {
    console.log(`[seed] offer rules already present (${ruleCount}) — skipped`);
  }

  // 6. Verify the public store endpoint the app reads.
  const store = await fetch(`${API}/meals/store/${b.id}`).then((r) => r.json());
  const offers = store?.data?.offers || [];
  console.log(`[seed] VERIFY GET /meals/store/${b.id} → ${offers.length} offers, parties: ${Object.keys(store?.data?.offers_by_party || {}).join(', ')}`);
  console.log(`[seed] DONE. brandId=${b.id}`);
  await c.end();
}

main().catch((e) => { console.error('[seed] FAIL —', e.message); process.exit(1); });
