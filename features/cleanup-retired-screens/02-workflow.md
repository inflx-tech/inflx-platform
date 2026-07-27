# Workflow Definition — Cleanup: retire superseded screens

## Actor
Influencer (unchanged app).

## Preconditions
Wave-1 replacements shipped (collabs-list, collab-detail, create-tab, home-restyle,
deliverable-consolidation, tracking-social).

## Workflow steps (user-observable)
1. App behaves EXACTLY as before this change — the deleted screens were already
   unreachable; every entry point resolves to its live replacement.
2. Collabs list/detail, Create, Deliverable (unified), Tracking all open as before.

## Success definition
- The 7 files are gone; `InfluencerNavigator` has no import/registration for them;
  the app builds + all mobile jest passes; no navigation path is broken (every route a
  live screen targets still resolves).

## Failure / edge workflows
- N/A — deletion of unreachable code. If any route did still target a deleted screen it
  would be a build/nav error caught by jest module-load + the metro bundle.
