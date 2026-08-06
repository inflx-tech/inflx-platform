// Build the single reviewable legal document.
//
// The founder reads and approves ONE file rather than fourteen web pages, so
// this renders every document from the same data the site renders, with the
// company tokens resolved. Regenerate it after any edit to lib/legal/** —
// never hand-edit the output, or the file and the site will drift apart.
//
//   node scripts/build-legal-doc.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEGAL = resolve(HERE, '../Packages/brand-web/lib/legal');
const OUT = resolve(HERE, '../Docs/LEGAL/INFLX-Legal-Policies.md');

const imp = (f) => import(pathToFileURL(resolve(LEGAL, f)).href);

const { TOKENS } = await imp('company.js');
const { DISTRIBUTION, AUDIENCES, docsFor } = await imp('distribution.js');

const modules = await Promise.all(
  ['docs-core.js', 'docs-parties.js', 'docs-commerce.js', 'docs-support.js'].map(imp),
);
const docs = Object.assign({}, ...modules.map((m) => m.default));
const bySlug = Object.fromEntries(Object.values(docs).map((d) => [d.slug, d]));

const val = (k) => (TOKENS[k] && TOKENS[k].value ? TOKENS[k].value : `[${k} — NOT SUPPLIED]`);
const resolveTokens = (s) => String(s).replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => val(k));

const L = [];
const p = (...lines) => L.push(...lines);

// ── cover ──
p(`# INFLX — Legal Policies`, '');
p(`**${val('ENTITY')}**  `);
p(`CIN ${val('CIN')}  `);
p(`${val('REGISTERED_ADDRESS')}  `);
p(`${val('SUPPORT_EMAIL')} · ${val('SUPPORT_MOBILE')}`, '');
p(`**Effective:** ${val('EFFECTIVE_DATE')} · **Version 1.0** · Governed by the laws of India`, '');
p(`> This file is **generated** from \`Packages/brand-web/lib/legal/\`. It is exactly what the`);
p(`> website and the apps render. Do not edit it by hand — change the source and run`);
p(`> \`node scripts/build-legal-doc.mjs\` again.`, '');
p('---', '');

// ── which app shows what ──
p('## Which app shows which document', '');
p('A person should see the documents that bind **them**. Showing a shopper the Creator');
p('Agreement makes the things they actually need harder to find. Every app also links');
p('“All legal documents” to inflx.in/legal, so nothing is unreachable — just not in the way.', '');
p('| Document | Brand | Creator | Follower | Why |');
p('|---|:---:|:---:|:---:|---|');
for (const d of DISTRIBUTION) {
  const m = (a) => (d.audiences.includes(a) ? '✅' : '—');
  p(`| ${d.title} | ${m('brand')} | ${m('creator')} | ${m('shopper')} | ${d.why} |`);
}
p('');
for (const [key, label] of Object.entries(AUDIENCES)) {
  p(`- **${label}** — ${docsFor(key).length} documents.`);
}
p('- **inflx.in/legal** — all 14, always.', '');
p('---', '');

// ── contents ──
p('## Contents', '');
let n = 0;
for (const d of DISTRIBUTION) {
  const doc = bySlug[d.slug];
  if (!doc) continue;
  n += 1;
  p(`${n}. **${doc.title}** — ${doc.summary}`);
}
p('', '---', '');

// ── documents ──
n = 0;
for (const entry of DISTRIBUTION) {
  const doc = bySlug[entry.slug];
  if (!doc) continue;
  n += 1;

  const seen = entry.audiences.length
    ? entry.audiences.map((a) => AUDIENCES[a]).join(', ')
    : 'Website only';

  p(`# ${n}. ${doc.title}`, '');
  p(`**Applies to:** ${doc.appliesTo}  `);
  p(`**Shown in:** ${seen}  `);
  p(`**Web address:** inflx.in/${doc.slug === 'account-deletion' || doc.slug === 'contact' ? '' : 'legal/'}${doc.slug}`, '');
  p(`> **In short:** ${resolveTokens(doc.inShort)}`, '');

  doc.sections.forEach((s, i) => {
    p(`## ${n}.${i + 1} ${s.heading}`, '');
    for (const b of s.blocks) {
      if (b.p) p(resolveTokens(b.p), '');
      else if (b.ul) { for (const li of b.ul) p(`- ${resolveTokens(li)}`); p(''); }
      else if (b.table) {
        p(`| ${b.table.head.join(' | ')} |`);
        p(`|${b.table.head.map(() => '---').join('|')}|`);
        for (const r of b.table.rows) p(`| ${r.map((c) => resolveTokens(c).replace(/\n/g, ' ')).join(' | ')} |`);
        p('');
      } else if (b.callout) {
        const lab = b.callout.label ? `**${b.callout.label}**\n> ` : '';
        p(`> ${lab}${resolveTokens(b.callout.p).split('\n').join('\n> ')}`, '');
      }
    }
  });
  p('---', '');
}

p(`© ${val('COPYRIGHT_YEAR')} ${val('ENTITY')}. All rights reserved.`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, L.join('\n'));

const words = L.join(' ').split(/\s+/).length;
console.log(`Wrote ${OUT}`);
console.log(`${n} documents · ${words.toLocaleString()} words · ${L.join('\n').length.toLocaleString()} chars`);
const missing = Object.entries(TOKENS).filter(([, t]) => !t.optional && !t.value).map(([k]) => k);
console.log(missing.length ? `UNSUPPLIED FACTS: ${missing.join(', ')}` : 'All company facts supplied.');
