# Before / After — proposal filters on mobile

**Before:** the inbox bar read *"✓ Accepting proposals · Adjust filters on the web
dashboard."* — proposal criteria were web-only, contradicting the locked scope rule.

**After:** a **Filters** action opens `ProposalFiltersSheet` — min tier, allowed niches,
minimum engagement rate, same-city-only, past-collaborators-only — writing the **exact same
payload the web panel writes** (`proposal_filters: { min_tier, allowed_niches,
city_match_required, min_engagement_rate, only_past_collabs }`), verified against both the
web implementation and the backend controller. The web-dashboard sentence is gone.

## Verification
- Mobile jest **105/105 green** (23 suites).
- `accepts_proposals` is preserved on save (the sheet edits filters only).

## Known delta
- Niche options are a fixed vocabulary matching the web chips (no live taxonomy yet).
