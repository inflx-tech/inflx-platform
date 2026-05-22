#!/usr/bin/env node
'use strict';

/**
 * seed-conversion-e2e.mjs — dummy data + brand session for the conversion E2E.
 *
 * Ensures (idempotently) ONE approved brand + ONE approved influencer in the
 * LOCAL dev DB (inflx_dev :5433), then mints a brand access token DIRECTLY
 * (HS256 with backend JWT_SECRET) and writes it to qa/artifacts/.brand-session
 * .json for the Playwright test to inject.
 *
 * Design notes:
 *  - Users are created via the real backend API ONLY on first run (when they
 *    don't yet exist). On re-runs they're reused — ZERO /auth calls — so the
 *    (correct, must-stay-on) /auth rate limiter is never tripped by iteration.
 *  - OTP is inserted via SQL (not /auth/send-otp) on first-run creation only.
 *  - The session token is minted locally, never via /auth — fully repeatable.
 *
 * SAFETY: only runs against localhost backend; never seeds prod.
 * Usage: node qa/scripts/seed-conversion-e2e.mjs
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.QA_API_BASE || 'http://localhost:3001/v1';
const DEV_CONTAINER = 'inflx-dev-pg';
const DEV_DB = 'inflx_dev';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const SESSION_FILE = path.join(__dirname, '..', 'artifacts', '.brand-session.json');

export const SEED = {
  brand: {
    phone: '+919900000001', name: 'Dummy Brand Owner', business_name: 'QA Test Diner',
    category: 'restaurant', address_line: '1 Test Street', city: 'Vijayawada',
    state: 'Andhra Pradesh', pincode: '520001',
  },
  influencer: {
    phone: '+919900000002', name: 'Dummy Creator', instagram_handle: 'test_creator', city: 'Vijayawada',
  },
};

async function fail(msg) { console.error(`[seed] FAIL — ${msg}`); process.exit(1); }

// ── SQL (pipe via stdin -f -, NOT -c: Windows shell:true splits -c on spaces) ──
function sqlExec(sql, extraArgs = []) {
  const r = spawnSync('docker',
    ['exec', '-i', DEV_CONTAINER, 'psql', '-U', 'postgres', '-d', DEV_DB, ...extraArgs, '-f', '-'],
    { encoding: 'utf8', shell: process.platform === 'win32', input: sql });
  if (r.status !== 0) throw new Error(`[seed] SQL failed: ${r.stderr || r.stdout}`);
  return r.stdout.trim();
}
const sqlScalar = (sql) => sqlExec(sql, ['-t', '-A']).split('\n')[0].trim();

// ── HTTP ──
async function post(p, body, token) {
  const res = await fetch(`${API}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  let data = null; try { data = await res.json(); } catch { /* */ }
  return { status: res.status, data };
}

// ── manual HS256 JWT (matches backend jwt.service: jwt.sign(payload, SECRET)) ──
const b64url = (s) => Buffer.from(s).toString('base64url');
function signJwt(payload, secret, ttlSec) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSec }));
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
function readJwtSecret() {
  const env = fs.readFileSync(path.join(REPO, 'backend', '.env'), 'utf8');
  const m = env.match(/^JWT_SECRET\s*=\s*(.+)$/m);
  if (!m) throw new Error('[seed] JWT_SECRET not found in backend/.env');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

function insertOtp(phone) {
  sqlExec(
    `UPDATE otp_codes SET used=true WHERE phone='${phone}' AND used=false; ` +
    `INSERT INTO otp_codes (phone, code, expires_at) VALUES ('${phone}', '000000', now() + interval '10 minutes');`);
}

// Create the user+profile via the real API — ONLY when they don't exist yet.
async function ensureActor(kind, cfg) {
  const existing = sqlScalar(`SELECT id FROM users WHERE phone='${cfg.phone}';`);
  if (existing) { console.log(`[seed] ${kind} reused (user ${existing})`); return existing; }

  insertOtp(cfg.phone); // SQL, not /auth/send-otp
  const ver = await post('/auth/verify-otp', { phone: cfg.phone, otp: '000000', role: kind, name: cfg.name });
  if (ver.status !== 200 || !ver.data?.success) await fail(`verify-otp ${cfg.phone} → ${ver.status} ${JSON.stringify(ver.data)} (first-run only; if rate-limited, wait 15m or restart backend)`);
  const token = ver.data.data.access_token;

  const regPath = kind === 'brand' ? '/brands/register' : '/influencers/register';
  const regBody = kind === 'brand'
    ? { name: cfg.name, business_name: cfg.business_name, category: cfg.category, address_line: cfg.address_line, city: cfg.city, state: cfg.state, pincode: cfg.pincode }
    : { name: cfg.name, instagram_handle: cfg.instagram_handle, city: cfg.city };
  const reg = await post(regPath, regBody, token);
  if (![200, 201, 409].includes(reg.status)) await fail(`${regPath} → ${reg.status} ${JSON.stringify(reg.data)}`);
  console.log(`[seed] ${kind} created (user ${ver.data.data.user.id})`);
  return ver.data.data.user.id;
}

async function main() {
  const healthy = await fetch(`${API.replace('/v1', '')}/health`).then((r) => r.ok).catch(() => false);
  if (!healthy) await fail(`backend not reachable at ${API} — run pnpm dev:all`);

  console.log('[seed] ensuring approved brand + influencer in inflx_dev (local) …');
  await ensureActor('brand', SEED.brand);
  await ensureActor('influencer', SEED.influencer);

  console.log('[seed] approving:\n' +
    sqlExec(`UPDATE users SET status='approved' WHERE phone IN ('${SEED.brand.phone}','${SEED.influencer.phone}') RETURNING phone, role, status;`));

  // mint brand session token directly (no /auth call — fully repeatable)
  const brandUserId = sqlScalar(`SELECT id FROM users WHERE phone='${SEED.brand.phone}';`);
  const brandId = sqlScalar(`SELECT id FROM brands WHERE user_id='${brandUserId}';`);
  if (!brandUserId || !brandId) await fail(`could not resolve brand ids (user=${brandUserId} brand=${brandId})`);
  const token = signJwt({ sub: brandUserId, role: 'brand', brand_id: brandId }, readJwtSecret(), 60 * 60);

  const me = await fetch(`${API}/brands/me`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()).catch(() => null);
  if (!me?.success) await fail(`minted token rejected by /brands/me → ${JSON.stringify(me)}`);
  const brand = me.data?.brand || me.data;
  const user = me.data?.user || { id: brandUserId, role: 'brand', name: SEED.brand.name, status: 'approved' };

  fs.mkdirSync(path.dirname(SESSION_FILE), { recursive: true });
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ access_token: token, user, brand }, null, 2));

  console.log('\n[seed] ✓ DONE');
  console.log(`[seed]   brand          : ${SEED.brand.phone} (approved) — session minted (token verified via /brands/me)`);
  console.log(`[seed]   influencer     : @${SEED.influencer.instagram_handle} (${SEED.influencer.name}, approved)`);
  console.log(`[seed]   session file   : ${SESSION_FILE}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
