'use strict';

/**
 * Deliverables exist only where the brand is buying content.
 * Contract: features/deliverables-only-when-buying-content
 *
 * Founder, 2026-08-28, when his countersign was refused:
 *   "content related reels and all is come mandatory only in pay for content type of campaign"
 *
 * He had briefed Asha on a commission campaign. The wizard saved formats_json = [] on purpose —
 * a commission creator sells product, not content. The countersign then refused the whole
 * signature with "campaign set has no deliverable formats", and a third code path would have
 * invented a reel for her had she got that far.
 *
 * Runs through scripts/run-test-file.js — the test database is still unreachable and these
 * assertions need none.
 */

const fs   = require('fs');
const path = require('path');
const { buysContent, plannedDeliverables } = require('../src/services/deliverables.model');

const read = (p) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');
/** Comments state intent; only shipped code proves it. Four checks in this repo have passed by
 *  matching their own explanatory comment. */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('the rule itself', () => {
  test('a fee buys content; a commission does not', () => {
    expect(buysContent('engagement')).toBe(true);
    expect(buysContent('hybrid')).toBe(true);
    expect(buysContent('conversion')).toBe(false);
  });

  test('an unknown or missing goal is not treated as buying content', () => {
    // Refusing a signature on a goal nobody recognises would block real work over a guess.
    // Not creating deliverables is recoverable; refusing the countersign is not.
    for (const g of [null, undefined, '', 'something_from_2027']) {
      expect([g, buysContent(g)]).toEqual([g, false]);
    }
  });

  test('and it is case-insensitive, because the column is free text', () => {
    expect(buysContent('ENGAGEMENT')).toBe(true);
  });
});

describe('a commission collaboration — the founder\'s campaign', () => {
  test('⚠️ an empty format list is ACCEPTED, not refused', () => {
    // The exact row: campaign_sets goal='conversion', formats_json=[].
    const r = plannedDeliverables('conversion', []);
    expect(r.error).toBeNull();
    expect(r.formats).toEqual([]);
  });

  test('⚠️ and nothing is INVENTED either', () => {
    // getMyCampaignDetail used to fall back to [{type:'reel',count:1}] and then show it to her
    // as pending work she had never agreed to.
    for (const raw of [[], null, undefined, '[]']) {
      expect(plannedDeliverables('conversion', raw).formats).toEqual([]);
    }
  });

  test('a commission set that DOES list formats still gets none', () => {
    // Leftover formats on a set later switched to commission must not become work she owes.
    // Nothing was bought, so nothing is owed — the goal decides, not the leftovers.
    expect(plannedDeliverables('conversion', [{ type: 'reel', count: 2 }]).formats).toEqual([]);
  });
});

describe('a pay-for-content collaboration — where the requirement stands', () => {
  test('formats are turned into deliverables', () => {
    const r = plannedDeliverables('engagement', [{ type: 'reel', count: 2 }, { type: 'story', count: 1 }]);
    expect(r.error).toBeNull();
    expect(r.formats).toEqual([{ type: 'reel', count: 2 }, { type: 'story', count: 1 }]);
  });

  test('hybrid counts as buying content — there is a fee in it', () => {
    expect(plannedDeliverables('hybrid', [{ type: 'post', count: 1 }]).error).toBeNull();
  });

  test('⚠️ an empty list is still a hard error — the brand is paying and has not said what for', () => {
    const r = plannedDeliverables('engagement', []);
    expect(r.error).toBeTruthy();
    expect(r.formats).toEqual([]);
  });

  test('and the error is written for a brand, not for a database', () => {
    // The old one said "campaign set has no deliverable formats configured... formats_json",
    // to someone who has never seen a JSON column.
    const r = plannedDeliverables('engagement', []);
    expect(r.error).not.toMatch(/formats_json|JSON|array/i);
    expect(r.error).toMatch(/pays for content/);
    expect(r.error).toMatch(/Open the set/);
  });

  test('every format set to zero is the same as no formats, and says so', () => {
    const r = plannedDeliverables('engagement', [{ type: 'reel', count: 0 }]);
    expect(r.error).toMatch(/zero/);
  });

  test('malformed stored text is reported, not thrown', () => {
    // A throw here would 500 the countersign instead of telling the brand what to fix.
    const r = plannedDeliverables('engagement', '{not json');
    expect(r.error).toMatch(/unreadable/);
    expect(r.formats).toEqual([]);
  });

  test('a JSON string is read, since that is how the column comes back sometimes', () => {
    const r = plannedDeliverables('engagement', '[{"type":"reel","count":3}]');
    expect(r.formats).toEqual([{ type: 'reel', count: 3 }]);
  });

  test('a bare string format means one of them', () => {
    expect(plannedDeliverables('engagement', ['reel']).formats).toEqual([{ type: 'reel', count: 1 }]);
  });

  test('it never throws, whatever it is handed', () => {
    for (const raw of [null, undefined, 0, 'x', {}, [null], [{}], [{ count: 'many' }]]) {
      expect(() => plannedDeliverables('engagement', raw)).not.toThrow();
    }
  });
});

describe('all three places now ask the same question', () => {
  test('the countersign asks the rule instead of refusing on its own', () => {
    const src = code('../src/controllers/contract.controller.js');
    // ⚠️ This first asserted only that the function was NAMED. Hardcoding the goal at the call
    // site — plannedDeliverables('engagement', ...) — left it green while refusing every
    // commission countersign exactly as before. Assert what is passed, not that a word appears.
    expect(src).toContain('plannedDeliverables(contract.goal, contract.formats_json');
    // The old hard-coded refusals must be gone, not merely bypassed.
    expect(src).not.toMatch(/campaign set has no deliverable formats/);
    expect(src).not.toMatch(/no deliverable formats configured/);
  });

  test('⚠️ the creator screen no longer invents a reel', () => {
    const src = code('../src/controllers/influencer.controller.js');
    expect(src).toContain('plannedDeliverables(setRows[0]?.goal, setRows[0]?.formats_json)');
    expect(src).not.toMatch(/formats = \[\{ type: 'reel', count: 1 \}\]/);
  });

  test('and it reads the goal it now needs', () => {
    expect(code('../src/controllers/influencer.controller.js')).toContain('cs.formats_json, cs.goal');
  });

  test('⚠️ the phone and the server agree on what "buying content" means', () => {
    // The whole bug: BrandSetWizardScreen already sent [] for a commission set, and the server
    // called that an error. If these two ever drift again, the founder gets refused again.
    const wizard = fs.readFileSync(
      path.resolve(__dirname, '../../Packages/Mobile/src/screens/brand/BrandSetWizardScreen.js'), 'utf8');
    const m = wizard.match(/const buyingContent = ([^;]+);/);
    expect(m).toBeTruthy();
    for (const goal of ['engagement', 'hybrid']) {
      expect([goal, m[1].includes(`'${goal}'`)]).toEqual([goal, true]);
      expect([goal, buysContent(goal)]).toEqual([goal, true]);
    }
    // And the wizard sends an empty list exactly when the server expects one.
    expect(wizard).toContain('formats_json: buyingContent ? formats.filter(f => Number(f.count) > 0) : []');
  });
});
