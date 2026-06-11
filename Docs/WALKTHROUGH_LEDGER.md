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
| P1 | Offer tap → "Offer not found" (shelf passes brand_offer id, detail looks up campaign_offers) | F | QUEUED (Sprint-1, app+backend) |
| P2 | Share-link deep-link handler missing in follower app — attribution lost on entry | F | QUEUED (Sprint-1) |
| P3 | Influencer has no screen to copy their share link | N | QUEUED (Sprint-1) |
| P4 | "Pay at salon" + hardcoded CTAs on fashion business page (BrandStoreScreen ignores schema actions) | F | QUEUED |
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
