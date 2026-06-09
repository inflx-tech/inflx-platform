# Impact — Orders + Profile rebuild

## Terse verdict
Two mobile screens rebuilt + one additive read-only backend feed (/follower/activity).
No money path touched. Reversible via OTA + revert.

## Blast radius
- Backend: new GET /follower/activity (additive; nothing else changed). Render redeploy inert.
- Mobile follower OTA (Orders + Profile). NATIVE_RUNTIME '3'. 4-ID via-creator preserved on cards.
- Rollback = revert + re-publish.

## Verification (honest)
- Babel clean; backend app loads. Activity query unions certain tables (txns + orders +
  bookings); enquiry/return tabs honest-empty until their feeds are wired. Counts/wallet
  blank (not 0) when a call fails. Founder = on-device gate. Maestro waived via GOVERNANCE_OVERRIDE.
