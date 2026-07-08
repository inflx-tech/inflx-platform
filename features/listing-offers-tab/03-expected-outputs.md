# Expected outputs — listing-offers-tab

1. `Packages/brand-web/app/dashboard/products/components/OffersLibrary.js`
   exists; default-exports `OffersLibrary`; contains OFL constants + `.ofl`
   CSS verbatim from products/page.js@bc44aa2 lineage.
2. `products/page.js` no longer defines `OffersLibrary`/`OFL_CSS`; imports the
   component; Offers sub-tab renders it as before.
3. `listing/page.js` tab bar = My listings · Add products · Offers; Offers tab
   mounts `<OffersLibrary />`; `?tab=offers` initializes `view='offers'`;
   page h1/setup-link row hidden while on Offers.
4. `pnpm qa` GREEN (frontend-only change; no backend contract touched).
5. Manual check (founder or Playwright): fashion brand sees Offers tab and can
   open the New-offer modal from the Listings surface.
