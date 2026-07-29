# 01 — Spec: brand-status-surface-fixes

Founder-reported brand-flow defects, plus two adjacent ones found
while verifying them. All in `Packages/brand-web`.

## S1 — the account-status banners never render

`app/dashboard/layout.js:78` read `brand?.status`. `GET /brands/me`
returns the status as **`user_status`**
(`backend/src/controllers/brand.controller.js:184`, SQL at `:31-39`
aliases `u.status AS user_status`), because **`brands` has no
`status` column** — the enum lives on `users`
(`001_initial_schema.sql:12`).

`brand.status` was therefore always `undefined`, so `brandStatus`
stayed `null` and neither the pending nor the rejected banner could
ever render, in any account state. Duplicated at
`app/dashboard/page.js:161-163`.

Three sibling pages already read it correctly
(`b?.user_status || b?.status`), so this is drift, not a
misunderstanding. Root of the confusion: the **admin** endpoint
returns the same column unaliased as `status`
(`admin.controller.js:1322-1324`) while the **brand** endpoint
aliases it. One column, two names.

## S2 — approved brands told they are "under review"

Two gated pages defaulted to `'pending'` when `/brands/me` returned
anything other than success:

- `app/dashboard/influencers/page.js:567`
- `app/dashboard/campaigns/new/page.js:510`

They **fail closed onto a factual claim**. On a cold reload the
dashboard fires ~9 concurrent requests against a possibly-expired
token; `lib/api.js:85-88` deliberately returns `UNAUTHORIZED` without
clearing the session, so an approved brand gets "Account Under
Review". Gating is correct; asserting *why* is not.

## S3 — nameless "Welcome back"

`app/dashboard/page.js:124` calls `setLoading(false)`
**unconditionally**, before the success check. A failed `/brands/me`
left `brand` null and rendered the greeting with no name and **no
error** — indistinguishable from a normal load.

The founder's hypothesis (a login-cached value vs a `/me` refetch)
is refuted: the name comes from the same live fetch on both paths.
Same root cause as S2.

## S4 — two nav tabs highlighted at once

`app/dashboard/layout.js:115` —
`pathname === item.href || pathname.startsWith(item.href + '/')`.
NAV item 0 is `/dashboard`, a prefix of all 11 sub-routes, so
Dashboard stayed lit alongside the real tab. The sibling admin nav
already carries the missing guard (`app/admin/layout.js:187`).

Secondary, same line: Settings links to
`/dashboard/settings/profile`, so it did not highlight on
`/settings/billing` or `/settings/subscription`.

## S5 — contact name stuck as the placeholder (adjacent)

`app/login/page.js:251` read `meRes.data?.user`. `/brands/me`
returns `{ brand, user_status }` — **no `user` key** — so the write
never happened and `inflx_user` kept the literal `'Brand User'`
placeholder sent during verify-otp (`login/page.js:128` →
`auth.controller.js:111`). The real contact name arrives on the
brand row as `name` (aliased from `users.name`).

## S6 — signup is not resumable, and a refresh costs an OTP

All wizard state is plain `useState` with no persistence, and the
page has no mount effect that inspects an existing session. A
refresh resets `step` to `'phone'` and loses every field. Recovery
re-sends a real OTP against a limit of **5 per phone per hour**
(`backend/src/app.js:93-105`), so a few refreshes lock the user out.

This is exactly the founder's reported scenario: a wrong Google Maps
link, a refresh to fix it, and an unrecoverable trip back to the
phone screen.

## S7 — Places search gives no feedback (the reported "not working")

**Not a wiring bug.** Verified live from the `https://inflx.in`
origin: CORS passes and the endpoint returned 5 real predictions —
but the **first call took >30s and timed out; the second took
8.2s**. Render cold-starts.

`onLocQueryChange` had no loading state, no timeout, no error branch
and no stale-response guard, and `places.service.js` answers `200`
with `[]` for a missing/rejected key as well as a genuine no-match.
So a slow or failed lookup was indistinguishable from a dead field —
the user types and nothing ever happens.

The Maps-link path "works" partly because it needs no Google key at
all (coordinates are regexed out of the URL) and partly because it
has a button with a visible spinner, so the user waits out the cold
start.

Adjacent in the same function: state autofill silently dropped for
`&`-vs-`and` names ("Jammu and Kashmir" vs `'Jammu & Kashmir'`).

## S8 — Shopping & Retail business type (founder-directed)

Founder's decision: rather than a multi-select plus a new column,
collapse Shopping & Retail to **one** fashion business type.
Verified this is sound — `backend/public/schemas/fashion.json`
already carries `Footwear`, `Jewellery`, `Accessories` and `Bags` as
sections, and is the richer schema (`returns`, `availability`,
`master_catalogue`, `super_category`) versus the thinner standalone
`footwear.json` / `jewellery.json`.

`category` stays a single key resolving a single schema, so the
listing engine, the Meals/Bookings nav gates and the CTA spec are
untouched. No migration.

**Stated tradeoff:** a dedicated footwear brand loses the granular
sections (Men's Casual / Formal / Sports / Kids / Sandals) and gets
one "Footwear" section; jewellery loses Gold / Diamond / Silver /
Watches / Bridal Sets. Existing brands already on those categories
keep their own schemas — only new signups are affected.

## Out of scope

- The underlying cold-reload 401 race (S2/S3's shared cause) is
  mitigated here by honest messaging, not fixed. A proper fix means
  gating the dashboard's fetch fan-out behind the refresh, and
  deserves its own contract.
- The identical business-type list in
  `Packages/Mobile/src/screens/auth/BrandRegisterScreen.js:30` is
  **not** changed — Mobile-governed, needs a Maestro run.
- `industry` is still collected in the UI and never sent (no column
  exists on `brands`). Pre-existing; not introduced here.
