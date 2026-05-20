#!/usr/bin/env node
'use strict';

/**
 * diff-before.mjs — render each mockup HTML to a PNG at its declared
 * viewport. This is the "before" / locked-mockup baseline.
 *
 * Reads: features/<slug>/04-preview/mockups/*.html
 *        (per-mockup <!-- preview-size: mobile|desktop|WxH --> comment)
 * Writes: qa/artifacts/diff/<slug>/before/<name>.png
 *
 * Uses Playwright Chromium (@playwright/test, already a root devDep
 * via the main qa lane).
 *
 * Contract: features/before-after-diff/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function fail(msg) { console.error(`[diff-before] FAIL — ${msg}`); process.exit(1); }
function info(msg) { console.log(`[diff-before] ${msg}`); }

function listContracts() {
  const dir = path.join(REPO_ROOT, 'features');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((s) =>
    fs.statSync(path.join(dir, s)).isDirectory()
  ).sort();
}

function parseSize(html) {
  const m = html.match(/<!--\s*preview-size:\s*(mobile|desktop|wide|(\d+)x(\d+))\s*-->/i);
  if (!m) return { w: 1024, h: 720, label: 'default 1024×720' };
  const kind = m[1].toLowerCase();
  if (kind === 'mobile')  return { w: 380,  h: 720, label: 'mobile 380×720' };
  if (kind === 'desktop' || kind === 'wide') return { w: 1200, h: 720, label: 'desktop 1200×720' };
  return { w: Number(m[2]), h: Number(m[3]), label: `custom ${m[2]}×${m[3]}` };
}

async function main(slug) {
  const contractDir = path.join(REPO_ROOT, 'features', slug);
  if (!fs.existsSync(contractDir)) {
    fail(`features/${slug}/ does not exist\n               ` +
         `available slugs:\n               ` +
         listContracts().map((s) => '  - ' + s).join('\n               '));
  }
  const mockupsDir = path.join(contractDir, '04-preview', 'mockups');
  if (!fs.existsSync(mockupsDir)) {
    fail(`features/${slug}/04-preview/mockups/ does not exist; nothing to render.`);
  }
  const mockups = fs.readdirSync(mockupsDir).filter((f) => f.endsWith('.html')).sort();
  if (mockups.length === 0) {
    fail(`no .html files in features/${slug}/04-preview/mockups/.`);
  }

  info(`reading features/${slug}/04-preview/mockups/ ...`);

  // Dynamic import so we can catch missing-Playwright loudly.
  let chromium;
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch (e) {
    fail(`Playwright not importable: ${e.message}\n               ` +
         `try: pnpm install   (and optionally: pnpm exec playwright install chromium)`);
  }

  const outDir = path.join(REPO_ROOT, 'qa', 'artifacts', 'diff', slug, 'before');
  fs.mkdirSync(outDir, { recursive: true });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    fail(`Playwright Chromium failed to launch: ${e.message}\n               ` +
         `try: pnpm exec playwright install chromium`);
  }

  let okCount = 0;
  for (const name of mockups) {
    const src = path.join(mockupsDir, name);
    const html = fs.readFileSync(src, 'utf8');
    const { w, h, label } = parseSize(html);
    const out = path.join(outDir, name.replace(/\.html$/, '.png'));

    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    try {
      await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e) {
      // networkidle can time out if CDN script is still polling; load is enough.
      try { await page.waitForLoadState('load', { timeout: 5000 }); } catch {}
    }
    // Small extra settle for Tailwind CDN injection.
    await page.waitForTimeout(400);
    await page.screenshot({ path: out, fullPage: false });
    await ctx.close();
    info(`  ${name} → before/${path.basename(out)} (${label})`);
    okCount += 1;
  }

  await browser.close();
  info(`OK — ${okCount}/${mockups.length} before PNGs written → ${path.relative(REPO_ROOT, outDir).replace(/\\/g, '/')}`);
}

const slug = process.argv[2] || '_demo-preview';
main(slug).catch((e) => fail(e.stack || e.message || String(e)));
