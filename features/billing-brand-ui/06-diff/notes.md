# 06-diff — billing-brand-ui

**Before:** brand dashboard had no surface for the new revenue model.
A brand could only see their wallet + escrow status; no way to view
current plan, no way to upgrade, no invoice history.

**After:** 2 new dashboard pages reachable from the nav:

1. **/dashboard/subscription** — the brand now sees: their current tier
   + status + price + cycle dates; their usage this cycle (campaigns /
   products / influencer-invites) with over-limit indicators; and a
   4-tier comparison grid where they can click "Choose Growth" (or
   any tier above their current one) to upgrade. The current plan is
   visually distinguished with a thicker border.

2. **/dashboard/billing** — the brand sees their full subscription
   invoice history with status pills (paid / pending / failed /
   refunded), amount, GST, total, and paid-at date. Summary tiles at
   the top show invoice count, total paid, pending count, failed count.

3. **QuotaWallModal** — a reusable component file under
   `Packages/brand-web/components/`. Not yet wired to any page; future
   contracts will import + invoke when 422 QUOTA_EXCEEDED hits.

**Style baseline:** all 3 new surfaces match the existing wave2
locked palette already used in `/dashboard/wallet/page.js` (white
cards, ink-on-bg, single-accent CTAs, Outfit font). No new design
tokens introduced. Founder will restyle later when Window B's design
system foundation lands; the data-binding lines will not need to change.

**Functional verification:** Playwright spec
`qa/web/brand/subscription-billing-nav.spec.ts` asserts each page
reachable by a brand session + key landmarks render. Pass count
expected to bump pnpm qa from 71 → 73.

**No regression risk on existing pages:** only `layout.js` NAV array
was touched (append-only). Wallet, products, campaigns etc. unchanged.

**Window B coordination:** `layout.js` is in §9 of the coordination
list. My change appends 2 nav entries at the tail per the documented
convention. When Window B restyles the nav rendering, the new entries
slot into the redesigned shell automatically.
