'use client';

/**
 * /admin/payouts (creator and brand withdrawals: approve fired an automatic payout; reject refunded) — retired by item 17 (features/item17-wallet; master rules v1.31 §17A).
 * All the money is in one Admin section now; this address leads to Withdrawals.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Moved() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin/money/withdrawals'); }, [router]);
  return <div className="p-8 text-center text-t3 text-sm">This page moved to Money → Withdrawals…</div>;
}
