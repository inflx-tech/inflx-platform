# Expected Outputs — Collabs list

> Step 4. The concrete, checkable artifacts the workflow must produce.

## UI
- `CollabsListScreen` matches `04-preview/mockups/collabs-lifecycle.html`: IG-clean
  white surface, hairline dividers, feed-style rows, stage-filter tabs with an
  underline-active style, yellow = your turn / blue = waiting.
- Bottom bar renders **Collabs** in place of Offers + Campaigns (IG-clean white bar).

## Behaviour / logic (unit-testable, no backend change)
- `deriveStage(influencer_status)` maps every status to exactly one UI stage
  (Invites / Applied / Negotiating / To sign / Active / Tracking / Completed / Archive).
- `mergeCollabs(offers, campaigns)` returns a list **deduped by
  `campaign_influencer_id`**; for a record present in both sources it keeps one entry
  with the canonical stage. Assert: an overlap-window record yields exactly one row.
- `whoseTurn(record)` returns `you | brand` per the status map.
- Filter counts equal the deduped per-stage counts.

## Tests
- Mobile jest: unit tests for `deriveStage`, `mergeCollabs` (dedupe), `whoseTurn`,
  and filter counts — all green.
- **Maestro (Rule-5 mobile gate):** flow `open app → Collabs tab visible → default
  list renders → tap a stage filter → open a row → correct detail screen` passes on a
  connected device/emulator.

## Non-regression
- `pnpm qa` green (deploy-inert JS change; no backend delta).
- No previously-working notification/Home navigation broken (compat assertions).
- Old `OfferListScreen` / `MyCampaignsScreen` still resolve when navigated to (kept
  registered during transition).
