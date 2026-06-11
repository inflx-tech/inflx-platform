# Before / after — brand mobile registration

**Before:** new brand number on mobile → OTP → "You're under admin review"
(WaitingScreen) with NO details ever collected. No brands row exists, the
admin approval queue never lists the business, the account is permanently
stuck. The only registration path was brand-web.

**After (matches 04-preview/mockups/brand-register.html):** new brand number →
OTP → "Set up your business" screen — name, business name, industry chips
(W1 regrouped: Education / Consultation Services / Events split out),
business-type chips, place-search with live suggestions + "✓ Location
captured" badge (same Places proxy as the follower address flow; coordinates
flow into brands.lat/lng via the register endpoint shipped in
brand-register-location-picker), editable address/city/pincode, state
bottom-sheet, Complete registration → Waiting (now true — the business IS in
the admin queue).

Existing-brand paths (approved → home, pending → Waiting, rejected →
Rejected) untouched — single branch change in OTPScreen on the no-profile
path only.

Visual deltas vs mockup: none intended; RN implementation mirrors the mockup
1:1 (chips, badge, sheet picker). Verified on-device by founder during the
2026-06-11 walkthrough (this contract WAS the founder's live bug report).
