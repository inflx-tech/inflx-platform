/**
 * The brand wallet — W1 to W9.
 * Contract: features/brand-wallet-on-the-phone
 *
 * Two of these matter more than the rest, and both are about not lying to a brand about her money:
 *   · success is drawn ONLY after the server confirms the credit;
 *   · when the payment went through and the confirmation did not, we say we could not confirm it —
 *     never "nothing was taken", which we do not know.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  brandApi: {
    getWallet: jest.fn(), getWalletTransactions: jest.fn(),
    createTopup: jest.fn(), verifyTopup: jest.fn(),
    // features/registration-and-profile B8 — the GST / bank rows read the brand's own record.
    getMe: jest.fn().mockResolvedValue({ success: true, data: { brand: { gstin: null, has_bank_account: false } } }),
  },
  influencerApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../services/payment', () => ({ processPayment: jest.fn() }));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { brandApi } = require('../../../services/api');
const { processPayment } = require('../../../services/payment');
const BrandWalletScreen = require('../BrandWalletScreen').default;
const BrandAddMoneyScreen = require('../BrandAddMoneyScreen').default;

const nav = () => ({ goBack: jest.fn(), navigate: jest.fn(), replace: jest.fn(), push: jest.fn(), reset: jest.fn(), setParams: jest.fn(), addListener: jest.fn(() => () => {}), dispatch: jest.fn() });
const ok = (data) => ({ success: true, data });

const WALLET = { available_balance: 37040, reserved_balance: 9000, settled_balance: 3000, total_loaded: 50000 };
const TX = [
  { id: 't1', type: 'payout', amount: 3000, direction: 'debit', notes: 'Paid to Asha M.', created_at: '2026-09-16T10:00:00Z' },
  { id: 't2', type: 'platform_fee', amount: 960, direction: 'debit', notes: 'Campaign fee', created_at: '2026-09-16T10:00:00Z' },
  { id: 't3', type: 'escrow_lock', amount: 12000, direction: 'debit', notes: 'Locked for Asha M. (Diwali Edit 2026)', created_at: '2026-09-16T10:00:00Z' },
  { id: 't4', type: 'topup', amount: 50000, direction: 'credit', notes: null, created_at: '2026-09-16T09:00:00Z' },
];

beforeEach(() => {
  jest.clearAllMocks();
  brandApi.getWallet.mockResolvedValue(ok({ wallet: WALLET }));
  brandApi.getWalletTransactions.mockResolvedValue(ok({ transactions: TX }));
});

// ── W1 · W2 ──────────────────────────────────────────────────────────────────

describe('W1 · W2 — the Wallet tab', () => {
  it('shows what she can spend, what is locked, what has been paid out, and the ledger', async () => {
    const r = render(<BrandWalletScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('brand-wallet'));

    r.getByText('₹37,040');            // available
    r.getByText('₹9,000');             // locked in agreements
    r.getByText('₹3,000');             // paid out to creators
    r.getByText('Money you can commit to an agreement.');

    // the ledger, in her words rather than the ledger's
    r.getByText('Paid to Asha M.');
    r.getByText('Campaign fee');
    r.getByText('Locked for Asha M. (Diwali Edit 2026)');
    r.getByText('Money added');
    r.getByText('+₹50,000');
    r.getByText('−₹12,000');
  });

  it('an empty wallet says so rather than showing a blank', async () => {
    brandApi.getWallet.mockResolvedValue(ok({ wallet: { available_balance: 0, reserved_balance: 0, settled_balance: 0 } }));
    brandApi.getWalletTransactions.mockResolvedValue(ok({ transactions: [] }));
    const r = render(<BrandWalletScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('wallet-empty'));
    r.getByText('Nothing yet');
    r.getByText('Your top-ups and payments appear here.');
  });

  it('still loads when the ledger fails — a wallet without its history is still a wallet', async () => {
    brandApi.getWalletTransactions.mockResolvedValue({ success: false, error: { message: 'nope' } });
    const r = render(<BrandWalletScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('brand-wallet'));
    r.getByText('₹37,040');
  });

  it('Add money opens the add screen', async () => {
    const n = nav();
    const r = render(<BrandWalletScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('brand-wallet'));
    fireEvent.press(r.getByTestId('wallet-add-money'));
    expect(n.navigate).toHaveBeenCalledWith('BrandAddMoney', {});
  });
});

// ── W3 · W4 ──────────────────────────────────────────────────────────────────

describe('W3 · W4 — asking for the amount', () => {
  it('plain: nothing pre-filled, and it says adding money commits nothing', () => {
    const r = render(<BrandAddMoneyScreen navigation={nav()} route={{ params: {} }} />);
    r.getByText('This money sits in your wallet until you sign an agreement. Nothing is committed to anyone until then.');
    expect(r.getByTestId('add-amount').props.value).toBe('');
    fireEvent.press(r.getByTestId('quick-25000'));
    r.getByText('Add ₹25,000');
  });

  it('from an agreement: the exact shortfall, pre-filled, with what it is for', () => {
    const r = render(<BrandAddMoneyScreen navigation={nav()} route={{ params: {
      need: 12960, forWhom: 'Asha', fee: 12000, campaignFee: 960,
      returnTo: { screen: 'BrandAgreement', params: { ciId: 'ci1' } },
    } }} />);
    r.getByText("Asha's agreement needs ₹12,960");
    r.getByText("₹12,000 for Asha and ₹960 campaign fee. We'll bring you straight back to sign.");
    expect(r.getByTestId('add-amount').props.value).toBe('12,960');
    r.getByText('Add ₹12,960');
    // offered exactly, not rounded up
    r.getByText('Exactly ₹12,960');
  });

  it('refuses an empty or silly amount without calling the server', () => {
    const r = render(<BrandAddMoneyScreen navigation={nav()} route={{ params: {} }} />);
    fireEvent.changeText(r.getByTestId('add-amount'), '20000000');
    fireEvent.press(r.getByTestId('add-money-submit'));
    r.getByText('Enter an amount under ₹10,00,000.');
    expect(brandApi.createTopup).not.toHaveBeenCalled();
  });
});

// ── W5 · W6 · W7 ─────────────────────────────────────────────────────────────

describe('W5 · W6 · W7 — paying, added, and not added', () => {
  const paid = { razorpay_order_id: 'order_mock_1', razorpay_payment_id: 'pay_1', razorpay_signature: 'sig' };

  it('adds the money, then points her back at the agreement', async () => {
    brandApi.createTopup.mockResolvedValue(ok({ order_id: 'order_mock_1', amount: 1296000, key_id: null }));
    processPayment.mockResolvedValue(paid);
    brandApi.verifyTopup.mockResolvedValue(ok({ wallet: { available_balance: 12960 } }));

    const n = nav();
    const r = render(<BrandAddMoneyScreen navigation={n} route={{ params: {
      need: 12960, forWhom: 'Asha', fee: 12000, campaignFee: 960,
      returnTo: { screen: 'BrandAgreement', params: { ciId: 'ci1' } },
    } }} />);
    await act(async () => { fireEvent.press(r.getByTestId('add-money-submit')); });

    await waitFor(() => r.getByTestId('add-money-done'));
    r.getByText('₹12,960 added');
    r.getByText('Your wallet now has ₹12,960 available.');
    r.getByText('Nothing is committed to Asha yet. The money moves when you sign.');

    fireEvent.press(r.getByTestId('added-back'));
    expect(n.navigate).toHaveBeenCalledWith('BrandAgreement', { ciId: 'ci1' });
  });

  it('she cancelled: nothing taken, and the server is never asked to confirm anything', async () => {
    brandApi.createTopup.mockResolvedValue(ok({ order_id: 'order_mock_1', amount: 1296000, key_id: null }));
    processPayment.mockResolvedValue(null);          // cancelled

    const r = render(<BrandAddMoneyScreen navigation={nav()} route={{ params: { need: 12960, forWhom: 'Asha' } }} />);
    await act(async () => { fireEvent.press(r.getByTestId('add-money-submit')); });

    await waitFor(() => r.getByTestId('add-money-failed'));
    r.getByText('Payment not completed');
    r.getByText('Nothing has been taken from your account, and your wallet is unchanged.');
    expect(brandApi.verifyTopup).not.toHaveBeenCalled();
    expect(r.queryByTestId('add-money-done')).toBeNull();
  });

  it('⚠️ paid but not confirmed: never claims it succeeded, and never claims nothing was taken', async () => {
    brandApi.createTopup.mockResolvedValue(ok({ order_id: 'order_mock_1', amount: 1296000, key_id: null }));
    processPayment.mockResolvedValue(paid);
    brandApi.verifyTopup.mockResolvedValue({ success: false, error: { message: 'signature check failed' } });

    const r = render(<BrandAddMoneyScreen navigation={nav()} route={{ params: { need: 12960, forWhom: 'Asha' } }} />);
    await act(async () => { fireEvent.press(r.getByTestId('add-money-submit')); });

    await waitFor(() => r.getByTestId('add-money-unsure'));
    r.getByText("We couldn't confirm the payment");
    r.getByText('If money left your account it will be credited within a few minutes. Check your wallet before trying again.');
    // the two sentences that must NOT appear
    expect(r.queryByText('Nothing has been taken from your account, and your wallet is unchanged.')).toBeNull();
    expect(r.queryByTestId('add-money-done')).toBeNull();
  });

  it('the order never reaches the Razorpay SDK directly — always through the helper', async () => {
    brandApi.createTopup.mockResolvedValue(ok({ order_id: 'order_mock_1', amount: 1296000, key_id: null }));
    processPayment.mockResolvedValue(paid);
    brandApi.verifyTopup.mockResolvedValue(ok({ wallet: { available_balance: 12960 } }));
    const r = render(<BrandAddMoneyScreen navigation={nav()} route={{ params: { need: 12960 } }} />);
    await act(async () => { fireEvent.press(r.getByTestId('add-money-submit')); });
    await waitFor(() => r.getByTestId('add-money-done'));
    // A mock order id handed straight to the native SDK crashes the app. The helper is what
    // knows that; this pins that the screen goes through it.
    expect(processPayment).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order_mock_1' }));
  });

  it('a refused top-up order stops before any payment is attempted', async () => {
    brandApi.createTopup.mockResolvedValue({ success: false, error: { message: 'amount must be at least ₹1' } });
    const r = render(<BrandAddMoneyScreen navigation={nav()} route={{ params: {} }} />);
    fireEvent.changeText(r.getByTestId('add-amount'), '500');
    await act(async () => { fireEvent.press(r.getByTestId('add-money-submit')); });
    await waitFor(() => r.getByTestId('add-money-failed'));
    expect(processPayment).not.toHaveBeenCalled();
  });
});
