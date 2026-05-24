# Impact — billing-brand-ui (Phase A7-brand)

## Changes
- 2 new brand-web pages.
- 1 new reusable modal component.
- 4 new brand-side API client methods.
- 2 new nav entries in dashboard layout.
- 1 new Playwright spec (2 tests).
- 1 new contract folder.

## Blast radius
- No existing pages modified except `layout.js` (NAV array, append-only).
- Backend untouched (endpoints already in A6).
- Mobile untouched.
- Window B collision risk: `layout.js` is on the §9 coordination list — appended at-tail per the documented convention. Window B will restyle the nav rendering later; the entries themselves stay.

## Rollback
Revert the commit. No DB rollback. Vercel redeploys the prior image automatically on next push.

## Risk
- **Quota-wall modal not wired into any existing page in this commit.** Backend still returns 422 QUOTA_EXCEEDED; without wiring, pages show a generic error toast. Wiring is a per-page follow-up to avoid Window B file collisions. Founder will wire as design lands.
- **Mock-mode upgrade writes a paid invoice without real money.** Safe today (`RAZORPAY_MOCK=true` on prod per env audit at session start). When founder flips to live mode without first wiring A6.5, the upgrade endpoint returns `501` — page surfaces the error banner.
- **Tiers list visual layout** — 4-tier grid assumes ≤4 tiers fit in the row. If admin adds a 5th tier via /admin/pricing/tiers, the grid wraps. Acceptable until founder restyles.

## Pre-push checklist
1. pnpm qa GREEN with the 2 new specs (target 73/73).
2. gov-check exit 0 (Rule 1 + Rule 3 mockup_locked + Rule 4 06-diff).
3. No backend code touched → no Render impact, but Render redeploys harmlessly.
