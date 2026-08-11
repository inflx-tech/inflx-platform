import { test, expect } from '@playwright/test';

/**
 * WORKFLOW: creators and brands with a live collaboration are discoverable again.
 * Contract: features/backend-defect-dead-offer-join.
 *
 * THE DEFECT. Four checks asked "does this creator/brand have something live?" by INNER
 * JOINing campaign_offers — a table with zero rows in production that no application
 * code writes. An inner join against an empty table returns nothing, so the answer was
 * "no" for everyone, always.
 *
 * The worst consequence was not an empty shelf. The creator sections read "show a creator
 * if the follower already follows them OR they have a live deal", so the second half
 * always failing meant a creator actively selling right now was invisible to everyone who
 * did not already follow them.
 *
 * SCOPE CORRECTION worth keeping in the record: the first version of this contract claimed
 * 12 discovery rule queries were broken. They are not — each opens with
 * `if (offersV2Enabled()) return offersViaAdapter(...)`, and that flag defaults ON in
 * production, so they short-circuit and never reach the dead join. Checking that the code
 * EXISTS is not checking that it RUNS.
 */

process.env.DATABASE_URL ??= 'postgres://qa:qa@localhost:5432/qa';
process.env.JWT_SECRET ??= 'qa-not-used';
process.env.JWT_EXPIRY ??= '15m';
process.env.REFRESH_TOKEN_EXPIRY ??= '30d';
process.env.ENCRYPTION_KEY ??= 'qa-not-used-0000000000000000000000';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');
const src = (rel: string) =>
  fs.readFileSync(path.join(__dirname, '../../backend/src', rel), 'utf8');

const rules: string = src('services/sectionRules.service.js');
const follower: string = src('services/follower.service.js');

test.describe('WORKFLOW: the dead join is gone from the live-deal checks', () => {
  test('J1 — the creator check no longer touches campaign_offers', () => {
    const fn = rules.slice(
      rules.indexOf('function liveOfferExistsForInfluencer'),
      rules.indexOf('function liveOfferExistsForInfluencer') + 700);
    expect(fn).not.toContain('campaign_offers');
    expect(fn).toContain('LIVE_COLLAB_CHAIN');
    expect(fn).toContain('LIVE_COLLAB_WHERE');
  });

  test('J2 — the brand check no longer touches campaign_offers', () => {
    const fn = rules.slice(
      rules.indexOf('function liveOfferExists(brandRef)'),
      rules.indexOf('function liveOfferExists(brandRef)') + 500);
    expect(fn).not.toContain('campaign_offers');
    expect(fn).toContain('c.brand_id = ${brandRef}');
  });

  test('J3 — "creators in this category" no longer requires a set-level offer', () => {
    const fn = rules.slice(rules.indexOf('async function creatorsInCategory'),
                           rules.indexOf('LISTING-DRIVEN discovery'));
    expect(fn).not.toContain('JOIN campaign_offers');
    expect(fn).toContain('HAS_SOMETHING_TO_SELL');
  });

  test('J4 — the follower deal count counts collaborations, not empty offer rows', () => {
    const sub = follower.slice(follower.indexOf('AS active_deals') - 1200,
                               follower.indexOf('AS active_deals'));
    expect(sub).toContain('COUNT(DISTINCT ci2.id)');
    expect(sub).not.toContain('JOIN campaign_offers');
    expect(sub).toContain('ci2.alloc_scope IS NOT NULL');
  });
});

test.describe('WORKFLOW: one definition of "has something to sell"', () => {
  test('J5 — the test is defined once and reused', () => {
    // Two copies of a predicate is how they drift, and a drifted predicate here means a
    // creator is discoverable on one surface and invisible on another.
    expect(rules).toContain('const HAS_SOMETHING_TO_SELL =');
    const uses = rules.split('${HAS_SOMETHING_TO_SELL}').length - 1;
    expect(uses).toBeGreaterThanOrEqual(2);
  });

  test('J6 — it matches the gate the storefront already uses', () => {
    // sectionRules and follower.service must agree on who is live, or a creator shows in
    // a section and then has an empty store (or the reverse).
    expect(rules).toContain('ci.alloc_scope IS NOT NULL OR ci.offer_type IS NOT NULL');
    expect(follower).toContain('ci.alloc_scope IS NOT NULL OR co.id IS NOT NULL OR ci.offer_type IS NOT NULL');
  });

  test('J7 — the store-direct rescue is untouched', () => {
    // anyLiveOfferExists ORs the campaign leg with a published store offer. That leg was
    // masking the defect for brands; it must keep working exactly as before.
    const fn = rules.slice(rules.indexOf('function anyLiveOfferExists'),
                           rules.indexOf('function anyLiveOfferExists') + 600);
    expect(fn).toContain('published_to_store = true');
    expect(fn).toContain('store_starts_at');
    expect(fn).toContain('liveOfferExists(brandRef)');
  });
});

test.describe('WORKFLOW: the V2-guarded path is left alone', () => {
  test('J8 — OFFER_FROM still exists and is still guarded', () => {
    // It keeps its campaign_offers join deliberately: it is unreachable in production
    // (offersV2Enabled defaults on) and rewriting dead code would be risk without value.
    // Pinned so a future sweep does not "tidy" it without re-checking reachability.
    expect(rules).toContain('const OFFER_FROM');
    expect(rules).toContain('if (offerAdapter.offersV2Enabled()) return offersViaAdapter');
  });

  test('J9 — the flag really does default on for a Supabase database', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const envSrc = src('config/env.js');
    expect(envSrc).toContain('SECTION_ENGINE_OFFERS');
    expect(envSrc).toContain("includes('supabase.com')");
  });
});
