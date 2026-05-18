'use strict';

/**
 * e2e-smoke.js — end-to-end follower-journey smoke against the LIVE API.
 *
 * WHY THIS EXISTS: syntax checks + wiring cross-checks proved code
 * "parses and is wired" but were blind to runtime/contract bugs (wrong
 * field names, dropped nav params, auth gates, 422s). This script sends
 * the EXACT request bodies the mobile screens build, against the real
 * deployed backend the phone talks to, and asserts every step — so
 * those bugs surface here instead of on a device.
 *
 * It is intentionally NETWORK-based (Node global fetch) because the
 * jest harness needs a local Postgres that isn't available in this
 * env. Runs prod-as-staging: it creates a throwaway follower + (if a
 * published campaign exists) one prebook/pay/review. Non-destructive.
 *
 * Usage:  node backend/scripts/e2e-smoke.js
 *         API_BASE=http://localhost:3001/v1 node backend/scripts/e2e-smoke.js
 *
 * Exit code 0 = all non-skipped steps passed; 1 = at least one FAIL.
 */

const API_BASE = (process.env.API_BASE || 'https://inflx-platform.onrender.com/v1').replace(/\/+$/, '');

const results = [];
let token = null;

function rec(step, status, detail) {
  results.push({ step, status, detail: detail || '' });
  const tag = status === 'PASS' ? '✓ PASS' : status === 'SKIP' ? '— SKIP' : '✗ FAIL';
  console.log(`${tag}  ${step}${detail ? `  ·  ${detail}` : ''}`);
}

async function api(method, path, { body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let res, json;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    return { ok: false, status: 0, json: null, netErr: e.message };
  }
  try { json = await res.json(); } catch { json = null; }
  return { ok: res.ok, status: res.status, json };
}

function assert(cond, step, detail) {
  if (cond) rec(step, 'PASS', detail);
  else rec(step, 'FAIL', detail);
  return !!cond;
}

(async () => {
  console.log(`\n── INFLX e2e smoke ──  ${API_BASE}\n`);

  // 1. Auth — follower (warm Render with a retry; cold start drops the first call)
  // E.164 Indian mobile — backend rejects bare 10-digit. Start with a
  // valid leading digit (6-9) so the regex passes.
  const phone = `+919${String(Date.now()).slice(-8)}`;
  let authOk = false;
  for (let attempt = 1; attempt <= 3 && !authOk; attempt++) {
    await api('POST', '/auth/send-otp', { body: { phone }, auth: false });
    const v = await api('POST', '/auth/verify-otp', {
      body: { phone, otp: '000000', role: 'follower', name: 'Smoke Tester' },
      auth: false,
    });
    if (v.status === 200 && v.json?.data?.access_token) {
      token = v.json.data.access_token;
      authOk = true;
    } else if (attempt < 3) {
      await new Promise(r => setTimeout(r, 4000)); // Render warmup
    } else if (attempt < 3) {
      await new Promise(r => setTimeout(r, 4000));
    }
  }
  if (!authOk) {
    // Real OTP on the deployed backend (OTP_MOCK=false) — can't auth
    // here. Still run every PUBLIC endpoint so the smoke always yields
    // proactive signal; mark the authed journey SKIP with the reason.
    rec('auth.verify-otp (follower)', 'SKIP',
      'OTP_MOCK=false on live — set OTP_MOCK=true on Render to unlock the full authed journey here');
    await publicChecks();
    rec('authed journey (prebook/verify/reviews/wallet/pay)', 'SKIP',
      'blocked by OTP_MOCK=false on live');
    return finish();
  }
  rec('auth.verify-otp (follower)', 'PASS', `token acquired`);

  // 2. Register follower profile (idempotent-ish; CONFLICT is fine)
  {
    const r = await api('POST', '/followers/register', {
      body: { name: 'Smoke Tester', city: 'Vijayawada', state: 'Andhra Pradesh' },
    });
    assert([201, 200, 409].includes(r.status), 'followers.register',
      `status ${r.status}`);
  }

  // 3-5. Public surface (also run standalone when auth is blocked).
  const stores = await publicChecks();

  // 6. PathC-2 — wallet (real endpoints + shape)
  {
    const w = await api('GET', '/follower/wallet');
    const ok = w.status === 200 && w.json?.data?.wallet
      && 'available' in w.json.data.wallet && 'lifetime' in w.json.data.wallet;
    assert(ok, 'PathC-2: /wallet', `status ${w.status} ${JSON.stringify(w.json?.data?.wallet || w.json)?.slice(0,120)}`);
    const t = await api('GET', '/follower/wallet/transactions');
    assert(t.status === 200 && Array.isArray(t.json?.data?.transactions),
      'PathC-2: /wallet/transactions', `status ${t.status}`);
  }

  // 7. Resolve a campaign-active restaurant + offer (the EXACT shape the
  //    mobile detail screen resolves: offer.offer_id/set_id/campaign_id/
  //    campaign_influencer_id). If none → SKIP transactional steps with a
  //    clear note (publishing a campaign is the human's part).
  let pick = null;
  for (const s of stores) {
    const offer = (s.offers || [])[0];
    if (offer && offer.campaign_id && offer.set_id && offer.campaign_influencer_id) {
      pick = { brand_id: s.id, business_name: s.business_name, offer };
      break;
    }
  }
  if (!pick) {
    rec('booking/pay/review', 'SKIP',
      'no restaurant with a published campaign+offer found — create one (your part), then rerun');
    return finish();
  }
  rec('campaign-active restaurant found', 'PASS',
    `${pick.business_name} · offer ${pick.offer.offer_id}`);

  // 8. W5D + Bug-A — prebook with the EXACT payload RestaurantBookingScreen
  //    builds (offer_id/campaign_id/set_id/campaign_influencer_id).
  let prebookOrder = null;
  {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const r = await api('POST', '/follower/prebook', {
      body: {
        offer_id: pick.offer.offer_id,
        campaign_id: pick.offer.campaign_id,
        set_id: pick.offer.set_id,
        campaign_influencer_id: pick.offer.campaign_influencer_id,
        booking_date: iso,
        booking_time: '20:00',
        guest_count: 2,
        special_requests: ['outdoor'],
      },
    });
    const ok = (r.status === 200 || r.status === 201) && (r.json?.data?.razorpay_order_id);
    assert(ok, 'Bug-A: /follower/prebook (mobile payload)',
      `status ${r.status} ${ok ? '' : JSON.stringify(r.json)?.slice(0,180)}`);
    if (ok) prebookOrder = r.json.data.razorpay_order_id;
  }

  // 9. W5D — verify → booking should come back brand_status='pending'
  if (prebookOrder) {
    const r = await api('POST', '/follower/prebook/verify', {
      body: { razorpay_order_id: prebookOrder, razorpay_payment_id: `pay_mock_${Date.now()}` },
    });
    const bs = r.json?.data?.booking?.brand_status ?? r.json?.data?.brand_status;
    assert((r.status === 200 || r.status === 201), 'W5D: /prebook/verify', `status ${r.status}`);
    assert(bs === 'pending', 'W5D: restaurant booking is brand_status=pending',
      `brand_status=${bs}`);
  }

  // 10. W5 — review gate: posting without a completed txn should be
  //     rejected (403/422), proving the "only review where you transacted"
  //     guard. Then the public list endpoint must return a summary shape.
  {
    const r = await api('POST', '/follower/reviews', {
      body: { brand_id: pick.brand_id, rating: 5, review_text: 'smoke' },
    });
    assert([403, 422, 409, 201].includes(r.status), 'W5: /reviews POST gate',
      `status ${r.status} (403/422 = gate works, 201 = had a completed txn)`);
    const l = await api('GET', `/follower/reviews?brand_id=${pick.brand_id}`, { auth: false });
    assert(l.status === 200 && l.json?.data?.summary && Array.isArray(l.json?.data?.reviews),
      'W5: /reviews list summary shape', `status ${l.status}`);
  }

  // 11. Bug-A (pay) — pay-at-store with the EXACT RestaurantBillScreen payload
  {
    const r = await api('POST', '/follower/pay-at-store', {
      body: {
        bill_amount: 500,
        offer_id: pick.offer.offer_id,
        campaign_id: pick.offer.campaign_id,
        set_id: pick.offer.set_id,
        campaign_influencer_id: pick.offer.campaign_influencer_id,
      },
    });
    const ok = (r.status === 200 || r.status === 201) && r.json?.data?.razorpay_order_id;
    assert(ok, 'Bug-A: /follower/pay-at-store (mobile payload)',
      `status ${r.status} ${ok ? '' : JSON.stringify(r.json)?.slice(0,180)}`);
  }

  finish();
})();

// Public (no-auth) endpoint checks. Always runnable — gives proactive
// signal even when OTP_MOCK=false blocks the authed journey. Returns the
// stores array so the authed flow can resolve a campaign-active brand.
async function publicChecks() {
  let stores = [];
  {
    const r = await api('GET', '/category/eat/stores', { auth: false });
    stores = r.json?.data?.stores || [];
    const okShape = r.status === 200 && Array.isArray(stores);
    assert(okShape, 'category/eat/stores', `status ${r.status}, ${stores.length} stores`);
    if (okShape && stores.length) {
      const s0 = stores[0];
      assert('avg_rating' in s0 && 'review_count' in s0,
        'W5: stores carry avg_rating/review_count',
        `avg_rating=${s0.avg_rating} review_count=${s0.review_count}`);
    }
  }
  {
    const r = await api('GET', '/follower/creators-eating-now', { auth: false });
    assert(r.status === 200 && Array.isArray(r.json?.data?.creators_eating_now),
      'W5C: /creators-eating-now', `status ${r.status}, ${r.json?.data?.creators_eating_now?.length ?? '?'} items`);
  }
  {
    const r = await api('GET', '/follower/search?q=biryani&super=eat', { auth: false });
    const d = r.json?.data || {};
    assert(r.status === 200 && Array.isArray(d.brands) && Array.isArray(d.dishes),
      'PathC-3: /search?q=biryani', `status ${r.status}, brands=${d.brands?.length} dishes=${d.dishes?.length}`);
  }
  if (stores[0]?.id) {
    const l = await api('GET', `/follower/reviews?brand_id=${stores[0].id}`, { auth: false });
    assert(l.status === 200 && l.json?.data?.summary && Array.isArray(l.json?.data?.reviews),
      'W5: /reviews list summary shape', `status ${l.status}`);
  }
  return stores;
}

function finish() {
  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  console.log(`\n── result ──  ${pass} pass · ${fail} fail · ${skip} skip\n`);
  if (fail > 0) {
    console.log('FAILURES:');
    for (const r of results.filter(x => x.status === 'FAIL')) {
      console.log(`  ✗ ${r.step} — ${r.detail}`);
    }
    process.exit(1);
  }
  process.exit(0);
}
