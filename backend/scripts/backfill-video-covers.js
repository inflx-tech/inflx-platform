#!/usr/bin/env node
/**
 * backfill-video-covers.js — give a video that has no picture the picture taken from it.
 * Contract: features/shopper-walk-fixes · 01-spec.md W16 (founder, 5 Oct 2026: "Ok carry on with this").
 *
 * The four video posts that were live before a creator's phone made a picture (4 Oct 2026) show a
 * product photo on Saved and on every tile. Each picture was taken from the video itself on INFLX's
 * own computer; this sends it to the server, which stores it and ties it to the video.
 *
 * Usage:  node scripts/backfill-video-covers.js --dir=<folder with POSTCODE.jpg files> --dry | --apply
 *         [--replace]   replace a picture that is already there (default: keep it)
 * Reads BACKEND_URL and OTA_PUBLISH_TOKEN from <repo>/.env.ota (the same file publish-ota.js reads).
 *
 * --dry  writes nothing: it reads each video's state and proves the route and the token are accepted
 *        (a request with no picture is refused with 422 only AFTER the token is accepted).
 * Idempotent: a second --apply answers "kept" for every video.
 */
const fs = require('fs');
const path = require('path');

const VIDEOS = [
  { media: 'd8911acd-f60e-43ac-ae8a-071069030419', post: 'P4KGMB' },
  { media: '1454a6b1-d63d-4a67-ba16-7d0f958718dc', post: 'JD54B4' },
  { media: '9cb05cf8-4942-476e-97ae-935e11186344', post: 'SHNCZW' },
  { media: '4dd1d7ba-358b-4fb1-a2d3-0735a517d101', post: 'JY3ZVH' },
];

const arg = (name) => { const a = process.argv.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const apply = process.argv.includes('--apply');
const dry = process.argv.includes('--dry');
const replace = process.argv.includes('--replace');
const dir = arg('dir');
if ((!apply && !dry) || !dir) { console.error('Usage: node scripts/backfill-video-covers.js --dir=<folder> --dry | --apply [--replace]'); process.exit(2); }

const env = {};
try {
  for (const line of fs.readFileSync(path.join(__dirname, '..', '..', '.env.ota'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* fall through to the checks below */ }
const BASE = `${(process.env.BACKEND_URL || env.BACKEND_URL || 'https://inflx-platform.onrender.com').replace(/\/+$/, '')}/v1`;
const TOKEN = process.env.OTA_PUBLISH_TOKEN || env.OTA_PUBLISH_TOKEN || '';
if (!TOKEN) { console.error('No OTA_PUBLISH_TOKEN in .env.ota.'); process.exit(2); }

const post = (media, body) => fetch(`${BASE}/ops/post-media/${media}/cover`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-OTA-Token': TOKEN }, body: JSON.stringify(body) });
/** Does the video have a picture now? The public door answers 302 to it, or 404. */
const state = async (media) => (await fetch(`${BASE}/media/post/${media}/cover`, { redirect: 'manual' })).status === 302;

(async () => {
  console.log('Target:', BASE, '·', apply ? 'APPLY' : 'DRY RUN', replace ? '· replace' : '');
  let failed = 0;
  for (const v of VIDEOS) {
    const file = path.join(dir, `${v.post}.jpg`);
    if (!fs.existsSync(file)) { console.log(`  ${v.post}: no picture file at ${file}`); failed += 1; continue; }
    const jpeg = fs.readFileSync(file);
    const isJpeg = jpeg[0] === 0xFF && jpeg[1] === 0xD8 && jpeg[2] === 0xFF;
    const had = await state(v.media);
    if (dry) {
      const probe = await post(v.media, {});
      console.log(`  ${v.post}: picture file ${Math.round(jpeg.length / 1024)} KB, ${isJpeg ? 'a JPEG' : 'NOT a JPEG'} · has a picture on live: ${had ? 'yes' : 'no'} · route and token: ${probe.status === 422 ? 'accepted' : `answered ${probe.status}`}`);
      if (!isJpeg || probe.status !== 422) failed += 1;
      continue;
    }
    const r = await post(v.media, { jpeg_b64: jpeg.toString('base64'), replace });
    const body = await r.json().catch(() => null);
    if (r.status !== 200 || !body || !body.success) { console.log(`  ${v.post}: FAILED ${r.status} ${JSON.stringify(body).slice(0, 200)}`); failed += 1; continue; }
    const now = await state(v.media);
    console.log(`  ${v.post}: ${body.data.changed ? 'picture SET' : 'kept (it already had one)'} · served on live: ${now ? 'yes' : 'NO'}`);
    if (!now) failed += 1;
  }
  console.log(failed ? `${failed} problem(s).` : dry ? 'DRY RUN — nothing written.' : 'Done.');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
