# Diff notes — _demo-preview (worked example)

This is a worked example of what the agent writes here for a real
shipped feature. It looks back retrospectively at what Q1 (follower
public browse) and Q3 (search verified tag) actually shipped vs the
mockups in `04-preview/mockups/`.

## What was implemented

For Q1, `backend/src/controllers/follower.controller.js#getFeed`
(lines 299–305) was rewritten to mirror the proven `getHomeFeed`
anonymous pattern: `follower = req.user?.sub ? await
getFollowerByUserId(...) : null`; `city = follower?.user_city ||
req.query.city || null`. The catching test in
`backend/tests/follower-feed.test.js` was realigned to the founder-
confirmed product contract (anon + `?city=Vijayawada` → 200 +
location-based feed). Shipped in commit `bfcd788`, 2026-05-19.

For Q3, migration 055 made `v_searchable_creators` approval-aware
on `is_inflx_verified` (was hardcoded TRUE for all onboarded;
now `(u.status = 'approved')`) + `internal_verification_status =
u.status::text`. `influencer.controller.js` search added an
additive `is_verified` field per result. Pending creators stay
visible in search but correctly carry `is_verified: false`.
Shipped in the same `bfcd788` commit.

## What matches the locked mockup

- `01-follower-public-browse.html` — header layout (logo, city
  selector), 3-deal-card feed structure, "Browsing as guest" amber
  banner, sticky sign-in CTA at the bottom. The actual follower
  app implementation mirrors this layout faithfully (same hierarchy,
  same primary CTA placement).
- `02-search-with-verified-tag.html` — top nav, filters row,
  Verified ✓ badge styling on registered+approved creator cards,
  Discovered/scraped cards with no Verified tag + "Invite to
  join INFLX" link. The brand-web `app/influencers/search/page.js`
  uses `data.creators` with `is_verified: true/false` exactly as
  shown in the mockup.

## What diverged from the mockup (and why)

- **`is_verified` field name** — the mockup conceptually shows a
  "Verified" badge, and the brand-web component renders it that
  way. The backend field is literally `is_verified` (additive
  string in the controller's `creators.map` projection). This
  matches the mockup intent; the implementation chose a clean
  boolean name. No semantic divergence.
- **Pending influencer name in search fixture** — discovered
  during P12: `register` requires `name` and the test fixture
  didn't provide one for pending influencers. Fixed in the same
  PR (class-1 stale-fixture; not a contract change). Not visible
  in the UI.

## Things the founder should specifically check

- The "Invite to join INFLX" link on Discovered cards — **the
  invite workflow itself is NOT built**; that's the recorded
  future feature ("notify scraped creator when a brand picks
  them"). The button is currently a no-op placeholder. Worth
  surfacing on a real shipped Q3-style feature so the founder
  doesn't assume the invite works yet.
- City search empty-state: when no creators match the city, the
  search returns `creators: []` and the UI shows "No creators in
  &lt;city&gt; yet" — not in the mockup, but a sensible default.

## Out-of-band changes

For Q2 + Q3, one extra correction landed:
`influencer.controller.js` search city filter became case-
insensitive (`LOWER(city) = ANY(...)` with the param lowercased).
This was outside the original Q2 spec but verify-twice during
qa:db caught that the migration alone was insufficient (city is
stored mixed-case in `users.city`). Surfaced in the original Q2
fix-contract release notes; not silent.

---

*Note: this is a permanent showcase. The `_` prefix slug excludes
this contract from any production change. The "after" panels in
`pnpm diff:open _demo-preview` will show placeholders because no
`*.capture.json` siblings exist for the demo mockups — that's
intentional, not a bug.*
