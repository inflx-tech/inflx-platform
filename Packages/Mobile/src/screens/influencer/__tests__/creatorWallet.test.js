/**
 * The creator's money — the card that said zero, and the wallet that shows it.
 * Contract: features/creator-wallet-and-first-payment
 *
 * The defect these pin: Asha signed, the platform released ₹3,000 into her wallet that second,
 * and the app told her "₹0 is in your wallet". The money was real. The number was never sent to
 * the screen, so the screen invented a zero.
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  // features/registration-and-profile C7 — the UPI / bank / PAN rows read her own record.
  influencerApi: { getEarnings: jest.fn(), getWallet: jest.fn(), getMe: jest.fn().mockResolvedValue({ success: true, data: { influencer: { has_upi: false, has_bank_account: false, has_pan: false } } }) },
  brandApi: {}, referenceApi: {}, clearSession: jest.fn(), uploadFile: jest.fn(),
}));
jest.mock('../../../../App', () => ({ AuthContext: require('react').createContext({ setRole: () => {} }) }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: (cb) => { const React = require('react'); React.useEffect(() => cb(), [cb]); } }));

const { influencerApi } = require('../../../services/api');
const CreatorWalletScreen = require('../CreatorWalletScreen').default;
const { InvitationCard5 } = require('../../../components/invitations/bits5');

const ok = (data) => ({ success: true, data });

beforeEach(() => jest.clearAllMocks());

// ── The wallet ───────────────────────────────────────────────────────────────
//
// ASSERTION DRIFT — item 17 (features/item17-wallet; board CW1, locked 1 Oct 2026; rules v1.31 §17A).
// These three tests described the STAND-IN wallet ("a simple view while the full wallet is being
// designed"): Yours now / Still to come / Earned so far, read from GET /influencers/me/earnings.
// Item 17 is that full wallet: Available, Still to come and its two kinds, read from
// GET /influencers/me/wallet. Each test asserts the new rule for the same situation; none was
// skipped or removed. The full board is covered in screens/__tests__/wallet17.test.js.

const FIG = { available: 3000, onHold: 0, stillToCome: 9000, payments: 9000, paymentsCount: 1, nextPaymentAt: null, commission: 0, commissionCount: 0 };
const nav = () => ({ navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn() });

describe('the creator wallet', () => {
  it('shows the money that is already hers, what is still to come, and where it comes from', async () => {
    // Shaped EXACTLY as GET /influencers/me/wallet returns it (item17.routes + walletRead.creatorSummary).
    // Copy the server's shape, never the reader's.
    influencerApi.getWallet.mockResolvedValue(ok({ figures: FIG, withdrawal_waiting: null, details: { has_upi: false, has_bank_account: false } }));
    const n = nav();
    const r = render(<CreatorWalletScreen navigation={n} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('creator-wallet'));

    expect(r.getByTestId('wallet-balance-amount').props.children).toBe('₹3,000');
    expect(r.getByTestId('wallet-still-to-come-value').props.children).toBe('₹9,000');
    expect(r.getByTestId('wallet-payments-value').props.children).toBe('₹9,000');
    r.getByText('1 collaboration');

    // what is still to come, and the honest condition on each payment, is one tap in (CW3)
    fireEvent.press(r.getByTestId('wallet-payments'));
    expect(n.navigate).toHaveBeenCalledWith('CreatorWalletPayments', {});

    // it no longer calls itself a stand-in
    expect(r.queryByText(/simple view while the full wallet is being designed/)).toBeNull();
  });

  it('an empty wallet says there is nothing waiting rather than showing a blank', async () => {
    influencerApi.getWallet.mockResolvedValue(ok({ withdrawal_waiting: null, details: {},
      figures: { available: 0, onHold: 0, stillToCome: 0, payments: 0, paymentsCount: 0, nextPaymentAt: null, commission: 0, commissionCount: 0 } }));
    const r = render(<CreatorWalletScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('creator-wallet'));
    expect(r.getByTestId('wallet-balance-amount').props.children).toBe('₹0');
    r.getByText('Nothing waiting');
    r.getByText('No sales in a return window');
  });

  it('commission on the way is its own figure, counted by the sales still in their return window', async () => {
    influencerApi.getWallet.mockResolvedValue(ok({ withdrawal_waiting: null, details: {},
      figures: { available: 500, onHold: 0, stillToCome: 1250, payments: 0, paymentsCount: 0, nextPaymentAt: null, commission: 1250, commissionCount: 4 } }));
    const r = render(<CreatorWalletScreen navigation={nav()} route={{ params: {} }} />);
    await waitFor(() => r.getByTestId('wallet-commission'));
    expect(r.getByTestId('wallet-commission-value').props.children).toBe('₹1,250');
    r.getByText('4 sales in their return window');
  });
});

// ── The card that lied ───────────────────────────────────────────────────────

describe('the Active card, after both signed', () => {
  const card = (over) => ({
    id: 'ci1', group: 'signed', brand: { name: 'Kanchi Silks (practice)' },
    campaignName: 'Diwali', setName: 'Set A', goal: 'engagement', money: {},
    agreement: { bothSignedAt: '2026-09-16T12:00:00Z' },
    ...over,
  });

  it('says the amount the signature actually moved', () => {
    const r = render(<InvitationCard5 card={card({ firstPayment: 3000, hasUpfrontMoney: true })} onPress={() => {}} />);
    r.getByText('₹3,000 is in your wallet. Signed 16 Sep.');
  });

  it('⚠️ never invents a zero when the server did not send the number', () => {
    // The exact shape that produced "₹0 is in your wallet" for a creator holding ₹3,000:
    // firstPayment absent from the payload entirely.
    const r = render(<InvitationCard5 card={card({ hasUpfrontMoney: true })} onPress={() => {}} />);
    expect(r.queryByText('₹0 is in your wallet. Signed 16 Sep.')).toBeNull();
    r.getByText('Signed 16 Sep. Your first payment is on its way.');
  });

  it('a commission-only collaboration is not described as having paid zero', () => {
    const r = render(<InvitationCard5 card={card({ firstPayment: 0, hasUpfrontMoney: false, goal: 'conversion' })} onPress={() => {}} />);
    expect(r.queryByText('₹0 is in your wallet. Signed 16 Sep.')).toBeNull();
    r.getByText('Signed 16 Sep. You earn as you sell.');
  });
});
