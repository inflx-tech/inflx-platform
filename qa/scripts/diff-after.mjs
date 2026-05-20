#!/usr/bin/env node
'use strict';

/**
 * diff-after.mjs — Playwright-shoot the live implementation per
 * sibling *.capture.json. Captures the "after" implementation panel.
 *
 * For each features/<slug>/04-preview/mockups/<name>.html, looks for
 * a sibling features/<slug>/04-preview/mockups/<name>.capture.json:
 *   {
 *     "url": "http://localhost:3002/influencers/search?city=Hyderabad",
 *     "viewport": { "width": 1200, "height": 720 },
 *     "wait_for_selector": "[data-test=\"creator-card\"]"   // optional
 *   }
 *
 * Mockups without a *.capture.json sibling are silently SKIPPED (this
 * is normal for tooling/showcase contracts; the diff page renders a
 * placeholder for them).
 *
 * Failures (URL unreachable, selector timeout, malformed JSON) are
 * surfaced loudly per-mockup but do not kill the run — other mockups
 * continue. Final exit is 0 unless a structural error (slug missing,
 * Playwright unimportable) occurred.
 *
 * Contract: features/before-after-diff/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function fatal(msg) { console.error(`[diff-after] FAIL — ${msg}`); process.exit(1); }
function info(msg) { console.log(`[diff-after] ${msg}`); }
function warn(msg) { console.log(`[diff-after] ⚠ ${msg}`); }

function listContracts() {
  const dir = path.join(REPO_ROOT, 'features');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((s) =>
    fs.statSync(path.join(dir, s)).isDirectory()
  ).sort();
}

async function main(slug) {
  const contractDir = path.join(REPO_ROOT, 'features', slug);
  if (!fs.existsSync(contractDir)) {
    fatal(`features/${slug}/ does not exist\n               ` +
          `available slugs:\n               ` +
          listContracts().map((s) => '  - ' + s).join('\n               '));
  }
  const mockupsDir = path.join(contractDir, '04-preview', 'mockups');
  if (!fs.existsSync(mockupsDir)) {
    info(`features/${slug}/04-preview/mockups/ missing — nothing to capture.`);
    return;
  }
  const mockups = fs.readdirSync(mockupsDir).filter((f) => f.endsWith('.html')).sort();

  // Build the work list (mockup → capture config).
  const work = [];
  for (const name of mockups) {
    const cfgPath = path.join(mockupsDir, name.replace(/\.html$/, '.capture.json'));
    if (!fs.existsSync(cfgPath)) continue;
    try {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (!cfg.url || !cfg.viewport?.width || !cfg.viewport?.height) {
        warn(`${name.replace(/\.html$/, '.capture.json')} malformed (need url + viewport.{width,height}) — skipping`);
        continue;
      }
      work.push({ name, cfg });
    } catch (e) {
      warn(`${name.replace(/\.html$/, '.capture.json')} JSON parse failed (${e.message}) — skipping`);
    }
  }

  if (work.length === 0) {
    info(`no *.capture.json sibling for any mockup — skipping live capture`);
    info(`(this is normal for the showcase; real contracts will declare URLs)`);
    return;
  }

  let chromium;
  try {
    ({ chromium } = await import('@playwright/test'));
  } catch (e) {
    fatal(`Playwright not importable: ${e.message}`);
  }

  const outDir = path.join(REPO_ROOT, 'qa', 'artifacts', 'diff', slug, 'after');
  fs.mkdirSync(outDir, { recursive: true });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (e) {
    fatal(`Playwright Chromium failed to launch: ${e.message}`);
  }

  let ok = 0, failed = 0;
  for (const { name, cfg } of work) {
    const out = path.join(outDir, name.replace(/\.html$/, '.png'));
    const ctx = await browser.newContext({
      viewport: { width: cfg.viewport.width, height: cfg.viewport.height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    info(`capturing ${name} → ${cfg.url}`);
    try {
      await page.goto(cfg.url, { waitUntil: 'load', timeout: 15000 });
      if (cfg.wait_for_selector) {
        await page.waitForSelector(cfg.wait_for_selector, { timeout: 15000 });
      }
      await page.waitForTimeout(400);
      await page.screenshot({ path: out, fullPage: false });
      info(`  ${name} → after/${path.basename(out)} (${cfg.viewport.width}×${cfg.viewport.height})`);
      ok += 1;
    } catch (e) {
      // Don't fake green. Don't kill the run. Report + skip.
      const reason = /ECONNREFUSED/.test(e.message) ?
        `${e.message}  (is \`pnpm dev:all\` running?)` :
        /timeout|Timeout|TimeoutError/.test(e.message) ?
          (cfg.wait_for_selector ?
            `timed out waiting for ${cfg.wait_for_selector} on ${cfg.url}` :
            `page load timeout for ${cfg.url}`) :
          e.message;
      warn(`${name} capture failed: ${reason}`);
      warn(`  → after/${path.basename(out)} will be missing; diff-build will show a placeholder`);
      failed += 1;
    } finally {
      await ctx.close();
    }
  }

  await browser.close();
  info(`done — ${ok}/${work.length} captured (${failed} failed; see ⚠ lines above)`);
}

const slug = process.argv[2] || '_demo-preview';
main(slug).catch((e) => fatal(e.stack || e.message || String(e)));
