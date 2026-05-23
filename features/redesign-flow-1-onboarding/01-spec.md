# Spec — Redesign Flow 1 · Brand onboarding

## Why this flow

First-touch surface for every new brand. Locked white + yellow design
system stress-tested on the smallest meaningful flow that exercises
every primitive (button, input, OTP, status banner, alert, modal-free
card, status-page). Pure visual + UX redesign; **zero functional
disturbance** to the existing onboarding workflow.

## Scope — in

**Web** (3 surfaces)
- `Packages/brand-web/app/login/page.js` — 3 step states (phone → OTP → register)
- `Packages/brand-web/app/rejected/page.js` — rejection + resubmit
- `Packages/brand-web/app/dashboard/page.js` — *only* the pending + rejected status banners (≈14 lines, the rest of the dashboard waits for its own flow)

**Mobile** (5 screens — shared across all 3 Android flavors)
- `Packages/Mobile/src/screens/auth/PhoneScreen.js`
- `Packages/Mobile/src/screens/auth/OTPScreen.js`
- `Packages/Mobile/src/screens/auth/InfluencerRegisterScreen.js`
- `Packages/Mobile/src/screens/auth/WaitingScreen.js`
- `Packages/Mobile/src/screens/auth/RejectedScreen.js`

**Shared** (2 new files)
- `Packages/shared/components/Logo.js` — web Logo placeholder component
- `Packages/Mobile/src/components/Logo.js` — RN Logo placeholder component
- Both default-render a dashed `[LOGO]` placeholder; swap to `<img>` when the founder uploads the real asset under `Packages/shared/assets/logo/`

**Tokens** (additive only)
- `Packages/Mobile/src/theme/tokens.js` — extend `lightColors` with the locked palette keys if missing. Existing keys untouched.
- `Packages/brand-web/tailwind.config.js` — **not touched** for Flow 1; arbitrary Tailwind values used inline (`bg-[#FFC107]`, etc.). Token consolidation defers to its own contract.

**QA** (honest re-baseline)
- `qa/web/brand/auth.spec.ts` — copy assertions updated to match new copy ("Brand Dashboard" → "Brand workspace", "OTP sent to +91" → "Sent to +91"). Test logic preserved.

## Scope — out (no-touch)

- All of `backend/**` — Window A territory
- Any API call shapes (`authApi.sendOtp`, `authApi.verifyOtp`, `brandApi.register`, `brandApi.resubmit`, `brandApi.getMe`, `influencerApi.register`, `influencerApi.getMe`)
- All form field names + validation rules + when they fire
- localStorage keys (`inflx_token`, `inflx_user`, `inflx_brand`) + AsyncStorage keys
- Role-routing logic (post-OTP-verify branch tree)
- Navigation route names (`'Phone'`, `'OTP'`, `'InfluencerRegister'`, `'Waiting'`, `'Rejected'`)
- Dashboard contents beyond the 2 status banners (campaigns block, KPIs, recent activity, action-required block — all later flows)
- Any other screen in any package

## Design system this flow proves

| Token | Hex | Role |
|---|---|---|
| white | `#FFFFFF` | surfaces |
| bg | `#FAFAFA` | page background |
| yellow | `#FFC107` | primary CTA, swoosh, accents |
| yellow-hover | `#E0A800` | hover state |
| yellow-pale | `#FFF7CC` | badge bg, focus halo |
| ink | `#0A0A0A` | text + dark chrome |
| muted | `#52525B` / `#71717A` / `#A1A1AA` | secondary text ladder |
| border | `#E4E4E7` / `#D4D4D8` | dividers |
| success | `#10B981` | "money in / complete" status |
| danger | `#E8401A` | "money out / error" status |

Fonts: **Outfit** (display) · **Plus Jakarta Sans** (body) · **JetBrains Mono** (digits, IDs).

## User-perceptible changes (consciously approved)

1. Copy softening — "Brand Login" → "Welcome back"; "Application Rejected" → "Your application needs a fix"; "Resubmit" → "Update & resubmit"; "OTP sent to" → "Sent to".
2. Dev-only `💡 Approve at localhost:3003` box removed from production mobile WaitingScreen (kept in Maestro/seed helper if needed).
3. Brand logo renders as a dashed `[LOGO]` placeholder everywhere — replaced once the founder uploads the real asset.
