// Footer navigation + the phase flag for the legal surface.
//
// Kept OUT of registry.js on purpose. registry.js imports every legal
// document, so a footer that imported its links from there would drag ~120 KB
// of legal prose into the landing-page bundle for the sake of a list of
// hrefs. This module has no dependencies.

// The legal pages are built and pass QA, but they are NOT published: the
// mandatory disclosures in company.js are still unsupplied, so the documents
// would go live showing red placeholders where a CIN and a named Grievance
// Officer belong.
//
// While this is false the public footer shows the company identity and the
// ownership notice only — no links to unbuilt pages, and no half-filled
// statutory block. Flip it to true in the same change that supplies the facts
// and ships app/legal/**; the two only make sense together.
export const LEGAL_SURFACE_LIVE = false;

// Split by WHO IS ASKING, not by legal taxonomy. A shopper wanting a refund
// and a creator checking their disclosure duty should not have to read the
// same column. "Help" is last and holds the routes someone reaches when
// something has already gone wrong — which is when a legal footer earns its
// keep, so those links are never buried inside a policy page.
export const FOOTER_GROUPS = [
  {
    title: 'Platform',
    links: [
      { label: 'For Brands', href: '/#brands' },
      { label: 'For Creators', href: '/#creators' },
      { label: 'For Shoppers', href: '/#shoppers' },
      { label: 'Trust & Responsibility', href: '/#trust' },
    ],
  },
  {
    title: 'Policies',
    links: [
      { label: 'Privacy Policy', href: '/legal/privacy' },
      { label: 'Terms of Use', href: '/legal/terms' },
      { label: 'Cookie Policy', href: '/legal/cookies' },
      { label: 'Refund & Cancellation', href: '/legal/refunds' },
      { label: 'Community Guidelines', href: '/legal/community-guidelines' },
      { label: 'How Ranking Works', href: '/legal/ranking' },
    ],
  },
  {
    title: 'Agreements',
    links: [
      { label: 'Creator Agreement', href: '/legal/creator-agreement' },
      { label: 'Brand Agreement', href: '/legal/brand-agreement' },
      { label: 'Content & IP Policy', href: '/legal/content-ip-policy' },
      { label: 'Advertising Disclosure', href: '/legal/advertising-disclosure' },
      { label: 'Copyright & Takedown', href: '/legal/copyright' },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'Grievance Officer', href: '/legal/grievance' },
      { label: 'Contact Us', href: '/contact' },
      { label: 'Delete My Account', href: '/account-deletion' },
      { label: 'All Legal Documents', href: '/legal' },
    ],
  },
];

// Phase 1 shows only the links that already resolve on the live site.
export const PUBLIC_FOOTER_GROUPS = LEGAL_SURFACE_LIVE
  ? FOOTER_GROUPS
  : FOOTER_GROUPS.filter((g) => g.title === 'Platform');
