/**
 * Layer 3 flow test — FollowerWalletScreen load path.
 *
 * Covers the wallet/transactions fetch + parse on mount (the
 * data.wallet / data.transactions unwrapping) and the zero-state
 * fallback when the endpoints fail.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

jest.mock('../../../services/api', () => ({
  followerApi: { getWallet: jest.fn(), getWalletTransactions: jest.fn() },
}));
jest.mock('../../../components/restaurant', () => ({ CreatorChip: () => null }));

import FollowerWalletScreen from '../FollowerWalletScreen';
import { followerApi } from '../../../services/api';

beforeEach(() => jest.clearAllMocks());

describe('FollowerWalletScreen — load', () => {
  test('renders balance + a creator-attributed reward row', async () => {
    followerApi.getWallet.mockResolvedValue({
      data: { wallet: { available: 150, pending: 20, lifetime: 300 } },
    });
    followerApi.getWalletTransactions.mockResolvedValue({
      data: {
        transactions: [{
          id: 'tx1', brand_name: 'Test Diner', influencer_handle: 'sagar.eats',
          amount: 45, status: 'credited', kind: 'reward', created_at: '2026-05-01',
        }],
      },
    });

    render(<FollowerWalletScreen navigation={{ canGoBack: () => false }} />);

    expect(await screen.findByText('₹ 150')).toBeTruthy();
    expect(screen.getByText('Cashback from Test Diner')).toBeTruthy();
    expect(screen.getByText('+ ₹45')).toBeTruthy();
  });

  test('falls back to zero-state when the endpoints fail', async () => {
    followerApi.getWallet.mockRejectedValue(new Error('network'));
    followerApi.getWalletTransactions.mockRejectedValue(new Error('network'));

    render(<FollowerWalletScreen navigation={{ canGoBack: () => false }} />);

    expect(await screen.findByText('No rewards yet')).toBeTruthy();
    expect(screen.getAllByText('₹ 0').length).toBeGreaterThan(0);
  });
});
