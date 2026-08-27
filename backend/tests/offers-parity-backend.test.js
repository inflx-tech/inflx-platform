'use strict';

/**
 * Batch B — the backend half, executing.
 * Contract: features/stage-2-offers-parity · V-1 V-2 V-4, C-5
 *
 * Runs through scripts/run-test-file.js: jest's globalSetup connects to the test database,
 * unreachable since 2026-08-22, so every suite in this repo dies before an assertion. These
 * checks need no database — they are about what the controller accepts and writes.
 *
 * "Computed is not delivered." A value can be built perfectly on a phone, sent perfectly, and
 * dropped by a destructure that never named it. Every assertion below is about the PAYLOAD
 * surviving, not about the value being right.
 */

const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const OFFERS = read('src/controllers/brandOffer.controller.js');
const CAMP = read('src/controllers/campaign.controller.js');

/** The body of a named handler, so a check can ask what THAT function does. */
function handler(src, marker) {
  const i = src.indexOf(marker);
  if (i < 0) throw new Error(`handler not found: ${marker}`);
  const end = src.indexOf('\n});', i);
  return src.slice(i, end > 0 ? end : src.length);
}

describe('V-1 V-2 · creating an offer can set its validity window', () => {
  const create = handler(OFFERS, 'const createOffer = asyncHandler');

  test('the two dates are destructured — a field never named is a field silently dropped', () => {
    expect(create).toMatch(/store_starts_at/);
    expect(create).toMatch(/store_ends_at/);
    // Specifically out of the request body, not read from somewhere else.
    expect(create).toMatch(/const \{[\s\S]*?store_starts_at, store_ends_at \} = req\.body/);
  });

  test('both reach the INSERT', () => {
    expect(create).toMatch(/cols\.push\('store_starts_at'\)/);
    expect(create).toMatch(/cols\.push\('store_ends_at'\)/);
  });

  test('V-3 · either may be omitted, and omitted means no limit', () => {
    // Pushed only when truthy, so an omitted date leaves the column NULL — which is exactly
    // what checkout already treats as "no limit". An explicit NULL push would be the same
    // outcome by a longer route; the guard also stops an empty string reaching a timestamptz.
    expect(create).toMatch(/if \(store_starts_at\) \{ cols\.push/);
    expect(create).toMatch(/if \(store_ends_at\)\s+\{ cols\.push/);
  });

  test('V-4 · an end before the start is refused, in words', () => {
    expect(create).toMatch(/new Date\(store_ends_at\) < new Date\(store_starts_at\)/);
    expect(create).toContain('The offer ends before it starts.');
    expect(create).toMatch(/'store_ends_at'\)/);
  });

  test('the refusal happens BEFORE the insert, or it is a note rather than a rule', () => {
    expect(create.indexOf('ends before it starts')).toBeLessThan(create.indexOf('INSERT INTO brand_offers'));
  });
});

describe('C-5 · a creator carries her own offer window', () => {
  test('offer_valid_from is destructured on BOTH write paths, never used undeclared', () => {
    // The bug this catches is not hypothetical: the first cut of this change used
    // offer_valid_from in the UPDATE statement without destructuring it there. `node --check`
    // cannot see that — it is a ReferenceError at request time, on a live endpoint.
    const lines = CAMP.split(/\r?\n/);
    let declared = false;
    const undeclared = [];
    lines.forEach((l, i) => {
      if (/^const \w+ = asyncHandler|^async function \w+/.test(l)) declared = false;
      if (/^\s+offer_valid_from,\s*$/.test(l)) declared = true;
      const isUse = /offer_valid_from/.test(l)
        && !/^\s+offer_valid_from,\s*$/.test(l)
        && !/^\s*(\/\/|--)/.test(l)
        && !/offer_valid_until, offer_valid_from,/.test(l);   // the SQL column list
      if (isUse && !declared) undeclared.push(`${i + 1}: ${l.trim().slice(0, 70)}`);
    });
    expect(undeclared).toEqual([]);
  });

  test('the invite path writes it', () => {
    const invite = handler(CAMP, 'const invite = asyncHandler');
    expect(invite).toMatch(/offer_valid_until, offer_valid_from,/);
    expect(invite).toMatch(/offer_valid_from \|\| null/);
  });

  test('the update path leaves it alone when omitted', () => {
    // This endpoint is called for unrelated edits — a posting date, a budget. Clearing an
    // offer's start as a side effect of one of those is the kind of bug nobody traces back.
    expect(CAMP).toMatch(/offer_valid_from\s+= CASE WHEN \$19::text IS NULL THEN offer_valid_from\s+ELSE \$19::timestamptz END/);
  });

  test('offer_expires_at is untouched — it is a different clock', () => {
    // The invitation-acceptance deadline. It shares a table and half a name with the offer
    // window and means something else entirely; the column comment says so.
    const invite = handler(CAMP, 'const invite = asyncHandler');
    expect(invite).toMatch(/offer_expires_at/);          // still there
    expect(invite).not.toMatch(/offer_expires_at\s*=\s*offer_valid/);
  });
});

describe('the migration matches what the code expects', () => {
  const sql = read('migrations/162_creator_offer_valid_from.sql');

  test('one nullable column, no default, nothing that can reject a row', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS offer_valid_from timestamptz/);
    expect(sql).not.toMatch(/NOT NULL/);
    expect(sql).not.toMatch(/DEFAULT/);
    expect(sql).not.toMatch(/CHECK/);
  });

  test('it says why it is per creator rather than derived from the set', () => {
    // The founder's reasoning, kept where the next person will find it.
    expect(sql).toMatch(/COMMENT ON COLUMN campaign_influencers\.offer_valid_from/);
    expect(sql).toMatch(/different times/);
  });
});

describe('V-5 · checkout still refuses an out-of-window offer — unchanged, re-proved', () => {
  const tx = read('src/controllers/transaction.controller.js');

  test('both ends are still enforced', () => {
    // Batch B feeds this rule values for the first time. If the rule itself ever goes, the
    // dates become decoration and every screen above them starts lying.
    expect(tx).toMatch(/if \(o\.store_starts_at && new Date\(o\.store_starts_at\) > now\) throw UNAVAILABLE;/);
    expect(tx).toMatch(/if \(o\.store_ends_at && new Date\(o\.store_ends_at\) < now\) throw UNAVAILABLE;/);
  });
});
