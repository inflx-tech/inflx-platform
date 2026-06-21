'use strict';

/**
 * gen-food-dictionary-migration.js — generate the master_dishes expansion
 * migration from the locked CSV (C:/WORK/food_dictionary.draft.csv).
 *
 * Emits backend/migrations/114_food_dictionary_expand.sql:
 *   1. MOVE existing Continental Pizza/Pasta/Garlic Bread → Italian (taxonomy
 *      split agreed with founder; UPDATE so existing rows aren't duplicated).
 *   2. INSERT-IF-MISSING every CSV row keyed on (cuisine, section, name) — so
 *      the 129 existing rows are skipped and only net-new dishes are added.
 *      Idempotent + re-runnable.
 *
 * Run: node scripts/gen-food-dictionary-migration.js
 */

const fs = require('fs');
const path = require('path');

const CSV = process.env.DICT_CSV || path.join(__dirname, '../seeds/food_dictionary.draft.csv');
const OUT = path.join(__dirname, '../migrations/114_food_dictionary_expand.sql');

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

const lines = fs.readFileSync(CSV, 'utf8').split(/\r?\n/).filter(Boolean);
lines.shift(); // header
const rawRows = lines.map(l => {
  const [cuisine, section, name, status] = l.split(',');
  return { cuisine: cuisine.trim(), section: section.trim(), name: name.trim(), status: (status || '').trim() };
});
// De-dup within the CSV on (cuisine|section|name) — WHERE NOT EXISTS checks the
// TABLE, not the batch, so an exact repeat in the VALUES list would double-insert.
const dkeys = new Set();
const dupes = [];
const rows = rawRows.filter(r => {
  const k = `${r.cuisine}|${r.section}|${r.name}`;
  if (dkeys.has(k)) { dupes.push(k); return false; }
  dkeys.add(k); return true;
});
if (dupes.length) console.log(`De-duped ${dupes.length} in-CSV duplicate(s):\n  ${dupes.join('\n  ')}`);

// sort_order per (cuisine|section) by CSV order.
const seen = {};
for (const r of rows) {
  const k = `${r.cuisine}|${r.section}`;
  seen[k] = (seen[k] || 0) + 1;
  r.sort_order = seen[k] * 10;
}

const values = rows.map(r => `  (${q(r.cuisine)}, ${q(r.section)}, ${q(r.name)}, ${r.sort_order})`).join(',\n');
// Reconcile VALUES: (cuisine, name, section) — re-section existing rows to the
// CSV's section so renamed sections (e.g. Mains -> Mains & Grills) MOVE the
// existing dish instead of leaving a same-name-different-section near-dupe.
const recValues = rows.map(r => `  (${q(r.cuisine)}, ${q(r.name)}, ${q(r.section)})`).join(',\n');

const sql = `-- 114 — Food dictionary expansion (master_dishes ~129 -> ~${rows.length}).
-- Generated from the locked CSV by scripts/gen-food-dictionary-migration.js.
-- Additive + idempotent. KEEP existing rows; add net-new dishes; split the
-- Italian cuisine out of Continental (Pizza/Pasta/Garlic Bread) via UPDATE so
-- existing pizza/pasta rows move rather than duplicate.

-- 1. Taxonomy move: Continental Pizza/Pasta/Garlic Bread -> Italian.
UPDATE master_dishes SET cuisine = 'Italian' WHERE cuisine = 'Continental' AND section = 'Pizza';
UPDATE master_dishes SET cuisine = 'Italian' WHERE cuisine = 'Continental' AND section = 'Pasta';
UPDATE master_dishes SET cuisine = 'Italian', section = 'Garlic Bread'
  WHERE cuisine = 'Continental' AND name = 'Garlic Bread';

-- 2. Reconcile sections: move existing rows whose section was renamed in the
-- locked sheet (matched by cuisine+name) so they don't become near-duplicates.
UPDATE master_dishes m
SET section = v.section
FROM (VALUES
${recValues}
) AS v(cuisine, name, section)
WHERE m.cuisine = v.cuisine AND m.name = v.name AND m.section <> v.section;

-- 3. Insert-if-missing for the full desired dictionary (existing rows skipped).
INSERT INTO master_dishes (cuisine, section, name, sort_order)
SELECT v.cuisine, v.section, v.name, v.sort_order
FROM (VALUES
${values}
) AS v(cuisine, section, name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM master_dishes m
   WHERE m.cuisine = v.cuisine AND m.section = v.section AND m.name = v.name
);
`;

fs.writeFileSync(OUT, sql);
console.log(`Wrote ${OUT}`);
console.log(`Rows in CSV: ${rows.length} (new will be those not already present).`);
