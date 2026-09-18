import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GateCard10, StepLine10, TimeCard10, AddressCard10, TimePicker10 } from '../bits10';
import { C10, whenLine10, whenShort10, day10, istToIso, istParts, istDay10 } from '../copy10';

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
    const closed = render(<GateCard10 gate={{ open: false, reason: 'NOT_FUNDED', signed: { at: '2026-09-14T06:00:00Z' }, money: { required: true, locked: 0, released: 0 } }} />);
    expect(closed.getAllByText('⧗')).toHaveLength(2);
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

describe('the time picker offers no day after the posting date (check 6)', () => {
  it('lists today..posting day only, 15-minute steps, and emits an IST instant', () => {
    const onChange = jest.fn();
    const today = istDay10(new Date().toISOString());
    const parts = today.split('-').map(Number);
    const plus2 = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + 2)).toISOString().slice(0, 10);
    const r = render(<TimePicker10 value={null} onChange={onChange} maxDay={plus2} />);
    expect(r.getAllByTestId(/^day-\d+$/)).toHaveLength(3);          // today, tomorrow, the posting day — nothing after
    expect(r.getAllByTestId(/^minute-/)).toHaveLength(4);
    fireEvent.press(r.getByTestId('hour-16'));
    expect(onChange).toHaveBeenCalled();
    const iso = onChange.mock.calls[0][0];
    expect(istParts(iso).h).toBe(16);
    expect(istDay10(iso)).toBe(today);
  });

  it('a posting date already passed offers no day at all', () => {
    const r = render(<TimePicker10 value={null} onChange={() => {}} maxDay="2020-01-01" />);
    expect(r.queryAllByTestId(/^day-\d+$/)).toHaveLength(0);
  });
});

describe('the copy carries the mockups\' sentences', () => {
  it('V9, V10, V13, V14 sentences', () => {
    expect(C10.hers.autoConfirm('2026-10-22T05:00:00Z')).toMatch(/confirms itself and you can start uploading\. Nothing about your payment depends on this step\./);
    expect(C10.brand.confirmOpens('2026-10-22T05:00:00Z')).toBe('Confirming opens her content step. If you do nothing, this confirms itself on 22 Oct.');
    expect(C10.brand.passedBody('Tanvi Suresh', 5)).toMatch(/Nobody is blamed for this\..*there are 5 days before she posts\./);
    expect(C10.brand.delayedMoney(9720 - 2250, 2250, 'Tanvi Suresh')).toMatch(/₹7,470 is still locked and Tanvi keeps the ₹2,250 she was paid at signing/);
    expect(C10.thread.noDecline).toBe("There is no declining a time. If it can't work, suggest a different one.");
  });
});
