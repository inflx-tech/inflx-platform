/**
 * shopper-walk-fixes — the shopper's Return (01-spec.md W14 · rules v1.18 §6.16).
 *
 *   · Order details: a delivered item inside INFLX's return window has a Return button and says
 *     until when; outside it, the server's sentence; a return in hand shows as a box (requested,
 *     not accepted with INFLX's note, returned with what happened to the money).
 *   · My orders: a "Returned" filter; a returned row never reads "Arrives by"; a return still being
 *     decided is said on the row.
 *   · The Return screen: what goes back (a deal together, warned), until when, a reason (required;
 *     "Other" needs a note), the refund and how it works, as the server says them → "Return requested".
 *   · The phone states no number of days anywhere: the window is INFLX's admin setting.
 */
import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, fireEvent, waitFor, act, within } from '@testing-library/react-native';

jest.mock('../../../../services/api', () => ({
  followerApi: {
    orders: jest.fn(), orderLine: jest.fn(), cancelPreview: jest.fn(), cancelLine: jest.fn(),
    returnPreview: jest.fn(), returnLine: jest.fn(),
    getBag: jest.fn(), putBag: jest.fn(), mergeBag: jest.fn(), bagPrice: jest.fn(),
    postEvents: jest.fn(() => Promise.resolve({ success: true })),
  },
  setDeviceHeader: jest.fn(), clearSession: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../../services/events', () => ({ track: jest.fn(), flush: jest.fn() }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { followerApi } = require('../../../../services/api');
const { OrdersScreen, OrderDetailScreen } = require('../OrderScreens');
const ReturnScreen = require('../ReturnScreen').default;
const { CR, refundWords, untilLabel } = require('../../../../components/shop/copyReturn');
const { CO } = require('../../../../components/shop/copyOrder');
const { inr } = require('../../../../components/shop/copyShop');

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), addListener: jest.fn(() => () => {}) });
const ok = (data) => ({ success: true, data });
const no = (message) => ({ success: false, error: { code: 'CONFLICT', message } });
beforeEach(() => { jest.clearAllMocks(); });

// Sunday 11 October 2026, 4:30 in the afternoon, on this phone's clock.
const UNTIL = new Date(2026, 9, 11, 16, 30).toISOString();
const LINE = (extra = {}) => ({
  id: 'l1', name: 'Wrangler Regular', colour: 'Blue', size: '32', qty: 1, paid: 1395, role: 'buy',
  status: 'delivered', status_word: 'Delivered', brand: { name: 'Urban Threads' }, creator: { id: 'c', name: 'Sneha' },
  can_cancel: false, can_return: false, return_until: null, return_closed: null, return: null, payment_method: 'online',
  timeline: [{ status: 'confirmed', word: 'Confirmed', at: '2026-10-01T10:00:00Z' }, { status: 'delivered', word: 'Delivered', at: '2026-10-04T10:00:00Z' }],
  address: { name: 'Anusha K', house: 'Flat 4B', city: 'Hyderabad', pincode: '500034' }, post: null, refund: null, ...extra,
});
const BACK = (status, word, extra = {}) => ({
  status, word, reason: "The size doesn't fit", note: null, inflx_note: null, requested_at: '2026-10-05T09:00:00Z', decided_at: null, refunded_at: null, refund: null, ...extra,
});
const detail = async (line) => {
  followerApi.orderLine.mockResolvedValue(ok(line));
  const n = nav();
  const d = render(<OrderDetailScreen navigation={n} route={{ params: { lineId: 'l1' } }} />);
  await d.findByTestId('order-detail');
  return { d, n };
};

describe('the words', () => {
  it('a window closes at a time, so "until" says the day and the time', () => {
    expect(untilLabel(UNTIL)).toBe('Sun, 11 Oct, 4:30 pm');
    expect(untilLabel(new Date(2026, 9, 5, 9, 0).toISOString())).toBe('Mon, 5 Oct, 9 am');
    expect(untilLabel(new Date(2026, 9, 5, 0, 5).toISOString())).toBe('Mon, 5 Oct, 12:05 am');
    expect(untilLabel(new Date(2026, 9, 5, 12, 0).toISOString())).toBe('Mon, 5 Oct, 12 pm');
    expect(untilLabel(null)).toBe('');
    expect(untilLabel('not a date')).toBe('');
  });

  it('what happened to the money: online, cash paid back by hand, none needed, failed', () => {
    expect(refundWords(null, inr)).toBeNull();
    expect(refundWords({ status: 'issued', amount: 1395 }, inr)).toBe(CO.refundOnWay('₹1,395'));
    expect(refundWords({ status: 'pending', amount: 1395 }, inr)).toBe(CO.refundOnWay('₹1,395'));
    expect(refundWords({ status: 'manual', amount: 1395 }, inr)).toBe('You paid cash, so INFLX sends your refund of ₹1,395 to you directly.');
    expect(refundWords({ status: 'not_needed', amount: 0 }, inr)).toBe(CO.noRefund);
    expect(refundWords({ status: 'failed', amount: 1395 }, inr)).toBe(CO.refundFailed);
  });

  it('no sentence of the Return states a number of days — the window is INFLX\'s setting', () => {
    const all = JSON.stringify(CR, (k, v) => (typeof v === 'function' ? v('X', 'Y') : v));
    expect(all).not.toMatch(/\b\d+\s*(day|hour)/i);
  });
});

describe('Order details', () => {
  it('delivered, inside the window: a Return button, until when, and it opens the Return screen', async () => {
    const { d, n } = await detail(LINE({ can_return: true, return_until: UNTIL }));
    d.getByText('You can return this until Sun, 11 Oct, 4:30 pm.');
    expect(d.queryByTestId('order-cancel')).toBeNull();
    expect(d.queryByTestId('return-box')).toBeNull();
    expect(d.queryByText(CO.cancelClosed)).toBeNull();
    fireEvent.press(d.getByTestId('order-return'));
    expect(n.navigate).toHaveBeenCalledWith('ReturnItem', { lineId: 'l1' });
  });

  it('delivered, the window has closed: the server\'s sentence, and no button', async () => {
    const { d } = await detail(LINE({ return_until: UNTIL, return_closed: 'The return window (7 days from delivery) has closed.' }));
    expect(d.getByTestId('order-return-closed').props.children).toBe('The return window (7 days from delivery) has closed.');
    expect(d.queryByTestId('order-return')).toBeNull();
  });

  it('still on its way: it can be returned once delivered — never a Return button', async () => {
    const { d } = await detail(LINE({ status: 'dispatched', status_word: 'Shipped' }));
    d.getByText(CO.cancelClosed);
    expect(d.queryByTestId('order-return')).toBeNull();
  });

  it('she has asked: the box says INFLX is looking at it, her reason, and there is no second Return button', async () => {
    const { d } = await detail(LINE({ return_until: UNTIL, return: BACK('requested', 'Return requested') }));
    expect(d.getByTestId('return-word').props.children).toBe('Return requested');
    expect(d.getByTestId('return-line').props.children).toBe(CR.box.requested);
    d.getByText("Your reason: The size doesn't fit");
    d.getByText('Asked on Mon, 5 Oct');
    expect(d.queryByTestId('order-return')).toBeNull();
    expect(d.queryByTestId('return-refund')).toBeNull();
  });

  it('approved: the store collects it and the refund follows', async () => {
    const { d } = await detail(LINE({ return: BACK('approved', 'Return approved') }));
    expect(d.getByTestId('return-line').props.children).toBe('The store will collect the item. Your refund follows when it is back.');
  });

  it('not accepted: INFLX\'s note is shown, and the item stays delivered', async () => {
    const { d } = await detail(LINE({ return: BACK('rejected', 'Return not accepted', { inflx_note: 'Worn and washed', note: null }) }));
    expect(d.getByTestId('return-word').props.children).toBe('Return not accepted');
    d.getByText('INFLX: Worn and washed');
    d.getByText(CR.box.rejected);
    expect(d.queryByTestId('order-return')).toBeNull();
  });

  it('returned, paid online: the box says the refund is on its way — said once, not twice', async () => {
    const refund = { status: 'issued', amount: 1395 };
    const { d } = await detail(LINE({ status: 'returned', status_word: 'Returned', refund,
      return: BACK('refunded', 'Returned', { refund, reason: 'Other', note: 'Too tight' }),
      timeline: [{ status: 'confirmed', word: 'Confirmed', at: '2026-10-01T10:00:00Z' }, { status: 'returned', word: 'Returned', at: '2026-10-08T10:00:00Z' }] }));
    expect(d.getByTestId('return-refund').props.children).toBe(CO.refundOnWay('₹1,395'));
    expect(d.queryByTestId('order-refund')).toBeNull();
    d.getByText('Your reason: Other — Too tight');
    expect(d.queryByText(CO.cancelClosed)).toBeNull();                                    // "It has shipped. You can return it…" is not for this
    expect(d.queryByTestId('order-return')).toBeNull();
  });

  it('returned, paid in cash: INFLX sends the refund directly', async () => {
    const refund = { status: 'manual', amount: 1395 };
    const { d } = await detail(LINE({ status: 'returned', status_word: 'Returned', payment_method: 'cod', refund, return: BACK('refunded', 'Returned', { refund }) }));
    expect(d.getByTestId('return-refund').props.children).toBe('You paid cash, so INFLX sends your refund of ₹1,395 to you directly.');
  });

  it('a cancelled item keeps its own refund line, as before', async () => {
    const { d } = await detail(LINE({ status: 'cancelled', status_word: 'Cancelled', refund: { status: 'issued', amount: 1395 } }));
    expect(d.getByTestId('order-refund').props.children).toBe(CO.refundOnWay('₹1,395'));
    expect(d.queryByTestId('return-box')).toBeNull();
  });
});

describe('My orders', () => {
  const ROW = (extra) => ({ id: 'l1', name: 'Wrangler Regular', colour: 'Blue', size: '32', qty: 1, paid: 1395, role: 'buy', arrives_by: '2026-10-04', brand: { name: 'Urban Threads' }, return: null, ...extra });

  it('"Returned" is a filter of its own, and asks the server for returned items', async () => {
    followerApi.orders.mockResolvedValue(ok({ items: [], more: false }));
    const list = render(<OrdersScreen navigation={nav()} />);
    await list.findByTestId('orders-empty');
    fireEvent.press(list.getByTestId('orders-filter-returned'));
    await waitFor(() => expect(followerApi.orders).toHaveBeenLastCalledWith({ status: 'returned', q: undefined }));
    list.getByTestId('orders-filter-cancelled');                                          // the others are still there
  });

  it('a returned row reads "Returned" — never "Arrives by"; a return being decided is said on its row', async () => {
    followerApi.orders.mockResolvedValue(ok({ items: [
      ROW({ id: 'l1', status: 'returned', status_word: 'Returned', return: BACK('refunded', 'Returned') }),
      ROW({ id: 'l2', status: 'delivered', status_word: 'Delivered', return: BACK('requested', 'Return requested') }),
      ROW({ id: 'l3', status: 'delivered', status_word: 'Delivered' }),
      ROW({ id: 'l4', status: 'dispatched', status_word: 'Shipped' }),
    ], more: false }));
    const list = render(<OrdersScreen navigation={nav()} />);
    await list.findByTestId('order-l1');
    // each row's own status line ("Returned" is also the filter's word, so look inside the row)
    const row = (id) => within(list.getByTestId(`order-${id}`));
    row('l1').getByText('Returned');
    row('l2').getByText('Delivered · Return requested');
    row('l3').getByText('Delivered');
    row('l4').getByText('Shipped · Arrives by Sun, 4 Oct');
    expect(row('l1').queryByText(/Arrives by/)).toBeNull();
    expect(row('l3').queryByText(/Arrives by/)).toBeNull();
  });
});

describe('the Return screen', () => {
  const PREVIEW = {
    lines: [{ id: 'l1', name: 'Wrangler Regular', size: '32', colour: 'Blue', role: 'buy' }, { id: 'l2', name: "Levi's 511", size: '32', colour: 'Blue', role: 'buy' }],
    warning: 'This is part of a deal. Returning it returns 2 items together.',
    until: UNTIL, window: '7 days',
    refund: { amount: 2999, text: 'Refund of ₹2,999 to your original payment method once the item is back.' },
    how: 'INFLX looks at every return. Once it is approved, the store collects the item; your refund follows when it is back.',
    reasons: [{ key: 'wrong_size', label: "The size doesn't fit" }, { key: 'damaged', label: 'It arrived damaged' }, { key: 'not_as_described', label: "It isn't as shown" },
      { key: 'changed_mind', label: 'I changed my mind' }, { key: 'other', label: 'Other' }],
  };
  const open = async () => {
    const n = nav();
    const c = render(<ReturnScreen navigation={n} route={{ params: { lineId: 'l1' } }} />);
    await c.findByTestId('return');
    return { c, n };
  };
  const off = (c) => c.getByTestId('confirm-return').props.accessibilityState.disabled;

  it('what goes back, until when, the refund and how it works are the server\'s; a reason is required', async () => {
    followerApi.returnPreview.mockResolvedValue(ok(PREVIEW));
    followerApi.returnLine.mockResolvedValue(ok({ request_id: 'r1', status: 'requested', word: 'Return requested', lines: ['l1', 'l2'] }));
    const { c, n } = await open();
    expect(followerApi.returnPreview).toHaveBeenCalledWith('l1');
    c.getByText('⚠ This is part of a deal. Returning it returns 2 items together.');
    c.getByText('Wrangler Regular · 32');
    c.getByText("Levi's 511 · 32");
    expect(c.getByTestId('return-until').props.children).toBe('You can return this until Sun, 11 Oct, 4:30 pm.');
    c.getByText(PREVIEW.refund.text);
    expect(c.getByTestId('return-how').props.children).toBe(PREVIEW.how);
    expect(off(c)).toBe(true);                                                            // no reason yet
    fireEvent.press(c.getByTestId('reason-wrong_size'));
    expect(off(c)).toBe(false);
    expect(c.queryByTestId('return-note-box')).toBeNull();
    await act(async () => { fireEvent.press(c.getByTestId('confirm-return')); });
    expect(followerApi.returnLine).toHaveBeenCalledWith('l1', { reason: 'wrong_size', note: undefined });
    await c.findByTestId('return-requested');
    expect(c.getAllByText('Return requested').length).toBeGreaterThan(0);
    c.getByText(PREVIEW.how);
    c.getByText(PREVIEW.refund.text);
    fireEvent.press(c.getByTestId('returned-orders'));
    expect(n.navigate).toHaveBeenCalledWith('Orders');
  });

  it('"Other" needs a note, and the note goes with it', async () => {
    followerApi.returnPreview.mockResolvedValue(ok({ ...PREVIEW, lines: [PREVIEW.lines[0]], warning: null }));
    followerApi.returnLine.mockResolvedValue(ok({ request_id: 'r1', status: 'requested', word: 'Return requested', lines: ['l1'] }));
    const { c } = await open();
    expect(c.queryByText(/part of a deal/)).toBeNull();
    fireEvent.press(c.getByTestId('reason-other'));
    c.getByText('Other (write a note)');
    expect(off(c)).toBe(true);
    fireEvent.changeText(c.getByTestId('return-note-box'), '   ');
    expect(off(c)).toBe(true);                                                            // spaces are not a note
    fireEvent.changeText(c.getByTestId('return-note-box'), ' Too tight at the waist ');
    expect(off(c)).toBe(false);
    await act(async () => { fireEvent.press(c.getByTestId('confirm-return')); });
    expect(followerApi.returnLine).toHaveBeenCalledWith('l1', { reason: 'other', note: 'Too tight at the waist' });
  });

  it('the server refuses to open it (the window has closed): its sentence is shown, and nothing can be sent', async () => {
    followerApi.returnPreview.mockResolvedValue(no('The return window (24 hours from delivery) has closed.'));
    const c = render(<ReturnScreen navigation={nav()} route={{ params: { lineId: 'l1' } }} />);
    await c.findByText('The return window (24 hours from delivery) has closed.');
    expect(c.queryByTestId('confirm-return')).toBeNull();
    expect(followerApi.returnLine).not.toHaveBeenCalled();
  });

  it('the server refuses the request: she stays on the screen with its sentence, and can try again', async () => {
    followerApi.returnPreview.mockResolvedValue(ok({ ...PREVIEW, lines: [PREVIEW.lines[0]], warning: null }));
    followerApi.returnLine.mockResolvedValueOnce(no('You have already asked to return this.'));
    const { c } = await open();
    fireEvent.press(c.getByTestId('reason-damaged'));
    await act(async () => { fireEvent.press(c.getByTestId('confirm-return')); });
    c.getByText('You have already asked to return this.');
    expect(c.queryByTestId('return-requested')).toBeNull();
    expect(off(c)).toBe(false);
  });
});

describe('the shopper app\'s route list', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../../../navigation/FollowerNavigator.js'), 'utf8');

  it('Return is a screen of its own, registered once', () => {
    expect(src).toContain("import ReturnScreen from '../screens/shop/order/ReturnScreen';");
    expect(src.split('name="ReturnItem"').length - 1).toBe(1);
    expect(src).toContain('<Stack.Screen name="ReturnItem" component={ReturnScreen} />');
  });

  it('no route name is used twice, and every screen a route names is imported or defined in the file', () => {
    const names = [...src.matchAll(/<(?:Stack|Tab)\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]);
    expect(names.filter((x, i) => names.indexOf(x) !== i)).toEqual([]);
    const components = [...new Set([...src.matchAll(/component=\{(\w+)\}/g)].map((m) => m[1]))];
    const missing = components.filter((c) => !new RegExp(`import\\s+${c}\\b|import\\s*\\{[^}]*\\b${c}\\b[^}]*\\}|function\\s+${c}\\b|const\\s+${c}\\b`).test(src));
    expect(missing).toEqual([]);
  });
});
