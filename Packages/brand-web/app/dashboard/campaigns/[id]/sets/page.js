'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/* Retired route (features/brand-cc-sets-escrow, A4). The sets rollup is now the
   campaign command center's Hierarchy (grouped by set); set creation lives in the
   campaign wizard (campaigns/new). This page redirects to the hub. */
export default function RetiredSetsRedirect() {
  const { id } = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/campaigns/${id}`);
  }, [id, router]);
  return (
    <div className="p-8 text-[13px] text-[#71717A]">
      Sets now live in the campaign command center. Redirecting…
    </div>
  );
}
