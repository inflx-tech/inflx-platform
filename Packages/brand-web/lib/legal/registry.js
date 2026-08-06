// The legal document registry.
//
// Documents are authored as data in docs-*.js and assembled here. Everything
// downstream — the footer, the /legal index, the [slug] route and the QA
// workflow that hunts unfilled placeholders — reads this one list, so a
// document cannot exist in the footer but 404 on click, or exist as a route
// nobody can find. Adding a document means adding it here; there is no
// second place to remember.

import core from './docs-core';
import parties from './docs-parties';
import commerce from './docs-commerce';

export const DOCUMENTS = [
  core.privacy,
  core.terms,
  core.cookies,
  commerce.refunds,
  core.community,
  commerce.ranking,
  parties.creator,
  parties.brand,
  commerce.ip,
  parties.advertising,
  commerce.copyright,
];

export const BY_SLUG = Object.fromEntries(DOCUMENTS.map((d) => [d.slug, d]));

export function getDoc(slug) {
  return BY_SLUG[slug] || null;
}

export function allSlugs() {
  return DOCUMENTS.map((d) => d.slug);
}

// Footer links live in ./nav.js, which has no dependencies — importing them
// from here would pull every legal document into any bundle that just wanted
// a list of hrefs. Re-exported so existing callers keep working.
export { FOOTER_GROUPS, PUBLIC_FOOTER_GROUPS, LEGAL_SURFACE_LIVE } from './nav';
