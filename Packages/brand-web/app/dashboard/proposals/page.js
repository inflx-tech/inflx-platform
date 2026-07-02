'use client';

// Proposals were folded into Influencers as the "Proposals" sub-tab (E-2).
// This thin client redirect keeps old bookmarks alive.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProposalsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/influencers?tab=proposals'); }, [router]);
  return null;
}
