'use client';
// A new offer — step 1 of the builder (O2). Contract: features/offer-builder-v2
// ?products=a,b arrives from Products without offers → "Put in offer" (O8).
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import OfferWizard from '../../../../../components/offers/OfferWizard';

function NewOffer() {
  const sp = useSearchParams();
  const products = (sp.get('products') || '').split(',').map((s) => s.trim()).filter(Boolean);
  return <OfferWizard initialProducts={products} />;
}

export default function NewOfferPage() {
  return <Suspense fallback={null}><NewOffer /></Suspense>;
}
