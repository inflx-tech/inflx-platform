#!/usr/bin/env node
'use strict';

/**
 * contract-step.mjs — drive the BRAND-side contract steps of the conversion
 * chain against the LOCAL backend, for the E2E (the influencer-side steps are
 * Maestro). Mints a fresh brand token directly (HS256, no /auth call).
 *
 *   node qa/scripts/contract-step.mjs approve      # draft → pending_influencer
 *   node qa/scripts/contract-step.mjs brand-sign   # pending_brand → active (CI contracted)
 *   node qa/scripts/contract-step.mjs status       # print current contract status
 *
 * Targets the most-recent contract for the seeded influencer +919900000002.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'http://localhost:3001/v1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..', '..');
const INF_PHONE = '+919900000002';

function sql(q) {
  const r = spawnSync('docker', ['exec', '-i', 'inflx-dev-pg', 'psql', '-U', 'postgres', '-d', 'inflx_dev', '-t', '-A', '-f', '-'],
    { encoding: 'utf8', shell: process.platform === 'win32', input: q });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout.trim();
}
const b64 = (s) => Buffer.from(s).toString('base64url');
function mintBrandToken() {
  const env = fs.readFileSync(path.join(REPO, 'backend', '.env'), 'utf8');
  const secret = env.match(/^JWT_SECRET\s*=\s*(.+)$/m)[1].trim().replace(/^["']|["']$/g, '');
  const brandUserId = sql(`SELECT id FROM users WHERE phone='+919900000001';`).split('\n')[0];
  const brandId = sql(`SELECT id FROM brands WHERE user_id='${brandUserId}';`).split('\n')[0];
  const now = Math.floor(Date.now() / 1000);
  const h = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64(JSON.stringify({ sub: brandUserId, role: 'brand', brand_id: brandId, iat: now, exp: now + 3600 }));
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

function latestContract() {
  const row = sql(`
    SELECT co.id || '|' || co.status
    FROM contracts co
    JOIN campaign_influencers ci ON ci.id = co.campaign_influencer_id
    JOIN influencers i ON i.id = ci.influencer_id
    JOIN users u ON u.id = i.user_id
    WHERE u.phone = '${INF_PHONE}'
    ORDER BY co.created_at DESC LIMIT 1;`).split('\n')[0];
  const [id, status] = row.split('|');
  return { id, status };
}

async function main() {
  const step = process.argv[2];
  const token = mintBrandToken();
  const c = latestContract();
  console.log(`[contract-step] latest contract ${c.id} status=${c.status}`);

  if (step === 'status') return;

  if (step === 'approve') {
    const r = await api('POST', `/contracts/${c.id}/approve`, {
      production_mode: 'remote',
      content_requirements: '1 Instagram reel featuring the restaurant, posted within the window.',
      bonus_amount: 0,
    }, token);
    console.log(`[contract-step] approve → ${r.status} ${JSON.stringify(r.data?.error || r.data?.data?.contract?.status || r.data)}`);
    process.exit(r.status < 300 ? 0 : 1);
  } else if (step === 'brand-sign') {
    const r = await api('POST', `/contracts/${c.id}/brand-sign`, {}, token);
    console.log(`[contract-step] brand-sign → ${r.status} ${JSON.stringify(r.data?.error || r.data?.data?.contract?.status || r.data)}`);
    process.exit(r.status < 300 ? 0 : 1);
  } else {
    console.error('usage: contract-step.mjs <approve|brand-sign|status>');
    process.exit(2);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
