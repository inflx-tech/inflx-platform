# 03 — Expected outputs

## New files

| Path | What |
|---|---|
| `Packages/brand-web/lib/legal/company.js` | The one source of company identity facts. Twelve tokens, each with a `label` and a `why` (the rule that forces the field). A token with `value: null` renders as a loud placeholder, never as blank or invented text. Exports `missingTokens()` and `identityComplete()`. |
| `Packages/brand-web/lib/legal/registry.js` | Assembles the eleven documents and defines the footer information architecture. Single list — a document cannot appear in the footer but 404 on click. |
| `Packages/brand-web/lib/legal/docs-core.js` | Privacy Policy, Terms of Service, Cookie Policy, Community Guidelines. |
| `Packages/brand-web/lib/legal/docs-parties.js` | Creator Agreement, Brand Agreement, Advertising & Sponsored Content Disclosure. |
| `Packages/brand-web/lib/legal/docs-commerce.js` | Refund & Cancellation, Content & IP Policy, Copyright & Takedown, How Ranking & Recommendations Work. |
| `Packages/brand-web/components/legal/RichText.js` | Inline renderer. Exactly three constructs — `**bold**`, `[text](/href)`, `{{TOKEN}}` — and **no raw HTML**, so a legal document cannot inject markup. Also exports `Tbd`. |
| `Packages/brand-web/components/legal/DocPage.js` | The single document layout: header with dates, sticky contents rail, four block types (`p`, `ul`, `table`, `callout`), related-document cards. |
| `Packages/brand-web/components/legal/GrievanceForm.js` | Client component. The complaint intake the IT Rules require, with the response clock shown **per category** before submit. |
| `Packages/brand-web/components/SiteHeader.js` | Stateless public header. No session lookup — static legal pages should not be interactive. |
| `Packages/brand-web/components/SiteFooter.js` | The compliance footer: identity block, four link groups, grievance/customer-care/helpline strip, IP notice. |
| `Packages/brand-web/app/legal/layout.js` | Header + footer for every legal route, so no legal page can exist without the Grievance Officer on it. |
| `Packages/brand-web/app/legal/page.js` | The legal hub, grouped by audience. Carries a self-clearing "not yet in force" banner while any disclosure is unfilled. |
| `Packages/brand-web/app/legal/[slug]/page.js` | Renders any of the eleven documents. `generateStaticParams` + per-document metadata. Unknown slug → 404. |
| `Packages/brand-web/app/legal/grievance/page.js` | Grievance redressal + the intake form. |
| `Packages/brand-web/app/account-deletion/page.js` | Public, unauthenticated deletion page. App-store requirement. |
| `Packages/brand-web/app/contact/page.js` | Entity identity + contact disclosure. |

## Modified files

| Path | Change |
|---|---|
| `Packages/brand-web/app/page.js` | Dark `#070b16` → white + yellow. Adds a **For Shoppers** section (the third side was never explained), a **Trust & Responsibility** band carrying the six notices, and `SiteFooter` in place of the four `href="#"` links. Session detection, CTA routing and the industry list are behaviourally unchanged. |
| `Packages/brand-web/app/layout.js` | Root metadata was `title: 'INFLX Brand'`. Becomes a real public title + description + canonical, since `/` is now a public marketing page rather than a dashboard shell. |

## Invariants

1. **No `href="#"` on any public route.** Every footer link resolves.
2. **No fabricated company fact.** A value is either founder-supplied in
   `company.js` or renders as a visible red placeholder. There is no
   third state.
3. **One renderer, eleven documents.** No document has bespoke layout.
4. **Every legal route is reachable unauthenticated.** `middleware.js`
   matches only `/`, `/dashboard/:path*`, `/admin/:path*` — untouched.
5. **The Grievance Officer is one click from the home page** on every
   public route, via the footer.
6. **Published timelines are the ones in force since 20 Feb 2026** —
   24 h acknowledge, 7 days resolve, 2 h for intimate-image and
   impersonation reports, 36 h for other removal requests, 3 h on a valid
   legal order, 180-day preservation. The superseded 15-day and 72-hour
   figures appear nowhere.
7. **No repealed tax provision is cited.** The `194-` series is gone with
   the 1961 Act; no document names a section or states a rate.
8. **The ranking document never claims to be a statutory disclosure**,
   because whether it is one is contested.

## Verification

| Check | How |
|---|---|
| Every document parses and renders | `next build` compiles all eleven static params |
| No forbidden citation survives | `grep -Ei "15 days\|72 hours\|194-?[ORH]\|equalisation\|DMCA"` across `lib/legal/` returns nothing outside the copyright document's deliberate "DMCA does not apply here" explanation |
| No invented identity value | `grep -E "U[0-9]{5}[A-Z]{2}[0-9]{4}\|\+91"` across `lib/legal/` returns nothing |
| Placeholders are loud, not silent | `/legal` renders the unfilled-disclosure banner while `missingTokens()` is non-empty |
| Routes are public | Requested with no session cookie; each returns 200 |
| `pnpm qa` | Green, with zero regression against the existing suite |
