# Feature Spec — Proposal filters on mobile

> Closes the last "adjust filters on the web dashboard" bounce from the locked
> brand-mobile scope (only campaign creation + listing are web-only).

## Problem / goal
The mobile proposal inbox said *"✓ Accepting proposals · Adjust filters on the web
dashboard."* — the criteria that gate who may pitch a brand could only be edited on web.

## Scope
**In scope**
- `components/brand/ProposalFiltersSheet.js` — editor for min tier, allowed niches,
  minimum engagement rate, same-city-only, past-collaborators-only.
- Posts the **exact payload the web panel posts**: `{ accepts_proposals, proposal_filters:
  { min_tier, allowed_niches[], city_match_required, min_engagement_rate, only_past_collabs } }`
  (read from the web implementation + the backend controller, not guessed).
- Inbox: a **Filters** action opens it; the web-dashboard sentence is gone.

**Out of scope**
- New filter dimensions beyond what web supports (parity, not expansion).

## Surfaces touched
- Mobile (brand) only — OTA. No web, no backend (`updateProposalSettings` already exists).

## Non-functional
- ER validated 0–100 client-side; `accepts_proposals` preserved on save (not toggled).
