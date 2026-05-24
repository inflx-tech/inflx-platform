# Workflow prediction — Flow 7

`mockups/web.html` shows all 3 wizard steps stacked in one preview file
(scrollable, anchor-linked). Step 2 includes 1 expanded set + 1 collapsed
set + browse drawer + offer drawer.

| Mockup section | Real source | Implementation note |
|---|---|---|
| Topbar + step progress | `page.js` chrome | Logo placeholder + breadcrumb + 3-step indicator, repeated across steps |
| Step 1 — Campaign basics card | `page.js` step === 0 block | Same 4 fields + allow_negotiation card-switch + remaining-budget strip |
| Step 2 — Pinned budget strip | `page.js` step === 1 block | Pinned at top of Step 2 main column |
| Step 2 — Set accordion (collapsed) | NEW layout pattern | Replaces `.set-tabs` row from old layout |
| Step 2 — Set accordion (expanded body) | `renderSetBody(si)` | 4 grouped panels (Identity / Schedule & money / Content brief / Influencers) |
| Step 2 — Browse drawer | `browse-panel` block, lifted to slide-in drawer | Same filters + grid + Add-N/Invite-M footer |
| Step 2 — Offer drawer | `renderOfferConfig` (called per influencer + per group), lifted to slide-in drawer | Same 5 offer-type sub-forms + shared fields |
| Step 2 — Open-group params form | `renderGroupConfig(si)` | Inline in expanded set body when mode = open_group |
| Step 2 — Right rail (NEW) | derives from `validation` + `sets` state | Live step counter + summary + status flags + Save draft + primary CTA |
| Step 3 — Review summary | `renderReview()` | Same per-set summary cards + per-influencer allocation breakdown |
| Step 3 — Wallet status card (NEW visual, existing data) | `brandWalletBalance` + computed escrow lock | Surfaces what server-side `publish` will check |
