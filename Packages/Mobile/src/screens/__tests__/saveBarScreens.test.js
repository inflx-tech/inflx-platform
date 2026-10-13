/**
 * ui-walk-fixes — board C on the eight screens that end in the shared Save strip.
 *
 * Before: SaveBar floated over the bottom of the form (and over the box being typed in once the
 * keypad opened), and each form carried 120–140 of empty space at its end just to scroll clear of
 * it. Now, on every one of the eight:
 *   · the column is title row → the box that holds the form → the Save strip, nothing floating;
 *   · the form is a FormScroll (fills the room, keeps taps alive, keeps the lines under the
 *     focused box in view);
 *   · the dead space at the end of the form is gone (the form's ordinary 18 padding remains);
 *   · the toast is drawn inside the box above the strip, 16 above the strip.
 * Nothing else on these screens is touched (U10) — their own test files still pass unchanged.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../../services/api', () => {
  const ok = (data) => ({ success: true, data });
  const states = [{ id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }] }];
  return {
    api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
    brandApi: {
      getPitchSettings: jest.fn().mockResolvedValue(ok({
        settings: {
          accepting: true, pausedAt: null, acceptedAims: ['conversion', 'engagement', 'hybrid'], acceptedModes: ['visit', 'shipment'],
          nicheCodes: null, minFollowersInstagram: null, minFollowersYoutube: null, minEngagementRate: null,
          languageCodes: null, cityIds: null, allowPastCreators: true,
        },
        openPitches: 0, blockedCount: 0,
      })),
      putPitchSettings: jest.fn(),
      getMe: jest.fn().mockResolvedValue(ok({ brand: {
        business_name: 'Urban Threads', about: 'Kurtas and more', contact_person: 'Anu', email: '', login_phone: '+919876543210',
        website_url: 'https://urbanthreads.in', instagram_handle: 'urbanthreads', sub_categories: ['WOMEN'], logo_url: null,
      } })),
      updateMe: jest.fn(),
      listBranches: jest.fn().mockResolvedValue(ok({ branches: [] })),
      createBranch: jest.fn(), updateBranch: jest.fn(),
      getLogoUploadUrl: jest.fn(), createLogoAsset: jest.fn(),
    },
    influencerApi: {
      getInvitationSettings: jest.fn().mockResolvedValue(ok({
        settings: {
          open: true, pausedAt: null, acceptedAims: ['conversion', 'engagement', 'hybrid'], acceptedModes: ['visit', 'shipment'],
          visitCityIds: [10], brandCategoryCodes: null, minFeeEngagement: null, minFeeHybrid: null, minCommissions: [],
        },
        blockedCount: 0,
      })),
      putInvitationSettings: jest.fn(),
      getMe: jest.fn().mockResolvedValue(ok({ influencer: {
        id: 'c1', full_name: 'Tanvi Suresh', bio: '', phone: '+919876543210', state_id: 1, city_id: 10, state_name: 'Telangana', city_name: 'Hyderabad',
        instagram_handle: 'tanvi', youtube_handle: '', niche: ['fashion'], niche_other: '', language: ['en'], user_status: 'approved',
      } })),
      updateMe: jest.fn(),
      getProfileImageUploadUrl: jest.fn(),
      getDeliveryAddress: jest.fn().mockResolvedValue(ok({ address: null, prefill: { name: 'Tanvi Suresh', phone: '9876543210', stateId: 1, cityId: 10, stateName: 'Telangana', cityName: 'Hyderabad' } })),
      saveDeliveryAddress: jest.fn(), removeDeliveryAddress: jest.fn(),
    },
    referenceApi: {
      creatorNiches: jest.fn().mockResolvedValue(ok({ items: [{ code: 'fashion', label: 'Fashion' }, { code: 'other', label: 'Other' }] })),
      languages: jest.fn().mockResolvedValue(ok({ items: [{ code: 'en', label: 'English' }, { code: 'te', label: 'Telugu' }] })),
      states: jest.fn().mockResolvedValue(ok({ items: states })),
      offeredStates: jest.fn().mockResolvedValue(ok({ items: states })),
      brandCategories: jest.fn().mockResolvedValue(ok({ items: [{ code: 'WOMEN', label: 'Women' }, { code: 'MEN', label: 'Men' }] })),
    },
    onAccountGate: () => () => {}, emitAccountGate: jest.fn(), clearSession: jest.fn(), uploadFile: jest.fn(),
  };
});
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => cb(), [cb]); },
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: jest.fn() }),
}));

const BrandPitchSettingsScreen = require('../brand/BrandPitchSettingsScreen').default;
const BrandBranchEditScreen = require('../brand/BrandBranchEditScreen').default;
const BrandBusinessDetailsScreen = require('../brand/BrandBusinessDetailsScreen').default;
const BrandLinksScreen = require('../brand/BrandLinksScreen').default;
const BrandSubCategoriesScreen = require('../brand/BrandSubCategoriesScreen').default;
const InvitationSettingsScreen = require('../influencer/InvitationSettingsScreen').default;
const NicheLanguagesScreen = require('../influencer/NicheLanguagesScreen').default;
const ProfileInfoScreen = require('../influencer/ProfileInfoScreen').default;
const DeliveryAddressScreen = require('../influencer/DeliveryAddressScreen').default;

const { revealTarget } = require('../../components/shell/FormScroll');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const flat = (node) => StyleSheet.flatten(node.props.style) || {};

// name · the screen · something that is only there once it has loaded · a text box on it (if any)
const SCREENS = [
  ['brand · Pitch settings', () => <BrandPitchSettingsScreen navigation={nav()} />, 'accepting-switch', 'min-ig'],
  ['brand · Add a branch', () => <BrandBranchEditScreen navigation={nav()} route={{ params: { branchCount: 0, mainBranch: null } }} />, 'branch-name', 'branch-pin'],
  ['brand · Business details', () => <BrandBusinessDetailsScreen navigation={nav()} route={{ params: {} }} />, 'field-name', 'field-email'],
  ['brand · Links', () => <BrandLinksScreen navigation={nav()} />, 'field-website', 'field-instagram'],
  ['brand · What you sell', () => <BrandSubCategoriesScreen navigation={nav()} />, 'sub-WOMEN', null],
  ['creator · Invitation settings', () => <InvitationSettingsScreen navigation={nav()} />, 'open-switch', 'fee-engagement'],
  ['creator · Niche and languages', () => <NicheLanguagesScreen navigation={nav()} />, 'niche-other', null],
  ['creator · Profile info', () => <ProfileInfoScreen navigation={nav()} route={{ params: {} }} />, 'field-name', 'field-youtube'],
  ['creator · Delivery address', () => <DeliveryAddressScreen navigation={nav()} />, 'addr-street', 'addr-note'],
];

/** [root, …, node] for the first node (document order) that matches. */
function pathTo(node, match, trail = []) {
  if (!node || typeof node === 'string') return null;
  const here = [...trail, node];
  if (match(node)) return here;
  for (const child of node.children || []) {
    const found = pathTo(child, match, here);
    if (found) return found;
  }
  return null;
}
const all = (node, match, out = []) => {
  if (!node || typeof node === 'string') return out;
  if (match(node)) out.push(node);
  (node.children || []).forEach(c => all(c, match, out));
  return out;
};

async function mount(make, ready) {
  const r = render(make());
  await waitFor(() => r.getByTestId(ready));
  return r;
}

describe.each(SCREENS)('%s', (name, make, ready, box) => {
  it('title row, then the form, then the Save strip — the strip is in the column, not floating', async () => {
    const r = await mount(make, ready);
    const root = r.toJSON();
    const trail = pathTo(root, n => n.type === 'RCTScrollView');
    // root → the box that holds the form → the form itself: the form is not buried any deeper.
    expect(trail).toHaveLength(3);
    const [, area, form] = trail;
    expect(flat(area)).toEqual({ flex: 1 });
    const kids = root.children;
    const at = kids.indexOf(area);
    // The strip is the very next thing in the column, a child of the screen itself.
    expect(kids[at + 1].props.testID).toBe('save-bar');
    expect(at).toBeGreaterThan(0);                     // the title row is above it
    // …and it is not inside the form, nor anywhere else a second time.
    expect(all(root, n => n.props && n.props.testID === 'save-bar')).toHaveLength(1);
    expect(pathTo(form, n => n.props && n.props.testID === 'save-bar')).toBeNull();

    const bar = flat(r.getByTestId('save-bar'));
    expect(bar.position).toBeUndefined();
    expect(bar.bottom).toBeUndefined();
    expect(bar).toMatchObject({ padding: 14, borderTopWidth: 1 });
  });

  it('the form is a FormScroll, and the empty space that cleared the floating bar is gone', async () => {
    const r = await mount(make, ready);
    const form = pathTo(r.toJSON(), n => n.type === 'RCTScrollView').pop();
    expect(flat(form)).toEqual({ flex: 1 });
    expect(form.props.keyboardShouldPersistTaps).toBe('handled');
    expect(typeof form.props.onFocus).toBe('function');
    expect(typeof form.props.onLayout).toBe('function');
    // The ordinary 18 all round; no 140 at the bottom.
    expect(StyleSheet.flatten(form.props.contentContainerStyle)).toEqual({ padding: 18 });
    // No empty spacer block left at the end of the form.
    const content = form.children[0];
    const spacers = (content.children || []).filter(c => typeof c !== 'string' && !c.children && (flat(c).height || 0) >= 100);
    expect(spacers).toEqual([]);
  });

  it('every control it had is still there', async () => {
    const r = await mount(make, ready);
    r.getByTestId('save-button');
    r.getByTestId(ready);
    if (box) r.getByTestId(box);
    expect(r.getByTestId('save-button').props.accessibilityState.disabled).toBe(true);   // nothing changed yet
  });

  if (box) {
    it('typing in a box near the end: the lines under it are brought into view above the strip', async () => {
      const r = await mount(make, ready);
      const scroll = r.UNSAFE_getAllByType(ScrollView)[0].instance;
      // The form's content on screen: the box is 640 down it and at 268 on screen, so it starts at -372.
      scroll.getInnerViewRef = () => ({ _nativeTag: 7, measureInWindow: (cb) => cb(0, -372, 360, 900) });
      scroll.getNativeScrollRef = () => null;
      scroll.measureInWindow = (cb) => cb(0, 54, 360, 260);        // the room left above the strip and the keypad
      scroll.scrollTo = jest.fn();
      const spy = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue({
        measureLayout: (rel, done) => done(18, 640, 324, 46),
        measureInWindow: (cb) => cb(18, 268, 324, 46),                // its bottom edge on the room's bottom edge
      });
      try {
        fireEvent(r.getByTestId(box), 'focus');
        // 640 + 46 + 64 - 260: the counter / hint / error lines under the box are now above the strip.
        expect(scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 490, animated: true });
      } finally {
        spy.mockRestore();
      }
    });
  }
});

/**
 * The State and City pickers are pop-ups WRITTEN inside the form (OfferedStateCityFields draws its
 * two sheets itself). React Native shows a pop-up in its own window, but keeps its content a child
 * of the form in the layout tree: the phone answers "36 in, 618 down the form" for the pop-up's
 * search box, and that box's focus reaches the form like any other. The form behind the pop-up
 * must stay where it is — she closes the pop-up and is still at State.
 */
describe.each([
  ['brand · Add a branch', () => <BrandBranchEditScreen navigation={nav()} route={{ params: { branchCount: 0, mainBranch: null } }} />, 'branch-name', 'branch-state', 'branch-state-search'],
  ['creator · Profile info', () => <ProfileInfoScreen navigation={nav()} route={{ params: {} }} />, 'field-name', 'field-state', 'field-state-search'],
])('%s — the State pop-up, written inside the form', (name, make, ready, opener, search) => {
  it('typing in the pop-up\'s search box does not move the form behind it', async () => {
    const r = await mount(make, ready);
    const scroll = r.UNSAFE_getAllByType(ScrollView)[0].instance;      // the form (taken before the pop-up's list exists)
    let content = { x: 0, y: 54 };                                     // the form is not scrolled
    scroll.getInnerViewRef = () => ({ _nativeTag: 7, measureInWindow: (cb) => cb(content.x, content.y, 360, 900) });
    scroll.getNativeScrollRef = () => null;
    scroll.measureInWindow = (cb) => cb(0, 54, 360, 260);
    scroll.scrollTo = jest.fn();

    fireEvent.press(r.getByTestId(opener));
    await waitFor(() => r.getByTestId(search));
    // The pop-up is written in an element 18 in and 328 down the form; its search box is at
    // (18, 290) in the pop-up's window. So the layout tree says (36, 618); the screen says (18, 290).
    const popupBox = {
      measureLayout: jest.fn((rel, done) => done(36, 618, 324, 42)),
      measureInWindow: jest.fn((cb) => cb(18, 290, 324, 42)),
    };
    const spy = jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(popupBox);
    try {
      fireEvent(r.getByTestId(search), 'focus');
      // The focus did reach the form, and the phone did not refuse the measurement…
      expect(popupBox.measureLayout).toHaveBeenCalledTimes(1);
      expect(popupBox.measureInWindow).toHaveBeenCalledTimes(1);
      // …the arithmetic alone would have moved the form (to 618 + 42 + 64 - 260)…
      expect(revealTarget({ top: 618, height: 42 }, { y: 54, height: 260 }, { y: 290, height: 42 })).toBe(464);
      // …and the form did not move.
      expect(scroll.scrollTo).not.toHaveBeenCalled();

      // The same answers for a box that IS where the form puts it do move it — the check is what
      // stopped it, not a broken test.
      content = { x: -18, y: -328 };
      fireEvent(r.getByTestId(search), 'focus');
      expect(scroll.scrollTo).toHaveBeenCalledWith({ x: 0, y: 464, animated: true });
    } finally {
      spy.mockRestore();
    }
  });
});

describe('the toast on a Save screen', () => {
  it('is drawn inside the box above the strip, 16 above the strip — not at the screen\'s root', async () => {
    const r = render(<BrandBusinessDetailsScreen navigation={nav()} route={{ params: { toast: 'Your login number is now +91 91234 56789.' } }} />);
    await waitFor(() => r.getByTestId('field-name'));
    await waitFor(() => r.getByTestId('toast'));
    const root = r.toJSON();
    const trail = pathTo(root, n => n.props && n.props.testID === 'toast');
    expect(trail).toHaveLength(3);
    const area = trail[1];
    expect(area.children.map(c => c.type)).toEqual(['RCTScrollView', 'View']);
    expect(root.children[root.children.indexOf(area) + 1].props.testID).toBe('save-bar');
    expect(flat(r.getByTestId('toast'))).toMatchObject({ position: 'absolute', left: 16, right: 16, bottom: 16 });
  });
});

describe('the source of every screen that draws <SaveBar', () => {
  const SRC = path.join(__dirname, '..', '..');
  const files = [];
  // "Draws it" = imports it (the two shared files only mention it in their comments).
  const importsSaveBar = /import \{[^}]*\bSaveBar\b[^}]*\} from '[^']*components\/settings\/feedback'/;
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== '__tests__' && entry.name !== 'node_modules') walk(full); }
      else if (entry.name.endsWith('.js') && importsSaveBar.test(fs.readFileSync(full, 'utf8'))) files.push(full);
    }
  }(SRC));
  const rel = (f) => path.relative(SRC, f).split(path.sep).join('/');

  // creator-address-bank-save added the ninth: the creator's Delivery address.
  it('is exactly these nine — a tenth must be built the same way and added here', () => {
    expect(files.map(rel).sort()).toEqual([
      'screens/brand/BrandBranchEditScreen.js',
      'screens/brand/BrandBusinessDetailsScreen.js',
      'screens/brand/BrandLinksScreen.js',
      'screens/brand/BrandPitchSettingsScreen.js',
      'screens/brand/BrandSubCategoriesScreen.js',
      'screens/influencer/DeliveryAddressScreen.js',
      'screens/influencer/InvitationSettingsScreen.js',
      'screens/influencer/NicheLanguagesScreen.js',
      'screens/influencer/ProfileInfoScreen.js',
    ]);
  });

  it.each(files.map(f => [rel(f), f]))('%s — FormArea › FormScroll + toast, then SaveBar; an in-flow toast; no dead bottom space', (name, file) => {
    const src = fs.readFileSync(file, 'utf8');
    expect(src).toMatch(/import \{ FormScroll, FormArea \} from '\.\.\/\.\.\/components\/shell\/FormScroll';/);
    expect(src).toContain('useToast({ inFlow: true })');
    expect(src).not.toMatch(/useToast\(\)/);
    // The order in the screen's own JSX: the form closes, the toast, the box closes, the strip.
    const closeForm = src.lastIndexOf('</FormScroll>');
    const toast = src.indexOf('{toast}', closeForm);
    const closeArea = src.lastIndexOf('</FormArea>');
    const bar = src.search(/<SaveBar[\s/>]/);
    expect(closeForm).toBeGreaterThan(-1);
    expect(toast).toBeGreaterThan(closeForm);
    expect(closeArea).toBeGreaterThan(toast);
    expect(bar).toBeGreaterThan(closeArea);
    // No plain ScrollView left as the body, and none of the old clearance.
    expect(src).not.toMatch(/<ScrollView[\s>]/);
    expect(src).not.toMatch(/paddingBottom:\s*1\d\d\b/);
    expect(src).not.toMatch(/<View style=\{\{ height: 1\d\d \}\} \/>/);
  });
});

describe('the shared pieces themselves', () => {
  const read = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
  it('SaveBar is built on BottomBar and has no floating style left', () => {
    const src = read('components', 'settings', 'feedback.js');
    expect(src).toMatch(/<BottomBar testID="save-bar">/);
    const styles = src.slice(src.indexOf('const fb = StyleSheet.create'));
    // The only absolute thing in the file is the toast.
    expect(styles.match(/position: 'absolute'/g)).toHaveLength(1);
    expect(styles).toMatch(/toast: \{ position: 'absolute', left: 16, right: 16, bottom: 110,/);
    expect(styles).toMatch(/toastInFlow: \{ bottom: 16 \}/);
  });
});
