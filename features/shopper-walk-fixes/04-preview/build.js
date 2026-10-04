#!/usr/bin/env node
/**
 * Builds the shopper-walk-fixes board.
 *
 * The look is NOT re-invented: every style block and the icon sheet are taken, as they are, from
 * the shopper board the founder locked on 30 Sep 2026
 * (features/shopper-ordering/04-preview/mockups/shopper-ordering-mockups-final.html). This board
 * adds only src/extra.css (the few new pieces) and src/board.html (the frames).
 *
 * Usage: node features/shopper-walk-fixes/04-preview/build.js
 * It refuses to write a board with unbalanced tags or with a class or icon that is defined nowhere.
 */
const fs = require('fs');
const path = require('path');

const here = __dirname;
const LOCKED = path.join(here, '..', '..', 'shopper-ordering', '04-preview', 'mockups', 'shopper-ordering-mockups-final.html');
const OUT = path.join(here, 'mockups', 'shopper-walk-fixes-mockups-v1.html');

const locked = fs.readFileSync(LOCKED, 'utf8');
const styles = [...locked.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const sprite = (locked.match(/<svg[^>]*style="display:none"[\s\S]*?<\/svg>/) || locked.match(/<svg[\s\S]*?<\/svg>/))[0];
const extra = fs.readFileSync(path.join(here, 'src', 'extra.css'), 'utf8');
const icons = fs.readFileSync(path.join(here, 'src', 'icons.svg.html'), 'utf8');
const body = fs.readFileSync(path.join(here, 'src', 'board.html'), 'utf8');

const problems = [];

// 1 · tags balance (the tags this board uses in pairs)
for (const tag of ['div', 'section', 'span', 'b', 'i', 'u', 's', 'table', 'tbody', 'thead', 'tr', 'td', 'th', 'ul', 'li', 'p', 'h1', 'h2', 'h3', 'header', 'nav', 'button', 'svg']) {
  const open = (body.match(new RegExp(`<${tag}(\\s[^>]*)?>`, 'g')) || []).filter((t) => !t.endsWith('/>')).length;
  const close = (body.match(new RegExp(`</${tag}>`, 'g')) || []).length;
  if (open !== close) problems.push(`<${tag}>: ${open} opened, ${close} closed`);
}

// 2 · every class is defined somewhere
const css = `${styles}\n${extra}`;
const used = new Set();
for (const m of body.matchAll(/class="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (c) used.add(c);
for (const c of used) {
  const re = new RegExp(`\\.${c.replace(/[-]/g, '\\-')}(?![\\w-])`);
  if (!re.test(css)) problems.push(`class "${c}" has no style`);
}

// 3 · every icon exists
const defined = new Set([...`${sprite}\n${icons}`.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]));
for (const m of body.matchAll(/href="#([^"]+)"/g)) if (!defined.has(m[1])) problems.push(`icon "#${m[1]}" is not defined`);

if (problems.length) {
  console.error('NOT WRITTEN:\n  ' + [...new Set(problems)].join('\n  '));
  process.exit(1);
}

const frames = (body.match(/class="shot"/g) || []).length;
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>INFLX walk fixes</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
${styles}
/* ── shopper-walk-fixes: the new pieces ── */
${extra}
</style>
${sprite}
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
