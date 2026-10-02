/**
 * ui-walk-fixes D3 — the bottom tabs show on the five main pages and on no pushed screen, in
 * BOTH apps (board frames B1, B7, B8, C8; expected-outputs check 4).
 *
 * Here the navigators are stand-ins that record what they are given, so this tests the thing that
 * decides — the options each Tab.Screen is really given, merged over the navigator's own — for
 * EVERY screen of every stack, one by one (the list is read from the stacks as the navigators
 * register them, so a screen added later is covered without touching this file), and for the
 * shape the route has in a production build.
 *
 * The same rule on the real bottom-tabs and native-stack, driven by navigate / goBack, is in
 * tabBarRealNavigator.test.js; that every pushed screen has a way back is in
 * pushedScreensHaveBack.test.js.
 *
 * What jest cannot show — the bar actually leaving the screen, and the 62 points going to the
 * page — is on the device walk.
 */
import React from 'react';
import path from 'path';
import renderer, { act } from 'react-test-renderer';

jest.mock('../../services/api', () => ({
  brandApi: {}, influencerApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-native-clipboard/clipboard', () => ({ getString: jest.fn().mockResolvedValue('') }));
// The Home tab's screen and the sheet host talk to the server on mount; neither is what is tested.
jest.mock('../../components/shell/PendingHomeScreen', () => () => null);
jest.mock('../../components/shell/PendingSheetHost', () => () => null);

// The tab factory records every Tab.Screen and the Navigator's own options, and renders each
// tab's component so the stack inside it registers its screens under that tab's name.
jest.mock('@react-navigation/bottom-tabs', () => {
  const mockReact = require('react');
  global.__navCap = global.__navCap || { Ctx: mockReact.createContext(null), tabs: [], navigators: [], stacks: {} };
  const cap = global.__navCap;
  return {
    createBottomTabNavigator: () => ({
      Navigator: (props) => { cap.navigators.push(props); return props.children; },
      Screen: (props) => {
        cap.tabs.push(props);
        const Inner = props.component;
        return mockReact.createElement(cap.Ctx.Provider, { value: props.name }, mockReact.createElement(Inner, {}));
      },
    }),
  };
});
jest.mock('@react-navigation/native-stack', () => {
  const mockReact = require('react');
  global.__navCap = global.__navCap || { Ctx: mockReact.createContext(null), tabs: [], navigators: [], stacks: {} };
  const cap = global.__navCap;
  return {
    createNativeStackNavigator: () => ({
      Navigator: (props) => props.children,
      Screen: (props) => {
        const tab = mockReact.useContext(cap.Ctx);
        (cap.stacks[tab] = cap.stacks[tab] || []).push(props.name);
        return null;
      },
    }),
  };
});

const BAR = { backgroundColor: '#FFFFFF', borderTopWidth: 1, height: 62, paddingBottom: 8, paddingTop: 6 };

/** Mount one app's navigator and return what it registered. */
function mount(file) {
  const cap = global.__navCap;
  cap.tabs.length = 0; cap.navigators.length = 0; cap.stacks = {};
  const Navigator = require(file).default;
  let tree;
  act(() => { tree = renderer.create(<Navigator />); });
  const out = { tabs: [...cap.tabs], screenOptions: cap.navigators[0].screenOptions, stacks: { ...cap.stacks }, root: tree.toJSON() };
  act(() => { tree.unmount(); });
  return out;
}

/** The options the tab bar really sees: the navigator's screenOptions, then the screen's own on top. */
function effective(app, tab, route, navigation = { getState: () => ({ routes: [] }) }) {
  const base = typeof app.screenOptions === 'function' ? app.screenOptions({ route, navigation }) : (app.screenOptions || {});
  const own = typeof tab.options === 'function' ? tab.options({ route, navigation }) : (tab.options || {});
  return { ...base, ...own };
}
const routeOf = (tab, names) => ({
  key: `${tab.name}-key`, name: tab.name,
  ...(names ? { state: { index: names.length - 1, routes: names.map((name) => ({ name, key: `${name}-key` })) } } : {}),
});
const shown = (o) => o.tabBarStyle && o.tabBarStyle.display !== 'none' && o.tabBarStyle.height === 62;
const hidden = (o) => !!o.tabBarStyle && o.tabBarStyle.display === 'none';

const APPS = [
  {
    label: 'brand app', file: '../BrandNavigator', rootsExport: 'BRAND_TAB_ROOTS',
    titles: { HomeTab: 'Home', CampaignsTab: 'Campaigns', CreatorsTab: 'Creators', WalletTab: 'Wallet', ProfileTab: 'Profile' },
    roots: { HomeTab: null, CampaignsTab: 'BrandCampaigns', CreatorsTab: 'BrandCreators', WalletTab: 'BrandWallet', ProfileTab: 'BrandProfile' },
    locked: ['CampaignsTab', 'CreatorsTab'],
  },
  {
    label: 'creator app', file: '../InfluencerNavigator', rootsExport: 'CREATOR_TAB_ROOTS',
    titles: { HomeTab: 'Home', CollabsTab: 'Collabs', CreateTab: 'Create', WalletTab: 'Wallet', ProfileTab: 'Profile' },
    roots: { HomeTab: null, CollabsTab: 'Collabs', CreateTab: 'CreateHome', WalletTab: 'CreatorWallet', ProfileTab: 'ProfileMain' },
    locked: ['CollabsTab', 'CreateTab'],
  },
];

describe.each(APPS)('$label — bottom tabs only on the five main pages', (cfg) => {
  let app;
  beforeAll(() => { app = mount(cfg.file); });

  it('has its five tabs, in order, with the same titles as before', () => {
    expect(app.tabs.map((t) => t.name)).toEqual(Object.keys(cfg.titles));
    for (const t of app.tabs) expect([t.name, effective(app, t, routeOf(t)).title]).toEqual([t.name, cfg.titles[t.name]]);
  });

  it('each tab\'s main page is the first screen of its stack; Home is one plain screen', () => {
    expect(require(cfg.file)[cfg.rootsExport]).toEqual(cfg.roots);
    for (const [tab, root] of Object.entries(cfg.roots)) {
      if (root === null) { expect([tab, app.stacks[tab]]).toEqual([tab, undefined]); continue; }
      expect([tab, app.stacks[tab][0]]).toEqual([tab, root]);
      expect(app.stacks[tab].length).toBeGreaterThan(1);
    }
  });

  it('the main page of every tab shows the bar, with the whole 62-high style (a per-screen style replaces the base)', () => {
    for (const t of app.tabs) {
      const root = cfg.roots[t.name];
      // before the stack has rendered, and once it has
      for (const route of [routeOf(t), ...(root ? [routeOf(t, [root])] : [])]) {
        const o = effective(app, t, route);
        expect([t.name, shown(o)]).toEqual([t.name, true]);
        expect(o.tabBarStyle).toMatchObject(BAR);
        expect(typeof o.tabBarStyle.borderTopColor).toBe('string');
      }
    }
  });

  it('EVERY screen pushed over a main page hides the bar — one by one, in every tab', () => {
    let pushed = 0;
    for (const t of app.tabs) {
      const root = cfg.roots[t.name];
      if (!root) continue;
      for (const name of app.stacks[t.name].slice(1)) {
        const o = effective(app, t, routeOf(t, [root, name]));
        expect([t.name, name, hidden(o)]).toEqual([t.name, name, true]);
        expect(o.tabBarStyle).toEqual({ display: 'none' });
        pushed += 1;
      }
    }
    // a scan of nothing always passes: both apps push dozens of screens
    expect(pushed).toBeGreaterThan(40);
  });

  it('a screen pushed over a pushed screen stays hidden, and coming back to the main page brings the bar back', () => {
    for (const t of app.tabs) {
      const root = cfg.roots[t.name];
      if (!root) continue;
      const [a, b] = [app.stacks[t.name][1], app.stacks[t.name][app.stacks[t.name].length - 1]];
      expect(hidden(effective(app, t, routeOf(t, [root, a, b])))).toBe(true);
      expect(shown(effective(app, t, routeOf(t, [root])))).toBe(true);
      // the main page pushed again on top of something (navigate back to it by name) is still a main page
      expect(shown(effective(app, t, routeOf(t, [a, root])))).toBe(true);
    }
  });

  it('reads the stack from the tab navigator\'s state when the route does not carry it (development builds)', () => {
    const coreDir = path.dirname(require.resolve('@react-navigation/core'));
    const { CHILD_STATE } = require(path.join(coreDir, 'useRouteCache'));
    expect(typeof CHILD_STATE).toBe('symbol');
    for (const t of app.tabs) {
      const root = cfg.roots[t.name];
      if (!root) continue;
      const pushedName = app.stacks[t.name][1];
      const full = routeOf(t, [root, pushedName]);
      const devRoute = { key: full.key, name: full.name };
      Object.defineProperty(devRoute, CHILD_STATE, { enumerable: false, value: full.state });
      expect(devRoute.state).toBeUndefined();
      const navigation = { getState: () => ({ index: 0, routes: [full] }) };
      expect([t.name, hidden(effective(app, t, devRoute, navigation))]).toEqual([t.name, true]);
    }
  });

  // Reached in one place only since the cross-tab jumps pass `initial: false`: the pending
  // account's Home card into a locked tab (tabBarRealNavigator.test.js walks it on the real navigator).
  it('safety net: a screen that is the ONLY one in its stack keeps the bar — there is no main page beneath it to go back to', () => {
    for (const t of app.tabs) {
      const root = cfg.roots[t.name];
      if (!root) continue;
      const inner = app.stacks[t.name][1];
      // the tab opened straight onto an inner screen before its stack was ever built …
      expect(shown(effective(app, t, { key: 'k', name: t.name, params: { screen: inner } }))).toBe(true);
      // … which makes that screen the stack's first and only one
      expect(shown(effective(app, t, routeOf(t, [inner])))).toBe(true);
      // and the moment anything is pushed over it, the bar goes
      expect(hidden(effective(app, t, routeOf(t, [inner, app.stacks[t.name][2] || root + 'X'])))).toBe(true);
    }
  });

  it('the bar steps away while the keypad is open, on every tab', () => {
    for (const t of app.tabs) expect([t.name, effective(app, t, routeOf(t)).tabBarHideOnKeyboard]).toEqual([t.name, true]);
  });

  // D4 — every title reads the phone's top inset from the one provider the navigator sits in
  // (jest.setup draws SafeAreaProvider as a plain view that keeps its props).
  it('the whole app sits inside the safe-area provider, which starts from a zero top inset', () => {
    expect(app.root.props.initialMetrics.insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('nothing else about the tabs moved: no header, the icon, and the lock on the two locked tabs only', () => {
    for (const t of app.tabs) {
      const o = effective(app, t, routeOf(t));
      expect(o.headerShown).toBe(false);
      expect(typeof o.tabBarIcon).toBe('function');
      expect([t.name, !!(t.listeners && typeof t.listeners.tabPress === 'function')]).toEqual([t.name, cfg.locked.includes(t.name)]);
    }
  });
});

describe('tabRootOptions / isTabRoot — the rule itself', () => {
  const { tabRootOptions, isTabRoot, tabScreenOptions, TAB_BAR_STYLE, TAB_BAR_HIDDEN } = require('../BrandNavigator');

  it('the creator app uses the brand app\'s rule, not a copy of it', () => {
    const src = require('fs').readFileSync(path.join(__dirname, '..', 'InfluencerNavigator.js'), 'utf8');
    expect(src).toMatch(/import \{ tabScreenOptions, tabRootOptions \} from '\.\/BrandNavigator'/);
    expect((src.match(/options=\{tabRootOptions\(/g) || []).length).toBe(5);
    const brand = require('fs').readFileSync(path.join(__dirname, '..', 'BrandNavigator.js'), 'utf8');
    expect((brand.match(/options=\{tabRootOptions\(/g) || []).length).toBe(5);
  });

  it('the base style is the 62-high bar and the hidden style is display none', () => {
    expect(TAB_BAR_STYLE).toMatchObject(BAR);
    expect(TAB_BAR_HIDDEN).toEqual({ display: 'none' });
    expect(tabScreenOptions({ route: { name: 'HomeTab' } }).tabBarStyle).toBe(TAB_BAR_STYLE);
  });

  it('a tab that is one plain screen is always a main page, whatever its params say', () => {
    expect(isTabRoot({ key: 'h', name: 'HomeTab', params: { kind: 'brandHome', screen: 'Anything' } }, null)).toBe(true);
    expect(tabRootOptions('Home', null)({ route: { key: 'h', name: 'HomeTab' } })).toEqual({ title: 'Home', tabBarStyle: TAB_BAR_STYLE });
  });

  it('never throws on a missing route, a missing navigation or a stack state without an index', () => {
    expect(isTabRoot(undefined, 'BrandCampaigns')).toBe(true);
    expect(tabRootOptions('Campaigns', 'BrandCampaigns')()).toEqual({ title: 'Campaigns', tabBarStyle: TAB_BAR_STYLE });
    expect(isTabRoot({ key: 'c', name: 'CampaignsTab' }, 'BrandCampaigns', { getState: () => { throw new Error('gone'); } })).toBe(true);
    // a partial state with no index: a stack's focused screen is its last
    const partial = { key: 'c', name: 'CampaignsTab', state: { routes: [{ name: 'BrandCampaigns' }, { name: 'BrandThread' }] } };
    expect(isTabRoot(partial, 'BrandCampaigns')).toBe(false);
  });
});
