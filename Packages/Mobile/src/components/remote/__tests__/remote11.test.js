/**
 * Item 11 — the Remote screens' pieces.
 * Contract: features/item11-remote · Phase 3 · checks 38, 39
 *
 * Two jobs. It renders every new component so a syntax or import fault cannot reach an OTA
 * bundle — RN has no compile step, so a screen that does not parse fails on the DEVICE, and
 * two native crashes have shipped that way before (reference_rn_native_crash_debugging).
 * And it proves the rules that live in the components rather than on the server: the 1–5
 * stepper, the red family appearing only on the check control, and `busy` on every sheet.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import {
  DispositionTag11, ReturnGiftSwitch11, QtyStepper11, ProductRow11,
  AddressCard11, TrackingSteps11, TrackingCard11, ThreeWayCheck11, MoneyCard11, BoxPicker11,
} from '../bits11';
import { C11, MSG11, BOXES11, TRACK_STEPS, trackIndex, pickupDayLabel } from '../copy11';

const PRODUCT = { id: 'p1', name: 'Indigo Chanderi Saree', price: 2400, image: null, variants: [] };
const SIZED = { ...PRODUCT, id: 'p2', variants: [{ id: 'v1', label: 'M' }, { id: 'v2', label: 'L' }] };

describe('the pieces render at all', () => {
  it('every component mounts', () => {
    expect(() => render(<DispositionTag11 value="return" />)).not.toThrow();
    expect(() => render(<DispositionTag11 value="gift" />)).not.toThrow();
    expect(() => render(<ReturnGiftSwitch11 value="gift" onChange={() => {}} />)).not.toThrow();
    expect(() => render(<QtyStepper11 value={1} onChange={() => {}} />)).not.toThrow();
    expect(() => render(<ProductRow11 product={PRODUCT} line={null} onChange={() => {}} onRemove={() => {}} />)).not.toThrow();
    expect(() => render(<AddressCard11 address={{ name: 'Tanvi', street: '11 Gandhi Road', city: 'Guntur', state: 'Andhra Pradesh', pincode: '522002', sizes: 'Top M' }} />)).not.toThrow();
    expect(() => render(<TrackingSteps11 parcel={{ bookedAt: 'x' }} />)).not.toThrow();
    expect(() => render(<TrackingCard11 parcel={{ tracking: 'TEST0000000001', courier: 'Test Express' }} />)).not.toThrow();
    expect(() => render(<ThreeWayCheck11 value={null} onChange={() => {}} onNote={() => {}} />)).not.toThrow();
    expect(() => render(<MoneyCard11 quote={{ outbound: 120, returnHold: 80, returnCount: 2, total: 200, available: 5000, lockedFee: 9000 }} creatorName="Tanvi Suresh" />)).not.toThrow();
    expect(() => render(<BoxPicker11 value="medium" onChange={() => {}} dims={{}} onDims={() => {}} />)).not.toThrow();
  });
});

describe('Return and Gift are two words, and only one is chosen', () => {
  it('the tag says which', () => {
    expect(render(<DispositionTag11 value="return" />).getByText('Return')).toBeTruthy();
    expect(render(<DispositionTag11 value="gift" />).getByText('Gift')).toBeTruthy();
  });

  it('the switch reports which is selected, and a disabled one cannot be changed', () => {
    const onChange = jest.fn();
    const { getByTestId, rerender } = render(<ReturnGiftSwitch11 value="gift" onChange={onChange} testID="rg" />);
    expect(getByTestId('rg-gift').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('rg-return').props.accessibilityState.selected).toBe(false);
    fireEvent.press(getByTestId('rg-return'));
    expect(onChange).toHaveBeenCalledWith('return');

    // §11.2 / §28: once the return pickup is booked the switch is dead, in both directions.
    onChange.mockClear();
    rerender(<ReturnGiftSwitch11 value="return" onChange={onChange} disabled testID="rg" />);
    fireEvent.press(getByTestId('rg-gift'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('the quantity stepper stops at 1 and at 5 (§7)', () => {
  it('never goes below one', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<QtyStepper11 value={1} onChange={onChange} testID="q" />);
    fireEvent.press(getByTestId('q-minus'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('never goes above five — "At most 5 of one size"', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<QtyStepper11 value={5} onChange={onChange} testID="q" />);
    fireEvent.press(getByTestId('q-plus'));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(getByTestId('q-minus'));
    expect(onChange).toHaveBeenCalledWith(4);
  });
});

describe('a product row (R5)', () => {
  it('picking one starts it as a Gift with a quantity of 1', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<ProductRow11 product={PRODUCT} line={null} onChange={onChange} onRemove={() => {}} />);
    fireEvent.press(getByTestId('product-p1-toggle'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ quantity: 1, disposition: 'gift' }));
  });

  it('a product WITH sizes shows them; one without shows none (v1.27, Q2)', () => {
    const sized = render(<ProductRow11 product={SIZED} line={{ variantId: 'v1', quantity: 1, disposition: 'gift' }} onChange={() => {}} onRemove={() => {}} />);
    expect(sized.getByTestId('variant-v1')).toBeTruthy();
    expect(sized.getByTestId('variant-v2')).toBeTruthy();

    const plain = render(<ProductRow11 product={PRODUCT} line={{ variantId: null, quantity: 1, disposition: 'gift' }} onChange={() => {}} onRemove={() => {}} />);
    expect(plain.queryByTestId('variant-v1')).toBeNull();
  });

  it('the controls only exist once it is picked', () => {
    const notPicked = render(<ProductRow11 product={PRODUCT} line={null} onChange={() => {}} onRemove={() => {}} />);
    expect(notPicked.queryByTestId('qty-p1')).toBeNull();
    const picked = render(<ProductRow11 product={PRODUCT} line={{ variantId: null, quantity: 2, disposition: 'return' }} onChange={() => {}} onRemove={() => {}} />);
    expect(picked.getByTestId('qty-p1-value').props.children).toBe(2);
  });
});

describe('the three-way check (R9, §8)', () => {
  it('a note appears only when something was NOT received', () => {
    const { queryByTestId, rerender } = render(
      <ThreeWayCheck11 value="received" onChange={() => {}} onNote={() => {}} testID="c" />);
    expect(queryByTestId('c-note')).toBeNull();

    rerender(<ThreeWayCheck11 value="damaged" onChange={() => {}} onNote={() => {}} testID="c" />);
    expect(queryByTestId('c-note')).toBeTruthy();
    expect(queryByTestId('c-note').props.maxLength).toBe(300);
  });

  // ui-walk-fixes, final review: the note box is opt-out, for a caller that has nowhere to keep a
  // note (the brand's "What came back?" pop-up). Everyone who passes nothing keeps the box.
  it('withNote={false} draws no note box for any verdict; the default still draws it and hands on what is typed', () => {
    const onNote = jest.fn();
    for (const verdict of ['missing', 'damaged']) {
      const off = render(<ThreeWayCheck11 value={verdict} onChange={() => {}} withNote={false} testID="c" />);
      expect(off.queryByTestId('c-note')).toBeNull();
      expect(off.getByTestId(`c-${verdict}`).props.accessibilityState).toEqual({ selected: true, disabled: false });
      off.unmount();
      for (const on of [{}, { withNote: true }, { withNote: undefined }]) {
        const kept = render(<ThreeWayCheck11 value={verdict} note="Torn" onChange={() => {}} onNote={onNote} {...on} testID="c" />);
        expect(kept.getByTestId('c-note').props.value).toBe('Torn');
        fireEvent.changeText(kept.getByTestId('c-note'), 'Torn at the hem');
        expect(onNote).toHaveBeenLastCalledWith('Torn at the hem');
        kept.unmount();
      }
    }
  });

  // ui-walk-fixes (closing pass, drift/K2.md): two boxes, two sets of grey words. Both were one
  // key written twice in the creator's block of the copy file; the later line silently won, so her
  // Delivery note box (R3) asked "What was wrong?". The check's note has its own key now.
  it('the note box under Missing / Damaged asks "What was wrong?" — its own words, not the Delivery note\'s', () => {
    for (const verdict of ['missing', 'damaged']) {
      const r = render(<ThreeWayCheck11 value={verdict} onChange={() => {}} onNote={() => {}} testID="c" />);
      expect(r.getByTestId('c-note').props.placeholder).toBe('What was wrong?');
      r.unmount();
    }
    expect(C11.creator.checkNotePlaceholder).toBe('What was wrong?');
    expect(C11.creator.notePlaceholder).toBe('A landmark, or a good time to deliver');
  });

  it('each verdict can be chosen, and a disabled control cannot', () => {
    const onChange = jest.fn();
    const { getByTestId, rerender } = render(<ThreeWayCheck11 value={null} onChange={onChange} onNote={() => {}} testID="c" />);
    for (const k of ['received', 'missing', 'damaged']) {
      fireEvent.press(getByTestId(`c-${k}`));
      expect(onChange).toHaveBeenCalledWith(k);
    }
    onChange.mockClear();
    rerender(<ThreeWayCheck11 value={null} onChange={onChange} onNote={() => {}} disabled testID="c" />);
    fireEvent.press(getByTestId('c-missing'));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('the money card says what the brand is paying for (R6)', () => {
  it('the return lock line appears only when something is coming back', () => {
    const withReturn = render(<MoneyCard11 quote={{ outbound: 120, returnHold: 80, returnCount: 2, total: 200, available: 5000, lockedFee: 0 }} creatorName="Tanvi Suresh" />);
    expect(withReturn.getByTestId('money-hold')).toBeTruthy();

    const allGifts = render(<MoneyCard11 quote={{ outbound: 120, returnHold: 0, returnCount: 0, total: 120, available: 5000, lockedFee: 0 }} creatorName="Tanvi Suresh" />);
    expect(allGifts.queryByTestId('money-hold')).toBeNull();
  });

  it('it says the collaboration fee is never used for shipping, when there is one', () => {
    const { getByText } = render(
      <MoneyCard11 quote={{ outbound: 120, returnHold: 0, returnCount: 0, total: 120, available: 5000, lockedFee: 9000 }} creatorName="Tanvi Suresh" />);
    expect(getByText(C11.brand.feeNeverUsed(9000, 'Tanvi Suresh'))).toBeTruthy();
  });
});

describe('the box presets are the mockups\' three, plus Other (R6)', () => {
  it('the dimensions match §11.2 exactly', () => {
    expect(BOXES11.map((b) => b.key)).toEqual(['small', 'medium', 'large', 'other']);
    expect(BOXES11[0].dims).toBe('25 × 20 × 5 cm');
    expect(BOXES11[1].dims).toBe('35 × 25 × 10 cm');
    expect(BOXES11[2].dims).toBe('45 × 35 × 15 cm');
  });

  it('typing a size appears only under Other', () => {
    const preset = render(<BoxPicker11 value="medium" onChange={() => {}} dims={{}} onDims={() => {}} />);
    expect(preset.queryByTestId('box-dims')).toBeNull();
    const other = render(<BoxPicker11 value="other" onChange={() => {}} dims={{}} onDims={() => {}} />);
    expect(other.getByTestId('box-dims')).toBeTruthy();
  });
});

describe('the tracking line (R8)', () => {
  it('walks forward with the parcel, and names her city in the middle', () => {
    expect(trackIndex(null)).toBe(-1);
    expect(trackIndex({ bookedAt: 'x' })).toBe(1);
    expect(trackIndex({ bookedAt: 'x', collectedAt: 'x' })).toBe(2);
    expect(trackIndex({ bookedAt: 'x', collectedAt: 'x', outForDeliveryAt: 'x' })).toBe(3);
    expect(trackIndex({ bookedAt: 'x', collectedAt: 'x', deliveredAt: 'x' })).toBe(4);
    expect(TRACK_STEPS).toHaveLength(5);

    const { getByText } = render(<TrackingSteps11 parcel={{ bookedAt: 'x', collectedAt: 'x' }} cityName="Guntur" />);
    expect(getByText('In Guntur')).toBeTruthy();
  });

  it('the tracking number is shown in the mono font', () => {
    const { getByTestId } = render(<TrackingCard11 parcel={{ tracking: 'TEST0000004471', courier: 'Test Express' }} />);
    const el = getByTestId('tracking-number');
    expect(el.props.children).toBe('TEST0000004471');
    const style = Array.isArray(el.props.style) ? Object.assign({}, ...el.props.style.filter(Boolean)) : el.props.style;
    expect(String(style.fontFamily)).toMatch(/mono/i);
  });
});

describe('the words (§7, §11.2)', () => {
  it('the field messages match the server\'s, word for word', () => {
    expect(MSG11.PINCODE_REQUIRED).toBe('Enter a 6-digit pincode.');
    expect(MSG11.NOTE_LONG).toBe('Keep it under 200 characters.');
    expect(MSG11.SIZES_LONG).toBe('Keep it under 100 characters.');
    expect(MSG11.CHECK_NOTE_LONG).toBe('Keep it under 300 characters.');
    expect(MSG11.TOO_MANY_OF_VARIANT).toBe('At most 5 of one size.');
    expect(MSG11.TOO_MANY_LINES).toBe('A parcel can hold up to 20 products.');
    expect(MSG11.PICKUP_DAY_PAST).toBe('Choose a pickup day from tomorrow.');
  });

  it('the pickup chips read "Tomorrow" then the weekday (R12)', () => {
    expect(pickupDayLabel('2026-11-02', '2026-11-01')).toBe('Tomorrow');
    expect(pickupDayLabel('2026-11-05', '2026-11-01')).toMatch(/^Thu 5 Nov$/);
  });

  it('the brand is told she pays nothing, and she is told the brand covers it', () => {
    expect(C11.creator.payNothing('Kanchi Silks')).toBe('You pay nothing. Kanchi Silks cover the return.');
    expect(C11.brand.gstLine).toMatch(/Anything the return doesn't use comes back to you/);
  });
});
