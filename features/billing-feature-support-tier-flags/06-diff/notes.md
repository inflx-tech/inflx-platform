# 06-diff — billing-feature-support-tier-flags (A12.7)

**Before:** the admin Features page (`/admin/pricing/features`) showed
the 13-row catalog with 9 rows flagged `enforced=yes` (the A12.1–A12.6
features post-M062 through M067) and 4 rows flagged `enforced=no`:

- `self_serve_onboarding` (baseline — every tier; intentionally
  unenforced because there's no code path that would gate it)
- `dedicated_onboarding_call`
- `phone_support_24x7`
- (A12.6's `multi_branch_support` was the previous "still enforced=no"
  row until M067 applied this session)

For `dedicated_onboarding_call` and `phone_support_24x7`, the `no`
badge implied "this feature has a code gate that is currently
disabled" — which was misleading. Both features are
**human-delivered support tiers**: an onboarding call from the INFLX
team for Pro/Enterprise sign-ups, and a 24x7 phone hotline for
Enterprise. There is no software gate; the catalog row exists to
drive the per-tier inclusion bullets on the brand-facing
Subscription page. The previous `enforced=no` badge made the catalog
look incomplete.

**After (A12.7 + M068):** both rows now show `enforced=yes`. The
catalog accurately states "all 10 software-enforceable rules are
live; the baseline self-serve onboarding stays informational by
design". The previously-misleading `enforced=no` on the two support
features is corrected.

**Catalog state after this contract closes:**

| Feature                       | Type     | is_enforced |
|-------------------------------|----------|-------------|
| discover_filter               | config   | true (A12.2 / M063) |
| search_filters_advanced       | boolean  | true (A12.3 / M064) |
| bulk_outreach                 | boolean  | true (A12.4 / M065) |
| invitations_per_cycle         | quota    | true (A12.1 / M062) |
| open_group_broadcast          | config   | true (A12.5 / M066) |
| active_campaigns              | quota    | true (A12.1 / M062) |
| sets_per_campaign             | quota    | true (A12.1 / M062) |
| products_in_store             | quota    | true (A12.1 / M062) |
| media_gallery_items           | quota    | true (A12.1 / M062) |
| multi_branch_support          | boolean  | true (A12.6 / M067) |
| **dedicated_onboarding_call** | boolean  | **true (A12.7 / M068)** |
| **phone_support_24x7**        | boolean  | **true (A12.7 / M068)** |
| self_serve_onboarding         | baseline | false (intentional — baseline, no gate possible) |

**Why `self_serve_onboarding` stays `enforced=no`:** it's the
catalog's `feature_type='baseline'` row — included on every tier by
definition, no possible gate (you can't block someone from
self-onboarding when they're already onboarded). Leaving it
`enforced=no` is correct and intentional; flipping it would be
misleading in the opposite direction.

**Zero behaviour change** for brand-facing or admin runtime paths.
The two flips are visible only on the admin Features list as the
"Enforced" column changing badge state.

**Defensive fail-open is moot** — there's no gate, so there's
nothing to fail-open from. The flag is purely descriptive.

**Verified locally:** sanity probe shows both rows is_enforced=true
after M068; backend boots clean (no code change); pnpm qa baseline
unaffected.
