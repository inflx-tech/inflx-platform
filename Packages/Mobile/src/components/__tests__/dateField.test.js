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
