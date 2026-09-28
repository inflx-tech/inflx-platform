'use client';
// A published offer (O10, O11). Contract: features/offer-builder-v2
import OfferPage from '../../../../../components/offers/OfferPage';

export default function OfferDetailPage({ params }) {
  return <OfferPage key={params.id} id={params.id} />;
}
