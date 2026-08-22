const { PLACES, SHIPPING, toMode, fromMode, describeMode } = require('../workingStyle');

/**
 * The whole point of this module is that the SCREEN changed shape and the RECORD did not.
 * These checks pin that down in both directions, because the moment the stored vocabulary
 * drifts, the shipping machinery downstream — address confirmation, courier and AWB, the
 * unconfirmed-parcel nudge, the fourteen-day stall alert, the contract PDF — stops firing
 * for a collaboration that was agreed as a shipping one.
 */

describe('the question the brand is asked', () => {
  it('offers two places, and shipping is not one of them', () => {
    expect(PLACES.map(p => p.v)).toEqual(['visit', 'remote']);
    expect(PLACES.map(p => p.v)).not.toContain('shipment');
  });

  it('offers a plain yes or no on shipping', () => {
    expect(SHIPPING.map(o => o.v)).toEqual(['yes', 'no']);
  });
});

describe('two answers in, one stored value out', () => {
  it('store visit stores visit', () => {
    expect(toMode('visit', null)).toBe('visit');
  });

  it('remote with nothing shipped stores remote', () => {
    expect(toMode('remote', 'no')).toBe('remote');
  });

  it('remote with products shipped stores the word the shipping flow already keys off', () => {
    expect(toMode('remote', 'yes')).toBe('shipment');
  });

  it('nothing chosen states no term at all', () => {
    expect(toMode('', null)).toBe('');
  });

  it('a store visit can never come out as a shipment, whatever shipping says', () => {
    // Guards the reset: switching remote -> visit must not carry a stale "yes".
    expect(toMode('visit', 'yes')).toBe('visit');
  });
});

describe('one stored value in, two answers out', () => {
  it('reads back every stored value, including one written before this change', () => {
    expect(fromMode('visit')).toEqual({ place: 'visit', shipping: null });
    expect(fromMode('remote')).toEqual({ place: 'remote', shipping: 'no' });
    expect(fromMode('shipment')).toEqual({ place: 'remote', shipping: 'yes' });
  });

  it('treats an absent or unknown term as not stated rather than guessing', () => {
    expect(fromMode(null)).toEqual({ place: '', shipping: null });
    expect(fromMode('')).toEqual({ place: '', shipping: null });
    expect(fromMode('nonsense')).toEqual({ place: '', shipping: null });
  });

  it('survives a round trip in both directions', () => {
    for (const m of ['visit', 'remote', 'shipment']) {
      const { place, shipping } = fromMode(m);
      expect(toMode(place, shipping)).toBe(m);
    }
  });
});

describe('what each side reads', () => {
  it('shows a shipping collaboration as two facts, not one phrase', () => {
    const d = describeMode('shipment', 'creator');
    expect(d.place).toBe('Remote');
    expect(d.shipping).toBe("They'll ship to you");
  });

  it('tells the brand it is the one shipping', () => {
    expect(describeMode('shipment', 'brand').shipping).toBe("You'll ship to them");
  });

  it('never asks a store visit about shipping', () => {
    expect(describeMode('visit', 'creator').shipping).toBeNull();
  });

  it('says plainly that nothing is being shipped, rather than staying silent', () => {
    expect(describeMode('remote', 'creator').shipping).toBe('Nothing shipped');
  });

  it('describes nothing when the term was never stated', () => {
    expect(describeMode(null)).toBeNull();
    expect(describeMode('')).toBeNull();
  });
});
