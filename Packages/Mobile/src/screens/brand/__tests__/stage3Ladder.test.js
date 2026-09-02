const fs = require('fs');
const path = require('path');

/**
 * Stage 3 — the ladder's wiring, in both apps.
 * Contract: features/stage-3-watch-the-work-happen (03-expected-outputs B-1…B-11, C-1…C-5)
 *
 * Same reasoning as the Stage 2 wiring test. The two shapes that get through every other
 * check and then crash on a handset are a navigate() to a route registered in a different
 * stack, and a style token that does not exist. Both are resolved mechanically here.
 */

const SRC = path.resolve(__dirname, '../../..');
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

describe('Stage 3 · the new pieces load', () => {
  it.each([
    'components/brand/NeedsYou.js',
    'utils/brandNeedsYou.js',
    'utils/creatorSteps.js',
    'screens/brand/BrandCreatorSpineScreen.js',
  ])('%s parses', (rel) => {
    expect(() => require(path.join(SRC, rel))).not.toThrow();
  });

  it('the creator spine screen default-exports a component', () => {
    expect(typeof require(path.join(SRC, 'screens/brand/BrandCreatorSpineScreen.js')).default).toBe('function');
  });
});

describe('Stage 3 · routes resolve', () => {
  const nav = read('navigation/BrandNavigator.js');
  const registered = new Set([...nav.matchAll(/<[A-Za-z]+\.Screen\s+name="([^"]+)"/g)].map(m => m[1]));

  it('the creator spine is registered in the CAMPAIGNS stack, where the ladder lives', () => {
    // A cross-stack navigate resolves to nothing at runtime and throws no error.
    const stack = nav.slice(nav.indexOf('function CampaignsStack'));
    const body = stack.slice(0, stack.indexOf('</Stack.Navigator>'));
    expect(body).toContain('name="BrandCreatorSpine"');
  });

  it('every route the spine screen pushes to exists', () => {
    const src = read('screens/brand/BrandCreatorSpineScreen.js');
    // The spine routes through a ctx object rather than calling `navigation` directly, so
    // match ANY .navigate('X'). What matters is that every name it can push resolves,
    // however the call happens to be written.
    const targets = [...src.matchAll(/\.navigate\(\s*'([^']+)'/g)].map(m => m[1]);
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) expect(registered.has(t)).toBe(true);
    // And it must reach the four destinations that already exist, or the steps are decorative.
    expect(targets).toEqual(expect.arrayContaining([
      'BrandContract', 'BrandCampaignReviewQueue', 'BrandConversions',
    ]));
  });

  it('the roster row opens the spine, not the public profile', () => {
    // A roster row inside a campaign is about the collaboration, not about who she is.
    const roster = read('screens/brand/BrandCampaignInfluencersListScreen.js');
    expect(roster).toContain("navigation.navigate('BrandCreatorSpine'");
  });

  it('the brand tab bar carries two badges, one true number per tab', () => {
    // The board drew ONE number spanning both halves. A badge lives on a tab, so a single
    // total on Campaigns would be wrong about Campaigns. Founder accepted the split.
    expect(nav).toContain('badge(campaignsBadge)');
    expect(nav).toContain('badge(creatorsBadge)');
    expect(nav).toContain('useNeedsYou');
  });
});

describe('Stage 3 · every style token used actually exists', () => {
  const { ig } = require(path.join(SRC, 'theme/ig'));

  it.each([
    'components/brand/NeedsYou.js',
    'screens/brand/BrandCreatorSpineScreen.js',
  ])('%s uses only real ig.* tokens', (rel) => {
    const used = [...new Set([...read(rel).matchAll(/\big\.([a-zA-Z0-9_]+)/g)].map(m => m[1]))];
    expect(used.length).toBeGreaterThan(0);
    for (const t of used) expect(Object.prototype.hasOwnProperty.call(ig, t)).toBe(true);
  });
});

describe('Stage 3 · the second step model is gone from the creator app', () => {
  it('collabDetailModel no longer exports a spine', () => {
    const mod = require(path.join(SRC, 'utils/collabDetailModel'));
    expect(mod.spineFor).toBeUndefined();
    expect(mod.SPINE).toBeUndefined();
  });

  it('her detail screen reads the server step instead of deriving one', () => {
    const src = read('screens/influencer/CollabDetailScreen.js');
    expect(src).toContain("from '../../utils/creatorSteps'");
    expect(src).toContain('stepFor(stepData, ciId)');
    expect(src).not.toContain('spineFor(');
  });

  it('both apps spell the six steps from ONE place', () => {
    // The number is decided on the server; this is only how it is written down. Two lists
    // of labels is how "step 3" starts meaning different things on two phones.
    const { STEP_LABELS, STEP_LABELS_CREATOR } = require(path.join(SRC, 'components/brand/NeedsYou'));
    expect(Object.keys(STEP_LABELS)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(Object.keys(STEP_LABELS_CREATOR)).toEqual(['1', '2', '3', '4', '5', '6']);
    // Step 3 is the shoot on both sides — the one both phones say out loud on the phone.
    expect(STEP_LABELS[3]).toBe('The shoot');
    expect(STEP_LABELS_CREATOR[3]).toBe('The shoot');
  });
});

describe('Stage 3 · whose turn, said in words', () => {
  const { turnLabel } = require(path.join(SRC, 'components/brand/NeedsYou'));

  it('reads correctly from each side of the same collaboration', () => {
    expect(turnLabel('brand', { asBrand: true })).toBe('YOUR TURN');
    expect(turnLabel('brand', { asBrand: false })).toBe('WAITING ON THEM');
    expect(turnLabel('creator', { asBrand: true })).toBe('WAITING ON HER');
    expect(turnLabel('creator', { asBrand: false })).toBe('YOUR TURN');
  });

  it('"nobody" is a real answer, not a gap', () => {
    // A shoot with no slot proposed is genuinely nobody's turn. Saying so beats an empty
    // space, which reads as missing data.
    expect(turnLabel('nobody', { asBrand: true })).toContain('NOBODY');
    expect(turnLabel(null, { asBrand: true })).toContain('NOBODY');
  });
});

describe('Stage 3 · the Maestro flow exists and walks the whole ladder', () => {
  const flow = fs.readFileSync(
    path.resolve(SRC, '../../../qa/maestro/flows/06-brand-campaign-ladder.yaml'), 'utf8');

  it('targets the brand app and reaches level 4', () => {
    expect(flow).toContain('appId: in.inflx.app.brand');
    expect(flow).toContain('Terms agreed');
    expect(flow).toContain('The shoot');
    expect(flow).toContain('NOT YOURS');
  });

  it('asserts on words the screens own, never on numbers', () => {
    // The practice world changes as the founder uses it. A flow that fails when the data
    // moves is a flow nobody runs.
    expect(flow).toContain('assertVisible: "She sees the same six steps"');
    expect(flow).not.toMatch(/assertVisible:\s*"\d+"/);
  });
});
