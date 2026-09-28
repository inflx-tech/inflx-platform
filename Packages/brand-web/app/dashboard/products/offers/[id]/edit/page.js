'use client';
// A draft offer, in the builder (O2–O7). Contract: features/offer-builder-v2
// (Not "…/build": the repo .gitignore drops every build/ folder, so that route would never deploy.)
import OfferWizard from '../../../../../../components/offers/OfferWizard';

export default function BuildOfferPage({ params }) {
  return <OfferWizard key={params.id} id={params.id} />;
}
