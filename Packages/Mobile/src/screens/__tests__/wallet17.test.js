/**
 * Item 17 — the Wallet on both phones, every screen of the locked board (BW1–BW10, CW1–CW7).
 * Contract: features/item17-wallet · master rules v1.31 §17A
 *
 * React Native has no compile step: a bad import or a typo fails on the DEVICE. Every screen is
 * mounted here with the server's real read shape (walletRead.service / withdrawalRequest.service),
 * copied from the API — never the shape the screen happens to read.
 */
import React from 'react';
import { render, waitFor, fireEvent, act } from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => { const R = require('react'); R.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]); },
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('../../services/api', () => {
  const side = () => ({
    getWallet: jest.fn(), getMe: jest.fn(), getWalletLocked: jest.fn(), getWalletSales: jest.fn(), getWalletPayments: jest.fn(),
    getWalletCommission: jest.fn(), getWalletHistory: jest.fn(), getWithdrawOptions: jest.fn(), requestWithdrawal: jest.fn(),
    getWalletWithdrawals: jest.fn(),
  });
  return { brandApi: side(), influencerApi: side(), referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn() };
});
const { brandApi, influencerApi } = require('../../services/api');
import BrandWalletScreen from '../brand/BrandWalletScreen';
import BrandWalletLockedScreen, { BrandWalletCollabScreen } from '../brand/BrandWalletLockedScreen';
import BrandWalletSalesScreen, { BrandWalletSaleScreen } from '../brand/BrandWalletSalesScreen';
import CreatorWalletScreen from '../influencer/CreatorWalletScreen';
import { CreatorWalletPaymentsScreen, CreatorWalletCommissionScreen } from '../influencer/CreatorWalletMoneyScreens';
import WithdrawScreen from '../wallet/WithdrawScreen';
import WithdrawalsScreen from '../wallet/WithdrawalsScreen';
import WalletHistoryScreen from '../wallet/WalletHistoryScreen';
import WalletDetailsScreen from '../wallet/WalletDetailsScreen';

const ok = (data) => ({ success: true, data });
const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), setParams: jest.fn() });
const flat = (r) => JSON.stringify(r.toJSON());

const WAITING = { id: 'w1', amount: 20000, method: 'bank', sendTo: '··4821 · HDFC0001234', status: 'requested', requestedAt: '2026-10-01T05:30:00.000Z', processHours: 24, processedAt: null, paidOn: null, reference: null, reason: null };
const FIGURES = { available: 48200, onHold: 0, locked: 21875, lockedCount: 3, salesComing: 12070, salesComingCount: 9 };
const pays = (a, b2, c, due) => [
  { n: 1, label: 'At signing · 25%', amount: a, status: 'released', paid: true, paidAt: '2026-10-02T06:00:00.000Z', dueAt: null },
  { n: 2, label: 'When confirmed live · 25%', amount: b2, status: due ? 'released' : 'locked', paid: !!due, paidAt: due ? '2026-10-24T06:00:00.000Z' : null, dueAt: null },
  { n: 3, label: 'Final 50%', amount: c, status: due ? 'queued' : 'locked', paid: false, paidAt: null, dueAt: due || null },
];
const HYBRID = { ciId: 'ci1', setId: 's1', setName: 'Set C', campaignId: 'c1', campaignName: 'Diwali Edit', aim: 'hybrid', aimLabel: 'Hybrid', brandId: 'b1', brandName: 'Urban Threads',
  influencerId: 'i1', creatorName: 'Tanvi Suresh', amount: 8500, paid: 2125, locked: 6375, refunded: 0, campaignFee: 0, payments: pays(2125, 2125, 4250), next: { n: 2, amount: 2125, dueAt: null, kind: 'confirm_live' } };
const CONTENT = { ciId: 'ci2', setId: 's2', setName: 'Set A', campaignId: 'c2', campaignName: 'Winter Run', aim: 'engagement', aimLabel: 'Pay for Content', brandId: 'b1', brandName: 'Sri Lakshmi Silks',
  influencerId: 'i2', creatorName: 'Meera Rao', amount: 12000, paid: 6000, locked: 6000, refunded: 0, campaignFee: 960, payments: pays(3000, 3000, 6000, '2026-10-31T00:00:00.000Z'), next: { n: 3, amount: 6000, dueAt: '2026-10-31T00:00:00.000Z', kind: 'date' } };
const sale = (over) => ({ id: 'l1', item: 'Kanchi silk saree', qty: 1, colour: null, size: null, gift: false, soldAt: '2026-10-05T07:00:00.000Z',
  post: { id: 'p1', code: 'K7M2F9', title: 'Festive silk' }, campaignName: 'Diwali Edit', setName: 'Set C', offerName: '20% off · Festive silk', cashOnDelivery: false,
  orderStatus: 'delivered', deliveredAt: '2026-10-05T12:00:00.000Z', state: 'window', windowUntil: '2026-10-12', at: null,
  creatorName: 'Tanvi Suresh', creatorFirst: 'Tanvi', brandName: 'Urban Threads', paid: 3199, commissionPct: 10, feePct: 5, creatorShare: 320, inflxShare: 160, brandShare: 2719, ...over });

beforeEach(() => jest.clearAllMocks());

/* ───────────────────────────────────────────── BRAND */

describe('BW1 · BW2 — the brand Wallet tab', () => {
  it('BW1: Available on top, then Locked and Sales money coming, each opening its own list', async () => {
    brandApi.getWallet.mockResolvedValue(ok({ figures: FIGURES, withdrawal_waiting: null, wallet: {} }));
    brandApi.getMe.mockResolvedValue(ok({ brand: { gstin: '36ABCDE1234F1Z5', has_bank_account: true } }));
    const n = nav();
    const r = render(<BrandWalletScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('brand-wallet'));
    r.getByText('Available');
    expect(r.getByTestId('wallet-available-amount').props.children).toBe('₹48,200');
    r.getByText('Locked in collaborations'); r.getByText('3 collaborations'); r.getByText('₹21,875');
    r.getByText('Sales money coming'); r.getByText('9 sales in their return window'); r.getByText('₹12,070');
    r.getByText('History'); r.getByText('Everything in and out');
    r.getByText('Bank and business details'); r.getByText('Bank account added · GST added');
    expect(r.queryByTestId('hold-box')).toBeNull();
    expect(r.queryByTestId('wallet-hold')).toBeNull();

    fireEvent.press(r.getByTestId('wallet-add-money')); expect(n.navigate).toHaveBeenLastCalledWith('BrandAddMoney', {});
    fireEvent.press(r.getByTestId('wallet-withdraw')); expect(n.navigate).toHaveBeenLastCalledWith('BrandWithdraw', {});
    fireEvent.press(r.getByTestId('wallet-locked')); expect(n.navigate).toHaveBeenLastCalledWith('BrandWalletLocked', {});
    fireEvent.press(r.getByTestId('wallet-sales')); expect(n.navigate).toHaveBeenLastCalledWith('BrandWalletSales', {});
    fireEvent.press(r.getByTestId('wallet-history')); expect(n.navigate).toHaveBeenLastCalledWith('BrandWalletHistory', {});
    fireEvent.press(r.getByTestId('wallet-details')); expect(n.navigate).toHaveBeenLastCalledWith('BrandWalletDetails', {});
  });

  it('BW2: a withdrawal waiting is its own figure, on hold, with when it will be processed; Withdraw is off', async () => {
    brandApi.getWallet.mockResolvedValue(ok({ figures: { ...FIGURES, available: 28200, onHold: 20000 }, withdrawal_waiting: WAITING, wallet: {} }));
    brandApi.getMe.mockResolvedValue(ok({ brand: { gstin: null, has_bank_account: true } }));
    const n = nav();
    const r = render(<BrandWalletScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('hold-box'));
    expect(r.getByTestId('wallet-available-amount').props.children).toBe('₹28,200');
    expect(flat(r)).toContain('You requested ₹20,000 on 1 Oct.');
    expect(flat(r)).toContain('It will be processed within 24 hours. This amount is on hold until then.');
    r.getByText('On hold · your withdrawal'); r.getByText('Requested 1 Oct · to ··4821 · HDFC0001234'); r.getByText('₹20,000');
    r.getByText('One withdrawal at a time.');
    expect(r.getByTestId('wallet-withdraw').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(r.getByTestId('wallet-withdraw'));
    expect(n.navigate).not.toHaveBeenCalled();
    fireEvent.press(r.getByTestId('wallet-hold')); expect(n.navigate).toHaveBeenLastCalledWith('BrandWithdrawals', {});
    r.getByText('Bank account added · GST not added');
  });

  it('a wallet that cannot be read says so and offers to try again — it never shows a zero it did not get', async () => {
    brandApi.getWallet.mockResolvedValue({ success: false, error: { message: 'nope' } });
    brandApi.getMe.mockResolvedValue(ok({ brand: {} }));
    const r = render(<BrandWalletScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('wallet-error'));
    expect(r.queryByText('₹0')).toBeNull();
  });
});

describe('BW3 · BW4 — locked in collaborations', () => {
  it('BW3: each collaboration with what is paid, what is locked and the next payment; the fee note only for Pay for Content', async () => {
    brandApi.getWalletLocked.mockResolvedValue(ok({ stillLocked: 12375, paidSoFar: 8125, collaborations: [HYBRID, CONTENT], paidInFull: [] }));
    const n = nav();
    const r = render(<BrandWalletLockedScreen navigation={n} />);
    await waitFor(() => r.getByTestId('wallet-locked-list'));
    r.getByText('Paid to creators so far'); r.getByText('₹12,375'); r.getByText('₹8,125');
    r.getByText('Tanvi Suresh'); r.getByText('Hybrid'); r.getByText('Diwali Edit · Set C'); r.getByText('Fixed amount'); r.getByText('₹8,500'); r.getByText('₹6,375');
    r.getByText("Next: ₹2,125 when you confirm it's live");
    r.getByText('Meera Rao'); r.getByText('Pay for Content'); r.getByText('Fee'); r.getByText('Next: ₹6,000 on 31 Oct');
    r.getByText('The INFLX campaign fee on Pay for Content was charged once at signing and is not part of what is locked for her.');
    expect(flat(r)).not.toMatch(/cancel/i);                                     // nothing here can be cancelled
    fireEvent.press(r.getByTestId('locked-ci2'));
    expect(n.navigate).toHaveBeenCalledWith('BrandWalletCollab', { collab: CONTENT });
  });

  it('BW3: nothing locked says how money comes to be locked', async () => {
    brandApi.getWalletLocked.mockResolvedValue(ok({ stillLocked: 0, paidSoFar: 0, collaborations: [], paidInFull: [] }));
    const r = render(<BrandWalletLockedScreen navigation={nav()} />);
    await waitFor(() => r.getByTestId('locked-empty'));
    r.getByText('Nothing is locked');
  });

  it('BW4: the three payments with their dates, what is still locked, the campaign fee apart, and the way to the collaboration', () => {
    const n = nav();
    const r = render(<BrandWalletCollabScreen navigation={n} route={{ params: { collab: CONTENT } }} />);
    r.getByText('Meera Rao'); r.getByText('Winter Run · Set A · Pay for Content'); r.getByText('Her fee'); r.getByText('₹12,000');
    r.getByText('At signing · 25%'); r.getByText('Paid 2 Oct');
    r.getByText('When confirmed live · 25%'); r.getByText('Paid 24 Oct');
    r.getByText('Final 50%'); r.getByText('On 31 Oct');
    expect(r.getByTestId('collab-still-locked').props.children).toBe('₹6,000');
    r.getByText('INFLX campaign fee ₹960 · charged to you at signing, never to her.');
    fireEvent.press(r.getByTestId('collab-open'));
    // ASSERTION DRIFT — ui-walk-fixes D3 (drift/S0b.md): the jump now asks for the Campaigns page
    // to sit under the set (`initial: false`), so the set has no bottom tabs and Back reaches it.
    expect(n.navigate).toHaveBeenCalledWith('CampaignsTab', { screen: 'BrandSetDetail', params: { campaignId: 'c2', setId: 's2', name: 'Set A' }, initial: false });
  });

  it('BW4: a Hybrid collaboration waits on the brand confirming it is live, and shows no campaign fee', () => {
    const r = render(<BrandWalletCollabScreen navigation={nav()} route={{ params: { collab: HYBRID } }} />);
    r.getByText('Fixed amount'); r.getByText("When you confirm it's live"); r.getByText("After it's confirmed live");
    expect(r.queryByTestId('collab-campaign-fee')).toBeNull();
  });
});

describe('BW5 · BW6 — sales money', () => {
  const SALES = [
    sale(),
    sale({ id: 'l2', item: 'Oxford shirt', state: 'added', at: '2026-09-28T02:00:00.000Z', windowUntil: null, brandShare: 748, creatorName: 'Meera Rao', creatorFirst: 'Meera', post: { id: 'p2', code: 'T9QW4D', title: 'x' } }),
    sale({ id: 'l3', item: 'Linen co-ord', state: 'cancelled', windowUntil: null, brandShare: 0, creatorShare: 0, inflxShare: 0 }),
    sale({ id: 'l4', item: 'Denim shirt', cashOnDelivery: true, deliveredAt: '2026-09-30T08:00:00.000Z', windowUntil: '2026-10-07', brandShare: 1088, creatorName: 'Asha M', creatorFirst: 'Asha', post: { id: 'p4', code: 'D4KX7M', title: 'x' } }),
    sale({ id: 'l5', item: 'Silk dupatta', cashOnDelivery: true, state: 'cod_waiting', orderStatus: 'dispatched', deliveredAt: null, windowUntil: null, brandShare: 510 }),
  ];
  it('BW5: the totals, the filters, and one row per item sold in each of its states', async () => {
    brandApi.getWalletSales.mockResolvedValue(ok({ totals: { coming: 12070, comingCount: 9, added: 40000, addedThisMonth: 31450, sales: 23 }, sales: SALES }));
    const n = nav();
    const r = render(<BrandWalletSalesScreen navigation={n} />);
    await waitFor(() => r.getByTestId('wallet-sales-list'));
    r.getByText('₹12,070'); expect(r.getAllByText('Coming')).toHaveLength(2); r.getByText('₹31,450'); r.getByText('Added this month'); r.getByText('23');
    r.getByText("Tanvi's post K7M2F9 · return window until 12 Oct"); r.getByText('₹2,719');
    r.getByText("Meera's post T9QW4D · added 28 Sep"); r.getByText('+ ₹748');
    r.getByText("Tanvi's post K7M2F9 · cancelled"); r.getByText('₹0');
    r.getByText("Asha's post D4KX7M · cash on delivery · delivered 30 Sep · until 7 Oct");
    r.getByText("Tanvi's post K7M2F9 · cash on delivery · waiting for delivery");
    expect(brandApi.getWalletSales).toHaveBeenLastCalledWith('all', 0);
    expect(r.queryByTestId('sales-more')).toBeNull();                           // fewer than a page: nothing more to ask for
    await act(async () => { fireEvent.press(r.getByTestId('filter-coming')); });
    expect(brandApi.getWalletSales).toHaveBeenLastCalledWith('coming', 0);
    fireEvent.press(r.getByTestId('sale-l1'));
    expect(n.navigate).toHaveBeenCalledWith('BrandWalletSale', { sale: SALES[0] });
  });

  it('BW5: a full page offers more, asks from where the list ends, and adds to it; an order not shipped yet says so', async () => {
    const page = Array.from({ length: 50 }, (_, i) => sale({ id: `p${i}`, item: `Shirt ${i}`, state: i === 0 ? 'not_shipped' : 'window', windowUntil: i === 0 ? null : '2026-10-12' }));
    brandApi.getWalletSales.mockResolvedValue(ok({ totals: { coming: 1, comingCount: 1, added: 0, addedThisMonth: 0, sales: 51 }, sales: page }));
    const r = render(<BrandWalletSalesScreen navigation={nav()} />);
    await waitFor(() => r.getByTestId('sales-more'));
    r.getByText("Tanvi's post K7M2F9 · not shipped yet");
    brandApi.getWalletSales.mockResolvedValue(ok({ totals: { coming: 1, comingCount: 1, added: 0, addedThisMonth: 0, sales: 51 }, sales: [sale({ id: 'last', item: 'The last one' })] }));
    await act(async () => { fireEvent.press(r.getByTestId('sales-more')); });
    expect(brandApi.getWalletSales).toHaveBeenLastCalledWith('all', 50);
    r.getByText('Shirt 0'); r.getByText('The last one');
    expect(r.queryByTestId('sales-more')).toBeNull();
  });

  it('BW6: what the shopper paid and who gets what — the three shares add up to it', () => {
    const r = render(<BrandWalletSaleScreen navigation={nav()} route={{ params: { sale: sale() } }} />);
    r.getByText('Kanchi silk saree'); r.getByText("Order · 5 Oct · Tanvi's post K7M2F9");
    r.getByText('Shopper paid'); r.getByText('₹3,199');
    r.getByText("Creator's share · 10%"); r.getByText('₹320');
    r.getByText("INFLX's share · 5%"); r.getByText('₹160');
    r.getByText('Your share'); r.getByText('₹2,719');
    r.getByText("In its return window until 12 Oct. Your ₹2,719 is added to your wallet when it closes, if it isn't returned.");
    r.getByText('20% off · Festive silk'); r.getByText('Online'); r.getByText('Delivered 5 Oct');
  });

  it('BW6: added, cancelled and cash-not-yet-delivered each say where the money stands', () => {
    let r = render(<BrandWalletSaleScreen navigation={nav()} route={{ params: { sale: sale({ state: 'added', at: '2026-10-13T02:00:00.000Z' }) } }} />);
    r.getByText('₹2,719 was added to your wallet on 13 Oct.');
    r = render(<BrandWalletSaleScreen navigation={nav()} route={{ params: { sale: sale({ state: 'cancelled', brandShare: 0, creatorShare: 0, inflxShare: 0 }) } }} />);
    r.getByText('This item was cancelled. Nothing is added for it.');
    r = render(<BrandWalletSaleScreen navigation={nav()} route={{ params: { sale: sale({ state: 'cod_waiting', cashOnDelivery: true, orderStatus: 'dispatched', deliveredAt: null }) } }} />);
    r.getByText('Cash on delivery. Its return window starts when it is delivered.'); r.getByText('Cash on delivery'); r.getByText('Shipped');
    r = render(<BrandWalletSaleScreen navigation={nav()} route={{ params: { sale: sale({ state: 'not_shipped', orderStatus: 'packed', deliveredAt: null, windowUntil: null }) } }} />);
    r.getByText('This order has not been shipped yet. Your ₹2,719 is added to your wallet once it ships.'); r.getByText('Packed');
  });
});

/* ───────────────────────────────────────────── WITHDRAW (both sides) */

const OPTS = { available: 48200, onHold: 0, minimum: 100, processHours: 24, open: null, blocked: null,
  sendTo: [{ method: 'bank', label: 'Bank ··4821', masked: '··4821 · HDFC0001234' }] };

describe('BW7 · BW9 · CW5 — asking to withdraw', () => {
  it('BW7: any amount up to Available, to the saved bank account; the request goes to the server and she lands on the Wallet', async () => {
    brandApi.getWithdrawOptions.mockResolvedValue(ok(OPTS));
    brandApi.requestWithdrawal.mockResolvedValue(ok({ withdrawal: { ...WAITING } }));
    const n = nav();
    const r = render(<WithdrawScreen navigation={n} route={{ params: { side: 'brand' } }} />);
    await waitFor(() => r.getByTestId('withdraw'));
    r.getByText('How much?'); r.getByText('Available ₹48,200 · minimum ₹100');
    r.getByText('₹10,000'); r.getByText('₹20,000'); r.getByText('All · ₹48,200');
    r.getByText('Sent to'); r.getByText('Bank ··4821'); r.getByText('··4821 · HDFC0001234');
    fireEvent.press(r.getByTestId('withdraw-quick-20000'));
    expect(r.getByTestId('withdraw-amount').props.value).toBe('20,000');
    r.getByText("INFLX pays this from its bank within 24 hours. Until then ₹20,000 is on hold: it can't be used for an agreement or requested again.");
    r.getByText('Request ₹20,000');
    await act(async () => { fireEvent.press(r.getByTestId('withdraw-request')); });
    expect(brandApi.requestWithdrawal).toHaveBeenCalledWith(20000);
    expect(n.navigate).toHaveBeenCalledWith('BrandWallet', { toast: '₹20,000 requested. It is on hold until INFLX pays it.' });
    fireEvent.press(r.getByTestId('withdraw-change'));
    expect(n.navigate).toHaveBeenLastCalledWith('BrandPayoutDetail', { kind: 'bank', returnTo: 'BrandWithdraw' });
  });

  it('BW9: more than Available, or less than the minimum, is refused on the screen and nothing is sent', async () => {
    brandApi.getWithdrawOptions.mockResolvedValue(ok(OPTS));
    const r = render(<WithdrawScreen navigation={nav()} route={{ params: { side: 'brand' } }} />);
    await waitFor(() => r.getByTestId('withdraw'));
    fireEvent.changeText(r.getByTestId('withdraw-amount'), '60000');
    await act(async () => { fireEvent.press(r.getByTestId('withdraw-request')); });
    r.getByText("That's more than your ₹48,200 available.");
    fireEvent.changeText(r.getByTestId('withdraw-amount'), '50');
    await act(async () => { fireEvent.press(r.getByTestId('withdraw-request')); });
    r.getByText('The minimum is ₹100.');
    expect(brandApi.requestWithdrawal).not.toHaveBeenCalled();
  });

  it('BW9: no bank account yet → add it first; one waiting → said so; under the minimum → said so', async () => {
    const n = nav();
    brandApi.getWithdrawOptions.mockResolvedValue(ok({ ...OPTS, sendTo: [], blocked: { code: 'NO_DETAILS', message: 'Add your bank account first.' } }));
    let r = render(<WithdrawScreen navigation={n} route={{ params: { side: 'brand' } }} />);
    await waitFor(() => r.getByTestId('withdraw-no-details'));
    r.getByText('Add your bank account first'); r.getByText('We need it to send your money.');
    fireEvent.press(r.getByTestId('withdraw-add-details'));
    expect(n.navigate).toHaveBeenCalledWith('BrandPayoutDetail', { kind: 'bank', returnTo: 'BrandWithdraw' });
    expect(r.queryByTestId('withdraw-request')).toBeNull();

    brandApi.getWithdrawOptions.mockResolvedValue(ok({ ...OPTS, open: WAITING, blocked: { code: 'ONE_AT_A_TIME', message: 'You have a withdrawal of ₹20,000 waiting. You can request another once it is processed.' } }));
    r = render(<WithdrawScreen navigation={n} route={{ params: { side: 'brand' } }} />);
    await waitFor(() => r.getByTestId('withdraw-blocked-ONE_AT_A_TIME'));
    r.getByText('You have a withdrawal of ₹20,000 waiting. You can request another once it is processed.');

    brandApi.getWithdrawOptions.mockResolvedValue(ok({ ...OPTS, available: 64, blocked: { code: 'TOO_SMALL', message: 'The minimum is ₹100. You have ₹64 available.' } }));
    r = render(<WithdrawScreen navigation={n} route={{ params: { side: 'brand' } }} />);
    await waitFor(() => r.getByTestId('withdraw-blocked-TOO_SMALL'));
    r.getByText('The minimum is ₹100. You have ₹64 available.');
  });

  it('a refusal from the server is shown as the server said it, and she stays on the screen', async () => {
    brandApi.getWithdrawOptions.mockResolvedValue(ok(OPTS));
    brandApi.requestWithdrawal.mockResolvedValue({ success: false, error: { code: 'ONE_AT_A_TIME', message: 'You have a withdrawal of ₹5,000 waiting. You can request another once it is processed.' } });
    const n = nav();
    const r = render(<WithdrawScreen navigation={n} route={{ params: { side: 'brand' } }} />);
    await waitFor(() => r.getByTestId('withdraw'));
    fireEvent.changeText(r.getByTestId('withdraw-amount'), '5000');
    await act(async () => { fireEvent.press(r.getByTestId('withdraw-request')); });
    r.getByText('You have a withdrawal of ₹5,000 waiting. You can request another once it is processed.');
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('CW5: the creator chooses UPI or bank and is told she gets the full amount — nothing about tax', async () => {
    influencerApi.getWithdrawOptions.mockResolvedValue(ok({ available: 9870, onHold: 0, minimum: 100, processHours: 24, open: null, blocked: null,
      sendTo: [{ method: 'upi', label: 'UPI · tanvi@okhdfc', masked: 'tanvi@okhdfc' }, { method: 'bank', label: 'Bank ··7730', masked: '··7730 · ICIC0000123' }] }));
    influencerApi.requestWithdrawal.mockResolvedValue(ok({ withdrawal: {} }));
    const n = nav();
    const r = render(<WithdrawScreen navigation={n} route={{ params: { side: 'creator' } }} />);
    await waitFor(() => r.getByTestId('withdraw'));
    r.getByText('Send it to'); r.getByText('UPI · tanvi@okhdfc'); r.getByText('Bank ··7730');
    expect(r.getByTestId('withdraw-to-upi').props.accessibilityState.selected).toBe(true);
    fireEvent.changeText(r.getByTestId('withdraw-amount'), '8000');
    r.getByText('INFLX pays this within 24 hours. You get the full ₹8,000. Until then it is on hold.');
    expect(flat(r)).not.toMatch(/tds|tax|deduct/i);
    fireEvent.press(r.getByTestId('withdraw-to-bank'));
    await act(async () => { fireEvent.press(r.getByTestId('withdraw-request')); });
    expect(influencerApi.requestWithdrawal).toHaveBeenCalledWith(8000, 'bank');
    expect(n.navigate).toHaveBeenCalledWith('CreatorWallet', { toast: '₹8,000 requested. It is on hold until INFLX pays it.' });
  });
});

describe('BW8 · CW6 — withdrawals', () => {
  const LIST = [
    { ...WAITING, id: 'w3', amount: 8000, method: 'upi', sendTo: 'tanvi@okhdfc' },
    { id: 'w2', amount: 20000, method: 'bank', sendTo: '··4821 · HDFC0001234', status: 'processed', requestedAt: '2026-10-01T05:30:00.000Z', processHours: 24, processedAt: '2026-10-02T06:00:00.000Z', paidOn: '2026-10-02', reference: 'N27510284611', reason: null },
    { id: 'w1', amount: 8000, method: 'bank', sendTo: '··4821 · HDFC0001234', status: 'could_not_process', requestedAt: '2026-09-20T05:30:00.000Z', processHours: 24, processedAt: '2026-09-21T06:00:00.000Z', paidOn: null, reference: null, reason: "The account number didn't match the name. Check your bank details and request again." },
  ];
  it('waiting, processed with its reference, and could not process with its reason and the money back', async () => {
    brandApi.getWalletWithdrawals.mockResolvedValue(ok({ withdrawals: LIST }));
    const r = render(<WithdrawalsScreen navigation={nav()} route={{ params: { side: 'brand' } }} />);
    await waitFor(() => r.getByTestId('withdrawals'));
    r.getByText('Waiting'); r.getByText('Requested 1 Oct · to tanvi@okhdfc · within 24 hours');
    r.getByText('Processed'); r.getByText('Requested 1 Oct · paid 2 Oct to ··4821 · HDFC0001234'); r.getByText('Reference N27510284611');
    r.getByText('Could not process'); r.getByText('Requested 20 Sep');
    r.getByText("The account number didn't match the name. Check your bank details and request again. Your ₹8,000 is back in Available.");
  });

  it('the creator reads her own list from her own address; none yet says so', async () => {
    influencerApi.getWalletWithdrawals.mockResolvedValue(ok({ withdrawals: [] }));
    const r = render(<WithdrawalsScreen navigation={nav()} route={{ params: { side: 'creator' } }} />);
    await waitFor(() => r.getByTestId('withdrawals-empty'));
    r.getByText('No withdrawals yet');
    expect(brandApi.getWalletWithdrawals).not.toHaveBeenCalled();
  });
});

describe('BW10 · CW7 — history', () => {
  const row = (o) => ({ id: o.label + o.amount, at: '2026-10-02T06:00:00.000Z', group: 'collaborations', sub: null, sign: '', moneyIn: false, availableAfter: null, ...o });
  it('BW10: every movement in plain words; money in is a plus; the filter asks the server', async () => {
    brandApi.getWalletHistory.mockResolvedValue(ok({ rows: [
      row({ label: 'Sales money added', group: 'sales', amount: 748, sign: '+', moneyIn: true, at: '2026-10-13T02:00:00.000Z' }),
      row({ label: 'Withdrawal processed', group: 'withdrawals', sub: 'To ··4821 · HDFC0001234 · ref N27510284611', amount: 20000 }),
      row({ label: 'Paid to the creator', sub: 'Second 25% · confirmed live · Winter Run', amount: 3000, at: '2026-10-24T06:00:00.000Z' }),
      row({ label: 'Locked for a collaboration', sub: 'Diwali Edit', amount: 8500, sign: '−' }),
      row({ label: 'You added money', group: 'added', amount: 50000, sign: '+', moneyIn: true, at: '2026-10-01T04:00:00.000Z' }),
    ] }));
    const r = render(<WalletHistoryScreen navigation={nav()} route={{ params: { side: 'brand' } }} />);
    await waitFor(() => r.getByTestId('history-rows'));
    r.getByText('Sales money added'); r.getByText('13 Oct'); r.getByText('+ ₹748');
    r.getByText('Withdrawal processed'); r.getByText('To ··4821 · HDFC0001234 · ref N27510284611 · 2 Oct'); r.getByText('₹20,000');
    r.getByText('Paid to the creator'); r.getByText('Second 25% · confirmed live · Winter Run · 24 Oct');
    r.getByText('− ₹8,500'); r.getByText('+ ₹50,000');
    for (const k of ['all', 'added', 'collaborations', 'sales', 'withdrawals', 'courier']) r.getByTestId(`filter-${k}`);
    expect(brandApi.getWalletHistory).toHaveBeenLastCalledWith('all', 0);
    await act(async () => { fireEvent.press(r.getByTestId('filter-sales')); });
    expect(brandApi.getWalletHistory).toHaveBeenLastCalledWith('sales', 0);
    expect(r.queryByTestId('history-more')).toBeNull();
  });

  it('CW7: her filters, her words, and an empty history says so', async () => {
    influencerApi.getWalletHistory.mockResolvedValue(ok({ rows: [] }));
    const r = render(<WalletHistoryScreen navigation={nav()} route={{ params: { side: 'creator' } }} />);
    await waitFor(() => r.getByTestId('history-empty'));
    for (const k of ['all', 'collaborations', 'commission', 'withdrawals']) r.getByTestId(`filter-${k}`);
    expect(r.queryByTestId('filter-sales')).toBeNull();
    r.getByText('Nothing yet');
  });

  it('a full page offers more, and more is asked for from where the list ends', async () => {
    const page = Array.from({ length: 50 }, (_, i) => row({ id: `r${i}`, label: 'Commission added', group: 'commission', amount: 10 + i, sign: '+', moneyIn: true }));
    influencerApi.getWalletHistory.mockResolvedValue(ok({ rows: page }));
    const r = render(<WalletHistoryScreen navigation={nav()} route={{ params: { side: 'creator' } }} />);
    await waitFor(() => r.getByTestId('history-more'));
    influencerApi.getWalletHistory.mockResolvedValue(ok({ rows: [] }));
    await act(async () => { fireEvent.press(r.getByTestId('history-more')); });
    expect(influencerApi.getWalletHistory).toHaveBeenLastCalledWith('all', 50);
    expect(r.queryByTestId('history-more')).toBeNull();
  });
});

/* ───────────────────────────────────────────── CREATOR */

describe('CW1 · CW2 — the creator Wallet tab', () => {
  const FIG = { available: 9870, onHold: 0, stillToCome: 11695, payments: 10250, paymentsCount: 2, nextPaymentAt: '2026-10-31T00:00:00.000Z', commission: 1445, commissionCount: 6 };
  it('CW1: Available, Still to come and its two kinds, history and payment details — and no tax anywhere', async () => {
    influencerApi.getWallet.mockResolvedValue(ok({ figures: FIG, withdrawal_waiting: null, details: { has_upi: true, has_bank_account: true } }));
    const n = nav();
    const r = render(<CreatorWalletScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('creator-wallet'));
    expect(r.getByTestId('wallet-balance-amount').props.children).toBe('₹9,870');
    r.getByText('Still to come'); r.getByText('Collaboration payments and commission'); r.getByText('₹11,695');
    r.getByText('Collaboration payments'); r.getByText('2 collaborations · next on 31 Oct'); r.getByText('₹10,250');
    r.getByText('Commission'); r.getByText('6 sales in their return window'); r.getByText('₹1,445');
    r.getByText('Payment details'); r.getByText('UPI added · bank added');
    expect(flat(r)).not.toMatch(/tds|tax|simple view/i);
    fireEvent.press(r.getByTestId('wallet-withdraw')); expect(n.navigate).toHaveBeenLastCalledWith('CreatorWithdraw', {});
    fireEvent.press(r.getByTestId('wallet-payments')); expect(n.navigate).toHaveBeenLastCalledWith('CreatorWalletPayments', {});
    fireEvent.press(r.getByTestId('wallet-commission')); expect(n.navigate).toHaveBeenLastCalledWith('CreatorWalletCommission', {});
    fireEvent.press(r.getByTestId('wallet-history')); expect(n.navigate).toHaveBeenLastCalledWith('CreatorWalletHistory', {});
    fireEvent.press(r.getByTestId('wallet-details')); expect(n.navigate).toHaveBeenLastCalledWith('CreatorWalletDetails', {});
  });

  it('CW2: the same hold, said the same way as the brand\'s; Withdraw is off', async () => {
    influencerApi.getWallet.mockResolvedValue(ok({ figures: { ...FIG, available: 1870, onHold: 8000 },
      withdrawal_waiting: { ...WAITING, amount: 8000, method: 'upi', sendTo: 'tanvi@okhdfc' }, details: { has_upi: true, has_bank_account: false } }));
    const n = nav();
    const r = render(<CreatorWalletScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('hold-box'));
    expect(r.getByTestId('wallet-balance-amount').props.children).toBe('₹1,870');
    expect(flat(r)).toContain('You requested ₹8,000 on 1 Oct.');
    r.getByText('On hold · your withdrawal'); r.getByText('Requested 1 Oct · to tanvi@okhdfc'); r.getByText('₹8,000');
    r.getByText('One withdrawal at a time.'); r.getByText('UPI added · bank not added');
    expect(r.getByTestId('wallet-withdraw').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(r.getByTestId('wallet-hold')); expect(n.navigate).toHaveBeenLastCalledWith('CreatorWithdrawals', {});
  });
});

describe('CW3 · CW4 — still to come', () => {
  it('CW3: each collaboration\'s three payments — paid, what the next waits for, the date the final 50% arrives; never a campaign fee', async () => {
    const strip = ({ campaignFee, ...x }) => x;                                 // the server never sends her the brand's fee
    influencerApi.getWalletPayments.mockResolvedValue(ok({ stillToCome: 12375, received: 8125, collaborations: [strip(CONTENT), strip(HYBRID)] }));
    const r = render(<CreatorWalletPaymentsScreen navigation={nav()} />);
    await waitFor(() => r.getByTestId('wallet-payments-list'));
    r.getByText('Received so far'); r.getByText('₹12,375'); r.getByText('₹8,125');
    r.getByText('Sri Lakshmi Silks'); r.getByText('Winter Run · Set A · ₹12,000'); r.getByText('Arrives on 31 Oct');
    r.getByText('Urban Threads'); r.getByText('Diwali Edit · Set C · ₹8,500'); r.getByText("When they confirm it's live"); r.getByText("After it's confirmed live");
    expect(flat(r)).not.toMatch(/campaign fee|₹960/i);
  });

  it('CW4: commission per collaboration and per sale — never who bought, never another share', async () => {
    const c = (o) => ({ id: 'l1', item: 'Kanchi silk saree', qty: 1, soldAt: '2026-10-05T07:00:00.000Z', post: { id: 'p1', code: 'K7M2F9', title: 'x' }, campaignName: 'Diwali Edit', setName: 'Set C',
      offerName: null, cashOnDelivery: false, orderStatus: 'delivered', deliveredAt: null, state: 'window', windowUntil: '2026-10-12', at: null, brandName: 'Urban Threads', commissionPct: 10, commission: 320, ...o });
    influencerApi.getWalletCommission.mockResolvedValue(ok({ totals: { inWindow: 1445, added: 2130, sales: 14 }, sales: [
      c(), c({ id: 'l2', item: 'Oxford shirt', state: 'added', at: '2026-09-28T02:00:00.000Z', commission: 88, post: { id: 'p2', code: 'T9QW4D', title: 'x' } }),
      c({ id: 'l3', item: 'Linen co-ord', state: 'cancelled', commission: 0 }),
      c({ id: 'l4', item: 'Cotton kurta', brandName: 'Sri Lakshmi Silks', campaignName: 'Winter Run', commissionPct: 12, commission: 96 }),
    ] }));
    const r = render(<CreatorWalletCommissionScreen navigation={nav()} />);
    await waitFor(() => r.getByTestId('wallet-commission-list'));
    r.getByText('₹1,445'); r.getByText('In return window'); r.getByText('₹2,130'); r.getByText('Added so far'); r.getByText('14');
    r.getByText('Urban Threads · Diwali Edit · 10%'); r.getByText('Sri Lakshmi Silks · Winter Run · 12%');
    expect(r.getAllByText('Your post K7M2F9 · return window until 12 Oct')).toHaveLength(2); r.getByText('₹320'); r.getByText('₹96');
    r.getByText('Your post T9QW4D · added 28 Sep'); r.getByText('+ ₹88');
    r.getByText('Your post K7M2F9 · cancelled'); r.getByText('₹0');
    r.getByText("Commission is added to your wallet when each sale's return window closes.");
    expect(flat(r)).not.toMatch(/Shopper paid|INFLX's share|Your share/);
    expect(influencerApi.getWalletCommission).toHaveBeenLastCalledWith('all', 0);
    expect(r.queryByTestId('commission-more')).toBeNull();
  });
});

describe('the details, one tap in', () => {
  it('brand: GST number and bank account, each opening its form and coming back here', async () => {
    brandApi.getMe.mockResolvedValue(ok({ brand: { gstin: null, has_bank_account: true } }));
    const n = nav();
    const r = render(<WalletDetailsScreen navigation={n} route={{ params: { side: 'brand' } }} />);
    await waitFor(() => r.getByTestId('business-details'));
    expect(r.getByTestId('row-gst-value').props.children).toBe('Not added');
    expect(r.getByTestId('row-bank-value').props.children).toBe('Added');
    fireEvent.press(r.getByTestId('row-bank'));
    expect(n.navigate).toHaveBeenCalledWith('BrandPayoutDetail', { kind: 'bank', returnTo: 'BrandWalletDetails' });
  });

  it('creator: UPI, bank account and PAN — and the PAN row no longer speaks of a deduction', async () => {
    influencerApi.getMe.mockResolvedValue(ok({ influencer: { has_upi: true, has_bank_account: false, has_pan: false } }));
    const n = nav();
    const r = render(<WalletDetailsScreen navigation={n} route={{ params: { side: 'creator' } }} />);
    await waitFor(() => r.getByTestId('payment-details'));
    expect(r.getByTestId('row-upi-value').props.children).toBe('Added');
    r.getByText('PAN');
    expect(flat(r)).not.toMatch(/tds/i);
    fireEvent.press(r.getByTestId('row-upi'));
    expect(n.navigate).toHaveBeenCalledWith('PayoutDetail', { kind: 'upi', returnTo: 'CreatorWalletDetails' });
  });
});
