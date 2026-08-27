# Impact Analysis — admin-people-pipeline

> Written after implementation (founder requested "lock it, start
> implementation" in one go) — reviewed against the lock retroactively
> rather than gating Step 7 on it. Content reflects what actually
> shipped, verified against the diff, not a pre-implementation guess.

## Affected files (read or change)
- **web (brand-web admin only):** `app/admin/layout.js`,
  `app/admin/influencers/page.js`, `app/admin/influencers/[id]/page.js`,
  `app/admin/brands/page.js`, `app/admin/brands/[id]/page.js`,
  `app/admin/approvals/page.js`, `app/admin/marketing/{leads,add,
  verifications,invitations}/page.js` (now redirect stubs).
- **backend:** `src/controllers/creatorVerification.controller.js`
  (`verify`/`reject` — no route/path change, only what each writes).
- **mobile:** none.
- **migrations:** none — both fields written by the backend change
  (`creator_profiles.verification_status`, `users.status`) already
  existed pre-contract.

## Affected routes / APIs
| Method | Path | Change | Consumers |
|---|---|---|---|
| POST | `/admin/creator-verifications/:id/verify` | now also writes `influencers` + `users.status` in the same transaction | Influencers → Pending Verification tab |
| POST | `/admin/creator-verifications/:id/reject` | now also writes `influencers` + `users.status` (previously untouched — was the actual bug: rejected claims stuck at `pending` forever) | same |
| PATCH | `/admin/influencers/:id/status` | unchanged on the backend; zero frontend call sites remain (grepped post-change) | none (orphaned intentionally) |
| PATCH | `/admin/brands/:id/status` | unchanged on the backend; `suspended` transition now has no UI entry point | none (orphaned intentionally — see below) |

## Affected workflows (regression surface)
- Admin approving/rejecting a brand or influencer signup — covered by
  `qa/web/admin/approvals.spec.ts`, `approvals-reject.spec.ts`,
  `role-gate.spec.ts`, `nav-sweep.spec.ts`, `data-robustness.spec.ts`
  (5 files, 13 tests retargeted to the new URLs/headings; assertions
  on PATCH bodies / disabled states / reason-required unchanged).
- Nothing on the follower or mobile side touches these routes.

## Migration / deploy / OTA impact
- No migration. No mobile JS. **Backend + web only → push redeploys
  Render (backend) + Vercel (brand-web) — production-impacting.**

## Risk notes
- **Suspend, for an already-approved brand, currently has no button
  anywhere.** The backend endpoint still accepts it, but nothing in
  the locked mockups gave it a home once the inline Live-tab modal was
  removed. Not destructive by itself, but it's a real capability gap
  a founder should consciously accept or ask for a follow-up on.
- **Bulk CSV lead import lost its UI entry point** — same reason,
  the locked mockup only showed single-intake. Single-lead add still
  works.
- `PATCH /admin/influencers/:id/status` and `/admin/brands/:id/status`
  are left live on the backend but unreachable from any button —
  inert, not a security exposure (still capability-gated), just dead
  weight worth remembering if someone later wonders why an endpoint
  with no caller exists.
- No data backfill needed — the reject-path fix only changes what
  happens on *future* rejects; past rejected creators whose linked
  `users.status` is stuck at `pending` are not retroactively touched
  by this change (worth a one-off cleanup query if that backlog
  matters, not included here since it wasn't asked for).
