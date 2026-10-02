const { prettyDate } = require('../DateField');

/**
 * A date on these screens is a deadline someone is agreeing to, so the parsing has to be
 * right in the two ways it usually is not: the timezone, and a value that is not a date.
 * Contract: features/collab-terms-by-aim (item 2)
 */

describe('reading a date back', () => {
  it('shows the day that was chosen, not the day before', () => {
    /**
     * The classic fault: new Date('2026-09-15') is parsed as UTC MIDNIGHT, so anywhere
     * behind UTC it renders as the 14th. India is ahead of UTC, but the app should not
     * depend on where it is being run. DateField parses the parts by hand for this reason.
     */
    expect(prettyDate('2026-09-15')).toMatch(/^15 Sept? 2026$/);
  });

  it('handles the first and last day of a month', () => {
    expect(prettyDate('2026-09-01')).toMatch(/^1 Sept? 2026$/);
    expect(prettyDate('2026-12-31')).toMatch(/^31 Dec 2026$/);
  });

  it('reads a full timestamp as its calendar day', () => {
    // Some rows carry a full timestamp rather than a plain date.
    expect(prettyDate('2026-09-15T18:30:00.000Z')).toMatch(/^15 Sept? 2026$/);
  });

  it('returns nothing for a value that is not a date, rather than "Invalid Date"', () => {
    expect(prettyDate(null)).toBeNull();
    expect(prettyDate('')).toBeNull();
    expect(prettyDate('soon')).toBeNull();
    expect(prettyDate(undefined)).toBeNull();
  });

  it('never throws', () => {
    expect(() => prettyDate({})).not.toThrow();
    expect(() => prettyDate(0)).not.toThrow();
  });
});

/**
 * THE CRASH THE FOUNDER FOUND (campaign → set → posting date, brand app on Android).
 *
 * `blocked()` used to be `(min && d < min) || (max && d > max)`. With no maxDate — which is
 * every posting-date picker in the app — that returns `null`, not `false`, for every day that
 * is still choosable. The null was handed to the day cell as accessibilityState.disabled, and
 * Android's BaseViewManager reads it with hasKey("disabled") && getBoolean("disabled"):
 * hasKey is true for a null, getBoolean throws NoSuchKeyException, and the app dies as the
 * calendar draws.
 *
 * Nothing about that is visible under node, so this test asserts the one thing that matters to
 * the native side: the value is a boolean, not merely falsy.
 */
describe('the calendar hands Android booleans, not nulls', () => {
  const React = require('react');
  const { render, fireEvent } = require('@testing-library/react-native');
  const DateField = require('../DateField').default;

  const openPicker = (props) => {
    const r = render(React.createElement(DateField, { label: 'Posting date', value: null, onChange: () => {}, ...props }));
    fireEvent.press(r.getByTestId('date-field'));
    return r;
  };

  it('every day cell is disabled:false or disabled:true — never null (no maxDate)', () => {
    const r = openPicker({ minDate: '2126-09-22' });
    const cells = r.UNSAFE_root.findAll(n => typeof n.props.testID === 'string' && n.props.testID.startsWith('day-') && n.props.accessibilityState);
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) {
      expect(typeof c.props.accessibilityState.disabled).toBe('boolean');
      expect(typeof c.props.accessibilityState.selected).toBe('boolean');
    }
  });

  it('holds for a picker with no minDate and no maxDate at all', () => {
    const r = openPicker({});
    const cells = r.UNSAFE_root.findAll(n => typeof n.props.testID === 'string' && n.props.testID.startsWith('day-') && n.props.accessibilityState);
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) expect(typeof c.props.accessibilityState.disabled).toBe('boolean');
  });

  it('still greys out the days before the earliest one', () => {
    const r = openPicker({ minDate: '2126-09-22' });
    expect(r.getByTestId('day-2126-09-21').props.accessibilityState.disabled).toBe(true);
    expect(r.getByTestId('day-2126-09-22').props.accessibilityState.disabled).toBe(false);
  });
});

/**
 * ui-walk-fixes — board G (the shoot plan's Date box). Four opt-in props were added for it:
 * `icon`, `hideCaret`, `display`, `invalid`. Six other screens use this field; the first test
 * pins that a caller who passes none of them still gets the field it always had.
 * Contract: features/ui-walk-fixes · frames G1, G4, G5
 */
describe('the opt-in props added for the shoot plan (ui-walk-fixes board G)', () => {
  const React = require('react');
  const { StyleSheet } = require('react-native');
  const { render, fireEvent, within } = require('@testing-library/react-native');
  const DateField = require('../DateField').default;
  const { settingsTokens: T } = require('../../theme/tokens');
  const flat = (node) => StyleSheet.flatten(node.props.style) || {};
  const field = (props) => render(React.createElement(DateField, { value: null, onChange: () => {}, ...props }));

  it('passing none of them leaves the field exactly as it was: long date, the ▾, no icon, no red', () => {
    const empty = field({ label: 'Posting date' });
    const box = within(empty.getByTestId('date-field'));
    expect(box.getByText('Choose a date')).toBeTruthy();
    expect(box.getByText('▾')).toBeTruthy();
    // Straight inside the box: the words and the ▾, nothing else and nothing wrapped round them.
    const texts = empty.getByTestId('date-field').children.filter((c) => c.type && (c.type.displayName || c.type.name) === 'Text');
    expect(texts.map((c) => c.props.children)).toEqual(['Choose a date', '▾']);
    expect(box.queryByText('calendar-blank-outline')).toBeNull();
    expect(flat(empty.getByTestId('date-field')).borderColor).toBe(T.border);
    const filled = field({ label: 'Posting date', value: '2026-10-18' });
    expect(within(filled.getByTestId('date-field')).getByText('18 Oct 2026')).toBeTruthy();
    // An error still outlines it and still prints its sentence.
    const wrong = field({ label: 'Posting date', error: 'Choose a posting date.' });
    expect(flat(wrong.getByTestId('date-field')).borderColor).toBe(T.danger);
    expect(wrong.getByText('Choose a posting date.')).toBeTruthy();
  });

  it('`icon` draws a mark before the words and `hideCaret` drops the ▾', () => {
    const r = field({ icon: 'calendar-blank-outline', hideCaret: true, testID: 'pick-date' });
    const box = within(r.getByTestId('pick-date'));
    expect(box.getByText('calendar-blank-outline')).toBeTruthy();
    expect(box.getByText('Choose a date')).toBeTruthy();
    expect(box.queryByText('▾')).toBeNull();
    // Each is its own switch.
    const iconOnly = within(field({ icon: 'calendar-blank-outline' }).getByTestId('date-field'));
    expect(iconOnly.getByText('▾')).toBeTruthy();
  });

  it('`display` changes only the words in the box — the value on the wire is still YYYY-MM-DD', () => {
    const onChange = jest.fn();
    const short = (iso) => `${Number(iso.slice(8, 10))} Oct`;
    const r = field({ value: '2026-10-18', display: short, minDate: '2026-10-01', maxDate: '2026-10-24', onChange });
    expect(within(r.getByTestId('date-field')).getByText('18 Oct')).toBeTruthy();
    fireEvent.press(r.getByTestId('date-field'));
    fireEvent.press(r.getByTestId('day-2026-10-19'));
    expect(onChange).toHaveBeenCalledWith('2026-10-19');
    // Nothing chosen: the placeholder, and `display` is never handed a non-date.
    const seen = jest.fn(() => 'never');
    const none = field({ display: seen });
    expect(within(none.getByTestId('date-field')).getByText('Choose a date')).toBeTruthy();
    expect(seen).not.toHaveBeenCalled();
  });

  it('`invalid` outlines the box red and prints nothing of its own', () => {
    const r = field({ invalid: true });
    expect(flat(r.getByTestId('date-field')).borderColor).toBe(T.danger);
    expect(r.queryByRole('alert')).toBeNull();
  });

  it('a day after `maxDate` is greyed with an explicit boolean, like every other day', () => {
    const r = field({ minDate: '2026-10-01', maxDate: '2026-10-24', value: '2026-10-18' });
    fireEvent.press(r.getByTestId('date-field'));
    expect(r.getByTestId('day-2026-10-24').props.accessibilityState).toMatchObject({ disabled: false, selected: false });
    expect(r.getByTestId('day-2026-10-25').props.accessibilityState).toMatchObject({ disabled: true, selected: false });
    expect(r.getByTestId('day-2026-10-18').props.accessibilityState).toMatchObject({ disabled: false, selected: true });
  });

  // Frame G2's caption: "both arrows are grey because no other month has a day she can shoot".
  // The arrows were never pressed by a test; with a last day set they must not page past it.
  describe('the month arrows under a first and a last day', () => {
    const arrow = (r, id) => flat(within(r.getByTestId(id)).getByText(/^[‹›]$/)).color;
    const open = (r) => r.getAllByTestId(/^day-\d{4}-\d\d-\d\d$/).filter((n) => n.props.accessibilityState.disabled === false).map((n) => n.props.testID);

    it('both are grey and go nowhere when every day on offer is in the month shown', () => {
      const r = field({ minDate: '2026-10-01', maxDate: '2026-10-24' });
      fireEvent.press(r.getByTestId('date-field'));
      expect(r.getByText('October 2026')).toBeTruthy();
      expect(open(r)).toHaveLength(24);
      for (const id of ['date-prev', 'date-next']) {
        expect(arrow(r, id)).toBe(T.ink3);
        fireEvent.press(r.getByTestId(id));
        expect(r.getByText('October 2026')).toBeTruthy();
      }
      expect(open(r)).toHaveLength(24);
    });

    it('an arrow is live only towards a month that holds a day on offer, and stops at the last such month', () => {
      const r = field({ minDate: '2026-10-20', maxDate: '2026-11-05' });
      fireEvent.press(r.getByTestId('date-field'));
      expect(r.getByText('October 2026')).toBeTruthy();
      expect(open(r)).toHaveLength(12);                                       // the 20th to the 31st
      expect(arrow(r, 'date-prev')).toBe(T.ink3);
      expect(arrow(r, 'date-next')).toBe(T.ink);
      fireEvent.press(r.getByTestId('date-prev'));
      expect(r.getByText('October 2026')).toBeTruthy();
      fireEvent.press(r.getByTestId('date-next'));
      expect(r.getByText('November 2026')).toBeTruthy();
      expect(open(r)).toEqual(['day-2026-11-01', 'day-2026-11-02', 'day-2026-11-03', 'day-2026-11-04', 'day-2026-11-05']);
      expect(arrow(r, 'date-next')).toBe(T.ink3);
      expect(arrow(r, 'date-prev')).toBe(T.ink);
      fireEvent.press(r.getByTestId('date-next'));
      expect(r.getByText('November 2026')).toBeTruthy();
      fireEvent.press(r.getByTestId('date-prev'));
      expect(r.getByText('October 2026')).toBeTruthy();
    });

    it('with no last day the forward arrow is always live (every caller that passes no maxDate)', () => {
      const r = field({ minDate: '2126-09-22' });
      fireEvent.press(r.getByTestId('date-field'));
      expect(r.getByText('September 2126')).toBeTruthy();
      expect(arrow(r, 'date-next')).toBe(T.ink);
      expect(arrow(r, 'date-prev')).toBe(T.ink3);
      fireEvent.press(r.getByTestId('date-next'));
      expect(r.getByText('October 2126')).toBeTruthy();
      expect(open(r)).toHaveLength(31);
    });
  });
});

/**
 * ui-walk-fixes — board C (typing). A Date box that shares a form or a pop-up with a text box is
 * tapped while the keypad is up; the calendar needs the room the keypad is standing in. The Time
 * box beside it on the shoot plan already puts the keypad away first. `closeKeypad` gives the Date
 * box the same manners — opt-in, so the six other callers open exactly as they always did.
 */
describe('`closeKeypad` — the keypad is put away before the calendar opens (ui-walk-fixes board C)', () => {
  const React = require('react');
  const { Keyboard } = require('react-native');
  const { render, fireEvent } = require('@testing-library/react-native');
  const DateField = require('../DateField').default;
  const field = (props) => render(React.createElement(DateField, { value: null, onChange: () => {}, ...props }));

  let dismiss;
  beforeEach(() => { dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {}); });
  afterEach(() => { dismiss.mockRestore(); });

  it('with the prop: one tap puts the keypad away and opens the calendar', () => {
    const r = field({ closeKeypad: true });
    expect(dismiss).not.toHaveBeenCalled();                                   // not on drawing — only on the tap
    fireEvent.press(r.getByTestId('date-field'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(r.getByTestId('date-sheet')).toBeTruthy();
  });

  it('without it the keypad is left alone, and the calendar opens as before', () => {
    const r = field({});
    fireEvent.press(r.getByTestId('date-field'));
    expect(dismiss).not.toHaveBeenCalled();
    expect(r.getByTestId('date-sheet')).toBeTruthy();
  });

  it('picking a day or closing the calendar does not touch the keypad again', () => {
    const onChange = jest.fn();
    const r = field({ closeKeypad: true, minDate: '2126-09-22', onChange });
    fireEvent.press(r.getByTestId('date-field'));
    fireEvent.press(r.getByTestId('day-2126-09-24'));
    expect(onChange).toHaveBeenCalledWith('2126-09-24');
    expect(r.queryByTestId('date-sheet')).toBeNull();
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});
