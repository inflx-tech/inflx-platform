/**
 * ui-walk-fixes — final review, finding C-3 (board C rule 1 + the 17 September lesson: a refusal
 * must appear where the person is looking).
 *
 * Board C put every main button in a strip that sits directly above the keypad, so pressing it
 * with the keypad open is now the ordinary way to work — and with the keypad open only 270–420
 * points of a form are on show. When the button's own check fails, the red line is drawn under its
 * own box, which may be out of sight: "Send to Tanvi" pressed while typing what to bring, with the
 * name left empty, changed nothing she could see. The pop-ups were given a scroll to the refused
 * box in this build's review round (drift C2, finding 1); the screens were not.
 *
 * The brand's two forms with more than one refusable box now do the same, with the same helper
 * (useSheetReveal): the red line STAYS under its own box, nothing is said twice, and the form is
 * scrolled to the first box that was refused, top to bottom. A box already on show is not moved.
 *   · Plan the visit      — who to ask for, their number, Date / Time, what to bring
 *   · Terms for a creator — fee, commission, what she sells, deliverables, note, re-use places
 * (New set does it too — finding A-1, proved in item4Brand.test.js.)
 *
 * jest has no layout, so each test supplies the phone's answers by hand, as popupsAboveKeypad
 * does for the pop-ups. Whether the scroll lands well on a real phone is for the walk.
 */
import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  brandApi: {
    getShoot: jest.fn(), sendShootPlan: jest.fn(),
    checkEligibility: jest.fn(), offerChoices: jest.fn(), productsWithoutOffersForSet: jest.fn(), getListingTree: jest.fn(),
  },
  influencerApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => cb(), [cb]); } }));

const { brandApi } = require('../../../services/api');
const BrandShootPlanScreen = require('../BrandShootPlanScreen').default;
const BrandCreatorTermsScreen = require('../BrandCreatorTermsScreen').default;
const { MSG10 } = require('../../../components/shoot/copy10');
const { MSG5 } = require('../../../components/invitations/copy5');
const draft = require('../../../components/invitations/draft5');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });
const flat = (node) => StyleSheet.flatten(node.props.style) || {};

// Thursday 1 October 2026, 3:20 pm in India — so the picker has days to offer before 24 Oct.
const NOW = new Date('2026-10-01T09:50:00.000Z');
// React reports a badly built tree (a hook out of order, a clash of keys) only on console.error.
let errorSpy;
beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.clearAllMocks();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errorSpy.mock.calls.map((args) => args.map(String).join(' ').split('\n')[0]);
  errorSpy.mockRestore();
  jest.useRealTimers();
  expect(said).toEqual([]);
});

/**
 * The phone's answers, by hand: the form starts 80 down the screen (status bar and title row), is
 * `room` tall (what is left above the button strip — and above the keypad when it is open) and is
 * scrolled to `scrolledTo`; each named block is { top, height } inside the form's content.
 * Returns the form's scrollTo, to see where the screen moved itself.
 */
function onAPhone(r, form, { room, scrolledTo = 0, blocks }) {
  form.getInnerViewRef = () => ({ _nativeTag: 7 });
  form.getNativeScrollRef = () => null;
  form.measureInWindow = (cb) => cb(0, 80, 360, room);
  form.scrollTo = jest.fn();
  for (const [id, { top, height }] of Object.entries(blocks)) {
    const block = r.UNSAFE_getAllByType(View).find((v) => v.props.testID === id).instance;
    block.measureLayout = (relativeTo, done) => done(18, top, 324, height);
    block.measureInWindow = (cb) => cb(18, 80 + top - scrolledTo, 324, height);
  }
  return form.scrollTo;
}

/* ───────────────────────────────────────────────────────────── Plan the visit */

describe('Plan the visit — "Send to Tanvi" refused: the form goes to the first box it refused', () => {
  const SHOOT = {
    stage: 'not_sent', mode: 'visit', setName: 'Set A', postingDate: '2026-10-24',
    creator: { name: 'Tanvi Suresh' }, brand: { name: 'Urban Threads' },
    branchNow: { name: 'Banjara Hills', address: 'Road No. 12, Banjara Hills, Hyderabad' },
    contactPrefill: { phone: '+919849011223' },
  };
  // The form as the styles lay it out, with each red line showing: the crumb and the locked card,
  // then the boxes. About 860 tall; "what to bring" is the last box.
  const BLOCKS = {
    'contact-name-field': { top: 186, height: 127 },
    'contact-phone-field': { top: 313, height: 148 },
    'plan-picker-field': { top: 461, height: 95 },
    'notes-field': { top: 691, height: 150 },
  };
  // Typing "what to bring" with the keypad open on a 640-point phone: 280 of room, the last box in it.
  const TYPING_THE_NOTE = { room: 280, scrolledTo: 579, blocks: BLOCKS };

  async function planScreen(shoot = SHOOT) {
    brandApi.getShoot.mockResolvedValue(ok({ shoot }));
    const r = render(<BrandShootPlanScreen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 's1', ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('brand-shoot-plan'));
    return r;
  }
  const form = (r) => r.UNSAFE_getAllByType(ScrollView).find((s) => s.props.testID === 'plan-form').instance;
  const pickDay = (r, day) => { fireEvent.press(r.getByTestId('pick-date')); fireEvent.press(r.getByTestId(`day-${day}`)); };
  const pickTime = (r, id) => { fireEvent.press(r.getByTestId('pick-time')); fireEvent.press(r.getByTestId(`time-${id}`)); };

  it('the name left empty, pressed while typing what to bring: the name box and its red line are brought back into view', async () => {
    const r = await planScreen();
    pickDay(r, '2026-10-18'); pickTime(r, '11-00');
    fireEvent.changeText(r.getByTestId('notes'), 'Bring the festive edit.');
    const scrollTo = onAPhone(r, form(r), TYPING_THE_NOTE);
    fireEvent.press(r.getByTestId('send-to'));
    expect(r.queryByTestId('send-plan-sheet')).toBeNull();
    // The red line is under its own box, once, and nowhere near the button.
    expect(within(r.getByTestId('contact-name-field')).getByText(MSG10.CONTACT_NAME)).toBeTruthy();
    expect(r.getAllByText(MSG10.CONTACT_NAME)).toHaveLength(1);
    expect(within(r.getByTestId('plan-actions')).queryByText(MSG10.CONTACT_NAME)).toBeNull();
    // The name block's top, less 6 of air, on the form's top edge.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 180, animated: true });
  });

  it('Date and Time skipped, pressed while typing what to bring: the two boxes and "Choose a date and time." come back into view', async () => {
    const r = await planScreen();
    fireEvent.changeText(r.getByTestId('contact-name'), 'Ravi Menon');
    const scrollTo = onAPhone(r, form(r), TYPING_THE_NOTE);
    fireEvent.press(r.getByTestId('send-to'));
    expect(within(r.getByTestId('plan-picker-field')).getByText(MSG10.TIME_REQUIRED)).toBeTruthy();
    expect(r.getAllByText(MSG10.TIME_REQUIRED)).toHaveLength(1);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 455, animated: true });
  });

  it('Date and Time skipped, pressed while typing the name at the top: the pair, below the fold, comes up with its red line', async () => {
    const r = await planScreen();
    fireEvent.changeText(r.getByTestId('contact-name'), 'Ravi Menon');
    const scrollTo = onAPhone(r, form(r), { room: 280, scrolledTo: 100, blocks: BLOCKS });
    fireEvent.press(r.getByTestId('send-to'));
    expect(within(r.getByTestId('plan-picker-field')).getByText(MSG10.TIME_REQUIRED)).toBeTruthy();
    // The pair's bottom edge (and 6 of air) on the form's bottom edge: 461 + 95 + 6 - 280.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 282, animated: true });
  });

  it('everything wrong at once: the uppermost box, the name, is the one shown; then the number; then the time', async () => {
    const r = await planScreen({ ...SHOOT, contactPrefill: null });
    let scrollTo = onAPhone(r, form(r), TYPING_THE_NOTE);
    fireEvent.press(r.getByTestId('send-to'));
    r.getByText(MSG10.CONTACT_NAME); r.getByText(MSG10.CONTACT_PHONE); r.getByText(MSG10.TIME_REQUIRED);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 180, animated: true });

    fireEvent.changeText(r.getByTestId('contact-name'), 'Ravi Menon');
    scrollTo = onAPhone(r, form(r), TYPING_THE_NOTE);
    fireEvent.press(r.getByTestId('send-to'));
    expect(within(r.getByTestId('contact-phone-field')).getByText(MSG10.CONTACT_PHONE)).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 307, animated: true });

    fireEvent.changeText(r.getByTestId('contact-phone'), '9849011223');
    scrollTo = onAPhone(r, form(r), TYPING_THE_NOTE);
    fireEvent.press(r.getByTestId('send-to'));
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 455, animated: true });
  });

  it('keypad closed and the refused box on show: the red line is where she is looking, and nothing moves', async () => {
    const r = await planScreen();
    pickDay(r, '2026-10-18'); pickTime(r, '11-00');
    const scrollTo = onAPhone(r, form(r), { room: 600, scrolledTo: 0, blocks: BLOCKS });
    fireEvent.press(r.getByTestId('send-to'));
    expect(within(r.getByTestId('contact-name-field')).getByText(MSG10.CONTACT_NAME)).toBeTruthy();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('nothing wrong: the confirm pop-up opens and the form is left where she had it', async () => {
    const r = await planScreen();
    fireEvent.changeText(r.getByTestId('contact-name'), 'Ravi Menon');
    pickDay(r, '2026-10-18'); pickTime(r, '11-00');
    const scrollTo = onAPhone(r, form(r), TYPING_THE_NOTE);
    fireEvent.press(r.getByTestId('send-to'));
    expect(within(r.getByTestId('confirm-time')).getByText('18 Oct, 11:00 am')).toBeTruthy();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('the boxes are where they were: each marked box holds exactly its own field, adds no space, and the order is the same', async () => {
    const r = await planScreen();
    for (const id of Object.keys(BLOCKS)) expect(flat(r.getByTestId(id))).toEqual({});
    within(r.getByTestId('contact-name-field')).getByTestId('contact-name');
    within(r.getByTestId('contact-phone-field')).getByTestId('contact-phone');
    within(r.getByTestId('plan-picker-field')).getByTestId('plan-picker');
    within(r.getByTestId('notes-field')).getByTestId('notes');
    const order = ['locked-card', 'contact-name', 'contact-phone', 'plan-picker', 'dates-hint', 'duration', 'notes'];
    const host = r.UNSAFE_getAllByType(ScrollView).find((s) => s.props.testID === 'plan-form');
    expect(host.findAll((n) => typeof n.type === 'string' && order.includes(n.props.testID)).map((n) => n.props.testID)).toEqual(order);
    // The hint under the pair and the "how long" box are not inside any marked box.
    for (const id of Object.keys(BLOCKS)) {
      expect(within(r.getByTestId(id)).queryByTestId('dates-hint')).toBeNull();
      expect(within(r.getByTestId(id)).queryByTestId('duration')).toBeNull();
    }
  });
});

/* ─────────────────────────────────────────────────────── Terms for a creator */

describe('Terms for a creator — "Next creator" refused: the form goes to the first box it refused', () => {
  const yr = new Date(NOW).getFullYear();
  const SET = { id: 'sA', campaignId: 'c1', name: 'Set A · Ethnic wear', state: 'live', goal: 'conversion', shootMode: 'visit',
    branch: { id: 'b1', name: 'Banjara Hills', cityName: 'Hyderabad' }, postingDate: `${yr}-10-20`, cutoff: `${yr}-10-17`, daysToCutoff: 4, cutoffPassed: false };
  const ROUTE = { params: { campaignId: 'c1', setId: 'sA', index: 0 } };

  beforeEach(() => {
    draft.clearDraft('sA');
    brandApi.checkEligibility.mockResolvedValue(ok({ results: [] }));
    brandApi.offerChoices.mockResolvedValue(ok({ posting_date: `${yr}-10-20`, offers: [], hidden: [] }));
    brandApi.productsWithoutOffersForSet.mockResolvedValue(ok({ posting_date: `${yr}-10-20`, products: [] }));
    brandApi.getListingTree.mockResolvedValue(ok({ tree: [] }));
  });

  async function terms(goal, t = {}) {
    draft.startDraft('sA', { set: { ...SET, goal }, campaignName: 'Diwali Edit 2026', creators: [{ id: 'p', name: 'Priya Sharma' }, { id: 's', name: 'Sneha N.' }], sourceGroupId: null });
    draft.setTerms('sA', 'p', { ...draft.defaultTerms(goal), ...t });
    const n = nav();
    const r = render(<BrandCreatorTermsScreen navigation={n} route={ROUTE} />);
    await waitFor(() => expect(brandApi.checkEligibility).toHaveBeenCalled());
    return { r, n };
  }
  const form = (r) => r.UNSAFE_getAllByType(ScrollView)[0].instance;

  // Pay for Content, as the styles lay it out with each red line showing: the step line and the
  // locked set card, then the boxes.
  const CONTENT = {
    'fee-field': { top: 210, height: 140 },
    'deliverables-field': { top: 350, height: 130 },
    'note-field': { top: 480, height: 170 },
  };
  const SALE = {
    'commission-field': { top: 210, height: 110 },
    'sell-field': { top: 334, height: 196 },
  };

  it('Pay for Content with the fee empty, pressed while typing the note: the Fee box and "Add a fee." are brought back into view', async () => {
    const { r, n } = await terms('engagement');
    fireEvent.changeText(r.getByTestId('note'), 'Shoot the festive edit in daylight.');
    // 270 of room above the keypad; the note box is the one on show, the Fee box is above the top edge.
    const scrollTo = onAPhone(r, form(r), { room: 270, scrolledTo: 380, blocks: CONTENT });
    fireEvent.press(r.getByTestId('terms-next'));
    expect(n.push).not.toHaveBeenCalled();
    expect(within(r.getByTestId('fee-field')).getByText(MSG5.FEE_REQUIRED)).toBeTruthy();
    expect(r.getAllByText(MSG5.FEE_REQUIRED)).toHaveLength(1);
    expect(within(r.getByTestId('terms-bar')).queryByText(MSG5.FEE_REQUIRED)).toBeNull();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 204, animated: true });
  });

  it('Pay for Sale with nothing to sell, pressed while typing the commission: the "choose what she sells" box under it comes up', async () => {
    const { r, n } = await terms('conversion');
    fireEvent.changeText(r.getByTestId('commission'), '10');
    const scrollTo = onAPhone(r, form(r), { room: 270, scrolledTo: 150, blocks: SALE });
    fireEvent.press(r.getByTestId('terms-next'));
    expect(n.push).not.toHaveBeenCalled();
    expect(within(r.getByTestId('sell-field')).getByTestId('sell-error')).toBeTruthy();
    expect(r.queryByText(MSG5.COMMISSION_REQUIRED)).toBeNull();
    // The block's bottom edge — the red box is the last thing in it — on the form's bottom edge: 334 + 196 + 6 - 270.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 266, animated: true });
  });

  it('Pay for Sale with the commission empty as well: the commission, the upper of the two, is the one shown', async () => {
    const { r } = await terms('conversion');
    const scrollTo = onAPhone(r, form(r), { room: 270, scrolledTo: 320, blocks: SALE });
    fireEvent.press(r.getByTestId('terms-next'));
    expect(within(r.getByTestId('commission-field')).getByText(MSG5.COMMISSION_REQUIRED)).toBeTruthy();
    r.getByTestId('sell-error');
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 204, animated: true });
  });

  it('Hybrid with a ₹0 fee and no commission: the fixed fee, drawn above the commission, is the one shown', async () => {
    const { r } = await terms('hybrid', { fee: '0' });
    const scrollTo = onAPhone(r, form(r), { room: 270, scrolledTo: 420, blocks: {
      'fee-field': { top: 210, height: 150 },
      'commission-field': { top: 360, height: 110 },
      'sell-field': { top: 484, height: 196 },
    } });
    fireEvent.press(r.getByTestId('terms-next'));
    expect(within(r.getByTestId('fee-field')).getByText(MSG5.HYBRID_FEE)).toBeTruthy();
    expect(within(r.getByTestId('commission-field')).getByText(MSG5.COMMISSION_REQUIRED)).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 204, animated: true });
  });

  it('Pay for Content with re-use switched on and no place chosen: that block, drawn only then, is the one shown', async () => {
    // Item 21: Pay for Content also needs what she posts about — the Entire store here, so only the place is missing.
    const { r, n } = await terms('engagement', { fee: '8000', sellMode: 'store' });
    fireEvent(r.getByTestId('usage-switch'), 'valueChange', true);
    const scrollTo = onAPhone(r, form(r), { room: 500, scrolledTo: 0, blocks: { ...CONTENT, 'usage-field': { top: 720, height: 110 } } });
    fireEvent.press(r.getByTestId('terms-next'));
    expect(n.push).not.toHaveBeenCalled();
    expect(within(r.getByTestId('usage-field')).getByText(MSG5.USAGE_PLACE)).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 336, animated: true });     // 720 + 110 + 6 - 500
  });

  it('Pay for Content with every line removed: the chooser, with its own red line under it, is the one shown', async () => {
    const { r } = await terms('engagement', { fee: '8000', deliverables: [] });
    const scrollTo = onAPhone(r, form(r), { room: 270, scrolledTo: 380, blocks: CONTENT });
    fireEvent.press(r.getByTestId('terms-next'));
    expect(within(r.getByTestId('deliverables-field')).getByText(MSG5.DELIVERABLES_EMPTY)).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 344, animated: true });
  });

  it('keypad closed and the refused box on show: nothing moves', async () => {
    const { r } = await terms('engagement');
    const scrollTo = onAPhone(r, form(r), { room: 600, scrolledTo: 0, blocks: CONTENT });
    fireEvent.press(r.getByTestId('terms-next'));
    expect(within(r.getByTestId('fee-field')).getByText(MSG5.FEE_REQUIRED)).toBeTruthy();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('terms with nothing wrong go on to the next creator and the form is left where she had it', async () => {
    const { r, n } = await terms('engagement', { fee: '8000', sellMode: 'store' });     // item 21: something to post about
    const scrollTo = onAPhone(r, form(r), { room: 270, scrolledTo: 380, blocks: CONTENT });
    fireEvent.press(r.getByTestId('terms-next'));
    expect(n.push).toHaveBeenCalledWith('BrandCreatorTerms', { campaignId: 'c1', setId: 'sA', index: 1 });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('the node the form is scrolled with is the very one the deliverables chooser was given (one ScrollView, both users)', async () => {
    const { r } = await terms('engagement', { fee: '' });
    const scrollTo = onAPhone(r, form(r), { room: 270, scrolledTo: 380, blocks: CONTENT });
    const body = form(r);
    body.measureInWindow = jest.fn();
    fireEvent.press(r.getByTestId('deliverables-add'));
    fireEvent(r.getByTestId('deliverables-list'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 324, height: 220 } } });
    expect(body.measureInWindow).toHaveBeenCalledTimes(1);        // the chooser asked THIS scroller where it is
    expect(body.scrollTo).toBe(scrollTo);
  });

  it('the boxes are where they were: a marked box is the field\'s own box (or a plain one round it) and adds no space', async () => {
    const { r } = await terms('engagement', { fee: '8000', usage: { on: true, durationDays: 30, places: [] } });
    expect(flat(r.getByTestId('fee-field'))).toEqual({ marginBottom: 14 });          // the Field's own box, as before
    expect(flat(r.getByTestId('deliverables-field'))).toEqual({ marginBottom: 14 });
    expect(flat(r.getByTestId('note-field'))).toEqual({});
    expect(flat(r.getByTestId('usage-field'))).toEqual({});
    within(r.getByTestId('fee-field')).getByTestId('fee');
    within(r.getByTestId('deliverables-field')).getByTestId('deliverables-add');
    within(r.getByTestId('note-field')).getByTestId('note');
    within(r.getByTestId('usage-field')).getByTestId('place-ads');
    expect(within(r.getByTestId('note-field')).queryByTestId('usage-switch')).toBeNull();
    r.unmount();

    const sale = await terms('conversion');
    expect(flat(sale.r.getByTestId('commission-field'))).toEqual({ marginBottom: 14 });
    expect(flat(sale.r.getByTestId('sell-field'))).toEqual({});
    within(sale.r.getByTestId('sell-field')).getByTestId('sell-offers');
    within(sale.r.getByTestId('sell-field')).getByTestId('sell-products');
    // The read-only shoppable-posts row is not part of the box that is scrolled to.
    expect(within(sale.r.getByTestId('sell-field')).queryByTestId('shoppable-row')).toBeNull();
    sale.r.getByTestId('shoppable-row');
  });
});
