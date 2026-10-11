/**
 * post-sent-done-button — "Done" on a post that is with INFLX (the creator app).
 * Contract: features/post-sent-done-button · 03-expected-outputs.md
 *
 * After "Send to INFLX for review" she lands on "With INFLX". The only way off it was the back
 * arrow, which walked her through Review and every step she made the post with. Now:
 *
 *   · a post in review has one main button, "Done"
 *   · Done opens the Home tab, and the Create tab is back on its own main page
 *   · the same button when she opens that post later; the back arrow still goes one screen back
 *   · opened with nothing under it (a notice into a tab never opened), Done still opens Home
 *   · a post that is sent back, approved, live or removed has no "Done"
 *
 * The navigators here are the real ones (bottom tabs over a native stack, as the creator app
 * nests them, with its own tab and screen names); only the other screens are stand-ins.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

// The header package ships two PNGs that jest cannot parse from node_modules.
jest.mock('@react-navigation/elements/lib/commonjs/assets/back-icon.png', () => 1);
jest.mock('@react-navigation/elements/lib/commonjs/assets/back-icon-mask.png', () => 1);
// The real tab bar reads the frame and the insets from context, not only from the hook.
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
jest.mock('../../../services/api', () => ({
  influencerApi: { getPost: jest.fn(), takeDownPost: jest.fn(), deletePost: jest.fn(), createPost: jest.fn(), createOwnPost: jest.fn(), postPlaces: jest.fn() },
  brandApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(), uploadContentFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));

const { NavigationContainer, createNavigationContainerRef } = require('@react-navigation/native');
const { createBottomTabNavigator } = require('@react-navigation/bottom-tabs');
const { createNativeStackNavigator } = require('@react-navigation/native-stack');
const { influencerApi } = require('../../../services/api');
const PostStatus = require('../PostStatusScreen').default;

const ok = (data) => ({ success: true, data });
const yr = new Date().getFullYear();
const COLLAB = { id: 'ci1', brand_id: 'b1', brand_name: 'Aveen fashion boutique and desiner studio', brand_logo: null, campaign_name: 'Sunrise sale', set_name: 'A', posting_date: `${yr}-10-17` };
const POST = (over = {}) => ({
  id: 'p1', state: 'in_review', status: 'submitted', title: 'Spider man x', caption: null, collaboration: COLLAB, kind: 'offer', offer_id: 'o1',
  submitted_at: `${yr}-10-10T09:00:00Z`, products: [], theme_tags: [], media: [], facets: {}, sent_back: null, removed: null,
  sales: { orders: 0, commission: 0 }, sales_words: 'No sales yet', can: {}, ...over,
});

const Page = ({ route }) => <Text testID="page">{route.name}</Text>;
const Tabs = createBottomTabNavigator();
const Create = createNativeStackNavigator();
const CreateStack = () => (
  <Create.Navigator screenOptions={{ headerShown: false }}>
    <Create.Screen name="CreateHome" component={Page} />
    <Create.Screen name="PostMedia" component={Page} />
    <Create.Screen name="PostReview" component={Page} />
    <Create.Screen name="PostStatus" component={PostStatus} />
  </Create.Navigator>
);

/** The creator app's nesting, opened on `first`. */
function mount(first = 'CreateTab') {
  const ref = createNavigationContainerRef();
  const r = render(
    <NavigationContainer ref={ref}>
      <Tabs.Navigator initialRouteName={first} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="HomeTab" component={Page} />
        <Tabs.Screen name="CreateTab" component={CreateStack} />
      </Tabs.Navigator>
    </NavigationContainer>,
  );
  return { ref, ...r };
}
/** Where the app is: the tab in front, and the Create tab's own stack from the bottom up. */
function where(ref) {
  const st = ref.getRootState();
  const create = st.routes.find((x) => x.name === 'CreateTab');
  return { tab: st.routes[st.index].name, create: create && create.state ? create.state.routes.map((x) => x.name) : null };
}
const go = (ref, ...args) => act(() => { ref.navigate(...args); });

let errors;
beforeEach(() => {
  jest.clearAllMocks();
  influencerApi.getPost.mockResolvedValue(ok({ post: POST() }));
  errors = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => errors.mockRestore());
const unhandled = () => errors.mock.calls.map((c) => String(c[0])).filter((m) => /was not handled by any navigator/.test(m));

describe('a post that is with INFLX', () => {
  it('after sending: one main button, "Done" — it opens Home, and the steps she made the post with are gone from the Create tab', async () => {
    const { ref, findByTestId, getByText, queryByTestId } = mount();
    // as the app goes: her posts › … › the last steps › "Send to INFLX for review"
    go(ref, 'PostMedia', { postId: 'p1' });
    go(ref, 'PostReview', { postId: 'p1' });
    go(ref, 'PostStatus', { postId: 'p1', justSent: true });
    expect(where(ref)).toEqual({ tab: 'CreateTab', create: ['CreateHome', 'PostMedia', 'PostReview', 'PostStatus'] });

    const done = await findByTestId('done');
    getByText('Done');
    getByText('In review since 10 Oct'); getByText('Usually within a day.');           // the screen above it is as it was
    getByText('As soon as INFLX approves it. Your last day to go live is 17 Oct.');

    await act(async () => { fireEvent.press(done); });
    expect(where(ref)).toEqual({ tab: 'HomeTab', create: ['CreateHome'] });             // it was back, back, back…
    expect(queryByTestId('done')).toBeNull();
    expect(unhandled()).toEqual([]);
    // the Create tab, tapped again: her posts — not "With INFLX", not a step
    go(ref, 'CreateTab');
    expect(where(ref)).toEqual({ tab: 'CreateTab', create: ['CreateHome'] });
  });

  it('opened later from her posts: the same button; the back arrow still goes one screen back', async () => {
    const { ref, findByTestId } = mount();
    go(ref, 'PostStatus', { postId: 'p1' });
    await findByTestId('done');
    act(() => { ref.goBack(); });
    expect(where(ref)).toEqual({ tab: 'CreateTab', create: ['CreateHome'] });

    go(ref, 'PostStatus', { postId: 'p1' });
    await act(async () => { fireEvent.press(await findByTestId('done')); });
    expect(where(ref)).toEqual({ tab: 'HomeTab', create: ['CreateHome'] });
  });

  it('opened from Home with her posts page under it (a Home row, a notice): Done goes back to Home', async () => {
    const { ref, findByTestId } = mount('HomeTab');
    go(ref, 'CreateTab', { screen: 'PostStatus', params: { postId: 'p1' }, initial: false });
    expect(where(ref)).toEqual({ tab: 'CreateTab', create: ['CreateHome', 'PostStatus'] });
    await act(async () => { fireEvent.press(await findByTestId('done')); });
    expect(where(ref)).toEqual({ tab: 'HomeTab', create: ['CreateHome'] });
    expect(unhandled()).toEqual([]);
  });

  it('opened with nothing under it: Done opens Home and asks the stack for nothing it cannot do', async () => {
    const { ref, findByTestId } = mount('HomeTab');
    go(ref, 'CreateTab', { screen: 'PostStatus', params: { postId: 'p1' } });
    expect(where(ref)).toEqual({ tab: 'CreateTab', create: ['PostStatus'] });
    await act(async () => { fireEvent.press(await findByTestId('done')); });
    expect(where(ref).tab).toBe('HomeTab');
    expect(unhandled()).toEqual([]);
  });
});

describe('every other state keeps its own buttons', () => {
  const cases = [
    ['sent back', POST({ state: 'sent_back', status: 'rejected', sent_back: { reason: 'The video has copyrighted music.', count: 1 }, can: { fix: true, delete: true } }), 'fix'],
    ['approved', POST({ state: 'approved', status: 'approved', can: { take_down: true } }), 'take-down'],
    ['live', POST({ state: 'live', status: 'approved', can: { take_down: true } }), 'take-down'],
    ['removed', POST({ state: 'removed', status: 'removed', removed: { reason: 'offer_ended', at: `${yr}-10-15T00:10:00Z`, why: 'The offer ended.' }, sales: { orders: 2, commission: 120 } }), 'removed'],
  ];
  it.each(cases)('%s: no "Done"', async (_name, post, own) => {
    influencerApi.getPost.mockResolvedValue(ok({ post }));
    const { ref, findByTestId, queryByTestId } = mount();
    go(ref, 'PostStatus', { postId: 'p1' });
    await findByTestId(`post-status-${post.state}`);
    await waitFor(() => findByTestId(own));
    expect(queryByTestId('done')).toBeNull();
  });
});
