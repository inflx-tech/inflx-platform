# Expected Outputs — Create tab

## UI
- `CreateScreen` matches `04-preview/mockups/create-tab-ia.html` Create column: IG-clean
  white surface, ink "New Post" CTA, hairline post rows, status dot+label.
- Bottom bar shows 5 tabs incl. Create (plus icon).

## Behaviour / logic
- `postStatusMeta(status)` → { label, tone } for submitted/approved/rejected/draft
  (pure, unit-testable) using the IG tones.
- Ledger loads via `getMyPosts()`; empty + error states handled.
- New Post / Try again / empty-CTA all open `PostComposer`; composer submit returns to
  `CreateMain`.

## Tests
- Mobile jest: unit test for `postStatusMeta`; module-load smoke incl. `CreateScreen`.
- **Maestro (Rule-5 gate):** open Create tab → ledger renders → tap New Post → composer.

## Non-regression
- Full mobile jest green.
- No prior Posts entry point broken (CampaignProducts CTA, composer return path).
