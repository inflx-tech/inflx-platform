/**
 * ui-walk-fixes — final review, finding E-6 (BUILD_RULES rule 2: shared pieces change additively).
 *
 * The shared outline button (`SecondaryButton`, components/settings/primitives.js) used to accept
 * `disabled` and drop it. It is now honoured: no tap goes through and the button is drawn at 0.6.
 * That is a change in what EXISTING callers get — every caller that was already passing
 * `disabled`. There are exactly eight, all Remote-shoot pop-ups from item 11, none on any board
 * of this contract:
 *
 *   components/remote/sheets11.js      shoot-done · pickup · self-sent · cancel-booking · gift ·
 *                                      report · confirm-return          (their "Not yet" / "Keep it
 *                                      booked" / "Not now")
 *   screens/influencer/RemoteAddressScreen.js   the delivery-address confirm ("Not yet")
 *
 * Each passes `disabled={busy}`: the quiet button is off while the request runs, so the pop-up
 * cannot be closed under a request that is still out. It is what those callers asked for, and it
 * is recorded in 06-diff/drift/FINAL-components-hooks-navigation.md and listed for the walk.
 *
 * This file pins three things, so the record stays true:
 *   1. the list — a NINTH caller passing `disabled` fails here until it is added to the record;
 *   2. what each of the eight does while busy and at rest;
 *   3. the way out that is left: the seven sheets still close on a tap outside and on the phone's
 *      Back key; the delivery-address pop-up has no way out until the send ends.
 */
import React from 'react';
import { Modal, StyleSheet, TouchableOpacity } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
}));
jest.mock('../../../services/api', () => ({
  influencerApi: { myRemote: jest.fn(), myRemoteCoverage: jest.fn(), myRemoteAddress: jest.fn(), myRemoteCorrect: jest.fn() },
  brandApi: {},
  referenceApi: {
    offeredStates: jest.fn(() => Promise.resolve({
      success: true,
      data: { states: [{ id: 2, name: 'Andhra Pradesh', cities: [{ id: 7, name: 'Guntur' }] }] },
    })),
  },
}));

const fs = require('fs');
const path = require('path');
const api = require('../../../services/api');
const {
  ShootDoneSheet11, PickupDaySheet11, SelfSentSheet11, CancelBookingSheet11,
  ReturnToGiftSheet11, ReportSheet11, ConfirmReturnSheet11,
} = require('../sheets11');
const RemoteAddressScreen = require('../../../screens/influencer/RemoteAddressScreen').default;

const flat = (node) => StyleSheet.flatten(node.props.style) || {};
/**
 * The opacity a TouchableOpacity is fading to. React Native 0.81's test environment runs a
 * native-driver animation to its end without reporting the values back, so the drawn opacity
 * reads 1 throughout; the target is the button's own style, which is what the phone shows once
 * the 250 ms fade has run: TouchableOpacity fades to its own style's opacity (its _opacityInactive).
 */
const fadingTo = (r, testID) => {
  const t = r.UNSAFE_getAllByType(TouchableOpacity).find((n) => n.props.testID === testID);
  return (StyleSheet.flatten(t && t.props.style) || {}).opacity;
};
const noop = () => {};

/* ───────────────────────────────────────────────────────────── 1 · the list */

const SRC = path.resolve(__dirname, '..', '..', '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__' || e.name === 'node_modules' || e.name === '__fixtures__') continue;
      walk(p, out);
    } else if (e.name.endsWith('.js')) out.push(p);
  }
  return out;
}

/** Every `<SecondaryButton … />` written in a file, whole, however many lines it runs over. */
function secondaryButtons(source) {
  const found = [];
  let from = 0;
  for (;;) {
    const at = source.indexOf('<SecondaryButton', from);
    if (at < 0) break;
    // The tag ends at the first `>` that is not inside { } (an arrow function's `=>` is).
    let depth = 0;
    let end = at;
    for (let i = at; i < source.length; i += 1) {
      const c = source[i];
      if (c === '{') depth += 1;
      else if (c === '}') depth -= 1;
      else if (c === '>' && depth === 0) { end = i; break; }
    }
    found.push(source.slice(at, end + 1));
    from = end + 1;
  }
  return found;
}

/** The eight, as recorded: file → the testIDs of its outline buttons that pass `disabled`. */
const RECORDED = {
  'components/remote/sheets11.js': [
    'shoot-done-cancel', 'pickup-cancel', 'self-sent-cancel', 'cancel-booking-cancel',
    'gift-cancel', 'report-cancel', 'confirm-return-cancel',
  ],
  'screens/influencer/RemoteAddressScreen.js': ['sheet-cancel'],
};

describe('the outline button now obeys `disabled`: the callers that already passed it', () => {
  it('are exactly the eight recorded Remote-shoot pop-ups, each as `disabled={busy}`', () => {
    const seen = {};
    let all = 0;
    for (const file of walk(SRC)) {
      for (const tag of secondaryButtons(fs.readFileSync(file, 'utf8'))) {
        all += 1;
        if (!/\bdisabled\b/.test(tag)) continue;
        const rel = path.relative(SRC, file).split(path.sep).join('/');
        const id = (tag.match(/testID="([^"]+)"/) || [])[1] || tag;
        (seen[rel] = seen[rel] || []).push(id);
        // Each of them is off only while its own request runs — never off for good.
        expect(tag).toMatch(/\bdisabled=\{busy\}/);
      }
    }
    expect(all).toBeGreaterThan(40);                 // the scan really reads the app's outline buttons
    expect(seen).toEqual(RECORDED);
  });

  it('the scan sees a button written over several lines, and one whose handler holds an arrow', () => {
    const tags = secondaryButtons([
      '<View>',
      '  <SecondaryButton label="A" onPress={() => { close(); }}',
      '    disabled={busy} testID="a" />',
      '  <SecondaryButton label="B" onPress={onClose} testID="b" />',
      '</View>',
    ].join('\n'));
    expect(tags).toHaveLength(2);
    expect(tags[0]).toMatch(/disabled=\{busy\}/);
    expect(tags[0]).toMatch(/testID="a"/);
    expect(tags[1]).not.toMatch(/disabled/);
  });
});

/* ─────────────────────────────────────────── 2 + 3 · the seven sheets of item 11 */

const LINES = [{ id: 'l1', name: 'Rust kurta', quantity: 1 }];
const SHEETS = [
  ['shoot-done', (p) => <ShootDoneSheet11 visible brandName="Urban Threads" count={1} dueDate="2026-11-27" onConfirm={noop} {...p} />],
  ['pickup', (p) => <PickupDaySheet11 visible brandName="Urban Threads" today="2026-10-02" onBook={noop} {...p} />],
  ['self-sent', (p) => <SelfSentSheet11 visible brandName="Urban Threads" pincode="522998" onSend={noop} {...p} />],
  ['cancel-booking', (p) => <CancelBookingSheet11 visible amount={200} onConfirm={noop} {...p} />],
  ['gift', (p) => <ReturnToGiftSheet11 visible line={{ name: 'Rust kurta' }} creatorName="Tanvi" onConfirm={noop} {...p} />],
  ['report', (p) => <ReportSheet11 visible kind="difference" onConfirm={noop} {...p} />],
  ['confirm-return', (p) => <ConfirmReturnSheet11 visible lines={LINES} autoConfirmDueAt="2026-10-20" onConfirm={noop} {...p} />],
];

describe('the seven Remote-shoot sheets: the quiet button while the request runs', () => {
  it('the table below is the seven recorded for sheets11.js', () => {
    expect(SHEETS.map(([id]) => `${id}-cancel`)).toEqual(RECORDED['components/remote/sheets11.js']);
  });

  it.each(SHEETS)('%s — at rest it closes the sheet; while busy it is greyed and takes no tap', (id, sheet) => {
    const onClose = jest.fn();
    const rest = render(sheet({ onClose }));
    const quiet = rest.getByTestId(`${id}-cancel`);
    expect(quiet.props.accessibilityState).toEqual({ disabled: false });
    expect(flat(quiet).opacity).toBe(1);
    fireEvent.press(quiet);
    expect(onClose).toHaveBeenCalledTimes(1);
    rest.unmount();

    onClose.mockClear();
    const busy = render(sheet({ onClose, busy: true }));
    const off = busy.getByTestId(`${id}-cancel`);
    expect(off.props.accessibilityState).toEqual({ disabled: true });      // a real boolean (Android)
    expect(flat(off).opacity).toBe(0.6);
    fireEvent.press(off);
    fireEvent.press(off);
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each(SHEETS)('%s — while busy the sheet still closes on a tap outside it and on the phone\'s Back key', (id, sheet) => {
    const onClose = jest.fn();
    const r = render(sheet({ onClose, busy: true }));
    fireEvent.press(r.getByLabelText('Close'));                            // the dimmed area above the sheet
    expect(onClose).toHaveBeenCalledTimes(1);
    r.UNSAFE_getByType(Modal).props.onRequestClose();                      // Back
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

/* ─────────────────────────────────────── 2 + 3 · the delivery-address confirm (R4a) */

describe('her delivery address: the confirm pop-up while the address is being sent', () => {
  const HER_ROUTE = { params: { ciId: 'ci1' } };
  const SHOOT = {
    invitationId: 'ci1', brand: { name: 'Kanchi Silks' }, creator: { name: 'Tanvi Suresh' },
    stage: 'not_sent', address: null, can: { sendAddress: true },
    prefill: { name: 'Tanvi Suresh', phone: '9876511111', stateId: 2, cityId: 7 },
  };

  async function reviewOpen(navigation) {
    api.influencerApi.myRemote.mockResolvedValue({ success: true, data: { shoot: SHOOT } });
    const r = render(<RemoteAddressScreen navigation={navigation} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-address')).toBeTruthy());
    fireEvent.changeText(r.getByTestId('f-street'), '11 Gandhi Road');
    fireEvent.changeText(r.getByTestId('f-pincode'), '522002');
    fireEvent.press(r.getByTestId('review-send'));
    await waitFor(() => expect(r.getByTestId('confirm-sheet')).toBeTruthy());
    return r;
  }

  beforeEach(() => { jest.clearAllMocks(); });

  it('at rest "Not yet" closes the pop-up and nothing is sent', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const r = await reviewOpen(navigation);
    expect(r.getByTestId('sheet-cancel').props.accessibilityState).toEqual({ disabled: false });
    fireEvent.press(r.getByTestId('sheet-cancel'));
    expect(r.queryByTestId('confirm-sheet')).toBeNull();
    expect(api.influencerApi.myRemoteAddress).not.toHaveBeenCalled();
  });

  it('while the send runs "Not yet" is greyed and takes no tap — the pop-up stays until the answer comes, then the screen moves on', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    let settle;
    api.influencerApi.myRemoteAddress.mockReturnValue(new Promise((res) => { settle = res; }));
    const r = await reviewOpen(navigation);
    fireEvent.press(r.getByTestId('sheet-send'));
    await waitFor(() => expect(r.getByTestId('sheet-cancel').props.accessibilityState).toEqual({ disabled: true }));
    await waitFor(() => expect(fadingTo(r, 'sheet-cancel')).toBe(0.6));                  // the fade to grey takes a moment
    fireEvent.press(r.getByTestId('sheet-cancel'));
    fireEvent.press(r.getByTestId('sheet-cancel'));
    expect(r.getByTestId('confirm-sheet')).toBeTruthy();                   // still there: nothing else closes it
    // This pop-up is drawn on the screen itself, not in a Modal: there is no "tap outside".
    expect(r.UNSAFE_queryAllByType(Modal).filter((m) => m.props.visible)).toHaveLength(0);
    expect(r.queryByLabelText('Close')).toBeNull();
    fireEvent.press(r.getByTestId('sheet-send'));                          // a second tap sends nothing more
    expect(api.influencerApi.myRemoteAddress).toHaveBeenCalledTimes(1);

    settle({ success: true, data: { shoot: SHOOT } });
    await waitFor(() => expect(navigation.navigate).toHaveBeenCalledWith('MyRemote', { ciId: 'ci1', toast: 'Address sent.' }));
    expect(r.queryByTestId('confirm-sheet')).toBeNull();
  });

  it('a refused send gives the button back: the pop-up closes and the form can be corrected', async () => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    api.influencerApi.myRemoteAddress.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', field: 'street', message: 'Add a house or flat number.' } });
    const r = await reviewOpen(navigation);
    // React 19 (React Native 0.81): the refused answer is let land inside act(), so the screen's
    // response to it has been drawn before it is checked. What is checked is unchanged.
    await act(async () => { fireEvent.press(r.getByTestId('sheet-send')); });
    await waitFor(() => expect(r.queryByTestId('confirm-sheet')).toBeNull());
    expect(r.getByTestId('f-street-error').props.children).toBe('Add a house or flat number.');
    expect(navigation.navigate).not.toHaveBeenCalled();
    // Opened again, "Not yet" is live again.
    fireEvent.changeText(r.getByTestId('f-street'), 'Flat 302, 11 Gandhi Road');
    fireEvent.press(r.getByTestId('review-send'));
    await waitFor(() => expect(r.getByTestId('confirm-sheet')).toBeTruthy());
    expect(r.getByTestId('sheet-cancel').props.accessibilityState).toEqual({ disabled: false });
  });
});
