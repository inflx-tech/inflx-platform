# 06-diff — billing-feature-search-advanced (A12.3)

**Before:** every brand could pass `tier` (influencer-tier band like
nano/micro/macro/mega) and `min_er` (minimum engagement-rate threshold)
to the influencer search endpoints. Even Free-tier brands had access to
the most powerful filters — there was no monetization moat on
"advanced" search beyond the discovery scope (city/state/all_india)
that A12.2 already gates.

**After:** the two advanced query params are gated behind the
`search_filters_advanced` catalog feature. Default tier mapping (from
M061):
- Free: NOT included → 422 FEATURE_NOT_AVAILABLE if brand passes tier or min_er.
- Growth / Pro / Enterprise: included → free to use advanced filters.

The basic filters (q, niche, city, gender) stay open to every tier — no
brand loses ability to find influencers, they just can't slice by tier
band or engagement rate without upgrading.

**Defensive fail-open (matches A12.2 pattern):**
- Feature not enforced (M064 not run) → `hasFeature` returns true → gate is a no-op.
- No advanced filter param in the query → gate is a no-op.
- Brand has the feature → gate is a no-op.

**Error envelope:**
```json
{ "code": "FEATURE_NOT_AVAILABLE",
  "message": "Advanced search filters (tier, min_er) are not available on your current plan. Upgrade to use them.",
  "field": "search_filters_advanced",
  "details": {
    "feature_key": "search_filters_advanced",
    "blocked_params": ["tier", "min_er"],
    "upgrade_to": ["growth", "pro", "enterprise"]
  } }
```

The shape matches the `details.upgrade_to` array that QuotaWallModal
already consumes — extending the modal to recognise
`FEATURE_NOT_AVAILABLE` alongside `QUOTA_EXCEEDED` is a small follow-up
(currently `isQuotaError` only checks `QUOTA_EXCEEDED`).

**Frontend UI hide is intentionally NOT in this contract.** The
influencer-search filter panel lives inside
`/dashboard/campaigns/new/page.js` (2275 lines, Window B redesign
territory). Backend gate is the source of truth; UI polish to hide
the filter inputs based on the brand's entitlements can ship later
without changing the gate behaviour. Today a Free brand who passes the
filters will see a real error response — the existing error toast on
the page will show the message.

**Verified locally:** entitlements.service.hasFeature returns true
when is_enforced=false, false when admin's tier_features row says
`included=false`. M064 applied to dev DB; sanity probe shows
search_filters_advanced.is_enforced=true. Backend boot smoke clean.
