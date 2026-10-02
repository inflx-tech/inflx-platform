/**
 * ui-walk-fixes D4 (frame B9) — no blank strip above any title, in both apps — and the shared
 * Header's optional second line (frame B1).
 *
 * What these pin:
 *   - the helper: the phone's real top inset plus a small gap; nothing when the status bar is
 *     opaque (inset 0); the gap alone if a title is ever drawn outside a safe-area provider
 *   - the shared Header starts at that inset, not at a hard-coded 50, and is otherwise the bar
 *     it always was for every screen that does not pass `subtitle`
 *   - `subtitle`: one mono-caps grey line, one text node, cut with … — and the bar no taller
 *   - every main page and shell that used to hard-code 52–54 now asks the helper
 *
 * jest cannot see a status bar. That the title really sits under it on a phone is the walk's
 * job (expected-outputs check 4a).
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { Text, StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
let mockNoProvider = false;
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children, ...rest }) => mockReact.createElement(View, { testID: 'safe-area-provider', ...rest }, children),
    useSafeAreaInsets: () => {
      // What the real library does when no SafeAreaProvider is above the caller.
      if (mockNoProvider) throw new Error('No safe area value available. Make sure you are rendering `<SafeAreaProvider>` at the top of your app.');
      return mockInsets;
    },
  };
});
jest.mock('../../services/api', () => ({ brandApi: {}, influencerApi: {}, referenceApi: {} }));

const useTopInset = require('../useTopInset').default;
const { topInsetOf, TOP_GAP, TOP_GAP_TITLE, TopInsetProvider, START_METRICS } = require('../useTopInset');
const { Header, s: base } = require('../../screens/brand/BrandPitchSettingsScreen');
const { settingsTokens: T, fonts } = require('../../theme/tokens');

const flat = (node) => StyleSheet.flatten(node.props.style) || {};
const setInset = (top) => { mockInsets = { top, bottom: 0, left: 0, right: 0 }; };

beforeEach(() => { setInset(0); mockNoProvider = false; });

describe('topInsetOf / useTopInset', () => {
  it('the gaps are small: 4 above a bar with a back button, 8 above a bare title', () => {
    expect([TOP_GAP, TOP_GAP_TITLE]).toEqual([4, 8]);
  });

  it('opaque status bar (inset 0) → only the gap; edge-to-edge → the inset plus the gap', () => {
    expect(topInsetOf({ top: 0 })).toBe(4);
    expect(topInsetOf({ top: 0 }, TOP_GAP_TITLE)).toBe(8);
    expect(topInsetOf({ top: 28 })).toBe(32);
    expect(topInsetOf({ top: 44.5 }, TOP_GAP_TITLE)).toBe(52.5);
  });

  it('missing, junk or negative insets count as none — never NaN, never a negative padding', () => {
    for (const bad of [null, undefined, {}, { top: undefined }, { top: 'abc' }, { top: NaN }, { top: -12 }, { top: Infinity }]) {
      expect([bad, topInsetOf(bad)]).toEqual([bad, 4]);
    }
  });

  function Probe({ gap }) { const top = useTopInset(gap); return <Text testID="probe">{String(top)}</Text>; }

  it('the hook reads the phone\'s inset', () => {
    expect(render(<Probe />).getByTestId('probe').props.children).toBe('4');
    setInset(31);
    expect(render(<Probe />).getByTestId('probe').props.children).toBe('35');
    expect(render(<Probe gap={TOP_GAP_TITLE} />).getByTestId('probe').props.children).toBe('39');
  });

  it('outside a provider the library throws — the hook falls back to the gap instead of taking the screen down', () => {
    mockNoProvider = true;
    expect(render(<Probe />).getByTestId('probe').props.children).toBe('4');
    expect(render(<Probe gap={TOP_GAP_TITLE} />).getByTestId('probe').props.children).toBe('8');
  });
});

describe('TopInsetProvider — the one provider above every title', () => {
  it('starts from a zero inset, so the first frame is already right under an opaque status bar', () => {
    expect(START_METRICS.insets).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(typeof START_METRICS.frame.width).toBe('number');
    expect(typeof START_METRICS.frame.height).toBe('number');
    expect(START_METRICS.frame.width).toBeGreaterThan(0);
  });

  it('hands those metrics to the safe-area provider and draws what is inside it', () => {
    const r = render(<TopInsetProvider><Text>inside</Text></TopInsetProvider>);
    expect(r.getByTestId('safe-area-provider').props.initialMetrics).toBe(START_METRICS);
    r.getByText('inside');
  });

  it('both apps are wrapped in it, sheet host included', () => {
    for (const file of ['BrandNavigator.js', 'InfluencerNavigator.js']) {
      const src = fs.readFileSync(path.resolve(__dirname, '..', '..', 'navigation', file), 'utf8');
      expect(src).toMatch(/import \{ TopInsetProvider \} from '\.\.\/hooks\/useTopInset'/);
      const body = src.slice(src.indexOf('<TopInsetProvider>'), src.indexOf('</TopInsetProvider>'));
      expect(body).toMatch(/<Tab\.Navigator /);
      expect(body).toMatch(/<PendingSheetHost \/>/);
    }
  });
});

describe('the shared Header — no blank strip', () => {
  it('on a phone with an opaque status bar the bar starts 4 points down, not 50', () => {
    const bar = render(<Header title="Add creators" onBack={() => {}} />).toJSON();
    expect(flat(bar).paddingTop).toBe(4);
    expect(flat(bar).paddingBottom).toBe(10);
    expect(StyleSheet.flatten(base.header).paddingTop).toBe(TOP_GAP);
  });

  it('on an edge-to-edge phone it clears the status bar: inset + 4', () => {
    setInset(36);
    expect(flat(render(<Header title="Add creators" onBack={() => {}} />).toJSON()).paddingTop).toBe(40);
  });

  it('without `subtitle` it is the bar it always was: back, one title that flexes, the right slot', () => {
    const onBack = jest.fn();
    const r = render(<Header title="Terms · Priya Sharma" onBack={onBack} right={<Text>R</Text>} />);
    const bar = r.toJSON();
    expect(bar.children).toHaveLength(3);
    const [back, title, right] = bar.children;
    expect(back.props.accessibilityLabel).toBe('Back');
    expect(title.type).toBe('Text');
    expect(title.children).toEqual(['Terms · Priya Sharma']);
    expect(title.props.numberOfLines).toBe(1);
    expect(flat(title)).toMatchObject({ flex: 1, fontSize: 17, color: T.ink });
    expect(right.children[0].children).toEqual(['R']);
    expect(r.queryByTestId('header-subtitle')).toBeNull();
    fireEvent.press(r.getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('the shared Header — the optional second line (frame B1)', () => {
  const LINE = 'DIWALI EDIT 2026 · SET A · ETHNIC WEAR';

  it('draws the title and, under it, the line as ONE text node exactly as given', () => {
    const r = render(<Header title="Add creators" subtitle={LINE} onBack={() => {}} />);
    r.getByText('Add creators');
    const sub = r.getByText(LINE);
    expect(sub.props.testID).toBe('header-subtitle');
    expect(r.getByTestId('header-subtitle').props.children).toBe(LINE);
  });

  it('is small, mono, caps and grey; one line, cut with … when long', () => {
    const long = 'A very long campaign name that will never fit on one line · Set with a long name · Ethnic wear';
    const sub = render(<Header title="Add creators" subtitle={long} onBack={() => {}} />).getByTestId('header-subtitle');
    expect(sub.props.numberOfLines).toBe(1);
    expect(sub.props.ellipsizeMode).toBe('tail');
    expect(StyleSheet.flatten(sub.props.style)).toMatchObject({
      fontFamily: fonts.monoMedium, textTransform: 'uppercase', color: T.ink3, fontSize: 10,
    });
  });

  it('the title block flexes and may shrink, the title stays one line, and the bar grows by no more than the one line', () => {
    const bar = render(<Header title="Add creators" subtitle={LINE} onBack={() => {}} right={<Text>R</Text>} />).toJSON();
    expect(bar.children).toHaveLength(3);
    const [back, block, right] = bar.children;
    expect(flat(block)).toMatchObject({ flex: 1, minWidth: 0 });
    const [title, sub] = block.children;
    expect(title.props.numberOfLines).toBe(1);
    expect(flat(title).fontSize).toBe(17);
    // two lines of text are no taller than the 40-high back button beside them, so the bar keeps its height
    expect(flat(title).lineHeight + flat(sub).lineHeight).toBeLessThanOrEqual(flat(back).height);
    expect(right.children[0].children).toEqual(['R']);
    // and the strip rule holds here too
    expect(flat(bar).paddingTop).toBe(4);
  });

  it('`subtitleTestID` names the line for a screen that already has a testID to keep', () => {
    const r = render(<Header title="Add creators" subtitle={LINE} subtitleTestID="pick-subline" onBack={() => {}} />);
    expect(r.getByTestId('pick-subline').props.children).toBe(LINE);
    expect(r.queryByTestId('header-subtitle')).toBeNull();
  });

  it('an empty subtitle is no subtitle', () => {
    for (const empty of ['', null, undefined]) {
      const r = render(<Header title="Add creators" subtitle={empty} onBack={() => {}} />);
      expect(r.queryByTestId('header-subtitle')).toBeNull();
      expect(r.toJSON().children[1].type).toBe('Text');
    }
  });
});

describe('the main pages and shells ask the helper too', () => {
  const ComingSoonScreen = require('../../components/shell/ComingSoonScreen').default;

  it('ComingSoon (the Home tab once approved): title 8 points down on an opaque status bar, inset + 8 edge to edge', () => {
    const props = { navigation: { navigate: jest.fn() }, route: { params: { kind: 'brandHome', tabTitle: 'Home' } } };
    expect(StyleSheet.flatten(render(<ComingSoonScreen {...props} />).getByText('Home').props.style).paddingTop).toBe(8);
    setInset(30);
    expect(StyleSheet.flatten(render(<ComingSoonScreen {...props} />).getByText('Home').props.style).paddingTop).toBe(38);
  });

  // Every file that used to hard-code a 50–54 band above its title. Read as source, like the
  // other guards in this codebase: the band must come from the helper, and the number must be gone.
  const SRC = path.resolve(__dirname, '..', '..');
  const FILES = [
    'screens/brand/BrandPitchSettingsScreen.js',     // the shared Header (≈86 importers)
    'components/brand/ScreenHeader.js',
    'components/shell/PendingHomeScreen.js',
    'components/shell/ComingSoonScreen.js',
    'screens/brand/BrandCampaignsScreen.js',
    'screens/brand/BrandCreatorsScreen.js',
    'screens/brand/BrandWalletScreen.js',
    'screens/brand/BrandProfileScreen.js',
    'screens/influencer/CollabsScreen.js',
    'screens/influencer/CreatorWalletScreen.js',
    'screens/influencer/ProfileScreen.js',
    'screens/create/CreateHomeScreen.js',
  ];

  it.each(FILES)('%s takes its top band from useTopInset and hard-codes none', (rel) => {
    const src = fs.readFileSync(path.join(SRC, rel), 'utf8');
    expect(src).toMatch(/import useTopInset(, \{ [A-Z_, ]+ \})? from '(\.\.\/)+hooks\/useTopInset'/);
    expect(src).toMatch(/useTopInset\(/);
    expect(src).toMatch(/paddingTop: top\b/);
    expect(src.match(/paddingTop:\s*[3-9]\d\b/g)).toBeNull();
  });

  // 50, 52 and 54 were the old band's values; a new one of that size is the strip coming back.
  it('no brand, creator, shared, create, wallet or shell screen is left with the old 50–56 point band', () => {
    const dirs = ['screens/brand', 'screens/influencer', 'screens/shared', 'screens/create', 'screens/wallet', 'components/shell', 'components/brand'];
    const left = [];
    let scanned = 0;
    for (const d of dirs) {
      for (const f of fs.readdirSync(path.join(SRC, d))) {
        if (!f.endsWith('.js')) continue;
        scanned += 1;
        const src = fs.readFileSync(path.join(SRC, d, f), 'utf8');
        src.split('\n').forEach((line, i) => { if (/paddingTop:\s*5[0-6]\b/.test(line)) left.push(`${d}/${f}:${i + 1}`); });
      }
    }
    expect(scanned).toBeGreaterThan(100);
    expect(left).toEqual([]);
  });
});
