# 06 — Before / after notes

## S1 — status key

`app/dashboard/layout.js:78` and `app/dashboard/page.js:161-163`

- Before: `brand?.status` → always `undefined`.
- After: `res.data?.user_status || brand?.user_status || brand?.status`.

Visible change: the pending and rejected banners render for the
first time. Nothing else on the page moves.

## S2 — fail-closed defaults

`app/dashboard/influencers/page.js` · `app/dashboard/campaigns/new/page.js`

- Before: `else setBrandStatus('pending')` — a failed request was
  reported to the user as a pending account.
- After: `else setBrandStatus('unknown')`, with a distinct heading
  ("Couldn't check your account"), body copy and a Retry button.

Access is gated identically in both versions. Only the claim changes.

## S3 — silent dashboard failure

`app/dashboard/page.js`

- Before: `setLoading(false)` fired unconditionally; a failed
  `/brands/me` rendered a nameless "Welcome back" with no error.
- After: `setBrandError(!br.success)` and a red strip under the
  greeting with a Retry.

## S4 — nav active state

`app/dashboard/layout.js:115`

- Before: `pathname.startsWith(item.href + '/')` lit Dashboard on
  every sub-route.
- After: exact-match for `/dashboard`, prefix-match for the rest,
  plus an optional `match` key so Settings covers all three of its
  sub-pages.

## S5 — contact name

`app/login/page.js` — read `meRes.data?.user` (a key `/brands/me`
does not return) → now merges `brand.name` and `user_status` into
the stored user.

## S6 — signup draft

`app/login/page.js` — new `DRAFT_KEY` mirror of the register-step
fields, restored on mount **only when a token already exists**,
cleared on successful register, with a "we kept what you had"
notice. A refresh no longer resets the wizard or triggers a second
OTP.

## S7 — place search feedback

`app/login/page.js` — new `locState` (`idle | searching | empty |
error`) rendered under the input, plus a monotonic `locSeqRef` that
discards out-of-order responses. `applyPlace` now normalises `&`
vs `and` when matching state names.

## S8 — business type

Shopping & Retail collapsed from nine options to one
(`fashion`). Other industry groups untouched.

## Not captured as screenshots

These are conditional states — a pending account, a failed fetch, a
cold-start search — that a Playwright capture of the live URL cannot
reach without fabricating the failure. The mockup at
`04-preview/mockups/brand-status-surfaces.html` renders all of them
before/after side by side. Recorded deliberately, not left silent.

## QA

Initially **RED** — 2 failures in
`qa/web/admin/approvals-reject.spec.ts`, which asserted the
`rejection_reason` key that the backend 422s on. Classified as
**assertion drift** and corrected to `reason`. Re-run: **GREEN, 79
passed, gate 0.**
