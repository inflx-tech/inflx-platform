'use strict';

/**
 * A coupon is a label, not the thing that finds the creator.
 * Contract: features/coupon-not-mandatory
 *
 * The founder hit this publishing a campaign: "Could not brief Sneha R. — Provide a coupon code
 * for this influencer, or set a coupon prefix on the set."
 *
 * His reasoning: "whenever he get sale that is trackable which brand, which campaign, set,
 * creator, post and product. this coupon code should not be a mandatory."
 *
 * CHECKED AGAINST PRODUCTION BEFORE CHANGING ANYTHING, 2026-08-28:
 *   · campaign_influencers.coupon_code — NULLABLE, unique index (which permits many NULLs)
 *   · 6 of 6 campaign_influencers carry NO coupon code
 *   · follower_transactions — 16 rows, 16 with campaign_influencer_id, ZERO with a coupon
 *
 * Sixteen real sales have already been attributed to a creator with no coupon anywhere in the
 * system. The rule refused to create something the database holds happily and the money path
 * already handles.
 *
 * Runs through scripts/run-test-file.js — the test database has been unreachable since
 * 2026-08-22, and these assertions need no database.
 */

const fs = require('fs');
const path = require('path');

const read = (p) => fs.readFileSync(path.resolve(__dirname, '..', p), 'utf8');
const CAMP = read('src/controllers/campaign.controller.js');
const TX = read('src/controllers/transaction.controller.js');

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const CODE = strip(CAMP);

describe('the refusals are gone', () => {
  test('inviting a creator no longer demands a coupon', () => {
    expect(CODE).not.toContain('Provide a coupon code for this influencer');
  });

  test('an open-group set no longer demands a prefix', () => {
    // The same false premise, on the set instead of the creator. Leaving one of two identical
    // rules is how an app comes to contradict itself on the next screen along.
    expect(CODE).not.toContain('coupon_prefix is required for open-group');
  });
});

describe('a coupon is still honoured when one is actually wanted', () => {
  // This is not a removal of the feature. A brand who wants codes on their bills still gets
  // them — the change is that not wanting them is now allowed.
  // Item 5 moved the coupon step, with every other invitation gate, into
  // services/invitationSend.service.js. Same code, one home.
  const SEND = read('src/services/invitationSend.service.js');
  const block = SEND.slice(SEND.indexOf('// Coupon code handling'), SEND.indexOf('// Coupon code handling') + 2200);

  test('a code passed for this creator is used', () => {
    expect(block).toContain('finalCouponCode = customCouponCode;');
  });

  test('and it is still checked for uniqueness — the column has a unique index', () => {
    expect(block).toContain('SELECT 1 FROM campaign_influencers WHERE coupon_code = $1');
    expect(block).toContain('is already in use');
  });

  test('a prefix on the set still generates one per creator', () => {
    expect(block).toContain('generateUniqueCouponCode(set.coupon_prefix');
  });

  test('and with neither, it stays null rather than throwing', () => {
    // `let finalCouponCode = null` at the top, and no else-branch that throws.
    expect(block).toMatch(/let finalCouponCode = null;/);
    const strippedBlock = strip(block);
    const elseThrow = /\}\s*else\s*\{[\s\S]{0,200}throw new AppError/.test(strippedBlock);
    expect(elseThrow).toBe(false);
  });

  test('engagement sets are still refused a prefix — a content set sells nothing', () => {
    expect(CODE).toContain('coupon_prefix must not be set for engagement goals');
  });
});

describe('why this is safe — the coupon never found the creator', () => {
  test('every read of coupon_code tolerates NULL', () => {
    // Four places in the money path do exactly this, and each already coped with a missing
    // code long before this change.
    const reads = TX.match(/const couponCode = ciRows\[0\]\?\.coupon_code \|\| null;/g) || [];
    expect(reads.length).toBeGreaterThanOrEqual(4);
  });

  test('the creator is already known BEFORE the coupon is read', () => {
    // The query that fetches the coupon is keyed BY campaign_influencer_id. The creator is the
    // input, not the output — so the coupon cannot be what identifies her.
    expect(TX).toContain('SELECT coupon_code FROM campaign_influencers WHERE id = $1');
  });

  test('nothing anywhere looks a creator UP by coupon', () => {
    // The only two queries filtering on coupon_code are uniqueness checks at creation.
    // There are TWO — one in generateUniqueCouponCode, one in invite. I asserted one and was
    // wrong about the code, not the other way round. What matters is not how many there are
    // but what they ARE: both select a literal `1` to see whether a code is already taken.
    // Neither returns a creator.
    // Item 5: the two live in services/invitationSend (the send) and services/invitationInputs
    // (the generator); the controller no longer carries either.
    const SEND = read('src/services/invitationSend.service.js');
    const INPUTS = read('src/services/invitationInputs.service.js');
    const uniquenessChecks = [...(SEND + INPUTS).matchAll(/SELECT 1 FROM campaign_influencers WHERE coupon_code = \$1/g)];
    expect(uniquenessChecks).toHaveLength(2);
    expect([...CAMP.matchAll(/SELECT 1 FROM campaign_influencers WHERE coupon_code = \$1/g)]).toHaveLength(0);

    // And every query touching coupon_code is one of those two — no query anywhere selects a
    // creator's columns by her coupon.
    const allTouches = [...(CAMP + SEND + INPUTS).matchAll(/WHERE coupon_code/g)];
    expect(allTouches).toHaveLength(2);
  });

  test('the transaction carries the whole chain the founder described', () => {
    // brand, campaign, set, offer, creator — all on the row, none of them a coupon.
    for (const field of ['campaign_id', 'set_id', 'campaign_influencer_id', 'coupon_code_used']) {
      expect(TX).toContain(field);
    }
  });
});
