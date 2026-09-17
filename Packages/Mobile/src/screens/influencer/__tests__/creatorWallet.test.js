/**
 * The creator's money — the card that said zero, and the wallet that shows it.
 * Contract: features/creator-wallet-and-first-payment
 *
 * The defect these pin: Asha signed, the platform released ₹3,000 into her wallet that second,
 * and the app told her "₹0 is in your wallet". The money was real. The number was never sent to
 * the screen, so the screen invented a zero.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  influencerApi: { getEarnings: jest.fn() },
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

describe('the creator wallet', () => {
  it('shows the money that is already hers, what is still held, and why', async () => {
    influencerApi.getEarnings.mockResolvedValue(ok({
      wallet_balance: '3000.00', pending_balance: '0.00', total_earned: '3000.00',
      available_to_withdraw: '3000.00', pending_amount: '9000.00',
      // These rows are shaped EXACTLY as GET /influencers/me/earnings returns them —
      // `SELECT ee.*` from escrow_entries, so the column is `tranche_number`.
      //
      // This fixture used to say `tranche`, which is the field the screen happened to
      // read, so the test proved the screen agreed with itself and nothing more. In
      // production every row got undefined and read "On signing", which told a creator
      // three quarters of her fee was due at signature. Copy the server's shape, never
      // the reader's.
      locked_entries: [
        { id: 'e2', tranche_number: 2, amount: '3000.00', campaign_name: 'Diwali Edit 2026' },
        { id: 'e3', tranche_number: 3, amount: '6000.00', campaign_name: 'Diwali Edit 2026' },
      ],
      commission_summary: { pending: 0, confirmed: 0, total: 0 },
    }));
    const r = render(<CreatorWalletScreen />);
    await waitFor(() => r.getByTestId('creator-wallet'));

    // Asserted inside their own tiles: the fixture has ₹3,000 twice (her balance, and the
    // second tranche held for her), and a loose text match cannot tell them apart.
    expect(r.getByTestId('wallet-balance').props.children).toBe('₹3,000');
    expect(r.getByTestId('wallet-held').props.children.some((c) => c && c.props && c.props.children === '₹9,000')).toBe(true);
    r.getByText('Money that has been released to you.');

    // what is held, and the honest condition on each
    r.getByText('When your post goes live and the brand confirms it');
    r.getByText('After your post has stayed live');
    r.getByText('₹6,000');

    // it admits what it is
    r.getByText(/simple view while the full wallet is being designed/);
  });

  it('an empty wallet explains how money will arrive rather than showing a blank', async () => {
    influencerApi.getEarnings.mockResolvedValue(ok({
      wallet_balance: '0.00', total_earned: '0.00', pending_amount: '0.00',
      locked_entries: [], commission_summary: { pending: 0, confirmed: 0 },
    }));
    const r = render(<CreatorWalletScreen />);
    await waitFor(() => r.getByTestId('creator-wallet'));
    r.getByText('Nothing held right now');
    r.getByText('When a brand signs an agreement with you, the money is locked here and released in three parts.');
  });

  it('commission on the way is shown with the reason it is not hers yet', async () => {
    influencerApi.getEarnings.mockResolvedValue(ok({
      wallet_balance: '500.00', total_earned: '500.00', pending_amount: '0.00',
      locked_entries: [], commission_summary: { pending: 1250, confirmed: 0 },
    }));
    const r = render(<CreatorWalletScreen />);
    await waitFor(() => r.getByTestId('wallet-commission'));
    r.getByText('₹1,250 commission on the way');
    r.getByText('Commission is confirmed after the return window closes, then it moves into your wallet.');
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
