# 06-diff · Redesign Flow 1 · Brand onboarding

> Honest comparison of what actually shipped vs what the mockups in
> `04-preview/mockups/` predicted. Plain-English, no hand-wave.

## What shipped — web

### `/login` (3 step states)
**Matches the mockup:**
- Locked palette throughout (`#FFC107` yellow CTA on `#FAFAFA` bg, no navy)
- "Welcome back" headline + 1-line lede on phone step
- Phone input: mono digits, `🇮🇳 +91` prefix, focus = yellow halo (`box-shadow 0 0 0 4px rgba(255,193,7,0.18)`)
- OTP cells: 3 distinct visual states (empty grey border / filled yellow-50 bg `#FFFDEB` + yellow border / focus yellow halo)
- "Sent to +91 XXXXX" header with mono number
- Mono digits in the OTP cells
- Yellow-pale `dev · 000000` pill
- Register: 8 fields grouped into "1 Business" + "2 Location" sections with numbered yellow badge headers
- Required asterisks in danger red (`#E8401A`)
- "Update & resubmit" copy preserved as approved
- Footer "By continuing you agree to Terms & Privacy" added on phone step

**Differences from mockup (honest):**
- Brand wordmark renders as the locked `[LOGO]` dashed placeholder via `<Logo />` (deliberate — founder uploads asset later)
- Resend "Resend in 23s" countdown in mockup is shown as a static "Resend OTP" link button in the live page (countdown timer behaviour was not part of Flow 1 logic scope — only the visual treatment changed; old resend logic preserved exactly)

### `/rejected`
**Matches the mockup:**
- "Your application needs a fix" H1 (softened from "Application Rejected")
- Danger-pale circle with `!` glyph instead of ❌ emoji
- "Reason from admin" danger banner with `border-left-[#E8401A]`
- Yellow "Update & resubmit" CTA (no red-orange gradient)
- "Sign out" demoted to ghost button
- Submitted-success state: success-pale circle with `✓`, "Resubmitted" copy

**Differences from mockup:**
- None functional. Icons are inline SVG (web) instead of system glyphs.

### `/dashboard` (status banners only — 2 blocks · ~30 lines edited)
**Matches the mockup:**
- Pending banner: `bg-[#FFF7CC]` (yellow-pale) + `border-l-[#FFC107]` + black icon-circle with yellow clock SVG + "Account under review" title + softened body copy
- Rejected banner: `bg-[#FDEEE9]` (danger-pale) + `border-l-[#E8401A]` + danger icon-circle with `!` + "Account needs a fix" + dotted link to profile
- Approved badge: `bg-[#D1FAE5]` (success-pale) pill with `bg-[#10B981]` dot + "Verified account"

**Differences from mockup:**
- The dashboard *body* (KPI tiles, campaigns, recent activity) is **unchanged from current** — only the 3 banner blocks were in scope for Flow 1. Full dashboard restyle is its own future flow.

---

## What shipped — mobile (RN, all 3 flavors)

### PhoneScreen
**Matches the mockup:**
- `#FAFAFA` bg (no more `navyDeep` solid)
- Wordmark = `<Logo tone="dark" size="md" />` dashed placeholder
- "Welcome back" title + lede preserved
- "Use last number" chip restyled: yellow-50 bg, yellow-pale border, ink mono digits, "USE" CTA chip
- +91 prefix uses monospace
- Sticky bottom CTA bar with yellow filled button + ink text
- "Dev · OTP 000000" yellow-pale pill in helper line

**Behavioural preservation verified by reading the source:** AsyncStorage `inflx_last_phone` read+write retained · `authApi.sendOtp` call unchanged · `navigation.navigate('OTP', { phone, role })` unchanged · 10-digit cap + digit-strip regex unchanged · APP_ROLE-aware workspace label unchanged.

### OTPScreen
**Matches the mockup:**
- Soft bg, mono OTP cells in 3 states
- "Sent to +91 XXXXX" header with mono number
- Clipboard auto-paste toast now visually anchored (yellow-pale row with paste glyph)
- "Auto-verifying when you fill the last digit" microcopy surfaces the auto-verify feature
- Sticky bottom Verify CTA

**Behavioural preservation:** clipboard auto-read on AppState change preserved · auto-verify on 6th digit preserved · role-guard (APP_ROLE vs user.role) preserved · all routing branches (brand → Approved/Pending/Rejected · influencer → InfluencerRegister/Waiting/Rejected/setAppRole · follower → setAppRole · admin → error) preserved · AsyncStorage writes (inflx_token, inflx_refresh_token, inflx_user) preserved.

### InfluencerRegisterScreen
**Matches the mockup:**
- Light bg + light card surface
- `@` prefix on handle inputs in mono yellow
- Required asterisks in danger red, `(optional)` in muted grey
- Yellow-pale info alert: "We'll match your handle…"
- Sticky bottom Complete-registration CTA

**Behavioural preservation:** `influencerApi.register` payload shape preserved (`{ name, instagram_handle, city?, youtube_handle? }`) · handle cleaning regex preserved · `navigation.reset` to `Waiting` with `{ claimMatched, claimConflict, claimMatchCount, handle }` preserved.

### WaitingScreen
**Matches the mockup:**
- 3 variants preserved (standard / matched / conflict) by current `route.params` logic
- Standard: yellow-pale circle + clock glyph ⏱ + ETA chip "ETA &lt; 24h" + yellow info alert
- Matched: success-pale circle + ✓ glyph + custom body text
- Conflict: same as standard (yellow circle + clock) with conflict copy
- Dev hint box (`💡 Approve at localhost:3003`) **removed from production UI**

**Differences from mockup:**
- The mockup used inline SVG clock/check icons. Live RN uses Text-glyph icons (`⏱` and `✓`) inside the colored circles — `react-native-svg` is not in `Packages/Mobile/package.json` so SVG icons would have required a new native dependency (out of scope). Glyphs render cleanly at 38px+ weight 700 on the system fonts.
- Animated pulsing ring shown in the mockup is not implemented — would require RN `Animated` API setup which is out of scope for Flow 1 (visual extra, not functional).

### RejectedScreen
**Matches the mockup:**
- Danger-pale circle with `!` glyph (no ❌ emoji)
- Softened title + body
- "Reason from admin" danger banner
- Yellow "Update & resubmit" CTA
- Ghost "Sign out"
- Submitted-success state preserved

**Differences from mockup:** same as WaitingScreen — Text glyphs in place of SVG icons.

---

## Files touched (final count: 11)

**Web (5)**
- `Packages/brand-web/app/login/page.js`
- `Packages/brand-web/app/rejected/page.js`
- `Packages/brand-web/app/dashboard/page.js` (banner blocks only · ~30 lines)
- `Packages/shared/components/Logo.js` *(new)*
- *(tailwind.config.js untouched — inline arbitrary values used)*

**Mobile (6)**
- `Packages/Mobile/src/screens/auth/PhoneScreen.js`
- `Packages/Mobile/src/screens/auth/OTPScreen.js`
- `Packages/Mobile/src/screens/auth/InfluencerRegisterScreen.js`
- `Packages/Mobile/src/screens/auth/WaitingScreen.js`
- `Packages/Mobile/src/screens/auth/RejectedScreen.js`
- `Packages/Mobile/src/components/Logo.js` *(new)*
- *(theme/tokens.js untouched — locked palette inlined; consolidation in a future token contract)*

**QA (1)**
- `qa/web/brand/auth.spec.ts` — copy assertions realigned to new copy

## Functional preservation — verified via read-through, not assumed

Every preserved item in `05-impact.md` "NO-TOUCH" list re-read post-edit:
- All API calls intact
- All form field names intact
- All validation rules + ordering intact
- All localStorage + AsyncStorage keys intact
- All navigation.reset / navigation.navigate destinations intact
- Role-routing tree intact
- OTP `id="otp-N"` pattern intact (Playwright assertion line 57 still matches)

## QA gate evidence

`pnpm qa` (2026-05-23, post-implementation):

```
67 passed (43.6s)
[qa-report] STATE=GREEN — all reconciliation checks passed
[run-qa] Done. pwExit=0 reportExit=0 → gate 0 (0 = all workflows truly passed).
```

- All 67 specs GREEN · gate 0 · STATE=GREEN
- C1 verdict machine clean (pwExit=0, reportExit=0, no escalations)
- `qa/web/brand/auth.spec.ts` line 66 PASSED with the new copy
  (`Brand workspace` + `Sent to +91` assertions)
- `qa/web/brand/meals-setup.spec.ts` line 67 PASSED — zero Meals regression
- No spec skipped, no assertion weakened, no test deleted
- Report → `qa/reports/2026-05-23T09-02-07-286Z/QA-REPORT.md`

## Deploy outcome (2026-05-23)

- **Web (Vercel)** — `git push origin main` at commit `cca6cf2` triggered Vercel auto-deploy of `brand-web`. New `/login`, `/rejected`, and `/dashboard` banners live for real brand users.
- **Mobile OTA × 3** — all three flavors published successfully to R2 via `https://inflx-platform.onrender.com/v1/ota/publish`:
  - `in.inflx.app.brand` → version **65** (2229 KB)
  - `in.inflx.app.influencer` → version **54** (2229 KB)
  - `in.inflx.app.follower` → version **28** (2229 KB)
- Installed phones pick up the new bundle on their next app launch (NATIVE_RUNTIME=1; no native module changes, so no APK reinstall required).
- First-attempt `publish-ota:all` hit a transient network blip during the brand upload (`fetch failed` mid-POST); per-flavor retry succeeded cleanly on every flavor. Documented honestly — not masked.

**Maestro skipped by explicit founder go** ("skip the mastero go straight to OTA"). `lock.json.release.maestro_green` stays `false` with a populated `governance_override` block citing: (a) `pnpm qa` 67/67 green, (b) verify-twice reads documented in this file, (c) pure visual changes (no logic touched), (d) Maestro doctor was all-green (CLI + adb + emulator + app installed) — skip was a deliberate gate-bypass choice, not a tooling failure. A future mobile-UI Maestro flow contract closes the gap.

## Honest limitations

- **Logo is placeholder.** Real artwork ships when the founder uploads to `Packages/shared/assets/logo/inflx-logo.png`. The placeholder pattern is encapsulated in `<Logo />` so the swap is a one-line change.
- **No animation.** WaitingScreen's pulsing ring + ETA-chip pulse animation in the HTML mockup didn't ship — RN `Animated` setup deferred to a follow-up if visually critical.
- **No tailwind token consolidation.** Locked palette hex codes (`#FFC107`, `#0A0A0A`, etc.) are inlined as arbitrary values. A future token-consolidation contract will hoist these into `tailwind.config.js` + `Packages/shared/theme/tokens.js` once Flow 5+ stabilises.
- **No SVG icons on mobile.** Text glyphs (`⏱` / `✓` / `!`) used in place of inline SVG to avoid adding `react-native-svg` runtime dep. Visual fidelity is close at the rendered sizes (38-40px Text glyphs inside 78px circles).
