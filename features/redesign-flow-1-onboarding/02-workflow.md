# Workflow — Redesign Flow 1 · Brand onboarding

> No new workflows. This contract restyles existing flows. The
> workflow assertions below are the *current* assertions that must
> still pass post-restyle — proving zero functional disturbance.

## Actor
Unauthenticated visitor on `brand-web` (web) or on the mobile RN app.

## Preconditions
- Backend reachable
- OTP send-endpoint mockable (current `auth.spec.ts` pattern stubs it)

## Workflow steps (user-observable, unchanged)

### Web — `/login`
1. Visitor lands on `/login` → wordmark placeholder + "Welcome back" headline + phone input + "Send OTP" button visible
2. Visitor types 10-digit phone → "Send OTP" enabled
3. Visitor clicks "Send OTP" → `POST /auth/send-otp` called with `+91XXXXXXXXXX`
4. On success → UI advances to OTP state: "Enter the 6-digit code" + 6 cells + "Sent to +91 XXXXX" line + resend countdown
5. Visitor enters 6 digits → "Verify & continue" enabled
6. Visitor clicks Verify → `POST /auth/verify-otp` called
7. On success: existing brand → redirect to `/dashboard`; new brand → register state shown; influencer/follower → blocked with role-mismatch error; admin → redirect to `/admin`
8. Register state: 8 fields grouped into "Business" + "Location" sections → submit → `POST /brands/register` → redirect to `/dashboard`

### Web — `/rejected`
1. Rejected brand lands on `/rejected` → "Your application needs a fix" + reason banner + "Update & resubmit" + "Sign out"
2. Clicks Update & resubmit → `POST /brands/resubmit` → success state shows
3. Clicks Sign out → localStorage cleared → bounces to `/login`

### Web — `/dashboard` (banners only)
1. Pending brand sees yellow-pale "Account pending review" banner with clock icon
2. Rejected brand sees danger-pale "Account rejected" banner with link to profile
3. Approved brand sees small "Verified Account" pill

### Mobile — PhoneScreen → OTPScreen
1. App launches → PhoneScreen with wordmark placeholder + last-used phone chip (if saved) + phone input + "Send OTP"
2. Send OTP → `navigation.navigate('OTP', { phone, role })`
3. OTPScreen: clipboard auto-paste fires if a 6-digit number is in clipboard; auto-verify fires when 6th digit fills
4. On verify success: routing by `user.role` → brand: getMe → Approved/Pending/Rejected branches; influencer: getMe → InfluencerRegister or Waiting/Rejected/setAppRole; follower: setAppRole; admin: error

### Mobile — InfluencerRegisterScreen
1. Influencer fills full name (req) + city + IG handle (req) + YT handle (opt)
2. Submit → `POST /influencers/register` → `navigation.reset` to Waiting with claim outcome params

### Mobile — WaitingScreen
1. 3 variants by route params: standard / `claimMatched` / `claimConflict` — same shell, swap icon + title + body
2. Sign Out → clear AsyncStorage tokens → navigate.reset to Phone

### Mobile — RejectedScreen
1. Rejected brand sees reason banner + "Update & resubmit"
2. Resubmit → `brandApi.resubmit` → success state
3. Sign Out → clear AsyncStorage → navigate.reset to Phone

## Success definition

Every step above produces the same end state as before this contract.
The L2 reference spec `qa/web/brand/auth.spec.ts` reaches the OTP step
with the new copy ("Brand workspace" / "Sent to +91"). `pnpm qa` =
67/67 GREEN. Visual diff captured in `06-diff/`.

## Failure / edge workflows (unchanged from current)

- Send OTP fails → error banner under phone input, button re-enabled
- Verify OTP fails (`Invalid OTP`) → error banner above OTP cells
- Role mismatch (e.g. influencer phone on web) → error banner + token cleared
- Resubmit fails → error preserved; success → submitted state
- Phone < 10 digits → "Send OTP" stays disabled (no API call)
- OTP < 6 digits → "Verify" stays disabled
