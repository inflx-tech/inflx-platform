// Which legal documents appear in which app.
//
// The principle: a person should see the documents that bind THEM, not the
// whole library. A shopper deciding whether to buy a kurta does not need the
// Creator Agreement, and showing it to them makes the things they DO need —
// refunds, privacy, how to complain — harder to find.
//
// Three groups:
//   COMMON  — binds everyone, so it appears in every app. Six documents.
//   ROLE    — binds one or two sides only.
//   WEB     — reachable at inflx.in/legal, which always carries the full set.
//
// Every app also links "All legal documents" to inflx.in/legal, so nothing is
// ever unreachable — it is just not in the way.

export const AUDIENCES = {
  brand: 'Brand app + web dashboard',
  creator: 'Creator app',
  shopper: 'Follower app',
};

const ALL = ['brand', 'creator', 'shopper'];

// slug -> which audiences see it in their in-app Legal section.
// `web: true` means it is on inflx.in/legal but not worth a slot in an app.
export const DISTRIBUTION = [
  // ── Common: binds everyone ──
  { slug: 'terms',                  title: 'Terms of Use',                audiences: ALL, why: 'The agreement everyone accepts by using INFLX.' },
  { slug: 'privacy',                title: 'Privacy Policy',              audiences: ALL, why: 'Required in every app by both app stores.' },
  { slug: 'community-guidelines',   title: 'Community Guidelines',        audiences: ALL, why: 'Conduct rules. Anyone can post, comment or report.' },
  { slug: 'grievance',              title: 'Grievance Redressal',         audiences: ALL, why: 'Must be reachable from every surface, by law.' },
  { slug: 'account-deletion',       title: 'Delete My Account',           audiences: ALL, why: 'Google Play requires it in every app.' },
  { slug: 'contact',                title: 'Contact Us',                  audiences: ALL, why: 'Company identity and customer care.' },

  // ── Role-specific ──
  { slug: 'creator-agreement',      title: 'Creator Agreement',           audiences: ['creator'],          why: 'Binds creators only. Irrelevant to a shopper.' },
  { slug: 'brand-agreement',        title: 'Brand Agreement',             audiences: ['brand'],            why: 'Binds brands only.' },
  { slug: 'advertising-disclosure', title: 'Advertising Disclosure',      audiences: ['creator', 'brand'], why: 'Creators must label paid posts; brands must make sure they do.' },
  { slug: 'content-ip-policy',      title: 'Content & Intellectual Property', audiences: ['creator', 'brand'], why: 'Only creators and brands upload content.' },
  { slug: 'copyright',              title: 'Copyright & Takedown',        audiences: ['creator', 'brand'], why: 'The people who post, and who get copied.' },
  { slug: 'refunds',                title: 'Refund & Cancellation',       audiences: ['shopper', 'brand'], why: 'Shoppers claim refunds; brands must honour them.' },
  { slug: 'ranking',                title: 'How Ranking Works',           audiences: ['shopper', 'brand'], why: 'Shoppers ask why they see this; brands ask why they do not.' },

  // ── Web only ──
  { slug: 'cookies',                title: 'Cookie Policy',               audiences: [],  web: true, why: 'Cookies are a website concern. App tracking is covered in the Privacy Policy.' },
];

/** The Legal section for one app, in display order. */
export function docsFor(audience) {
  return DISTRIBUTION.filter((d) => d.audiences.includes(audience));
}

/** Everything, for inflx.in/legal. */
export function allDocs() {
  return DISTRIBUTION;
}

export const COUNTS = Object.fromEntries(
  Object.keys(AUDIENCES).map((a) => [a, docsFor(a).length]),
);
