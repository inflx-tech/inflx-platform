#!/usr/bin/env node
/**
 * Checks every Action Book against the atlases and the Action Map.
 *
 * Exits non-zero on:
 *   - a book listing screens for an action that disagree with the atlas
 *   - a book covering an action that is not in the Action Map
 *   - an action in the Action Map that no book covers
 *   - unbalanced <div> in a book (a malformed tag)
 *
 * Run:  node Docs/ATLAS/check-books.js
 */
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const MAP = path.join(DIR, '..', 'ACTION_MAP.md');
const ATLASES = ['atlas-brand.html', 'atlas-creator.html'].map(f => path.join(DIR, f));

// action -> screens, straight from the atlases
const truth = {};
for (const f of ATLASES) {
  const src = fs.readFileSync(f, 'utf8');
  const re = /<span class="a">(S[BCA]-\d\d)<\/span>[\s\S]{0,400}?<div class="used">([^<]*)<\/div>/g;
  let m;
  while ((m = re.exec(src)))
    for (const a of new Set(m[2].match(/\b(?:BR|CR|AD)-\d\d\b/g) || []))
      (truth[a] = truth[a] || new Set()).add(m[1]);
}

// every action in the map
const mapSrc = fs.readFileSync(MAP, 'utf8');
const allActions = new Set();
for (const l of mapSrc.split(/\r?\n/)) {
  const m = l.match(/^\|\s*\*\*((?:BR|CR|AD)-\d{2})\*\*/);
  if (m) allActions.add(m[1]);
}

const books = fs.readdirSync(DIR).filter(f => /^book-\d+-.*\.html$/.test(f)).sort();
const problems = [];
const covered = new Set();

for (const b of books) {
  const src = fs.readFileSync(path.join(DIR, b), 'utf8');

  const open = (src.match(/<div/g) || []).length;
  const close = (src.match(/<\/div>/g) || []).length;
  if (open !== close)
    problems.push(`${b}: <div> unbalanced by ${open - close}`);

  // a malformed attribute like class="l">Starts">  — a quote where a tag should close
  for (const bad of src.match(/<span class="l">[A-Za-z ]+">/g) || [])
    problems.push(`${b}: malformed tag  ${bad}`);

  const re = /<span class="c">((?:BR|CR|AD)-\d\d)<\/span>[\s\S]*?<span class="l">Screens<\/span>(.*?)<\/div>/g;
  let m;
  while ((m = re.exec(src))) {
    const code = m[1];
    covered.add(code);
    if (!allActions.has(code)) {
      problems.push(`${b}: ${code} is not in the Action Map`);
      continue;
    }
    const claimed = new Set(m[2].match(/S[BCA]-\d\d/g) || []);
    const real = truth[code] || new Set();
    const missing = [...real].filter(x => !claimed.has(x));
    const extra = [...claimed].filter(x => !real.has(x));
    if (missing.length) problems.push(`${b}: ${code} omits ${missing.join(' ')} (the atlas says it is used there)`);
    if (extra.length) problems.push(`${b}: ${code} claims ${extra.join(' ')} (the atlas does not)`);
  }
}

const uncovered = [...allActions].filter(a => !covered.has(a)).sort();

console.log(`${books.length} book(s) · ${covered.size} of ${allActions.size} actions covered`);
if (uncovered.length) console.log(`  not yet written: ${uncovered.join(' ')}`);

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log('no problems');
