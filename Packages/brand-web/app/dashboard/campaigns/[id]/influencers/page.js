'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/* Retired route (features/web-campaigns-monitor, 27 Oct 2026). The per-creator list, the
   negotiation, the agreement, the shoot and the content review all live on the phone; the
   website shows them read-only in the campaign hub's set drawer. Kept as a redirect so old
   bookmarks and inbox links do not 404. */
export default function RetiredInfluencersRedirect() {
  const { id } = useParams();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/dashboard/campaigns/${id}`);
  }, [id, router]);
  return (
    <div className="p-8 text-[13px] text-[#71717A]">
      Creators are shown in the campaign page now. Redirecting…
    </div>
  );
}
