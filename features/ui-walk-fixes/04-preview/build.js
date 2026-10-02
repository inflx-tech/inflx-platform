#!/usr/bin/env node
'use strict';
/**
 * ui-walk-fixes — assembles the mockup board from its parts.
 *
 *   node features/ui-walk-fixes/04-preview/build.js
 *
 * Reads   04-preview/src/_locked-base.css   (the item 14 v2 locked board's styles, copied verbatim)
 *         04-preview/src/_extra.css         (the few additions this board needs)
 *         04-preview/src/_sprite.svg.html   (the locked boards' icon set)
 *         04-preview/src/_intro.html        (title, the eleven points, how to read the board)
 *         04-preview/src/NN-*.html          (one part per board, in file-name order)
 *         04-preview/src/_decisions.html    (what the founder is asked to decide)
 * Writes  04-preview/mockups/ui-walk-fixes-mockups-v1.html
 *
 * Fails if a part is missing its <section>, or uses a class that no stylesheet defines.
 */
const fs = require('fs');
const path = require('path');

const here = __dirname;
const src = path.join(here, 'src');
const out = path.join(here, 'mockups', 'ui-walk-fixes-mockups-v1.html');
const read = (f) => fs.readFileSync(path.join(src, f), 'utf8');

const css = read('_locked-base.css') + '\n' + read('_extra.css');
const sprite = read('_sprite.svg.html');
const parts = fs.readdirSync(src).filter((f) => /^\d\d-.*\.html$/.test(f)).sort();
if (!parts.length) { console.error('no parts found'); process.exit(1); }

const body = [];
let problems = 0;
const defined = new Set((css.match(/\.[a-zA-Z][\w-]*/g) || []).map((c) => c.slice(1)));
const spriteIds = new Set((sprite.match(/id="([^"]+)"/g) || []).map((s) => s.slice(4, -1)));

for (const f of ['_intro.html', ...parts, '_decisions.html']) {
  if (!fs.existsSync(path.join(src, f))) { if (f.startsWith('_')) continue; }
  const html = read(f);
  if (!/<section[\s>]/.test(html) && !f.startsWith('_')) { console.error(`${f}: no <section>`); problems++; }
  // classes a part defines for itself
  const local = new Set(defined);
  for (const m of html.matchAll(/<style>([\s\S]*?)<\/style>/g)) {
    for (const c of m[1].match(/\.[a-zA-Z][\w-]*/g) || []) local.add(c.slice(1));
  }
  for (const m of html.matchAll(/class="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/).filter(Boolean)) {
      if (!local.has(c)) { console.error(`${f}: class "${c}" is not defined in any stylesheet`); problems++; }
    }
  }
  for (const m of html.matchAll(/href="#([^"]+)"/g)) {
    if (m[1].startsWith('i-') && !spriteIds.has(m[1]) && !new RegExp(`id="${m[1]}"`).test(html)) {
      console.error(`${f}: icon "#${m[1]}" is not in the icon set`); problems++;
    }
  }
  // crude balance check on the tags that matter for layout
  for (const tag of ['div', 'section', 'span', 'table', 'tr', 'td', 'button']) {
    const open = (html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length;
    const close = (html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
    if (open !== close) { console.error(`${f}: <${tag}> opened ${open} times, closed ${close}`); problems++; }
  }
  body.push(`\n<!-- ═════ ${f} ═════ -->\n${html}`);
}

const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<!-- preview-size: desktop -->
<title>INFLX UI walk fixes</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
${css}
</style>
</head><body>
${sprite}
<div class="wrap">
${body.join('\n')}
<footer>Built from features/ui-walk-fixes/04-preview/src by build.js. Names, numbers and dates are example data.</footer>
</div>
</body></html>
`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(`wrote ${path.relative(process.cwd(), out)} — ${parts.length} parts, ${(page.length / 1024).toFixed(0)} KB, ${(page.match(/class="phone/g) || []).length} phone frames`);
if (problems) { console.error(`${problems} problem(s)`); process.exit(1); }
