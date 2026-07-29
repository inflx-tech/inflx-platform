# 05 — Impact

**Verdict: makes four surfaces tell the truth for the first time,
and stops a refresh from costing an OTP. Visual + UX only — no
schema, no API contract, no data written.**

## Mechanics

- **Schema / migrations:** none.
- **API contract:** none. Every fix reads keys the API already
  returns.
- **Data:** one new device-local key,
  `localStorage['inflx_brand_signup_draft']`, cleared on successful
  register. Nothing server-side.
- **New behaviour that can be seen:** the pending / rejected banners
  (they have never rendered), the `'unknown'` status state, the
  place-search feedback states, and the signup-restore notice.
- **Behaviour removed:** eight business-type options under Shopping
  & Retail. Existing brands on those categories are untouched and
  still resolve their own schemas; only new signups are constrained.

## Risk

Low, with three honest caveats:

1. **Banners appearing is itself a visible change.** Unapproved
   brands who previously saw a clean dashboard will now see a
   pending notice. That is the intent, but it will look like "new
   UI" rather than "a fix".
2. **Gated pages fail closed onto `'unknown'`.** If `/brands/me` is
   flaky, an approved brand still cannot reach Influencers or
   Campaign-create — same as today. Only the wording improves. The
   underlying cold-reload 401 race is explicitly out of scope.
3. **The signup draft is device-local and unencrypted.** It holds
   business name, address and phone — no OTP, no token. Cleared on
   successful register, but it does persist on an abandoned signup.

## QA classification

`pnpm qa` initially went **RED** on
`qa/web/admin/approvals-reject.spec.ts` (2 failures). Classified as
**assertion drift, not a regression**: those tests stub the admin
API and assert only the captured request body, so they asserted
`rejection_reason` — the exact key the real backend 422s on — and
stayed green while every production reject failed. The assertions
were corrected to `reason`, the key verified in
`admin.controller.js:97`. No test was skipped, deleted or weakened.

Worth noting for the backlog: a stubbed-body assertion cannot catch
a frontend/backend key mismatch. That class of test is why this bug
survived.

## Classification

**Production-impacting** — `Packages/brand-web/app/**` → Vercel.
No backend, no migration, no OTA. Explicit founder go required
before push.
