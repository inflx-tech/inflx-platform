const fs = require('fs');
const path = require('path');

/**
 * The brief goes straight to signing, and the sign screen finally shows the whole deal.
 * Contract: features/brief-straight-to-signing
 *
 * Founder, 2026-08-28, after briefing a creator on production:
 *
 *   *"in creator app, when i send detailed campaign to one creator, it is sitting in collab tab
 *   instead going for signing tab... it should contain all details of campaign clearly which
 *   includes pre campaign agreement and campaign other details and ask for signing contract...
 *   when i click on it it is opening blank page"*
 *
 *   *"set information in creators app is not required, this is the brands one, just campaign
 *   name is enough"*
 *
 * These are SOURCE assertions, not render assertions. The screen needs a live contract row, a
 * campaign, a set and an agreement to render anything at all, and the test database has been
 * unreachable since 22 Aug. Reading the source is weaker than rendering it — but it is honest
 * about being weaker, and it catches every one of the specific things that were missing.
 */

const read = (p) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');
/** Comments describe intent; only shipped code proves it. Three checks in this repo have passed
 *  by matching their own explanatory comment. */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const contractScreen = () => code('../ContractScreen.js');
const collabScreen   = () => code('../CollabDetailScreen.js');
const sheet          = () => code('../../../components/influencer/DeclineSheet.js');

describe('she is shown what she may sell — the thing her commission depends on', () => {
  it('the sign screen renders the server\'s description, not its own', () => {
    const src = contractScreen();
    expect(src).toContain("setSell(data.sell || null)");
    expect(src).toContain('{sell.label}');
    expect(src).toContain('{sell.detail}');
  });

  it('and it does not reinvent the words locally', () => {
    // The whole point of describing it on the server is that the contract screen, the collab
    // screen and the brand's review cannot end up disagreeing. A local map of scope→label here
    // would be a fourth vocabulary in a repo that has already deleted three.
    const src = contractScreen();
    expect(src).not.toMatch(/alloc_scope\s*===\s*'store'/);
    expect(src).not.toContain('Everything in the store');
  });

  it('it is not shown on a pay-for-content collab, where nothing is sold', () => {
    const src = contractScreen();
    expect(src).toMatch(/\{showCommissionCard && sell && \(/);
  });
});

describe('she is shown the offer her shoppers get, and how long it lasts', () => {
  it('by name and with both ends of the window', () => {
    const src = contractScreen();
    expect(src).toContain('contract.brand_offer_name');
    expect(src).toContain('contract.offer_valid_from');
    expect(src).toContain('contract.offer_valid_until');
  });

  it('an open-ended offer says so rather than showing a blank', () => {
    expect(contractScreen()).toContain("'no end date'");
  });
});

describe('she is told what happens to her content', () => {
  it('the sentence comes from the server', () => {
    const src = contractScreen();
    expect(src).toContain("setUsageText(data.usage_text || '')");
    expect(src).toContain('{usageText}');
  });

  it('and the screen does not write its own version of the clause', () => {
    // describeUsage() is one function precisely so the request, the counter, the agreement
    // summary and this screen cannot describe the same permission four ways.
    const src = contractScreen();
    expect(src).not.toMatch(/repost it on their own social accounts/);
    expect(src).not.toMatch(/Commercial use —/);
  });
});

describe('sign OR decline — a screen with only one button is not asking', () => {
  it('the sign screen can decline', () => {
    const src = contractScreen();
    // ⚠️ This first asserted only that the string appeared — which the IMPORT line satisfies.
    // A mutation that renamed the call site left the import behind and the check stayed green,
    // testing nothing. Assert the button and the call, not the import.
    expect(src).toContain('onPress={() => askDeclineReason({');
    expect(src).toContain("I can't do this collaboration");
    expect(src).toContain('influencerApi.declineOffer(campaignInfluencerId');
  });

  it('both screens use the SAME sheet, not two copies of it', () => {
    for (const src of [contractScreen(), collabScreen()]) {
      expect(src).toContain("from '../../components/influencer/DeclineSheet'");
      expect(src).toContain('<DeclineSheet');
    }
  });

  it('and neither keeps a private copy of the reason list', () => {
    // ⚠️ 'not_a_fit' shipped for months from the collab screen and the server has never
    // accepted it — every tap was a 422. A second hand-written list is how that returns.
    for (const src of [contractScreen(), collabScreen()]) {
      expect(src).not.toContain('not_a_fit');
      expect(src).not.toMatch(/'fee_too_low'/);
    }
  });
});

describe('the reason keys the server actually accepts', () => {
  it('are the five, in one place', () => {
    const src = sheet();
    for (const r of ['not_relevant', 'fee_too_low', 'schedule_conflict', 'already_partnered', 'other']) {
      expect(src).toContain(`'${r}'`);
    }
    expect(src).not.toContain('not_a_fit');
  });

  it('and every key the picker can emit is one of them', () => {
    // The list existing does not help if the buttons bypass it. This walks what askDeclineReason
    // can actually hand back.
    const src = sheet();
    const emitted = [...src.matchAll(/onPick\('([a-z_]+)'\)/g)].map(m => m[1]);
    expect(emitted.length).toBeGreaterThan(0);
    const { DECLINE_REASONS } = require('../../../components/influencer/DeclineSheet');
    for (const k of emitted) expect(DECLINE_REASONS).toContain(k);
  });
});

describe('the set is the brand\'s business, not hers', () => {
  it('the sign screen names the campaign and never the set', () => {
    // "set information in creators app is not required, this is the brands one, just campaign
    // name is enough."
    const src = contractScreen();
    expect(src).toContain('contract.campaign_name');
    expect(src).not.toMatch(/set_name|SET NAME|contract\.set\b/);
  });
});
