# brand-mobile-register

> Founder walkthrough W3 (2026-06-11): on the brand MOBILE app, a NEW phone
> number lands on "you're under admin review" immediately after OTP — without
> ever being asked for business details.

## Symptom + root cause (verified)

`OTPScreen.js:142-151`: for role=brand, when `brandApi.getMe()` fails (no
brands row yet — the normal state for a brand-new number), the app resets to
**Waiting**. The influencer path correctly goes to `InfluencerRegister`; a
`BrandRegister` screen **does not exist on mobile at all** (AuthNavigator has
Influencer + Agency register screens only). Consequence: a mobile-registered
brand is PERMANENTLY STUCK — no brands row is ever created, so the admin
approval queue (which lists brands rows) never shows them, so they can never
be approved. Functional break F; also violates the founder's parity direction
(mobile = web minus listing + campaign creation; registration is "everything
else").

## Fix

1. New `BrandRegisterScreen` (mobile, auth stack): your name, business name,
   industry → business type (founder's W1 REGROUPED hierarchy: Education,
   Consultation Services, Events split out), location via place-search
   autofill (existing follower Places proxy endpoints, already in mobile
   api.js) + manual fields (address/city/state/pincode), pincode 6-digit
   guard, submits `POST /brands/register` incl. lat/lng/locality/
   formatted_address when search was used (endpoint accepts these since
   contract brand-register-location-picker).
2. `OTPScreen`: brand + no profile → `navigate('BrandRegister')` (mirrors
   influencer path). Approved/pending/rejected routing unchanged.
3. `AuthNavigator`: register the new screen.
4. mobile `api.js`: add `brandApi.register`.

## Out of scope

Web registration (already correct); maps-link mode on mobile (search+manual
suffice for v1; link mode can join the parity sweep); the broader brand
mobile↔web parity gaps (separate discussion, see WALKTHROUGH_LEDGER W4).
