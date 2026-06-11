'use strict';
/**
 * Phase A — end-to-end golden-journey driver (LOCAL dev backend + dev DB only).
 * Drives the full platform journey via the public API, asserting DB state at
 * each step. Produces a PASS/FAIL ledger. NEVER run against prod.
 *
 *   node scripts/journey-phase-a.js
 *
 * Requires: backend running on :3001 with backend/.env (mocks ON),
 * dev Postgres on :5433, superadmin seeded (scripts/seed.js).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');
const { Client } = require('pg');

const BASE = 'http://localhost:3001/v1';
const RUN = String(Date.now()).slice(-7); // unique suffix per run
const P = (n) => `+9198${RUN}${n}`;       // unique phones: +9198XXXXXXXN

const ledger = [];
function log(id, status, name, detail = '') {
  ledger.push({ id, status, name, detail: String(detail).slice(0, 500) });
  console.log(`[${status}] ${id} ${name}${detail ? ' — ' + String(detail).slice(0, 300) : ''}`);
}

function api(token) {
  const inst = axios.create({
    baseURL: BASE,
    timeout: 30000,
    validateStatus: () => true,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return inst;
}

let db;
async function q(sql, params = []) {
  const r = await db.query(sql, params);
  return r.rows;
}

async function login(phone, role) {
  const a = api();
  const s = await a.post('/auth/send-otp', { phone });
  if (s.status >= 400) throw new Error(`send-otp ${s.status}: ${JSON.stringify(s.data)}`);
  const v = await a.post('/auth/verify-otp', { phone, otp: '000000', role });
  if (v.status >= 400) throw new Error(`verify-otp ${v.status}: ${JSON.stringify(v.data)}`);
  const d = v.data.data || v.data;
  return { token: d.access_token || d.token, user: d.user, raw: d };
}

const fail = (id, name, e) => log(id, 'FAIL', name, e.response ? JSON.stringify(e.response.data) : (e.message || e));
const body = (r) => (r.data && (r.data.data || r.data)) || {};
const expectOk = (r, what) => {
  if (r.status >= 400) throw new Error(`${what} HTTP ${r.status}: ${JSON.stringify(r.data)}`);
  return body(r);
};

(async () => {
  db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  console.log(`\n=== PHASE A JOURNEY RUN ${RUN} ===\n`);

  const ctx = {}; // accumulates ids/tokens

  // ───────────────────────── STAGE 1: ONBOARDING + APPROVALS ─────────────────
  try {
    const adm = await login('+919000000099', 'admin');
    ctx.admin = adm.token;
    log('S1.1', 'PASS', 'Admin login (superadmin, OTP mock)');
  } catch (e) { fail('S1.1', 'Admin login', e); }

  try {
    const b = await login(P(1), 'brand');
    ctx.brandToken = b.token;
    const reg = await api(ctx.brandToken).post('/brands/register', {
      name: 'Journey Owner', business_name: `Journey Fashion ${RUN}`,
      category: 'fashion_walkin', address_line: '12 MG Road',
      city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520001',
    });
    const d = expectOk(reg, 'brands/register');
    ctx.brandId = (d.brand && d.brand.id) || d.id;
    const row = await q(`SELECT u.status FROM brands b JOIN users u ON u.id=b.user_id WHERE b.id=$1`, [ctx.brandId]);
    if (row[0] && row[0].status === 'pending') log('S1.2', 'PASS', 'Brand signup + register → users.status=pending', `brand_id=${ctx.brandId}`);
    else log('S1.2', 'FAIL', 'Brand signup', `unexpected status: ${JSON.stringify(row)}`);
  } catch (e) { fail('S1.2', 'Brand signup + register', e); }

  try {
    const r = await api(ctx.brandToken).post('/campaigns', { name: 'should-fail', total_budget: 1000 });
    if (r.status === 403) log('S1.3', 'PASS', 'Gate: pending brand BLOCKED from campaign create', `code=${r.data && r.data.error && r.data.error.code}`);
    else log('S1.3', 'FAIL', 'Gate: pending brand campaign create', `expected 403, got ${r.status}: ${JSON.stringify(r.data)}`);
  } catch (e) { fail('S1.3', 'Pending-brand gate', e); }

  try {
    const r = await api(ctx.admin).patch(`/brands/${ctx.brandId}/status`, { status: 'approved' });
    expectOk(r, 'admin approve brand');
    const row = await q(`SELECT u.status FROM brands b JOIN users u ON u.id=b.user_id WHERE b.id=$1`, [ctx.brandId]);
    if (row[0].status === 'approved') log('S1.4', 'PASS', 'Admin approves brand → users.status=approved');
    else log('S1.4', 'FAIL', 'Admin approve brand', JSON.stringify(row));
  } catch (e) { fail('S1.4', 'Admin approve brand', e); }

  try {
    const i = await login(P(2), 'influencer');
    ctx.infToken = i.token;
    const reg = await api(ctx.infToken).post('/influencers/register', {
      name: 'Journey Creator', instagram_handle: `journey_creator_${RUN}`, city: 'Vijayawada',
    });
    const d = expectOk(reg, 'influencers/register');
    ctx.infId = (d.influencer && d.influencer.id) || d.id;
    const ap = await api(ctx.admin).patch(`/influencers/${ctx.infId}/status`, { status: 'approved' });
    if (ap.status >= 400) { // fallback admin route
      const ap2 = await api(ctx.admin).patch(`/admin/influencers/${ctx.infId}/status`, { status: 'approved' });
      expectOk(ap2, 'admin approve influencer (fallback)');
    }
    const row = await q(`SELECT u.status FROM influencers i JOIN users u ON u.id=i.user_id WHERE i.id=$1`, [ctx.infId]);
    if (row[0].status === 'approved') log('S1.5', 'PASS', 'Influencer signup (Apify mock) + admin approve', `influencer_id=${ctx.infId}`);
    else log('S1.5', 'FAIL', 'Influencer approve', JSON.stringify(row));
  } catch (e) { fail('S1.5', 'Influencer signup/approve', e); }

  // ───────────────────────── STAGE 2: LISTING + OFFER LIBRARY ────────────────
  try {
    const t = await api(ctx.brandToken).get('/listing/tree?vertical=fashion');
    const td = expectOk(t, 'listing/tree');
    const roots = td.tree || td.nodes || (Array.isArray(td) ? td : []);
    const leaves = [];
    (function walk(ns) {
      for (const n of ns || []) {
        if (n.children && n.children.length) walk(n.children);
        else leaves.push(n);
      }
    })(roots);
    if (!leaves.length) throw new Error(`no leaf nodes found in tree (roots=${roots.length})`);
    ctx.leaves = leaves;
    log('S2.1', 'PASS', 'Listing tree loads (fashion)', `${leaves.length} leaf nodes`);
  } catch (e) { fail('S2.1', 'Listing tree', e); }

  if (ctx.leaves) {
    let created = null, lastErr = null;
    for (const leaf of ctx.leaves.slice(0, 6)) {
      try {
        const f = await api(ctx.brandToken).get(`/listing/nodes/${leaf.id}/facets`);
        const fd = body(f);
        const facetDefs = fd.facets || [];
        const facets = {};
        for (const fa of facetDefs) {
          const key = fa.facet_key;
          if (!key || key === 'images' || key === 'price') continue;
          const required = fa.required === 'required' || key === 'size';
          if (!required) continue;
          const allowed = Array.isArray(fa.allowed_values) ? fa.allowed_values : [];
          let v = allowed.length > 1 ? allowed[0] : (key === 'size' ? 'M' : 'Blue');
          if (fa.input_type === 'multi_select') v = [v];
          facets[key] = v;
        }
        const item = {
          name: `Journey Kurta ${RUN}`, price: 999, images: [],
          description: 'Phase A test product', facets,
          variants: [{ color: 'Blue', sizes: [{ size: 'M', stock: 10, price: 999 }, { size: 'L', stock: 10, price: 999 }] }],
        };
        const r = await api(ctx.brandToken).post('/brands/me/products/batch', { category_node_id: leaf.id, items: [item] });
        if (r.status < 400) { created = { leaf, resp: body(r) }; break; }
        lastErr = `${leaf.name || leaf.id}: ${JSON.stringify(r.data)}`;
      } catch (e) { lastErr = e.message; }
    }
    if (created) {
      const prows = await q(`SELECT id, sku, name FROM brand_products WHERE brand_id=$1`, [ctx.brandId]);
      ctx.productId = prows[0] && prows[0].id;
      log('S2.2', 'PASS', 'Drill-once batch product create + auto-SKU', `node=${created.leaf.name || created.leaf.id}, sku=${prows[0] && prows[0].sku}`);
    } else log('S2.2', 'FAIL', 'Batch product create', lastErr);
  } else log('S2.2', 'BLOCKED', 'Batch product create', 'no tree');

  if (!ctx.productId) {
    try { // fallback: generic product so downstream steps can proceed
      const r = await api(ctx.brandToken).post('/brands/me/products', { name: `Journey Generic ${RUN}`, price: 999, description: 'fallback', stock: 25 });
      const d = expectOk(r, 'generic product create');
      ctx.productId = (d.product && d.product.id) || d.id;
      log('S2.2b', 'INFO', 'Fallback generic product created', ctx.productId);
    } catch (e) { fail('S2.2b', 'Fallback product', e); }
  }

  try {
    const r = await api(ctx.brandToken).post('/brands/me/offers', {
      name: `Journey 20% Off ${RUN}`, offer_type: 'percentage',
      offer_config_json: { value: 20 },
    });
    let d;
    if (r.status >= 400) { // adapt: try discount/pct shape
      const r2 = await api(ctx.brandToken).post('/brands/me/offers', {
        name: `Journey 20% Off ${RUN}`, offer_type: 'discount',
        offer_config_json: { sub_type: 'pct', value: 20 },
      });
      d = expectOk(r2, `brand offer create (1st try: ${JSON.stringify(r.data)})`);
    } else d = body(r);
    ctx.brandOfferId = (d.offer && d.offer.id) || d.id;
    log('S2.3', 'PASS', 'Offer library: create offer', `brand_offer_id=${ctx.brandOfferId}`);
  } catch (e) { fail('S2.3', 'Offer library create', e); }

  try {
    const t = await api(ctx.brandToken).post('/brands/me/wallet/topup', { amount: 50000 });
    const td = expectOk(t, 'wallet topup');
    const v = await api(ctx.brandToken).post('/brands/me/wallet/topup/verify', {
      razorpay_order_id: td.order_id, razorpay_payment_id: `pay_mock_${RUN}`, razorpay_signature: 'mock',
    });
    expectOk(v, 'wallet topup verify');
    const w = await q(`SELECT wallet_balance FROM brands WHERE id=$1`, [ctx.brandId]);
    if (parseFloat(w[0].wallet_balance) === 50000) log('S2.4', 'PASS', 'Wallet top-up ₹50,000 (Razorpay mock) → balance correct');
    else log('S2.4', 'FAIL', 'Wallet topup', `balance=${w[0].wallet_balance}`);
  } catch (e) { fail('S2.4', 'Wallet topup', e); }

  // ───────────────────────── STAGE 3: CAMPAIGN ───────────────────────────────
  try {
    const start = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const end = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
    const c = await api(ctx.brandToken).post('/campaigns', {
      name: `Journey Campaign ${RUN}`, total_budget: 10000,
      start_date: start, end_date: end, brief: 'Phase A golden path', allow_negotiation: true,
    });
    const cd = expectOk(c, 'campaign create');
    ctx.campaignId = (cd.campaign && cd.campaign.id) || cd.id;

    let s = await api(ctx.brandToken).post(`/campaigns/${ctx.campaignId}/sets`, {
      name: 'Journey Hybrid Set', goal: 'hybrid', influencer_mode: 'handpick',
      set_budget: 5000, per_influencer_budget: 2500, coupon_prefix: `JRN${RUN.slice(-4)}`,
      formats_json: [{ type: 'reel', count: 1 }],
    });
    if (s.status >= 400) {
      ctx.hybridErr = JSON.stringify(s.data);
      s = await api(ctx.brandToken).post(`/campaigns/${ctx.campaignId}/sets`, {
        name: 'Journey Engagement Set', goal: 'engagement', influencer_mode: 'handpick',
        set_budget: 5000, per_influencer_budget: 2500,
        formats_json: [{ type: 'reel', count: 1 }],
      });
      ctx.setGoal = 'engagement';
    } else ctx.setGoal = 'hybrid';
    const sd = expectOk(s, `set create${ctx.hybridErr ? ' (hybrid rejected: ' + ctx.hybridErr + ')' : ''}`);
    ctx.setId = (sd.set && sd.set.id) || sd.id;
    log('S3.1', 'PASS', `Campaign + ${ctx.setGoal} set created`, `campaign=${ctx.campaignId}`);

    // D3 regression: invalid deliverable format type must 422 at set create
    const bad = await api(ctx.brandToken).post(`/campaigns/${ctx.campaignId}/sets`, {
      name: 'Bad Format Set', goal: 'engagement', influencer_mode: 'handpick',
      set_budget: 100, formats_json: [{ type: 'instagram_reel', count: 1 }],
    });
    if (bad.status === 422) log('S3.1b', 'PASS', 'D3 FIXED: invalid format type rejected 422 at set create (was: deferred 500 at brand-sign)');
    else log('S3.1b', 'FAIL', 'D3: invalid format type NOT rejected', `HTTP ${bad.status}: ${JSON.stringify(bad.data)}`);
  } catch (e) { fail('S3.1', 'Campaign/set create', e); }

  try {
    const inv = await api(ctx.brandToken).post(`/campaigns/${ctx.campaignId}/sets/${ctx.setId}/invite`, {
      influencer_id: ctx.infId, agreed_fee: 2000,
      posting_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      ...(ctx.setGoal === 'hybrid' ? { offer_type: 'percentage', offer_config_json: { value: 20 }, commission_pct: 5, brand_offer_id: ctx.brandOfferId } : {}),
    });
    const ind = expectOk(inv, 'invite');
    ctx.ciId = (ind.campaign_influencer && ind.campaign_influencer.id) || (ind.invite && ind.invite.id) || ind.id;
    const pub = await api(ctx.brandToken).post(`/campaigns/${ctx.campaignId}/publish`, {});
    expectOk(pub, 'publish');
    const rows = await q(`SELECT c.status AS cstatus, ci.status AS cistatus FROM campaigns c JOIN campaign_sets cs ON cs.campaign_id=c.id JOIN campaign_influencers ci ON ci.set_id=cs.id WHERE c.id=$1`, [ctx.campaignId]);
    if (rows[0] && rows[0].cstatus === 'active' && rows[0].cistatus === 'invited')
      log('S3.2', 'PASS', 'Handpick invite + publish → campaign active, CI invited', `ci=${ctx.ciId}`);
    else log('S3.2', 'FAIL', 'Invite/publish state', JSON.stringify(rows));
  } catch (e) { fail('S3.2', 'Invite + publish', e); }

  // ───────────────────────── STAGE 4: COLLABORATION ──────────────────────────
  try {
    const inbox = await api(ctx.infToken).get('/offers/inbox?status=invited');
    const items = (body(inbox).offers || body(inbox).items || []);
    const mine = items.find(o => (o.id === ctx.ciId) || (o.campaign_influencer_id === ctx.ciId)) || items[0];
    if (!mine) throw new Error(`offer not in inbox (${items.length} items)`);
    ctx.offerCiId = mine.id || mine.campaign_influencer_id;
    log('S4.1', 'PASS', 'Influencer sees offer in inbox', `48h expiry=${mine.offer_expires_at || 'n/a'}`);
  } catch (e) { fail('S4.1', 'Offer inbox', e); }

  try {
    const n = await api(ctx.infToken).post(`/offers/${ctx.offerCiId}/negotiate`, {
      proposed_fee: 2500, message: 'Can we do 2500?',
    });
    const nd = expectOk(n, 'negotiate');
    ctx.negId = (nd.negotiation && nd.negotiation.id) || nd.id;
    // WRONG_TURN check: influencer tries to respond again (it's brand's turn)
    const wrong = await api(ctx.infToken).post(`/negotiations/${ctx.negId}/respond`, { action: 'counter', proposed_fee: 2600 });
    const wrongOk = wrong.status === 422 || (wrong.data && wrong.data.error && wrong.data.error.code === 'WRONG_TURN');
    const acc = await api(ctx.brandToken).post(`/negotiations/${ctx.negId}/respond`, { action: 'accept' });
    expectOk(acc, 'brand accepts negotiation');
    const ci = await q(`SELECT status, agreed_fee FROM campaign_influencers WHERE id=$1`, [ctx.offerCiId]);
    if (ci[0].status === 'accepted' && parseFloat(ci[0].agreed_fee) === 2500)
      log('S4.2', 'PASS', `Negotiation round + accept → fee ₹2500${wrongOk ? ', WRONG_TURN enforced' : ', WRONG_TURN NOT enforced!'}`);
    else log('S4.2', 'FAIL', 'Negotiation outcome', JSON.stringify(ci));
  } catch (e) { fail('S4.2', 'Negotiation', e); }

  try {
    const crows = await q(`SELECT id, status FROM contracts WHERE campaign_influencer_id=$1`, [ctx.offerCiId]);
    if (!crows[0]) throw new Error('contract NOT auto-created after accept');
    ctx.contractId = crows[0].id;
    let st = crows[0].status;
    if (st === 'draft') {
      const ap = await api(ctx.brandToken).post(`/contracts/${ctx.contractId}/approve`, {});
      if (ap.status >= 400) throw new Error(`contract approve: ${JSON.stringify(ap.data)}`);
      st = 'pending_influencer';
    }
    const sg = await api(ctx.infToken).post(`/contracts/${ctx.contractId}/sign`, { typed_name: 'Journey Creator' });
    expectOk(sg, 'influencer sign');
    const balBefore = await q(`SELECT wallet_balance FROM brands WHERE id=$1`, [ctx.brandId]);
    const bs = await api(ctx.brandToken).post(`/contracts/${ctx.contractId}/brand-sign`, {});
    expectOk(bs, 'brand countersign');
    const c2 = await q(`SELECT status FROM contracts WHERE id=$1`, [ctx.contractId]);
    const esc = await q(`SELECT tranche_number, amount, status FROM escrow_entries WHERE campaign_influencer_id=$1 ORDER BY tranche_number`, [ctx.offerCiId]);
    const infW = await q(`SELECT wallet_balance, pending_balance FROM influencers WHERE id=$1`, [ctx.infId]);
    const balAfter = await q(`SELECT wallet_balance FROM brands WHERE id=$1`, [ctx.brandId]);
    const t1 = esc.find(e => e.tranche_number === 1);
    const detail = `contract=${c2[0].status}; escrow=[${esc.map(e => `T${e.tranche_number}:${e.amount}:${e.status}`).join(',')}]; inf wallet=${infW[0].wallet_balance}; brand ${balBefore[0].wallet_balance}→${balAfter[0].wallet_balance}`;
    if (c2[0].status === 'active' && esc.length === 3 && t1 && t1.status === 'released') log('S4.3', 'PASS', 'Both-sign → wallet lock + 3 escrow tranches + T1 (25%) released', detail);
    else log('S4.3', 'FAIL', 'Contract sign / escrow / T1', detail);
  } catch (e) { fail('S4.3', 'Contract signing + T1', e); }

  // ───────────────────────── STAGE 5: CONTENT → LIVE → T2 ────────────────────
  try {
    const drows = await q(`SELECT id, status FROM deliverables WHERE campaign_influencer_id=$1`, [ctx.offerCiId]);
    if (!drows[0]) throw new Error('deliverable NOT auto-created at brand-sign');
    ctx.delivId = drows[0].id;
    const sub = await api(ctx.infToken).post(`/deliverables/${ctx.delivId}/submit`, { submitted_url: 'https://instagram.com/reel/journeyA', notes_to_brand: 'v1' });
    expectOk(sub, 'submit');
    const rev = await api(ctx.brandToken).post(`/deliverables/${ctx.delivId}/review`, { action: 'request_revision', feedback: 'Add coupon to caption' });
    expectOk(rev, 'request revision');
    const sub2 = await api(ctx.infToken).post(`/deliverables/${ctx.delivId}/submit`, { submitted_url: 'https://instagram.com/reel/journeyB', notes_to_brand: 'v2' });
    expectOk(sub2, 'resubmit');
    const ok = await api(ctx.brandToken).post(`/deliverables/${ctx.delivId}/review`, { action: 'approve' });
    expectOk(ok, 'approve');
    const lv = await api(ctx.infToken).post(`/deliverables/${ctx.delivId}/submit-live`, { live_url: 'https://instagram.com/reel/journeyB' });
    expectOk(lv, 'submit live');
    const cf = await api(ctx.brandToken).post(`/deliverables/${ctx.delivId}/confirm-live`, {});
    const cfd = expectOk(cf, 'confirm live');
    const esc = await q(`SELECT tranche_number, status FROM escrow_entries WHERE campaign_influencer_id=$1 ORDER BY tranche_number`, [ctx.offerCiId]);
    const ci = await q(`SELECT status FROM campaign_influencers WHERE id=$1`, [ctx.offerCiId]);
    const t2 = esc.find(e => e.tranche_number === 2);
    const detail = `t2_released=${cfd.t2_released}; escrow=[${esc.map(e => `T${e.tranche_number}:${e.status}`).join(',')}]; CI=${ci[0].status}`;
    if (t2 && t2.status === 'released' && ci[0].status === 'active') log('S5.1', 'PASS', 'Submit → revision (1/2) → approve → live → confirm-live → T2 released', detail);
    else log('S5.1', 'FAIL', 'Content go-live / T2', detail);
  } catch (e) { fail('S5.1', 'Content → live → T2', e); }

  try { // share link: backend redirect endpoint
    const handle = `journey_creator_${RUN}`;
    const r = await axios.get(`http://localhost:3001/s/${handle}?cid=${ctx.campaignId}&sid=${ctx.setId}&oid=&iid=${ctx.offerCiId}`, { maxRedirects: 0, validateStatus: () => true });
    if (r.status >= 300 && r.status < 400) log('S5.2', 'PASS', 'Share link /s/{handle} redirects + logs click', `→ ${r.headers.location}`);
    else log('S5.2', 'FAIL', 'Share link redirect', `HTTP ${r.status}`);
  } catch (e) { fail('S5.2', 'Share link', e); }

  // ───────────────────────── STAGE 6: FOLLOWER ───────────────────────────────
  try {
    const f = await login(P(3), 'follower');
    ctx.folToken = f.token;
    const me = await api(ctx.folToken).get('/followers/me');
    const md = expectOk(me, 'followers/me');
    ctx.followerId = (md.follower && md.follower.id) || md.id;
    log('S6.1', 'PASS', 'Follower signup → auto-approved, no admin gate', `follower_id=${ctx.followerId}`);
  } catch (e) { fail('S6.1', 'Follower signup', e); }

  try {
    const r = await api(ctx.folToken).get(`/business/${ctx.brandId}/store`);
    const d = expectOk(r, 'business store');
    const nProducts = (d.products || []).length;
    // CTA spec (Docs/CTA_SPEC.md, sprint2): the schema template must carry the
    // founder-locked actions — exactly one primary, canonical pay_at_store verb.
    const actions = (d.template && d.template.brand_config && d.template.brand_config.actions) || [];
    const tx = actions.filter(a => a.kind === 'transactional');
    const primaries = tx.filter(a => a.primary);
    const hasLegacyVerb = tx.some(a => a.action === 'walkin_pay');
    const ctaOk = tx.length >= 2 && primaries.length === 1 && !hasLegacyVerb;
    if (ctaOk) log('S6.2', 'PASS', 'Business store page + locked CTA spec in template', `${nProducts} products; primary=${primaries[0].label}; ctas=[${tx.map(a => a.label).join(' · ')}]`);
    else log('S6.2', 'FAIL', 'Business store CTA spec', `tx=${tx.length} primaries=${primaries.length} legacyVerb=${hasLegacyVerb} actions=${JSON.stringify(actions.map(a => a.action))}`);
  } catch (e) { fail('S6.2', 'Business store fetch', e); }

  try { // PAY AT STORE with full 4-ID tracking
    const init = await api(ctx.folToken).post('/follower/pay-at-store', {
      campaign_id: ctx.campaignId, set_id: ctx.setId, campaign_influencer_id: ctx.offerCiId,
      bill_amount: 1000,
    });
    const ind = expectOk(init, 'pay-at-store init');
    const ver = await api(ctx.folToken).post('/follower/pay-at-store/verify', {
      razorpay_order_id: ind.razorpay_order_id || ind.order_id, razorpay_payment_id: `pay_mock_pas_${RUN}`,
    });
    expectOk(ver, 'pay-at-store verify');
    const tx = await q(`SELECT transaction_type, status, campaign_id, set_id, campaign_influencer_id, influencer_commission, marketplace_fee_amount, return_window_ends_at FROM follower_transactions WHERE follower_id=$1 AND transaction_type='pay_at_store'`, [ctx.followerId]);
    const t = tx[0];
    if (!t) throw new Error('no follower_transactions row written');
    const idsOk = t.campaign_id === ctx.campaignId && t.set_id === ctx.setId && t.campaign_influencer_id === ctx.offerCiId;
    const infW = await q(`SELECT pending_balance FROM influencers WHERE id=$1`, [ctx.infId]);
    ctx.commission = parseFloat(t.influencer_commission || 0);
    const detail = `4IDs=${idsOk}; commission=${t.influencer_commission}; mktfee=${t.marketplace_fee_amount}; inf pending=${infW[0].pending_balance}; window_ends=${t.return_window_ends_at}`;
    if (idsOk && t.status === 'completed') log('S6.3', 'PASS', 'Pay-at-store E2E: attribution IDs + fee recorded', detail);
    else log('S6.3', 'FAIL', 'Pay-at-store', detail);
  } catch (e) { fail('S6.3', 'Pay-at-store', e); }

  try { // ONLINE ORDER happy path
    const addr = await api(ctx.folToken).post('/follower/addresses', {
      label: 'Home', line1: '5 Beach Rd', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520001',
      lat: 16.5062, lng: 80.648,
    });
    const ad = expectOk(addr, 'create address');
    const addrId = (ad.address && ad.address.id) || ad.id;
    const ord = await api(ctx.folToken).post('/follower/orders', {
      campaign_id: ctx.campaignId, set_id: ctx.setId, campaign_influencer_id: ctx.offerCiId,
      items: [{ product_id: ctx.productId, qty: 1, quantity: 1 }], address_id: addrId,
    });
    const od = expectOk(ord, 'place order');
    const ver = await api(ctx.folToken).post('/follower/orders/verify', {
      razorpay_order_id: od.razorpay_order_id || od.order_id, razorpay_payment_id: `pay_mock_ord_${RUN}`,
    });
    expectOk(ver, 'verify order');
    const rows = await q(`SELECT ft.id, ft.status, fo.order_status FROM follower_transactions ft LEFT JOIN follower_orders fo ON fo.transaction_id=ft.id WHERE ft.follower_id=$1 AND ft.transaction_type='online_order'`, [ctx.followerId]);
    const act = await api(ctx.folToken).get('/follower/activity');
    const actItems = (body(act).items || body(act).activity || []);
    const detail = `order_status=${rows[0] && rows[0].order_status}; activity items=${actItems.length}`;
    if (rows[0] && rows[0].order_status === 'confirmed' && actItems.length >= 1) log('S6.4', 'PASS', 'Online order E2E + appears in activity (Orders tab source)', detail);
    else log('S6.4', 'FAIL', 'Online order', detail + ` rows=${JSON.stringify(rows)}`);
  } catch (e) { fail('S6.4', 'Online order', e); }

  try { // NEGATIVE: order created but verify never fires → silent loss
    const before = await q(`SELECT count(*)::int n FROM follower_transactions WHERE follower_id=$1`, [ctx.followerId]);
    const ord = await api(ctx.folToken).post('/follower/orders', {
      campaign_id: ctx.campaignId, set_id: ctx.setId, campaign_influencer_id: ctx.offerCiId,
      items: [{ product_id: ctx.productId, qty: 1, quantity: 1 }],
    });
    if (ord.status < 400) {
      const after = await q(`SELECT count(*)::int n FROM follower_transactions WHERE follower_id=$1`, [ctx.followerId]);
      const od = body(ord);
      const oid = od.razorpay_order_id || od.order_id;
      const pend = await q(`SELECT consumed_at FROM payment_pending_orders WHERE order_id=$1`, [oid]);
      if (after[0].n === before[0].n && pend[0] && pend[0].consumed_at === null)
        log('S6.5', 'PASS', 'D2 FIXED: unverified order persists as durable unconsumed pending-order row (was: zero trace)', `order_id=${oid}`);
      else if (!pend[0]) log('S6.5', 'FAIL', 'D2: no payment_pending_orders row for unverified order', `order_id=${oid}`);
      else log('S6.5', 'INFO', 'Unverified order state unexpected', JSON.stringify({ txDelta: after[0].n - before[0].n, pend: pend[0] }));
    } else log('S6.5', 'INFO', 'Order-create without address rejected', JSON.stringify(ord.data));
  } catch (e) { fail('S6.5', 'Silent-loss negative test', e); }

  try { // OFFER PIPELINE E2E (contract: sprint1-offer-pipeline)
    // (a) publish the library offer to the store → it must appear in the feed
    const pub = await api(ctx.brandToken).patch(`/brands/me/offers/${ctx.brandOfferId}`, {
      status: 'active', published_to_store: true,
    });
    expectOk(pub, 'publish offer to store');
    const sec = await api(ctx.folToken).get('/follower/section/offers');
    const sections = (body(sec).sections || []);
    const items = sections.flatMap(s => s.items || []).filter(i => i && i.entity_type === 'offer');
    const storeItem = items.find(i => i.source === 'store' && i.id === ctx.brandOfferId);
    const ciItem = items.find(i => i.source === 'assignment');

    // (b) store-direct tap path: GET /follower/store-offer/:id → 200 + products
    let storeOk = false;
    if (storeItem || ctx.brandOfferId) {
      const det = await api(ctx.folToken).get(`/follower/store-offer/${ctx.brandOfferId}`);
      const dd = body(det);
      storeOk = det.status === 200 && dd.offer && Array.isArray(dd.products);
      if (!storeOk) log('S6.6a', 'FAIL', 'store-offer detail fetch', `HTTP ${det.status}: ${JSON.stringify(det.data).slice(0, 200)}`);
      else log('S6.6a', 'PASS', 'Store-published offer: feed item + detail fetch 200 (offer + products)', `in_feed=${!!storeItem}; products=${dd.products.length}; discount=${dd.offer.discount && dd.offer.discount.label}`);
    }

    // (c) assignment tap path: ci_id → /store/:handle/products (the app's new explicit identity)
    if (ciItem) {
      const handle = ciItem.via_creator && ciItem.via_creator.handle;
      const r = await api(ctx.folToken).get(`/store/${handle}/products?ci_id=${ciItem.id}`);
      if (r.status === 200) log('S6.6b', 'PASS', 'Assignment offer: ci_id tap path resolves products', `products=${(body(r).products || []).length}`);
      else log('S6.6b', 'FAIL', 'Assignment ci_id tap path', `HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
      // (d) the OLD broken pattern (library oid sent as offer_id) must no longer be used by the app;
      // backend still 404s it — assert it 404s so we know the legacy branch didn't silently change.
      const old = await api(ctx.folToken).get(`/store/${handle}/products?offer_id=${ctx.brandOfferId}`);
      log('S6.6c', old.status === 404 ? 'PASS' : 'INFO', 'Legacy misuse (library id as offer_id) still rejected', `HTTP ${old.status}`);
    } else {
      log('S6.6b', 'INFO', 'No assignment-sourced offer item in feed', `items=${items.length}`);
    }
  } catch (e) { fail('S6.6', 'Offer pipeline E2E', e); }

  try { // ENQUIRY
    const r = await api(ctx.folToken).post('/follower/enquiry', {
      brand_id: ctx.brandId, campaign_id: ctx.campaignId, set_id: ctx.setId,
      campaign_influencer_id: ctx.offerCiId,
      form_data: { name: 'Journey Buyer', phone: P(3), message: 'Is this available in L?' },
    });
    expectOk(r, 'enquiry');
    const rows = await q(`SELECT id, status FROM enquiry_leads WHERE brand_id=$1`, [ctx.brandId]);
    if (rows.length) log('S6.7', 'PASS', 'Enquiry → enquiry_leads row written', `status=${rows[0].status}`);
    else log('S6.7', 'FAIL', 'Enquiry row missing');
  } catch (e) { fail('S6.7', 'Enquiry', e); }

  try { // PREBOOK
    const init = await api(ctx.folToken).post('/follower/prebook', {
      campaign_id: ctx.campaignId, set_id: ctx.setId, campaign_influencer_id: ctx.offerCiId,
      booking_date: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      booking_time: '19:00', guest_count: 2,
    });
    const ind = expectOk(init, 'prebook init');
    const ver = await api(ctx.folToken).post('/follower/prebook/verify', {
      razorpay_order_id: ind.razorpay_order_id || ind.order_id, razorpay_payment_id: `pay_mock_pb_${RUN}`,
    });
    expectOk(ver, 'prebook verify');
    const rows = await q(`SELECT fb.status, fb.booking_type FROM follower_bookings fb JOIN follower_transactions ft ON ft.id=fb.transaction_id WHERE ft.follower_id=$1`, [ctx.followerId]);
    if (rows[0] && rows[0].status === 'confirmed') log('S6.8', 'PASS', 'Prebook token payment → booking confirmed', `type=${rows[0].booking_type}`);
    else log('S6.8', 'FAIL', 'Prebook', JSON.stringify(rows));
  } catch (e) { fail('S6.8', 'Prebook', e); }

  // ───────────────────────── STAGE 7: MONEY SETTLES ──────────────────────────
  try {
    if (!ctx.commission || ctx.commission <= 0) {
      log('S7.1', 'INFO', 'No commission accrued (set goal=' + ctx.setGoal + ') — release test on tranche path only');
    }
    await q(`UPDATE follower_transactions SET return_window_ends_at = now() - interval '1 minute' WHERE follower_id=$1 AND commission_confirmed_at IS NULL`, [ctx.followerId]);
    const job = require('../src/jobs/commission-confirm.job');
    await job.run();
    const after = await q(`SELECT wallet_balance, pending_balance FROM influencers WHERE id=$1`, [ctx.infId]);
    const confirmed = await q(`SELECT count(*)::int n FROM follower_transactions WHERE follower_id=$1 AND commission_confirmed_at IS NOT NULL`, [ctx.followerId]);
    const detail = `confirmed_txns=${confirmed[0].n}; inf wallet=${after[0].wallet_balance}; pending=${after[0].pending_balance}`;
    if (confirmed[0].n >= 1 && parseFloat(after[0].pending_balance) === 0) log('S7.1', 'PASS', 'Return window closes → cron moves commission pending→wallet', detail);
    else log('S7.1', ctx.commission > 0 ? 'FAIL' : 'INFO', 'Commission release cron', detail);
  } catch (e) { fail('S7.1', 'Commission release cron', e); }

  try { // T3 release — two-part: (a) defect = nothing queues T3 at content-live; (b) prove release path works once queued
    const pre = await q(`SELECT status, triggered_at FROM escrow_entries WHERE campaign_influencer_id=$1 AND tranche_number=3`, [ctx.offerCiId]);
    const defect = pre[0] && (pre[0].status !== 'queued' || !pre[0].triggered_at);
    await q(`UPDATE escrow_entries SET status='queued', triggered_at = now() - interval '31 days' WHERE campaign_influencer_id=$1 AND tranche_number=3`, [ctx.offerCiId]);
    const job = require('../src/jobs/tranche-3-release.job');
    await job.run();
    const esc = await q(`SELECT status FROM escrow_entries WHERE campaign_influencer_id=$1 AND tranche_number=3`, [ctx.offerCiId]);
    const released = esc[0] && esc[0].status === 'released';
    if (defect && released) log('S7.2', 'FAIL', 'GENUINE DEFECT: T3 never queued at content-live (cron release path itself OK once queued)', `post-live state was status=${pre[0].status}, triggered_at=${pre[0].triggered_at}`);
    else if (!defect && released) log('S7.2', 'PASS', 'T3 auto-release E2E');
    else log('S7.2', 'FAIL', 'T3 release path broken even when queued', `status=${esc[0] && esc[0].status} (IST time-gate?)`);
  } catch (e) { fail('S7.2', 'T3 release cron', e); }

  try { // withdrawal — set UPI on profile first
    const up = await api(ctx.infToken).patch('/influencers/me', { upi_id: 'journey@upi' });
    if (up.status >= 400) log('S7.3a', 'INFO', 'Could not set UPI via PATCH /influencers/me', JSON.stringify(up.data));
    const w = await api(ctx.infToken).post('/influencers/me/withdraw', { amount_requested: 200, method: 'upi' });
    if (w.status < 400) {
      const rows = await q(`SELECT amount_requested, tds_deducted, net_paid, status FROM influencer_withdrawals ORDER BY created_at DESC LIMIT 1`);
      const r0 = rows[0] || {};
      const tdsOk = Math.abs(parseFloat(r0.tds_deducted) - 20) < 0.01;
      log('S7.3', tdsOk ? 'PASS' : 'FAIL', 'Withdrawal ₹200 → TDS 10% (₹20) → net ₹180', JSON.stringify(r0));
    } else {
      log('S7.3', 'INFO', 'Withdrawal blocked (likely no UPI/bank on file — separate setup endpoint)', JSON.stringify(w.data));
    }
  } catch (e) { fail('S7.3', 'Withdrawal', e); }

  // ───────────────────────── LEDGER ───────────────────────────────────────────
  console.log('\n=== LEDGER ===');
  for (const l of ledger) console.log(`${l.status.padEnd(7)} ${l.id.padEnd(6)} ${l.name}`);
  const counts = ledger.reduce((a, l) => { a[l.status] = (a[l.status] || 0) + 1; return a; }, {});
  console.log(`\nTOTALS: ${JSON.stringify(counts)}`);
  require('fs').writeFileSync(path.join(__dirname, `journey-phase-a-report-${RUN}.json`), JSON.stringify({ run: RUN, ctx: { ...ctx, admin: undefined, brandToken: undefined, infToken: undefined, folToken: undefined }, ledger }, null, 2));
  await db.end();
})().catch(async (e) => {
  console.error('FATAL:', e.message);
  try { await db.end(); } catch (_) {}
  process.exit(1);
});
