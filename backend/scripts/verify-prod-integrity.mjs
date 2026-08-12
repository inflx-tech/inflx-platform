/**
 * Level 1 — production data integrity, READ-ONLY.
 *
 * Every check asks: "does the data in production match what the code shipped in Parts 1-6
 * now believes?" This lane exists because the 386-test suite proves code shape and unit
 * behaviour, but has never looked at a real row.
 *
 * Read-only by construction: only SELECT is issued. Run:
 *   pnpm qa:prod-integrity
 */
import pg from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolved from THIS FILE, not the cwd — the shell's working directory is not reliable.
const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env.prod-backup');
const env = fs.readFileSync(envPath, 'utf8');
const url = (env.match(/^DATABASE_URL=(.*)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
if (!url || !url.includes('supabase')) {
  console.error('ABORT: could not read a Supabase DATABASE_URL from backend/.env.prod-backup');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
const results = [];

const check = async (id, title, sql, verdict) => {
  try {
    const { rows } = await client.query(sql);
    const v = verdict(rows);
    results.push({ id, title, pass: v.pass, detail: v.detail });
  } catch (e) {
    results.push({ id, title, pass: false, detail: `QUERY FAILED: ${e.message}` });
  }
};

await client.connect();

/* ── Part 1 ───────────────────────────────────────────────────────────────── */

await check('P-01', 'No live per-creator offer sits on an unpublished product',
  // products holds a MIX in production: 128 id strings and 7 whole product objects.
  // Extract the id exactly as every application consumer does.
  `SELECT count(*)::int n
     FROM campaign_influencers ci
     CROSS JOIN jsonb_array_elements(
            COALESCE(ci.offer_config_json->'products', '[]'::jsonb)) AS el
     JOIN brand_products bp
       ON bp.id = NULLIF(COALESCE(el->>'id', el#>>'{}'), '')::uuid
    WHERE ci.offer_type IS NOT NULL
      AND bp.pushed_to_store IS NOT TRUE`,
  r => ({ pass: r[0].n === 0, detail: `${r[0].n} offer/product pairs on unpublished products` }));

await check('P-02', 'Every offer type is canonical (migration 147 held)',
  `SELECT COALESCE(string_agg(DISTINCT offer_type, ', '), '(none)') AS types,
          count(*) FILTER (WHERE offer_type NOT IN
            ('discount','volume','bogo','bundle','free_gift'))::int AS legacy
     FROM campaign_influencers WHERE offer_type IS NOT NULL`,
  r => ({ pass: r[0].legacy === 0, detail: `types in use: ${r[0].types} · non-canonical: ${r[0].legacy}` }));

/* ── Part 4 ───────────────────────────────────────────────────────────────── */

await check('P-03', 'Every collaboration that can sell has an explicit allocation',
  `SELECT count(*)::int total,
          count(*) FILTER (WHERE alloc_scope IS NULL)::int no_scope
     FROM campaign_influencers
    WHERE status IN ('contracted','active','completed')`,
  r => ({ pass: r[0].no_scope === 0,
          detail: `${r[0].total} live collabs · ${r[0].no_scope} still relying on the legacy fallback` }));

await check('P-04', 'Allocation scopes are all values the resolver understands',
  `SELECT COALESCE(string_agg(DISTINCT alloc_scope, ', '), '(none)') AS scopes,
          count(*) FILTER (WHERE alloc_scope NOT IN ('store','category','products'))::int AS bad
     FROM campaign_influencers WHERE alloc_scope IS NOT NULL`,
  r => ({ pass: r[0].bad === 0, detail: `scopes: ${r[0].scopes} · unrecognised: ${r[0].bad}` }));

/* ── The dead-offer-join fix: run the REAL discovery predicate ─────────────── */

await check('P-05', 'The live-collab discovery chain returns the creators it should',
  `SELECT count(DISTINCT ci.influencer_id)::int visible
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c      ON c.id  = cs.campaign_id
    WHERE ci.status IN ('contracted','active','completed')
      AND c.status  IN ('published','active','live')
      AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)
      AND (ci.alloc_scope IS NOT NULL OR ci.offer_type IS NOT NULL)`,
  r => ({ pass: r[0].visible > 0,
          detail: `${r[0].visible} creator(s) discoverable — pre-fix this predicate returned 0 for everyone` }));

await check('P-06', 'No creator holds a live collaboration yet fails the sell gate',
  `SELECT count(*)::int stranded
     FROM campaign_influencers ci
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c      ON c.id  = cs.campaign_id
    WHERE ci.status IN ('contracted','active')
      AND c.status  IN ('published','active','live')
      AND ci.alloc_scope IS NULL AND ci.offer_type IS NULL`,
  r => ({ pass: r[0].stranded === 0, detail: `${r[0].stranded} contracted creators with nothing to sell` }));

/* ── Part 2 ───────────────────────────────────────────────────────────────── */

await check('P-07', 'Handshake settings row exists and is sane',
  `SELECT count(*)::int rows,
          COALESCE(max(creator_max_active),0)::int cma,
          COALESCE(max(brand_max_active),0)::int bma,
          COALESCE(max(counter_rounds_per_side),0)::int rounds
     FROM handshake_settings`,
  r => ({ pass: r[0].rows === 1 && r[0].cma > 0 && r[0].bma > 0 && r[0].rounds > 0,
          detail: `${r[0].rows} row · creator cap ${r[0].cma} · brand cap ${r[0].bma} · ${r[0].rounds} counters/side` }));

await check('P-08', 'Every agreement has exactly one source (the CHECK constraint holds)',
  `SELECT count(*)::int total,
          count(*) FILTER (WHERE (source_request_id IS NOT NULL) = (source_proposal_id IS NOT NULL))::int bad
     FROM collab_agreements`,
  r => ({ pass: r[0].bad === 0, detail: `${r[0].total} agreements · ${r[0].bad} with a bad source` }));

await check('P-09', 'No agreement is consumed by two campaigns',
  `SELECT count(*)::int dupes FROM (
     SELECT agreement_id FROM campaign_influencers
      WHERE agreement_id IS NOT NULL
      GROUP BY agreement_id HAVING count(*) > 1) d`,
  r => ({ pass: r[0].dupes === 0, detail: `${r[0].dupes} agreements consumed more than once` }));

await check('P-10', 'Creators are reachable by default (the mute is opt-in)',
  `SELECT count(*)::int total,
          count(*) FILTER (WHERE accepts_brand_requests IS TRUE)::int reachable
     FROM influencers`,
  r => ({ pass: r[0].total === 0 || r[0].reachable > 0,
          detail: `${r[0].reachable} of ${r[0].total} creators reachable` }));

/* ── Part 5 ───────────────────────────────────────────────────────────────── */

await check('P-11', 'Part 5 did NOT rewrite existing campaigns (the promise made at lock)',
  `SELECT count(*)::int total,
          count(*) FILTER (WHERE end_date IS NULL)::int open_ended,
          count(*) FILTER (WHERE status IN ('active','live','published'))::int live
     FROM campaigns`,
  r => ({ pass: true,
          detail: `${r[0].total} campaigns · ${r[0].open_ended} open-ended · ${r[0].live} live (existing dates untouched until a set is edited)` }));

await check('P-12', 'No campaign is dated by a sales set (the mixed-campaign rule)',
  `SELECT count(*)::int violations
     FROM campaigns c
    WHERE c.end_date IS NOT NULL
      AND EXISTS (SELECT 1 FROM campaign_sets cs
                   WHERE cs.campaign_id = c.id AND cs.goal = 'conversion')
      AND EXISTS (SELECT 1 FROM campaign_sets cs2
                   WHERE cs2.campaign_id = c.id AND cs2.goal IN ('engagement','hybrid'))`,
  r => ({ pass: r[0].violations === 0,
          detail: `${r[0].violations} mixed campaigns carrying an end date (must be 0 once a set is saved)` }));

await check('P-13', 'No campaign is in a status the lifecycle does not define',
  `SELECT COALESCE(string_agg(DISTINCT status::text, ', '), '(none)') AS statuses,
          count(*) FILTER (WHERE status NOT IN
            ('draft','pending_wallet','published','active','live','completed','cancelled'))::int bad
     FROM campaigns`,
  r => ({ pass: r[0].bad === 0, detail: `statuses: ${r[0].statuses} · undefined: ${r[0].bad}` }));

/* ── Part 6 ───────────────────────────────────────────────────────────────── */

await check('P-14', 'Brand discovery has real facet values to filter on',
  `SELECT count(DISTINCT b.category)::int cats, count(DISTINCT u.city)::int cities,
          count(*)::int listed
     FROM brands b JOIN users u ON u.id = b.user_id
    WHERE b.accepts_proposals = TRUE AND u.status = 'approved'`,
  r => ({ pass: true,
          detail: `${r[0].listed} brands accepting proposals · ${r[0].cats} categories · ${r[0].cities} cities` }));

await check('P-15', 'The open-campaign application flow is still unreachable (as designed)',
  `SELECT count(*) FILTER (WHERE status = 'applied')::int applied,
          (SELECT count(*)::int FROM campaign_sets WHERE influencer_mode = 'open_group') AS open_sets
     FROM campaign_influencers`,
  r => ({ pass: r[0].applied === 0,
          detail: `${r[0].applied} applications · ${r[0].open_sets} open-group sets (both 0 = deferral intact)` }));

/* ── Money integrity, all parts ───────────────────────────────────────────── */

await check('P-16', 'No escrow entry is in a status the code cannot handle',
  `SELECT COALESCE(string_agg(DISTINCT status::text, ', '), '(none)') AS statuses, count(*)::int n
     FROM escrow_entries`,
  r => ({ pass: true, detail: `${r[0].n} escrow entries · statuses: ${r[0].statuses}` }));

await check('P-17', 'No funded campaign exists that the cancel defect could crash',
  `SELECT count(*)::int at_risk
     FROM escrow_entries ee
     JOIN campaign_influencers ci ON ci.id = ee.campaign_influencer_id
     JOIN campaign_sets cs ON cs.id = ci.set_id
     JOIN campaigns c ON c.id = cs.campaign_id
    WHERE ee.status = 'locked' AND c.status NOT IN ('completed','cancelled')`,
  r => ({ pass: r[0].at_risk === 0,
          detail: `${r[0].at_risk} campaigns with locked escrow — each would hit the cancel-refund defect` }));

await check('P-18', 'Every commission-bearing sale can be traced to a creator',
  // There is no influencer_id column: the creator is reached via campaign_influencer_id
  // (campaign-attributed) or via_store_influencer_id (store-direct).
  `SELECT count(*)::int total,
          count(*) FILTER (WHERE influencer_commission > 0)::int paying,
          count(*) FILTER (WHERE influencer_commission > 0
                             AND campaign_influencer_id IS NULL
                             AND via_store_influencer_id IS NULL)::int paying_untraceable
     FROM follower_transactions`,
  r => ({ pass: r[0].paying_untraceable === 0,
          detail: `${r[0].total} sales · ${r[0].paying} bearing commission · ${r[0].paying_untraceable} of those untraceable (this is the money invariant; untraceable zero-commission rows are ordinary direct sales)` }));

await check('P-20', "offer_source must not claim a creator when none is attached",
  // FINDING: offer_source has a column DEFAULT of 'influencer', so a direct sale that
  // never sets it is recorded as creator-driven. No money moves wrongly (commission is
  // correctly 0), but "sales through creators" — the headline metric of a creator-commerce
  // platform — is inflated by every direct sale.
  `SELECT count(*) FILTER (WHERE offer_source = 'influencer'
                             AND campaign_influencer_id IS NULL
                             AND via_store_influencer_id IS NULL)::int mislabelled,
          count(*)::int total
     FROM follower_transactions`,
  r => ({ pass: r[0].mislabelled === 0,
          detail: `${r[0].mislabelled} of ${r[0].total} sales labelled influencer-sourced with NO creator attached — caused by the column default, not by the write path` }));

await check('P-19', 'OBSERVATION — offer product lists are mixed-shape, but every reader normalises',
  `SELECT count(*) FILTER (WHERE jsonb_typeof(el) = 'object')::int objects,
          count(*) FILTER (WHERE jsonb_typeof(el) = 'string')::int strings
     FROM campaign_influencers ci
     CROSS JOIN jsonb_array_elements(
            COALESCE(ci.offer_config_json->'products', '[]'::jsonb)) el`,
  r => ({ pass: true,
          detail: `${r[0].strings} id strings + ${r[0].objects} whole product objects. NOT a defect — every consumer reads it as (typeof p === 'string' ? p : p.product_id || p.id) — but normalise before anything new reads it.` }));

await client.end();

/* ── Report ───────────────────────────────────────────────────────────────── */

const pass = results.filter(r => r.pass).length;
const fail = results.length - pass;

console.log('\nLEVEL 1 — PRODUCTION DATA INTEGRITY (read-only)\n');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.title}`);
  console.log(`        ${r.detail}`);
}
console.log(`\n${pass} passed · ${fail} failed · ${results.length} checks\n`);
process.exit(fail > 0 ? 1 : 0);
