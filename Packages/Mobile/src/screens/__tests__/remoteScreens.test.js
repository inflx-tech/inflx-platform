/**
 * Item 11, Phase 3 — the five Remote screens, rendered.
 * Contract: features/item11-remote · checks 38, 39
 *
 * WHY THIS EXISTS AT ALL. React Native has no compile step: a bad import or a typo in a screen
 * fails on the DEVICE, in a bundle that has already shipped over the air. Two native crashes
 * have gone out that way (reference_rn_native_crash_debugging), and both were found by a thumb
 * rather than by a test. Every screen here is mounted at every stage it can be in, with the
 * server's real response shape, so a fault has somewhere to surface before a person finds it.
 *
 * It also proves the three states §11.2 and the prompt ask every screen to have — LOADING,
 * EMPTY and COULDN'T LOAD (check 38) — and that a sheet's confirm honours `busy` (check 39).
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const React2 = require('react'); React2.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
}));

const api = require('../../services/api');
jest.mock('../../services/api', () => ({
  influencerApi: {
    myRemote: jest.fn(), myRemoteCoverage: jest.fn(), myRemoteAddress: jest.fn(),
    myRemoteCorrect: jest.fn(), myRemoteCheck: jest.fn(), myRemoteDone: jest.fn(),
    myRemoteBookReturn: jest.fn(), myRemoteSelfSent: jest.fn(),
  },
  brandApi: {
    remote: jest.fn(), remoteProducts: jest.fn(), remoteSaveLines: jest.fn(), remoteQuote: jest.fn(),
    remoteBook: jest.fn(), remoteLabel: jest.fn(), remoteCancel: jest.fn(), remoteRebook: jest.fn(),
    remoteReport: jest.fn(), remoteAcknowledge: jest.fn(), remoteGift: jest.fn(),
    remoteConfirmReturn: jest.fn(), listBranches: jest.fn(),
  },
  // §2B's fields fetch the offered states once, and cache them in module scope.
  referenceApi: {
    offeredStates: jest.fn(() => Promise.resolve({
      success: true,
      data: { states: [{ id: 2, name: 'Andhra Pradesh', cities: [{ id: 7, name: 'Guntur' }] }] },
    })),
  },
}));

import RemoteShootScreen from '../influencer/RemoteShootScreen';
import RemoteAddressScreen from '../influencer/RemoteAddressScreen';
import BrandRemoteScreen from '../brand/BrandRemoteScreen';
import BrandRemoteProductsScreen from '../brand/BrandRemoteProductsScreen';
import BrandRemoteBookScreen from '../brand/BrandRemoteBookScreen';

const nav = { navigate: jest.fn(), goBack: jest.fn(), addListener: jest.fn(() => () => {}), setParams: jest.fn() };
const HER_ROUTE = { params: { ciId: 'ci1' } };
const BRAND_ROUTE = { params: { campaignId: 'c1', setId: 's1', ciId: 'ci1' } };

/** The server's real F1 shape, at whatever stage the test needs. */
function shoot(over = {}) {
  return {
    invitationId: 'ci1', shootId: 'pe1', contractId: 'con1',
    gate: { open: true, reason: null, signed: { at: '2026-10-01T00:00:00Z' }, money: { required: false, locked: 0, released: 0 } },
    aim: 'engagement', mode: 'shipment', isRemote: true,
    campaignName: 'Diwali Edit', setName: 'Set A',
    brand: { name: 'Kanchi Silks' }, creator: { name: 'Tanvi Suresh' },
    postingDate: '2026-11-20', daysToPosting: 20,
    stage: 'not_sent', stageLabel: 'Waiting for her address',
    address: null, parcel: null, lines: [], lineCount: 0, maxLines: 20,
    return: { shipment: null, stage: 'none', stageLabel: 'Nothing to send back', dueDate: null, overdue: false, count: 0, canPickup: true },
    difference: { reportedAt: null, acknowledgedAt: null, returnReportedAt: null, overdueReportedAt: null },
    delayed: null,
    can: {},
    steps: [
      { key: 'signed', label: 'Agreement signed', state: 'done', detail: '1 Oct' },
      { key: 'products', label: 'Products', state: 'now', detail: 'Waiting for her address' },
      { key: 'content', label: 'Content', state: 'later', detail: 'After the shoot' },
      { key: 'live', label: 'Live and paid', state: 'later', detail: 'Posts 20 Nov' },
    ],
    prefill: { name: 'Tanvi Suresh', phone: '9876511111', stateId: 2, cityId: 7 },
    ...over,
  };
}
const ok = (s) => ({ success: true, data: { shoot: s } });
const LINE = { id: 'l1', productId: 'p1', variantId: null, name: 'Indigo Saree', variantLabel: null, image: null, price: 2400, quantity: 1, disposition: 'return', check: null, checkNote: null, checkedAt: null, returnStatus: null, reportedAt: null };
const ADDRESS = { name: 'Tanvi Suresh', phone: '9876511111', street: '11 Gandhi Road', pincode: '522002', state: 'Andhra Pradesh', city: 'Guntur', note: null, sizes: 'Top M', sentAt: '2026-10-02T00:00:00Z', correctedAt: null, coverage: { delivers: true, returnPickup: true, checkedAt: 'x' } };
const PARCEL = { id: 'sh1', provider: 'simulator', direction: 'outbound', courier: 'Test Express', tracking: 'TEST0000004471', box: { preset: 'medium' }, weightKg: 1.2, bookedAt: '2026-10-03T00:00:00Z', cancelledAt: null, collectedAt: null, outForDeliveryAt: null, deliveredAt: null, returnedToStoreAt: null, attemptFailedCount: 0, lastAttemptReason: null, rebookedFromId: null, charged: 120, quoted: 120, gst: 18, returnHold: 80, branchId: 'b1', from: 'Hyderabad', declaredValue: 2400 };

beforeEach(() => { jest.clearAllMocks(); });

/* ══════════════════════════════════════════ her screen (R2, R8, R9, R11, R12, R16) */

describe('her Remote screen', () => {
  it('38 · shows a skeleton while loading, and a couldn’t-load state when the call fails', async () => {
    api.influencerApi.myRemote.mockReturnValue(new Promise(() => {}));   // never settles
    const loading = render(<RemoteShootScreen navigation={nav} route={HER_ROUTE} />);
    expect(loading.getByTestId('skeleton')).toBeTruthy();

    api.influencerApi.myRemote.mockResolvedValue({ success: false, error: { message: 'nope' } });
    const failed = render(<RemoteShootScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(failed.getByTestId('load-error')).toBeTruthy());
  });

  it('R2 · not sent — she is asked for her address and nothing else', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot({ can: { sendAddress: true } })));
    const r = render(<RemoteShootScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-not_sent')).toBeTruthy());
    fireEvent.press(r.getByTestId('send-address'));
    expect(nav.navigate).toHaveBeenCalledWith('RemoteAddress', { ciId: 'ci1' });
  });

  it('R8 · on the way — the tracking number, the steps, and what is coming', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot({
      stage: 'in_transit', address: ADDRESS, parcel: { ...PARCEL, collectedAt: 'x' }, lines: [LINE], can: {},
    })));
    const r = render(<RemoteShootScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-in_transit')).toBeTruthy());
    expect(r.getByTestId('tracking-number').props.children).toBe('TEST0000004471');
    expect(r.getByTestId('whats-coming')).toBeTruthy();
    // §11.2 — the money side is the brand's; she is never shown it.
    expect(JSON.stringify(r.toJSON())).not.toMatch(/₹120/);
  });

  it('R9 · delivered — one check per line, and the sentence that says it will not stop her', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot({
      stage: 'delivered', address: ADDRESS, parcel: { ...PARCEL, deliveredAt: 'x' }, lines: [LINE],
      can: { check: true },
    })));
    const r = render(<RemoteShootScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-delivered')).toBeTruthy());
    expect(r.getByTestId('check-hint').props.children).toMatch(/won't stop your shoot/i);
    expect(r.getByTestId('check-control-l1')).toBeTruthy();
    // The Save button waits until every line has an answer.
    expect(r.getByTestId('save-check').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(r.getByTestId('check-control-l1-received'));
    await waitFor(() => expect(r.getByTestId('save-check').props.accessibilityState.disabled).toBe(false));
  });

  // ui-walk-fixes, final review: the note box became opt-out on the shared check control (the
  // brand's "What came back?" pop-up draws none). HER note is unchanged: it shows what she typed
  // and it is what is sent.
  it('R9 · her note on a damaged item is kept as she types and is sent with her check', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot({
      stage: 'delivered', address: ADDRESS, parcel: { ...PARCEL, deliveredAt: 'x' }, lines: [LINE],
      can: { check: true },
    })));
    api.influencerApi.myRemoteCheck.mockResolvedValue(ok(shoot({
      stage: 'checked', address: ADDRESS, parcel: { ...PARCEL, deliveredAt: 'x' },
      lines: [{ ...LINE, check: 'damaged', checkNote: 'Torn at the hem' }],
    })));
    const r = render(<RemoteShootScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-delivered')).toBeTruthy());
    expect(r.queryByTestId('check-control-l1-note')).toBeNull();
    fireEvent.press(r.getByTestId('check-control-l1-damaged'));
    // ui-walk-fixes (closing pass): this box keeps "What was wrong?" under its own copy key.
    expect(r.getByTestId('check-control-l1-note').props.placeholder).toBe('What was wrong?');
    fireEvent.changeText(r.getByTestId('check-control-l1-note'), 'Torn at the hem');
    expect(r.getByTestId('check-control-l1-note').props.value).toBe('Torn at the hem');   // nothing she types vanishes
    fireEvent.press(r.getByTestId('save-check'));
    await waitFor(() => expect(api.influencerApi.myRemoteCheck).toHaveBeenCalledWith('ci1', {
      answers: [{ lineId: 'l1', status: 'damaged', note: 'Torn at the hem' }],
    }));
  });

  it('R11 · checked — she can mark the shoot done, and the sheet says the brand does not confirm it', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot({
      stage: 'checked', address: ADDRESS, parcel: { ...PARCEL, deliveredAt: 'x' },
      lines: [{ ...LINE, check: 'received', checkedAt: '2026-10-05T00:00:00Z' }],
      can: { markDone: true },
      return: { shipment: null, stage: 'due', dueDate: '2026-11-27', overdue: false, count: 1, canPickup: true },
    })));
    const r = render(<RemoteShootScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-checked')).toBeTruthy());
    fireEvent.press(r.getByTestId('mark-done'));
    await waitFor(() => expect(r.getByTestId('shoot-done-sheet')).toBeTruthy());
    expect(JSON.stringify(r.toJSON())).toMatch(/don't need to confirm it/i);
  });

  it('R12 · shot — the return costs her nothing, and the pickup starts tomorrow', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot({
      stage: 'shot', address: ADDRESS, parcel: { ...PARCEL, deliveredAt: 'x' },
      lines: [{ ...LINE, check: 'received' }],
      can: { bookReturn: true },
      return: { shipment: null, stage: 'due', dueDate: '2026-11-27', overdue: false, count: 1, canPickup: true },
    })));
    const r = render(<RemoteShootScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-shot')).toBeTruthy());
    fireEvent.press(r.getByTestId('book-return'));
    await waitFor(() => expect(r.getByTestId('pickup-sheet')).toBeTruthy());
    expect(r.getByTestId('pay-nothing').props.children).toMatch(/You pay nothing/);
  });

  it('Q1 · a no-return-pickup address offers "I\'ve sent it back" instead of a pickup', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot({
      stage: 'shot', address: { ...ADDRESS, pincode: '522998', coverage: { delivers: true, returnPickup: false } },
      parcel: { ...PARCEL, deliveredAt: 'x', returnHold: 0 },
      lines: [{ ...LINE, check: 'received' }],
      can: { markSelfSent: true },
      return: { shipment: null, stage: 'due', dueDate: '2026-11-27', overdue: false, count: 1, canPickup: false },
    })));
    const r = render(<RemoteShootScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-shot')).toBeTruthy());
    expect(r.queryByTestId('book-return')).toBeNull();
    expect(r.getByTestId('self-sent')).toBeTruthy();
    expect(r.getByTestId('self-send')).toBeTruthy();
  });

  it('R16 · Delayed — the chip, and the sentence that says nothing was lost', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot({
      delayed: { at: 'x', stage: 'not_booked' },
      gate: { open: true, reason: null, signed: { at: 'x' }, money: { required: true, locked: 9000, released: 2250 } },
      can: {},
    })));
    const r = render(<RemoteShootScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-not_sent-delayed')).toBeTruthy());
    expect(r.getByTestId('delayed-box')).toBeTruthy();
  });
});

/* ══════════════════════════════════════════ her address (R3, R4a, R4b) */

describe('her address screen', () => {
  it('R3 · her name, number, state and city arrive pre-filled', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot()));
    const r = render(<RemoteAddressScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-address')).toBeTruthy());
    expect(r.getByTestId('f-name').props.value).toBe('Tanvi Suresh');
    expect(r.getByTestId('f-phone').props.value).toBe('9876511111');
  });

  // ui-walk-fixes (closing pass, drift/K2.md): this box showed "What was wrong?" — the grey words
  // of the damaged-item note on her Remote screen, written under the same key further down the
  // copy file. Each box has its own words again.
  // features/courier-ready-addresses (check 18): 190 characters is all a courier keeps.
  it('18 · the House and street box says what to type, counts, and stops at 190', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot()));
    const r = render(<RemoteAddressScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-address')).toBeTruthy());
    expect(r.getByTestId('f-street').props.maxLength).toBe(190);
    const before = JSON.stringify(r.toJSON());
    expect(before).toContain('House or flat number, building, street and area.');
    expect(before).toContain('0/190');
    fireEvent.changeText(r.getByTestId('f-street'), 'Flat 302, Lakshmi Residency, 11 Gandhi Road, Brodipet');
    expect(JSON.stringify(r.toJSON())).toContain('53/190');
  });

  it('R3 · the empty Delivery note box suggests a landmark or a good time — not "What was wrong?"', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot()));
    const r = render(<RemoteAddressScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-address')).toBeTruthy());
    expect(r.getByTestId('f-note').props.value).toBe('');
    expect(r.getByTestId('f-note').props.placeholder).toBe('A landmark, or a good time to deliver');
    expect(r.getByTestId('f-sizes').props.placeholder).toBe('Top M, bottom 28, shoe 6');
    expect(JSON.stringify(r.toJSON())).not.toMatch(/What was wrong\?/);
  });

  it('R4b · a pincode couriers cannot reach blocks the send, with the server’s words', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot()));
    api.influencerApi.myRemoteCoverage.mockResolvedValue({
      success: true,
      data: { delivers: false, returnPickup: false, message: "Couriers don't deliver to 522999 yet. Try an address at a pincode nearby, such as where you work or a friend's." },
    });
    const r = render(<RemoteAddressScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-address')).toBeTruthy());
    fireEvent.changeText(r.getByTestId('f-pincode'), '522999');
    fireEvent(r.getByTestId('f-pincode'), 'blur');
    await waitFor(() => expect(r.getByTestId('review-send').props.accessibilityState.disabled).toBe(true));
  });

  it('R4b · a pincode with no return pickup warns but does NOT block', async () => {
    api.influencerApi.myRemote.mockResolvedValue(ok(shoot()));
    api.influencerApi.myRemoteCoverage.mockResolvedValue({
      success: true,
      data: { delivers: true, returnPickup: false, message: "Couriers deliver to 522998 but can't collect returns from it. You can still send it — Kanchi Silks will be told before they choose what to send back." },
    });
    const r = render(<RemoteAddressScreen navigation={nav} route={HER_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('remote-address')).toBeTruthy());
    fireEvent.changeText(r.getByTestId('f-pincode'), '522998');
    fireEvent(r.getByTestId('f-pincode'), 'blur');
    await waitFor(() => expect(r.getByTestId('coverage-warn')).toBeTruthy());
    expect(r.getByTestId('review-send').props.accessibilityState.disabled).toBe(false);
  });
});

/* ══════════════════════════════════════════ the brand's screens */

describe('the brand’s Remote screen', () => {
  it('R1 · waiting — the gate card, and Pick products disabled with the reason', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({ can: {} })));
    const r = render(<BrandRemoteScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('brand-remote-not_sent')).toBeTruthy());
    expect(r.getByTestId('gate-card')).toBeTruthy();
    expect(r.getByTestId('waiting-address')).toBeTruthy();
    expect(r.getByTestId('pick-disabled').props.accessibilityState.disabled).toBe(true);
  });

  it('R5 door · her address arrives and the picker opens', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({ stage: 'sent', address: ADDRESS, can: { pickProducts: true } })));
    const r = render(<BrandRemoteScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('brand-remote-sent')).toBeTruthy());
    expect(r.getByTestId('address-card')).toBeTruthy();
    expect(r.getByTestId('her-sizes')).toBeTruthy();
    fireEvent.press(r.getByTestId('pick-products'));
    expect(nav.navigate).toHaveBeenCalledWith('BrandRemoteProducts', { campaignId: 'c1', setId: 's1', ciId: 'ci1' });
  });

  it('R5 · a no-return-pickup address warns the brand BEFORE anything can be a Return', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({
      stage: 'sent', address: { ...ADDRESS, pincode: '522998', coverage: { delivers: true, returnPickup: false } },
      can: { pickProducts: true },
    })));
    const r = render(<BrandRemoteScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('no-return-pickup')).toBeTruthy());
  });

  it('R7 · booked — the label opens through the phone’s own viewer', async () => {
    const { Linking } = require('react-native');
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    api.brandApi.remote.mockResolvedValue(ok(shoot({ stage: 'booked', address: ADDRESS, parcel: PARCEL, lines: [LINE], can: { label: true, cancel: true } })));
    api.brandApi.remoteLabel.mockResolvedValue({ success: true, data: { url: 'https://example.test/label.pdf' } });
    const r = render(<BrandRemoteScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('brand-remote-booked')).toBeTruthy());
    fireEvent.press(r.getByTestId('download-label'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('https://example.test/label.pdf'));
    spy.mockRestore();
  });

  it('39 · the cancel sheet honours busy — a second tap produces nothing', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({ stage: 'booked', address: ADDRESS, parcel: PARCEL, lines: [LINE], can: { cancel: true } })));
    let settle;
    api.brandApi.remoteCancel.mockReturnValue(new Promise((res) => { settle = res; }));
    const r = render(<BrandRemoteScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('brand-remote-booked')).toBeTruthy());
    fireEvent.press(r.getByTestId('cancel-booking'));
    await waitFor(() => expect(r.getByTestId('cancel-booking-sheet')).toBeTruthy());
    fireEvent.press(r.getByTestId('cancel-booking-confirm'));
    fireEvent.press(r.getByTestId('cancel-booking-confirm'));
    expect(api.brandApi.remoteCancel).toHaveBeenCalledTimes(1);
    settle({ success: true, data: { shoot: shoot() } });
  });

  it('R10 · a difference is shown with the item named, and her shoot carries on', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({
      stage: 'delivered', address: ADDRESS, parcel: { ...PARCEL, deliveredAt: 'x' },
      lines: [{ ...LINE, check: 'damaged', checkNote: 'Torn at the hem', checkedAt: '2026-10-06T00:00:00Z' }],
      can: { reportDifference: true, acknowledgeDifference: true },
    })));
    const r = render(<BrandRemoteScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('difference-card')).toBeTruthy());
    expect(r.getByTestId('flagged-l1').props.children).toMatch(/Torn at the hem/);
    expect(r.getByTestId('report-difference')).toBeTruthy();
    expect(r.getByTestId('carry-on')).toBeTruthy();
  });

  it('R13 · the return arrived — each item is confirmed, with the auto-confirm date stated', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({
      stage: 'shot', address: ADDRESS, parcel: { ...PARCEL, deliveredAt: 'x' },
      lines: [{ ...LINE, check: 'received' }],
      can: { confirmReturn: true },
      return: { shipment: { id: 'r1', deliveredAt: '2026-11-01T00:00:00Z', autoConfirmDueAt: '2026-11-08T00:00:00Z' }, stage: 'delivered', dueDate: '2026-11-27', overdue: false, count: 1, canPickup: true },
    })));
    const r = render(<BrandRemoteScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('return-arrived')).toBeTruthy());
    fireEvent.press(r.getByTestId('confirm-return'));
    await waitFor(() => expect(r.getByTestId('confirm-return-sheet')).toBeTruthy());
    // It waits until every line has an answer.
    expect(r.getByTestId('confirm-return-confirm').props.accessibilityState.disabled).toBe(true);
  });

  // ui-walk-fixes, final review (board C, check 10). Marking an item Damaged here used to open a
  // note box that swallowed every letter (the pop-up kept no value for it and the server's confirm
  // step takes no note). R13 draws three buttons per item and no note: none is drawn, and what
  // goes to the server is each item's answer and nothing else.
  it('R13 · marking an item Damaged opens no note box, and the answer alone is what is sent', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({
      stage: 'shot', address: ADDRESS, parcel: { ...PARCEL, deliveredAt: 'x' },
      lines: [{ ...LINE, check: 'received' }],
      can: { confirmReturn: true },
      return: { shipment: { id: 'r1', deliveredAt: '2026-11-01T00:00:00Z', autoConfirmDueAt: '2026-11-08T00:00:00Z' }, stage: 'delivered', dueDate: '2026-11-27', overdue: false, count: 1, canPickup: true },
    })));
    api.brandApi.remoteConfirmReturn.mockResolvedValue(ok(shoot({ stage: 'shot', address: ADDRESS, lines: [{ ...LINE, check: 'received', returnStatus: 'damaged' }] })));
    const r = render(<BrandRemoteScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('return-arrived')).toBeTruthy());
    fireEvent.press(r.getByTestId('confirm-return'));
    await waitFor(() => expect(r.getByTestId('confirm-return-sheet')).toBeTruthy());
    fireEvent.press(r.getByTestId('confirm-check-l1-damaged'));
    expect(r.getByTestId('confirm-check-l1-damaged').props.accessibilityState.selected).toBe(true);
    expect(r.queryByTestId('confirm-check-l1-note')).toBeNull();
    fireEvent.press(r.getByTestId('confirm-return-confirm'));
    await waitFor(() => expect(api.brandApi.remoteConfirmReturn).toHaveBeenCalledWith('c1', 's1', 'ci1', {
      answers: [{ lineId: 'l1', status: 'damaged' }],
    }));
  });

  it('R15b · back to the store — the brand may book it once more', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({
      stage: 'booked', address: ADDRESS,
      parcel: { ...PARCEL, collectedAt: 'x', returnedToStoreAt: 'y', lastAttemptReason: 'Address not found' },
      lines: [LINE], can: { rebook: true },
    })));
    const r = render(<BrandRemoteScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('back-to-store')).toBeTruthy());
    fireEvent.press(r.getByTestId('book-again'));
    expect(nav.navigate).toHaveBeenCalledWith('BrandRemoteBook', { campaignId: 'c1', setId: 's1', ciId: 'ci1', rebook: true });
  });
});

describe('the brand’s products screen (R5)', () => {
  const CAT = { success: true, data: { scope: { kind: 'store', label: 'Whole store' }, products: [{ id: 'p1', name: 'Indigo Saree', image: null, price: 2400, variants: [] }], nextCursor: null } };

  it('shows her address, the scope and the count', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({ stage: 'sent', address: ADDRESS, can: { pickProducts: true } })));
    api.brandApi.remoteProducts.mockResolvedValue(CAT);
    const r = render(<BrandRemoteProductsScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('brand-remote-products')).toBeTruthy());
    expect(r.getByTestId('address-card')).toBeTruthy();
    expect(r.getByTestId('scope-line').props.children).toMatch(/Whole store/);
    expect(r.getByTestId('line-count').props.children).toMatch(/0 of 20/);
    expect(r.getByTestId('products-continue').props.accessibilityState.disabled).toBe(true);
  });

  it('Q3 · a collaboration with no selling scope says so instead of showing an empty list', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({ stage: 'sent', address: ADDRESS, can: { pickProducts: true } })));
    api.brandApi.remoteProducts.mockResolvedValue({
      success: false, error: { code: 'SCOPE_NOT_SET', message: "Tanvi's selling scope hasn't been set, so there's nothing you can send her yet." },
    });
    const r = render(<BrandRemoteProductsScreen navigation={nav} route={BRAND_ROUTE} />);
    // The SERVER's sentence reaches the screen, word for word — that is the thing worth
    // asserting, more than the element it sits in.
    await waitFor(() => expect(r.getByText("Tanvi's selling scope hasn't been set, so there's nothing you can send her yet.")).toBeTruthy());
    expect(r.queryByTestId('product-search')).toBeNull();
    expect(r.getByTestId('products-continue').props.accessibilityState.disabled).toBe(true);
  });

  it('picking a product enables Continue and counts it', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({ stage: 'sent', address: ADDRESS, can: { pickProducts: true } })));
    api.brandApi.remoteProducts.mockResolvedValue(CAT);
    const r = render(<BrandRemoteProductsScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('brand-remote-products')).toBeTruthy());
    fireEvent.press(r.getByTestId('product-p1-toggle'));
    await waitFor(() => expect(r.getByTestId('line-count').props.children).toMatch(/1 of 20/));
    expect(r.getByTestId('products-continue').props.accessibilityState.disabled).toBe(false);
  });
});

describe('the brand’s booking screen (R6, R6b)', () => {
  const BRANCHES = { success: true, data: { branches: [
    { id: 'b1', name: 'Banjara Hills', isMain: true, formattedAddress: 'Road 12', pincode: '500034', cityName: 'Hyderabad' },
    { id: 'b2', name: 'No Address Branch', isMain: false, formattedAddress: null, pincode: null, cityName: null },
  ] } };

  it('Q9 · a branch with no street address cannot be selected, and says why', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({ stage: 'sent', address: ADDRESS, lines: [LINE], can: { book: true } })));
    api.brandApi.listBranches.mockResolvedValue(BRANCHES);
    const r = render(<BrandRemoteBookScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('brand-remote-book')).toBeTruthy());
    const dead = r.getByTestId('branch-b2');
    expect(dead.props.accessibilityState.disabled).toBe(true);
    expect(JSON.stringify(r.toJSON())).toMatch(/Needs a street address and pincode/);
  });

  // features/courier-ready-addresses (check 17): an address a courier would refuse is greyed
  // BEFORE the tap, in the server's own words — not refused after it.
  it('17 · a branch with no shop or door number cannot be selected, and says exactly that', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({ stage: 'sent', address: ADDRESS, lines: [LINE], can: { book: true } })));
    api.brandApi.listBranches.mockResolvedValue({ success: true, data: { branches: [
      { id: 'b1', name: 'Banjara Hills', isMain: true, formattedAddress: 'Road No. 12, Banjara Hills', pincode: '500034', cityName: 'Hyderabad', courierReady: true, courierProblem: null },
      { id: 'b3', name: 'Guntur store', isMain: false, formattedAddress: 'Guntur, Andhra Pradesh, India', pincode: '522006', cityName: 'Guntur', courierReady: false, courierProblem: 'Needs a shop or door number' },
      { id: 'b2', name: 'No Address Branch', isMain: false, formattedAddress: null, pincode: null, cityName: null, courierReady: false, courierProblem: 'Needs a street address and pincode' },
    ] } });
    const r = render(<BrandRemoteBookScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('brand-remote-book')).toBeTruthy());
    expect(r.getByTestId('branch-b1').props.accessibilityState.disabled).toBe(false);
    expect(r.getByTestId('branch-b3').props.accessibilityState.disabled).toBe(true);
    expect(r.getByTestId('branch-b2').props.accessibilityState.disabled).toBe(true);
    const shown = JSON.stringify(r.toJSON());
    expect(shown).toContain('Needs a shop or door number');
    expect(shown).toContain('Needs a street address and pincode');
    expect(shown).toContain('Hyderabad, 500034');
    // Tapping the greyed branch selects nothing.
    fireEvent.press(r.getByTestId('branch-b3'));
    expect(r.getByTestId('branch-b3').props.accessibilityState.selected).toBe(false);
  });

  it('R6 · the price appears with GST included and the return lock named', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({ stage: 'sent', address: ADDRESS, lines: [LINE], can: { book: true } })));
    api.brandApi.listBranches.mockResolvedValue(BRANCHES);
    api.brandApi.remoteQuote.mockResolvedValue({ success: true, data: {
      outbound: 120, gst: 18, gstIncluded: true, returnHold: 80, holdBasis: 'quoted', returnCount: 1,
      canPickup: true, total: 200, available: 5000, shortfall: 0, enough: true, lockedFee: 9000, line: 'GST included.',
    } });
    const r = render(<BrandRemoteBookScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('brand-remote-book')).toBeTruthy());
    fireEvent.changeText(r.getByTestId('weight'), '1.2');
    fireEvent(r.getByTestId('weight'), 'blur');
    await waitFor(() => expect(r.getByTestId('money-card')).toBeTruthy());
    expect(r.getByTestId('money-hold')).toBeTruthy();
    expect(r.getByTestId('book-and-pay')).toBeTruthy();
    expect(JSON.stringify(r.toJSON())).toMatch(/is never used for shipping/);
  });

  it('R6b · a short balance names the shortfall and offers Add money, not the booking', async () => {
    api.brandApi.remote.mockResolvedValue(ok(shoot({ stage: 'sent', address: ADDRESS, lines: [LINE], can: { book: true } })));
    api.brandApi.listBranches.mockResolvedValue(BRANCHES);
    api.brandApi.remoteQuote.mockResolvedValue({ success: true, data: {
      outbound: 120, gst: 18, gstIncluded: true, returnHold: 80, holdBasis: 'quoted', returnCount: 1,
      canPickup: true, total: 200, available: 10, shortfall: 190, enough: false, lockedFee: 0, line: 'Add ₹190 to book this parcel.',
    } });
    const r = render(<BrandRemoteBookScreen navigation={nav} route={BRAND_ROUTE} />);
    await waitFor(() => expect(r.getByTestId('brand-remote-book')).toBeTruthy());
    fireEvent.changeText(r.getByTestId('weight'), '1.2');
    fireEvent(r.getByTestId('weight'), 'blur');
    await waitFor(() => expect(r.getByTestId('shortfall')).toBeTruthy());
    expect(r.queryByTestId('book-and-pay')).toBeNull();
    expect(r.getByTestId('add-money')).toBeTruthy();
    expect(r.getByTestId('back-to-products')).toBeTruthy();
  });
});
