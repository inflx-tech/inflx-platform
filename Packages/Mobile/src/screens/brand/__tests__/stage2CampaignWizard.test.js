const fs = require('fs');
const path = require('path');

/**
 * Stage 2 — the campaign wizard's wiring.
 * Contract: features/stage-2-build-a-campaign-from-the-phone
 *
 * WHY THESE CHECKS AND NOT SNAPSHOTS
 * The Stage 1 handover names the change class that keeps getting through: a screen that
 * "passes every automatic check and then crashes on a real device". Two shapes did it:
 *
 *   1. a navigate() to a route that is not registered in the stack the caller lives in —
 *      a cross-stack navigate fails silently at runtime and passes every build check
 *   2. a style token that does not exist — `fonts` not imported, `ig.sunk` and `ig.white`
 *      never real. That throws at module load: builds cleanly, dies on the handset.
 *
 * So these tests resolve every route name and every ig.* token the new screens use,
 * mechanically, against the real navigator and the real token file.
 */

const SRC = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

const NEW_SCREENS = [
  'screens/brand/BrandCampaignCreateScreen.js',
  'screens/brand/BrandCampaignBuilderScreen.js',
  'screens/brand/BrandSetWizardScreen.js',
  'screens/brand/BrandAllocationScreen.js',
  'screens/brand/BrandBasketPreviewScreen.js',
  'screens/brand/BrandCampaignReviewScreen.js',
];

describe('Stage 2 · the wizard loads', () => {
  it.each(NEW_SCREENS)('%s parses and default-exports a component', (rel) => {
    const mod = require(path.join(SRC, rel));
    expect(typeof mod.default).toBe('function');
  });

  it('the shared draft store and agreement helpers load', () => {
    expect(() => require('../../../utils/campaignDraft')).not.toThrow();
    expect(() => require('../../../utils/agreementSummary')).not.toThrow();
  });
});

describe('Stage 2 · every route the wizard navigates to is registered', () => {
  const nav = read('navigation/BrandNavigator.js');

  /** Route names registered anywhere in the brand navigator. */
  const registered = new Set(
    [...nav.matchAll(/<[A-Za-z]+\.Screen\s+name="([^"]+)"/g)].map((m) => m[1])
  );
  /** Tab names count too — the wizard sends a brand to the Creators TAB. */
  const tabs = new Set(
    [...nav.matchAll(/<Tab\.Screen\s+name="([^"]+)"/g)].map((m) => m[1])
  );

  const targetsIn = (rel) =>
    [...read(rel).matchAll(/navigation\.(?:navigate|replace|push)\(\s*'([^']+)'/g)].map((m) => m[1]);

  it.each(NEW_SCREENS)('%s only navigates to routes that exist', (rel) => {
    // A leaf screen may legitimately have none — the allocation and preview screens only
    // ever goBack(). What must never happen is a target that resolves to nothing.
    for (const t of targetsIn(rel)) {
      expect(registered.has(t) || tabs.has(t)).toBe(true);
    }
  });

  it('the screens that are supposed to push somewhere actually do', () => {
    // Guards the inverse mistake: a regex that matched nothing would make the check above
    // vacuously pass for every screen, which is a test that proves nothing.
    expect(targetsIn('screens/brand/BrandCampaignCreateScreen.js')).toContain('BrandCampaignBuilder');
    expect(targetsIn('screens/brand/BrandCampaignBuilderScreen.js')).toEqual(
      expect.arrayContaining(['BrandSetWizard', 'BrandCampaignReview']));
    expect(targetsIn('screens/brand/BrandSetWizardScreen.js')).toEqual(
      expect.arrayContaining(['BrandAllocation', 'BrandBasketPreview']));
  });

  it('DRIFT: the agreement screen is gone entirely — nothing anywhere opens one', () => {
    // Two steps, recorded in order. First (2026-09-02, slice_10) the wizard's "Matching
    // agreements" picker was removed, so the wizard stopped navigating here. Then
    // Docs/THE_CUT.md pass 1 removed the SCREEN — the founder's decision was "remove this
    // completely", not "keep it as read-only history".
    //
    // The assertion widened accordingly: it is no longer enough that the wizard does not
    // open it. Nothing may, and the route may not be registered at all.
    expect(targetsIn('screens/brand/BrandSetWizardScreen.js')).not.toContain('BrandAgreementDetail');
    expect(registered.has('BrandAgreementDetail')).toBe(false);
    expect(fs.existsSync(path.join(SRC, 'screens/brand/BrandAgreementDetailScreen.js'))).toBe(false);
  });

  it('the wizard no longer walks you out to the Creators tab', () => {
    // Batch A — "Go and ask someone new" is gone. Founder, 2026-08-27: it caused confusion,
    // and he was right for a reason beyond clutter. You cannot add anyone who has not already
    // agreed — the lock note directly above the button says so — and a button that leaves a
    // half-built set to do a thing that would not help is an invitation to lose the work.
    //
    // Rewritten rather than deleted: the old assertion said the wizard DOES navigate to
    // 'Creators'. That is now false, so the assertion states the opposite fact instead of
    // quietly dropping the coverage.
    // Contract: features/stage-2-walkthrough-fixes
    expect(targetsIn('screens/brand/BrandSetWizardScreen.js')).not.toContain('Creators');
    expect(read('screens/brand/BrandSetWizardScreen.js')).not.toContain('Go and ask someone new');
  });

  it('the Campaigns landing opens the wizard, and no longer offers the web', () => {
    const list = read('screens/brand/BrandCampaignListScreen.js');
    expect(list).toContain("navigation.navigate('BrandCampaignCreate')");
    // Ledger #59 — the list, and ONE Create control. Two doors to one job is the fault
    // that produced four of Stage 1's twenty-one bugs.
    expect(list).not.toContain('openWebDashboard');
    expect(list).not.toContain('Create new campaign on web');
  });

  it('every wizard screen is registered inside the Campaigns stack, not another one', () => {
    // A cross-stack navigate resolves to nothing at runtime and throws no error.
    const campaignsStack = nav.slice(nav.indexOf('function CampaignsStack'));
    const body = campaignsStack.slice(0, campaignsStack.indexOf('</Stack.Navigator>'));
    for (const name of [
      'BrandCampaignCreate', 'BrandCampaignBuilder', 'BrandSetWizard',
      'BrandAllocation', 'BrandBasketPreview', 'BrandCampaignReview',
      'BrandDiary',
    ]) {
      expect(body).toContain(`name="${name}"`);
    }
  });
});

describe('Stage 2 · every style token used actually exists', () => {
  // The Stage 1 mistake, stated in its own handover: "neither ig.sunk nor ig.white are
  // real (ig.bg is). The fonts reference would have thrown at module load."
  const { ig } = require('../../../theme/ig');

  it.each(NEW_SCREENS)('%s uses only real ig.* tokens', (rel) => {
    const src = read(rel);
    const used = [...new Set([...src.matchAll(/\big\.([a-zA-Z0-9_]+)/g)].map((m) => m[1]))];
    expect(used.length).toBeGreaterThan(0);
    for (const token of used) {
      expect(Object.prototype.hasOwnProperty.call(ig, token)).toBe(true);
    }
  });

  it.each(NEW_SCREENS)('%s imports every module it references', (rel) => {
    const src = read(rel);
    // `fonts` and `brandPalette` come from theme/tokens, `ig` from theme/ig. Using one
    // without importing it is the exact crash Stage 1 shipped.
    if (/\bfonts\./.test(src)) expect(src).toMatch(/import[^;]*\bfonts\b[^;]*from '\.\.\/\.\.\/theme\/tokens'/);
    if (/\big\./.test(src)) expect(src).toMatch(/import \{ ig \} from '\.\.\/\.\.\/theme\/ig'/);
  });
});

describe('Stage 2 · the API layer has the five methods that were missing', () => {
  const { brandApi } = require('../../../services/api');

  it.each([
    'createCampaign', 'updateCampaign',
    'createCampaignSet', 'updateCampaignSet', 'deleteCampaignSet',
    'getPublishCheck', 'previewBasket',
  ])('brandApi.%s exists', (m) => {
    expect(typeof brandApi[m]).toBe('function');
  });
});

describe('Stage 2 · the draft store keeps ledger #77 true', () => {
  const draft = require('../../../utils/campaignDraft');
  const CAMP = 'camp-test';

  afterEach(() => draft.clearDraft(CAMP));

  it('a fresh set holds nobody and no offer', () => {
    const sd = draft.getSetDraft(CAMP, 'set-1');
    expect(sd.creators).toEqual([]);
    expect(sd.offer).toBeNull();
  });

  it('one agreement cannot be pencilled into two sets of the same campaign', () => {
    draft.setSetDraft(CAMP, 'set-1', { creators: [{ agreement_id: 'a1', influencer_id: 'i1' }] });
    const inUse = draft.agreementIdsInUse(CAMP, 'set-2');
    expect(inUse.has('a1')).toBe(true);
    // ...but the set it is already in must still see it as its own, or editing that set
    // would hide the creator it already holds.
    expect(draft.agreementIdsInUse(CAMP, 'set-1').has('a1')).toBe(false);
  });

  it('clearing a draft forgets everything — abandoning burns nothing', () => {
    draft.setSetDraft(CAMP, 'set-1', { creators: [{ agreement_id: 'a1' }] });
    draft.clearDraft(CAMP);
    expect(draft.getSetDraft(CAMP, 'set-1').creators).toEqual([]);
  });

  it('the invite payload sends commission on a sales row and a fee on a content row', () => {
    // The Stage 1 defect this guards: every money line read `agreed_fee || 0`, so four
    // live sales collaborations displayed "FEE ₹0" to the creator.
    const sales = draft.invitePayload(
      { agreement_id: 'a1', influencer_id: 'i1', terms: { money: { commission_pct: 18 }, time: { post_by: '2026-08-28' } }, alloc: { alloc_scope: 'store' } },
      { id: 's1', goal: 'conversion' },
      { brand_offer_id: 'o1' },
    );
    expect(sales.commission_pct).toBe(18);
    expect(sales.agreed_fee).toBeUndefined();
    expect(sales.alloc_scope).toBe('store');
    expect(sales.brand_offer_id).toBe('o1');
    expect(sales.agreement_id).toBe('a1');

    const content = draft.invitePayload(
      { agreement_id: 'a2', influencer_id: 'i2', terms: { money: { fee: 30000 }, time: { window_end: '2026-09-25' } } },
      { id: 's2', goal: 'engagement' },
      null,
    );
    expect(content.agreed_fee).toBe(30000);
    expect(content.influencer_budget).toBe(30000);
    expect(content.commission_pct).toBeUndefined();
    // A content set sells nothing, so no allocation and no offer ride along.
    expect(content.alloc_scope).toBeUndefined();
    expect(content.brand_offer_id).toBeUndefined();
  });

  it('a set with a creator who has no allocation is reported by the summary', () => {
    draft.setSetDraft(CAMP, 's1', {
      creators: [{ agreement_id: 'a1', name: 'Asha M.', alloc: null }],
      offer: null,
    });
    const sum = draft.summarise(CAMP, [{ id: 's1', name: 'Sarees', goal: 'conversion' }]);
    expect(sum.creators).toBe(1);
    expect(sum.missingAllocation).toHaveLength(1);
    expect(sum.setsWithoutOffer).toHaveLength(1);
  });

  it('a content set is never reported as missing an offer', () => {
    draft.setSetDraft(CAMP, 's2', {
      creators: [{ agreement_id: 'a2', name: 'Nisha P.', alloc: null }],
      offer: null,
    });
    const sum = draft.summarise(CAMP, [{ id: 's2', name: 'Reels', goal: 'engagement' }]);
    expect(sum.setsWithoutOffer).toHaveLength(0);
    expect(sum.missingAllocation).toHaveLength(0);
  });
});

describe('Stage 2 · the agreement helpers read the shape the server sends', () => {
  const a = require('../../../utils/agreementSummary');

  it('a sales agreement reads as a percentage, never as a ₹0 fee', () => {
    expect(a.settledLine({ money: { commission_pct: 18 } })).toContain('18% per sale');
    expect(a.settledLine({ money: { commission_pct: 18 } })).not.toContain('₹0');
  });

  it('deliverables read as "2 reels · 1 story", not as a bare count', () => {
    const line = a.settledLine({ money: { fee: 30000 }, deliverables: [{ type: 'reel', count: 2 }, { type: 'story', count: 1 }] });
    expect(line).toContain('2 reels');
    expect(line).toContain('1 story');
  });

  it('the expiry line counts down, and says EXPIRED once it has', () => {
    const soon = new Date(Date.now() + 3 * 86400000).toISOString();
    expect(a.expiryLine(soon)).toMatch(/DAYS? LEFT/);
    expect(a.expiryLine(new Date(Date.now() - 86400000).toISOString())).toBe('EXPIRED');
    expect(a.expiryLine(null)).toBe('READY TO BRIEF');
  });

  it('an agreement with no clock sorts LAST, never ahead of one running out', () => {
    const sorted = a.byExpiry([
      { id: 'none', expires_at: null },
      { id: 'later', expires_at: new Date(Date.now() + 40 * 86400000).toISOString() },
      { id: 'soon', expires_at: new Date(Date.now() + 2 * 86400000).toISOString() },
    ]);
    expect(sorted.map(x => x.id)).toEqual(['soon', 'later', 'none']);
  });

  it('what she said she would promote becomes her allocation, pre-filled', () => {
    expect(a.allocationFromTerms({ scope: { level: 'category', category: 'Sarees', category_node_id: 'n1' } }))
      .toEqual({ alloc_scope: 'category', alloc_category: 'Sarees', alloc_category_node_id: 'n1', alloc_product_ids: null });
    // An agreement that named no scope leaves the gap the wizard must fill.
    expect(a.allocationFromTerms({})).toBeNull();
  });

  it('an unset allocation reads "Not set yet" — the words the publish blocker uses', () => {
    expect(a.allocationLabel(null)).toBe('Not set yet');
    expect(a.allocationLabel({ alloc_scope: 'store' })).toBe('Your whole store');
    expect(a.allocationLabel({ alloc_scope: 'products', alloc_product_ids: ['a', 'b'] })).toBe('2 selected products');
  });
});
