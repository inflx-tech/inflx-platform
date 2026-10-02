import React from 'react';
import { StyleSheet, Keyboard } from 'react-native';
import { render, fireEvent, within, waitFor } from '@testing-library/react-native';
import { GateCard10, StepLine10, TimeCard10, AddressCard10, TimePicker10 } from '../bits10';
import { SLOTS10, ROW_H10, openDays10, slotGone10 } from '../TimeList10';
import { MoveTimeSheet10 } from '../sheets10';
import { settingsTokens as T } from '../../../theme/tokens';
import { C10, MSG10, whenLine10, whenShort10, day10, istToIso, istParts, istDay10 } from '../copy10';
import { SetCreatorRow5 } from '../../invitations/bits5';

// The two store-visit screens load when they come into focus. Under jest a screen is drawn
// outside a navigator, so "into focus" is its first draw (the stand-in every screen suite uses).
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
}));

/**
 * Item 10 — the pieces the store-visit screens are built from, and the clock they read.
 * Contract: features/item10-store-visit · checks 4, 6, 29
 */

// Every screen must at least import cleanly: a name used without being imported has shipped
// three native crashes before (reference_rn_native_crash_debugging).
describe('the six screens import', () => {
  it.each([
    ['BrandShootScreen', () => require('../../../screens/brand/BrandShootScreen')],
    ['BrandShootPlanScreen', () => require('../../../screens/brand/BrandShootPlanScreen')],
    ['ShootThreadScreen', () => require('../../../screens/shared/ShootThreadScreen')],
    ['ShootCounterScreen', () => require('../../../screens/shared/ShootCounterScreen')],
    ['ShootScreen', () => require('../../../screens/influencer/ShootScreen')],
    ['sheets10', () => require('../sheets10')],
  ])('%s', (_, load) => { expect(typeof load().default === 'function' || typeof load() === 'object').toBe(true); });
});

describe('the clock is Indian, without Intl', () => {
  it('prints an instant as it reads on an Indian clock, whatever the machine\'s zone', () => {
    // 05:30Z on 18 Oct 2026 is 11:00 am IST on Sunday 18 Oct.
    expect(whenLine10('2026-10-18T05:30:00.000Z')).toBe('Sun 18 Oct, 11:00 am');
    expect(whenShort10('2026-10-19T10:30:00.000Z')).toBe('19 Oct, 4:00 pm');
    expect(day10('2026-10-24')).toBe('24 Oct');
    expect(day10('2026-10-23T18:30:00.000Z')).toBe('24 Oct');       // midnight IST is the 24th, not the 23rd
    expect(istDay10('2026-10-23T18:30:00.000Z')).toBe('2026-10-24');
    expect(istToIso(2026, 9, 18, 11, 0)).toBe('2026-10-18T05:30:00.000Z');
    expect(istParts('2026-10-18T05:30:00.000Z')).toMatchObject({ h: 11, min: 0, d: 18 });
    expect(whenLine10(null)).toBe('');
  });
});

describe('the gate card (check 4)', () => {
  it('Pay for Content: three ticks with the amounts that moved; Pay for Sale: the signature only', () => {
    const pfc = render(<GateCard10 gate={{ open: true, reason: null, signed: { at: '2026-09-14T06:00:00Z' }, money: { required: true, locked: 9720, released: 2250 }, creatorName: 'Tanvi Suresh' }} />);
    expect(pfc.getByText('Signed by both on 14 Sep')).toBeTruthy();
    expect(pfc.getByText('₹9,720 locked')).toBeTruthy();
    expect(pfc.getByText('₹2,250 released to Tanvi')).toBeTruthy();
    const pfs = render(<GateCard10 gate={{ open: true, reason: null, signed: { at: '2026-09-14T06:00:00Z' }, money: { required: false } }} />);
    expect(pfs.queryByText(/locked/)).toBeNull();
    expect(pfs.getAllByTestId(/gate-line-/)).toHaveLength(1);
    // A condition not yet met shows an hourglass instead of a tick (mockup V1).
    expect(pfc.getAllByTestId('gate-tick')).toHaveLength(3);
    const closed = render(<GateCard10 gate={{ open: false, reason: 'NOT_FUNDED', signed: { at: '2026-09-14T06:00:00Z' }, money: { required: true, locked: 0, released: 0 } }} />);
    expect(closed.getAllByTestId('gate-hourglass')).toHaveLength(2);
    expect(closed.getAllByTestId('gate-tick')).toHaveLength(1);       // the signature still holds
  });
});

describe('the step line and the time card', () => {
  it('draws done · now · later and the live/past time card', () => {
    const r = render(<StepLine10 steps={[{ key: 'signed', label: 'Agreement signed', state: 'done', detail: '14 Sep' }, { key: 'shoot', label: 'Shoot plan', state: 'now', detail: 'Send her a time' }, { key: 'content', label: 'Content', state: 'later' }, { key: 'live', label: 'Live and paid', state: 'later' }]} />);
    expect(r.getByTestId('step-signed-done')).toBeTruthy();
    expect(r.getByTestId('step-shoot-now')).toBeTruthy();
    expect(r.getByTestId('step-live-later')).toBeTruthy();
    const live = render(<TimeCard10 iso="2026-10-19T10:30:00.000Z" sub="About 2 hours" live />);
    expect(live.getByText('Mon 19 Oct, 4:00 pm')).toBeTruthy();     // 19 Oct 2026 is a Monday; the mockups' example data is not a calendar
    const past = render(<TimeCard10 iso="2026-10-19T10:30:00.000Z" sub="Passed" live={false} />);
    expect(past.getByText('Passed')).toBeTruthy();
  });

  it('the address card shows Maps and the call button only when it has an address and a number', () => {
    const r = render(<AddressCard10 branch={{ name: 'Banjara Hills', address: 'Road No. 12, Banjara Hills, Hyderabad', mapsUrl: 'https://www.google.com/maps/search/?api=1&query=17.41,78.44' }} contact={{ name: 'Ravi Menon', phone: '+919849011223' }} />);
    expect(r.getByTestId('open-in-maps')).toBeTruthy();
    expect(r.getByText('Ravi Menon')).toBeTruthy();
    const cityOnly = render(<AddressCard10 branch={{ name: 'Banjara Hills', city: 'Hyderabad' }} contact={null} />);
    expect(cityOnly.queryByTestId('open-in-maps')).toBeNull();
    expect(cityOnly.queryByTestId('call-contact')).toBeNull();
  });
});

/* ── ui-walk-fixes board G — the Date and Time boxes ──────────────────────────────────────────
 * Contract: features/ui-walk-fixes · frames G1–G10 · checks 27, 28, 29 · decisions U7, U12.
 * These replace item 10's pill-picker tests (day-N / hour-N / minute-N): the pills are gone, so
 * each rule they pinned is asserted on the two boxes instead. See 06-diff/drift/G.md.
 */

// The clock on frame G3: Thursday 1 October 2026, 3:20 pm in India.
const AT_3_20_PM = new Date('2026-10-01T09:50:00.000Z');
const flat = (node) => StyleSheet.flatten(node.props.style) || {};

/**
 * Fix the clock for a block of tests, and make every one of them leave console.error silent —
 * React reports a badly built tree only there. (A press also starts TouchableOpacity's fade; with
 * real timers it lands after the test and warns about act().)
 */
function clockAt(now) {
  let errorSpy;
  beforeEach(() => {
    jest.useFakeTimers({ now });
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    const said = errorSpy.mock.calls.map((args) => args.map(String).join(' ').split('\n')[0]);
    errorSpy.mockRestore();
    jest.useRealTimers();
    expect(said).toEqual([]);
  });
}

/** A parent that keeps the value, as the three real callers do. */
function Held({ initial = null, onChange, ...props }) {
  const [v, setV] = React.useState(initial);
  return <TimePicker10 value={v} onChange={(x) => { if (onChange) onChange(x); setV(x); }} {...props} />;
}

const openDate = (r) => fireEvent.press(r.getByTestId('pick-date'));
const openTime = (r) => fireEvent.press(r.getByTestId('pick-time'));
const pickDay = (r, day) => { openDate(r); fireEvent.press(r.getByTestId(`day-${day}`)); };
const pickTime = (r, id) => { openTime(r); fireEvent.press(r.getByTestId(`time-${id}`)); };
const dateBox = (r) => within(r.getByTestId('pick-date'));
const timeBox = (r) => within(r.getByTestId('pick-time'));
const slotAt = (h, min) => SLOTS10.findIndex((s) => s.h === h && s.min === min);
// The calendar that is open: its day cells, the ones that can be tapped, and an arrow's colour.
const DAY_CELL = /^day-\d{4}-\d\d-\d\d$/;
const openCells = (r) => r.getAllByTestId(DAY_CELL).filter((n) => n.props.accessibilityState.disabled === false).map((n) => n.props.testID);
const arrowColor = (r, id) => flat(within(r.getByTestId(id)).getByText(/^[‹›]$/)).color;

describe('the picker is two boxes with nothing chosen for her (board G · check 27)', () => {
  clockAt(AT_3_20_PM);

  it('G1 — both boxes read grey, no pill and no bold line is drawn, and nothing is sent before a tap', () => {
    const onChange = jest.fn();
    const r = render(<Held onChange={onChange} maxDay="2026-10-24" />);
    expect(r.getByText('Date *')).toBeTruthy();
    expect(r.getByText('Time *')).toBeTruthy();
    expect(dateBox(r).getByText('Choose a date')).toBeTruthy();
    expect(dateBox(r).getByText('calendar-blank-outline')).toBeTruthy();      // the calendar mark
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();
    expect(timeBox(r).getByText('clock-outline')).toBeTruthy();               // the clock mark
    // What made a day and a time look chosen is gone: the pills and the bold summary line.
    expect(r.queryAllByTestId(/^(day|hour|minute)-/)).toHaveLength(0);
    expect(r.queryByTestId('picked-time')).toBeNull();
    expect(r.queryByText(/11:00 am/)).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('a date alone sends nothing, and a time alone sends nothing', () => {
    const onChange = jest.fn();
    const r = render(<Held onChange={onChange} maxDay="2026-10-24" />);
    pickDay(r, '2026-10-18');
    expect(r.queryByTestId('date-sheet')).toBeNull();                         // one tap picks and closes
    expect(dateBox(r).getByText('18 Oct')).toBeTruthy();                      // short, as the board draws it
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();

    const other = jest.fn();
    const t = render(<Held onChange={other} maxDay="2026-10-24" />);
    pickTime(t, '11-00');
    expect(timeBox(t).getByText('11:00 am')).toBeTruthy();
    expect(dateBox(t).getByText('Choose a date')).toBeTruthy();
    expect(other).not.toHaveBeenCalled();
  });

  it('G4 — date + time sends the moment as it reads on an Indian clock, in either order', () => {
    const onChange = jest.fn();
    const r = render(<Held onChange={onChange} maxDay="2026-10-24" />);
    pickDay(r, '2026-10-18');
    pickTime(r, '11-00');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('2026-10-18T05:30:00.000Z');    // 11:00 am IST
    expect(onChange.mock.calls[0][0]).toBe(istToIso(2026, 9, 18, 11, 0));
    expect(dateBox(r).getByText('18 Oct')).toBeTruthy();
    expect(timeBox(r).getByText('11:00 am')).toBeTruthy();

    const other = jest.fn();
    const t = render(<Held onChange={other} maxDay="2026-10-24" />);
    pickTime(t, '16-00');
    pickDay(t, '2026-10-19');
    expect(other).toHaveBeenCalledTimes(1);
    expect(other).toHaveBeenLastCalledWith('2026-10-19T10:30:00.000Z');       // 4:00 pm IST
  });

  it('tapping either box again changes it, and each change sends the new moment', () => {
    const onChange = jest.fn();
    const r = render(<Held onChange={onChange} maxDay="2026-10-24" />);
    pickDay(r, '2026-10-18');
    pickTime(r, '11-00');
    pickTime(r, '16-15');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-18T10:45:00.000Z');
    pickDay(r, '2026-10-20');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-20T10:45:00.000Z');
    expect(onChange).toHaveBeenCalledTimes(3);
    // The same time tapped again is not a change.
    pickTime(r, '16-15');
    expect(onChange).toHaveBeenCalledTimes(3);
  });

  it('G4 — the date moved to today under a time that has gone: the Time box empties and the parent is told', () => {
    const onChange = jest.fn();
    const r = render(<Held onChange={onChange} maxDay="2026-10-24" />);
    pickDay(r, '2026-10-18');
    pickTime(r, '11-00');                                                     // fine on the 18th
    pickDay(r, '2026-10-01');                                                 // today, and it is 3:20 pm
    expect(dateBox(r).getByText('1 Oct')).toBeTruthy();
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();
    // The parent must not go on holding 18 Oct, 11:00 am — it would send a time the screen no longer shows.
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(onChange).toHaveBeenCalledTimes(2);
    // The date she chose is kept; a time still ahead completes it.
    pickTime(r, '16-00');
    expect(onChange).toHaveBeenLastCalledWith('2026-10-01T10:30:00.000Z');
  });

  it('a time still ahead on the new date is kept', () => {
    const onChange = jest.fn();
    const r = render(<Held onChange={onChange} maxDay="2026-10-24" />);
    pickDay(r, '2026-10-18');
    pickTime(r, '17-30');
    pickDay(r, '2026-10-01');                                                 // 5:30 pm today is still ahead
    expect(timeBox(r).getByText('5:30 pm')).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith('2026-10-01T12:00:00.000Z');
  });

  it('follows the parent when the value CHANGES: a value shows in both boxes, null empties both, and a half held privately goes with the change', () => {
    const r = render(<TimePicker10 value="2026-10-19T10:30:00.000Z" onChange={() => {}} maxDay="2026-10-24" />);
    expect(dateBox(r).getByText('19 Oct')).toBeTruthy();
    expect(timeBox(r).getByText('4:00 pm')).toBeTruthy();
    r.rerender(<TimePicker10 value={null} onChange={() => {}} maxDay="2026-10-24" />);
    expect(dateBox(r).getByText('Choose a date')).toBeTruthy();
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();
    // A half held privately is dropped when the value moves to a moment and back to null.
    pickDay(r, '2026-10-20');
    expect(dateBox(r).getByText('20 Oct')).toBeTruthy();
    r.rerender(<TimePicker10 value="2026-10-19T10:30:00.000Z" onChange={() => {}} maxDay="2026-10-24" />);
    r.rerender(<TimePicker10 value={null} onChange={() => {}} maxDay="2026-10-24" />);
    expect(dateBox(r).getByText('Choose a date')).toBeTruthy();
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();
  });

  it('null handed over a second time changes nothing: it is not a way to start again, and her half-made choice stays', () => {
    // While only one box is filled the parent holds null. Drawing again with the same null — which
    // every keystroke elsewhere on the screen does — must not throw her date away.
    const picker = (extra = {}) => <TimePicker10 value={null} onChange={() => {}} maxDay="2026-10-24" {...extra} />;
    const r = render(picker());
    pickDay(r, '2026-10-20');
    r.rerender(picker());
    r.rerender(picker({ error: true }));
    expect(dateBox(r).getByText('20 Oct')).toBeTruthy();
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();
  });

  it('`resetKey` — a parent already holding null starts again without the value changing: the half-chosen date, or time, is dropped', () => {
    const onChange = jest.fn();
    const picker = (turn) => <TimePicker10 value={null} onChange={onChange} maxDay="2026-10-24" resetKey={turn} />;
    const r = render(picker(1));
    pickDay(r, '2026-10-20');                                                 // a date and no time
    expect(dateBox(r).getByText('20 Oct')).toBeTruthy();
    r.rerender(picker(1));                                                    // the same turn: still hers
    expect(dateBox(r).getByText('20 Oct')).toBeTruthy();
    r.rerender(picker(2));                                                    // value is null before AND after
    expect(dateBox(r).getByText('Choose a date')).toBeTruthy();
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();

    pickTime(r, '11-00');                                                     // a time and no date
    expect(timeBox(r).getByText('11:00 am')).toBeTruthy();
    r.rerender(picker(3));
    expect(dateBox(r).getByText('Choose a date')).toBeTruthy();
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();
    // Starting again is not a choice: the parent is told nothing, and the next whole choice is told once.
    expect(onChange).not.toHaveBeenCalled();
    pickDay(r, '2026-10-18');
    pickTime(r, '11-00');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('2026-10-18T05:30:00.000Z');
  });

  it('`resetKey` — with a moment held, starting again puts both boxes back on it; a picker never given a key is unchanged', () => {
    const AGREED = '2026-10-19T10:30:00.000Z';
    const picker = (turn) => <TimePicker10 value={AGREED} onChange={() => {}} maxDay="2026-10-24" resetKey={turn} />;
    const r = render(picker(0));
    r.rerender(picker(1));
    expect(dateBox(r).getByText('19 Oct')).toBeTruthy();
    expect(timeBox(r).getByText('4:00 pm')).toBeTruthy();
    // No key at all (the plan screen, the counter screen): draw after draw, her half-made choice stays.
    const plain = render(<TimePicker10 value={null} onChange={() => {}} maxDay="2026-10-24" />);
    pickDay(plain, '2026-10-20');
    plain.rerender(<TimePicker10 value={null} onChange={() => {}} maxDay="2026-10-24" />);
    expect(dateBox(plain).getByText('20 Oct')).toBeTruthy();
  });

  it('the Date box puts the keypad away before its calendar opens, as the Time box does', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
    const r = render(<Held maxDay="2026-10-24" />);
    openDate(r);
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(r.getByTestId('date-sheet')).toBeTruthy();
    fireEvent.press(r.getByTestId('day-2026-10-18'));
    openTime(r);
    expect(dismiss).toHaveBeenCalledTimes(2);
    expect(r.getByTestId('time-sheet')).toBeTruthy();
    dismiss.mockRestore();
  });

  it('G5 — a refusal is one red line under the pair, and the boxes it points at are outlined red', () => {
    const r = render(<Held maxDay="2026-10-24" error={MSG10.TIME_REQUIRED} />);
    expect(r.getByText('Choose a date and time.')).toBeTruthy();
    expect(flat(r.getByTestId('pick-date')).borderColor).toBe(T.danger);
    expect(flat(r.getByTestId('pick-time')).borderColor).toBe(T.danger);
    // With the date chosen only the empty box is still pointed at.
    pickDay(r, '2026-10-18');
    expect(flat(r.getByTestId('pick-date')).borderColor).toBe(T.border);
    expect(flat(r.getByTestId('pick-time')).borderColor).toBe(T.danger);
    // Both filled and still refused ("Choose a time in the future."): the pair is outlined.
    const both = render(<TimePicker10 value="2026-10-18T05:30:00.000Z" onChange={() => {}} maxDay="2026-10-24" error={MSG10.TIME_IN_PAST} />);
    expect(both.getByText('Choose a time in the future.')).toBeTruthy();
    expect(flat(both.getByTestId('pick-date')).borderColor).toBe(T.danger);
    expect(flat(both.getByTestId('pick-time')).borderColor).toBe(T.danger);
    // No refusal, no red.
    const calm = render(<Held maxDay="2026-10-24" />);
    expect(flat(calm.getByTestId('pick-date')).borderColor).toBe(T.border);
    expect(flat(calm.getByTestId('pick-time')).borderColor).toBe(T.border);
  });

  it('keeps the caller\'s testID, and the move sheet may call the first box "New date"', () => {
    const r = render(<TimePicker10 value={null} onChange={() => {}} maxDay="2026-10-24" testID="plan-picker" />);
    expect(r.getByTestId('plan-picker')).toBeTruthy();
    expect(r.getByText('Date *')).toBeTruthy();
    const m = render(<TimePicker10 value={null} onChange={() => {}} maxDay="2026-10-24" dateLabel={C10.brand.newDate} />);
    expect(m.getByText('New date *')).toBeTruthy();
    expect(m.queryByText('Date *')).toBeNull();
  });
});

describe('what can be chosen (board G · check 28 — was item 10 check 6)', () => {
  clockAt(AT_3_20_PM);

  it('G2 — the calendar is open from today in India to the posting day, and no day after it', () => {
    const onChange = jest.fn();
    const r = render(<Held onChange={onChange} maxDay="2026-10-24" />);
    openDate(r);
    const off = (day) => r.getByTestId(`day-${day}`).props.accessibilityState.disabled;
    expect(off('2026-10-01')).toBe(false);                                    // today
    expect(off('2026-10-24')).toBe(false);                                    // the posting day
    expect(off('2026-10-25')).toBe(true);                                     // the day after — never offered
    expect(off('2026-10-31')).toBe(true);
    // Every day on offer, counted (the old strip's test counted its pills): the 1st to the 24th
    // and not one more.
    expect(openCells(r)).toEqual(Array.from({ length: 24 }, (_, i) => `day-2026-10-${String(i + 1).padStart(2, '0')}`));
    expect(r.getAllByTestId(DAY_CELL)).toHaveLength(31);
    // "Both arrows are grey because no other month has a day she can shoot" — and a grey arrow
    // goes nowhere: the month does not turn, so no day outside the 1st–24th can even be reached.
    expect(r.getByText('October 2026')).toBeTruthy();
    for (const id of ['date-prev', 'date-next']) {
      expect(arrowColor(r, id)).toBe(T.ink3);
      fireEvent.press(r.getByTestId(id));
      expect(r.getByText('October 2026')).toBeTruthy();
      expect(r.getByTestId('day-2026-10-01')).toBeTruthy();
      expect(r.queryAllByTestId(/^day-2026-(09|11)-/)).toHaveLength(0);
    }
    // A grey day cannot be tapped: the calendar stays open and nothing is chosen.
    fireEvent.press(r.getByTestId('day-2026-10-25'));
    expect(r.getByTestId('date-sheet')).toBeTruthy();
    expect(dateBox(r).getByText('Choose a date')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    // Opened a second time, the chosen day is the marked one.
    fireEvent.press(r.getByTestId('day-2026-10-18'));
    openDate(r);
    expect(r.getByTestId('day-2026-10-18').props.accessibilityState.selected).toBe(true);
    expect(r.getByTestId('day-2026-10-17').props.accessibilityState.selected).toBe(false);
  });

  it('G2 — an arrow is live only towards a month that holds a day she can shoot, and stops there', () => {
    const onChange = jest.fn();
    const r = render(<Held onChange={onChange} maxDay="2026-11-05" />);       // the posting day is next month
    openDate(r);
    expect(r.getByText('October 2026')).toBeTruthy();
    expect(openCells(r)).toHaveLength(31);                                    // today is the 1st: the whole month
    expect(arrowColor(r, 'date-prev')).toBe(T.ink3);                          // September has gone
    expect(arrowColor(r, 'date-next')).toBe(T.ink);
    fireEvent.press(r.getByTestId('date-prev'));
    expect(r.getByText('October 2026')).toBeTruthy();
    fireEvent.press(r.getByTestId('date-next'));
    expect(r.getByText('November 2026')).toBeTruthy();
    // November is open up to the posting day and no further.
    expect(openCells(r)).toEqual(['day-2026-11-01', 'day-2026-11-02', 'day-2026-11-03', 'day-2026-11-04', 'day-2026-11-05']);
    expect(r.getAllByTestId(DAY_CELL)).toHaveLength(30);
    expect(arrowColor(r, 'date-next')).toBe(T.ink3);                          // December has no day
    expect(arrowColor(r, 'date-prev')).toBe(T.ink);
    fireEvent.press(r.getByTestId('date-next'));
    expect(r.getByText('November 2026')).toBeTruthy();
    expect(r.queryAllByTestId(/^day-2026-12-/)).toHaveLength(0);
    // Back to October, and no further back.
    fireEvent.press(r.getByTestId('date-prev'));
    expect(r.getByText('October 2026')).toBeTruthy();
    fireEvent.press(r.getByTestId('date-prev'));
    expect(r.getByText('October 2026')).toBeTruthy();
    // The posting day itself, a month away, can be chosen and is what is sent.
    fireEvent.press(r.getByTestId('date-next'));
    fireEvent.press(r.getByTestId('day-2026-11-05'));
    expect(dateBox(r).getByText('5 Nov')).toBeTruthy();
    pickTime(r, '11-00');
    expect(onChange).toHaveBeenLastCalledWith('2026-11-05T05:30:00.000Z');
    // Opened again, the calendar is on the month of the chosen day.
    openDate(r);
    expect(r.getByText('November 2026')).toBeTruthy();
  });

  it('G3 — on today\'s date the times already gone are grey and cannot be tapped', () => {
    const onChange = jest.fn();
    const r = render(<Held onChange={onChange} maxDay="2026-10-24" />);
    pickDay(r, '2026-10-01');
    openTime(r);
    const rows = r.getAllByTestId(/^time-\d+-\d\d$/);
    expect(rows).toHaveLength(56);                                            // 7:00 am … 8:45 pm, every 15 minutes
    expect(within(rows[0]).getByText('7:00 am')).toBeTruthy();
    expect(within(rows[55]).getByText('8:45 pm')).toBeTruthy();
    const state = (id) => r.getByTestId(`time-${id}`).props.accessibilityState;
    expect(state('15-15')).toEqual({ disabled: true, selected: false });      // 3:15 pm has gone at 3:20
    expect(state('15-30')).toEqual({ disabled: false, selected: false });     // 3:30 pm is the first still open
    expect(rows.filter((n) => n.props.accessibilityState.disabled)).toHaveLength(slotAt(15, 30));
    // Android reads these with getBoolean: a null or an undefined closes the app.
    for (const n of rows) {
      expect(typeof n.props.accessibilityState.disabled).toBe('boolean');
      expect(typeof n.props.accessibilityState.selected).toBe('boolean');
    }
    // A grey time does nothing: the list stays open, nothing is chosen, nothing is sent.
    fireEvent.press(r.getByTestId('time-15-15'));
    expect(r.getByTestId('time-sheet')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    // One tap on an open time picks it and closes the list.
    fireEvent.press(r.getByTestId('time-16-00'));
    expect(r.queryByTestId('time-sheet')).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith('2026-10-01T10:30:00.000Z');
    // Opened a second time, the chosen one carries the tick.
    openTime(r);
    expect(state('16-00')).toEqual({ disabled: false, selected: true });
    expect(within(r.getByTestId('time-16-00')).getByTestId('time-tick')).toBeTruthy();
    expect(r.getAllByTestId('time-tick')).toHaveLength(1);
  });

  it('G3 — on any later day, and before a day is chosen, the whole list is open', () => {
    const r = render(<Held maxDay="2026-10-24" />);
    openTime(r);
    expect(r.getAllByTestId(/^time-\d+-\d\d$/).filter((n) => n.props.accessibilityState.disabled)).toHaveLength(0);
    fireEvent.press(r.getByLabelText('Close'));
    pickDay(r, '2026-10-18');
    openTime(r);
    expect(r.getAllByTestId(/^time-\d+-\d\d$/).filter((n) => n.props.accessibilityState.disabled)).toHaveLength(0);
  });

  it('U12 — the list opens at the chosen time, else at the first time still open', () => {
    const r = render(<Held maxDay="2026-10-24" />);
    // Nothing chosen, a later day: from the top.
    openTime(r);
    expect(r.getByTestId('time-list').props.contentOffset).toEqual({ x: 0, y: 0 });
    fireEvent.press(r.getByLabelText('Close'));
    // Today at 3:20 pm, nothing chosen: at 3:30 pm, with two rows left showing above it.
    pickDay(r, '2026-10-01');
    openTime(r);
    expect(r.getByTestId('time-list').props.contentOffset).toEqual({ x: 0, y: (slotAt(15, 30) - 2) * ROW_H10 });
    // A time chosen: at that time.
    fireEvent.press(r.getByTestId('time-19-00'));
    openTime(r);
    expect(r.getByTestId('time-list').props.contentOffset).toEqual({ x: 0, y: (slotAt(19, 0) - 2) * ROW_H10 });
  });

  it('G10 — a posting date already passed offers nothing: one red line in place of the boxes', () => {
    const r = render(<TimePicker10 value={null} onChange={() => {}} maxDay="2020-01-01" testID="plan-picker" />);
    expect(r.getByText('No day works — the posting date has passed.')).toBeTruthy();
    expect(flat(r.getByTestId('no-day-works')).color).toBe(T.danger);
    expect(r.queryByTestId('pick-date')).toBeNull();
    expect(r.queryByTestId('pick-time')).toBeNull();
    expect(r.queryAllByTestId(/^day-/)).toHaveLength(0);
    expect(r.getByTestId('plan-picker')).toBeTruthy();
  });

  it('late in the evening today is grey in the calendar: the first day on offer is tomorrow', () => {
    jest.setSystemTime(new Date('2026-10-01T15:20:00.000Z'));                 // 8:50 pm in India — 8:45 pm has gone
    const r = render(<Held maxDay="2026-10-24" />);
    openDate(r);
    expect(r.getByTestId('day-2026-10-01').props.accessibilityState.disabled).toBe(true);
    expect(r.getByTestId('day-2026-10-02').props.accessibilityState.disabled).toBe(false);
    // And when the posting day is today, nothing is left at all.
    const none = render(<TimePicker10 value={null} onChange={() => {}} maxDay="2026-10-01" />);
    expect(none.getByTestId('no-day-works')).toBeTruthy();
    expect(none.queryByTestId('pick-date')).toBeNull();
  });

  it('the days on offer are counted on an Indian clock, never the phone\'s', () => {
    const at = (iso) => new Date(iso).getTime();
    // 3:20 pm on 1 Oct in India.
    expect(openDays10('2026-10-24', undefined, at('2026-10-01T09:50:00.000Z'))).toEqual({ min: '2026-10-01', max: '2026-10-24', none: false });
    // 12:30 am on 2 Oct in India is still 1 Oct in UTC — the first day is the 2nd.
    expect(openDays10('2026-10-24', undefined, at('2026-10-01T19:00:00.000Z')).min).toBe('2026-10-02');
    // 8:45 pm exactly: the last time today has gone, so today has.
    expect(openDays10('2026-10-24', undefined, at('2026-10-01T15:15:00.000Z')).min).toBe('2026-10-02');
    expect(openDays10('2026-10-24', undefined, at('2026-10-01T15:14:59.000Z')).min).toBe('2026-10-01');
    // The posting day itself is the last day, and the day after it there is none.
    expect(openDays10('2026-10-24', undefined, at('2026-10-24T04:30:00.000Z'))).toEqual({ min: '2026-10-24', max: '2026-10-24', none: false });
    expect(openDays10('2026-10-24', undefined, at('2026-10-24T18:45:00.000Z')).none).toBe(true);     // 12:15 am on the 25th
    expect(openDays10('2026-10-24', undefined, at('2026-10-24T15:15:00.000Z')).none).toBe(true);     // the 24th, 8:45 pm
    // A time has gone at its own minute, not before; with no day chosen nothing has gone.
    expect(slotGone10('2026-10-01', { h: 15, min: 30 }, at('2026-10-01T09:59:59.000Z'))).toBe(false);
    expect(slotGone10('2026-10-01', { h: 15, min: 30 }, at('2026-10-01T10:00:00.000Z'))).toBe(true);
    expect(slotGone10(null, { h: 7, min: 0 }, at('2026-10-01T10:00:00.000Z'))).toBe(false);
  });

  // U7 / item 10 Q8, the half that is kept: the phone's own Android clock stays unused. Three
  // item 10 documents said a guard test enforced this; none existed. This is it.
  it('no file in the app imports the Android date or time picker', () => {
    const fs = require('fs');
    const path = require('path');
    const SRC = path.resolve(__dirname, '..', '..', '..');
    const files = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p); }
        else if (e.name.endsWith('.js')) files.push(p);
      }
    })(SRC);
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.filter((f) => /['"]@react-native-community\/datetimepicker['"]/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});

describe('Move the visit — the sheet (board G, frames G7–G9 · check 29)', () => {
  clockAt(AT_3_20_PM);

  const AGREED = '2026-10-19T10:30:00.000Z';                                  // 19 Oct, 4:00 pm
  const sheet = (props = {}) => (
    <MoveTimeSheet10 visible side="brand" otherName="Tanvi Suresh" currentAt={AGREED} postingDate="2026-10-24"
      onSend={() => {}} onClose={() => {}} {...props} />
  );

  it('G7 — agreed time still ahead: the boxes open showing it, and the line reads "→ —" until something changes', () => {
    const onSend = jest.fn();
    const r = render(sheet({ onSend }));
    expect(r.getByText('Move the visit?')).toBeTruthy();
    expect(r.getByText('New date *')).toBeTruthy();
    expect(r.getByText('Time *')).toBeTruthy();
    expect(dateBox(r).getByText('19 Oct')).toBeTruthy();
    expect(timeBox(r).getByText('4:00 pm')).toBeTruthy();
    const line = within(r.getByTestId('move-change'));
    expect(line.getByText('Agreed')).toBeTruthy();
    expect(line.getByText('19 Oct, 4:00 pm')).toBeTruthy();
    expect(line.getByText('—')).toBeTruthy();
    expect(r.getByText('Tanvi has to agree the new time. It still has to be before 24 Oct.')).toBeTruthy();
    // Sending the agreed time back is refused before it leaves the phone.
    fireEvent.press(r.getByTestId('move-send'));
    expect(r.getByText('Choose a different time before you send this.')).toBeTruthy();
    expect(onSend).not.toHaveBeenCalled();
    // Only what changes needs a tap.
    pickDay(r, '2026-10-21');
    pickTime(r, '11-00');
    expect(r.queryByText('Choose a different time before you send this.')).toBeNull();
    expect(line.getByText('21 Oct, 11:00 am')).toBeTruthy();
    expect(line.queryByText('—')).toBeNull();
    fireEvent.changeText(r.getByTestId('move-note'), '  The store is closed that day for a private event.  ');
    fireEvent.press(r.getByTestId('move-send'));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith({ visitAt: '2026-10-21T05:30:00.000Z', note: 'The store is closed that day for a private event.' });
  });

  it('G8 — agreed time already passed: both boxes start empty', () => {
    const onSend = jest.fn();
    const r = render(sheet({ currentAt: '2026-09-30T05:30:00.000Z', onSend }));  // yesterday, 11:00 am
    expect(dateBox(r).getByText('Choose a date')).toBeTruthy();
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();
    const line = within(r.getByTestId('move-change'));
    expect(line.getByText('30 Sep, 11:00 am')).toBeTruthy();
    expect(line.getByText('—')).toBeTruthy();
    fireEvent.press(r.getByTestId('move-send'));
    expect(r.getByText('Choose a date and time.')).toBeTruthy();
    expect(flat(r.getByTestId('pick-date')).borderColor).toBe(T.danger);
    expect(flat(r.getByTestId('pick-time')).borderColor).toBe(T.danger);
    expect(onSend).not.toHaveBeenCalled();
    pickDay(r, '2026-10-03');
    pickTime(r, '10-30');
    fireEvent.press(r.getByTestId('move-send'));
    expect(onSend).toHaveBeenCalledWith({ visitAt: '2026-10-03T05:00:00.000Z', note: undefined });
  });

  it('an agreed time later today is still ahead; the moment it passes the sheet opens empty', () => {
    const today4pm = '2026-10-01T10:30:00.000Z';
    const r = render(sheet({ currentAt: today4pm }));
    expect(dateBox(r).getByText('1 Oct')).toBeTruthy();
    expect(timeBox(r).getByText('4:00 pm')).toBeTruthy();
    jest.setSystemTime(new Date(today4pm));                                   // 4:00 pm exactly — it has gone
    const late = render(sheet({ currentAt: today4pm }));
    expect(dateBox(late).getByText('Choose a date')).toBeTruthy();
    expect(timeBox(late).getByText('Choose a time')).toBeTruthy();
  });

  it('every opening starts again: no choice, no reason and no refusal come back from the last one', () => {
    const r = render(sheet({ currentAt: '2026-09-30T05:30:00.000Z' }));
    pickDay(r, '2026-10-05');                                                 // a half-finished choice
    fireEvent.changeText(r.getByTestId('move-note'), 'Half a reason');
    fireEvent.press(r.getByTestId('move-send'));
    expect(r.getByText('Choose a date and time.')).toBeTruthy();
    r.rerender(sheet({ currentAt: '2026-09-30T05:30:00.000Z', visible: false }));
    expect(r.queryByTestId('move-time-sheet')).toBeNull();
    r.rerender(sheet({ currentAt: '2026-09-30T05:30:00.000Z' }));
    expect(dateBox(r).getByText('Choose a date')).toBeTruthy();
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();
    expect(r.getByTestId('move-note').props.value).toBe('');
    expect(r.queryByText('Choose a date and time.')).toBeNull();

    // And a whole choice: it does not come back either — the sheet shows the agreed time again.
    const s = render(sheet());
    pickDay(s, '2026-10-21');
    expect(dateBox(s).getByText('21 Oct')).toBeTruthy();
    s.rerender(sheet({ visible: false }));
    s.rerender(sheet());
    expect(dateBox(s).getByText('19 Oct')).toBeTruthy();
    expect(timeBox(s).getByText('4:00 pm')).toBeTruthy();
    expect(within(s.getByTestId('move-change')).getByText('—')).toBeTruthy();
  });

  it('each opening hands the picker a new `resetKey` — the start-again that does not depend on the time it holds changing', () => {
    // With the agreed time passed the sheet holds null on every opening, so null alone could
    // never tell the picker to drop a date picked with no time. The key can.
    const past = { currentAt: '2026-09-30T05:30:00.000Z' };
    const r = render(sheet(past));
    const first = r.UNSAFE_getByType(TimePicker10).props.resetKey;
    expect(r.UNSAFE_getByType(TimePicker10).props.value).toBeNull();
    pickDay(r, '2026-10-05');
    expect(r.UNSAFE_getByType(TimePicker10).props.resetKey).toBe(first);     // not while it is open
    r.rerender(sheet({ ...past, visible: false }));
    r.rerender(sheet(past));
    const second = r.UNSAFE_getByType(TimePicker10).props.resetKey;
    expect(second).not.toBe(first);
    expect(r.UNSAFE_getByType(TimePicker10).props.value).toBeNull();
    expect(dateBox(r).getByText('Choose a date')).toBeTruthy();
    r.rerender(sheet({ ...past, visible: false }));
    r.rerender(sheet(past));
    expect(r.UNSAFE_getByType(TimePicker10).props.resetKey).not.toBe(second);
  });

  it('a sheet that was closed when the screen drew opens the same way: showing the agreed time only while it is ahead', () => {
    const r = render(sheet({ visible: false }));
    expect(r.queryByTestId('move-time-sheet')).toBeNull();
    r.rerender(sheet());
    expect(dateBox(r).getByText('19 Oct')).toBeTruthy();
    expect(timeBox(r).getByText('4:00 pm')).toBeTruthy();
    const p = render(sheet({ visible: false, currentAt: '2026-09-30T05:30:00.000Z' }));
    p.rerender(sheet({ currentAt: '2026-09-30T05:30:00.000Z' }));
    expect(dateBox(p).getByText('Choose a date')).toBeTruthy();
    expect(timeBox(p).getByText('Choose a time')).toBeTruthy();
  });

  it('a time that has gone is refused on the phone, in the words the other two surfaces use', () => {
    const onSend = jest.fn();
    const r = render(sheet({ onSend }));
    pickDay(r, '2026-10-01');
    pickTime(r, '15-30');                                                     // 3:30 pm today — ten minutes ahead
    jest.setSystemTime(new Date('2026-10-01T10:10:00.000Z'));                 // she waits; it is now 3:40 pm
    fireEvent.press(r.getByTestId('move-send'));
    expect(r.getByText('Choose a time in the future.')).toBeTruthy();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('G9 — the body scrolls and the two buttons are pinned under it, so they stay above the keypad', () => {
    const r = render(sheet({ serverError: 'Choose a time on or before the posting date.' }));
    const body = within(r.getByTestId('move-time-sheet-body'));
    const footer = within(r.getByTestId('move-time-sheet-footer'));
    expect(body.getByTestId('move-picker')).toBeTruthy();
    expect(body.getByTestId('move-note')).toBeTruthy();
    expect(body.queryByTestId('move-send')).toBeNull();
    expect(footer.getByTestId('move-send')).toBeTruthy();
    expect(footer.getByTestId('move-cancel')).toBeTruthy();
    // The sheet can shrink to the room between the status bar and the keypad.
    expect(flat(r.getByTestId('move-time-sheet'))).toMatchObject({ flexShrink: 1, maxHeight: '100%' });
    // A refusal the server sends back is said inside the sheet, with the button she pressed.
    expect(footer.getByText('Choose a time on or before the posting date.')).toBeTruthy();
  });

  it('on the creator\'s phone the title and the hint are hers; "Not yet" closes', () => {
    const onClose = jest.fn();
    const r = render(sheet({ side: 'influencer', otherName: 'Urban Threads', onClose }));
    expect(r.getByText('Ask to move the visit?')).toBeTruthy();
    expect(r.getByText('Urban Threads have to agree the new time. It still has to be before 24 Oct.')).toBeTruthy();
    fireEvent.press(r.getByTestId('move-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('the screens that hold the picker (board G, frames G5, G6, G10)', () => {
  clockAt(AT_3_20_PM);

  const api = require('../../../services/api');
  const SHOOT = {
    stage: 'not_sent', mode: 'visit', setName: 'Set A', postingDate: '2026-10-24',
    creator: { name: 'Tanvi Suresh' }, brand: { name: 'Urban Threads' },
    branchNow: { name: 'Banjara Hills', address: 'Road No. 12, Banjara Hills, Hyderabad' },
    contactPrefill: { phone: '+919849011223' },
  };
  const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn() });
  // Each stand-in for the server is put back by name — never restoreAllMocks, which would also
  // empty the console.error watch above before it is read.
  let spies = [];
  const serverSays = (obj, name, value) => { const spy = jest.spyOn(obj, name).mockResolvedValue(value); spies.push(spy); return spy; };
  afterEach(() => { spies.forEach((spy) => spy.mockRestore()); spies = []; });

  async function planScreen(shoot = SHOOT, navigation = nav()) {
    serverSays(api.brandApi, 'getShoot', { success: true, data: { shoot } });
    const Screen = require('../../../screens/brand/BrandShootPlanScreen').default;
    const r = render(<Screen navigation={navigation} route={{ params: { campaignId: 'c1', setId: 's1', ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('brand-shoot-plan'));
    return r;
  }

  it('G5 — Plan the visit: Send with nothing chosen outlines both boxes and says so under them', async () => {
    const r = await planScreen();
    expect(dateBox(r).getByText('Choose a date')).toBeTruthy();
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();
    expect(r.getByTestId('dates-hint')).toBeTruthy();                         // the hint line stays (U10)
    fireEvent.press(r.getByTestId('send-to'));
    expect(within(r.getByTestId('plan-picker')).getByText('Choose a date and time.')).toBeTruthy();
    expect(r.getAllByText('Choose a date and time.')).toHaveLength(1);        // one line, not two
    expect(flat(r.getByTestId('pick-date')).borderColor).toBe(T.danger);
    expect(flat(r.getByTestId('pick-time')).borderColor).toBe(T.danger);
    expect(r.queryByTestId('send-plan-sheet')).toBeNull();
    // Choosing both clears it, and the confirm sheet shows the time she chose.
    fireEvent.changeText(r.getByTestId('contact-name'), 'Ravi Menon');
    pickDay(r, '2026-10-18');
    pickTime(r, '11-00');
    expect(r.queryByText('Choose a date and time.')).toBeNull();
    fireEvent.press(r.getByTestId('send-to'));
    expect(within(r.getByTestId('confirm-time')).getByText('18 Oct, 11:00 am')).toBeTruthy();
  });

  // Final review (check 27 · frames G4, G5). The picker's own tests prove the moment it hands its
  // screen, and the test above goes as far as the confirm sheet. This presses the last button: what
  // the brand chose and read on the sheet is what the server is sent, and the screen moves on to
  // the visit. The other two homes of the picker (Ask for another time, the move sheet) already
  // pinned their last hop; this one was unguarded.
  it('G4 / G5 — Plan the visit: the date and time chosen is what is sent, once, and the screen moves on to the visit', async () => {
    const navigation = nav();
    const send = serverSays(api.brandApi, 'sendShootPlan', { success: true, data: {} });
    const r = await planScreen(SHOOT, navigation);
    fireEvent.changeText(r.getByTestId('contact-name'), '  Ravi Menon ');
    pickDay(r, '2026-10-18');
    pickTime(r, '11-00');
    // Nothing goes to the server while she is choosing, nor when the confirm sheet opens.
    fireEvent.press(r.getByTestId('send-to'));
    expect(within(r.getByTestId('confirm-time')).getByText('18 Oct, 11:00 am')).toBeTruthy();
    expect(send).not.toHaveBeenCalled();
    expect(navigation.replace).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('send-plan-confirm'));
    // 18 Oct, 11:00 am on an Indian clock; her number as the server pre-filled it; the two
    // optional boxes left empty are sent as nothing, not as "".
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('c1', 's1', 'ci1', {
      contactName: 'Ravi Menon', contactPhone: '+919849011223', visitAt: '2026-10-18T05:30:00.000Z',
      durationText: undefined, notes: undefined,
    });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('BrandShoot', { campaignId: 'c1', setId: 's1', ciId: 'ci1', toast: C10.plan.sent }));
    expect(navigation.replace).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('Plan the visit: a changed choice is the one sent, with what she typed in the two optional boxes; a refusal stays in the sheet and the screen does not move', async () => {
    const navigation = nav();
    const send = serverSays(api.brandApi, 'sendShootPlan', { success: false, error: { code: 'VALIDATION_ERROR', message: 'That time is after the posting date.' } });
    const r = await planScreen(SHOOT, navigation);
    fireEvent.changeText(r.getByTestId('contact-name'), 'Ravi Menon');
    fireEvent.changeText(r.getByTestId('duration'), ' About 2 hours ');
    fireEvent.changeText(r.getByTestId('notes'), ' Bring the rust kurta. ');
    pickDay(r, '2026-10-18');
    pickTime(r, '11-00');
    pickDay(r, '2026-10-19');                                                // she changes her mind: the 19th…
    pickTime(r, '16-00');                                                    // …at 4:00 pm
    fireEvent.press(r.getByTestId('send-to'));
    expect(within(r.getByTestId('confirm-time')).getByText('19 Oct, 4:00 pm')).toBeTruthy();
    fireEvent.press(r.getByTestId('send-plan-confirm'));
    expect(send).toHaveBeenCalledWith('c1', 's1', 'ci1', {
      contactName: 'Ravi Menon', contactPhone: '+919849011223', visitAt: '2026-10-19T10:30:00.000Z',
      durationText: 'About 2 hours', notes: 'Bring the rust kurta.',
    });
    // The server's sentence is said inside the sheet she is looking at; nothing moved.
    await waitFor(() => expect(within(r.getByTestId('send-plan-sheet')).getByText('That time is after the posting date.')).toBeTruthy());
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('G10 — Plan the visit after the posting date: the red line in place of the boxes, and Send is off', async () => {
    const r = await planScreen({ ...SHOOT, postingDate: '2026-09-24' });
    expect(r.getByText('No day works — the posting date has passed.')).toBeTruthy();
    expect(r.queryByTestId('pick-date')).toBeNull();
    expect(r.getByTestId('dates-hint')).toBeTruthy();
    expect(r.getByTestId('send-to').props.accessibilityState).toEqual({ disabled: true });
    fireEvent.press(r.getByTestId('send-to'));
    expect(r.queryByText('Choose a date and time.')).toBeNull();
    expect(r.queryByTestId('send-plan-sheet')).toBeNull();
    // With a day still open the button is on.
    const open = await planScreen();
    expect(open.getByTestId('send-to').props.accessibilityState).toEqual({ disabled: false });
  });

  it('G6 — Ask for another time stays a full screen with the same two boxes, empty until she chooses', async () => {
    const shoot = { ...SHOOT, stage: 'sent', plan: { visitAt: '2026-10-18T05:30:00.000Z' }, thread: { negotiation: { countersUsed: 0, roundLimit: 2 } } };
    serverSays(api.influencerApi, 'myShoot', { success: true, data: { shoot } });
    const counter = serverSays(api.influencerApi, 'counterMyShootTime', { success: true, data: {} });
    const Screen = require('../../../screens/shared/ShootCounterScreen').default;
    const navigation = nav();
    const r = render(<Screen navigation={navigation} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId('shoot-counter'));
    expect(r.getByText('Ask for another time')).toBeTruthy();
    expect(r.getByText('Date *')).toBeTruthy();
    expect(dateBox(r).getByText('Choose a date')).toBeTruthy();
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();
    const line = within(r.getByTestId('change-time'));
    expect(line.getByText('18 Oct, 11:00 am')).toBeTruthy();
    expect(line.getByText('—')).toBeTruthy();
    // Send with nothing chosen: the refusal is under the boxes.
    fireEvent.press(r.getByTestId('send-counter'));
    expect(within(r.getByTestId('counter-picker')).getByText('Choose a date and time.')).toBeTruthy();
    expect(counter).not.toHaveBeenCalled();
    // Both chosen: the line shows what she was asked for and what she is asking for.
    pickDay(r, '2026-10-19');
    pickTime(r, '16-00');
    expect(line.getByText('19 Oct, 4:00 pm')).toBeTruthy();
    expect(r.queryByText('Choose a date and time.')).toBeNull();
    fireEvent.press(r.getByTestId('send-counter'));
    expect(counter).toHaveBeenCalledWith('ci1', { visitAt: '2026-10-19T10:30:00.000Z', note: undefined });
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('ShootThread', expect.objectContaining({ ciId: 'ci1' })));
  });
});

/* ── the doors to the move sheet, pressed on the real screens ─────────────────────────────────
 * Frames G7, G8 · check 29. The sheet's own tests hand it the agreed time directly. These press
 * the buttons that open it — the brand's three ("Move the visit", "Send a new time", "She didn't
 * come — send a new time") and the creator's one ("Ask to move this") — so what each screen hands
 * the sheet is pinned too: the time it calls agreed is the plan's agreed time and no other time
 * the shoot carries, the last day is the set's posting date, and neither a half-made choice nor a
 * refusal the server sent comes back on the next opening.
 * The shoot is in the shape shootPlan.service `read` answers with, per side.
 */
describe('the doors to the move sheet (board G, frames G7, G8 · check 29)', () => {
  clockAt(AT_3_20_PM);

  const api = require('../../../services/api');
  const FIRST = '2026-10-18T05:30:00.000Z';                                   // 18 Oct, 11:00 am — what the plan first asked for
  const AGREED = '2026-10-19T10:30:00.000Z';                                  // 19 Oct, 4:00 pm — what she asked for; the brand accepted
  const GONE = '2026-09-30T05:30:00.000Z';                                    // yesterday, 11:00 am

  // The plan first asked for 18 Oct, 11:00 am; she asked for `visitAt`; the brand accepted it. So
  // the shoot carries two times, and only one of them is the agreed one.
  const visit = (side, { stage = 'agreed', visitAt = AGREED, passed = false, attendedAt = null } = {}) => ({
    invitationId: 'ci1', shootId: 'ev1', contractId: 'k1',
    gate: { open: true, reason: null, signed: { at: '2026-09-14T06:00:00.000Z' }, money: { required: true, locked: 9720, released: 2250 } },
    aim: 'engagement', mode: 'visit', isVisit: true,
    campaignName: 'Diwali Edit', setName: 'Set A',
    brand: { name: 'Urban Threads' }, creator: { name: 'Tanvi Suresh' },
    postingDate: '2026-10-24', daysToPosting: 23,
    stage, stageLabel: null, passed,
    plan: {
      branch: { name: 'Banjara Hills', city: 'Hyderabad', address: 'Road No. 12, Banjara Hills, Hyderabad', state: 'Telangana', pincode: '500034', lat: null, lng: null, mapsUrl: null },
      contact: { name: 'Ravi Menon', phone: '+919849011223' },
      visitAt, visitWhen: whenLine10(visitAt), visitDay: istDay10(visitAt), isToday: false,
      durationText: 'About 2 hours', notes: null,
      sentAt: '2026-09-20T06:00:00.000Z', agreedAt: '2026-09-21T06:00:00.000Z', attendedAt, confirmedAt: null,
      autoConfirmedAt: null, autoConfirmDueAt: null, autoConfirmDays: null,
    },
    thread: {
      invitationId: 'ev1', anchor: 'shoot', shootId: 'ev1', visitAt, timeAgreedAt: '2026-09-21T06:00:00.000Z',
      negotiation: { id: 'n1', open: false, whoseMove: null, roundLimit: 2, countersUsed: 1, isLastRound: true, noRoundsLeft: false, outcome: 'agreed' },
      invitation: { terms: { visitAt: FIRST } },
      current: { visitAt },
      turns: [
        { id: 't2', by: 'brand', mine: side === 'brand', kind: 'accept', terms: { visitAt }, note: null },
        { id: 't1', by: 'influencer', mine: side !== 'brand', kind: 'counter', terms: { visitAt }, note: null },
      ],
      can: { counter: false, accept: false, decline: false, move: side === 'brand' || !attendedAt },
    },
    delayed: null,
    can: {
      plan: false, send: false, accept: false, counter: false,
      move: side === 'brand' || !attendedAt,
      markAttended: side === 'creator' && stage === 'agreed',
      confirm: side === 'brand' && stage === 'attended',
    },
    steps: [
      { key: 'signed', label: 'Agreement signed', state: 'done', detail: '14 Sep' },
      { key: 'shoot', label: 'Shoot plan', state: 'now', detail: 'Visit 19 Oct' },
      { key: 'content', label: 'Content', state: 'later', detail: 'After the shoot' },
      { key: 'live', label: 'Live and paid', state: 'later', detail: 'Posts 24 Oct' },
    ],
    contactPrefill: side === 'brand' ? { name: null, phone: '+919849011223' } : undefined,
    creatorPhone: side === 'brand' && passed ? '+919900011122' : undefined,
    branchNow: side === 'brand' ? { name: 'Banjara Hills', address: 'Road No. 12, Banjara Hills, Hyderabad', city: 'Hyderabad' } : undefined,
    legacyNoPostingDate: false,
  });

  const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), setParams: jest.fn() });
  let spies = [];
  const stand = (obj, name) => { const spy = jest.spyOn(obj, name); spies.push(spy); return spy; };
  afterEach(() => { spies.forEach((spy) => spy.mockRestore()); spies = []; });

  async function brandScreen(shoot) {
    stand(api.brandApi, 'getShoot').mockResolvedValue({ success: true, data: { shoot } });
    const Screen = require('../../../screens/brand/BrandShootScreen').default;
    const r = render(<Screen navigation={nav()} route={{ params: { campaignId: 'c1', setId: 's1', ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId(`brand-shoot-${shoot.stage}`));
    return r;
  }
  async function creatorScreen(shoot) {
    stand(api.influencerApi, 'myShoot').mockResolvedValue({ success: true, data: { shoot } });
    const Screen = require('../../../screens/influencer/ShootScreen').default;
    const r = render(<Screen navigation={nav()} route={{ params: { ciId: 'ci1' } }} />);
    await waitFor(() => r.getByTestId(`shoot-${shoot.stage}`));
    return r;
  }
  const agreedLine = (r) => within(r.getByTestId('move-change'));
  const showsEmpty = (r) => {
    expect(dateBox(r).getByText('Choose a date')).toBeTruthy();
    expect(timeBox(r).getByText('Choose a time')).toBeTruthy();
    expect(agreedLine(r).getByText('—')).toBeTruthy();
  };
  const showsAgreed = (r) => {
    expect(dateBox(r).getByText('19 Oct')).toBeTruthy();
    expect(timeBox(r).getByText('4:00 pm')).toBeTruthy();
    expect(agreedLine(r).getByText('19 Oct, 4:00 pm')).toBeTruthy();
    expect(agreedLine(r).getByText('—')).toBeTruthy();
  };

  it('G7 — brand · "Move the visit": the sheet opens on the plan\'s agreed time, closed by the set\'s posting date, and sends through', async () => {
    const r = await brandScreen(visit('brand'));
    expect(r.queryByTestId('move-time-sheet')).toBeNull();                    // closed until the door is pressed
    expect(r.queryByTestId('send-new-time')).toBeNull();                      // the time has not passed: one door, the quiet one
    fireEvent.press(r.getByTestId('move-visit'));
    expect(r.getByText('Move the visit?')).toBeTruthy();
    showsAgreed(r);                                                           // 19 Oct, 4:00 pm — not the 18 Oct, 11:00 am first asked for
    expect(r.getByText('Tanvi has to agree the new time. It still has to be before 24 Oct.')).toBeTruthy();
    // The time the sheet calls agreed is the one in the boxes: sent back unchanged, it is refused.
    const move = stand(api.brandApi, 'moveShoot').mockResolvedValue({ success: true, data: { shoot: visit('brand', { stage: 'sent' }) } });
    fireEvent.press(r.getByTestId('move-send'));
    expect(r.getByText('Choose a different time before you send this.')).toBeTruthy();
    expect(move).not.toHaveBeenCalled();
    // The calendar ends on the set's posting date.
    openDate(r);
    expect(r.getByTestId('day-2026-10-24').props.accessibilityState.disabled).toBe(false);
    expect(r.getByTestId('day-2026-10-25').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(r.getByTestId('day-2026-10-21'));
    pickTime(r, '11-00');
    expect(agreedLine(r).getByText('21 Oct, 11:00 am')).toBeTruthy();
    fireEvent.press(r.getByTestId('move-send'));
    expect(move).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledWith('c1', 's1', 'ci1', { visitAt: '2026-10-21T05:30:00.000Z', note: undefined });
    // The server's answer is the shoot as it now stands: the screen redraws from it and the sheet closes.
    await waitFor(() => r.getByTestId('brand-shoot-sent'));
    expect(r.queryByTestId('move-time-sheet')).toBeNull();
    expect(r.getByText('Sent. They have to agree the new time.')).toBeTruthy();
  });

  it('G8 — brand · "Send a new time" once the agreed time has passed: both boxes empty, on this opening and the next', async () => {
    const r = await brandScreen(visit('brand', { visitAt: GONE, passed: true }));
    expect(r.queryByTestId('move-visit')).toBeNull();
    fireEvent.press(r.getByTestId('send-new-time'));
    expect(r.getByText('Move the visit?')).toBeTruthy();
    showsEmpty(r);                                                            // not 30 Sep (gone), and not the 18 Oct first asked for
    expect(agreedLine(r).getByText('30 Sep, 11:00 am')).toBeTruthy();
    const move = stand(api.brandApi, 'moveShoot');
    fireEvent.press(r.getByTestId('move-send'));
    expect(within(r.getByTestId('move-time-sheet-footer')).getByText('Choose a date and time.')).toBeTruthy();
    expect(move).not.toHaveBeenCalled();
    // Half a choice and half a reason, then "Not yet"…
    pickDay(r, '2026-10-05');
    fireEvent.changeText(r.getByTestId('move-note'), 'Half a reason');
    fireEvent.press(r.getByTestId('move-cancel'));
    expect(r.queryByTestId('move-time-sheet')).toBeNull();
    // …and the same door again: nothing of it is left.
    fireEvent.press(r.getByTestId('send-new-time'));
    showsEmpty(r);
    expect(r.getByTestId('move-note').props.value).toBe('');
    expect(r.queryByText('Choose a date and time.')).toBeNull();
  });

  it('G8 — brand · "She didn\'t come — send a new time": empty once the agreed time has gone; showing it only while it is still ahead', async () => {
    const r = await brandScreen(visit('brand', { stage: 'attended', visitAt: GONE, attendedAt: '2026-09-30T08:00:00.000Z' }));
    fireEvent.press(r.getByTestId('she-didnt-come'));
    expect(r.getByText('Move the visit?')).toBeTruthy();
    showsEmpty(r);
    expect(agreedLine(r).getByText('30 Sep, 11:00 am')).toBeTruthy();
    // She may mark the visit from the moment the time is agreed (founder, 1 Oct), so this door can
    // also be pressed before the agreed time: the rule is the time, not the door.
    const early = await brandScreen(visit('brand', { stage: 'attended', attendedAt: '2026-10-01T08:00:00.000Z' }));
    fireEvent.press(early.getByTestId('she-didnt-come'));
    showsAgreed(early);
  });

  it('brand · a refusal the server sends back is said in the sheet, and is gone on the next opening', async () => {
    const r = await brandScreen(visit('brand'));
    const move = stand(api.brandApi, 'moveShoot').mockResolvedValue({ success: false, error: { code: 'TIME_AFTER_POSTING', message: 'Choose a time on or before the posting date.' } });
    fireEvent.press(r.getByTestId('move-visit'));
    pickDay(r, '2026-10-21');
    fireEvent.press(r.getByTestId('move-send'));
    expect(move).toHaveBeenCalledWith('c1', 's1', 'ci1', { visitAt: '2026-10-21T10:30:00.000Z', note: undefined });
    await waitFor(() => within(r.getByTestId('move-time-sheet-footer')).getByText('Choose a time on or before the posting date.'));
    expect(r.getByTestId('move-time-sheet')).toBeTruthy();                    // still open, her choice still in it
    expect(dateBox(r).getByText('21 Oct')).toBeTruthy();
    fireEvent.press(r.getByTestId('move-cancel'));
    expect(r.queryByTestId('move-time-sheet')).toBeNull();
    fireEvent.press(r.getByTestId('move-visit'));
    expect(r.queryByText('Choose a time on or before the posting date.')).toBeNull();
    showsAgreed(r);
  });

  it('creator · "Ask to move this": her title and hint, the agreed time while it is ahead, empty once it has passed, and it sends through', async () => {
    const r = await creatorScreen(visit('creator'));
    expect(r.queryByTestId('move-time-sheet')).toBeNull();
    fireEvent.press(r.getByTestId('ask-to-move'));
    expect(r.getByText('Ask to move the visit?')).toBeTruthy();
    showsAgreed(r);
    expect(r.getByText('Urban Threads have to agree the new time. It still has to be before 24 Oct.')).toBeTruthy();
    openDate(r);
    expect(r.getByTestId('day-2026-10-24').props.accessibilityState.disabled).toBe(false);
    expect(r.getByTestId('day-2026-10-25').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(r.getByTestId('day-2026-10-20'));
    const move = stand(api.influencerApi, 'moveMyShoot').mockResolvedValue({ success: true, data: { shoot: visit('creator', { stage: 'sent' }) } });
    fireEvent.changeText(r.getByTestId('move-note'), 'I am travelling on the 19th.');
    fireEvent.press(r.getByTestId('move-send'));
    expect(move).toHaveBeenCalledWith('ci1', { visitAt: '2026-10-20T10:30:00.000Z', note: 'I am travelling on the 19th.' });
    await waitFor(() => r.getByTestId('shoot-sent'));
    expect(r.queryByTestId('move-time-sheet')).toBeNull();

    // The agreed time came and went with nothing marked: the same door opens the sheet empty.
    const late = await creatorScreen(visit('creator', { visitAt: GONE, passed: true }));
    fireEvent.press(late.getByTestId('ask-to-move'));
    expect(late.getByText('Ask to move the visit?')).toBeTruthy();
    showsEmpty(late);
    expect(agreedLine(late).getByText('30 Sep, 11:00 am')).toBeTruthy();
  });
});

describe('the walk fix — icons, the truthful button, the call link (20 Sep)', () => {
  it('the contact button carries a phone symbol and the maps button a navigation one', () => {
    const r = render(<AddressCard10 branch={{ name: 'Banjara Hills', address: 'Road No. 12', mapsUrl: 'https://maps' }} contact={{ name: 'Ravi Menon', phone: '+919849011223' }} />);
    expect(r.getByTestId('phone-icon')).toBeTruthy();       // the founder's "mobile call symbol"
    expect(r.getByTestId('maps-icon')).toBeTruthy();
    expect(r.getByTestId('call-contact')).toBeTruthy();
    // no contact, no phone symbol
    const noContact = render(<AddressCard10 branch={{ name: 'B', address: 'x' }} contact={null} />);
    expect(noContact.queryByTestId('phone-icon')).toBeNull();
  });

  it('V1\'s button says what the shoot needs, not "Plan the visit" for ever', () => {
    expect(C10.openLabel('not_sent', false)).toBe('Plan the visit');
    expect(C10.openLabel('sent', false)).toBe('Waiting on her answer — open the visit');
    expect(C10.openLabel('agreed', false)).toBe('The store visit');
    expect(C10.openLabel('agreed', true)).toBe('The visit time passed — send a new time');
    expect(C10.openLabel('attended', false)).toBe('Confirm the shoot is done');
    expect(C10.openLabel('complete', false)).toBe('The store visit');
  });

  it('the agreed stage says the confirm step is coming, and V13 offers her number', () => {
    expect(C10.brand.whatHappensNext('Tanvi Suresh')).toBe('Tanvi marks the visit once she has been, and then you confirm it. Nothing moves until she does.');
    expect(C10.brand.call('Tanvi Suresh')).toBe('Call Tanvi');
  });
});

// Walk fix (1 Oct 2026): signed with no plan sent used to read "Signed by both …" with no chip and
// no door; the brand could not get from the set to the plan.
describe('the brand\'s set row before the plan is sent', () => {
  const row = (shoot) => ({ id: 'ci1', name: 'Kartikeya K', group: 'signed', signedAt: '2026-10-01T07:06:00Z', shoot });
  it('says the plan is his move and the chip opens the visit', () => {
    const onChip = jest.fn();
    const r = render(<SetCreatorRow5 row={row({ stage: 'not_sent', line: 'Signed — plan the store visit', visitAt: null })} onPress={() => {}} onChip={onChip} />);
    r.getByText('Signed — plan the store visit');
    // ASSERTION DRIFT — ui-walk-fixes board F, frame F2 (drift/F.md). This asserted the pill
    // "Your move". The locked board names the step instead: a "Plan the visit" button, with the
    // same testID and the same press.
    within(r.getByTestId('chip-ci1')).getByText('Plan the visit');
    expect(r.queryByText('Your move')).toBeNull();
    fireEvent.press(r.getByTestId('chip-ci1'));
    expect(onChip).toHaveBeenCalledTimes(1);
  });
  // ui-walk-fixes review fix (drift/F.md): the stage 'sent' is both "the plan is with her" and "she
  // asked for another time, it is with him". The row takes the turn from the server's
  // `shoot.yourMove` (the visit's own conversation) and never from the stage.
  const SENT = { stage: 'sent', line: 'Plan sent for Sun 4 Oct, 11:00 am — waiting for Kartikeya to answer', visitAt: '2026-10-04T05:30:00Z' };
  it('a plan that is out and waiting on her carries no chip', () => {
    const r = render(<SetCreatorRow5 row={row({ ...SENT, yourMove: false })} onPress={() => {}} />);
    expect(r.queryByText('Your move')).toBeNull();
    // Board F: no button — it is not his move — and a "Waiting" tag says whose it is.
    expect(r.queryByTestId('chip-ci1')).toBeNull();
    within(r.getByTestId('tag-ci1')).getByText('Waiting');
  });
  it('once she has asked for another time it is his: a "Reply" button, and no "Waiting" tag', () => {
    const onChip = jest.fn();
    const r = render(<SetCreatorRow5 row={row({ ...SENT, yourMove: true })} onPress={() => {}} onChip={onChip} />);
    within(r.getByTestId('chip-ci1')).getByText('Reply');
    expect(r.queryByTestId('tag-ci1')).toBeNull();
    expect(r.queryByText('Waiting')).toBeNull();
    fireEvent.press(r.getByTestId('chip-ci1'));
    expect(onChip).toHaveBeenCalledTimes(1);
  });
  it('a server that does not say whose turn it is gets neither — the row claims nothing', () => {
    const r = render(<SetCreatorRow5 row={row(SENT)} onPress={() => {}} />);
    expect(r.queryByTestId('chip-ci1')).toBeNull();
    expect(r.queryByTestId('tag-ci1')).toBeNull();
    r.getByText(SENT.line);
  });
});

describe('the copy carries the mockups\' sentences', () => {
  it('V9, V10, V13, V14 sentences', () => {
    // Founder, 1 Oct 2026: a store visit never confirms itself; these two used to promise a date.
    expect(C10.hers.waitsForConfirm('Urban Threads')).toBe('Your next step opens when Urban Threads confirm the visit. We keep reminding them until they do.');
    expect(C10.brand.confirmOpens).toBe('Confirming opens her next step. It stays closed until you confirm.');
    expect(JSON.stringify(C10)).not.toMatch(/confirms itself/);
    expect(C10.brand.passedBody('Tanvi Suresh', 5)).toMatch(/Nobody is blamed for this\..*there are 5 days before she posts\./);
    expect(C10.brand.delayedMoney(9720 - 2250, 2250, 'Tanvi Suresh')).toMatch(/₹7,470 is still locked and Tanvi keeps the ₹2,250 she was paid at signing/);
    expect(C10.thread.noDecline).toBe("There is no declining a time. If it can't work, suggest a different one.");
  });
});
