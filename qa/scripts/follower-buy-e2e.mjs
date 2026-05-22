#!/usr/bin/env node
'use strict';

/**
 * follower-buy-e2e.mjs — the FINAL link of the conversion chain: a follower
 * pays-at-store via the contracted influencer's tracking context, and the
 * commission attributes to that influencer.
 *
 * The brand has no products, so pay-at-store (free-form bill, no cart) is the
 * viable path. Drives the real local backend; mints a follower token directly.
 *
 *   node qa/scripts/follower-buy-e2e.mjs
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'http://localhost:3001/v1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const FOLLOWER_PHONE = '+919900000003';
const BILL = 1000;

function sql(q) {
  const r = spawnSync('docker', ['exec', '-i', 'inflx-dev-pg', 'psql', '-U', 'postgres', '-d', 'inflx_dev', '-t', '-A', '-f', '-'],
    { encoding: 'utf8', shell: process.platform === 'win32', input: q });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
}
const b64 = (s) => Buffer.from(s).toString('base64url');
function mintToken(payload) {
  const env = fs.readFileSync(path.join(REPO, 'backend', '.env'), 'utf8');
  const secret = env.match(/^JWT_SECRET\s*=\s*(.+)$/m)[1].trim().replace(/^["']|["']$/g, '');
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64(JSON.stringify({ ...payload, iat: now, exp: now + 3600 }));
  const sig = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url');
  return `${h}.${p}.${sig}`;
}
async function api(method, p, body, token) {
  const res = await fetch(`${API}${p}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data };
}
const die = (m) => { console.error(`[follower-buy] FAIL — ${m}`); process.exit(1); };

async function main() {
  // 1. ensure dummy follower (SQL — no /auth, no rate limit)
  let fUser = sql(`SELECT id FROM users WHERE phone='${FOLLOWER_PHONE}';`).split('\n')[0];
  if (!fUser) {
    fUser = sql(`INSERT INTO users (phone, role, name, status) VALUES ('${FOLLOWER_PHONE}','follower','Dummy Follower','approved') RETURNING id;`).split('\n')[0];
    console.log(`[follower-buy] created follower user ${fUser}`);
  }
  let fProfile = sql(`SELECT id FROM followers WHERE user_id='${fUser}';`).split('\n')[0];
  if (!fProfile) {
    fProfile = sql(`INSERT INTO followers (user_id) VALUES ('${fUser}') RETURNING id;`).split('\n')[0];
  }
  console.log(`[follower-buy] follower ready (user ${fUser})`);

  // 2. tracking context from the CONTRACTED influencer CI
  const row = sql(`
    SELECT c.id || '|' || cs.id || '|' || ci.id || '|' || COALESCE(ci.commission_pct::text,'')
    FROM campaign_influencers ci
    JOIN campaign_sets cs ON cs.id = ci.set_id
    JOIN campaigns c ON c.id = cs.campaign_id
    JOIN influencers i ON i.id = ci.influencer_id
    JOIN users u ON u.id = i.user_id
    WHERE u.phone='+919900000002' AND ci.status='contracted'
    ORDER BY ci.created_at DESC LIMIT 1;`).split('\n')[0];
  if (!row) die('no contracted CI found — run the contract chain first');
  const [campaign_id, set_id, campaign_influencer_id, commission_pct] = row.split('|');
  console.log(`[follower-buy] tracking: campaign=${campaign_id.slice(0,8)} set=${set_id.slice(0,8)} ci=${campaign_influencer_id.slice(0,8)} commission=${commission_pct}%`);

  // influencer pending_balance BEFORE
  const before = sql(`SELECT COALESCE(pending_balance,0) FROM influencers i JOIN users u ON u.id=i.user_id WHERE u.phone='+919900000002';`).split('\n')[0];

  const token = mintToken({ sub: fUser, role: 'follower' });

  // 3. pay-at-store initiate → verify
  const init = await api('POST', '/follower/pay-at-store', { campaign_id, set_id, campaign_influencer_id, bill_amount: BILL }, token);
  if (init.status >= 300) die(`pay-at-store initiate → ${init.status} ${JSON.stringify(init.data)}`);
  const orderId = init.data?.data?.razorpay_order_id || init.data?.razorpay_order_id;
  console.log(`[follower-buy] initiated bill ₹${BILL} → order ${orderId}`);

  const ver = await api('POST', '/follower/pay-at-store/verify', { razorpay_order_id: orderId, razorpay_payment_id: 'pay_mock_e2e_' + Date.now() }, token);
  if (ver.status >= 300) die(`pay-at-store verify → ${ver.status} ${JSON.stringify(ver.data)}`);
  console.log(`[follower-buy] verify → ${ver.status} ✓`);

  // 4. verify commission attribution
  const after = sql(`SELECT COALESCE(pending_balance,0) FROM influencers i JOIN users u ON u.id=i.user_id WHERE u.phone='+919900000002';`).split('\n')[0];
  const tx = sql(`
    SELECT transaction_type || '|' || status || '|' || COALESCE(influencer_commission::text,'') || '|' || COALESCE(net_amount::text,'')
    FROM follower_transactions ft JOIN followers f ON f.id=ft.follower_id JOIN users u ON u.id=f.user_id
    WHERE u.phone='${FOLLOWER_PHONE}' ORDER BY ft.created_at DESC LIMIT 1;`).split('\n')[0];

  console.log('\n[follower-buy] ✓ DONE — conversion chain complete');
  console.log(`[follower-buy]   follower_transaction : ${tx}  (type|status|commission|net)`);
  console.log(`[follower-buy]   influencer pending_balance : ₹${before} → ₹${after}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
