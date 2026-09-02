const fs = require('fs');
const path = require('path');

/**
 * Stage A, slice 3 — SB-23 "New campaign" trimmed to two fields, SB-24 "Campaign builder"
 * reads back the two things every set is defined by.
 * Contract: features/stage-a-the-set
 * Board: features/screen-atlas/04-preview/mockups/atlas-brand.html → SB-23, SB-24
 *
 * Source-shape assertions, same convention as batchAWizardTrim.test.js: the fact being
 * protected is which fields a screen asks for and which fields a card shows, not layout.
 */

const SRC = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const CREATE = 'screens/brand/BrandCampaignCreateScreen.js';
const BUILDER = 'screens/brand/BrandCampaignBuilderScreen.js';
const BACKEND = path.resolve(SRC, '../../../backend/src/controllers/campaign.controller.js');

describe('SB-23 · a campaign really is two fields now', () => {
  const src = read(CREATE);

  it('parses', () => {
    const parser = require('@babel/parser');
    expect(() => parser.parse(src, { sourceType: 'module', plugins: ['jsx'] })).not.toThrow();
  });

  it('asks for a name and an optional note, nothing else', () => {
    expect(src).toContain('Name it');
    expect(src).toContain('What is it for');
    expect(src).not.toContain('Starts');
    // No start-date STATE or FIELD left — the word survives only in the doc comment
    // explaining why the server no longer requires one (checked below).
    expect(src).not.toMatch(/useState\(.*start/);
    expect(src).not.toContain('start_date:');
  });

  it('the note reaches the server as `brief`', () => {
    expect(src).toMatch(/createCampaign\(\{ name: name\.trim\(\), brief: note\.trim\(\) \|\| null \}\)/);
  });

  it('the explainer card states the rule a set is built on', () => {
    expect(src).toContain('What a set is');
    expect(src).toContain('one aim, one go-live day, one way');
  });

  it('the server no longer requires start_date to create a campaign', () => {
    const backendSrc = fs.readFileSync(BACKEND, 'utf8');
    expect(backendSrc).not.toContain("'start_date is required'");
    // still nullable at the DB level, still accepted from an older client
    expect(backendSrc).toMatch(/start_date \|\| null/);
  });
});

describe('SB-24 · every set card shows the two things it is defined by', () => {
  const src = read(BUILDER);

  it('parses', () => {
    const parser = require('@babel/parser');
    expect(() => parser.parse(src, { sourceType: 'module', plugins: ['jsx'] })).not.toThrow();
  });

  it('reads go-live day and shoot mode through the one shared rule, not a re-derivation', () => {
    expect(src).toContain("from '../../utils/setShape'");
    expect(src).toContain('goLiveDayOf(set)');
    expect(src).toContain('SHOOT_MODE_COPY[set.shoot_mode]');
  });

  it('an unset day or mode reads "Not set", never blank or invented', () => {
    const goLiveRow = src.slice(src.indexOf('k="Go live"') - 20, src.indexOf('k="Go live"') + 120);
    expect(goLiveRow).toContain("'Not set'");
    const shootRow = src.slice(src.indexOf('k="Shoot"') - 20, src.indexOf('k="Shoot"') + 200);
    expect(shootRow).toContain("'Not set'");
  });

  it('the stale "STARTS" header is gone — campaigns no longer carry a meaningful date', () => {
    expect(src).not.toContain('STARTS');
    expect(src).not.toContain('startsOn');
  });

  it('the header reads the real campaign status, not a hardcoded DRAFT literal', () => {
    expect(src).toMatch(/campaign\?\.status \|\| 'draft'/);
  });

  it('the Deliverables row reads formats off the CREATORS, not the retired set field', () => {
    // set.formats_json is never written for a new set any more (SB-30 moved it per
    // creator) — reading it here would have quietly shown "not chosen" on every content
    // set built from today onward, however many creators actually had formats set.
    expect(src).not.toContain('formatsSummary(set.formats_json)');
    expect(src).toMatch(/formatsSummary\(sd\)/);
    expect(src).toContain('draft.hasFormats(c)');
  });

  it('SUPERSEDED · the deferred pool is built, on migration 167 not 170', () => {
    // Founder, 2026-09-02, describing SC-05's single reservation button and this screen's
    // "Moved out" section in the same breath: "brand wants he create another set for
    // those deferred or reservations candidates... in screen SB 24, we have this clearly
    // a button". Docs/IMPLEMENTATION_PLAN.md's migration 170 would have made a creator's
    // row point at NO set at all when deferred — checked against the codebase first and
    // rejected: set_id is the only path every other query uses to find her campaign.
    // Migration 167 does something safer instead: a new status ('deferred') on the SAME
    // row, plus what she'd prefer. See its own file header for the full reasoning.
    expect(src).toContain('migration 167');
    expect(src).toContain('Build a set from these');
    expect(src).toContain('getDeferredCreators');
  });

  it('deferred rows carry across through campaignDraft, not a fresh negotiation', () => {
    // The button lives on the builder screen; the actual seeding happens once the new
    // set exists, in the wizard (BrandSetWizardScreen), which is where campaignId/setId
    // both become known together.
    const utilSrc = read('utils/campaignDraft.js');
    const wizardSrc = read('screens/brand/BrandSetWizardScreen.js');
    expect(utilSrc).toContain('export function seedFromDeferred');
    expect(wizardSrc).toContain('draft.seedFromDeferred');
    expect(src).toContain('seedDeferredIds');
  });
});
