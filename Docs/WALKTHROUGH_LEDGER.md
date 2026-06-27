# Founder Walkthrough Ledger — started 2026-06-11

> Protocol: founder walks every flow as a real user, starting from new-user
> registration. Every reported issue is verified at the data layer first
> (prod DB read-only), then classified and queued:
>
> - **F (functional)** — broken flow / wrong data / missing interconnection → FIX IMMEDIATELY
> - **N (new feature)** — doesn't exist yet → discuss scope, build after F items
> - **D (display)** — data exists, frontend doesn't show it → batched sweep
> - **U (UI/UX)** — works but not user-friendly → batched sweep (with D)
> - **C (cosmetic/colors)** — parked until founder asks
>
> Statuses: REPORTED → VERIFIED(F/N/D/U/C) → FIXED/QUEUED/PARKED.
> Fixes follow the standard pipeline: contract → fix → pnpm qa + journey
> driver → deploy with explicit go (backend) / batched OTA (mobile).

## Pre-seeded from Phase A + 2026-06-10 diagnostic (already verified, no need to re-report)

| # | Issue | Class | Status |
|---|-------|-------|--------|
| P1 | Offer tap → "Offer not found" (shelf passes brand_offer id, detail looks up campaign_offers) | F | **BUILT** — contract sprint1-offer-pipeline (3 tap channels proven E2E, journey 30/30); pending OTA + founder verify |
| P2 | Share-link deep-link handler missing in follower app — attribution lost on entry | F | QUEUED (Sprint-1) |
| P3 | Influencer has no screen to copy their share link | N | QUEUED (Sprint-1) |
| P4 | "Pay at salon" + hardcoded CTAs on fashion business page (BrandStoreScreen ignores schema actions) | F | **BUILT** — contract sprint2-business-page-ctas (locked CTA spec in all 6 schemas + category-aware chip + product CTA order); pending OTA + founder verify |
| P5 | Section config covers only Eat+Shop verticals — furniture etc. invisible | F | QUEUED (config rows) |
| P6 | Blank filter chips on Offers tab (renderer/label mismatch) | D | QUEUED |
| P7 | Orders empty-state says "Nothing here yet" twice | C | PARKED |
| P8 | "0 places" count inconsistent with shown businesses | D | QUEUED |
| P9 | Store-direct offer publish (Offer Engine channel D) stubbed — no endpoint/UI | N | QUEUED |
| P10 | Restaurant listing engine (contract #1) implemented on branch, not deployed | N | QUEUED |
| P11 | App-side payment recovery UI ("payment pending" + retry against durable pending orders) | N | QUEUED |
| P12 | Open-group application flow (influencer applies) unverified mobile↔backend | F? | NEEDS VERIFY |
| P13 | Pending influencers may see offer inbox (no status guard) — confirm intent | F? | NEEDS VERIFY |

## Walkthrough reports (live — newest at bottom)

| # | Date | Flow / screen | Founder report | Data-layer verdict | Class | Status |
|---|------|---------------|----------------|--------------------|-------|--------|
| W1 | 2026-06-11 | Brand registration — industry picker | Regroup: coaching→new Education; interior design + coworking→new Consultation Services (+legal/CA); Events & Professional→Events only | Industry groups are frontend-only labels (INDUSTRY_HIERARCHY in brand-web login + follower FindScreen); category VALUES untouched → zero backend impact | U | DESIGN AGREED (pending founder confirm on coworking placement) → batched sweep |
| W2 | 2026-06-11 | Brand registration — location entry | Use geocoding/places APIs: search place or paste maps URL + keep manual option | Backend fully ready (Places proxy + resolveMapsUrl + brands lat/lng cols); only register endpoint + form lacked it | N | **BUILT** — contract brand-register-location-picker; 3-mode picker live after deploy |
| W3 | 2026-06-11 | Brand MOBILE registration | New number + OTP → "under admin review" with NO details form | VERIFIED F: OTPScreen.js:142-151 routes no-profile brands to Waiting; BrandRegister screen didn't exist on mobile AT ALL → brand permanently stuck (never enters admin queue) | F | **BUILT** — contract brand-mobile-register (new screen, W1 industries, place-search location); pending OTA + founder device verify |
| W4 | 2026-06-11 | Brand mobile↔web parity (founder direction: same everything EXCEPT listing + campaign creation on mobile) | Audit requested; founder go: "carry with all 5" | Code audit: 19 mobile screens all real (no stubs); intentional exclusions CLEAN; 6 gaps found | N | **BUILT** — contract brand-mobile-parity-pack: Orders, Bookings, Meals board (restaurant-gated), Offer library, Plan & billing hub, Creator market analytics. v1 link-outs to web: plan upgrade, complex offer builders, meals chat-builder. Pending OTA + founder device verify |
| W5a | 2026-06-11 | Campaign detail (web) — hierarchy + layout | Half screen empty; can't see campaign→set→influencer→deliverable/product hierarchy; use full width | VERIFIED: grid is 1fr+320px sticky rail holding only 2 cards (page.js:240,423-443); rail empty when no pending actions. ALL hierarchy data already returned by getById + /engagement (by_set, by_influencer nested) — frontend renders only counts | U | **BUILT** — contract redesign-campaign-command-center, mockup locked by founder, frontend-only rewrite (covers W5a–W5e); awaiting qa + deploy |
| W5b | 2026-06-11 | Campaign detail — Publishing/products tile | Click doesn't show live products; want product→set→influencer→category mapping | VERIFIED F: tile navigates to the INFLUENCERS page (page.js:356) — no products page exists; /campaigns/:id/products endpoint already returns products + assigned_to_influencers (+section/category on rows); founder's campaign has 6 products in CI offer config | F | FIX with W5 redesign (products drill-in page + tiny endpoint enrich for set names) |
| W5c | 2026-06-11 | Campaign analytics levels | Want campaign / set / influencer / deliverable levels | VERIFIED D: backend /engagement ALREADY computes by_set + by_influencer; deliverable_stats table holds per-deliverable reach/likes/comments/saves/ER; frontend shows only campaign totals | D | Expose in W5 redesign — no backend work needed |
| W5d | 2026-06-11 | Analytics refresh button missing | Existed before UI change | VERIFIED REGRESSION: per-deliverable ↻ added in 0b6c2cc, dropped in Flow-6 redesign 01bb225; endpoint POST /deliverables/:id/refresh-stats intact (Apify re-scrape); button survives only on Reviews page for live items | D | Restore in W5 redesign (campaign-level refresh-all + per-row ↻) |
| W6 | 2026-06-11 | Follower app — pre-discussion analysis | Founder requested: schema inventory, listing-model completeness, CTAs per business, screens plan status | Full analysis in Docs/FOLLOWER_APP_ANALYSIS.md: 35 schemas (2 MISSING: flowers_gifting + hardware though offered at registration!); **PERFECT = salon, car_rental, fashion, furniture** (fashion/furniture drill-down wizard at products/listing/page.js CONFIRMED complete after founder challenged the initial "stub" claim — corrected same day); PARTIAL = restaurant (flywheel branch undeployed); 30 generic; CTA chain blocked by P4; screens per AGREED-VS-BUILT + P1/P5/P6 | — | ANALYSIS DELIVERED (corrected) — discussion next |
| W7 | 2026-06-11 | CTA spec — 5 phase-1 businesses | Founder locked per-page CTAs (restaurant/fashion/furniture/salon/car) | Schema audit found real holes: fashion_walkin has NO actions (root of P4 fallback), salon + car missing their PRIMARY book actions, vocab split walkin_pay/pay_at_store | — | **LOCKED** → Docs/CTA_SPEC.md; schema edits land with Business Page Engine sprint |
| W9 | 2026-06-11 | Post-sprint-2 walk: business/product/cart chain | (a) walk-in store shows 2 CTAs, wants Pay-at-Store only; (b) product tap dead on Charvitha; (c) stray "Visit & Pay via INFLX" button; (d) furniture product shows Pay-at-Store only; (e) Add to Cart → cart page pay disabled | VERIFIED all 5 (causes in fix-plan report). Founder clarified the purchase model → CTA spec REV 3 | F | **FIX-PACK A BUILT** (a-d + organic direct pay end-to-end, journey 31/31 incl. new S6.3b): rev-3 schemas, INFLX banner removed, organic product taps open detail with store products, spec-wins CTAs, in-store discount nudge, store-offer/pay accepts offer-less direct payments. (e) cart rebuild = **BUILT** (contract sprint3-cart-rebuild): full 3-step order (create→pay→verify), 6-key payload fix, working address add, colour+size variant lines, + NEW organic brand-direct delivery order. qa 79/79 + journey 32/32 (incl S6.4b organic). Awaiting prod backend go + OTA + founder verify |
| W5e | 2026-06-11 | Submitted content not visible for review | Brand can't see submitted content | DATA CHECK: zero deliverables in submitted/under_review in ALL of prod right now (founder's test deliverable was submitted 07:05 + live-confirmed 07:08 on Jun 9 — already through). BUT the UX truth stands: Content tile counts ONLY live+approved (page.js:144-145) — a submitted item would be invisible on the hub except in the right-rail action list. 3 'approved' awaiting live-confirm also not surfaced on tile | D | W5 redesign: tile shows "X to review · Y awaiting live · Z live"; SUBMITTED badge in hierarchy |

## Fashion E2E walkthrough — 2026-06-27 (seeded [FTW] test world)

> Sequence agreed: legacy-screen cleanup → UI issues → product page → cars → orders.
> Shopping (fashion+furniture+beauty) share BrandStore/ProductDetail/cart/orders →
> fix once = all three. Food + cars are bespoke. Creator store = Home + creator context.

| # | Date | Screen | Issue | Class | Status | Fix / contract |
|---|------|--------|-------|-------|--------|----------------|
| F1 | 06-27 | Category rail | Tapping **All** opened the legacy Find screen; should show the world's other categories | N | **FIXED · OTA v155** | reroute → in-world category browser (vertical entry) · `follower-browse-fixes` |
| F2 | 06-27 | Business/store page | Tapping a business shows the **old store page** (creatorVibe BrandStore) — rebuild | legacy | 🟡 mock-first | rebuild the shared shopping store page (fashion+furniture+beauty) |
| F3 | 06-27 | Category browser | **Filter chips = ugly tall "long boxes"** + sheet rough; founder gave Myntra/Flipkart refs | D/U | **FIXED · OTA v156** | fixed tall-box bug (fixed-height chipRow → compact chips) + rebuilt modal to **left-nav** (facets left, values right, radio/checkbox, Clear/Apply) · `follower-browse-fixes` |
| F4 | 06-27 | Cart | Cart is **food-flavoured** (🍽️ / "dishes") on the shopping verticals | D/U | 🔴 queued | de-food the shared cart (shopping batch) |
| F5 | 06-27 | "All categories" | Broken — opened empty sidebar+grid ("0 items"); expected a rounded category list | F | **FIXED · OTA v157** | rebuilt as a grouped grid of rounded category tiles → tap opens the browser · `follower-browse-fixes` |
| F6 | 06-27 | Category browser grid | No way to add to cart from products | N | **FIXED · OTA v157** | ＋ quick-add on each product (organic qty1; cross-brand confirm) + floating cart bar |
| F7 | 06-27 | ＋ button | Tap feedback not working | U | **FIXED · OTA v158** | vibration needed VIBRATE permission (MISSING → added, works next APK); OTA feedback = strong scale-bounce + green ✓ flash |
| F8 | 06-27 | Cart cross-brand | "Start a new cart?" prompt wrongly applied to shopping; should be FOOD-ONLY (shopping = multi-brand like Amazon) | F | **FIXED · OTA v158**, re-fixed **v160** | CartContext cart `kind` (food=single-brand, shop=multi-brand); lines tagged w/ brand. **v160: legacy untagged cart still prompted → decide by INCOMING add's kind (shop never prompts).** Multi-brand CHECKOUT split = follow-up |
| F9 | 06-27 | Cart bar | Wanted product thumbnails + count (per ref) | D/U | **FIXED · OTA v158** | cart bar shows overlapping product thumbs + count + total |
| F10 | 06-27 | ＋ on variant product | Need a "Select variant" popup (colour/size/price/stock) on ＋, any world | N | **BUILT · Render + OTA v159** | VariantSheet (colour swatches + size pills w/ price+stock + ADD); backend surfaces variants in grid · `follower-browse-fixes` |
| F11 | 06-27 | Multi-brand cart/order | Customer sees ONE list (items/discounts/total); split per brand internally | F | 🟡 confirmed → **checkout batch** | unified cart/order view + backend per-brand order split |
| F12 | 06-27 | Product page | Want main details up front + "View details" for full specs (2 refs) | D/U | **BUILT · OTA v161** | Highlights tile grid + "View details" popup (All details tiles + description) · `follower-product-page` |
| F13 | 06-27 | Product tap | Tapping a browser product showed "Offer not found" instead of the product page | F | **FIXED · OTA v162** | browser's MRP-markdown `discount_value` made goToProduct treat it as a real offer (product id → store-offer id → 404). Tap now navigates organic (markdown is display-only; PDP recomputes from mrp) · `follower-browse-fixes` |
| F14 | 06-27 | Shopping checkout | Need a shopping cart/checkout (items · bill · recommendations · address+payment bar · place order); ONE flat list, backend splits per brand silently | N | **Slice A BUILT · Render+OTA v163** | `follower-checkout`: recommendations endpoint + "You might also like" cart rail. **Slice B next** = address/payment bar + per-brand order split |
