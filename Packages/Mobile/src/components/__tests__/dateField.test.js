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
