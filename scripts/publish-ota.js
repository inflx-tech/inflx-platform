#!/usr/bin/env node
'use strict';

/**
 * publish-ota.js
 *
 * Publishes a fresh JS bundle of the mobile app to the backend OTA endpoint,
 * which uploads it to Cloudflare R2 and rewrites the manifest. Installed
 * phones pick it up on their next launch.
 *
 * Usage:
 *   node scripts/publish-ota.js <flavor> [--message "what changed"]
 *
 *   Flavor is one of: brand | influencer | follower | agency | all
 *
 * Env vars read from .env.ota (or ambient env):
 *   BACKEND_URL          default https://inflx-platform.onrender.com
 *   OTA_PUBLISH_TOKEN    must match backend env var of the same name
 *
 * Native-runtime gating:
 *   The `NATIVE_RUNTIME` constant in Packages/Mobile/src/services/otaUpdater.js
 *   must match the one baked into every APK currently in the wild. When we
 *   change native code (add a native module, bump gradle, etc.), bump that
 *   constant, rebuild + reinstall all APKs, THEN publish OTA bundles.
 */

const fs       = require('fs');
const path     = require('path');
const { spawn } = require('child_process');

// Load env: prefer .env.ota at repo root, fall back to process.env
try {
  const envPath = path.join(__dirname, '..', '.env.ota');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {}

const BACKEND_URL       = (process.env.BACKEND_URL || 'https://inflx-platform.onrender.com').replace(/\/+$/, '');
const OTA_PUBLISH_TOKEN = process.env.OTA_PUBLISH_TOKEN || '';

const FLAVORS = ['brand', 'influencer', 'follower', 'agency'];
const MOBILE_ROOT = path.join(__dirname, '..', 'Packages', 'Mobile');

// ─────────────────────────────────────────────────────────────────────────────

function readNativeRuntime() {
  const file = path.join(MOBILE_ROOT, 'src', 'services', 'otaUpdater.js');
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/NATIVE_RUNTIME\s*=\s*['"]([^'"]+)['"]/);
  if (!m) throw new Error('Could not find NATIVE_RUNTIME in otaUpdater.js');
  return m[1];
}

function spawnAsync(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { shell: true, stdio: 'inherit', ...opts });
    child.on('error', reject);
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function bundle(outFile) {
  // Run react-native bundle from inside Packages/Mobile so metro config resolves correctly.
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const assets = path.join(path.dirname(outFile), 'assets');
  fs.mkdirSync(assets, { recursive: true });
  await spawnAsync('npx', [
    'react-native', 'bundle',
    '--platform',   'android',
    '--dev',        'false',
    '--entry-file', 'index.js',
    '--bundle-output', outFile,
    '--assets-dest',   assets,
    '--reset-cache',
  ], { cwd: MOBILE_ROOT });
}

async function uploadToBackend(flavor, nativeRuntime, bundlePath, message) {
  const buf = fs.readFileSync(bundlePath);
  const bundle_b64 = buf.toString('base64');
  console.log(`[publish-ota] ${flavor}: uploading ${(buf.length / 1024).toFixed(0)} KB to ${BACKEND_URL}/v1/ota/publish ...`);
  const res = await fetch(`${BACKEND_URL}/v1/ota/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-OTA-Token':  OTA_PUBLISH_TOKEN,
    },
    body: JSON.stringify({
      flavor,
      native_runtime: nativeRuntime,
      bundle_b64,
      message: message || '',
    }),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    console.error(`[publish-ota] ${flavor}: FAILED (HTTP ${res.status})`);
    console.error(json);
    throw new Error(`publish ${flavor} failed`);
  }
  const v = json?.data?.version;
  console.log(`[publish-ota] ${flavor}: OK — version ${v} published`);
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const flavorArg = (args[0] || '').toLowerCase();
  const msgIdx = args.indexOf('--message');
  const message = msgIdx >= 0 ? args.slice(msgIdx + 1).join(' ') : '';

  if (!['brand', 'influencer', 'follower', 'agency', 'all'].includes(flavorArg)) {
    console.error('Usage: node scripts/publish-ota.js <brand|influencer|follower|agency|all> [--message "text"]');
    process.exit(2);
  }
  if (!OTA_PUBLISH_TOKEN) {
    console.error('OTA_PUBLISH_TOKEN not set. Add it to .env.ota or export it.');
    process.exit(2);
  }

  const nativeRuntime = readNativeRuntime();
  console.log(`[publish-ota] native runtime = ${nativeRuntime}`);
  if (message) console.log(`[publish-ota] message     = "${message}"`);

  const flavors = flavorArg === 'all' ? FLAVORS : [flavorArg];

  // For now the bundle is identical across flavors (flavor is selected at
  // runtime via APP_ROLE), so we build ONCE and upload once per flavor.
  const tmpDir = path.join(__dirname, '..', '.ota-tmp');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  const bundlePath = path.join(tmpDir, 'bundle.js');

  console.log(`[publish-ota] bundling JS...`);
  await bundle(bundlePath);
  const size = fs.statSync(bundlePath).size;
  console.log(`[publish-ota] bundle size: ${(size / 1024).toFixed(0)} KB`);

  for (const f of flavors) {
    await uploadToBackend(f, nativeRuntime, bundlePath, message);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`[publish-ota] done. Phones will pick up on next launch.`);
}

main().catch(e => {
  console.error(e.message || e);
  process.exit(1);
});
