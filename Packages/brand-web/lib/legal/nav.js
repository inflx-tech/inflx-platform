// Footer navigation + the phase flag for the legal surface.
//
// Kept OUT of registry.js on purpose. registry.js imports every legal
// document, so a footer that imported its links from there would drag ~120 KB
// of legal prose into the landing-page bundle for the sake of a list of
// hrefs. This module has no dependencies.

// PUBLISHED 2026-08-06, on the founder's approval of the document text.
//
// Every mandatory disclosure in company.js now has a real value, taken from
// the Certificate of Incorporation and from the founder directly, so the
// footer carries the full statutory block and every policy link resolves.
//
// Set this back to false only if a disclosure is ever removed — the footer
// then falls back to the identity and ownership notice alone rather than
// publishing a half-filled statutory block.
export const LEGAL_SURFACE_LIVE = true;

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
