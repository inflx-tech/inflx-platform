#!/usr/bin/env node
'use strict';

/**
 * diff-after.mjs — capture the "after" panel per mockup.
 *
 * Each features/<slug>/04-preview/mockups/<name>.html can have ONE
 * of two sibling files (precedence: maestro-flow.json wins on conflict):
 *
 *  1. <name>.capture.json  — WEB capture (Playwright Chromium):
 *       {
 *         "url": "http://localhost:3002/influencers/search?city=Hyderabad",
 *         "viewport": { "width": 1200, "height": 720 },
 *         "wait_for_selector": "[data-test=\"creator-card\"]"   // optional
 *       }
 *
 *  2. <name>.maestro-flow.json  — MOBILE capture (Maestro screenshot copy):
 *       {
 *         "flow":       "01-follower-public-browse",
 *         "screenshot": "feed-loaded"
 *       }
 *     Reads qa/artifacts/qa-maestro/<latest>/<flow>/<screenshot>.png
 *     and copies it to qa/artifacts/diff/<slug>/after/<name>.png.
 *
 * Mockups with neither sibling are silently SKIPPED (normal for
 * tooling/showcase contracts; diff-build renders a placeholder).
 *
 * Failures (URL unreachable, selector timeout, missing Maestro
 * screenshot, malformed JSON) are surfaced loudly per-mockup but do
 * not kill the run — other mockups continue. Final exit is 0 unless
 * a structural error occurred (slug missing, Playwright unimportable).
 *
 * Contract: features/before-after-diff/ (Phase 2 sub-contract 2;
 * mobile extension added in sub-contract 4 features/maestro-first-flow/)
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

  // Build work lists. Each mockup gets at most ONE source.
  // maestro-flow.json takes precedence over capture.json if both present.
  const webWork = [];
  const mobileWork = [];
  for (const name of mockups) {
    const captureCfgPath = path.join(mockupsDir, name.replace(/\.html$/, '.capture.json'));
    const maestroCfgPath = path.join(mockupsDir, name.replace(/\.html$/, '.maestro-flow.json'));
    const hasCapture = fs.existsSync(captureCfgPath);
    const hasMaestro = fs.existsSync(maestroCfgPath);

    if (hasCapture && hasMaestro) {
      warn(`${name} has BOTH .capture.json and .maestro-flow.json — using .maestro-flow.json (mobile precedence)`);
    }

    if (hasMaestro) {
      try {
        const cfg = JSON.parse(fs.readFileSync(maestroCfgPath, 'utf8'));
        if (!cfg.flow || !cfg.screenshot) {
          warn(`${name.replace(/\.html$/, '.maestro-flow.json')} malformed (need flow + screenshot) — skipping`);
          continue;
        }
        mobileWork.push({ name, cfg });
      } catch (e) {
        warn(`${name.replace(/\.html$/, '.maestro-flow.json')} JSON parse failed (${e.message}) — skipping`);
      }
    } else if (hasCapture) {
      try {
        const cfg = JSON.parse(fs.readFileSync(captureCfgPath, 'utf8'));
        if (!cfg.url || !cfg.viewport?.width || !cfg.viewport?.height) {
          warn(`${name.replace(/\.html$/, '.capture.json')} malformed (need url + viewport.{width,height}) — skipping`);
          continue;
        }
        webWork.push({ name, cfg });
      } catch (e) {
        warn(`${name.replace(/\.html$/, '.capture.json')} JSON parse failed (${e.message}) — skipping`);
      }
    }
  }

  if (webWork.length === 0 && mobileWork.length === 0) {
    info(`no *.capture.json or *.maestro-flow.json sibling for any mockup — skipping live capture`);
    info(`(this is normal for the showcase; real contracts will declare URLs or flows)`);
    return;
  }

  const outDir = path.join(REPO_ROOT, 'qa', 'artifacts', 'diff', slug, 'after');
  fs.mkdirSync(outDir, { recursive: true });

  // ── Mobile work: copy from latest qa-maestro run ────────────────────────
  let mobileOk = 0, mobileFailed = 0;
  if (mobileWork.length > 0) {
    const qaMaestroDir = path.join(REPO_ROOT, 'qa', 'artifacts', 'qa-maestro');
    let latestRunDir = null;
    if (fs.existsSync(qaMaestroDir)) {
      const runs = fs.readdirSync(qaMaestroDir).filter((d) => {
        try { return fs.statSync(path.join(qaMaestroDir, d)).isDirectory(); } catch { return false; }
      }).sort();
      latestRunDir = runs.length > 0 ? runs[runs.length - 1] : null;
    }

    for (const { name, cfg } of mobileWork) {
      const out = path.join(outDir, name.replace(/\.html$/, '.png'));
      info(`mobile-capture ${name} ← flow=${cfg.flow}/${cfg.screenshot}.png`);
      if (!latestRunDir) {
        warn(`no qa-maestro runs found at ${path.relative(REPO_ROOT, qaMaestroDir).replace(/\\/g, '/')}/`);
        warn(`  → run \`pnpm qa:maestro\` first; ${name} after-panel will use placeholder`);
        mobileFailed += 1;
        continue;
      }
      const src = path.join(qaMaestroDir, latestRunDir, cfg.flow, `${cfg.screenshot}.png`);
      if (!fs.existsSync(src)) {
        warn(`screenshot not found: ${path.relative(REPO_ROOT, src).replace(/\\/g, '/')}`);
        warn(`  → did the ${cfg.flow} flow run + takeScreenshot:${cfg.screenshot}? ${name} after-panel will use placeholder`);
        mobileFailed += 1;
        continue;
      }
      fs.copyFileSync(src, out);
      info(`  ${name} → after/${path.basename(out)} (from qa-maestro/${latestRunDir}/${cfg.flow}/)`);
      mobileOk += 1;
    }
  }

  // ── Web work: Playwright Chromium (only launch browser if needed) ───────
  let webOk = 0, webFailed = 0;
  if (webWork.length > 0) {
    let chromium;
    try {
      ({ chromium } = await import('@playwright/test'));
    } catch (e) {
      fatal(`Playwright not importable: ${e.message}`);
    }
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
    } catch (e) {
      fatal(`Playwright Chromium failed to launch: ${e.message}`);
    }

    for (const { name, cfg } of webWork) {
      const out = path.join(outDir, name.replace(/\.html$/, '.png'));
      const ctx = await browser.newContext({
        viewport: { width: cfg.viewport.width, height: cfg.viewport.height },
        deviceScaleFactor: 1,
      });
      const page = await ctx.newPage();
      info(`web-capture ${name} → ${cfg.url}`);
      try {
        await page.goto(cfg.url, { waitUntil: 'load', timeout: 15000 });
        if (cfg.wait_for_selector) {
          await page.waitForSelector(cfg.wait_for_selector, { timeout: 15000 });
        }
        await page.waitForTimeout(400);
        await page.screenshot({ path: out, fullPage: false });
        info(`  ${name} → after/${path.basename(out)} (${cfg.viewport.width}×${cfg.viewport.height})`);
        webOk += 1;
      } catch (e) {
        const reason = /ECONNREFUSED/.test(e.message) ?
          `${e.message}  (is \`pnpm dev:all\` running?)` :
          /timeout|Timeout|TimeoutError/.test(e.message) ?
            (cfg.wait_for_selector ?
              `timed out waiting for ${cfg.wait_for_selector} on ${cfg.url}` :
              `page load timeout for ${cfg.url}`) :
            e.message;
        warn(`${name} capture failed: ${reason}`);
        warn(`  → after/${path.basename(out)} will be missing; diff-build will show a placeholder`);
        webFailed += 1;
      } finally {
        await ctx.close();
      }
    }

    await browser.close();
  }

  info(`done — web ${webOk}/${webWork.length} + mobile ${mobileOk}/${mobileWork.length} captured (${webFailed + mobileFailed} failed; see ⚠ lines above)`);
}

const slug = process.argv[2] || '_demo-preview';
main(slug).catch((e) => fatal(e.stack || e.message || String(e)));
