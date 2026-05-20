#!/usr/bin/env node
'use strict';

/**
 * maestro-doctor.mjs — verify the Maestro mobile-test lane is ready
 * to run on the founder's machine. Positive checks only, loud on
 * each failure, never silent green.
 *
 * Checks (in order; later checks short-circuit if a prerequisite is
 * missing):
 *   1. maestro CLI on PATH (maestro -v)
 *   2. adb on PATH (adb version)
 *   3. at least one device/emulator connected (adb devices)
 *   4. in.inflx.app.follower installed on device
 *
 * Contract: features/maestro-infrastructure/
 */

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const isWin = process.platform === 'win32';
const sh = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, { encoding: 'utf8', shell: isWin, ...opts });

let failures = 0;
const ok  = (m) => console.log(`[maestro-doctor] ✓ ${m}`);
const bad = (m, fix) => {
  failures += 1;
  console.error(`[maestro-doctor] ✗ ${m}`);
  if (fix) console.error(`               fix: ${fix}`);
};
const skip = (m, why) => console.log(`[maestro-doctor] (deferred) ${m} — ${why}`);

const FOLLOWER_APP = 'in.inflx.app.follower';
const INSTALL_HINT_WIN =
  'download the latest Maestro release from\n               ' +
  'https://github.com/mobile-dev-inc/maestro/releases\n               ' +
  'and add the bin/ directory to PATH (or use Scoop: `scoop install maestro`)';
const INSTALL_HINT_MAC = '`brew tap mobile-dev-inc/tap && brew install maestro`';

console.log(`[maestro-doctor] === INFLX Maestro readiness ===`);

// 1. maestro CLI
const m = sh('maestro', ['-v']);
const maestroOk = m.status === 0;
if (maestroOk) {
  const ver = (m.stdout || m.stderr || '').toString().trim().split(/\r?\n/)[0];
  ok(`maestro CLI on PATH (${ver || 'version unknown'})`);
} else {
  bad('maestro CLI not on PATH',
      isWin ? INSTALL_HINT_WIN : `${INSTALL_HINT_MAC} (Windows: see qa/maestro/README.md)`);
}

// 2. adb
const a = sh('adb', ['version']);
const adbOk = a.status === 0;
if (adbOk) {
  const ver = (a.stdout || '').toString().trim().split(/\r?\n/)[0];
  ok(`adb on PATH (${ver || 'version unknown'})`);
} else {
  bad('adb not on PATH',
      'install Android Platform Tools and add to PATH:\n               ' +
      'https://developer.android.com/studio/releases/platform-tools');
}

// 3. device connected (requires adb)
let connectedDevices = [];
if (adbOk) {
  const d = sh('adb', ['devices']);
  const lines = (d.stdout || '').toString().trim().split(/\r?\n/).slice(1);
  connectedDevices = lines
    .map((l) => l.split(/\s+/))
    .filter((parts) => parts.length >= 2 && parts[1] === 'device')
    .map((parts) => parts[0]);
  if (connectedDevices.length > 0) {
    ok(`device connected: ${connectedDevices.join(', ')}`);
  } else {
    bad('no Android device or emulator connected',
        'USB device: enable Developer Options + USB debugging, plug in, accept RSA prompt\n               ' +
        'OR emulator: `emulator -list-avds` then `emulator -avd <name>`');
  }
} else {
  skip('device check', 'adb unavailable');
}

// 4. follower app installed (requires a device)
if (adbOk && connectedDevices.length > 0) {
  const target = connectedDevices[0];
  const p = sh('adb', ['-s', target, 'shell', 'pm', 'list', 'packages', FOLLOWER_APP]);
  const has = (p.stdout || '').toString().includes(`package:${FOLLOWER_APP}`);
  if (has) {
    ok(`${FOLLOWER_APP} installed on ${target}`);
  } else {
    bad(`${FOLLOWER_APP} NOT installed on ${target}`,
        'from repo root: `cd Packages/Mobile && pnpm android:follower`\n               ' +
        '(installs the follower-flavor debug APK on the connected device)');
  }
} else {
  skip('follower-app install check', adbOk ? 'no device connected' : 'adb unavailable');
}

console.log('');
if (failures === 0) {
  console.log(`[maestro-doctor] === ALL GREEN — ready: pnpm qa:maestro ===`);
  process.exit(0);
} else {
  console.log(`[maestro-doctor] === RED — ${failures} failed check(s) — see fix lines above ===`);
  process.exit(1);
}
