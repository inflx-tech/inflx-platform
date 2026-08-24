const { describePay } = require('../collabPay');

/**
 * These pin the fault that started this: a sales collaboration told the creator she would
 * earn ₹0. The commission was always in the payload; the screen only ever read a fee.
 *
 * Every case below is taken from a campaign that exists in production.
 */

describe('a sales collaboration — the ₹0', () => {
  // Live rows when this was written: 18%, 15%, 20% and 22%, all showing ₹0.
  const sale = { goal: 'conversion', commission_pct: '18.00', agreed_fee: null, influencer_budget: null };

  it('leads with the percentage, not a fee', () => {
    expect(describePay(sale).headline).toBe('18%');
  });

  it('never says ₹0 to someone earning 18%', () => {
    const p = describePay(sale);
    expect(p.headline).not.toMatch(/0/);
    expect(p.value).not.toMatch(/₹/);
  });

  it('says what the percentage is OF — a bare number still leaves her guessing', () => {
    expect(describePay(sale).note).toBe('of everything you sell');
  });

  it('calls it commission, not fee, wherever it is labelled', () => {
    expect(describePay(sale).label).toBe('Commission');
    expect(describePay(sale).short).toBe('18% commission');
  });

  it('handles the numeric string the database returns', () => {
    // Postgres numeric arrives as '18.00', not 18. Reading it as a number is the whole job.
    expect(describePay({ goal: 'conversion', commission_pct: '22.00' }).headline).toBe('22%');
  });
});

describe('a content collaboration', () => {
  const content = { goal: 'engagement', commission_pct: null, agreed_fee: '30000.00' };

  it('still shows the fee, unchanged', () => {
    expect(describePay(content).headline).toBe(fmtLike(30000));
    expect(describePay(content).label).toBe('Fee');
  });

  it('adds no note, because a fee needs no explaining', () => {
    expect(describePay(content).note).toBeNull();
  });

  it('falls back to the budget when no fee has been agreed yet', () => {
    expect(describePay({ goal: 'engagement', influencer_budget: '25000.00' }).headline)
      .toBe(fmtLike(25000));
  });
});

describe('both at once', () => {
  it('shows the fee and says the commission rides on top', () => {
    const p = describePay({ goal: 'hybrid', agreed_fee: '10000.00', commission_pct: '5.00' });
    expect(p.headline).toBe(fmtLike(10000));
    expect(p.note).toBe('plus 5% of what you sell');
    expect(p.label).toBe('Fee + commission');
  });
});

describe('when the row disagrees with the label', () => {
  /**
   * The goal is the campaign's stated aim; a row can contradict it. The money present
   * decides, and the goal only breaks the tie — otherwise a mislabelled set reproduces
   * the same ₹0 in a different costume.
   */
  it('a conversion set carrying a real fee shows the fee', () => {
    expect(describePay({ goal: 'conversion', agreed_fee: '5000.00' }).label).toBe('Fee');
  });

  it('a commission with no goal at all is still a commission', () => {
    expect(describePay({ commission_pct: '12.00' }).headline).toBe('12%');
  });
});

describe('nothing settled yet', () => {
  it('says so on a sales deal instead of claiming she earns nothing', () => {
    const p = describePay({ goal: 'conversion' });
    expect(p.value).toBe('Not set yet');
    expect(p.note).toBe('commission not set yet');
  });

  it('treats zero as not settled, not as an agreed amount', () => {
    expect(describePay({ goal: 'conversion', commission_pct: '0' }).value).toBe('Not set yet');
  });

  it('never throws on an empty row', () => {
    expect(() => describePay()).not.toThrow();
    expect(() => describePay({})).not.toThrow();
  });
});

/** Match the app's own formatter rather than hard-coding a rupee string. */
function fmtLike(n) {
  return require('../../theme/tokens').fmtRupees(n);
}
