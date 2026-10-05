#!/usr/bin/env node
/**
 * Builds the shopper-app-fixes board: a record of what changes ON SCREEN in the fix round the
 * founder approved on 5 Oct 2026 (F1–F15, N1–N8 in ../01-spec.md). Nothing on it is a new design.
 *
 * The look is NOT re-invented:
 *   1. every style block and the icon sheet are taken, as they are, from the shopper board the
 *      founder locked on 30 Sep 2026
 *      (features/shopper-ordering/04-preview/mockups/shopper-ordering-mockups-final.html);
 *   2. the pieces the walk-fixes board added and he locked on 4 Oct 2026 — the grid of "Products in
 *      this post", the bag over a video, the "Today" line under a screen — are taken, as they are,
 *      from features/shopper-walk-fixes/04-preview/src/extra.css and src/icons.svg.html. The app
 *      has those screens today, so the fixes are drawn on them.
 * This board adds only src/extra.css (three small pieces), src/icons.svg.html (no new icon was
 * needed) and src/board.html (the frames).
 *
 * On top of the walk-fixes checks (balanced tags, no undefined class, no undefined icon) it also
 * refuses an icon defined twice, and a screen whose caption lacks its id, title, sentence or
 * "Today: …" line.
 *
 * Usage: node features/shopper-app-fixes/04-preview/build.js
 * It refuses to write a board with unbalanced tags or with a class or icon that is defined nowhere.
 */
const fs = require('fs');
const path = require('path');

const here = __dirname;
const LOCKED = path.join(here, '..', '..', 'shopper-ordering', '04-preview', 'mockups', 'shopper-ordering-mockups-final.html');
const WALK = path.join(here, '..', '..', 'shopper-walk-fixes', '04-preview', 'src');
const OUT = path.join(here, 'mockups', 'shopper-app-fixes-mockups-v1.html');

const locked = fs.readFileSync(LOCKED, 'utf8');
const styles = [...locked.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const sprite = (locked.match(/<svg[^>]*style="display:none"[\s\S]*?<\/svg>/) || locked.match(/<svg[\s\S]*?<\/svg>/))[0];
const walkCss = fs.readFileSync(path.join(WALK, 'extra.css'), 'utf8');
const walkIcons = fs.readFileSync(path.join(WALK, 'icons.svg.html'), 'utf8');
const extra = fs.readFileSync(path.join(here, 'src', 'extra.css'), 'utf8');
const icons = fs.readFileSync(path.join(here, 'src', 'icons.svg.html'), 'utf8');
const body = fs.readFileSync(path.join(here, 'src', 'board.html'), 'utf8');

const problems = [];

// 1 · tags balance (the tags this board uses in pairs)
for (const tag of ['div', 'section', 'span', 'b', 'i', 'u', 's', 'em', 'table', 'tbody', 'thead', 'tr', 'td', 'th', 'ul', 'li', 'p', 'h1', 'h2', 'h3', 'header', 'footer', 'nav', 'button', 'svg']) {
  const open = (body.match(new RegExp(`<${tag}(\\s[^>]*)?>`, 'g')) || []).filter((t) => !t.endsWith('/>')).length;
  const close = (body.match(new RegExp(`</${tag}>`, 'g')) || []).length;
  if (open !== close) problems.push(`<${tag}>: ${open} opened, ${close} closed`);
}

// 2 · every class is defined somewhere
const css = `${styles}\n${walkCss}\n${extra}`;
const used = new Set();
for (const m of body.matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (c) used.add(c);
for (const c of used) {
  const re = new RegExp(`\\.${c.replace(/[-]/g, '\\-')}(?![\\w-])`);
  if (!re.test(css)) problems.push(`class "${c}" has no style`);
}

// 3 · every icon exists, and no icon is defined twice
const ids = [...`${sprite}\n${walkIcons}\n${icons}`.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]);
const defined = new Set(ids);
for (const id of defined) if (ids.filter((x) => x === id).length > 1) problems.push(`icon "#${id}" is defined twice`);
for (const m of body.matchAll(/href="#([^"]+)"/g)) if (!defined.has(m[1])) problems.push(`icon "#${m[1]}" is not defined`);

// 4 · every screen has its caption: an id, a title, one sentence, and the "Today" line
const frames = (body.match(/class="shot"/g) || []).length;
const caps = [...body.matchAll(/<div class="cap">([\s\S]*?)<\/div>/g)].map((m) => m[1]);
if (caps.length !== frames) problems.push(`${frames} screens but ${caps.length} captions`);
for (const c of caps) {
  const id = (c.match(/<i>([^<]*)<\/i>/) || [])[1] || '(no id)';
  if (!/<i>[^<]+<\/i><b>[^<]+<\/b><span>[\s\S]+<\/span><em>Today: [\s\S]+<\/em>$/.test(c.trim())) problems.push(`caption ${id}: needs id, title, sentence and a "Today: …" line`);
}

if (problems.length) {
  console.error('NOT WRITTEN:\n  ' + [...new Set(problems)].join('\n  '));
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>INFLX shopper app fixes</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
${styles}
/* ── shopper-walk-fixes (locked 4 Oct 2026): the pieces that board added ── */
${walkCss}
/* ── shopper-app-fixes: the new pieces ── */
${extra}
</style>
${sprite}
${walkIcons}
${icons}
</head><body>
<div class="wrap">
${body}
</div>
</body></html>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
console.log(`written: ${path.relative(process.cwd(), OUT)}  (${frames} frames, ${Math.round(html.length / 1024)} KB)`);
