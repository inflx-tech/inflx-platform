# 06 — Before / after notes

## D1/D2/D3 — one cookie writer

`Packages/brand-web/lib/api.js`

- Added `SESSION_MAX_AGE` (30 days) and an exported
  `setSessionCookie(token)` that writes
  `path=/; max-age=2592000; SameSite=Lax` plus `Secure` on https.
- `tryRefreshToken()` now calls it instead of writing
  `max-age=900; SameSite=Strict` inline. **This single line is the
  bug** — it downgraded a 30-day cookie to 15 minutes on every
  dashboard mount.

Call sites converted:

| File | Was |
|---|---|
| `app/login/page.js:199` | 30d, `SameSite=Strict` |
| `lib/api.js:49` | **900s**, `SameSite=Strict` |
| `app/dashboard/layout.js:56` | 30d, no SameSite |
| `app/admin/layout.js:104` | 30d, no SameSite |

`clearSession()` is unchanged — expiring by name + path does not
depend on the other attributes.

## L1 — landing page

`Packages/brand-web/app/page.js`

- Added a `session` state resolved in `useEffect` from
  `inflx_token` + `inflx_user`. Mapped to `{href, label}` for `brand`
  → `/dashboard` and `admin` → `/admin`; `influencer` / `follower`
  deliberately fall through to the signed-out CTAs because they have
  no web surface.
- Three CTA clusters branch on it: navbar, hero, and the Brand
  Dashboard block (whose sub-copy also changes to "You're already
  signed in on this browser").
- `goHome` guards on `session` even though it only renders when
  truthy.

Resolved after mount so the server-rendered HTML is identical for
every visitor — no hydration mismatch, and signed-out users never see
a flash of the signed-in state.

## Behaviour deliberately changed

Middleware will now admit a user whose refresh token has genuinely
expired; they get bounced by `clearSession()` on the first failed API
call instead of at the door. Argued in `05-impact.md` — the gate is a
hint, and blocking genuinely-authenticated users is the worse failure.

## Not captured as screenshots

The failing state requires waiting out a 15-minute cookie or arriving
via a cross-site navigation, neither of which a Playwright shot of the
live URL reaches without staging the clock. The mockup at
`04-preview/mockups/landing-session-cta.html` shows the landing CTA
swap plus the four-writer cookie table. Recorded deliberately.

## QA

`pnpm qa` **GREEN — 79 passed, gate 0**, including the role-gate
matrix (M1/M3/M5) which asserts the no-cookie redirect still fires.
