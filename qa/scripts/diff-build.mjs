#!/usr/bin/env node
'use strict';

/**
 * diff-build.mjs — assemble the side-by-side before/after review page.
 *
 * Reads:
 *   features/<slug>/04-preview/mockups/*.html     (drives the mockup list + per-name capture config)
 *   features/<slug>/04-preview/mockups/<name>.capture.json   (optional URL + viewport)
 *   features/<slug>/06-diff/notes.md              (optional agent-authored diff notes)
 *   features/<slug>/01-spec.md, lock.json         (header + spec excerpt)
 *   qa/artifacts/diff/<slug>/before/*.png         (from diff-before)
 *   qa/artifacts/diff/<slug>/after/*.png          (from diff-after; may be missing)
 *
 * Writes:
 *   qa/artifacts/diff/<slug>/index.html
 *
 * Contract: features/before-after-diff/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function fail(msg) { console.error(`[diff-build] FAIL — ${msg}`); process.exit(1); }
function info(msg) { console.log(`[diff-build] ${msg}`); }

function listContracts() {
  const dir = path.join(REPO_ROOT, 'features');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((s) =>
    fs.statSync(path.join(dir, s)).isDirectory()
  ).sort();
}

function readMaybe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function build(slug) {
  const contractDir = path.join(REPO_ROOT, 'features', slug);
  if (!fs.existsSync(contractDir)) {
    fail(`features/${slug}/ does not exist\n               ` +
         `available slugs:\n               ` +
         listContracts().map((s) => '  - ' + s).join('\n               '));
  }

  const mockupsDir = path.join(contractDir, '04-preview', 'mockups');
  const mockups = fs.existsSync(mockupsDir)
    ? fs.readdirSync(mockupsDir).filter((f) => f.endsWith('.html')).sort()
    : [];

  if (mockups.length === 0) {
    fail(`features/${slug}/04-preview/mockups/ has no .html — nothing to diff.`);
  }

  const beforeDir = path.join(REPO_ROOT, 'qa', 'artifacts', 'diff', slug, 'before');
  const afterDir  = path.join(REPO_ROOT, 'qa', 'artifacts', 'diff', slug, 'after');
  const notesMd   = readMaybe(path.join(contractDir, '06-diff', 'notes.md'));
  const specMd    = readMaybe(path.join(contractDir, '01-spec.md'));
  const lockJson  = readMaybe(path.join(contractDir, 'lock.json'));

  let lock = null;
  if (lockJson) { try { lock = JSON.parse(lockJson); } catch {} }

  info(`reading qa/artifacts/diff/${slug}/{before,after}/ ...`);
  const cards = mockups.map((name) => {
    const base = name.replace(/\.html$/, '');
    const beforePng = path.join(beforeDir, `${base}.png`);
    const afterPng  = path.join(afterDir,  `${base}.png`);
    const captureJsonPath = path.join(mockupsDir, `${base}.capture.json`);
    let captureCfg = null;
    if (fs.existsSync(captureJsonPath)) {
      try { captureCfg = JSON.parse(fs.readFileSync(captureJsonPath, 'utf8')); } catch {}
    }
    const c = {
      base, name,
      beforeOk: fs.existsSync(beforePng),
      afterOk:  fs.existsSync(afterPng),
      captureCfg,
    };
    info(`  ${base.padEnd(40)} : before ${c.beforeOk ? '✓' : '⏵ (run diff:before)'}` +
         `  after ${c.afterOk ? '✓' : (captureCfg ? '⚠ capture configured but no PNG (run diff:after?)' : 'ⓘ no capture')}`);
    return c;
  });

  const outDir = path.join(REPO_ROOT, 'qa', 'artifacts', 'diff', slug);
  fs.mkdirSync(outDir, { recursive: true });

  let badge = 'unreleased';
  let badgeClass = 'badge-pending';
  if (slug.startsWith('_')) { badge = 'DEMO — never released'; badgeClass = 'badge-demo'; }
  else if (lock?.release?.released === true) { badge = `released ${lock.release.released_at || ''}`; badgeClass = 'badge-released'; }
  else if (lock?.approved === true) {
    badge = lock.mockup_locked === true ? 'spec + mockup locked' : 'spec locked (mockup not yet locked)';
    badgeClass = lock.mockup_locked === true ? 'badge-locked' : 'badge-spec-only';
  }

  const html = renderIndex({
    slug, feature: lock?.feature || slug, badge, badgeClass,
    cards, notesMd, specMd,
  });

  const outPath = path.join(outDir, 'index.html');
  fs.writeFileSync(outPath, html);
  info(`notes: ${notesMd ? 'features/' + slug + '/06-diff/notes.md present (rendered)' : 'no 06-diff/notes.md found'}`);
  info(`wrote ${path.relative(REPO_ROOT, outPath).replace(/\\/g, '/')} (${(html.length / 1024).toFixed(1)} KB)`);
  return outPath;
}

function renderIndex({ slug, feature, badge, badgeClass, cards, notesMd, specMd }) {
  const safeNotes = notesMd ? escapeHtml(notesMd) : '';
  const safeSpec  = specMd  ? escapeHtml(specMd.split('\n').slice(0, 40).join('\n')) : '';

  const cardBlocks = cards.map((c) => {
    const title = c.base.replace(/^[\d\-]+/, '').replace(/-/g, ' ').trim() || c.base;
    const captureLine = c.captureCfg
      ? `<code>${escapeHtml(c.captureCfg.url || '?')}</code> @ ${c.captureCfg.viewport?.width || '?'}×${c.captureCfg.viewport?.height || '?'}`
      : `<em>no <code>${escapeHtml(c.base)}.capture.json</code> — create one to enable live capture</em>`;

    const beforeBlock = c.beforeOk
      ? `<img src="before/${encodeURIComponent(c.base)}.png" alt="locked mockup — ${escapeHtml(title)}" />`
      : `<div class="ph"><strong>No PNG yet.</strong><br/>Run <code>pnpm diff:before ${escapeHtml(slug)}</code>.</div>`;

    const afterBlock = c.afterOk
      ? `<img src="after/${encodeURIComponent(c.base)}.png" alt="real implementation — ${escapeHtml(title)}" />`
      : (c.captureCfg
          ? `<div class="ph ph-warn"><strong>Capture configured but PNG missing.</strong><br/>
             Run <code>pnpm diff:after ${escapeHtml(slug)}</code> (with <code>pnpm dev:all</code> running).</div>`
          : `<div class="ph"><strong>No live capture configured.</strong><br/>
             For a real contract, add a sibling<br/>
             <code>${escapeHtml(c.base)}.capture.json</code> declaring<br/>
             <code>{ "url": "http://localhost:3002/...",</code><br/>
             <code>&nbsp;&nbsp;"viewport": {"width": 1200, "height": 720} }</code></div>`);

    return `
    <section class="card">
      <div class="card-head">
        <h3>${escapeHtml(title)}</h3>
        <div class="meta">${captureLine}</div>
      </div>
      <div class="grid">
        <div class="panel">
          <div class="panel-head"><span class="tag tag-before">Before — locked mockup</span></div>
          ${beforeBlock}
        </div>
        <div class="panel">
          <div class="panel-head"><span class="tag tag-after">After — real implementation</span></div>
          ${afterBlock}
        </div>
      </div>
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>diff — ${escapeHtml(feature)}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"></script>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { font: 14px/1.55 -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
           color: #1a1a1a; background: #f6f7f9; margin: 0; padding: 0; }
    header { background: #111; color: #fff; padding: 18px 28px; display: flex; align-items: center; gap: 18px; }
    header h1 { margin: 0; font-size: 18px; font-weight: 600; }
    header .slug { color: #9aa0a6; font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 11px;
             font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-left: auto; }
    .badge-demo     { background: #fef3c7; color: #92400e; }
    .badge-pending  { background: #e5e7eb; color: #374151; }
    .badge-spec-only{ background: #dbeafe; color: #1e40af; }
    .badge-locked   { background: #d1fae5; color: #065f46; }
    .badge-released { background: #bbf7d0; color: #14532d; }
    main { max-width: 1600px; margin: 0 auto; padding: 24px 28px 80px; }
    .section { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
               padding: 20px 24px; margin-bottom: 20px; }
    .section h2 { margin: 0 0 12px; font-size: 15px; font-weight: 600;
                  color: #374151; text-transform: uppercase; letter-spacing: 0.4px; }
    .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 18px;
            margin-bottom: 18px; }
    .card-head { margin-bottom: 14px; display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
    .card-head h3 { margin: 0; font-size: 15px; font-weight: 600; text-transform: capitalize; }
    .card-head .meta { font-size: 12px; color: #6b7280; }
    .card-head code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px; font-size: 11.5px;
                      font-family: ui-monospace, Menlo, monospace; color: #1f2937; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .panel { display: flex; flex-direction: column; align-items: stretch; }
    .panel-head { margin-bottom: 8px; }
    .tag { display: inline-block; padding: 3px 9px; border-radius: 4px; font-size: 11px;
           font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
    .tag-before { background: #ddd6fe; color: #5b21b6; }
    .tag-after  { background: #fed7aa; color: #9a3412; }
    .panel img { display: block; width: 100%; height: auto; border: 1px solid #e5e7eb;
                 border-radius: 6px; background: #fff; }
    .panel .ph { padding: 28px 22px; border: 1px dashed #cbd5e1; border-radius: 6px;
                 background: #f8fafc; color: #475569; min-height: 240px;
                 display: flex; flex-direction: column; justify-content: center;
                 align-items: center; text-align: center; gap: 6px; line-height: 1.6; }
    .panel .ph code { background: #e2e8f0; padding: 1px 6px; border-radius: 3px;
                      font-family: ui-monospace, Menlo, monospace; font-size: 11.5px;
                      color: #1e293b; }
    .panel .ph-warn { border-color: #f59e0b; background: #fef3c7; color: #78350f; }
    .panel .ph-warn code { background: #fde68a; }
    .markdown { font-size: 14px; line-height: 1.6; color: #1f2937; }
    .markdown h1, .markdown h2, .markdown h3 { margin: 1.4em 0 0.4em; font-weight: 600; }
    .markdown h1 { font-size: 18px; } .markdown h2 { font-size: 16px; } .markdown h3 { font-size: 14px; }
    .markdown code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px;
                     font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; }
    .markdown pre { background: #0f172a; color: #e2e8f0; padding: 14px 16px;
                    border-radius: 6px; overflow-x: auto; font-size: 12.5px; }
    .markdown ul, .markdown ol { padding-left: 22px; }
    .markdown a { color: #2563eb; }
    .empty { color: #6b7280; font-style: italic; }
    footer { color: #6b7280; font-size: 12px; padding: 24px 28px; border-top: 1px solid #e5e7eb;
             background: #fff; }
    footer code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px; font-size: 11.5px;
                  font-family: ui-monospace, Menlo, monospace; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(feature)} <span style="opacity:0.5">· diff</span></h1>
    <span class="slug">features/${escapeHtml(slug)}/</span>
    <span class="badge ${badgeClass}">${escapeHtml(badge)}</span>
  </header>
  <main>
    <div class="section">
      <h2>Before / After (${cards.length} mockup${cards.length === 1 ? '' : 's'})</h2>
      ${cardBlocks}
    </div>

    ${notesMd ? `
    <div class="section">
      <h2>Diff notes (agent-authored)</h2>
      <div class="markdown" data-md="notes"></div>
      <script type="text/plain" id="md-notes">${safeNotes}</script>
    </div>` : `
    <div class="section">
      <h2>Diff notes</h2>
      <div class="empty">No <code>features/${escapeHtml(slug)}/06-diff/notes.md</code> found.
      For a real contract, the agent should author plain-English notes here on what was
      implemented, what matches the locked mockup, and what (if anything) diverged and why.</div>
    </div>`}

    ${specMd ? `
    <div class="section">
      <h2>Spec excerpt (first 40 lines of 01-spec.md)</h2>
      <div class="markdown" data-md="spec"></div>
      <script type="text/plain" id="md-spec">${safeSpec}</script>
    </div>` : ''}
  </main>
  <footer>
    Diff sign-off: if Before and After match the locked design, say <strong>go</strong> on the
    production deploy. If they diverge, either fix the implementation and re-run
    <code>pnpm diff:after ${escapeHtml(slug)}</code>, or update the mockup and re-lock it
    (mockup-lock-bump). Sub-contract 5 of Phase 2 will make this artifact required by
    gov-check for UI-touching commits.
  </footer>
  <script>
    (function renderMd() {
      if (typeof marked === 'undefined') return;
      marked.setOptions({ gfm: true, breaks: false });
      for (const el of document.querySelectorAll('[data-md]')) {
        const id = 'md-' + el.dataset.md;
        const src = document.getElementById(id);
        if (src) el.innerHTML = marked.parse(src.textContent);
      }
    })();
  </script>
</body>
</html>
`;
}

const slug = process.argv[2] || '_demo-preview';
build(slug);
