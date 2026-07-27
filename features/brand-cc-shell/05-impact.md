# Impact — Brand CC shell (A1)

## One-line verdict
**Frontend-only, brand-web (Vercel) — zero backend/DB. Additive (low regression risk).**

## What changes
- Adds `CommandRail.js` (StageRail + PrimeBar + deriveCampaignStage) — the web kit seed.
- Edits `[id]/page.js`: injects the rail + prime bar after the header; replaces the
  ad-hoc "needs you" banner; wires Fund & Publish.

## Blast radius
- brand-web only; `git push` → Vercel redeploys the brand dashboard.
- Additive — existing body untouched; publish/wallet endpoints unchanged.

## Risks & mitigations
- Live-page regression → change is additive (rail on top), validated by `next lint` +
  founder Vercel check; existing logic/vars reused, not rewritten.
- Stage heuristic wrong for an edge status → falls back to the furthest-reached stage; no
  dead CTA.

## Release classification
**Production-impacting via Vercel** → surfaced for explicit founder go. Web verify =
founder on the deployed dashboard (no Maestro; brand-web has no device gate).
