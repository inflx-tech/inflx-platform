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
| W5e | 2026-06-11 | Submitted content not visible for review | Brand can't see submitted content | DATA CHECK: zero deliverables in submitted/under_review in ALL of prod right now (founder's test deliverable was submitted 07:05 + live-confirmed 07:08 on Jun 9 — already through). BUT the UX truth stands: Content tile counts ONLY live+approved (page.js:144-145) — a submitted item would be invisible on the hub except in the right-rail action list. 3 'approved' awaiting live-confirm also not surfaced on tile | D | W5 redesign: tile shows "X to review · Y awaiting live · Z live"; SUBMITTED badge in hierarchy |
