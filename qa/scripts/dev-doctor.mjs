#!/usr/bin/env node
'use strict';

/**
 * dev-doctor.mjs — verify the local-dev stack and print the URLs.
 *
 * Positive checks only. Loud on every failure (no silent "all green").
 * Exits 0 only when every check passes.
 *
 * Contract: features/setup-local-dev-environment/
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PG_CONTAINER, PG_PORT, PG_IMAGE, DB_NAME, DEV_DATABASE_URL } from './dev-db-config.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isWin = process.platform === 'win32';
const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: isWin, ...opts });

let failures = 0;
const ok    = (m) => console.log(`[dev-doctor] ✓ ${m}`);
const info  = (m) => console.log(`[dev-doctor] (i) ${m}`);
const bad   = (m, fix) => { failures += 1; console.error(`[dev-doctor] ✗ ${m}`); if (fix) console.error(`             fix: ${fix}`); };

function parseEnv(file) {
  if (!fs.existsSync(file)) return null;
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !line.trim().startsWith('#')) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function dbQuery(sql) {
  // Feed SQL via stdin (-f -), not as -c argument. On Windows, spawnSync with
  // shell:true concatenates args without escaping → cmd.exe splits the SQL on
  // spaces and psql sees garbage. Stdin avoids the shell-escape pitfall entirely.
  const r = spawnSync(
    'docker',
    ['exec', '-i', PG_CONTAINER, 'psql', '-U', 'postgres', '-d', DB_NAME, '-A', '-t', '-f', '-'],
    { encoding: 'utf8', shell: isWin, input: sql }
  );
  if (r.status !== 0) return null;
  return r.stdout.trim();
}

console.log(`[dev-doctor] === INFLX local-dev sanity check ===`);

// 1. Docker daemon reachable
if (sh('docker', ['ps']).status === 0) ok('Docker daemon reachable');
else bad('Docker daemon not reachable', 'Start Docker Desktop and retry');

// 2. Container UP (running, not just created)
const ps = sh('docker', ['ps', '--filter', `name=${PG_CONTAINER}`, '--filter', 'status=running', '--format', '{{.Names}}']);
if ((ps.stdout || '').trim() === PG_CONTAINER) ok(`${PG_CONTAINER} container UP (${PG_IMAGE})`);
else bad(`${PG_CONTAINER} container is NOT running`, 'pnpm db:dev:up');

// 3. Postgres accepts conns (only if container is up)
if ((ps.stdout || '').trim() === PG_CONTAINER) {
  const ready = sh('docker', ['exec', PG_CONTAINER, 'pg_isready', '-U', 'postgres', '-d', DB_NAME]);
  if (ready.status === 0) ok(`Postgres accepts connections @ localhost:${PG_PORT}`);
  else bad(`Postgres not accepting connections in ${PG_CONTAINER}`, `docker logs ${PG_CONTAINER}`);

  // 4. Schema applied
  const tables = dbQuery(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`);
  const views  = dbQuery(`SELECT count(*) FROM information_schema.views  WHERE table_schema='public'`);
  const vsc    = dbQuery(`SELECT count(*) FROM information_schema.views  WHERE table_schema='public' AND table_name='v_searchable_creators'`);
  const tN = Number(tables) || 0;
  const vN = Number(views)  || 0;
  if (tN >= 30 && vsc === '1') ok(`DB ${DB_NAME}: ${tN} tables, ${vN} views (v_searchable_creators present)`);
  else bad(`DB schema looks incomplete — ${tN} tables, ${vN} views, v_searchable_creators=${vsc || '?'}`, 'pnpm db:dev:init');
}

// 5. backend/.env — DATABASE_URL points local?
const benv = parseEnv(path.join(REPO_ROOT, 'backend', '.env'));
if (!benv) {
  bad(`backend/.env not found`, 'cp backend/.env.local.example backend/.env  (then edit if needed)');
} else {
  const url = benv.DATABASE_URL || '';
  if (/(?:localhost|127\.0\.0\.1):5433/.test(url)) {
    ok(`backend/.env DATABASE_URL → localhost:${PG_PORT} (LOCAL — safe)`);
  } else if (/supabase\.co|render\.com|amazonaws|prod/i.test(url)) {
    const masked = url.replace(/(:\/\/[^:]+:)[^@]+(@)/, '$1***$2');
    bad(`backend/.env DATABASE_URL does NOT point at localhost:${PG_PORT}`,
        `looks like: ${masked.slice(0, 80)}\n             ` +
        `back up the current file, then: cp backend/.env.local.example backend/.env`);
  } else {
    bad(`backend/.env DATABASE_URL is unrecognised (${url.slice(0, 60)})`,
        'expected postgresql://...localhost:5433/inflx_dev — see backend/.env.local.example');
  }

  // 6. _MOCK flags
  const flags = ['OTP_MOCK', 'RAZORPAY_MOCK', 'APIFY_MOCK', 'FCM_MOCK', 'ONESIGNAL_MOCK', 'R2_MOCK'];
  const set = flags.filter((f) => (benv[f] || '').toLowerCase() === 'true');
  if (set.length === flags.length) ok(`backend/.env *_MOCK flags all true (${set.join(', ')})`);
  else bad(`backend/.env missing _MOCK=true for: ${flags.filter((f) => !set.includes(f)).join(', ')}`,
           'set them to true in backend/.env (mocks avoid real OTP/payment/scrape traffic)');
}

// 7+8. web .env.local — informational; missing is OK (fallback to localhost)
for (const pkg of ['brand-web', 'admin-web']) {
  const f = path.join(REPO_ROOT, 'Packages', pkg, '.env.local');
  const env = parseEnv(f);
  if (!env) {
    info(`Packages/${pkg}/.env.local missing — API client falls back to http://localhost:3001/v1 (OK for local dev)`);
  } else if ((env.NEXT_PUBLIC_API_URL || '').startsWith('http://localhost:3001')) {
    ok(`Packages/${pkg}/.env.local → ${env.NEXT_PUBLIC_API_URL}`);
  } else {
    bad(`Packages/${pkg}/.env.local NEXT_PUBLIC_API_URL is non-local: ${env.NEXT_PUBLIC_API_URL}`,
        `cp Packages/${pkg}/.env.local.example Packages/${pkg}/.env.local`);
  }
}

// 9. Mobile USE_PRODUCTION — informational
const mobApi = path.join(REPO_ROOT, 'Packages', 'Mobile', 'src', 'config', 'api.js');
if (fs.existsSync(mobApi)) {
  const txt = fs.readFileSync(mobApi, 'utf8');
  const m = txt.match(/USE_PRODUCTION\s*=\s*(true|false)/);
  if (m && m[1] === 'true')   info(`Packages/Mobile USE_PRODUCTION=true — Mobile hits prod API in dev. Flip to false in Phase 2 (Maestro).`);
  else if (m && m[1] === 'false') info(`Packages/Mobile USE_PRODUCTION=false — Mobile uses LAN IP (see DEV_LAN_IP in that file).`);
}

console.log('');
if (failures === 0) {
  console.log(`[dev-doctor] === ALL GREEN — start with: pnpm dev:all ===`);
  console.log(`[dev-doctor]   backend     http://localhost:3001`);
  console.log(`[dev-doctor]   brand-web   http://localhost:3002`);
  console.log(`[dev-doctor]   admin-web   http://localhost:3003`);
  console.log(`[dev-doctor]   db (psql)   ${DEV_DATABASE_URL}`);
  process.exit(0);
} else {
  console.log(`[dev-doctor] === RED — ${failures} failed check(s) — see fix lines above ===`);
  process.exit(1);
}
