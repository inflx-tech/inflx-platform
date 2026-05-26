# 06-diff — billing-feature-bulk-outreach (A12.4)

**Before:** any approved brand could publish an open-group campaign
set, which materializes campaign_influencer rows for every matching
influencer in one shot and fires push notifications to all of them.
This is the "bulk outreach" action — high-value, monetization-worthy.
Free-tier brands had unfettered access.

**After:** the `publishOpenGroup` endpoint gates on the `bulk_outreach`
catalog feature. Default tier mapping (M061 seed):
- Free: NOT included → 422 FEATURE_NOT_AVAILABLE.
- Growth / Pro / Enterprise: included → publish proceeds.

Free brands can still build open-group sets (it's just a configuration
step) and use the handpick path (single invites, gated by the existing
invitations_per_cycle quota from A12.1). They just can't blast the same
set to many influencers via the bulk-publish flow.

**Reusable helper:** `entitlements.service.requireFeature(client, brandId, featureKey, opts)`. This is the DRY pattern for future boolean gates. A12.5 + A12.6 will use the same helper. The previous boolean gates (search_filters_advanced in A12.3) used inline logic — they could be refactored to the helper later, but the gate behaviour is identical.

**Error envelope:**
```json
{ "code": "FEATURE_NOT_AVAILABLE",
  "message": "Bulk influencer outreach is not available on your current plan. Upgrade to use it.",
  "field": "bulk_outreach",
  "details": {
    "feature_key": "bulk_outreach",
    "upgrade_to": ["growth", "pro", "enterprise"]
  } }
```

**Defensive fail-open (matches A12.2/A12.3 pattern):**
- Feature not enforced (M065 not run) → `hasFeature` returns true → gate is a no-op.
- Brand has feature → gate is a no-op.

**Frontend UI hide is intentionally NOT in this contract.** The
publish-open-group button lives inside the campaigns/new wizard
(Window B redesign territory). Backend gate is the source of truth;
showing/hiding the button based on entitlements is a small follow-up
(separate UI polish contract).

**Verified locally:** entitlements.service.requireFeature throws when
appropriate + returns silently when not. M065 applied to dev DB;
sanity probe shows bulk_outreach.is_enforced=true. publishOpenGroup
boot-loads clean; the gate fires before brand-ownership branches that
were already in place.
