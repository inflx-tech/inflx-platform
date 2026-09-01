#!/usr/bin/env node
/**
 * Builds Docs/ATLAS/index.html from the Action Map and the two atlases.
 *
 * The point of generating it rather than writing it is that it can FAIL.
 * It reports, and exits non-zero on:
 *   - a screen pointing at an action that does not exist
 *   - a screen no action reaches AND is not tagged [nav] / [all] / [out]
 *   - an action with no screen     (nothing drawn for it)
 *
 * Run:  node features/screen-atlas/04-preview/build-index.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const MAP = path.join(ROOT, 'Docs', 'ACTION_MAP.md');
const MOCKUPS = path.join(__dirname, 'mockups');
const ATLASES = [
  ['brand',   path.join(MOCKUPS, 'atlas-brand.html')],
  ['creator', path.join(MOCKUPS, 'atlas-creator.html')],
];
const OUT = path.join(MOCKUPS, 'index.html');

const ACTION_RE = /\b(?:BR|CR|AD)-\d{2}\b/g;
const SCREEN_RE = /\b(?:SB|SC|SA)-\d{2}\b/g;

// ── 1 · the actions, from the Action Map ────────────────────────────────
const mapSrc = fs.readFileSync(MAP, 'utf8');
const actions = new Map();          // code -> {code,name,phase,verdict,both}
let phase = '—';
for (const line of mapSrc.split(/\r?\n/)) {
  const h = line.match(/^#+\s+(?:Phase \d+ · )?(.+?)\s*$/);
  if (h && !line.startsWith('####')) phase = h[1].replace(/^Running throughout$/, 'Throughout');
  const row = line.match(/^\|\s*\*\*((?:BR|CR|AD)-\d{2})\*\*\s*\|\s*(.+?)\s*\|(.*)$/);
  if (!row) continue;
  const rest = row[3];
  actions.set(row[1], {
    code: row[1],
    name: row[2].replace(/\*\*/g, '').replace(/\*/g, '').trim(),
    phase,
    both: rest.includes('⇄'),
    verdict: rest.includes('🆕') ? 'new' : rest.includes('✎') ? 'change' : 'keep',
  });
}

// ── 2 · the screens, from the two atlases ───────────────────────────────
const screens = new Map();          // code -> {code,name,verdict,app,used,refs}
const VMAP = { n: 'new', c: 'change', k: 'keep', s: 'sweep' };
for (const [app, file] of ATLASES) {
  const src = fs.readFileSync(file, 'utf8');
  const cardRe = /<span class="a">((?:SB|SC|SA)-\d{2})<\/span><span class="n">([^<]*)<\/span><span class="v ([ncks])">[^<]*<\/span>[\s\S]{0,400}?<div class="used">([^<]*)<\/div>/g;
  let m;
  while ((m = cardRe.exec(src))) {
    const used = m[4].replace(/&amp;/g, '&').trim();
    screens.set(m[1], {
      code: m[1],
      name: m[2].replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim(),
      verdict: VMAP[m[3]],
      app: m[1].startsWith('SA') ? 'admin' : app,
      used,
      tag: (used.match(/^\[(nav|all|out)\]/) || [])[1] || null,
      refs: [...new Set(used.match(ACTION_RE) || [])],
      screenRefs: [...new Set(used.match(SCREEN_RE) || [])],
    });
  }
}

// ── 3 · the checks ──────────────────────────────────────────────────────
const problems = [];

for (const s of screens.values()) {
  for (const r of s.refs) {
    if (!actions.has(r)) {
      problems.push({ kind: 'bad-action-ref', where: s.code,
        msg: `${s.code} "${s.name}" points at ${r}, which is not in the Action Map` });
    }
  }
  for (const r of s.screenRefs) {
    if (r !== s.code && !screens.has(r)) {
      problems.push({ kind: 'bad-screen-ref', where: s.code,
        msg: `${s.code} "${s.name}" mentions ${r}, which is not a screen` });
    }
  }
}

const byAction = new Map([...actions.keys()].map(k => [k, []]));
for (const s of screens.values())
  for (const r of s.refs) if (byAction.has(r)) byAction.get(r).push(s.code);

const outside = [];
for (const s of screens.values())
  if (s.refs.length === 0) {
    if (s.tag) outside.push(s);
    else problems.push({ kind: 'orphan-screen', where: s.code,
      msg: `${s.code} "${s.name}" is reached by no action, and is not tagged [nav] / [all] / [out] — used: "${s.used}"` });
  }

for (const [code, list] of byAction)
  if (list.length === 0)
    problems.push({ kind: 'undrawn-action', where: code,
      msg: `${code} "${actions.get(code).name}" has no screen drawn for it` });

// ── 4 · report ──────────────────────────────────────────────────────────
const KINDS = {
  'bad-action-ref':  'Points at an action that does not exist',
  'bad-screen-ref':  'Mentions a screen that does not exist',
  'orphan-screen':   'Screen no action reaches',
  'undrawn-action':  'Action with no screen',
};
console.log(`actions ${actions.size} · screens ${screens.size} · outside the action model ${outside.length}`);
if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const k of Object.keys(KINDS)) {
    const hits = problems.filter(p => p.kind === k);
    if (!hits.length) continue;
    console.log(`\n  ${KINDS[k]} — ${hits.length}`);
    for (const h of hits) console.log(`    ${h.msg}`);
  }
} else {
  console.log('no problems');
}

// ── 5 · the page ────────────────────────────────────────────────────────
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const V = v => `<span class="v ${v}">${v.toUpperCase()}</span>`;
const PHASES = [...new Set([...actions.values()].map(a => a.phase))];
const APPS = [['brand', 'Brand app'], ['creator', 'Creator app'], ['admin', 'Admin']];

const chip = c => {
  const s = screens.get(c);
  return s ? `<a class="chip ${s.verdict}" href="#${c}" title="${esc(s.name)}">${c}</a>` : `<span class="chip bad">${c}</span>`;
};
const achip = c => {
  const a = actions.get(c);
  return a ? `<a class="chip ${a.verdict}" href="#${c}" title="${esc(a.name)}">${c}</a>` : `<span class="chip bad">${c}</span>`;
};

let html = `<!doctype html>
<meta charset="utf-8">
<title>Atlas Index</title>
<style>
  :root{--ink:#0A0A0A;--mut:#8E8E8E;--line:#DBDBDB;--soft:#F4F4F4;--acc:#E36414;
        --ok:#0F7B4F;--bad:#C4321B;--badbg:#FBEEEA;--new:#5B3DF5;--pur:#6D28D9;--purbg:#F5F3FF}
  *{box-sizing:border-box}
  body{margin:0;background:#fff;color:var(--ink);padding:26px 24px 80px;
       font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:1080px}
  h1{font-size:27px;margin:0 0 5px;letter-spacing:-.03em}
  .lede{font-size:13px;color:#555;line-height:1.6;margin:0 0 16px}
  .area{margin:34px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--ink);
        font-size:11px;font-weight:900;letter-spacing:.11em;text-transform:uppercase}
  .ph{margin:22px 0 8px;font-size:12.5px;font-weight:900;color:var(--pur);
      letter-spacing:.02em;text-transform:uppercase}
  table{border-collapse:collapse;width:100%;font-size:12.5px}
  td,th{border-bottom:1px solid var(--line);padding:7px 8px;vertical-align:top;text-align:left}
  th{font-size:9px;letter-spacing:.07em;text-transform:uppercase;color:var(--mut);
     border-bottom:1.5px solid var(--ink)}
  tr:target td{background:#FFF8E7}
  td.c{white-space:nowrap;font-family:ui-monospace,Menlo,monospace;font-weight:900;font-size:11.5px}
  td.n{font-weight:700;width:31%}
  .v{font-size:7.5px;font-weight:900;padding:2px 5px;border-radius:4px;color:#fff;letter-spacing:.04em}
  .v.new{background:var(--new)} .v.change{background:var(--acc)}
  .v.keep{background:#B0B0B0} .v.sweep{background:#94A3B8}
  .chip{display:inline-block;font-family:ui-monospace,Menlo,monospace;font-size:10px;
        font-weight:800;padding:2px 5px;border-radius:4px;margin:1px 2px 1px 0;
        text-decoration:none;border:1px solid var(--line);color:#444;background:#fff}
  .chip.new{border-color:#C7BDFB;background:#F5F3FF;color:var(--new)}
  .chip.change{border-color:#F3D3BC;background:#FDF4EE;color:var(--acc)}
  .chip.sweep{opacity:.55}
  .chip.bad{background:var(--badbg);border-color:#E7BDB4;color:var(--bad)}
  .both{color:var(--pur);font-weight:900}
  .box{border:1px solid var(--line);border-radius:9px;padding:12px 14px;margin:0 0 12px;
       font-size:12.5px;line-height:1.6}
  .box.ok{border-color:#BFE0CF;background:#EEF7F2}
  .box.bad{border-color:#E7BDB4;background:var(--badbg)}
  .box b{font-weight:800}
  .box .t{font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;
          margin-bottom:5px;color:var(--bad)}
  .box.ok .t{color:var(--ok)}
  code{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;background:var(--soft);
       padding:1px 4px;border-radius:3px}
  .note{font-size:11px;color:var(--mut);line-height:1.5;margin:5px 0 0}
</style>

<h1>Atlas Index</h1>
<p class="lede">
  <b>Action → screens</b>, and <b>screen → actions</b>. Generated from
  <code>Docs/ACTION_MAP.md</code> and the two atlas files by
  <code>Docs/ATLAS/build-index.js</code> — never typed by hand, so it can catch a screen nothing
  reaches or an action nothing draws.<br>
  <b>${actions.size} actions · ${screens.size} screens.</b>
  <span class="both">⇄</span> marks an action where two people are involved.
</p>
`;

if (problems.length) {
  html += `<div class="box bad"><div class="t">${problems.length} problem${problems.length > 1 ? 's' : ''} found</div><ul style="margin:4px 0 0;padding-left:18px">`;
  for (const p of problems) html += `<li>${esc(p.msg)}</li>`;
  html += `</ul></div>\n`;
} else {
  html += `<div class="box ok"><div class="t">Clean</div>
  Every screen is either reached by an action or deliberately tagged as outside the action model,
  every action has at least one screen, and every cross-reference resolves.</div>\n`;
}

const TAGN = { nav: 'Reached by navigating, not by doing something',
               all: 'Reached by every action of a kind',
               out: 'Out of scope for stages 1-4' };
if (outside.length) {
  html += `<div class="box"><div class="t" style="color:#8E8E8E">Outside the action model — ${outside.length}</div>
  These are not orphans. Each is tagged in the atlas to say <b>why</b> no action reaches it, so a
  screen that is genuinely forgotten still fails the check.<br><br>\n`;
  for (const t of ['nav', 'all', 'out']) {
    const hits = outside.filter(s => s.tag === t);
    if (!hits.length) continue;
    html += `  <b>${TAGN[t]}</b><br>\n`;
    for (const s of hits) html += `  &nbsp;&nbsp;${chip(s.code)} ${esc(s.name)}<br>\n`;
    html += `  <br>\n`;
  }
  html += `</div>\n`;
}

// action → screens
html += `<div class="area">Action → screens</div>\n`;
for (const ph of PHASES) {
  const list = [...actions.values()].filter(a => a.phase === ph);
  if (!list.length) continue;
  html += `<div class="ph">${esc(ph)}</div>\n<table>
  <tr><th>Action</th><th>What it is</th><th></th><th>Screens</th></tr>\n`;
  for (const a of list) {
    const sc = byAction.get(a.code);
    html += `  <tr id="${a.code}"><td class="c">${a.code}${a.both ? ' <span class="both">⇄</span>' : ''}</td>`
         +  `<td class="n">${esc(a.name)}</td><td>${V(a.verdict)}</td>`
         +  `<td>${sc.length ? sc.sort().map(chip).join(' ') : '<span class="chip bad">none</span>'}</td></tr>\n`;
  }
  html += `</table>\n`;
}

// screen → actions
html += `<div class="area">Screen → actions</div>\n`;
for (const [key, label] of APPS) {
  const list = [...screens.values()].filter(s => s.app === key).sort((a, b) => a.code.localeCompare(b.code));
  if (!list.length) continue;
  html += `<div class="ph">${esc(label)} · ${list.length} screens</div>\n<table>
  <tr><th>Screen</th><th>What it is</th><th></th><th>Used by</th></tr>\n`;
  for (const s of list) {
    const known = s.refs.filter(r => actions.has(r)).sort();
    const extra = s.used.replace(/^\[(nav|all|out)\]\s*/, '').replace(ACTION_RE, '').replace(/^[\s·→⇄]+|[\s·→⇄]+$/g, '').replace(/\s+/g, ' ');
    html += `  <tr id="${s.code}"><td class="c">${s.code}</td><td class="n">${esc(s.name)}</td>`
         +  `<td>${V(s.verdict)}</td><td>${known.length ? known.map(achip).join(' ') : '<span class="chip bad">none</span>'}`
         +  (extra && extra !== '·' ? `<div class="note">${esc(extra)}</div>` : '')
         +  `</td></tr>\n`;
  }
  html += `</table>\n`;
}

// the busiest screens — the ones a change would ripple from
const busiest = [...screens.values()]
  .map(s => ({ s, n: s.refs.filter(r => actions.has(r)).length }))
  .filter(x => x.n >= 3).sort((a, b) => b.n - a.n);
html += `<div class="area">Where a change would ripple</div>
<div class="box">
  <b>Screens reached by three or more actions.</b> These are the ones where changing something
  quietly breaks a flow somewhere else, and the ones worth building first.<br><br>
`;
for (const { s, n } of busiest)
  html += `  ${chip(s.code)} <b>${esc(s.name)}</b> — ${n} actions<br>\n`;
html += `</div>\n`;

fs.writeFileSync(OUT, html, 'utf8');
console.log(`\nwrote ${path.relative(ROOT, OUT)}`);
process.exit(problems.length ? 1 : 0);
