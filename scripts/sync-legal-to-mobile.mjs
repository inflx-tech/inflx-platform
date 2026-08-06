// Copy the legal content into the Mobile package.
//
// Metro cannot resolve modules outside Packages/Mobile/, which is why
// src/components/InflxMark.js is a deliberate duplicate of the shared one and
// why src/utils/tracking.js carries the same note. The legal text hits the
// same wall — so rather than maintain a second copy by hand, this generates
// one.
//
// Tokens are resolved AT BUILD TIME. The mobile app receives finished strings
// and needs no knowledge of company.js, which keeps the runtime simple and
// means a change to a company fact is a resync plus an OTA, not a code change
// in three apps.
//
//   node scripts/sync-legal-to-mobile.mjs
//
// src/legal/content.js is GENERATED. Never hand-edit it — a jest test compares
// its checksum against a fresh render and fails if the two have drifted.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LEGAL = resolve(HERE, '../Packages/brand-web/lib/legal');
const OUT = resolve(HERE, '../Packages/Mobile/src/legal/content.js');

const imp = (f) => import(pathToFileURL(resolve(LEGAL, f)).href);

const { TOKENS } = await imp('company.js');
const { DISTRIBUTION } = await imp('distribution.js');
const modules = await Promise.all(
  ['docs-core.js', 'docs-parties.js', 'docs-commerce.js', 'docs-support.js'].map(imp),
);
const docs = Object.assign({}, ...modules.map((m) => m.default));
const bySlug = Object.fromEntries(Object.values(docs).map((d) => [d.slug, d]));

const val = (k) => (TOKENS[k] && TOKENS[k].value ? TOKENS[k].value : '');
const fill = (s) => String(s).replace(/\{\{([A-Z_]+)\}\}/g, (_, k) => val(k));

// Walk the document and resolve every string, leaving structure untouched.
const deep = (node) => {
  if (typeof node === 'string') return fill(node);
  if (Array.isArray(node)) return node.map(deep);
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, deep(v)]));
  }
  return node;
};

// Only documents that actually appear in an app are shipped. The Cookie
// Policy is web-only, so bundling it into three mobile apps would be dead
// weight — the apps link out to inflx.in/legal for the full set.
const shipped = DISTRIBUTION.filter((d) => d.audiences.length > 0);

const payload = shipped.map((entry) => {
  const doc = bySlug[entry.slug];
  if (!doc) throw new Error(`distribution references unknown slug: ${entry.slug}`);
  return {
    slug: doc.slug,
    title: doc.title,
    summary: doc.summary,
    appliesTo: deep(doc.appliesTo),
    version: doc.version,
    inShort: deep(doc.inShort),
    sections: deep(doc.sections),
    audiences: entry.audiences,
  };
});

const body = JSON.stringify(payload, null, 2);
const checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);

const file = `// GENERATED FILE — DO NOT EDIT.
//
// Produced by scripts/sync-legal-to-mobile.mjs from
// Packages/brand-web/lib/legal/. Metro cannot resolve outside
// Packages/Mobile/, so the legal text is copied here rather than imported.
//
// To change any of this, edit the source in brand-web and re-run:
//   node scripts/sync-legal-to-mobile.mjs
//
// A jest test compares CHECKSUM against a fresh render, so a hand edit here —
// or an edit in brand-web that was never synced — fails the suite.

export const CHECKSUM = '${checksum}';

export const LEGAL_DOCUMENTS = ${body};

/** Documents this app should list, in order. */
export function docsForAudience(audience) {
  return LEGAL_DOCUMENTS.filter((d) => d.audiences.indexOf(audience) !== -1);
}

export function getDocument(slug) {
  return LEGAL_DOCUMENTS.filter((d) => d.slug === slug)[0] || null;
}

export default LEGAL_DOCUMENTS;
`;

// --check regenerates in memory and compares, without writing. This is what
// the QA suite runs: it fails if someone edited the legal text in brand-web
// and never resynced, or hand-edited the generated file. A generated file
// that can quietly go stale is worse than no generated file at all.
if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== file) {
    console.error('DRIFT: Packages/Mobile/src/legal/content.js is out of date.');
    console.error('The legal text in brand-web has changed since it was last synced.');
    console.error('Fix with: node scripts/sync-legal-to-mobile.mjs');
    process.exit(1);
  }
  console.log(`In sync — ${payload.length} documents, checksum ${checksum}.`);
  process.exit(0);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, file);

const counts = {};
for (const e of shipped) for (const a of e.audiences) counts[a] = (counts[a] || 0) + 1;

console.log(`Wrote ${OUT}`);
console.log(`${payload.length} documents shipped to mobile · checksum ${checksum}`);
console.log(Object.entries(counts).map(([a, n]) => `${a}: ${n}`).join(' · '));
const unresolved = file.match(/\{\{[A-Z_]+\}\}/g);
console.log(unresolved ? `UNRESOLVED TOKENS: ${[...new Set(unresolved)].join(', ')}` : 'All tokens resolved.');
