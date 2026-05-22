# Impact Analysis — fix D9 conversion invite offer_type

## Deploy posture — PRODUCTION-IMPACTING
- Changes `Packages/brand-web/app/dashboard/campaigns/new/page.js`
  (UI-governed). `git push origin main` → Vercel redeploys brand-web.
- Surfaced explicitly; founder go required at push (never silent).
- Forward-only; rollback = revert the change.

## Affected
- New-campaign wizard, Step 2, per-influencer config for
  conversion/hybrid handpick sets only.
- `validateSets` per-influencer validation (+ offer_type requirement).
- `renderInfluencerConfig` (+ error display under Offer-type grid +
  markTouched on tap).

## Regression surface
- **Client-only change** — no backend, no API, no DB. The backend
  invite rule is unchanged (source of truth).
- Engagement sets: unaffected — the new check is inside `needsOffer`
  (conversion/hybrid). Engagement still forbids offer_type.
- Open-group sets: unaffected — this is the handpick per-influencer
  block; open-group offer config is the group editor (separate).
- The conversion E2E (`pnpm qa:e2e:conversion`) selects an offer type
  → still passes (happy path unchanged).
- Main `pnpm qa` (web specs): the campaign wizard isn't exercised by
  the 66 specs beyond auth; re-run to confirm zero regression.

## Risk notes
- Very low: adds one validation rule + one error display, mirroring an
  existing backend rule. The main risk would be over-blocking
  (engagement) — avoided by gating behind `needsOffer`.
- Net effect is strictly safer: prevents publishing a conversion
  campaign whose influencer would be silently dropped.
