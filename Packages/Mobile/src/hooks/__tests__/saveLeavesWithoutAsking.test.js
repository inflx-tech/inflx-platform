/**
 * creator-address-bank-save — Save saves and leaves; it never asks "Discard changes?".
 * Contract: features/creator-address-bank-save · 03-expected-outputs.md (S1–S4)
 *
 * What the founder saw (13 Oct 2026, Profile info in the creator app): he changed something, tapped
 * Save, and a box asked "Discard changes?" with Keep editing / Discard. Keep editing, Save again,
 * and only then did the screen close. The first tap HAD saved — the box was the "you have unsaved
 * changes" question, asked of a screen that had just saved, because the screen left before the
 * guard had been told the save was done.
 *
 * Every screen that guards its changes and leaves after saving had the same fault: six that were
 * live (two in the creator app, four in the brand app) and the new Delivery address screen is
 * held to the same rule.
 *
 * The navigator here is the real one (a native stack), so "leaving" is React Navigation's own
 * beforeRemove — the earlier tests of these screens used a stand-in navigation whose listener
 * never fired, which is how this was never caught.
 */
import React from 'react';
import { Alert, Text } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('@react-navigation/elements/lib/commonjs/assets/back-icon.png', () => 1);
jest.mock('@react-navigation/elements/lib/commonjs/assets/back-icon-mask.png', () => 1);
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 360, height: 760 };
  const Passthrough = ({ children, ...rest }) => mockReact.createElement(View, rest, children);
  return {
    SafeAreaProvider: Passthrough, SafeAreaView: Passthrough,
    SafeAreaInsetsContext: mockReact.createContext(insets), SafeAreaFrameContext: mockReact.createContext(frame),
    useSafeAreaInsets: () => insets, useSafeAreaFrame: () => frame, initialWindowMetrics: { insets, frame },
  };
});
jest.mock('../../services/api', () => {
  const ok = (data) => ({ success: true, data });
  const states = [{ id: 1, name: 'Telangana', cities: [{ id: 10, name: 'Hyderabad' }] }];
  return {
    api: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
    brandApi: {
      getMe: jest.fn().mockResolvedValue(ok({ brand: {
        business_name: 'Urban Threads', about: 'Kurtas and more', contact_person: 'Anu', email: '', login_phone: '+919876543210',
        website_url: 'https://urbanthreads.in', instagram_handle: 'urbanthreads', sub_categories: ['WOMEN'], logo_url: null,
      } })),
      updateMe: jest.fn().mockResolvedValue(ok({ brand: {} })),
      listBranches: jest.fn().mockResolvedValue(ok({ branches: [] })),
      createBranch: jest.fn(), updateBranch: jest.fn().mockResolvedValue(ok({ branch: {} })),
      getLogoUploadUrl: jest.fn(), createLogoAsset: jest.fn(),
    },
    influencerApi: {
      getMe: jest.fn().mockResolvedValue(ok({ influencer: {
        id: 'c1', full_name: 'Tanvi Suresh', bio: '', phone: '+919876543210', state_id: 1, city_id: 10, state_name: 'Telangana', city_name: 'Hyderabad',
        instagram_handle: 'tanvi', youtube_handle: '', niche: ['fashion'], niche_other: '', language: ['en'], user_status: 'pending',
      } })),
      updateMe: jest.fn().mockResolvedValue(ok({ influencer: {} })),
      getProfileImageUploadUrl: jest.fn(),
      getDeliveryAddress: jest.fn().mockResolvedValue(ok({ address: null, prefill: { name: 'Tanvi Suresh', phone: '9876543210', stateId: 1, cityId: 10, stateName: 'Telangana', cityName: 'Hyderabad' } })),
      saveDeliveryAddress: jest.fn().mockResolvedValue(ok({ address: {} })),
      removeDeliveryAddress: jest.fn(),
    },
    referenceApi: {
      creatorNiches: jest.fn().mockResolvedValue(ok({ items: [{ code: 'fashion', label: 'Fashion' }, { code: 'beauty', label: 'Beauty' }, { code: 'other', label: 'Other' }] })),
      languages: jest.fn().mockResolvedValue(ok({ items: [{ code: 'en', label: 'English' }, { code: 'te', label: 'Telugu' }] })),
      states: jest.fn().mockResolvedValue(ok({ items: states })),
      offeredStates: jest.fn().mockResolvedValue(ok({ items: states })),
      brandCategories: jest.fn().mockResolvedValue(ok({ items: [{ code: 'WOMEN', label: 'Women' }, { code: 'MEN', label: 'Men' }] })),
    },
    onAccountGate: () => () => {}, emitAccountGate: jest.fn(), clearSession: jest.fn(), uploadFile: jest.fn(),
  };
});
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));

const { NavigationContainer, createNavigationContainerRef } = require('@react-navigation/native');
const { createNativeStackNavigator } = require('@react-navigation/native-stack');

const Page = ({ route }) => <Text testID="page">{route.name}</Text>;
const Stack = createNativeStackNavigator();

/** `name` (the screen under test) opened on top of `home`, as the app's own stack has it. */
function open(name, Screen, home, params) {
  const ref = createNavigationContainerRef();
  const r = render(
    <NavigationContainer ref={ref}>
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={home}>
        <Stack.Screen name={home} component={Page} />
        <Stack.Screen name={name} component={Screen} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  act(() => { ref.navigate(name, params || {}); });
  return { r, ref, at: () => ref.getCurrentRoute().name };
}

const BRANCH = { id: 'b1', name: 'Main Branch', formattedAddress: 'Shop 12, Sri Sai Complex, Road No 3', landmark: '', phone: '9876543210', pincode: '500072', stateId: 1, cityId: 10, stateName: 'Telangana', cityName: 'Hyderabad', isMain: true };

// the screen · its route name · where Save takes it · the route params · what shows it has loaded · how to change something
const SCREENS = [
  ['creator · Profile info', () => require('../../screens/influencer/ProfileInfoScreen').default, 'ProfileInfo', 'ProfileMain', {}, 'field-name',
    (r) => fireEvent.changeText(r.getByTestId('field-name'), 'Tanvi S')],
  ['creator · Niche and languages', () => require('../../screens/influencer/NicheLanguagesScreen').default, 'NicheLanguages', 'ProfileMain', {}, 'lang-te',
    (r) => fireEvent.press(r.getByTestId('lang-te'))],
  ['creator · Delivery address', () => require('../../screens/influencer/DeliveryAddressScreen').default, 'DeliveryAddress', 'ProfileMain', {}, 'addr-street',
    (r) => { fireEvent.changeText(r.getByTestId('addr-street'), 'Flat 302, Sai Residency, Road No 3'); fireEvent.changeText(r.getByTestId('addr-pincode'), '500072'); }],
  ['brand · Business details', () => require('../../screens/brand/BrandBusinessDetailsScreen').default, 'BrandBusinessDetails', 'BrandProfile', {}, 'field-name',
    (r) => fireEvent.changeText(r.getByTestId('field-name'), 'Urban Threads Co')],
  ['brand · Links', () => require('../../screens/brand/BrandLinksScreen').default, 'BrandLinks', 'BrandProfile', {}, 'field-website',
    (r) => fireEvent.changeText(r.getByTestId('field-website'), 'https://urbanthreads.co')],
  ['brand · What you sell', () => require('../../screens/brand/BrandSubCategoriesScreen').default, 'BrandSubCategories', 'BrandProfile', {}, 'sub-MEN',
    (r) => fireEvent.press(r.getByTestId('sub-MEN'))],
  ['brand · Edit a branch', () => require('../../screens/brand/BrandBranchEditScreen').default, 'BrandBranchEdit', 'BrandBranches', { branch: BRANCH, branchCount: 1, mainBranch: BRANCH }, 'branch-name',
    (r) => fireEvent.changeText(r.getByTestId('branch-name'), 'KPHB Branch')],
];

describe.each(SCREENS)('%s', (label, load, name, home, params, ready, change) => {
  let alert;
  beforeEach(() => { alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {}); });
  afterEach(() => { alert.mockRestore(); });

  it('S1 · Save saves and closes the screen — no "Discard changes?"', async () => {
    const { r, at } = open(name, load(), home, params);
    await waitFor(() => r.getByTestId(ready));
    change(r);
    await waitFor(() => expect(r.getByTestId('save-button').props.accessibilityState?.disabled).not.toBe(true));
    fireEvent.press(r.getByTestId('save-button'));
    await waitFor(() => expect(at()).toBe(home));
    expect(alert).not.toHaveBeenCalled();
  });

  it('S2 · leaving with a change that was NOT saved still asks, and Keep editing stays', async () => {
    const { r, ref, at } = open(name, load(), home, params);
    await waitFor(() => r.getByTestId(ready));
    change(r);
    act(() => { ref.goBack(); });
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('Discard changes?');
    expect(at()).toBe(name);
  });

  it('S3 · Discard leaves without saving', async () => {
    const { r, ref, at } = open(name, load(), home, params);
    await waitFor(() => r.getByTestId(ready));
    change(r);
    act(() => { ref.goBack(); });
    const discard = alert.mock.calls[0][2].find((b) => b.text === 'Discard');
    act(() => { discard.onPress(); });
    await waitFor(() => expect(at()).toBe(home));
  });

  it('S4 · leaving with nothing changed asks nothing', async () => {
    const { r, ref, at } = open(name, load(), home, params);
    await waitFor(() => r.getByTestId(ready));
    act(() => { ref.goBack(); });
    await waitFor(() => expect(at()).toBe(home));
    expect(alert).not.toHaveBeenCalled();
  });
});
