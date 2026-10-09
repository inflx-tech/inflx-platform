/**
 * ui-walk-fixes D3 — bottom tabs only on the five main pages — on the REAL navigators.
 *
 * tabBarOnMainPages.test.js calls the options function with hand-built routes. That proves the
 * rule, not that React Navigation feeds the rule what it expects. This file mounts the two
 * navigators exactly as the apps do — the real bottom-tabs, the real native-stack, the real
 * NavigationContainer — drives them through the container ref the way the screens do
 * (navigate, goBack, a jump into another tab), and reads the style of the bar that was drawn.
 * A library upgrade that moves the nested stack's state would turn this red.
 *
 * Only the screens are stand-ins: each one is replaced by a one-line page that says its route
 * name, so no screen talks to a server here. Which screens exist, in which stack, in which
 * order, comes from the navigators themselves.
 *
 * Also proved here, because only a real navigator can show it:
 *   - a jump into a tab that was never opened (Wallet › locked › the set, accept a pitch › the
 *     pool, Sale live › the post) lands on the inner screen with the tab's main page UNDER it —
 *     no tabs on the inner screen, and Back reaches the main page;
 *   - the one case left to the safety net: the pending account's Home cards, where the main page
 *     underneath would be a locked tab.
 *
 * What jest still cannot show is the bar leaving the glass; that is the device walk.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { StyleSheet, Text, DeviceEventEmitter } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// The header package ships two PNGs that jest cannot parse from node_modules.
jest.mock('@react-navigation/elements/lib/commonjs/assets/back-icon.png', () => 1);
jest.mock('@react-navigation/elements/lib/commonjs/assets/back-icon-mask.png', () => 1);

// The real tab bar reads the frame and the insets from context, not only from the hook.
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 360, height: 760 };
  const SafeAreaInsetsContext = mockReact.createContext(insets);
  const SafeAreaFrameContext = mockReact.createContext(frame);
  const Passthrough = ({ children, ...rest }) => mockReact.createElement(View, rest, children);
  return {
    SafeAreaProvider: Passthrough,
    SafeAreaView: Passthrough,
    SafeAreaInsetsContext,
    SafeAreaFrameContext,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

jest.mock('../../services/api', () => ({
  brandApi: {}, influencerApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(), emitAccountGate: jest.fn(),
}));
// Item 19: Home is the first screen of its own stack now. The stand-in also hands its real
// navigation object to the tests, so a jump can be made exactly as Home makes one.
jest.mock('../../components/shell/PendingHomeScreen', () => {
  const mockReact = require('react');
  const { Text: MockText } = require('react-native');
  return ({ navigation }) => { global.__homeNav = navigation; return mockReact.createElement(MockText, { testID: 'page' }, 'Home'); };
});
jest.mock('../../components/shell/PendingSheetHost', () => () => null);

const NAV_DIR = path.resolve(__dirname, '..');

/** Replace every screen a navigator imports with a page that says its route name. */
function stubScreensOf(file) {
  const src = fs.readFileSync(path.join(NAV_DIR, file), 'utf8');
  let n = 0;
  for (const m of src.matchAll(/import\s+([A-Za-z0-9_]+)?\s*,?\s*(?:\{([^}]+)\})?\s+from\s+'(\.\.\/screens\/[^']+)'/g)) {
    const named = (m[2] || '').split(',').map((x) => x.trim()).filter(Boolean);
    jest.doMock(`../${m[3]}`, () => {
      const mockReact = require('react');
      const { Text: MockText } = require('react-native');
      const Page = ({ route }) => mockReact.createElement(MockText, { testID: 'page' }, route ? route.name : '');
      const mod = { __esModule: true, default: Page };
      for (const name of named) mod[name] = Page;
      return mod;
    });
    n += 1;
  }
  return n;
}

function mountApp(file) {
  const stubbed = stubScreensOf(file);
  const { NavigationContainer, createNavigationContainerRef } = require('@react-navigation/native');
  const Navigator = require(`../${file.replace(/\.js$/, '')}`).default;
  const ref = createNavigationContainerRef();
  let tree;
  act(() => { tree = renderer.create(<NavigationContainer ref={ref}><Navigator /></NavigationContainer>); });
  return { ref, tree, stubbed };
}

/** The bar as it is drawn: the styled view around the row of tab buttons. */
function barOf(tree) {
  const lists = tree.root.findAll((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'tablist');
  expect(lists).toHaveLength(1);
  let node = lists[0].parent;
  while (node && typeof node.type !== 'string') node = node.parent;
  return StyleSheet.flatten(node.props.style) || {};
}
const barShown = (tree) => { const b = barOf(tree); return b.display !== 'none' && b.height === 62; };
const barHidden = (tree) => barOf(tree).display === 'none';

/** Where the app is: the focused tab and the names in that tab's stack, bottom to top. */
function where(ref) {
  const st = ref.getRootState();
  const tab = st.routes[st.index];
  const stack = tab.state ? tab.state.routes.map((r) => r.name) : null;
  return { tab: tab.name, stack, top: stack ? stack[typeof tab.state.index === 'number' ? tab.state.index : stack.length - 1] : null };
}
const go = (ref, ...args) => act(() => { ref.navigate(...args); });
const back = (ref) => act(() => { ref.goBack(); });

const APPS = [
  {
    // Item 19 (H3): an approved account opens on Home; Home is a stack with two lists pushed over it.
    label: 'brand app', file: 'BrandNavigator.js', first: 'HomeTab',
    roots: { CampaignsTab: 'BrandCampaigns', CreatorsTab: 'BrandCreators', WalletTab: 'BrandWallet', ProfileTab: 'BrandProfile', HomeTab: 'BrandHome' },
    pushed: { CampaignsTab: ['BrandCampaignDetail', 'BrandSetDetail', 'BrandSetPickCreators'], CreatorsTab: ['BrandCreatorProfile', 'SocialDetail'], WalletTab: ['BrandWalletLocked', 'BrandWalletCollab'], HomeTab: ['BrandNeedsYou', 'BrandWaiting'], ProfileTab: ['BrandPitchSettings', 'BrandBlockedCreators'] },
    // every jump a screen makes into ANOTHER tab's inner screen: from → tab › screen
    jumps: [
      ['WalletTab', 'CampaignsTab', 'BrandSetDetail'],
      ['CreatorsTab', 'CampaignsTab', 'BrandPool'],
      ['CreatorsTab', 'CampaignsTab', 'BrandCampaignNew'],
      ['CampaignsTab', 'CreatorsTab', 'BrandCreatorProfile'],
      // Item 19: what a Home row opens (components/home/open19.js brandTarget).
      ['HomeTab', 'CampaignsTab', 'BrandAgreement'],
      ['HomeTab', 'CreatorsTab', 'BrandPitches'],
      ['HomeTab', 'WalletTab', 'BrandWithdrawals'],
    ],
    homeJump: { tab: 'CampaignsTab', screen: 'BrandAgreement', deeper: 'BrandAddMoney', other: 'WalletTab' },
  },
  {
    label: 'creator app', file: 'InfluencerNavigator.js', first: 'HomeTab',
    roots: { CollabsTab: 'Collabs', CreateTab: 'CreateHome', WalletTab: 'CreatorWallet', ProfileTab: 'ProfileMain', HomeTab: 'CreatorHome' },
    pushed: { CollabsTab: ['FindBrands', 'BrandOverview', 'PitchForm'], CreateTab: ['PostBrand', 'PostType'], WalletTab: ['CreatorWalletPayments', 'CreatorWithdraw'], ProfileTab: ['ProfileInfo', 'YourNumbers'], HomeTab: ['CreatorNeedsYou', 'CreatorWaiting'] },
    jumps: [
      ['CollabsTab', 'CreateTab', 'PostType'],
      ['CollabsTab', 'CreateTab', 'PostStatus'],
      // Item 19: what a Home row opens (components/home/open19.js creatorTarget).
      ['HomeTab', 'CollabsTab', 'Agreement'],
      ['HomeTab', 'CreateTab', 'PostType'],
      ['HomeTab', 'ProfileTab', 'YourNumbers'],
    ],
    homeJump: { tab: 'CollabsTab', screen: 'Agreement', deeper: 'Thread', other: 'WalletTab' },
  },
];

describe.each(APPS)('$label — the real tab bar', (cfg) => {
  let app;
  beforeEach(() => {
    require('../../services/accountStatus').setAccountStatus('approved');
    app = mountApp(cfg.file);
  });
  afterEach(() => { act(() => { app.tree.unmount(); }); });

  it('mounts with the real navigators and opens on its usual tab, bar showing', () => {
    expect(app.stubbed).toBeGreaterThan(40);
    expect(app.ref.isReady()).toBe(true);
    expect(where(app.ref).tab).toBe(cfg.first);
    expect(barShown(app.tree)).toBe(true);
    expect(barOf(app.tree)).toMatchObject({ height: 62, paddingBottom: 8, paddingTop: 6, borderTopWidth: 1, backgroundColor: '#FFFFFF' });
  });

  it('every tab: the main page shows the bar, a pushed screen hides it, a second push keeps it hidden, and Back brings it back', () => {
    go(app.ref, 'HomeTab');
    expect(barShown(app.tree)).toBe(true);
    for (const [tab, root] of Object.entries(cfg.roots)) {
      const [a, b] = cfg.pushed[tab];
      go(app.ref, tab);
      expect([tab, where(app.ref).top || root, barShown(app.tree)]).toEqual([tab, root, true]);

      go(app.ref, tab, { screen: a });
      expect([tab, where(app.ref).stack, barHidden(app.tree)]).toEqual([tab, [root, a], true]);

      go(app.ref, tab, { screen: b });
      expect([tab, where(app.ref).stack, barHidden(app.tree)]).toEqual([tab, [root, a, b], true]);

      back(app.ref);
      expect([tab, where(app.ref).top, barHidden(app.tree)]).toEqual([tab, a, true]);

      back(app.ref);
      expect([tab, where(app.ref).top, barShown(app.tree)]).toEqual([tab, root, true]);
    }
  });

  it('on a main page the bar steps out of the way the moment the keypad opens (it is taken out of the layout and cannot be tapped)', () => {
    const barNode = () => {
      let node = app.tree.root.findAll((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'tablist')[0].parent;
      while (node && typeof node.type !== 'string') node = node.parent;
      return node;
    };
    expect(barNode().props.pointerEvents).toBe('auto');
    expect(barOf(app.tree).position).not.toBe('absolute');
    // jest runs as iOS, where the tab bar listens for "will show"; Android sends "did show"
    act(() => { DeviceEventEmitter.emit('keyboardWillShow', {}); DeviceEventEmitter.emit('keyboardDidShow', {}); });
    expect(barNode().props.pointerEvents).toBe('none');
    expect(barOf(app.tree).position).toBe('absolute');
  });

  it('leaving a tab with a pushed screen on top and coming back: still no bar there, and the other tab\'s main page has it', () => {
    const [tabA, tabB] = Object.keys(cfg.roots);
    go(app.ref, tabA, { screen: cfg.pushed[tabA][0], initial: false });
    expect(barHidden(app.tree)).toBe(true);
    go(app.ref, tabB);
    expect([where(app.ref).tab, barShown(app.tree)]).toEqual([tabB, true]);
    go(app.ref, tabA);
    expect([where(app.ref).top, barHidden(app.tree)]).toEqual([cfg.pushed[tabA][0], true]);
  });

  it.each(cfg.jumps)('a jump from %s into %s › %s, the tab not opened before: no bar, the main page is underneath, Back reaches it', (from, tab, screen) => {
    go(app.ref, from);
    // The target tab has not been opened in this session — except the tab the app opens on, which
    // is always built (the brand's Creators tab): there the jump pushes over the main page anyway.
    const built = app.ref.getRootState().routes.find((r) => r.name === tab).state;
    expect([tab, built === undefined]).toEqual([tab, tab !== cfg.first]);

    go(app.ref, tab, { screen, params: { id: 'x' }, initial: false });
    expect(where(app.ref)).toEqual({ tab, stack: [cfg.roots[tab], screen], top: screen });
    expect(barHidden(app.tree)).toBe(true);
    // the inner screen still receives what it was sent
    expect(app.ref.getCurrentRoute()).toMatchObject({ name: screen, params: { id: 'x' } });

    back(app.ref);
    expect(where(app.ref)).toMatchObject({ tab, top: cfg.roots[tab] });
    expect(barShown(app.tree)).toBe(true);
  });

  it.each(cfg.jumps)('the same jump from %s into %s › %s when the tab is already open: pushed over what is there, no bar', (from, tab, screen) => {
    go(app.ref, tab);
    go(app.ref, from);
    go(app.ref, tab, { screen, params: { id: 'x' }, initial: false });
    expect(where(app.ref)).toEqual({ tab, stack: [cfg.roots[tab], screen], top: screen });
    expect(barHidden(app.tree)).toBe(true);
  });

  /* ── item 19: Back from a screen Home opened returns to Home ── */
  describe('a jump made from Home (jumpFromHome)', () => {
    const { jumpFromHome, _disarmReturnHome } = require('../../components/home/open19');
    const J = cfg.homeJump;
    const jump = () => act(() => { jumpFromHome(global.__homeNav, { tab: J.tab, screen: J.screen, params: { ciId: 'x' } }); });
    afterEach(() => _disarmReturnHome());

    it('lands on the screen with the tab\'s main page underneath and no bar; Back returns to HOME, not to that tab\'s main page', () => {
      expect(where(app.ref).tab).toBe('HomeTab');
      jump();
      expect(where(app.ref)).toEqual({ tab: J.tab, stack: [cfg.roots[J.tab], J.screen], top: J.screen });
      expect(barHidden(app.tree)).toBe(true);
      expect(app.ref.getCurrentRoute()).toMatchObject({ name: J.screen, params: { ciId: 'x' } });
      back(app.ref);
      expect(where(app.ref).tab).toBe('HomeTab');
      expect(barShown(app.tree)).toBe(true);
      // the tab it visited is left on its main page, with its bar
      go(app.ref, J.tab);
      expect([where(app.ref).top, barShown(app.tree)]).toEqual([cfg.roots[J.tab], true]);
    });

    it('a screen pushed further in does not send her Home early: only leaving the last one does', () => {
      jump();
      go(app.ref, J.tab, { screen: J.deeper });
      expect(where(app.ref).stack).toEqual([cfg.roots[J.tab], J.screen, J.deeper]);
      back(app.ref);
      expect(where(app.ref)).toMatchObject({ tab: J.tab, top: J.screen });
      back(app.ref);
      expect(where(app.ref).tab).toBe('HomeTab');
    });

    it('it lets go once she is on another tab: a later Back in that tab is an ordinary Back', () => {
      jump();
      go(app.ref, J.other);                       // she left by another route (a link on the screen)
      go(app.ref, J.tab);
      expect(where(app.ref)).toMatchObject({ tab: J.tab, top: J.screen });
      back(app.ref);
      expect(where(app.ref)).toMatchObject({ tab: J.tab, top: cfg.roots[J.tab] });
    });

    it('a section heading opens a tab\'s main page and arms nothing', () => {
      act(() => { jumpFromHome(global.__homeNav, { tab: J.tab, root: cfg.roots[J.tab], params: { segment: 'x' } }); });
      expect(where(app.ref)).toMatchObject({ tab: J.tab });
      expect(barShown(app.tree)).toBe(true);
      go(app.ref, J.tab, { screen: J.screen });
      back(app.ref);
      expect(where(app.ref).tab).toBe(J.tab);
    });
  });

  it('WITHOUT `initial: false` the inner screen would be the tab\'s only screen — the case the safety net is for', () => {
    const [from, tab, screen] = cfg.jumps[0];
    go(app.ref, from);
    go(app.ref, tab, { screen });
    expect(where(app.ref)).toEqual({ tab, stack: [screen], top: screen });
    // nothing beneath it to go back to, so it keeps the bar rather than stranding the page
    expect(barShown(app.tree)).toBe(true);
  });
});

describe('the pending account\'s Home cards', () => {
  let app;
  beforeEach(() => {
    require('../../services/accountStatus').setAccountStatus('pending');
    app = mountApp('InfluencerNavigator.js');
  });
  afterEach(() => {
    act(() => { app.tree.unmount(); });
    require('../../services/accountStatus').setAccountStatus(null);
  });
  const pages = (name) => app.tree.root.findAll((n) => n.type === Text && n.props.testID === 'page' && n.props.children === name);

  it('a pending creator opens on Home, with the bar', () => {
    expect(where(app.ref).tab).toBe('HomeTab');
    expect(barShown(app.tree)).toBe(true);
  });

  it('"How collaborations work" opens in the Profile tab, which is open to her: main page underneath, no bar, Back reaches Profile', () => {
    // exactly what PendingHomeScreen sends for a card marked `mainUnder`
    go(app.ref, 'ProfileTab', { screen: 'LegalList', initial: false });
    expect(where(app.ref)).toEqual({ tab: 'ProfileTab', stack: ['ProfileMain', 'LegalList'], top: 'LegalList' });
    expect(barHidden(app.tree)).toBe(true);
    back(app.ref);
    expect(where(app.ref)).toMatchObject({ tab: 'ProfileTab', top: 'ProfileMain' });
    expect(barShown(app.tree)).toBe(true);
  });

  it('"Brands on INFLX" opens inside the LOCKED Collabs tab: its main page is never built, the bar stays — the one case left to the safety net — and Back returns to Home', () => {
    // exactly what PendingHomeScreen sends for that card: no `initial: false`
    go(app.ref, 'CollabsTab', { screen: 'FindBrands' });
    expect(where(app.ref)).toEqual({ tab: 'CollabsTab', stack: ['FindBrands'], top: 'FindBrands' });
    expect(barShown(app.tree)).toBe(true);
    expect(pages('FindBrands')).toHaveLength(1);
    expect(pages('Collabs')).toHaveLength(0);

    // a brand opened from the list is a pushed screen like any other: no bar
    go(app.ref, 'CollabsTab', { screen: 'BrandOverview' });
    expect(where(app.ref).stack).toEqual(['FindBrands', 'BrandOverview']);
    expect(barHidden(app.tree)).toBe(true);
    back(app.ref);
    expect(barShown(app.tree)).toBe(true);

    // and the list itself is not a dead end: Back leaves the locked tab for Home
    back(app.ref);
    expect(where(app.ref).tab).toBe('HomeTab');
    expect(barShown(app.tree)).toBe(true);
  });
});

describe('the cross-tab jumps in the code all ask for the main page underneath', () => {
  const SRC = path.resolve(__dirname, '..', '..');
  const walk = (dir, out = []) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      if (f.name === '__tests__' || f.name === 'node_modules') continue;
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p, out); else if (f.name.endsWith('.js')) out.push(p);
    }
    return out;
  };
  // The shopper app has its own navigator and is not part of this change.
  const files = walk(SRC).filter((p) => !/[\\/]screens[\\/](shop|follower|auth|legal)[\\/]|[\\/]components[\\/]shop[\\/]|FollowerNavigator/.test(p));
  // the tab mains: a jump to one of these is a jump to a main page, which needs nothing
  const MAINS = ['BrandCampaigns', 'BrandCreators', 'BrandWallet', 'BrandProfile', 'Collabs', 'CreateHome', 'CreatorWallet', 'ProfileMain'];
  // The two Home shells: a card there may open a screen inside a LOCKED tab, where the main page
  // must not be built underneath. They decide per card (PendingHomeScreen: `mainUnder`).
  const SHELLS = ['PendingHomeScreen.js', 'ComingSoonScreen.js'];

  // navigate('XTab', … { screen: … })  ·  navigate(card.tab, … { screen: … })  ·  { name: 'XTab', params: { screen: … } }
  const JUMP = /(?:navigate\(\s*(?:['"][A-Za-z]+Tab['"]|[a-z]\w*\.tab)\s*,[^{]*|name:\s*'[A-Za-z]+Tab',\s*params:\s*)\{\s*screen:\s*([^,}\s]+)/;

  function scan() {
    const jumps = [];
    for (const p of files) {
      fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        const m = line.match(JUMP);
        if (m) jumps.push({ at: `${path.basename(p)}:${i + 1}`, file: path.basename(p), target: m[1].replace(/['"]/g, ''), line });
      });
    }
    return jumps;
  }

  it('every `{ screen: … }` jump into a tab\'s inner screen carries `initial: false` (the two Home shells decide per card)', () => {
    const jumps = scan();
    // a scan of nothing always passes
    expect(jumps.length).toBeGreaterThanOrEqual(11);
    const inner = jumps.filter((j) => !MAINS.includes(j.target) && !SHELLS.includes(j.file));
    expect(inner.map((j) => j.file).sort()).toEqual([
      'BrandGroupDetailScreen.js', 'BrandPitchScreen.js', 'BrandPoolScreen.js', 'BrandSetDetailScreen.js',
      'BrandWalletLockedScreen.js', 'CreatorNotificationsScreen.js', 'PitchThreadScreen.js', 'SaleLiveScreen.js',
      // Item 19: every jump Home makes goes through this one line (jumpFromHome).
      'open19.js',
    ]);
    expect(inner.filter((j) => !/initial:\s*false/.test(j.line)).map((j) => j.at)).toEqual([]);
    expect([...new Set(jumps.filter((j) => SHELLS.includes(j.file)).map((j) => j.file))].sort()).toEqual(SHELLS.slice().sort());
  });

  it('the pending Home\'s cards: the Profile one puts the main page underneath, the locked-tab one does not', () => {
    const src = fs.readFileSync(path.join(SRC, 'components', 'shell', 'PendingHomeScreen.js'), 'utf8');
    const card = (key) => src.split('\n').find((l) => l.includes(`key: '${key}'`));
    expect(card('how')).toMatch(/tab: 'ProfileTab', screen: 'LegalList', mainUnder: true/);
    expect(card('brands')).toMatch(/tab: 'CollabsTab', screen: 'FindBrands' \}/);
    expect(card('brands')).not.toMatch(/mainUnder/);
    expect(src).toMatch(/c\.mainUnder \? \{ screen: c\.screen, initial: false \} : \{ screen: c\.screen \}/);
  });
});
