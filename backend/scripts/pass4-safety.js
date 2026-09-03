'use strict';
/**
 * Pass 4, step 2 of 3 — SAFETY CHECK. Reads only.
 *
 * Docs/THE_CUT.md pass 4. Before dropping anything, ask the only question that
 * matters: does any SURVIVING code still name this table?
 *
 * This exists because the drop list was assembled from a retired-era inventory, and
 * two entries on it are traps:
 *   · restaurant_reviews — named for the food era, but it IS the reviews feature the
 *     founder kept. It is joined on every product card to show a brand's rating.
 *   · product_addon_groups — sounds like dish toppings, but the fashion product grid
 *     selects has_addons from it on every row.
 *
 * A table being EMPTY is not evidence it is unused. Empty plus unreferenced is.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const SEARCH_DIRS = [
  'backend/src',
  'Packages/Mobile/src',
  'Packages/brand-web/app',
  'Packages/brand-web/lib',
  'Packages/brand-web/components',
];

const CANDIDATES = [
  'master_dishes', 'dish_groups', 'restaurant_reviews', 'meal_slots',
  'meal_offer_rules', 'meal_intents', 'meal_offers', 'meal_orders',
  'product_addon_groups', 'product_addon_items',
  'master_vehicles',
  'brand_collab_requests', 'collab_agreements', 'handshake_settings',
  'influencer_proposals', 'proposal_cooldowns',
  'referral_codes', 'referral_edges', 'referral_applications', 'referral_settings',
  'agencies', 'agency_withdrawals',
  'design_tokens', 'design_presets', 'experience_templates',
  'creator_experiences', 'experience_products',
  'enquiry_leads', 'lookbook_products',
];

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '__tests__') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = SEARCH_DIRS.flatMap(d => walk(path.join(ROOT, d)));
console.log('scanning ' + files.length + ' source files (tests and build output excluded)\n');

const contents = files.map(f => ({ f: path.relative(ROOT, f).split(path.sep).join('/'), s: fs.readFileSync(f, 'utf8') }));

const safe = [];
const blocked = [];

for (const t of CANDIDATES) {
  const re = new RegExp('\\b' + t + '\\b');
  const hits = contents.filter(c => re.test(c.s)).map(c => c.f);
  if (hits.length === 0) safe.push(t);
  else blocked.push({ table: t, hits });
}

console.log('=== SAFE TO DROP — no surviving code names them (' + safe.length + ') ===');
for (const t of safe) console.log('  ' + t);

console.log('\n=== DO NOT DROP — still referenced (' + blocked.length + ') ===');
for (const b of blocked) {
  console.log('  ' + b.table);
  for (const h of b.hits.slice(0, 3)) console.log('      ' + h);
  if (b.hits.length > 3) console.log('      ...and ' + (b.hits.length - 3) + ' more');
}
