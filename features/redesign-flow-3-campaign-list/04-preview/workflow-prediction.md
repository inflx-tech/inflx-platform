# Workflow prediction — Redesign Flow 3 · Campaign list

## What the mockup predicts

`mockups/web.html` shows the visual + UX target for `/dashboard/campaigns`. Below is what will be visibly true post-implementation.

### Chrome (carried over from Flow 2)
- Black ink topbar · Campaigns nav item yellow-active
- Persistent banners render only when brand.status is pending or rejected

### Page body
- Outfit H1 "Campaigns" + yellow rule + mono count meta
- Yellow primary "+ New campaign" CTA top-right
- 5 mono-digit summary tiles in a row
- Search input · status chips · sort dropdown all in one filter strip
- Bulk action bar appears only when selection > 0
- Card grid: clean cards with name · dates · status badge · budget · CTA

### What is NOT being predicted
- Pixel-perfect font rendering across browsers
- Pre-existing date-formatting quirks (Indian locale; varies by locale settings)
- The two dropped fields (`spent_budget` progress bar, `influencer_count` footer) — intentionally absent

### How implementation maps to mockup

| Mockup section | Real source | Implementation note |
|---|---|---|
| Page header | `page.js` header area | larger H1, add yellow rule, expand meta line counts |
| Summary tiles | `page.js` SummaryStats component | restyle to locked palette; identical client-side filter logic |
| Filter bar | `page.js` FilterBar component | replace status `<select>` with chip row; preserve search + sort selects |
| Bulk action bar | `page.js` BulkActionBar component | ink chrome restyle |
| Card grid | `page.js` CampaignCard component | DROP progress bar + influencer footer; preserve checkbox + click-to-detail |
| Confirm modals | `page.js` ConfirmModal component | restyle (rounded, locked palette) |
| Empty state | inline JSX | emoji → muted icon-circle |
