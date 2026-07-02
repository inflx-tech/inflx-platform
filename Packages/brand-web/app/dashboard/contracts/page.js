'use client';

// Contracts were folded into Campaigns (E-1). The pending-signature strip lives
// on the campaigns list; per-campaign contracts live on the campaign detail
// "Contracts" tab. This thin client redirect keeps old bookmarks alive.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ContractsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/campaigns'); }, [router]);
  return null;
}
