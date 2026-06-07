# Impact — Restaurant edit surfaces

## Terse verdict
**Wave 1 (shipped): pure backend read-fix, zero behavioural risk** — the quality score
now reflects the profile that was already saved; nothing else changes. **Wave 2: real
data-integrity + UX fixes** (stop silent save-failures, build-while-pending, two doors,
blank dish photos, free location) — UI-governed, mockup-locked, founder-verified.

## Wave 1 blast radius
- One function (`calculateQualityScore`). Read-only. No writes, no schema, no migration.
- Risk: a rule could now earn where it didn't (that's the fix). Proven non-regressive by
  `pnpm qa` GREEN 79/79. Rollback = revert one commit.

## Wave 2 blast radius (planned)
- **Silent-failure fix** touches `lib/api.js`/`publishDriver.js` — must not break existing
  success paths (only adds honest error handling). Highest value: prevents data loss for
  every vertical.
- **Gate removal** is security-adjacent — MUST be paired with the follower-visibility
  guard, else a pending brand could leak. Treat as production-impacting; verify-twice the
  follower read paths before shipping.
- **Two-door + dish-capture + location** are UI/UX; mockup-lock + before/after-diff apply.

## Open items for Wave 2 lock
1. Reliable "returning vs first-time" signal (profile-complete flag from listing-config).
2. Exact follower read paths to guard (resolveBusinessStore, resolveCategoryStore, section
   brand rules) — confirm each excludes `status != 'approved'`.
3. Whether master suggested-price may pre-fill the price input as an overridable hint.
