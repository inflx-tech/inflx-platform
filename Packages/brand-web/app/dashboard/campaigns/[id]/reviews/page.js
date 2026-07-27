'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/* Retired route (features/brand-cc-review, A2). Content review consolidated into the
   Campaign Command Center — this page now redirects to the hub. Kept as a redirect so
   old bookmarks / deep-links (?tab=reviews|live) don't 404. */
export default function RetiredReviewsRedirect() {
  const { id } = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/campaigns/${id}`);
  }, [id, router]);
  return (
    <div className="p-8 text-[13px] text-[#71717A]">
      Content review now lives in the campaign command center. Redirecting…
    </div>
  );
}
