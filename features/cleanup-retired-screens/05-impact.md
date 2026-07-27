# Impact — Cleanup

## One-line verdict
**Frontend-only, mobile-influencer, OTA — zero behaviour change (dead-code deletion).**

## What changes
- Deletes 7 unreachable screen files.
- Removes their imports + Stack.Screen registrations from `InfluencerNavigator`.

## Blast radius
- No API, no native module, no kept-screen import affected → **OTA only**.
- Routes already repointed in prior contracts; the deleted screens were unreachable.

## Risks & mitigations
- A missed live reference → caught by the full jest run + the metro bundle at OTA + the
  pre-delete grep (only BrandNavigator matched, and only a different brand screen).

## Release classification
**Production-impacting via OTA** (bundle shrinks; no behaviour change) → surfaced for
explicit founder go. Maestro skippable on founder call (recorded).
