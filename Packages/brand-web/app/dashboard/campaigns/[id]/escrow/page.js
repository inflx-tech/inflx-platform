'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/* Retired route (features/brand-cc-sets-escrow, A4). Escrow/payout now lives in the
   campaign command center's Payout tab — this page redirects there. Kept as a redirect
   so old bookmarks / deep-links don't 404. */
export default function RetiredEscrowRedirect() {
  const { id } = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/campaigns/${id}?tab=payout`);
  }, [id, router]);
  return (
    <div className="p-8 text-[13px] text-[#71717A]">
      Payout details now live in the campaign command center. Redirecting…
    </div>
  );
}
