'use strict';
/**
 * seed-practice-product-shelf.js — make the PRACTICE brands' products look and behave like
 * a real shelf: switched on, in stock, categorised against the real listing tree, and
 * carrying a picture.
 *
 * Contract: features/stage-3-watch-the-work-happen (walk preparation)
 * Founder, 2026-08-26: "you turn it on all those products ... as well as add dummy images,
 * categories as well for look and feel as real ones."
 *
 * WHY THIS EXISTS
 * All 18 practice products were is_active=false, pushed_to_store=false, with no image and
 * no category. Every product screen was therefore correct and looked broken: the picker
 * filed everything under "Other · uncategorised" with no pictures, the basket preview said
 * nothing was live, and Stage 3's roll-up correctly reported NOTHING_TO_BUY on every
 * selling set. Nothing to fix in the code; the shelf was empty.
 *
 * WHAT IT WILL AND WILL NOT TOUCH
 * ONLY brands whose name ends in "(practice)". Every statement is scoped to those brand ids
 * and the script refuses to run if that set is empty. It will not touch a real brand's
 * catalogue under any circumstances.
 *
 * OUTWARD-FACING, DELIBERATELY
 * is_active + pushed_to_store is what puts a product into FOLLOWER DISCOVERY
 * (follower.controller:1699, 1789). After this the practice brands' products are publicly
 * browsable in the shopping app. That is the point — a walk against an empty shop proves
 * nothing — but it is a real consequence and is stated here rather than discovered later.
 *
 * THE PICTURES ARE STOCK PHOTOGRAPHY, NOT THESE PRODUCTS.
 * picsum.photos with a deterministic seed per product, so each one keeps the same image
 * across reloads and devices. Swapping them for real photography later is one UPDATE.
 *
 * USAGE
 *   node backend/scripts/seed-practice-product-shelf.js            # dry run, writes nothing
 *   node backend/scripts/seed-practice-product-shelf.js --apply
 *   node backend/scripts/seed-practice-product-shelf.js --revert   # back to switched off
 */

const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env.prod-backup') });

const APPLY = process.argv.includes('--apply');
const REVERT = process.argv.includes('--revert');

/**
 * Product name → the leaf it honestly belongs to, with the node id read from production.
 * Matched on a lowercase substring of the product name. Nothing is guessed: a Kanjivaram
 * is a saree, and calling it anything else to make the picker look busier would be seeding
 * a lie into the catalogue.
 */
const NODES = {
  saree:        { id: '1adf0fed-1716-4500-b599-30f18028942d', label: 'Women › Ethnic Wear › Saree' },
  shirt:        { id: '35cbfeed-88e8-4003-949f-d460492e4ff6', label: 'Women › Western Wear › Shirt' },
  dress:        { id: '6d75235e-4296-4a37-8ac8-c51445b1dd84', label: 'Women › Western Wear › Dress' },
  trousers:     { id: 'c87f2032-08fb-4a05-8f2a-1b269550c45b', label: 'Women › Western Wear › Trousers / Pants' },
  sportsTop:    { id: '9282c704-5a31-4650-b525-8fabff4ae687', label: 'Women › Activewear › Sports Top' },
  activeShorts: { id: '782dc38b-235b-4492-ba34-1cba64561a7c', label: 'Women › Activewear › Active Shorts' },
  activeCoord:  { id: '2370b768-2961-4142-b56d-0a5051536877', label: 'Women › Activewear › Active Co-ord' },
};

/** First match wins, so put the specific words before the general ones. */
const RULES = [
  [/\bsaree\b|kanjivaram|banarasi|jamdani|kalamkari|mangalgiri|tussar|mysore|handloom|georgette|sequin|bridal/, NODES.saree],
  [/\bshirt\b/,                          NODES.shirt],
  [/\bmidi\b|\bdress\b|\bwrap\b/,        NODES.dress],
  [/wide leg|\btrouser|\bpant/,          NODES.trousers],
  [/\btee\b|t-shirt|\btop\b/,            NODES.sportsTop],
  [/\bshorts\b/,                         NODES.activeShorts],
  [/\bset\b/,                            NODES.activeCoord],
];

const nodeFor = (name) => {
  const n = String(name || '').toLowerCase();
  for (const [re, node] of RULES) if (re.test(n)) return node;
  return null;
};

/** Stable per product, so an image never changes between two looks at the same shelf. */
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const imageFor = (name) => `https://picsum.photos/seed/inflx-${slug(name)}/800/1000`;

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows: brands } = await c.query(
    `SELECT id, business_name FROM brands WHERE business_name ILIKE '%(practice)' ORDER BY business_name`);
  if (!brands.length) {
    console.error('REFUSING: no brand whose name ends in "(practice)". This script never touches a real catalogue.');
    process.exit(1);
  }
  const brandIds = brands.map(b => b.id);
  console.log(`practice brands: ${brands.map(b => b.business_name).join(' · ')}`);

  const { rows: before } = await c.query(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE is_active)::int active,
            count(*) FILTER (WHERE pushed_to_store)::int pushed,
            count(image_url)::int with_image,
            count(category_node_id)::int categorised
       FROM brand_products WHERE brand_id = ANY($1::uuid[])`, [brandIds]);
  console.log('BEFORE:', JSON.stringify(before[0]));

  if (REVERT) {
    if (!APPLY) { console.log('\n--revert is a dry run without --apply. Nothing written.'); await c.end(); return; }
    const { rowCount } = await c.query(
      `UPDATE brand_products
          SET is_active = false, pushed_to_store = false, image_url = NULL, category_node_id = NULL
        WHERE brand_id = ANY($1::uuid[])`, [brandIds]);
    console.log(`REVERTED ${rowCount} practice products to switched off.`);
    await c.end();
    return;
  }

  const { rows: products } = await c.query(
    `SELECT p.id, p.name, p.brand_id, b.business_name
       FROM brand_products p JOIN brands b ON b.id = p.brand_id
      WHERE p.brand_id = ANY($1::uuid[])
      ORDER BY b.business_name, p.name`, [brandIds]);

  const plan = products.map(p => ({ ...p, node: nodeFor(p.name), image: imageFor(p.name) }));
  const unmatched = plan.filter(p => !p.node);

  console.log(`\n${APPLY ? 'APPLYING' : 'DRY RUN — nothing will be written'}:`);
  let lastBrand = null;
  for (const p of plan) {
    if (p.business_name !== lastBrand) { console.log(`\n  ${p.business_name}`); lastBrand = p.business_name; }
    console.log(`    ${p.name.padEnd(30)} -> ${p.node ? p.node.label : '*** NO CATEGORY MATCH ***'}`);
  }

  if (unmatched.length) {
    // A product filed nowhere is worse than the script failing: it lands silently in
    // "Other · uncategorised" and nobody notices the rule missed it.
    console.error(`\nREFUSING: ${unmatched.length} product(s) matched no category rule: ${unmatched.map(p => p.name).join(', ')}`);
    console.error('Add a rule for them rather than letting them file themselves under Other.');
    await c.end();
    process.exit(1);
  }

  if (!APPLY) {
    console.log('\nRe-run with --apply to write. Note: is_active + pushed_to_store makes these');
    console.log('products publicly browsable in the shopping app. That is intended.');
    await c.end();
    return;
  }

  await c.query('BEGIN');
  try {
    for (const p of plan) {
      await c.query(
        `UPDATE brand_products
            SET is_active = true,
                pushed_to_store = true,
                stock = COALESCE(NULLIF(stock, 0), 10),
                image_url = $2,
                category_node_id = $3
          WHERE id = $1`,
        [p.id, p.image, p.node.id]);
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    console.error('FAILED, rolled back:', e.message);
    await c.end();
    process.exit(1);
  }

  const { rows: after } = await c.query(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE is_active)::int active,
            count(*) FILTER (WHERE pushed_to_store)::int pushed,
            count(image_url)::int with_image,
            count(category_node_id)::int categorised
       FROM brand_products WHERE brand_id = ANY($1::uuid[])`, [brandIds]);
  console.log('\nAFTER: ', JSON.stringify(after[0]));

  const { rows: grouped } = await c.query(
    `SELECT b.business_name, cn.name AS category, count(*)::int n
       FROM brand_products p
       JOIN brands b ON b.id = p.brand_id
       LEFT JOIN category_nodes cn ON cn.id = p.category_node_id
      WHERE p.brand_id = ANY($1::uuid[])
      GROUP BY 1, 2 ORDER BY 1, 2`, [brandIds]);
  console.log('\nhow the product picker will group them:');
  grouped.forEach(g => console.log(`  ${g.business_name}: ${g.category || 'Other · uncategorised'} × ${g.n}`));

  const a = after[0];
  if (a.active !== a.total || a.categorised !== a.total || a.with_image !== a.total) {
    console.error('UNEXPECTED: not every product came out switched on, categorised and pictured.');
    process.exit(1);
  }
  console.log('\nOK — every practice product is live, in stock, categorised and pictured.');
  await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
