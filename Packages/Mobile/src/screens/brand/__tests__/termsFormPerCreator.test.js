/**
 * Terms for a creator — the form on screen is always the creator named in its title, and what it
 * saves is always hers. (ui-walk-fixes, review of slice C1a; the fault itself is older — item 5.)
 *
 * What went wrong. Review and send opens a creator's terms with
 * `navigation.navigate('BrandCreatorTerms', { index })`. The Terms screens are all one route name,
 * pushed one on top of the other (creator 1, creator 2, …). React Navigation does not look for
 * "the screen of creator 1": it goes back to the LAST Terms screen in the stack and hands it the
 * new index. So for anyone but the last creator the brand got the last creator's screen, retitled —
 * still holding the last creator's numbers — and Back or Next then saved those numbers onto the
 * creator in the title.
 *
 * A mocked `navigate` cannot show that, so this file mounts the two real screens in a real
 * native-stack inside a real NavigationContainer, registered the way BrandNavigator registers
 * them, and walks them as the brand does.
 *
 * Proved here:
 *   · a Terms screen that is handed another creator starts her form afresh from the draft
 *     (numbers, red lines, "Use these terms for everyone", the open pop-up);
 *   · a Terms screen that comes back into view shows what the draft holds for her NOW, when
 *     another screen changed it in the meantime (her second screen further up the stack, or
 *     "Use these terms for everyone" on a later creator);
 *   · typing that was never saved is not thrown away when nobody else touched her terms;
 *   · after "Remove N and send the rest" took a creator out of the draft, a Terms screen that
 *     comes back into view shows whoever stands at its place NOW, with her own numbers.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { Text } from 'react-native';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';

// The header package ships two PNGs that jest cannot parse from node_modules.
jest.mock('@react-navigation/elements/lib/commonjs/assets/back-icon.png', () => 1);
jest.mock('@react-navigation/elements/lib/commonjs/assets/back-icon-mask.png', () => 1);
// The real navigators read the frame and the insets from context, not only from the hook.
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
  brandApi: { checkEligibility: jest.fn(), sendInvitations: jest.fn(), offerChoices: jest.fn(), productsWithoutOffersForSet: jest.fn(), getListingTree: jest.fn() },
  influencerApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));

const { NavigationContainer, createNavigationContainerRef, StackActions } = require('@react-navigation/native');
const { createNativeStackNavigator } = require('@react-navigation/native-stack');
const { brandApi } = require('../../../services/api');
const BrandCreatorTermsScreen = require('../BrandCreatorTermsScreen').default;
const BrandReviewSendScreen = require('../BrandReviewSendScreen').default;
const { C5, MSG5 } = require('../../../components/invitations/copy5');
const draft = require('../../../components/invitations/draft5');

const yr = new Date().getFullYear();
const SET = { id: 'sA', campaignId: 'c1', name: 'Set A · Ethnic wear', state: 'live', goal: 'conversion', shootMode: 'visit',
  branch: { id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad' }, postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, daysToCutoff: 4, cutoffPassed: false };
const NAMES = { p: 'Priya Sharma', k: 'Kavya D.', d: 'Divya R.' };
const PARAMS = { campaignId: 'c1', setId: 'sA' };

/** Priya 10% on 40 products, Kavya 12% on 30, Divya 15% on 20 — three creators, three different sets of terms. */
const PRODUCTS = { p: 40, k: 30, d: 20 };
function startDraft(pct = { p: '10', k: '12', d: '15' }) {
  draft.startDraft('sA', { set: SET, campaignName: 'Diwali Edit 2026', creators: Object.keys(pct).map(id => ({ id, name: NAMES[id] })), sourceGroupId: null });
  for (const id of Object.keys(pct)) draft.setTerms('sA', id, { ...draft.defaultTerms('conversion'), commissionPct: pct[id], sellMode: 'all', sellAllCount: PRODUCTS[id] });
}
const pctOf = (id) => draft.getDraft('sA').terms[id].commissionPct;
const productsOf = (id) => draft.getDraft('sA').terms[id].sellAllCount;

const Stack = createNativeStackNavigator();
const Page = ({ route }) => <Text testID="page">{route.name}</Text>;
let ref;
/** The two real screens, registered as BrandNavigator registers them: a name and a component. */
function App() {
  return (
    <NavigationContainer ref={ref}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="BrandSetPickCreators" component={Page} />
        <Stack.Screen name="BrandCreatorTerms" component={BrandCreatorTermsScreen} />
        <Stack.Screen name="BrandReviewSend" component={BrandReviewSendScreen} />
        <Stack.Screen name="BrandSetDetail" component={Page} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/** The stack, bottom to top: "BrandCreatorTerms:0" is the Terms screen holding index 0. */
const stack = () => ref.getRootState().routes.map(r => (r.name === 'BrandCreatorTerms' ? `Terms:${r.params.index}` : r.name === 'BrandReviewSend' ? 'Review' : r.name));
const keys = () => ref.getRootState().routes.map(r => r.key);
/** The Terms screen on top (every screen in a stack stays mounted; the last one drawn is the one she sees). */
const top = (r) => within(r.getAllByTestId('creator-terms-conversion').pop());
const box = (r) => top(r).getByTestId('commission');
// Everything she does is awaited, so the screens' own look-ups (her minimums, Review's check) settle inside act().
const doing = (fn) => act(async () => { fn(); });
const press = (el) => doing(() => fireEvent.press(el));
const type = (r, text) => doing(() => fireEvent.changeText(box(r), text));
const everyone = (r) => doing(() => fireEvent(top(r).getByTestId('everyone-switch'), 'valueChange', true));
const open = (index) => doing(() => ref.navigate('BrandCreatorTerms', { ...PARAMS, index }));
const next = (r) => press(top(r).getByTestId('terms-next'));
const back = (r) => press(top(r).getByLabelText('Back'));

/** Picker → Priya → Kavya → Divya → Review and send, pressing the screens' own buttons. */
async function walkToReview() {
  const r = render(<App />);
  await open(0);
  await next(r); await next(r); await next(r);
  await waitFor(() => r.getByTestId('review-row-p'));
  expect(stack()).toEqual(['BrandSetPickCreators', 'Terms:0', 'Terms:1', 'Terms:2', 'Review']);
  return r;
}

let errorSpy;
beforeEach(() => {
  jest.useFakeTimers();   // a button's press fade and the toast's fade stay inside act()
  jest.clearAllMocks();
  draft.clearBasket('sA');
  draft.clearDraft('sA');
  brandApi.checkEligibility.mockResolvedValue({ success: true, data: { results: [] } });
  brandApi.offerChoices.mockResolvedValue({ success: true, data: { posting_date: `${yr}-10-20`, offers: [], hidden: [] } });
  brandApi.productsWithoutOffersForSet.mockResolvedValue({ success: true, data: { posting_date: `${yr}-10-20`, products: [] } });
  brandApi.getListingTree.mockResolvedValue({ success: true, data: { tree: [] } });
  ref = createNavigationContainerRef();
  // React reports a wrong hook order, a clash of keys and an update outside act() only here; every test must leave it silent.
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errorSpy.mock.calls.map(c => c.map(String).join(' ').split('\n')[0]);
  errorSpy.mockRestore();
  jest.useRealTimers();
  expect(said).toEqual([]);
});

describe('the test stack is the app\'s stack', () => {
  it('BrandNavigator registers the two screens by name and component, nothing more — as App() above does', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'navigation', 'BrandNavigator.js'), 'utf8');
    expect(src).toContain('<CampaignsStack.Screen name="BrandCreatorTerms" component={BrandCreatorTermsScreen} />');
    expect(src).toContain('<CampaignsStack.Screen name="BrandReviewSend" component={BrandReviewSendScreen} />');
  });

  it('walking forward: each creator has her own screen with her own numbers', async () => {
    startDraft();
    const r = render(<App />);
    await open(0);
    top(r).getByText(C5.terms.title('Priya Sharma')); expect(box(r).props.value).toBe('10');
    await next(r);
    top(r).getByText(C5.terms.title('Kavya D.')); expect(box(r).props.value).toBe('12');
    await next(r);
    top(r).getByText(C5.terms.title('Divya R.')); expect(box(r).props.value).toBe('15');
    top(r).getByText('Review and send');
    await next(r);
    await waitFor(() => r.getByTestId('review-row-p'));
    expect([pctOf('p'), pctOf('k'), pctOf('d')]).toEqual(['10', '12', '15']);
  });
});

describe('Review and send › a creator\'s row, when she is not the last creator', () => {
  it('opens HER terms: her name, her numbers — not the last creator\'s screen under her name', async () => {
    startDraft();
    const r = await walkToReview();
    const before = keys();
    await press(r.getByTestId('review-row-p'));
    // What React Navigation does with the same route name: the last Terms screen (Divya's) is
    // reused and handed index 0. That is the library's doing and is the reason for this file.
    expect(stack()).toEqual(['BrandSetPickCreators', 'Terms:0', 'Terms:1', 'Terms:0']);
    expect(keys()[3]).toBe(before[3]);
    top(r).getByText(C5.terms.title('Priya Sharma'));
    top(r).getByText('Creator 1 of 3');
    expect(box(r).props.value).toBe('10');                       // was 15 — Divya's
    top(r).getByText('Next creator');
  });

  it('Back from there saves nothing of the last creator\'s onto her', async () => {
    startDraft();
    const r = await walkToReview();
    await press(r.getByTestId('review-row-p'));
    await back(r);
    expect([pctOf('p'), pctOf('k'), pctOf('d')]).toEqual(['10', '12', '15']);   // was 15, 12, 15
  });

  it('"Next creator" from there saves nothing of the last creator\'s onto her, and what she changes is saved as hers', async () => {
    startDraft();
    const r = await walkToReview();
    await press(r.getByTestId('review-row-p'));
    await type(r, '11');
    await next(r);
    expect([pctOf('p'), pctOf('k'), pctOf('d')]).toEqual(['11', '12', '15']);
    expect([productsOf('p'), productsOf('k'), productsOf('d')]).toEqual([40, 30, 20]);   // was 20, 30, 20 — the rest of Divya's terms went with it
    // …and the walk goes on through the others, each with her own numbers, back to Review.
    top(r).getByText(C5.terms.title('Kavya D.')); expect(box(r).props.value).toBe('12');
    await next(r);
    top(r).getByText(C5.terms.title('Divya R.')); expect(box(r).props.value).toBe('15');
    await next(r);
    await waitFor(() => r.getByText('11% · 40 products at normal price'));
    expect([pctOf('p'), pctOf('k'), pctOf('d')]).toEqual(['11', '12', '15']);
  });

  it('the middle creator too', async () => {
    startDraft();
    const r = await walkToReview();
    await press(r.getByTestId('review-row-k'));
    expect(stack()).toEqual(['BrandSetPickCreators', 'Terms:0', 'Terms:1', 'Terms:1']);
    top(r).getByText(C5.terms.title('Kavya D.'));
    expect(box(r).props.value).toBe('12');
    await back(r);
    expect([pctOf('p'), pctOf('k'), pctOf('d')]).toEqual(['10', '12', '15']);
  });

  it('the last creator\'s row opens her own screen as she left it', async () => {
    startDraft();
    const r = await walkToReview();
    await press(r.getByTestId('review-row-d'));
    expect(stack()).toEqual(['BrandSetPickCreators', 'Terms:0', 'Terms:1', 'Terms:2']);
    top(r).getByText(C5.terms.title('Divya R.'));
    expect(box(r).props.value).toBe('15');
  });

  it('nothing of the last creator\'s form is carried over: the red lines and "Use these terms for everyone" start afresh', async () => {
    startDraft();
    const r = await walkToReview();
    // Back on Divya's own screen: a refused number leaves a red line, and the switch is turned on.
    await press(r.getByTestId('review-row-d'));
    top(r).getByText(C5.terms.title('Divya R.'));
    await type(r, '140');
    await next(r);
    top(r).getByText(MSG5.COMMISSION_RANGE);
    await everyone(r);
    expect(top(r).getByTestId('everyone-switch').props.value).toBe(true);
    // She is taken to Review without Back or Next being pressed, so none of that was saved…
    await doing(() => ref.navigate('BrandReviewSend', PARAMS));
    await waitFor(() => r.getByTestId('review-row-p'));
    expect([pctOf('p'), pctOf('k'), pctOf('d')]).toEqual(['10', '12', '15']);
    // …and Priya's row hands that very screen to Priya.
    await press(r.getByTestId('review-row-p'));
    top(r).getByText(C5.terms.title('Priya Sharma'));
    expect(box(r).props.value).toBe('10');                                   // not Divya's 140
    expect(top(r).queryByText(MSG5.COMMISSION_RANGE)).toBeNull();            // not Divya's red line
    expect(top(r).getByTestId('everyone-switch').props.value).toBe(false);   // not Divya's switch
    await type(r, '9');
    await back(r);
    // Only Priya changed. With Divya's switch still on, Back would have copied 9% to everyone.
    expect([pctOf('p'), pctOf('k'), pctOf('d')]).toEqual(['9', '12', '15']);
  });
});

describe('Review and send › Send, when a creator\'s terms do not pass the phone\'s own check', () => {
  it('sends her back to HER terms — her empty box, not the last creator\'s number — and what she types is saved as hers', async () => {
    startDraft({ p: '10', k: '12', d: '15' });
    const r = await walkToReview();
    // Priya's commission is taken out behind the screens' back (as an older draft could hold it).
    draft.setTerms('sA', 'p', { ...draft.getDraft('sA').terms.p, commissionPct: '' });
    await act(async () => { fireEvent.press(r.getByTestId('send-invitations')); });
    expect(brandApi.sendInvitations).not.toHaveBeenCalled();
    expect(stack()).toEqual(['BrandSetPickCreators', 'Terms:0', 'Terms:1', 'Terms:0']);
    top(r).getByText(C5.terms.title('Priya Sharma'));
    expect(box(r).props.value).toBe('');                         // was 15 — Divya's, which would then have been saved as Priya's
    await type(r, '9');
    await next(r);
    expect([pctOf('p'), pctOf('k'), pctOf('d')]).toEqual(['9', '12', '15']);
  });
});

describe('Review and send › "Fix them, or remove them and send the rest."', () => {
  it('the server refuses the FIRST creator\'s terms: her row opens her own terms; fixed and sent again, each creator goes out on her own terms', async () => {
    const WHY = 'Commission must be between 1% and 80%.';
    startDraft();
    const r = await walkToReview();
    brandApi.sendInvitations
      .mockResolvedValueOnce({ success: false, error: { code: 'VALIDATION_ERROR', message: WHY, details: { sent: 0, failures: [
        { influencerId: 'p', name: 'Priya Sharma', code: 'VALIDATION_ERROR', field: 'commission_pct', message: WHY, detail: null, label: null }] } } })
      .mockResolvedValueOnce({ success: true, data: { sent: 3, rows: [] } });
    await press(r.getByTestId('send-invitations'));
    await waitFor(() => r.getByTestId('failed-banner'));
    within(r.getByTestId('failed-banner')).getByText(C5.review.failedBody);       // "Fix them, …" — so fixing her must work
    await press(r.getByTestId('review-row-p'));
    top(r).getByText(C5.terms.title('Priya Sharma'));
    expect(box(r).props.value).toBe('10');
    await type(r, '11');
    await next(r); await next(r); await next(r);
    await waitFor(() => r.getByTestId('review-row-p'));
    await press(r.getByTestId('send-invitations'));
    await waitFor(() => expect(brandApi.sendInvitations).toHaveBeenCalledTimes(2));
    const sent = brandApi.sendInvitations.mock.calls[1][2].creators.map(c => [c.influencerId, c.terms.commissionPct, c.terms.productsWithoutOffers.mode]);
    // was p 11 with the rest of Divya's terms; left alone (Back), p would have gone out at 15
    expect(sent).toEqual([['p', 11, 'all'], ['k', 12, 'all'], ['d', 15, 'all']]);
    expect(stack().pop()).toBe('BrandSetDetail');
  });
});

describe('a Terms screen that comes back into view', () => {
  it('shows what the draft holds for her now: her first screen, after she was changed on the reused one further up', async () => {
    startDraft();
    const r = await walkToReview();
    await press(r.getByTestId('review-row-p'));
    await type(r, '11');
    await back(r);                                                     // saves Priya 11, lands on Kavya's screen
    expect(stack()).toEqual(['BrandSetPickCreators', 'Terms:0', 'Terms:1']);
    top(r).getByText(C5.terms.title('Kavya D.'));
    await back(r);                                                     // lands on Priya's FIRST screen, mounted since the start
    expect(stack()).toEqual(['BrandSetPickCreators', 'Terms:0']);
    top(r).getByText(C5.terms.title('Priya Sharma'));
    expect(box(r).props.value).toBe('11');                       // was 10 — what this screen held before she was changed
    await next(r);
    expect(pctOf('p')).toBe('11');                               // was 10 — the change was undone on Next
  });

  it('shows the terms copied onto her by "Use these terms for everyone" on a later creator', async () => {
    startDraft();
    const r = render(<App />);
    await open(0);
    await next(r);
    top(r).getByText(C5.terms.title('Kavya D.'));
    await everyone(r);
    await back(r);                                                     // saves Kavya and copies her terms to everyone
    expect([pctOf('p'), pctOf('k'), pctOf('d')]).toEqual(['12', '12', '12']);
    top(r).getByText(C5.terms.title('Priya Sharma'));
    expect(box(r).props.value).toBe('12');                       // was 10
    await next(r);
    expect(pctOf('p')).toBe('12');                               // was 10 — the copy was undone for her
  });

  it('keeps what she typed and never saved, when nobody else changed her terms', async () => {
    startDraft();
    const r = render(<App />);
    await open(0);
    await type(r, '13');
    // Something else comes over the screen without Back or Next being pressed (a notification, say)…
    await doing(() => ref.dispatch(StackActions.push('BrandSetDetail', {})));
    expect(pctOf('p')).toBe('10');
    await doing(() => ref.goBack());
    // …and her typing is still there.
    top(r).getByText(C5.terms.title('Priya Sharma'));
    expect(box(r).props.value).toBe('13');
  });

  it('a red line goes with the numbers it was about', async () => {
    startDraft();
    const r = render(<App />);
    await open(0);
    // Priya's screen is left with a refused number and its red line…
    await type(r, '140');
    await next(r);
    top(r).getByText(MSG5.COMMISSION_RANGE);
    expect(stack()).toEqual(['BrandSetPickCreators', 'Terms:0']);
    // …Kavya's screen is opened over it and her terms are copied to everyone…
    await doing(() => ref.dispatch(StackActions.push('BrandCreatorTerms', { ...PARAMS, index: 1 })));
    await everyone(r);
    await back(r);
    // …so Priya's screen now shows the copied number, and the line about 140 is gone with it.
    top(r).getByText(C5.terms.title('Priya Sharma'));
    expect(box(r).props.value).toBe('12');
    expect(top(r).queryByText(MSG5.COMMISSION_RANGE)).toBeNull();
  });
});

describe('after "Remove N and send the rest" took a creator out of the draft', () => {
  const SENTENCE = "Kavya isn't taking Pay for Sale collaborations.";
  it('the Terms screens underneath show whoever stands at their place now — never one creator\'s numbers under another\'s name', async () => {
    startDraft();
    const r = await walkToReview();
    brandApi.sendInvitations
      .mockResolvedValueOnce({ success: false, error: { code: 'VALIDATION_ERROR', message: SENTENCE, details: { sent: 0, failures: [
        { influencerId: 'k', name: 'Kavya D.', code: 'NOT_MATCHING', field: 'influencer_id', message: SENTENCE, detail: 'aim', label: 'Not taking Pay for Sale' }] } } })
      .mockResolvedValueOnce({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.' } });
    await press(r.getByTestId('send-invitations'));
    await waitFor(() => r.getByTestId('failed-banner'));
    // Kavya is taken out; the second try fails for a reason of its own, so she stays on Review.
    await press(r.getByTestId('remove-and-send'));
    await waitFor(() => expect(brandApi.sendInvitations).toHaveBeenCalledTimes(2));
    expect(draft.getDraft('sA').creators.map(c => c.id)).toEqual(['p', 'd']);
    expect(stack()).toEqual(['BrandSetPickCreators', 'Terms:0', 'Terms:1', 'Terms:2', 'Review']);

    // Back from Review. Nobody stands at place 2 any more, and the screen says so.
    await press(within(r.getByTestId('review-send')).getByLabelText('Back'));
    expect(stack()).toEqual(['BrandSetPickCreators', 'Terms:0', 'Terms:1', 'Terms:2']);
    r.getByText(MSG5.NOBODY_PICKED);

    // Back again. Place 1 was Kavya's screen; Divya stands there now — her form, her numbers.
    await press(r.getAllByLabelText('Back').pop());
    expect(stack()).toEqual(['BrandSetPickCreators', 'Terms:0', 'Terms:1']);
    top(r).getByText(C5.terms.title('Divya R.'));                // was "Terms · Kavya D." — a creator no longer in the draft
    top(r).getByText('Creator 2 of 2');
    expect(box(r).props.value).toBe('15');                       // was 12 — Kavya's
    top(r).getByText('Review and send');
    // Typing does not change whose form it is, and what is saved is saved as Divya's own.
    await type(r, '16');
    top(r).getByText(C5.terms.title('Divya R.'));
    await next(r);
    expect([pctOf('p'), pctOf('d')]).toEqual(['10', '16']);
    expect([productsOf('p'), productsOf('d')]).toEqual([40, 20]);   // was 40, 30 — Kavya's terms sent out as Divya's
  });
});
