'use client';

/**
 * /dashboard/settings/payouts — retired by item 17 (features/item17-wallet; rules v1.31 §17A).
 *
 * This page connected a Razorpay Route account so sales settled to the brand's bank by themselves.
 * Sales money is now added to the brand's WALLET when each return window closes, and the brand
 * withdraws by request — so there is no payout account to connect. Anyone arriving on the old
 * address is taken to the Wallet, where the bank account and withdrawals now live.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PayoutsPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/wallet'); }, [router]);
  return <div style={{ padding: 24, fontSize: 13, color: '#52525B' }}>Your sales money and withdrawals are in Wallet now…</div>;
}
