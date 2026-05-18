# Feature Spec — Admin navigation sweep

> Contract A5 of Area A. Step 2. Implementation GATED on
> `lock.json.approved = true`.

## Problem / goal
A1–A3 cover two admin pages deeply. The other ~16 admin pages have
zero coverage — a broken import, a render-on-empty-data crash, or an
accidental gate regression on any of them ships silently. A5 is the
**wide, shallow regression net**: every admin sidebar route must
mount under the admin shell for an authenticated admin without
redirecting or crashing.

## Scope
- In scope: the **18 static admin routes** linked from the sidebar
  `NAV` in `app/admin/layout.js` (verified to have a `page.js`):
  `/admin`, `/admin/analytics`, `/admin/approvals`, `/admin/brands`,
  `/admin/influencers`, `/admin/production-queue`,
  `/admin/master-dishes`, `/admin/marketing/{leads,add,
  verifications,invitations,inbox,funnel,settings}`,
  `/admin/escrow`, `/admin/payouts`, `/admin/settings/payments`,
  `/admin/users`.
- Out of scope: dynamic routes (`/admin/brands/[id]`,
  `/admin/influencers/[id]`, `/admin/marketing/leads/[type]/[id]`) —
  need real IDs; their own contract later. No actions/mutations —
  **read-only navigation only** (important: marketing routes touch
  the autonomous marketing-engine subsystem; this contract performs
  GET navigation only, never triggers its workflows).

## Surfaces touched (verified)
- `Packages/brand-web/app/admin/layout.js` (shell + `NAV`)
- 18 `app/admin/**/page.js` files (read-only render)

## Data / contracts
No API behaviour under test. A **permissive API stub**
(`**/v1/**` → `{success:true,data:[],meta:{}}`) is installed so
pages render their empty state without a live backend.

> **Revision v0.2.0 (2026-05-18):** v0.1.0 stubbed `data:{}`. The
> first run proved (via `/admin/approvals`, known-good from A1) that
> an empty *object* falsely short-circuits the pages' reasonable
> `res.data?.<key> || res.data || []` fallback into a non-array,
> causing 6 false `entries.map is not a function` failures. No real
> backend returns `data:{}`. Corrected to `data:[]` — pages with a
> fallback resolve to an empty array; pages with NO fallback still
> fail honestly (preserved signal).

## Non-functional
- Deterministic; seeded admin via `_helpers/adminSession`.
- "Reachable" defined precisely in 02-workflow: **(a) not gated out
  to /login, (b) route resolves server-side (HTTP < 400)**.

> **Revision v0.3.0 (2026-05-18):** v0.2.0 also asserted (c) "zero
> uncaught page errors". That promoted a *navigation* breadth-net
> into a *per-endpoint data-robustness audit*, which cannot be sound
> under one uniform stub (array-shaped vs object-shaped endpoints are
> mutually exclusive). (c) removed from the breadth net. The 3 pages
> that genuinely crash on a realistic empty payload
> (`/admin/analytics`, `/admin/marketing/leads`,
> `/admin/marketing/funnel`) are NOT dropped — they are tracked as
> real findings in **`features/admin-data-robustness/` (A5b)** for
> app-code micro-contracts. Surfaced, not hidden.
