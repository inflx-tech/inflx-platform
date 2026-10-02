/**
 * ui-walk-fixes — board C, slice C2 (frames C5 → C6 / C7; point 3 of the founder's walk, check 10).
 *
 * A pop-up that held a text box kept its full length when the keypad opened, so its note box and
 * its main button slid underneath. Every such pop-up — and every list pop-up whose Apply button
 * went under the keypad while searching — now takes the shared Sheet's shrinking shape:
 *
 *   · the sheet can be no taller than the room between the status bar and the keypad;
 *   · what she types in is in the BODY, which scrolls (or, for a list, gives way);
 *   · the button(s) are in the FOOTER, pinned under the body, so they sit above the keypad.
 *
 * jest has no keypad and no window, so what is pinned here is the structure that makes that
 * layout work, sheet by sheet, plus every behaviour that moved with it. That a Modal's window
 * really ends at the keypad is proved in components/settings/__tests__/sheetFit.test.js's notes
 * and on a phone (the walk).
 */
import React from 'react';
import { FlatList, Keyboard, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { render, fireEvent, waitFor, within, act } from '@testing-library/react-native';

jest.mock('../../services/api', () => ({
  brandApi: { groupsForCreator: jest.fn(), createGroup: jest.fn(), setGroupsForCreator: jest.fn() },
  influencerApi: {},
  referenceApi: { offeredStates: jest.fn() },
  clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { brandApi } = require('../../services/api');
const { settingsTokens: T } = require('../../theme/tokens');
const { Sheet, PickerSheet, ConfirmSheet, ActionSheet } = require('../settings/sheets');
const StateCityPicker = require('../settings/StateCityPicker').default;
const { SinglePickSheet } = require('../registration/OfferedStateCityFields');
const FiltersSheet = require('../discovery/FiltersSheet').default;
const { GroupNameSheet, AddToGroupSheet } = require('../discovery/GroupSheets');
const { TextSheet4, BranchSheet4, DuplicateSheet4 } = require('../campaigns/sheets4');
const { DeclineSheet5, TermsSentSheet5 } = require('../invitations/sheets5');
const { BrandCounterSheet6, DeclineCounterSheet6, CounterChoiceSheet6, MoveConfirmSheet6 } = require('../negotiation/sheets6');
const { CreatorSignSheet7, BrandSignSheet7, DeclineAgreementSheet7, SendAgreementSheet7, WithdrawAgreementSheet7 } = require('../agreement/sheets7');
const { RejectPitchSheet8, WithdrawPitchSheet8, AcceptPitchSheet8 } = require('../pitch/sheets8');
const { SendPlanSheet10 } = require('../shoot/sheets10');
const { SelfSentSheet11, ConfirmReturnSheet11, ShootDoneSheet11, CancelBookingSheet11, ReportSheet11, PickupDaySheet11, ReturnToGiftSheet11 } = require('../remote/sheets11');
const { ChangesSheet12, NoteSheet12, ReportSheet12, SendSheet12 } = require('../content/sheets12');
const { ReportSheet14, DestinationSheet14 } = require('../sale/sheets14');
const { MSG4 } = require('../campaigns/copy4');
const { MSG5 } = require('../invitations/copy5');
const { MSG7 } = require('../agreement/copy7');
const { C3 } = require('../discovery/copy3');

// A press starts TouchableOpacity's fade; with real timers it lands after the test and warns about
// act(). React reports a badly built tree only through console.error — every test must leave it silent.
let errorSpy;
beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const said = errorSpy.mock.calls.map((args) => args.map(String).join(' ').split('\n')[0]);
  errorSpy.mockRestore();
  jest.useRealTimers();
  expect(said).toEqual([]);
});

const flat = (node) => StyleSheet.flatten(node.props.style) || {};
const box = (node) => { const { opacity, ...rest } = flat(node); return rest; };
const noop = () => {};

/**
 * The shrinking shape, as one question: the sheet may shrink, the body is a scroller (or, for a
 * list sheet, a plain box that gives way), and — when the sheet has buttons — they are pinned in a
 * footer that is outside the body. Returns the two parts to look inside.
 */
function parts(r, id, { list = false } = {}) {
  expect(flat(r.getByTestId(id))).toMatchObject({ flexShrink: 1, maxHeight: '100%' });
  const body = r.getByTestId(`${id}-body`);
  expect(body.type).toBe(list ? 'View' : 'RCTScrollView');
  if (!list) expect(body.props.keyboardShouldPersistTaps).toBe('handled');
  const footer = r.queryByTestId(`${id}-footer`);
  return { body: within(body), footer: footer ? within(footer) : null };
}
/** What is typed in is in the body; every button is in the footer and NOT in the body. */
function expectPinned(r, id, { inBody = [], inFooter = [], list = false }) {
  const { body, footer } = parts(r, id, { list });
  for (const t of inBody) expect(body.getByTestId(t)).toBeTruthy();
  for (const t of inFooter) {
    expect(footer.getByTestId(t)).toBeTruthy();
    expect(body.queryByTestId(t)).toBeNull();
  }
  return { body, footer };
}
/** A sheet left in the old shape: a box as tall as its content, no scrolling body, no footer. */
function expectOldShape(r, id) {
  expect(flat(r.getByTestId(id)).flexShrink).toBeUndefined();
  expect(flat(r.getByTestId(id)).maxHeight).toBeUndefined();
  expect(r.queryByTestId(`${id}-body`)).toBeNull();
  expect(r.queryByTestId(`${id}-footer`)).toBeNull();
}
/** The drawn button a label sits in (for a button that carries no testID). */
function buttonOf(label) {
  let n = label.parent;
  while (n && !(typeof n.type === 'string' && n.props && n.props.accessibilityRole === 'button')) n = n.parent;
  return n;
}
/** Every scroller between a node and the sheet it sits in. */
function scrollersAbove(node, sheetId) {
  const found = [];
  let n = node.parent;
  while (n && !(n.props && n.props.testID === sheetId)) {
    if (n.type === 'RCTScrollView') found.push(n.props.testID || 'scroller');
    n = n.parent;
  }
  return found;
}
/**
 * jest has no layout, so a test that needs one supplies the phone's answers by hand. This puts a
 * pop-up's body 300 down its window, `bodyHeight` tall and scrolled to `scrolledTo`, and gives each
 * named block ({ top, height } inside the body's content) the place on screen that follows from
 * that. Returns the body's scrollTo, to see where the pop-up moved itself.
 */
function onAPhone(r, sheetId, { bodyHeight, scrolledTo = 0, blocks }) {
  const scroll = r.UNSAFE_getAllByType(ScrollView).find((s) => s.props.testID === `${sheetId}-body`).instance;
  scroll.getInnerViewRef = () => ({ _nativeTag: 7 });
  scroll.getNativeScrollRef = () => null;
  scroll.measureInWindow = (cb) => cb(0, 300, 360, bodyHeight);
  scroll.scrollTo = jest.fn();
  for (const [id, { top, height }] of Object.entries(blocks)) {
    const block = r.UNSAFE_getAllByType(View).find((v) => v.props.testID === id).instance;
    block.measureLayout = (relativeTo, ok) => ok(18, top, 324, height);
    block.measureInWindow = (cb) => cb(18, 300 + top - scrolledTo, 324, height);
  }
  return scroll.scrollTo;
}

/* ───────────────────────────────────────────── C5 → C6 · the brand's counter */

describe('C6 — brand · "Counter back": the note stays in view and Send is pinned above the keypad', () => {
  const thread = (over = {}) => ({
    invitationId: 'ci1', goal: 'conversion', status: 'negotiating',
    brand: { name: 'Urban Threads' }, creator: { id: 'p', name: 'Priya Sharma' }, setName: 'Set A',
    negotiation: { id: 'n1', open: true, whoseMove: 'brand', roundLimit: 2, countersUsed: 0 },
    current: { commissionPct: 13, usageRights: null },
    ...over,
  });
  const content = () => thread({ goal: 'engagement', current: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }], usageRights: null } });
  const open = (props = {}) => {
    const onSend = jest.fn(() => Promise.resolve());
    const r = render(<BrandCounterSheet6 visible thread={thread()} minimums={{ commissionPct: 12 }} onSend={onSend} onClose={noop} {...props} />);
    return { ...r, onSend };
  };

  it('the sheet shrinks, its whole body scrolls, and "Send counter" is pinned under it', () => {
    const r = open();
    const { body, footer } = expectPinned(r, 'brand-counter-sheet', { inBody: ['brand-commission', 'brand-counter-note'], inFooter: ['brand-send-counter'] });
    // The round tag, the change line and the counter under the note box scroll with the fields.
    expect(body.getByText('ROUND 1 OF 2')).toBeTruthy();
    expect(body.getByTestId('brand-change-commission')).toBeTruthy();
    expect(body.getByTestId('brand-counter-note-counter')).toBeTruthy();
    // Nothing on the pop-up was dropped: its own title and the name line are still there (U10).
    expect(body.getByText('Counter back')).toBeTruthy();
    expect(body.getByText('PRIYA SHARMA · SET A')).toBeTruthy();
    expect(footer.getByText('Send counter')).toBeTruthy();
  });

  it('the fixed 440-high scroller inside it is gone: the body is the only scroller in the pop-up', () => {
    const r = open();
    const all = r.UNSAFE_getAllByType(ScrollView);
    expect(all).toHaveLength(1);
    expect(flat(r.getByTestId('brand-counter-sheet-body')).maxHeight).toBeUndefined();
    expect(scrollersAbove(r.getByTestId('brand-counter-note'), 'brand-counter-sheet')).toEqual(['brand-counter-sheet-body']);
  });

  it('the deliverables chooser is handed the sheet body, so an opened type list can still be moved into view', () => {
    const r = open({ thread: content(), minimums: null });
    const scroller = r.UNSAFE_getByType(ScrollView).instance;
    scroller.getInnerViewRef = () => ({ _nativeTag: 7 });
    scroller.measureInWindow = jest.fn();
    fireEvent.press(r.getByTestId('brand-deliverables-add'));
    const list = r.getByTestId('brand-deliverables-list');
    expect(scrollersAbove(list, 'brand-counter-sheet')).toEqual(['brand-counter-sheet-body']);
    // The chooser asks the scroller it was given where it is — and that scroller is the sheet's body.
    fireEvent(list, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } } });
    expect(scroller.measureInWindow).toHaveBeenCalledTimes(1);
    // … and still no second pop-up over the first.
    expect(r.UNSAFE_queryAllByType(Modal)).toHaveLength(1);
  });

  it('a refusal from the server is said in red inside the pop-up, just above the button — and nowhere when there is none', () => {
    const calm = open();
    expect(calm.queryByTestId('brand-counter-error')).toBeNull();
    const r = open({ serverError: 'This invitation has closed.' });
    const { body, footer } = parts(r, 'brand-counter-sheet');
    const line = footer.getByText('This invitation has closed.');
    expect(flat(line).color).toBe(T.danger);
    expect(line.props.accessibilityRole).toBe('alert');
    expect(within(r.getByTestId('brand-counter-error')).getByText('This invitation has closed.')).toBeTruthy();
    expect(body.queryByText('This invitation has closed.')).toBeNull();
    // Above the button, not under it.
    const order = [];
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      const id = n.props && n.props.testID;
      if (id === 'brand-counter-error' || id === 'brand-send-counter') order.push(id);
      if (n.children) n.children.forEach(walk);
    })(r.toJSON());
    expect(order).toEqual(['brand-counter-error', 'brand-send-counter']);
  });

  // Review round. "Send counter" is pinned above the keypad and each red line sits under its own
  // box in the body. With the cursor in "Say why" on a short phone the body is about 194 tall and
  // the boxes above have scrolled away — a refused counter looked like a button that did nothing.
  describe('a counter "Send counter" refuses: the first refused box is scrolled into view, its red line still under it', () => {
    const typingTheNote = (r, blocks) => onAPhone(r, 'brand-counter-sheet', { bodyHeight: 194, scrolledTo: 260, blocks });

    it('Pay for Content with the fee emptied, the cursor in "Say why": the body goes back up to the Fee box', () => {
      const r = open({ thread: content(), minimums: null });
      const scrollTo = typingTheNote(r, {
        'brand-fee-field': { top: 80, height: 110 },
        'brand-deliverables-field': { top: 232, height: 96 },
        'brand-counter-note-field': { top: 392, height: 140 },
      });
      fireEvent.changeText(r.getByTestId('brand-fee'), '');
      fireEvent.press(r.getByTestId('brand-send-counter'));
      expect(r.onSend).not.toHaveBeenCalled();
      // The line is where it always was — under the Fee box, in the body, not repeated by the button.
      expect(within(r.getByTestId('brand-fee-field')).getByText(MSG5.FEE_REQUIRED)).toBeTruthy();
      expect(within(r.getByTestId('brand-counter-sheet-footer')).queryByText(MSG5.FEE_REQUIRED)).toBeNull();
      // The Fee block's top (less 6 of air) on the body's top edge.
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 74, animated: true });
    });

    it('Hybrid with both numbers wrong: the upper one, Commission, is the one shown', () => {
      const r = open({ thread: thread({ goal: 'hybrid', current: { commissionPct: 13, fee: 5000, usageRights: null } }), minimums: null });
      const scrollTo = typingTheNote(r, {
        'brand-commission-field': { top: 90, height: 120 },
        'brand-fee-field': { top: 222, height: 110 },
        'brand-counter-note-field': { top: 344, height: 140 },
      });
      fireEvent.changeText(r.getByTestId('brand-commission'), '');
      fireEvent.changeText(r.getByTestId('brand-fee'), '0');
      fireEvent.press(r.getByTestId('brand-send-counter'));
      expect(r.onSend).not.toHaveBeenCalled();
      expect(within(r.getByTestId('brand-commission-field')).getByText(MSG5.COMMISSION_REQUIRED)).toBeTruthy();
      expect(within(r.getByTestId('brand-fee-field')).getByText(MSG5.HYBRID_FEE)).toBeTruthy();
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 84, animated: true });
    });

    it('Pay for Content with re-use switched on and no place chosen: that block, which is drawn only then, is the one shown', () => {
      const r = open({ thread: content(), minimums: null });
      fireEvent(r.getByTestId('brand-usage-switch'), 'valueChange', true);
      // Scrolled to the top this time: the block is BELOW the fold, so its bottom edge comes up.
      const scrollTo = onAPhone(r, 'brand-counter-sheet', { bodyHeight: 194, scrolledTo: 0, blocks: {
        'brand-fee-field': { top: 80, height: 110 },
        'brand-deliverables-field': { top: 232, height: 96 },
        'brand-usage-field': { top: 380, height: 110 },
      } });
      fireEvent.press(r.getByTestId('brand-send-counter'));
      expect(r.onSend).not.toHaveBeenCalled();
      expect(within(r.getByTestId('brand-usage-field')).getByText(MSG5.USAGE_PLACE)).toBeTruthy();
      expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 302, animated: true });   // 380 + 110 + 6 - 194
    });

    it('a line added twice: the chooser, with its own red line under its rows, is the one shown', () => {
      const twice = thread({ goal: 'engagement', current: { fee: 12000, deliverables: [{ type: 'reel', count: 1 }, { type: 'reel', count: 2 }], usageRights: null } });
      const r = open({ thread: twice, minimums: null });
      const scrollTo = typingTheNote(r, {
        'brand-fee-field': { top: 80, height: 110 },
        'brand-deliverables-field': { top: 232, height: 150 },
      });
      fireEvent.press(r.getByTestId('brand-send-counter'));
      expect(r.onSend).not.toHaveBeenCalled();
      expect(within(r.getByTestId('brand-deliverables-field')).getByText(MSG5.DELIVERABLE_DUP)).toBeTruthy();
      expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 226, animated: true });
    });

    it('a counter with nothing wrong is sent and the body is left where she had it', async () => {
      const r = open();
      const scrollTo = typingTheNote(r, {
        'brand-commission-field': { top: 90, height: 120 },
        'brand-counter-note-field': { top: 222, height: 140 },
      });
      await act(async () => { fireEvent.press(r.getByTestId('brand-send-counter')); });
      expect(r.onSend).toHaveBeenCalledTimes(1);
      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('the chooser is still handed the very body the pop-up scrolls', () => {
      const r = open({ thread: content(), minimums: null });
      const scrollTo = typingTheNote(r, { 'brand-fee-field': { top: 80, height: 110 } });
      const body = r.UNSAFE_getAllByType(ScrollView).find((s) => s.props.testID === 'brand-counter-sheet-body').instance;
      expect(body.scrollTo).toBe(scrollTo);
      body.measureInWindow = jest.fn();
      fireEvent.press(r.getByTestId('brand-deliverables-add'));
      fireEvent(r.getByTestId('brand-deliverables-list'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } } });
      expect(body.measureInWindow).toHaveBeenCalledTimes(1);
    });
  });

  it('what is sent is unchanged', async () => {
    const r = open();
    fireEvent.changeText(r.getByTestId('brand-commission'), '11.5');
    fireEvent.changeText(r.getByTestId('brand-counter-note'), ' We can do 11.5% for the first collaboration. ');
    // The sheet clears its own "sending" when the send settles — inside act, so React is not surprised.
    await act(async () => { fireEvent.press(r.getByTestId('brand-send-counter')); });
    expect(r.onSend).toHaveBeenCalledTimes(1);
    expect(r.onSend).toHaveBeenCalledWith({
      terms: { commissionPct: 11.5, fee: null, deliverables: [], usageRights: null },
      note: 'We can do 11.5% for the first collaboration.',
    });
  });
});

/* ───────────────────────────────────────────────── C7 · ask for changes */

describe('C7 — brand · "Ask for changes": the note in view, Back and Send pinned as a level pair', () => {
  const sheet = (props = {}) => (
    <ChangesSheet12 visible round={{ current: 1, allowed: 2 }} noteCount={0} onSend={noop} onClose={noop} {...props} />
  );

  it('the note box and its counter are in the scrolling body, with the blue line about rounds under them', () => {
    const r = render(sheet());
    const { body } = expectPinned(r, 'changes-sheet', { inBody: ['changes-reason', 'changes-reason-counter', 'rounds-info'], inFooter: ['changes-back', 'changes-send'] });
    expect(body.getByText('Ask for changes')).toBeTruthy();
  });

  it('"Back" then "Send", two equal halves on one level, at least 44 tall', () => {
    const r = render(sheet());
    const footer = r.getByTestId('changes-sheet-footer');
    const ids = [];
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      const id = n.props && n.props.testID;
      if (id === 'changes-back' || id === 'changes-send') ids.push(id);
      if (n.children) n.children.forEach(walk);
    })(r.toJSON());
    expect(ids).toEqual(['changes-back', 'changes-send']);
    for (const id of ids) {
      expect(box(within(footer).getByTestId(id))).toMatchObject({ marginTop: 0, minHeight: 44, flexGrow: 1 });
    }
    const edge = (s) => s.paddingVertical + (s.borderWidth || 0);
    expect(edge(box(r.getByTestId('changes-back')))).toBe(edge(box(r.getByTestId('changes-send'))));
    // "Back" is the board's clear dark outline; "Send" is the one yellow button.
    expect(box(r.getByTestId('changes-back'))).toMatchObject({ borderWidth: 1.5, borderColor: T.ink });
    expect(box(r.getByTestId('changes-send')).backgroundColor).toBe(T.primary);
  });

  it('it still refuses an empty reason, sends the trimmed one, and "Back" closes — but not while sending', () => {
    const onSend = jest.fn(); const onClose = jest.fn();
    const r = render(sheet({ onSend, onClose }));
    fireEvent.press(r.getByTestId('changes-send'));
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.changeText(r.getByTestId('changes-reason'), '  The second reel is too dark at the end.  ');
    fireEvent.press(r.getByTestId('changes-send'));
    expect(onSend).toHaveBeenCalledWith('The second reel is too dark at the end.');
    fireEvent.press(r.getByTestId('changes-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
    r.rerender(sheet({ onSend, onClose, busy: true }));
    fireEvent.press(r.getByTestId('changes-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(within(r.getByTestId('changes-sheet-footer')).getByText('Sending')).toBeTruthy();
  });

  it('the server\'s refusal sits with the pair, in the footer', () => {
    const r = render(sheet({ serverError: 'She has already sent a new version.' }));
    const { body, footer } = parts(r, 'changes-sheet');
    expect(footer.getByText('She has already sent a new version.')).toBeTruthy();
    expect(body.queryByText('She has already sent a new version.')).toBeNull();
  });
});

/* ───────────────────────────────── every other pop-up that holds a text box */

describe('every pop-up with a text box: the box in a scrolling body, the buttons pinned under it', () => {
  it('creator · declining an invitation', () => {
    const r = render(<DeclineSheet5 visible onDecline={noop} onClose={noop} />);
    expectPinned(r, 'decline-sheet', { inBody: ['reason-other', 'decline-note', 'decline-note-counter'], inFooter: ['decline-confirm'] });
  });

  it('brand · declining her counter', () => {
    const r = render(<DeclineCounterSheet6 visible creatorName="Priya Sharma" onDecline={noop} onClose={noop} />);
    expectPinned(r, 'decline-counter-sheet', { inBody: ['decline-counter-note'], inFooter: ['decline-counter-confirm'] });
  });

  it('creator · signing: the name box and both ticks scroll, "Sign agreement" is pinned', () => {
    const r = render(<CreatorSignSheet7 visible defaultName="Tanvi Suresh" brandName="Urban Threads" onSign={noop} onClose={noop} />);
    const { body } = expectPinned(r, 'creator-sign-sheet', { inBody: ['sign-name', 'tick-read', 'tick-binding'], inFooter: ['sign-submit'] });
    // The line about what is recorded is still the last thing above the button.
    expect(body.getByText(/record/i)).toBeTruthy();
  });

  it('brand · the last signature: the name box and both ticks scroll, "Sign and lock" is pinned', () => {
    const cost = { gate: true, totalToLock: 12960, payouts: { t1: 3000 } };
    const r = render(<BrandSignSheet7 visible defaultName="Ravi Menon" brandName="Urban Threads" creatorName="Tanvi Suresh" cost={cost} onSign={noop} onClose={noop} />);
    const { footer } = expectPinned(r, 'brand-sign-sheet', { inBody: ['brand-sign-name', 'brand-tick-read', 'brand-tick-money'], inFooter: ['brand-sign-submit'] });
    expect(footer.getByText(/^Sign and lock ₹12,960/)).toBeTruthy();
  });

  it('creator · declining at signing', () => {
    const r = render(<DeclineAgreementSheet7 visible brandName="Urban Threads" onDecline={noop} onClose={noop} />);
    expectPinned(r, 'decline-agreement-sheet', { inBody: ['decline-note'], inFooter: ['decline-confirm'] });
  });

  it('brand · rejecting a pitch: the level pair is pinned, exactly as it was drawn', () => {
    const r = render(<RejectPitchSheet8 visible pitch={{ rejectCooldownLine: 'She can pitch you again from 2 Nov.' }} onReject={noop} onClose={noop} />);
    expectPinned(r, 'reject-pitch-sheet', { inBody: ['reject-reason', 'reject-cooldown'], inFooter: ['reject-keep', 'reject-confirm'] });
    for (const id of ['reject-keep', 'reject-confirm']) expect(box(r.getByTestId(id))).toMatchObject({ marginTop: 0, minHeight: 44, flexGrow: 1 });
  });

  it('creator · "I\'ve sent it back"', () => {
    const r = render(<SelfSentSheet11 visible brandName="Urban Threads" pincode="500034" onSend={noop} onClose={noop} />);
    expectPinned(r, 'self-sent-sheet', { inBody: ['self-sent-note'], inFooter: ['self-sent-confirm', 'self-sent-cancel'] });
  });

  it('brand · a note on one file, and both reports', () => {
    const note = render(<NoteSheet12 visible initial="Too dark" onSave={noop} onClose={noop} />);
    expectPinned(note, 'note-sheet', { inBody: ['note-input', 'note-input-counter'], inFooter: ['note-save', 'note-back'] });
    const report = render(<ReportSheet12 visible kind="posted_wrong" brandName="Urban Threads" onReport={noop} onClose={noop} />);
    expectPinned(report, 'report-sheet', { inBody: ['report-note'], inFooter: ['report-confirm', 'report-back'] });
    const hers = render(<ReportSheet12 visible kind="brand_silent" brandName="Urban Threads" onReport={noop} onClose={noop} />);
    expectPinned(hers, 'report-sheet', { inBody: ['report-note'], inFooter: ['report-confirm', 'report-back'] });
  });

  it('brand · telling INFLX what is wrong with a post', () => {
    const r = render(<ReportSheet14 visible kinds={['not_posted', 'posted_wrong']} onReport={noop} onClose={noop} />);
    expectPinned(r, 'sale-report-sheet', { inBody: ['reason-not_posted', 'sale-report-note'], inFooter: ['sale-report-confirm', 'sale-report-back'] });
  });

  it('brand · renaming (one text box, opened with the keypad already up) and duplicating a set', () => {
    const text = render(<TextSheet4 visible title="Rename campaign" label="Name" initial="Diwali Edit 2026" max={60} onSubmit={noop} onClose={noop} />);
    expectPinned(text, 'text-sheet', { inBody: ['text-sheet-input'], inFooter: ['text-sheet-submit'] });
    expect(text.getByTestId('text-sheet-input').props.autoFocus).toBe(true);

    const set = { id: 's1', name: 'Set A', goal: 'conversion', shootMode: 'visit', branch: { name: 'Banjara Hills' } };
    const dup = render(<DuplicateSheet4 set={set} earliest="2026-10-12" cutoffFor={() => '2026-10-09'} onCreate={noop} onClose={noop} />);
    expectPinned(dup, 'duplicate-sheet', { inBody: ['duplicate-name', 'duplicate-date'], inFooter: ['duplicate-create'] });
  });

  it('brand · naming a group', () => {
    const r = render(<GroupNameSheet visible onSubmit={noop} onClose={noop} />);
    expectPinned(r, 'group-name-sheet', { inBody: ['group-name-input'], inFooter: ['group-name-submit'] });
  });

  it('where two buttons were stacked they are still stacked: the outline one keeps its 10 under the main one', () => {
    const r = render(<DeclineSheet5 visible onDecline={noop} onClose={noop} />);
    const footer = within(r.getByTestId('decline-sheet-footer'));
    expect(flat(buttonOf(footer.getByText('Not yet'))).marginTop).toBe(10);
    expect(flat(r.getByTestId('decline-confirm')).marginTop).toBeUndefined();
    // … and neither is squeezed into a half: they are the plain full-width buttons.
    expect(flat(buttonOf(footer.getByText('Not yet'))).flexGrow).toBeUndefined();
    expect(footer.getByText('Not yet').props.numberOfLines).toBeUndefined();
  });
});

/* ──────────────────────────────────────── what moved with the buttons */

describe('a refusal sits with the buttons, where it is seen however far the body has scrolled', () => {
  it('declining an invitation with no reason picked: "Choose a reason." appears in the footer, and goes when one is picked', () => {
    const onDecline = jest.fn();
    const r = render(<DeclineSheet5 visible onDecline={onDecline} onClose={noop} />);
    fireEvent.press(r.getByTestId('decline-confirm'));
    expect(onDecline).not.toHaveBeenCalled();
    const { body, footer } = parts(r, 'decline-sheet');
    expect(footer.getByText(MSG5.DECLINE_REASON)).toBeTruthy();
    expect(body.queryByText(MSG5.DECLINE_REASON)).toBeNull();
    fireEvent.press(r.getByTestId('reason-other'));
    expect(r.queryByText(MSG5.DECLINE_REASON)).toBeNull();
    fireEvent.changeText(r.getByTestId('decline-note'), '  Out of town that week.  ');
    fireEvent.press(r.getByTestId('decline-confirm'));
    expect(onDecline).toHaveBeenCalledWith({ reason: 'other', note: 'Out of town that week.' });
  });

  it('signing with the ticks missing, and a signature the server refuses: both are said beside the Sign button', () => {
    const onSign = jest.fn();
    const sheet = (props = {}) => <BrandSignSheet7 visible defaultName="Ravi Menon" brandName="Urban Threads" creatorName="Tanvi Suresh" cost={null} onSign={onSign} onClose={noop} {...props} />;
    const r = render(sheet());
    fireEvent.press(r.getByTestId('brand-sign-submit'));
    expect(onSign).not.toHaveBeenCalled();
    expect(within(r.getByTestId('brand-sign-sheet-footer')).getByText(MSG7.TICKS)).toBeTruthy();
    fireEvent.press(r.getByTestId('brand-tick-read'));
    fireEvent.press(r.getByTestId('brand-tick-money'));
    fireEvent.press(r.getByTestId('brand-sign-submit'));
    expect(onSign).toHaveBeenCalledWith({ typedName: 'Ravi Menon', ticks: [true, true] });
    // The 17 September fault: a refusal nobody could see. It is in the footer, never scrolled away.
    r.rerender(sheet({ serverError: 'Add ₹4,000 to your wallet to sign.' }));
    expect(within(r.getByTestId('brand-sign-sheet-footer')).getByText('Add ₹4,000 to your wallet to sign.')).toBeTruthy();
    expect(within(r.getByTestId('brand-sign-sheet-body')).queryByText('Add ₹4,000 to your wallet to sign.')).toBeNull();

    const hers = render(<CreatorSignSheet7 visible defaultName="" brandName="Urban Threads" onSign={noop} onClose={noop} />);
    fireEvent.press(hers.getByTestId('sign-submit'));
    expect(within(hers.getByTestId('creator-sign-sheet-footer')).getByText(MSG7.NAME_EMPTY)).toBeTruthy();
  });
});

/* ───────── review round: a refusal that belongs to a box, in a body too short to show it */

describe('a pinned button that refuses a box out of sight: the red line stays under its box and the body is scrolled to it', () => {
  // A 640-point phone with the keypad open: the body is about 134 tall — the title and the box
  // being typed in, nothing more. Before this build the button was under the keypad, so she closed
  // the keypad first and saw the whole sheet; now she can tap it with the body this short.
  const SET = { id: 's1', name: 'Set A', goal: 'conversion', shootMode: 'visit', branch: { name: 'Banjara Hills' } };
  const DUP_BLOCKS = { 'duplicate-name-field': { top: 34, height: 100 }, 'duplicate-date-field': { top: 136, height: 96 } };
  const duplicate = (onCreate = jest.fn(() => Promise.resolve(null))) => {
    const r = render(<DuplicateSheet4 set={SET} earliest="2026-10-12" cutoffFor={() => '2026-10-09'} onCreate={onCreate} onClose={noop} />);
    return { ...r, onCreate };
  };
  const pickADay = (r) => {
    fireEvent.press(r.getByTestId('duplicate-date'));
    fireEvent.press(r.getByTestId('day-2026-10-14'));
    fireEvent.press(r.getByTestId('date-confirm'));
  };

  it('Duplicate a set · Create with no date while typing the name: the Date box, wholly below the fold, is brought up with its red line', () => {
    const r = duplicate();
    const scrollTo = onAPhone(r, 'duplicate-sheet', { bodyHeight: 134, blocks: DUP_BLOCKS });
    fireEvent.press(r.getByTestId('duplicate-create'));
    expect(r.onCreate).not.toHaveBeenCalled();
    expect(within(r.getByTestId('duplicate-date-field')).getByText(MSG4.DATE)).toBeTruthy();
    // Under its own box and nowhere else (U10: nothing is moved or said twice).
    expect(within(r.getByTestId('duplicate-sheet-footer')).queryByText(MSG4.DATE)).toBeNull();
    expect(r.getAllByText(MSG4.DATE)).toHaveLength(1);
    // The Date block's bottom edge (and 6 of air) on the body's bottom edge: 136 + 96 + 6 - 134.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 104, animated: true });
  });

  it('Duplicate a set · the name emptied as well: the name, the upper of the two, is the one shown', () => {
    const r = duplicate();
    const scrollTo = onAPhone(r, 'duplicate-sheet', { bodyHeight: 134, scrolledTo: 104, blocks: DUP_BLOCKS });
    fireEvent.changeText(r.getByTestId('duplicate-name'), '   ');
    fireEvent.press(r.getByTestId('duplicate-create'));
    expect(within(r.getByTestId('duplicate-name-field')).getByText(MSG4.SET_NAME)).toBeTruthy();
    expect(within(r.getByTestId('duplicate-date-field')).getByText(MSG4.DATE)).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 28, animated: true });      // the name block's top, less 6
  });

  it('Duplicate a set · the server refuses the date, or the name, or the copy as a whole: each is said under its box and shown', async () => {
    const answers = [
      { error: 'Choose a posting date at least 7 days from today.', field: 'go_live_date' },
      { error: 'A set with this name already exists in this campaign.', field: 'name' },
      { error: 'Could not save. Try again.' },
    ];
    const onCreate = jest.fn(() => Promise.resolve(answers.shift()));
    const r = duplicate(onCreate);
    pickADay(r);
    const scrollTo = onAPhone(r, 'duplicate-sheet', { bodyHeight: 134, blocks: DUP_BLOCKS });
    await act(async () => { fireEvent.press(r.getByTestId('duplicate-create')); });
    expect(onCreate).toHaveBeenCalledWith({ name: 'Set A (copy)', go_live_date: '2026-10-14' });
    expect(within(r.getByTestId('duplicate-date-field')).getByText('Choose a posting date at least 7 days from today.')).toBeTruthy();
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 0, y: 104, animated: true });

    const back = onAPhone(r, 'duplicate-sheet', { bodyHeight: 134, scrolledTo: 104, blocks: DUP_BLOCKS });
    await act(async () => { fireEvent.press(r.getByTestId('duplicate-create')); });
    expect(within(r.getByTestId('duplicate-name-field')).getByText('A set with this name already exists in this campaign.')).toBeTruthy();
    expect(back).toHaveBeenLastCalledWith({ x: 0, y: 28, animated: true });

    // No box named: said under the name, as it always was.
    await act(async () => { fireEvent.press(r.getByTestId('duplicate-create')); });
    expect(within(r.getByTestId('duplicate-name-field')).getByText('Could not save. Try again.')).toBeTruthy();
    expect(back).toHaveBeenCalledTimes(2);
  });

  it('Duplicate a set · a refusal that names a box this pop-up does not have is said with the buttons — it used to be drawn nowhere', async () => {
    const onCreate = jest.fn(() => Promise.resolve({ error: 'This set has no branch to copy.', field: 'branch_id' }));
    const r = duplicate(onCreate);
    pickADay(r);
    const scrollTo = onAPhone(r, 'duplicate-sheet', { bodyHeight: 134, blocks: DUP_BLOCKS });
    await act(async () => { fireEvent.press(r.getByTestId('duplicate-create')); });
    const { body, footer } = parts(r, 'duplicate-sheet');
    expect(footer.getByText('This set has no branch to copy.')).toBeTruthy();
    expect(body.queryByText('This set has no branch to copy.')).toBeNull();
    expect(scrollTo).not.toHaveBeenCalled();                                // the footer never scrolls away
  });

  it('Duplicate a set · everything right: it is created and nothing moves', async () => {
    const r = duplicate();
    pickADay(r);
    const scrollTo = onAPhone(r, 'duplicate-sheet', { bodyHeight: 134, blocks: DUP_BLOCKS });
    await act(async () => { fireEvent.press(r.getByTestId('duplicate-create')); });
    expect(r.onCreate).toHaveBeenCalledTimes(1);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('Edit description · a save the server refuses: the line is the last thing under the box, counter and hint, so the field is shown from its bottom edge', async () => {
    const onSubmit = jest.fn(() => Promise.resolve('Could not save. Try again.'));
    const r = render(<TextSheet4 visible title="Description" label="Description" initial="Festive edit" max={200} multiline required={false}
      hint="Creators see this on the invitation." onSubmit={onSubmit} onClose={noop} />);
    // Label 25, box 84, counter 19, hint 20, the red line 23, 14 under it: taller than the body.
    const scrollTo = onAPhone(r, 'text-sheet', { bodyHeight: 134, blocks: { 'text-sheet-field': { top: 34, height: 185 } } });
    await act(async () => { fireEvent.press(r.getByTestId('text-sheet-submit')); });
    expect(onSubmit).toHaveBeenCalledWith('Festive edit');
    expect(within(r.getByTestId('text-sheet-field')).getByText('Could not save. Try again.')).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 91, animated: true });       // 34 + 185 + 6 - 134
  });

  it('Rename · saved empty: refused on the phone, the line under the box is shown; typing takes it away again', () => {
    const onSubmit = jest.fn();
    const r = render(<TextSheet4 visible title="Rename set" label="Set name" initial="Set A" max={60} emptyMessage={MSG4.SET_NAME} onSubmit={onSubmit} onClose={noop} testID="rename-set" />);
    const scrollTo = onAPhone(r, 'rename-set', { bodyHeight: 134, blocks: { 'rename-set-field': { top: 34, height: 125 } } });
    fireEvent.changeText(r.getByTestId('rename-set-input'), '  ');
    fireEvent.press(r.getByTestId('rename-set-submit'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(within(r.getByTestId('rename-set-field')).getByText(MSG4.SET_NAME)).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith({ x: 0, y: 31, animated: true });       // 34 + 125 + 6 - 134
    fireEvent.changeText(r.getByTestId('rename-set-input'), 'Set B');
    expect(r.queryByText(MSG4.SET_NAME)).toBeNull();
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('with the keypad closed and the whole pop-up on show, a refusal moves nothing', () => {
    const r = duplicate();
    const scrollTo = onAPhone(r, 'duplicate-sheet', { bodyHeight: 330, blocks: DUP_BLOCKS });
    fireEvent.press(r.getByTestId('duplicate-create'));
    expect(r.getByText(MSG4.DATE)).toBeTruthy();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('the boxes are where they were: each marked block holds exactly its own field, in the same order', () => {
    const r = duplicate();
    const { body } = parts(r, 'duplicate-sheet');
    expect(within(r.getByTestId('duplicate-name-field')).getByTestId('duplicate-name')).toBeTruthy();
    expect(within(r.getByTestId('duplicate-name-field')).queryByTestId('duplicate-date')).toBeNull();
    expect(within(r.getByTestId('duplicate-date-field')).getByTestId('duplicate-date')).toBeTruthy();
    // A mark is a plain box: no style of its own, so nothing about the field's place changed.
    for (const id of ['duplicate-name-field', 'duplicate-date-field']) expect(body.getByTestId(id).props.style).toBeUndefined();
    const order = [];
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      const id = n.props && n.props.testID;
      if (['duplicate-name', 'duplicate-date', 'duplicate-create'].includes(id)) order.push(id);
      if (n.children) n.children.forEach(walk);
    })(r.toJSON());
    expect(order).toEqual(['duplicate-name', 'duplicate-date', 'duplicate-create']);
  });
});

describe('while a decline is running the red button shows its spinner, not "…"', () => {
  it('creator · declining an invitation', () => {
    const onDecline = jest.fn();
    const r = render(<DeclineSheet5 visible busy onDecline={onDecline} onClose={noop} />);
    const button = r.getByTestId('decline-confirm');
    expect(within(button).getByText('Declining')).toBeTruthy();
    expect(r.queryByText('…')).toBeNull();
    expect(button.props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(r.getByTestId('reason-other'));
    fireEvent.press(button);
    fireEvent.press(button);
    expect(onDecline).not.toHaveBeenCalled();                               // two taps, no second decline
    // At rest it is the plain red button with its own words, and a real boolean for Android.
    const rest = render(<DeclineSheet5 visible onDecline={onDecline} onClose={noop} />);
    expect(rest.getByTestId('decline-confirm').props.accessibilityState).toEqual({ disabled: false });
    expect(within(rest.getByTestId('decline-confirm')).queryByText('Declining')).toBeNull();
  });

  it('brand · declining her counter', () => {
    const onDecline = jest.fn();
    const r = render(<DeclineCounterSheet6 visible busy creatorName="Priya Sharma" onDecline={onDecline} onClose={noop} />);
    const button = r.getByTestId('decline-counter-confirm');
    expect(within(button).getByText('Declining')).toBeTruthy();
    expect(r.queryByText('…')).toBeNull();
    fireEvent.press(button);
    expect(onDecline).not.toHaveBeenCalled();
    const rest = render(<DeclineCounterSheet6 visible creatorName="Priya Sharma" onDecline={onDecline} onClose={noop} />);
    fireEvent.changeText(rest.getByTestId('decline-counter-note'), ' Our margin is fixed. ');
    fireEvent.press(rest.getByTestId('decline-counter-confirm'));
    expect(onDecline).toHaveBeenCalledWith({ note: 'Our margin is fixed.' });
  });
});

/* ─────────────────────────────────────────────── "What came back?" */

describe('brand · "What came back?": the items scroll with the sheet, the buttons are pinned', () => {
  const LINES = [{ id: 'l1', name: 'Rust kurta', quantity: 1 }, { id: 'l2', name: 'Block-print dupatta', quantity: 2 }];
  const sheet = (props = {}) => <ConfirmReturnSheet11 visible lines={LINES} autoConfirmDueAt="2026-10-20" onConfirm={noop} onClose={noop} {...props} />;

  it('the fixed 320-high scroller is gone: one scroller, the sheet\'s body, holds the items', () => {
    const r = render(sheet());
    expectPinned(r, 'confirm-return-sheet', { inBody: ['confirm-line-l1', 'confirm-line-l2', 'auto-confirm'], inFooter: ['confirm-return-confirm', 'confirm-return-cancel'] });
    expect(r.UNSAFE_getAllByType(ScrollView)).toHaveLength(1);
    // The three answers of an item are inside that one scroller, marked or not.
    fireEvent.press(r.getByTestId('confirm-check-l1-damaged'));
    expect(scrollersAbove(r.getByTestId('confirm-check-l1-damaged'), 'confirm-return-sheet')).toEqual(['confirm-return-sheet-body']);
  });

  // Final review, 2 Oct 2026. Missing / Damaged used to open a note box here that kept nothing:
  // the pop-up gave it an empty value and a do-nothing handler, so every letter typed vanished,
  // and the server's confirm step has no place for a note. Item 11's locked R13 draws three
  // buttons per item and no note — so there is no box to type in, whatever she marks.
  it('marking an item Missing or Damaged opens NO note box — nothing here can swallow what is typed', () => {
    const { TextInput } = require('react-native');
    const r = render(sheet());
    expect(r.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    for (const verdict of ['missing', 'damaged', 'received']) {
      fireEvent.press(r.getByTestId(`confirm-check-l1-${verdict}`));
      expect(r.getByTestId(`confirm-check-l1-${verdict}`).props.accessibilityState).toEqual({ selected: true, disabled: false });
      expect(r.queryByTestId('confirm-check-l1-note')).toBeNull();
      expect(r.UNSAFE_queryAllByType(TextInput)).toHaveLength(0);
    }
    fireEvent.press(r.getByTestId('confirm-check-l2-missing'));
    expect(r.queryByTestId('confirm-check-l2-note')).toBeNull();
    // The three answers per item are all the pop-up draws for it (R13).
    const line = within(r.getByTestId('confirm-line-l2'));
    for (const verdict of ['received', 'missing', 'damaged']) expect(line.getByTestId(`confirm-check-l2-${verdict}`)).toBeTruthy();
  });

  it('what is sent is each item\'s answer and nothing else — the server\'s confirm step has no place for a note, and none was invented', () => {
    const onConfirm = jest.fn();
    const r = render(sheet({ onConfirm }));
    expect(r.getByTestId('confirm-return-confirm').props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(r.getByTestId('confirm-check-l1-damaged'));
    expect(r.queryByTestId('confirm-check-l1-note')).toBeNull();
    expect(r.getByTestId('confirm-return-confirm').props.accessibilityState).toEqual({ disabled: true });   // l2 still unanswered
    fireEvent.press(r.getByTestId('confirm-check-l2-received'));
    fireEvent.press(r.getByTestId('confirm-return-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith([{ lineId: 'l1', status: 'damaged' }, { lineId: 'l2', status: 'received' }]);
  });

  it('a refusal from the server is in the footer with the buttons', () => {
    const r = render(sheet({ serverError: 'This return was already confirmed.' }));
    expect(within(r.getByTestId('confirm-return-sheet-footer')).getByText('This return was already confirmed.')).toBeTruthy();
  });
});

/* ───────────────────────────────────── list pop-ups with a search box */

describe('list pop-ups: the list gives way to the keypad and the button stays pinned under it', () => {
  const ITEMS = [{ code: 'fashion', label: 'Fashion' }, { code: 'beauty', label: 'Beauty' }, { code: 'food', label: 'Food' }];
  const STATES = [
    { id: 1, name: 'Telangana', cities: [{ id: 11, name: 'Hyderabad' }, { id: 12, name: 'Warangal' }] },
    { id: 2, name: 'Karnataka', cities: [{ id: 21, name: 'Bengaluru' }] },
  ];

  it('the "Any or pick" picker: a plain body (the list is in no ScrollView), Apply in the footer, and it still applies', () => {
    const onApply = jest.fn();
    const r = render(<PickerSheet visible title="Niches" items={ITEMS} value={['fashion']} nounOne="niche" nounMany="niches" searchPlaceholder="Search niches" onApply={onApply} onClose={noop} />);
    const { body, footer } = expectPinned(r, 'picker-sheet', { inFooter: ['picker-apply'], list: true });
    const list = r.UNSAFE_getByType(FlatList);
    // Between a row and the sheet there is exactly one scroller: the list's own. No body scroller around it.
    expect(scrollersAbove(r.getByText('Beauty'), 'picker-sheet')).toEqual(['scroller']);
    expect(StyleSheet.flatten(list.props.style).maxHeight).toBe(360);       // as tall as before when there is room
    expect(body.getByPlaceholderText('Search niches')).toBeTruthy();
    expect(footer.getByText('Apply · 1 niche')).toBeTruthy();
    fireEvent.press(r.getByText('Beauty'));
    expect(footer.getByText('Apply · 2 niches')).toBeTruthy();
    fireEvent.changeText(r.getByPlaceholderText('Search niches'), 'foo');
    expect(r.queryByText('Beauty')).toBeNull();
    fireEvent.press(r.getByTestId('picker-apply'));
    expect(onApply).toHaveBeenCalledWith(['fashion', 'beauty']);
  });

  it('the state → city picker: both steps keep Apply pinned; searching and stepping in do not move it', () => {
    const onApply = jest.fn();
    const r = render(<StateCityPicker visible title="Cities" states={STATES} value={[11]} onApply={onApply} onClose={noop} />);
    const { footer } = expectPinned(r, 'state-city-picker', { inFooter: ['city-apply'], list: true });
    expect(footer.getByText('Apply · 1 city')).toBeTruthy();
    expect(r.UNSAFE_queryAllByType(ScrollView).filter((s) => s.props.testID === 'state-city-picker-body')).toHaveLength(0);
    fireEvent.press(r.getByTestId('state-2'));                              // step 2
    fireEvent.press(r.getByTestId('city-21'));
    expectPinned(r, 'state-city-picker', { inBody: ['city-21'], inFooter: ['city-apply'], list: true });
    expect(within(r.getByTestId('state-city-picker-footer')).getByText('Apply · 2 cities')).toBeTruthy();
    fireEvent.press(r.getByTestId('city-apply'));
    expect(onApply).toHaveBeenCalledWith([11, 21]);
  });

  // Review round. The chosen-city chips were a plain block above the list that could neither scroll
  // nor shrink, so only the list gave way: two rows of chips on a short phone with the keypad open
  // left the results less than one row, and "Select all" on a big state left the list nothing.
  describe('the state → city picker\'s chosen cities give way too', () => {
    const BIG = [
      { id: 1, name: 'Telangana', cities: Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, name: `City ${i}` })) },
      { id: 2, name: 'Karnataka', cities: [{ id: 21, name: 'Bengaluru' }] },
    ];
    const twelve = BIG[0].cities.map((c) => c.id);
    const picker = (props = {}) => <StateCityPicker visible title="Cities" states={BIG} value={twelve} onApply={noop} onClose={noop} {...props} />;

    it('twelve cities chosen: the chips sit in a scroller of their own that gives way before the list does, but never to less than one chip', () => {
      const r = render(picker());
      const { body } = parts(r, 'state-city-picker', { list: true });
      const chips = body.getByTestId('city-chips');
      expect(chips.type).toBe('RCTScrollView');
      // No height of its own and no cap: with room to spare it is as tall as its chips, as before.
      // It does not grow into the list's room, and it shrinks four times as readily as the list
      // (a list's own scroller shrinks at 1).
      expect(flat(chips)).toEqual({ flexGrow: 0, flexShrink: 4, marginTop: 10, minHeight: 28 });
      expect(StyleSheet.flatten(r.UNSAFE_getByType(FlatList).props.style)).toEqual({ maxHeight: 320 });
      for (const id of twelve) expect(within(chips).getByTestId(`city-chip-${id}`)).toBeTruthy();
      // The chips wrap as they did, inside it.
      expect(StyleSheet.flatten(chips.props.contentContainerStyle)).toEqual({ flexDirection: 'row', flexWrap: 'wrap' });
      // A tap on a chip must reach the chip while the keypad is open, not just close the keypad.
      expect(chips.props.keyboardShouldPersistTaps).toBe('handled');
    });

    it('it stands BESIDE the list, never around it: a row of the list has only the list\'s own scroller above it', () => {
      const r = render(picker());
      expect(scrollersAbove(r.getByTestId('state-1'), 'state-city-picker')).toEqual(['scroller']);
      expect(scrollersAbove(r.getByTestId('city-chip-100'), 'state-city-picker')).toEqual(['city-chips']);
      expect(r.UNSAFE_getAllByType(FlatList)).toHaveLength(1);
      expect(within(r.getByTestId('city-chips')).queryByTestId('state-1')).toBeNull();
      // The search box and the "1 · CHOOSE A STATE" line are not in either scroller: they keep their place.
      expect(scrollersAbove(r.getByPlaceholderText('Search a city or state'), 'state-city-picker')).toEqual([]);
    });

    it('the same on the second step and while searching, with Apply pinned throughout', () => {
      const r = render(picker());
      fireEvent.changeText(r.getByPlaceholderText('Search a city or state'), 'beng');
      expect(r.getByTestId('city-chips').type).toBe('RCTScrollView');
      expect(scrollersAbove(r.getByText('Bengaluru · Karnataka'), 'state-city-picker')).toEqual(['scroller']);
      fireEvent.changeText(r.getByPlaceholderText('Search a city or state'), '');
      fireEvent.press(r.getByTestId('state-2'));
      const { body, footer } = parts(r, 'state-city-picker', { list: true });
      expect(flat(body.getByTestId('city-chips'))).toEqual({ flexGrow: 0, flexShrink: 4, marginTop: 10, minHeight: 28 });
      expect(StyleSheet.flatten(r.UNSAFE_getByType(FlatList).props.style)).toEqual({ maxHeight: 300 });
      expect(scrollersAbove(body.getByTestId('city-21'), 'state-city-picker')).toEqual(['scroller']);
      expect(footer.getByText('Apply · 12 cities')).toBeTruthy();
    });

    it('a chip still takes its city away, on either step, and Apply hands back what is left', () => {
      const onApply = jest.fn();
      const r = render(picker({ onApply }));
      fireEvent.press(r.getByTestId('city-chip-103'));
      expect(r.queryByTestId('city-chip-103')).toBeNull();
      expect(r.getByText('Apply · 11 cities')).toBeTruthy();
      fireEvent.press(r.getByTestId('state-1'));
      fireEvent.press(r.getByLabelText('Remove City 0'));
      expect(r.getByText('Apply · 10 cities')).toBeTruthy();
      fireEvent.press(r.getByTestId('city-apply'));
      expect(onApply).toHaveBeenCalledWith(twelve.filter((id) => id !== 103 && id !== 100));
    });

    it('with no city chosen there is no scroller and no gap; cities that are no longer offered draw no chip and keep the old 10 above the list', () => {
      const none = render(picker({ value: [] }));
      expect(none.queryByTestId('city-chips')).toBeNull();
      const gone = render(picker({ value: [999] }));
      expect(gone.queryByTestId('city-chips')).toBeNull();
      expect(gone.getByText('Apply · 1 city')).toBeTruthy();
    });
  });

  it('the registration state / city list: the list gives way, and the count line is pinned under it', () => {
    const onPick = jest.fn();
    const cities = [{ id: 11, name: 'Hyderabad' }, { id: 12, name: 'Warangal' }];
    const r = render(<SinglePickSheet visible title="Nearest major city" items={cities} value={11} onPick={onPick} onClose={noop} searchPlaceholder="Search Telangana cities" footer="2 cities in Telangana" testIDPrefix="reg-city" />);
    const { body, footer } = parts(r, 'reg-city-sheet', { list: true });
    expect(body.getByTestId('reg-city-search')).toBeTruthy();
    expect(footer.getByText('2 cities in Telangana')).toBeTruthy();
    expect(body.queryByText('2 cities in Telangana')).toBeNull();
    fireEvent.press(r.getByTestId('reg-city-option-12'));
    expect(onPick).toHaveBeenCalledWith(12);
    // With no count line (the State list, Gender) there is no footer strip at all — and it is still the shrinking shape.
    const bare = render(<SinglePickSheet visible title="State" items={cities} value={null} onPick={noop} onClose={noop} searchPlaceholder="Search states" testIDPrefix="reg-state" />);
    expect(parts(bare, 'reg-state-sheet', { list: true }).footer).toBeNull();
  });

  it('Filters: the title row keeps its place, the filters scroll in the sheet\'s own list, and "Show N" is pinned', async () => {
    const onApply = jest.fn();
    const lists = { niches: [{ code: 'fashion', label: 'Fashion' }], languages: [{ code: 'te', label: 'Telugu' }], states: STATES, nicheLabel: (c) => c };
    const r = render(<FiltersSheet visible kind="creators" value={{}} lists={lists} fetchCount={() => Promise.resolve(42)} onApply={onApply} onClose={noop} />);
    await waitFor(() => r.getByText(C3.discover.showN(42)));
    const { body, footer } = expectPinned(r, 'filters-sheet', { inBody: ['filters-clear', 'filter-openonly'], inFooter: ['filters-apply'], list: true });
    expect(footer.getByText('Show 42 creators')).toBeTruthy();
    // "Clear all" is NOT inside the scroller: it stays put while the filters move under it.
    expect(scrollersAbove(body.getByTestId('filters-clear'), 'filters-sheet')).toEqual([]);
    expect(scrollersAbove(body.getByTestId('filter-openonly'), 'filters-sheet')).toHaveLength(1);
    fireEvent.press(r.getByTestId('filters-apply'));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('Add to groups: the list of groups gives way and Save / Cancel are pinned', async () => {
    brandApi.groupsForCreator.mockResolvedValue({ success: true, data: { groups: [{ id: 'g1', name: 'Diwali shortlist', memberCount: 13, contains: false, capacityLeft: 87 }] } });
    const r = render(<AddToGroupSheet creator={{ id: 'c1', name: 'Tanvi Suresh' }} onClose={noop} onDone={noop} />);
    await waitFor(() => r.getByTestId('add-to-group-g1'));
    expectPinned(r, 'add-to-group-sheet', { inBody: ['add-to-group-new', 'add-to-group-g1'], inFooter: ['add-to-group-save'], list: true });
  });

  it('a long list of branches scrolls inside its sheet, with Cancel pinned under it', () => {
    const branches = Array.from({ length: 14 }, (_, i) => ({ id: `b${i}`, name: `Branch ${i}`, isMain: i === 0, cityName: 'Hyderabad', stateName: 'Telangana' }));
    const onPick = jest.fn(); const onClose = jest.fn();
    const r = render(<BranchSheet4 visible branches={branches} value="b3" onPick={onPick} onClose={onClose} />);
    const { footer } = expectPinned(r, 'branch-sheet', { inBody: ['branch-b0', 'branch-b13'] });
    fireEvent.press(r.getByTestId('branch-b13'));
    expect(onPick).toHaveBeenCalledWith(branches[13]);
    // A lone outline button in a footer carries no top gap of its own (the footer keeps 12 above it).
    const cancel = footer.getByText('Cancel');
    fireEvent.press(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(flat(buttonOf(cancel)).marginTop).toBe(0);
  });
});

/* ──────────────────────────────── the shared Sheet: the one thing added */

describe('Sheet `bodyRef` — a pop-up can reach its own scrolling body', () => {
  it('hands the ref the body\'s ScrollView; left out, nothing changes', () => {
    const ref = React.createRef();
    const r = render(<Sheet visible onClose={noop} testID="s" fit bodyRef={ref} footer={null}><></></Sheet>);
    expect(ref.current).toBe(r.UNSAFE_getByType(ScrollView).instance);
    expect(typeof ref.current.scrollTo).toBe('function');
    const plain = render(<Sheet visible onClose={noop} testID="p" fit><></></Sheet>);
    expect(plain.getByTestId('p-body').type).toBe('RCTScrollView');
  });

  it('the old sheet and the list shape take no notice of it', () => {
    const ref = React.createRef();
    const old = render(<Sheet visible onClose={noop} testID="o" bodyRef={ref}><></></Sheet>);
    expect(old.queryByTestId('o-body')).toBeNull();
    expect(ref.current).toBeNull();
    render(<Sheet visible onClose={noop} testID="l" fit="list" bodyRef={ref}><></></Sheet>);
    expect(ref.current).toBeNull();
  });
});

/* ───────────── no text box, but the content has no upper limit: it scrolls too */

describe('pop-ups with no text box whose content can outgrow a short phone: the long part scrolls, the buttons stay pinned', () => {
  it('creator · "Send this to …?": one line for every place every post is shared — they scroll, and the two warnings stay with the buttons', () => {
    // Pay for Sale: four posts, each shared in three or four places, is fourteen lines. In the old
    // sheet that pushed "Send" and "Not yet" off the bottom of the phone with no way to reach them.
    const rows = Array.from({ length: 14 }, (_, i) => ({ key: `r${i}`, label: `Kurta reel ${i} · Instagram reel`, files: [{ id: `f${i}`, kind: 'video' }] }));
    const onSend = jest.fn(); const onClose = jest.fn();
    const sheet = (props = {}) => <SendSheet12 visible brandName="Urban Threads" rows={rows} onSend={onSend} onClose={onClose} {...props} />;
    const r = render(sheet());
    const { body, footer } = expectPinned(r, 'send-sheet', {
      inBody: ['send-row-r0', 'send-row-r13'],
      inFooter: ['send-lock', 'dont-post-yet', 'send-confirm', 'send-cancel'],
    });
    expect(body.getByText('Send this to Urban Threads?')).toBeTruthy();
    expect(within(r.getByTestId('send-row-r13')).getByText('1 video')).toBeTruthy();
    // Nothing was dropped or reworded (U10): both sentences are there, above the buttons.
    expect(footer.getByText("You can't change anything while they are reviewing it.")).toBeTruthy();
    expect(footer.getByText(/^Don't post any of this yet\./)).toBeTruthy();
    const order = [];
    (function walk(n) {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      const id = n.props && n.props.testID;
      if (['send-row-r13', 'send-lock', 'dont-post-yet', 'send-confirm', 'send-cancel'].includes(id)) order.push(id);
      if (n.children) n.children.forEach(walk);
    })(r.toJSON());
    expect(order).toEqual(['send-row-r13', 'send-lock', 'dont-post-yet', 'send-confirm', 'send-cancel']);
    // The two buttons are still the stacked pair they were, not squeezed into halves.
    expect(flat(r.getByTestId('send-cancel')).marginTop).toBe(10);
    expect(flat(r.getByTestId('send-cancel')).flexGrow).toBeUndefined();

    fireEvent.press(r.getByTestId('send-confirm'));
    expect(onSend).toHaveBeenCalledTimes(1);
    fireEvent.press(r.getByTestId('send-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    // While it is sending "Not yet" does nothing, and a refusal is said with the buttons.
    r.rerender(sheet({ busy: true, serverError: 'One of these was already sent.' }));
    fireEvent.press(r.getByTestId('send-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
    const again = parts(r, 'send-sheet');
    expect(again.footer.getByText('One of these was already sent.')).toBeTruthy();
    expect(again.body.queryByText('One of these was already sent.')).toBeNull();
    expect(again.footer.getByText('Sending')).toBeTruthy();
  });

  it('creator · "Send this to …?" on Pay for Content, and sending changes: the same sheet, the same words', () => {
    const rows = [{ key: 'reel', label: 'Instagram reel', files: [{ id: 'a', kind: 'video' }, { id: 'b', kind: 'photo' }] }];
    const r = render(<SendSheet12 visible resend brandName="Urban Threads" rows={rows} onSend={noop} onClose={noop} />);
    expectPinned(r, 'send-sheet', { inBody: ['send-row-reel'], inFooter: ['send-lock', 'dont-post-yet', 'send-confirm', 'send-cancel'] });
    expect(within(r.getByTestId('send-row-reel')).getByText('1 video, 1 photo')).toBeTruthy();
    expect(within(r.getByTestId('send-confirm')).getByText('Send the changes')).toBeTruthy();
    expect(within(r.getByTestId('send-cancel')).getByText('Not yet')).toBeTruthy();
  });

  it('creator · "Where will you share …?": all six places scroll, "Add" and "Back" are pinned, and it still adds what was picked', () => {
    const destinations = [
      { type: 'reel', label: 'Instagram reel' }, { type: 'post', label: 'Instagram post' },
      { type: 'story', label: 'Instagram story', isStory: true }, { type: 'youtube_video', label: 'YouTube video' },
      { type: 'youtube_short', label: 'YouTube Short' }, { type: 'facebook_post', label: 'Facebook post' },
    ];
    const onAdd = jest.fn(); const onClose = jest.fn();
    const sheet = (props = {}) => <DestinationSheet14 visible post={{ title: 'Kurta reel' }} destinations={destinations} taken={['post']} onAdd={onAdd} onClose={onClose} {...props} />;
    const r = render(sheet());
    const { body, footer } = expectPinned(r, 'destination-sheet', {
      inBody: ['dest-reel', 'dest-story', 'dest-youtube_video', 'dest-youtube_short', 'dest-facebook_post'],
      inFooter: ['dest-add', 'dest-back'],
    });
    expect(body.queryByTestId('dest-post')).toBeNull();                     // a place already used is still left out
    expect(body.getByText('Where will you share "Kurta reel"?')).toBeTruthy();
    expect(body.getByText('Proved with a screenshot')).toBeTruthy();
    // Nothing picked: the button says so and cannot be pressed.
    expect(footer.getByText('Pick at least one')).toBeTruthy();
    expect(r.getByTestId('dest-add').props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(r.getByTestId('dest-reel'));
    fireEvent.press(r.getByTestId('dest-story'));
    expect(footer.getByText('Add 2 rows')).toBeTruthy();
    fireEvent.press(r.getByTestId('dest-add'));
    expect(onAdd).toHaveBeenCalledWith(['reel', 'story']);
    fireEvent.press(r.getByTestId('dest-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
    r.rerender(sheet({ busy: true, serverError: 'That post was withdrawn.' }));
    fireEvent.press(r.getByTestId('dest-back'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(within(r.getByTestId('destination-sheet-footer')).getByText('That post was withdrawn.')).toBeTruthy();
  });

  it('brand · "Terms sent": Hybrid terms with a long note scroll, and "Close" is pinned under them', () => {
    const terms = {
      goal: 'hybrid', commissionPct: 12, fee: 8000,
      sell: { words: 'Festive kurtas, Block-print dupattas and 3 products with no offer' },
      offer: { kind: 'offer', name: 'Diwali 15% off' }, shoppablePostsMin: 3,
      deliverablesWords: '1 Instagram reel, 2 Instagram stories, 1 YouTube video',
      usageRights: { words: '90 days · ads and the website' },
      note: 'Please wear the kurta with the dupatta on. '.repeat(7).trim(),
    };
    const onClose = jest.fn();
    const r = render(<TermsSentSheet5 visible invitation={{ terms }} onClose={onClose} />);
    const { body, footer } = parts(r, 'terms-sent-sheet');
    expect(body.getByText('Terms sent')).toBeTruthy();
    for (const words of ['12%', '₹8,000', terms.sell.words, 'Diwali 15% off', terms.deliverablesWords, terms.usageRights.words]) {
      expect(body.getByText(words)).toBeTruthy();
    }
    expect(body.getByText(`“${terms.note}”`)).toBeTruthy();
    expect(body.getByText("Terms can't be edited once sent. Withdraw and invite again instead.")).toBeTruthy();
    // "Close" is the footer's only button: no top gap of its own (the footer keeps 12 above it).
    const close = footer.getByText('Close');
    expect(body.queryByText('Close')).toBeNull();
    expect(flat(buttonOf(close)).marginTop).toBe(0);
    fireEvent.press(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    // Before the terms have loaded it is the same sheet, so it is never rebuilt when they arrive.
    const empty = render(<TermsSentSheet5 visible invitation={null} onClose={noop} />);
    expect(parts(empty, 'terms-sent-sheet').footer.getByText('Close')).toBeTruthy();
  });
});

/* ─────────────────────────────── pop-ups with no text box and no long list */

describe('pop-ups with no text box and no long content are left exactly as they were', () => {
  it('the confirm and ⋯ sheets', () => {
    const c = render(<ConfirmSheet visible title="Pause pitches?" body="Creators can't pitch you while paused." confirmLabel="Pause" cancelLabel="Not now" onConfirm={noop} onCancel={noop} />);
    expectOldShape(c, 'confirm-sheet');
    const a = render(<ActionSheet visible actions={[{ label: 'Rename', onPress: noop }]} onClose={noop} />);
    expectOldShape(a, 'action-sheet');
  });

  it('the short confirms of items 6 to 11', () => {
    const moving = {
      goal: 'conversion', creator: { name: 'Priya Sharma' }, current: { commissionPct: 12, usageRights: null },
      moveRequest: { goLiveDate: '2026-10-28' },
    };
    const pitch = { creator: { name: 'Priya Sharma' }, termsLine: '12% commission', proposedGoLiveDate: '2026-10-24', acceptBody: 'Accepting agrees the money. It does not start a collaboration.' };
    const cases = [
      [<CounterChoiceSheet6 visible roundLimit={2} countersUsed={0} canMoveRequest onMoney={noop} onMove={noop} onClose={noop} />, 'counter-choice-sheet'],
      [<MoveConfirmSheet6 visible thread={moving} onConfirm={noop} onClose={noop} />, 'move-confirm-sheet'],
      [<AcceptPitchSheet8 visible pitch={pitch} onAccept={noop} onClose={noop} />, 'accept-pitch-sheet'],
      [<PickupDaySheet11 visible today="2026-10-02" brandName="Urban Threads" address={{ street: '12 Road 3', city: 'Hyderabad', state: 'Telangana', pincode: '500034' }} onBook={noop} onClose={noop} />, 'pickup-sheet'],
      [<ReturnToGiftSheet11 visible creatorName="Tanvi" line={{ name: 'Rust kurta', variantLabel: 'M' }} onConfirm={noop} onClose={noop} />, 'gift-sheet'],
      [<SendAgreementSheet7 visible creatorName="Tanvi" cutoff="2026-10-17" onSend={noop} onClose={noop} />, 'send-agreement-sheet'],
      [<WithdrawAgreementSheet7 visible creatorName="Tanvi" onWithdraw={noop} onClose={noop} />, 'withdraw-agreement-sheet'],
      [<WithdrawPitchSheet8 visible onWithdraw={noop} onClose={noop} />, 'withdraw-pitch-sheet'],
      [<SendPlanSheet10 visible creatorName="Tanvi" contactName="Ravi" address="Road 12, Banjara Hills" phone="+91 98490 11223" visitAt="2026-10-18T05:30:00.000Z" onSend={noop} onClose={noop} />, 'send-plan-sheet'],
      [<ShootDoneSheet11 visible brandName="Urban Threads" count={0} onConfirm={noop} onClose={noop} />, 'shoot-done-sheet'],
      [<CancelBookingSheet11 visible amount={120} onConfirm={noop} onClose={noop} />, 'cancel-booking-sheet'],
      [<ReportSheet11 visible kind="return" onConfirm={noop} onClose={noop} />, 'report-sheet'],
    ];
    for (const [el, id] of cases) {
      const r = render(el);
      expectOldShape(r, id);
      r.unmount();
    }
  });
});

/* ─────────────────────────────── the keypad never decides what a pop-up looks like */

describe('the layout does the work: what a pop-up draws never depends on the keypad', () => {
  it('the one thing that hears the keypad is the body\'s scroll helper — it draws nothing, and lets go when the pop-up is taken away', () => {
    const heard = {};
    const removed = [];
    const spy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, fn) => {
      heard[event] = fn;
      return { remove: () => removed.push(event) };
    });
    const r = render(<ChangesSheet12 visible round={{ current: 1, allowed: 2 }} onSend={noop} onClose={noop} />);
    fireEvent.changeText(r.getByTestId('changes-reason'), 'Too dark');
    // Only "the keypad has shown" — its going away is never listened for.
    expect(Object.keys(heard)).toEqual(['keyboardDidShow']);
    expect(spy).toHaveBeenCalledTimes(1);
    // The keypad showing changes nothing that is drawn: same sheet, same body, same footer.
    const before = JSON.stringify(r.toJSON());
    act(() => { heard.keyboardDidShow({ endCoordinates: { height: 290 } }); jest.advanceTimersByTime(400); });
    expect(JSON.stringify(r.toJSON())).toBe(before);
    r.unmount();
    expect(removed).toEqual(['keyboardDidShow']);
    spy.mockRestore();
  });

  it('a pop-up left in the old shape hears nothing at all', () => {
    const spy = jest.spyOn(Keyboard, 'addListener');
    render(<ConfirmSheet visible title="Pause pitches?" body="Creators can't pitch you while paused." confirmLabel="Pause" cancelLabel="Not now" onConfirm={noop} onCancel={noop} />);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
