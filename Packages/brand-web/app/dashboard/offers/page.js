'use client';

// Offers were folded into Listings (Products) as the "Offers" sub-tab (E-3).
// This thin client redirect keeps old bookmarks alive.
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OffersRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard/products?tab=offers'); }, [router]);
  return null;
}
