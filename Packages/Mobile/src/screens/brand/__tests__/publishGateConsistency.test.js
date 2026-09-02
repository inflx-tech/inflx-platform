const fs = require('fs');
const path = require('path');

/**
 * The publish gate stops arguing with the wizard.
 * Contract: features/publish-gate-offer-consistency
 *
 * The founder reached the Review screen and found three red-and-orange blocks, with Publish
 * greyed out. Two of the three should not have been there:
 *
 *   1. "no shopper offer" BLOCKED publish — after he had asked for offers to be optional and
 *      the wizard had been changed to save without one. The app told him it was optional and
 *      then refused. Worse, the check read the SET-level offer after the offer had moved to
 *      the creator, so an offer given on her own row could not clear it at all.
 *
 *   2. "no creators in it yet" appeared while his own screen said "Creators 1" directly above.
 *      Creators are not sent to the server until Publish is pressed, so the server was
 *      describing a state that exists only because he had not published.
 *
 * The third — an agreement expiring in 3 days — was correct and is untouched.
 */

const SRC = path.resolve(__dirname, '../../..');
const read = (rel) => fs.readFileSync(path.join(SRC, rel), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const REVIEW = 'screens/brand/BrandCampaignReviewScreen.js';
const WIZARD = 'screens/brand/BrandSetWizardScreen.js';
const GATE = path.resolve(SRC, '../../../backend/src/services/publishGate.service.js');

describe('1 · an offer never blocks publishing', () => {
  it('the server treats it as a warning', () => {
    const gate = fs.readFileSync(GATE, 'utf8');
    const i = gate.indexOf("code: 'NO_SHOPPER_OFFER'");
    expect(i).toBeGreaterThan(-1);
    // Find which array it is pushed into by walking back to the nearest push.
    const before = gate.slice(0, i);
    const lastWarn = before.lastIndexOf('warnings.push');
    const lastBlock = before.lastIndexOf('blockers.push');
    expect(lastWarn).toBeGreaterThan(lastBlock);
  });

  it('the phone treats it as a warning', () => {
    const src = read(REVIEW);
    const i = src.indexOf("code: 'NO_SHOPPER_OFFER'");
    expect(i).toBeGreaterThan(-1);
    const before = src.slice(0, i);
    expect(before.lastIndexOf('localWarnings.push')).toBeGreaterThan(before.lastIndexOf('localBlockers.push'));
  });

  it('and it now reads the offer where the offer actually lives', () => {
    // `sd.offer` is the set-level one, which no longer has a control. Reading only that meant
    // a brand who gave one creator an offer still could not publish.
    expect(read(REVIEW)).toContain('sd.creators.some(c => c.offer)');
  });

  it('the server counts a per-creator offer too', () => {
    const gate = fs.readFileSync(GATE, 'utf8');
    expect(gate).toContain('members.some(ci => ci.offer_type || ci.brand_offer_id)');
  });

  it('the real blockers are untouched — this relaxes one rule, not all of them', () => {
    const gate = fs.readFileSync(GATE, 'utf8');
    for (const code of ['NO_ALLOCATION', 'EMPTY_ALLOCATION', 'AGREEMENT_MISSING', 'AGREEMENT_NOT_LIVE', 'NO_SETS']) {
      const i = gate.indexOf(`'${code}'`);
      expect(i).toBeGreaterThan(-1);
      const before = gate.slice(0, i);
      expect(before.lastIndexOf('blockers.push')).toBeGreaterThan(before.lastIndexOf('warnings.push'));
    }
  });
});

describe('2 · the server is not asked about a draft it has not been sent', () => {
  const src = read(REVIEW);

  it('EMPTY_SET and NO_SHOPPER_OFFER are dropped from the server list until published', () => {
    expect(src).toContain('IGNORE_UNTIL_PUBLISHED');
    expect(src).toMatch(/IGNORE_UNTIL_PUBLISHED = \['EMPTY_SET', 'NO_SHOPPER_OFFER'\]/);
  });

  it('dropped from the warnings, not only the blockers — that was the visible bug', () => {
    // The old code filtered EMPTY_SET out of blockers and let it straight through as a
    // warning, which is exactly what the founder saw.
    expect(src).toMatch(/serverWarnings = \(check\?\.warnings \|\| \[\]\)\.filter\(w => !IGNORE_UNTIL_PUBLISHED\.includes\(w\.code\)\)/);
    expect(src).toMatch(/warnings = \[\.\.\.localWarnings, \.\.\.serverWarnings\]/);
  });

  it('everything else the server says still gets through', () => {
    // The wallet, and any creator already invited into this campaign. Suppressing the whole
    // server list would have been the lazy fix and would have hidden a real refusal.
    expect(src).toContain('...serverBlockers');
    expect(src).not.toMatch(/const serverBlockers = \[\]/);
  });

  it('DRIFT: the expiring-agreement warning is gone with the agreements themselves', () => {
    // It WAS the right warning while agreements existed — telling a brand before the
    // clock ran out beats tidying up after. Docs/THE_CUT.md pass 1 removed the
    // pre-agreement pathway, so nothing expires and nothing can warn about it.
    expect(src).not.toContain('AGREEMENT_EXPIRING');
    expect(src).not.toContain('AGREEMENT_NOT_LIVE');
  });
});

describe('3 · one offer control, not two', () => {
  const src = read(WIZARD);
  const code = strip(src);

  it('the set-level picker is gone, with all of its plumbing', () => {
    for (const dead of ['onChooseOffer', 'onBuildOffer', 'chosenOffer', 'builderOpen', 'setOffers']) {
      expect(code).not.toContain(dead);
    }
  });

  it('the wizard no longer mounts its own offer builder', () => {
    // The creator's sheet mounts one, in inline mode. Two mounts of the same builder in one
    // screen tree is how the next fix lands on only one of them.
    expect(code).not.toContain('OfferBuilderSheet');
  });

  it('the only way in is her row', () => {
    expect(src).toContain('Give her an offer');
    expect(src).toContain('<CreatorOfferSheet');
  });

  it('the section that remains explains where the offer went', () => {
    // Deleting the section outright would leave a brand who used the old wizard hunting for
    // a control that moved. A sentence costs one line and answers the question.
    expect(src).toContain('An offer is given');
    expect(src).toContain('per creator');
  });

  it('the wizard stops fetching a list it no longer shows', () => {
    expect(code).not.toContain('brandApi.getOffers()');
  });
});

describe('4 · "See what a shopper pays" kept, in its better home', () => {
  it('it lives on her sheet now', () => {
    // Comments stripped. The note explaining that the button MOVED here quotes its label, so
    // an unstripped check passes on the comment alone — which it did, until a mutation that
    // deleted the real button was not caught.
    const sheet = strip(read('components/brand/CreatorOfferSheet.js'));
    expect(sheet).toContain('See what a shopper pays');
    expect(sheet).toContain('onPreview');
  });

  it('and the wizard still navigates there, with HER commission', () => {
    // At set level it could only guess whose basket it was pricing. Here it is a real offer
    // against a real creator's commission rate.
    const src = read(WIZARD);
    expect(src).toContain("navigate('BrandBasketPreview'");
    expect(src).toMatch(/commissionPct: creator\?\.terms\?\.money\?\.commission_pct/);
    expect(src).toMatch(/creatorName: creator\?\.name/);
  });

  it('the screen it opens is still registered', () => {
    // Removing the last navigate() into a screen orphans it. This one keeps its door.
    expect(read('navigation/BrandNavigator.js')).toContain('name="BrandBasketPreview"');
  });
});

describe('5 · an older draft still publishes', () => {
  const { invitePayload } = require('../../../utils/campaignDraft');

  it('a set-level offer saved before this change is still sent', () => {
    // A half-built set left open across the update would otherwise lose the offer the brand
    // had already chosen. The wizard no longer writes one; invitePayload still honours one.
    const body = invitePayload(
      { influencer_id: 'i1', agreement_id: 'a1', name: 'Asha', terms: { money: { commission_pct: 14 } }, alloc: { alloc_scope: 'store' } },
      { goal: 'conversion' },
      { brand_offer_id: 'old' },
    );
    expect(body.brand_offer_id).toBe('old');
  });

  it("and hers still wins when both exist", () => {
    const body = invitePayload(
      { influencer_id: 'i1', agreement_id: 'a1', name: 'Asha', terms: { money: { commission_pct: 14 } }, alloc: { alloc_scope: 'store' }, offer: { brand_offer_id: 'hers' } },
      { goal: 'conversion' },
      { brand_offer_id: 'old' },
    );
    expect(body.brand_offer_id).toBe('hers');
  });
});
