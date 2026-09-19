/**
 * Item 3 — both tab navigators load with every screen they import. A missing file, a wrong
 * export name or a screen used without being imported has crashed the app natively three
 * times before; this catches the JS half of that before an OTA goes out.
 * Contract: features/item3-discovery-profiles-groups
 */
jest.mock('../../services/api', () => ({
  brandApi: {}, influencerApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
// The tab navigator package ships a PNG jest cannot parse; the navigator factories are not
// what this test checks — the screen imports behind them are.
const fakeNavigator = () => ({ Navigator: () => null, Screen: () => null });
jest.mock('@react-navigation/bottom-tabs', () => ({ createBottomTabNavigator: fakeNavigator }));
jest.mock('@react-navigation/native-stack', () => ({ createNativeStackNavigator: fakeNavigator }));
// The OTP screen reads the clipboard through a native module; under node there is none.
jest.mock('@react-native-clipboard/clipboard', () => ({ getString: jest.fn().mockResolvedValue('') }));

describe('item 3 navigators', () => {
  it('BrandNavigator and its screens import cleanly', () => {
    const mod = require('../BrandNavigator');
    expect(typeof mod.default).toBe('function');
    expect(typeof mod.tabScreenOptions).toBe('function');
  });
  it('InfluencerNavigator and its screens import cleanly', () => {
    const mod = require('../InfluencerNavigator');
    expect(typeof mod.default).toBe('function');
  });
  it('the deleted screens are gone', () => {
    expect(() => require('../../screens/shared/FindPartyScreen')).toThrow();
    expect(() => require('../../screens/brand/BrandPitchesPlaceholderScreen')).toThrow();
  });
  // features/registration-and-profile — the Waiting screen, Payment & tax and the Google place
  // search are retired; the auth stack must load without them.
  it('AuthNavigator loads with no Waiting screen; WaitingScreen, PaymentTaxScreen and PlaceSearchField are gone', () => {
    const mod = require('../AuthNavigator');
    expect(typeof mod.default).toBe('function');
    expect(() => require('../../screens/auth/WaitingScreen')).toThrow();
    expect(() => require('../../screens/influencer/PaymentTaxScreen')).toThrow();
    expect(() => require('../../components/discovery/PlaceSearchField')).toThrow();
  });
});
