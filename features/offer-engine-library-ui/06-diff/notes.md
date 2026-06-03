# Before / After — offer-engine-library-ui (Sub-contract B)

**Before** = the locked mockups (`04-preview/mockups/01-offers-list.html`,
`02-offer-builder.html`). **After** = the implemented React surfaces
(`app/dashboard/offers/page.js`, `components/OfferBuilder.js`). Verified by a
clean `next build` (route `/dashboard/offers` compiled, 7.23 kB; whole app build
green). Element-by-element comparison below.

## Screen 01 — Offer Library (mockup → page.js)
| Mockup element | Implemented | Match |
|---|---|---|
| Header: "Offers" + sub + "New offer" btn | `.hdr` h1 + sub + `btn-ink` | ✓ |
| Stat tiles (Total / Active / Drafts / Archived) | `.stats` from API `counts` | ✓ (live counts, not hardcoded) |
| Status tabs (All/Active/Drafts/Archived) | `.tabs`, client filter on `status` | ✓ |
| Search + type filter chips | `.toolbar` search + chips (All/5 types) | ✓ |
| Offer row: icon, name, summary, type+status pills, actions | `.offer-row`, `previewLine(draftFromOffer(o))` summary | ✓ |
| Distribution badges ("In store" / "N influencers") | **omitted** | Intentional — C/D scope (documented in spec) |
| Row actions | Edit / Activate (if draft) / Archive | ✓ (mockup showed Distribute; replaced with Activate/Archive since distribution is C/D) |
| Empty state (gradient card, CTA) | `.empty` | ✓ |
| Locked palette (ink #0A0A0A / yellow #FFC107), Outfit/Plus-Jakarta/JetBrains | `.ofl` scoped CSS | ✓ |

## Screen 02 — Offer Builder (mockup → OfferBuilder.js)
| Mockup element | Implemented | Match |
|---|---|---|
| Name field | `.f` name input | ✓ |
| 5 type cards (Discount/Volume/BOGO/Bundle/Free gift) | `.typebar` `.tcard` × 5, click switches | ✓ |
| Per-type fields (pct/₹ toggle+value; tiers; bogo buy/get; bundle products+price; gift pairings) | per-type `.cfg` blocks | ✓ |
| Scope toggle (Whole store / Category / Products) | `ScopeToggle` seg + section select + product MultiPicker | ✓ |
| Availing modes | `.modes` 4 toggles | ✓ |
| Live preview line | `.preview` via `previewLine(draft)` | ✓ |
| Product picker | Mockup showed "+ Pick product"; implemented as `<select>`-based single/multi picker (functional, catalogue-backed) | ≈ (same outcome, simpler control than a modal — noted) |
| Footer: Save draft / Save & … | modal footer "Save draft" + "Save & activate" (mockup said "Save & distribute"; distribution is C/D) | ≈ (relabeled, in-scope) |

## Intentional deltas (in-scope, documented)
1. **No distribution UI** (store toggle, influencer attach, badges) — Sub-contracts C/D. Row action is Activate/Archive; modal CTA is "Save & activate".
2. **Product picker** uses native `<select>` add + chips instead of a pop-over modal — same data outcome (catalogue-backed product objects with id/name/price), lighter to ship and reuse in the wizard (C).
3. Stat tiles + tabs use **live API counts**, not the mockup's sample numbers.

## Verification status
- `next build`: GREEN, `/dashboard/offers` route compiled, no errors/type issues in the new files.
- Live Playwright pixel-capture not run in this authoring environment; the above is a structural before/after against the locked mockups. A Vercel preview deploy renders the real page for final visual sign-off.
- No existing page/component changed (diff = 2 new files + 2 additive edits), so zero regression to other dashboard surfaces.
