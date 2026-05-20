#!/usr/bin/env node
'use strict';

/**
 * preview-build.mjs — build a browseable HTML preview for a contract.
 *
 * Reads:
 *   features/<slug>/01-spec.md                      (spec excerpt)
 *   features/<slug>/lock.json                       (status badge)
 *   features/<slug>/04-preview/workflow-prediction.md   (rendered)
 *   features/<slug>/04-preview/mockups/*.html       (embedded iframes)
 *
 * Writes:
 *   qa/artifacts/preview/<slug>/index.html
 *   qa/artifacts/preview/<slug>/mockups/*.html      (copies)
 *
 * Per-mockup sizing via an HTML comment on its first line:
 *   <!-- preview-size: mobile  -->   →  380 × 720
 *   <!-- preview-size: desktop -->   → 1200 × 720
 *   <!-- preview-size: 800x600 -->   → 800 × 600
 * Default if no comment:              → 1024 × 720
 *
 * marked is loaded via CDN inside the generated page (zero Node deps).
 *
 * Contract: features/preview-machinery/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function fail(msg) { console.error(`[preview-build] FAIL — ${msg}`); process.exit(1); }
function info(msg) { console.log(`[preview-build] ${msg}`); }

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

  const previewDir = path.join(contractDir, '04-preview');
  const mockupsDir = path.join(previewDir, 'mockups');

  const specMd     = readMaybe(path.join(contractDir, '01-spec.md'));
  const lockJson   = readMaybe(path.join(contractDir, 'lock.json'));
  const workflowMd = readMaybe(path.join(previewDir,   'workflow-prediction.md'));

  let mockups = [];
  if (fs.existsSync(mockupsDir)) {
    mockups = fs.readdirSync(mockupsDir).filter((f) => f.endsWith('.html')).sort();
  }

  if (mockups.length === 0 && !workflowMd) {
    fail(`features/${slug}/04-preview/ exists but contains neither mockups/*.html\n` +
         `               nor workflow-prediction.md. Add at least one to use the\n` +
         `               preview tooling. (See features/_demo-preview/ for an example.)`);
  }

  info(`reading features/${slug}/ ...`);
  info(`  spec      : ${specMd ? `present (${specMd.split('\n').length}-line)` : 'missing'}`);

  let lock = null;
  if (lockJson) {
    try { lock = JSON.parse(lockJson); } catch (e) { info(`  lock      : INVALID JSON — ${e.message}`); }
  }
  if (lock) {
    info(`  lock      : approved=${lock.approved} released=${lock.release?.released ?? false} ` +
         `mockup_locked=${lock.mockup_locked ?? '(unset)'}`);
  } else {
    info(`  lock      : missing`);
  }
  info(`  mockups   : ${mockups.length} found${mockups.length ? ` (${mockups.map((m) => m.replace(/\.html$/, '')).join(', ')})` : ''}`);
  info(`  workflow  : ${workflowMd ? 'workflow-prediction.md present' : 'missing'}`);

  // Output dir
  const outDir = path.join(REPO_ROOT, 'qa', 'artifacts', 'preview', slug);
  const outMockupsDir = path.join(outDir, 'mockups');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(outMockupsDir, { recursive: true });

  // Copy mockups + compute sizes
  const mockupMeta = [];
  for (const m of mockups) {
    const src = path.join(mockupsDir, m);
    const dst = path.join(outMockupsDir, m);
    const html = fs.readFileSync(src, 'utf8');
    fs.writeFileSync(dst, html);
    mockupMeta.push({ name: m, size: parseSize(html) });
  }

  // Status badge text
  let badge = 'unreleased';
  let badgeClass = 'badge-pending';
  if (slug.startsWith('_')) { badge = 'DEMO — never released'; badgeClass = 'badge-demo'; }
  else if (lock?.release?.released === true) { badge = `released ${lock.release.released_at || ''}`; badgeClass = 'badge-released'; }
  else if (lock?.approved === true) {
    badge = lock.mockup_locked === true ? 'spec + mockup locked' : 'spec locked (mockup not yet locked)';
    badgeClass = lock.mockup_locked === true ? 'badge-locked' : 'badge-spec-only';
  }

  const indexHtml = renderIndex({
    slug, feature: lock?.feature || slug, badge, badgeClass,
    specMd, workflowMd, mockups: mockupMeta, lock,
  });

  const indexPath = path.join(outDir, 'index.html');
  fs.writeFileSync(indexPath, indexHtml);
  info(`wrote ${path.relative(REPO_ROOT, indexPath).replace(/\\/g, '/')}`);
  return indexPath;
}

function renderIndex({ slug, feature, badge, badgeClass, specMd, workflowMd, mockups, lock }) {
  const safeSpec = specMd ? escapeHtml(specMd.split('\n').slice(0, 60).join('\n')) : '_(no 01-spec.md found)_';
  const safeWorkflow = workflowMd ? escapeHtml(workflowMd) : '';
  const mockupCards = mockups.map((m, i) => {
    const id = `mockup-${i}`;
    const title = m.name.replace(/\.html$/, '').replace(/^[\d\-]+/, '').replace(/-/g, ' ').trim() || m.name;
    return `
    <section class="mockup">
      <div class="mockup-head">
        <h3>${escapeHtml(title)}</h3>
        <div class="mockup-meta">
          <span class="size">${m.size.label}</span>
          <a href="mockups/${encodeURIComponent(m.name)}" target="_blank" rel="noopener">open full ↗</a>
        </div>
      </div>
      <iframe
        id="${id}"
        src="mockups/${encodeURIComponent(m.name)}"
        width="${m.size.w}"
        height="${m.size.h}"
        sandbox="allow-same-origin allow-scripts"
        title="${escapeHtml(title)}"
        loading="lazy"
      ></iframe>
    </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>preview — ${escapeHtml(feature)}</title>
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
    main { max-width: 1400px; margin: 0 auto; padding: 24px 28px 80px; }
    .section { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
               padding: 20px 24px; margin-bottom: 20px; }
    .section h2 { margin: 0 0 12px; font-size: 15px; font-weight: 600;
                  color: #374151; text-transform: uppercase; letter-spacing: 0.4px; }
    .markdown { font-size: 14px; line-height: 1.6; color: #1f2937; }
    .markdown h1, .markdown h2, .markdown h3 { margin: 1.4em 0 0.4em; font-weight: 600; }
    .markdown h1 { font-size: 18px; } .markdown h2 { font-size: 16px; } .markdown h3 { font-size: 14px; }
    .markdown code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px;
                     font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; }
    .markdown pre  { background: #0f172a; color: #e2e8f0; padding: 14px 16px;
                     border-radius: 6px; overflow-x: auto; font-size: 12.5px; }
    .markdown ul, .markdown ol { padding-left: 22px; }
    .markdown a { color: #2563eb; }
    .mockups { display: flex; flex-wrap: wrap; gap: 20px; }
    .mockup { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .mockup-head { display: flex; justify-content: space-between; align-items: baseline;
                   margin-bottom: 12px; gap: 16px; }
    .mockup-head h3 { margin: 0; font-size: 14px; font-weight: 600; text-transform: capitalize; }
    .mockup-meta { font-size: 12px; color: #6b7280; }
    .mockup-meta .size { margin-right: 12px; font-family: ui-monospace, Menlo, monospace; }
    .mockup-meta a { color: #2563eb; text-decoration: none; }
    .mockup-meta a:hover { text-decoration: underline; }
    .mockup iframe { display: block; border: 1px solid #e5e7eb; border-radius: 4px; background: #fff; }
    footer { color: #6b7280; font-size: 12px; padding: 24px 28px; border-top: 1px solid #e5e7eb;
             background: #fff; }
    footer code { background: #f3f4f6; padding: 1px 5px; border-radius: 3px; font-size: 11.5px;
                  font-family: ui-monospace, Menlo, monospace; }
    .empty { color: #6b7280; font-style: italic; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(feature)}</h1>
    <span class="slug">features/${escapeHtml(slug)}/</span>
    <span class="badge ${badgeClass}">${escapeHtml(badge)}</span>
  </header>
  <main>
    ${mockups.length > 0 ? `
    <div class="section">
      <h2>Mockups (${mockups.length})</h2>
      <div class="mockups">${mockupCards}</div>
    </div>` : ''}

    ${workflowMd ? `
    <div class="section">
      <h2>Workflow prediction</h2>
      <div class="markdown" data-md="workflow"></div>
      <script type="text/plain" id="md-workflow">${safeWorkflow}</script>
    </div>` : ''}

    <div class="section">
      <h2>Spec excerpt (first 60 lines of 01-spec.md)</h2>
      ${specMd ? `<div class="markdown" data-md="spec"></div>
      <script type="text/plain" id="md-spec">${safeSpec}</script>` :
                 `<div class="empty">No 01-spec.md found.</div>`}
    </div>
  </main>
  <footer>
    To lock the mockup for this contract, set
    <code>"mockup_locked": true</code>,
    <code>"mockup_locked_by": "&lt;who/how&gt;"</code>,
    <code>"mockup_locked_at": "&lt;date&gt;"</code> in
    <code>features/${escapeHtml(slug)}/lock.json</code>.
    Then proceed to implementation (Step 6+). Sub-contract 5 of Phase 2
    will make this gate machine-enforced for UI-touching contracts.
  </footer>
  <script>
    (function renderMd() {
      if (typeof marked === 'undefined') { return; }
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

// CLI
const slug = process.argv[2] || '_demo-preview';
build(slug);
